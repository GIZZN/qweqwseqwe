use once_cell::sync::Lazy;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::WebviewWindow;

static MAXIMIZABLE_ENABLED: Lazy<AtomicBool> = Lazy::new(|| AtomicBool::new(false));

pub fn is_maximizable_enabled() -> bool {
    MAXIMIZABLE_ENABLED.load(Ordering::SeqCst)
}

pub fn set_maximizable(window: &WebviewWindow, enabled: bool) -> Result<(), String> {
    window
        .set_maximizable(enabled)
        .map_err(|e| e.to_string())?;
    MAXIMIZABLE_ENABLED.store(enabled, Ordering::SeqCst);
    Ok(())
}

pub fn toggle_maximizable(window: &WebviewWindow) -> Result<bool, String> {
    let new_state = !is_maximizable_enabled();
    set_maximizable(window, new_state)?;
    Ok(new_state)
}


