use tauri::{AppHandle, Manager, WebviewWindow};
use once_cell::sync::Lazy;
use parking_lot::RwLock;

#[cfg(target_os = "windows")]
use winapi::{
    um::winuser::SetWindowDisplayAffinity,
    shared::windef::HWND,
};

// Определяем константы для Windows
#[cfg(target_os = "windows")]
const WDA_EXCLUDEFROMCAPTURE: u32 = 0x00000011;
#[cfg(target_os = "windows")]
const WDA_NONE: u32 = 0x00000000;

// Глобальное состояние для отслеживания защиты от захвата экрана
static PROTECTION_ENABLED: Lazy<RwLock<bool>> = Lazy::new(|| {
    RwLock::new(false)
});

/// Скрывает окно от захвата экрана
pub async fn hide_from_screen_sharing(window: &WebviewWindow) -> Result<(), String> {
    // Используем только WDA_EXCLUDEFROMCAPTURE - наиболее безопасный метод
    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd) = window.hwnd() {
            let hwnd = hwnd.0 as HWND;
            unsafe {
                // Используем только WDA_EXCLUDEFROMCAPTURE
                // WS_EX_NOREDIRECTIONBITMAP может вызывать проблемы с отрисовкой в Tauri
                let result = SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);
                if result == 0 {
                    return Err("Не удалось установить защиту от захвата экрана".to_string());
                }
            }
        }
    }
    
    println!("Приложение скрыто от демонстрации экрана (WDA_EXCLUDEFROMCAPTURE)");
    Ok(())
}

/// Показывает окно в захвате экрана
pub async fn show_in_screen_sharing(window: &WebviewWindow) -> Result<(), String> {
    // Убираем защиту от захвата экрана
    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd) = window.hwnd() {
            let hwnd = hwnd.0 as HWND;
            unsafe {
                // Убираем WDA_EXCLUDEFROMCAPTURE
                let result = SetWindowDisplayAffinity(hwnd, WDA_NONE);
                if result == 0 {
                    return Err("Не удалось отключить защиту от захвата экрана".to_string());
                }
            }
        }
    }
    
    println!("Приложение показано в демонстрации экрана");
    Ok(())
}

fn set_protection_mode_internal(window: &WebviewWindow, enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd) = window.hwnd() {
            let hwnd = hwnd.0 as HWND;
            unsafe {
                if enabled {
                    let result = SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);
                    if result == 0 {
                        return Err("Не удалось включить защиту от захвата экрана".to_string());
                    }
                    println!("Защита от захвата экрана ВКЛЮЧЕНА (WDA_EXCLUDEFROMCAPTURE)");
                } else {
                    let result = SetWindowDisplayAffinity(hwnd, WDA_NONE);
                    if result == 0 {
                        return Err("Не удалось отключить защиту от захвата экрана".to_string());
                    }
                    println!("Защита от захвата экрана ОТКЛЮЧЕНА");
                }
            }
        }
    }
    *PROTECTION_ENABLED.write() = enabled;
    Ok(())
}

/// Устанавливает режим защиты (async совместимость)
pub async fn set_protection_mode(window: &WebviewWindow, enabled: bool) -> Result<(), String> {
    set_protection_mode_internal(window, enabled)
}

/// Синхронная версия для вызовов с главного потока
pub fn set_protection_mode_sync(window: &WebviewWindow, enabled: bool) -> Result<(), String> {
    set_protection_mode_internal(window, enabled)
}

/// Проверяет, включена ли защита от захвата экрана
pub fn is_protection_enabled() -> bool {
    *PROTECTION_ENABLED.read()
}

/// Применяет режим защиты ко ВСЕМ открытым окнам (main, popup, legend, …).
/// Best-effort: сбой на одном окне не прерывает остальные.
pub fn apply_to_all(app: &AppHandle, enabled: bool) -> Result<(), String> {
    for window in app.webview_windows().values() {
        let _ = set_protection_mode_internal(window, enabled);
    }
    *PROTECTION_ENABLED.write() = enabled;
    Ok(())
}

/// Переключает режим защиты от захвата экрана
pub async fn toggle_protection_mode(window: &WebviewWindow) -> Result<bool, String> {
    let current_state = is_protection_enabled();
    set_protection_mode_internal(window, !current_state)?;
    Ok(!current_state)
} 