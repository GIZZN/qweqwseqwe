use tauri::{AppHandle, Manager, WebviewWindow};
use once_cell::sync::Lazy;
use parking_lot::RwLock;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[cfg(target_os = "windows")]
use winapi::{
    um::winuser::{
        SetWindowPos, GetWindowLongW, SetWindowLongW,
        HWND_TOPMOST, HWND_NOTOPMOST, SWP_NOMOVE, SWP_NOSIZE, SWP_NOACTIVATE,
        GWL_EXSTYLE, WS_EX_TOPMOST, GetForegroundWindow
    },
    shared::windef::HWND,
};

// Глобальное состояние для отслеживания, закреплено ли окно поверх всех окон
static ALWAYS_ON_TOP_ENABLED: Lazy<RwLock<bool>> = Lazy::new(|| {
    RwLock::new(false)
});

// Отслеживание потока мониторинга
static MONITOR_THREAD_RUNNING: Lazy<AtomicBool> = Lazy::new(|| {
    AtomicBool::new(false)
});

/// Включает режим "Поверх всех окон" для указанного окна
pub fn enable_always_on_top(window: &WebviewWindow) -> Result<(), String> {
    let mut enabled = ALWAYS_ON_TOP_ENABLED.write();
    
    if *enabled {
        return Ok(());
    }
    
    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd) = window.hwnd() {
            let hwnd = hwnd.0 as HWND;
            
            unsafe {
                // Устанавливаем окно поверх всех окон
                let result = SetWindowPos(
                    hwnd,
                    HWND_TOPMOST,
                    0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE
                );
                
                if result == 0 {
                    return Err(format!("Не удалось установить окно поверх всех окон: {}", std::io::Error::last_os_error()));
                }
                
                // Устанавливаем стиль WS_EX_TOPMOST
                let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
                SetWindowLongW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_TOPMOST as i32);
                
                // Запускаем поток мониторинга для поддержания окна поверх всех окон
                start_topmost_monitor(hwnd);
            }
        }
    }
    
    *enabled = true;
    println!("Always on top mode enabled for app window");
    Ok(())
}

/// Отключает режим "Поверх всех окон" для указанного окна
pub fn disable_always_on_top(window: &WebviewWindow) -> Result<(), String> {
    let mut enabled = ALWAYS_ON_TOP_ENABLED.write();
    
    if !*enabled {
        return Ok(());
    }
    
    // Остановка мониторингового потока
    MONITOR_THREAD_RUNNING.store(false, Ordering::SeqCst);
    
    // Даем потоку время на завершение
    std::thread::sleep(std::time::Duration::from_millis(50));
    
    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd) = window.hwnd() {
            let hwnd = hwnd.0 as HWND;
            
            unsafe {
                // Снимаем флаг "поверх всех окон"
                let result = SetWindowPos(
                    hwnd,
                    HWND_NOTOPMOST,
                    0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE
                );
                
                if result == 0 {
                    return Err(format!("Не удалось снять флаг поверх всех окон: {}", std::io::Error::last_os_error()));
                }
                
                // Убираем стиль WS_EX_TOPMOST
                let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
                SetWindowLongW(hwnd, GWL_EXSTYLE, ex_style & !(WS_EX_TOPMOST as i32));
            }
        }
    }
    
    *enabled = false;
    println!("Always on top mode disabled");
    Ok(())
}

/// Переключает режим "Поверх всех окон" для указанного окна
pub fn toggle_always_on_top(window: &WebviewWindow) -> Result<bool, String> {
    let enabled = *ALWAYS_ON_TOP_ENABLED.read();
    
    if enabled {
        disable_always_on_top(window)?;
        Ok(false)
    } else {
        enable_always_on_top(window)?;
        Ok(true)
    }
}

/// Проверяет, включен ли режим "Поверх всех окон"
pub fn is_always_on_top_enabled() -> bool {
    *ALWAYS_ON_TOP_ENABLED.read()
}

/// Ставит/снимает topmost для КОНКРЕТНОГО окна без изменения глобального флага и
/// без монитор-потока. Нужно для вторичных окон (popup, legend), т.к.
/// `enable_always_on_top` рано выходит, если глобальный флаг уже установлен.
#[cfg(target_os = "windows")]
pub fn set_topmost_raw(window: &WebviewWindow, enabled: bool) {
    if let Ok(hwnd) = window.hwnd() {
        let hwnd = hwnd.0 as HWND;
        unsafe {
            let insert_after = if enabled { HWND_TOPMOST } else { HWND_NOTOPMOST };
            SetWindowPos(hwnd, insert_after, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
            let ex = GetWindowLongW(hwnd, GWL_EXSTYLE);
            let ex = if enabled { ex | WS_EX_TOPMOST as i32 } else { ex & !(WS_EX_TOPMOST as i32) };
            SetWindowLongW(hwnd, GWL_EXSTYLE, ex);
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn set_topmost_raw(_window: &WebviewWindow, _enabled: bool) {}

/// Применяет "поверх всех окон" ко ВСЕМ окнам: главное окно — через полноценный
/// механизм (флаг + монитор-поток), вторичные — через `set_topmost_raw`.
pub fn apply_always_on_top_to_all(app: &AppHandle, enabled: bool) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = if enabled { enable_always_on_top(&main) } else { disable_always_on_top(&main) };
    }
    for window in app.webview_windows().values() {
        if window.label() != "main" {
            set_topmost_raw(window, enabled);
        }
    }
}

/// Скрывает/показывает ВСЕ окна в панели задач.
pub fn apply_skip_taskbar_to_all(app: &AppHandle, hidden: bool) {
    for window in app.webview_windows().values() {
        let _ = window.set_skip_taskbar(hidden);
    }
}

#[cfg(target_os = "windows")]
fn start_topmost_monitor(hwnd: HWND) {
    if MONITOR_THREAD_RUNNING.load(Ordering::SeqCst) {
        return;
    }
    
    MONITOR_THREAD_RUNNING.store(true, Ordering::SeqCst);
    
    // Создаем Arc для безопасной передачи HWND между потоками
    let hwnd = Arc::new(hwnd as usize);
    let hwnd_clone = Arc::clone(&hwnd);
    
    // Создаем отдельный поток для мониторинга и поддержания окна поверх всех окон
    std::thread::spawn(move || {
        println!("Поток мониторинга 'поверх всех окон' запущен");
        
        while MONITOR_THREAD_RUNNING.load(Ordering::SeqCst) && *ALWAYS_ON_TOP_ENABLED.read() {
            unsafe {
                // Проверяем, не потеряло ли окно фокус
                let foreground_window = GetForegroundWindow();
                let hwnd_value = *hwnd_clone as HWND;
                
                if foreground_window != hwnd_value {
                    // Если окно не в фокусе, убеждаемся, что оно все еще поверх всех окон
                    SetWindowPos(
                        hwnd_value,
                        HWND_TOPMOST,
                        0, 0, 0, 0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE
                    );
                }
            }
            
            // Спим некоторое время, чтобы не нагружать CPU
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
        
        println!("Поток мониторинга 'поверх всех окон' остановлен");
    });
} 