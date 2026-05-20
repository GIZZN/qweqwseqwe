use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};
use tauri::Manager;
use crate::window_manager;

pub const POPUP_LABEL: &str = "Camera";

fn popup_url() -> WebviewUrl {
    WebviewUrl::App("/components/PopupComponents/popup".into())
}

pub fn ensure_popup(app: &AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(POPUP_LABEL) {
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        app,
        POPUP_LABEL,
        popup_url(),
    )
    .title("Camera")
    .inner_size(480.0, 360.0)
    .resizable(true)
    .maximizable(false)
    .decorations(false)
    .transparent(true)
    .visible(true)
    .build()
    .map_err(|e| e.to_string())?;

    // После создания включаем режим "поверх всех окон"
    if let Some(created) = app.get_webview_window(POPUP_LABEL) {
        let _ = window_manager::enable_always_on_top(&created);
    }

    Ok(())
}