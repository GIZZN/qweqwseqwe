use tauri::WebviewWindow;
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