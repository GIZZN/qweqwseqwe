use tauri::{AppHandle, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder, WebviewWindow};
use tauri::Manager;
use crate::window_manager;

pub const LEGEND_LABEL: &str = "legend";

// ── Нативное скрытие курсора ресайза на рамке окна легенды ──
// Окно бескадровое и растягиваемое, поэтому ОС рисует на гранях курсор ресайза
// (↔↕⤡), который CSS не перебивает. Мы вешаем свой WndProc именно на окно легенды
// (изолированно от cursor_manager главного окна) и на любой НЕ-клиентской зоне
// форсируем стрелку через WM_SETCURSOR. WM_NCHITTEST пропускаем без изменений —
// значит ресайз гранями продолжает работать, просто без характерного курсора.
#[cfg(target_os = "windows")]
static LEGEND_ORIG_WNDPROC: std::sync::atomic::AtomicIsize = std::sync::atomic::AtomicIsize::new(0);
#[cfg(target_os = "windows")]
static LEGEND_HOOK_INSTALLED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[cfg(target_os = "windows")]
unsafe extern "system" fn legend_wndproc(
    hwnd: winapi::shared::windef::HWND,
    msg: u32,
    wparam: winapi::shared::minwindef::WPARAM,
    lparam: winapi::shared::minwindef::LPARAM,
) -> winapi::shared::minwindef::LRESULT {
    use std::sync::atomic::Ordering;
    use winapi::um::winuser::{CallWindowProcW, LoadCursorW, SetCursor, HTCLIENT, IDC_ARROW, WM_SETCURSOR};

    if msg == WM_SETCURSOR {
        // Младшее слово lparam — результат hit-test. Всё, что не клиентская область
        // (т.е. рамки/углы/заголовок), принудительно получает стрелку.
        let hit = (lparam & 0xFFFF) as i32;
        if hit != HTCLIENT as i32 {
            let arrow = LoadCursorW(std::ptr::null_mut(), IDC_ARROW);
            if !arrow.is_null() {
                SetCursor(arrow);
            }
            return 1; // TRUE — обработано, системный курсор ресайза не ставится
        }
    }

    let orig = LEGEND_ORIG_WNDPROC.load(Ordering::SeqCst);
    CallWindowProcW(std::mem::transmute(orig), hwnd, msg, wparam, lparam)
}

#[cfg(target_os = "windows")]
fn install_legend_cursor_hook(window: &WebviewWindow) {
    use std::sync::atomic::Ordering;
    use winapi::shared::windef::HWND;
    use winapi::um::winuser::{SetWindowLongPtrW, GWLP_WNDPROC};

    // Ставим сабкласс ровно один раз за время жизни приложения.
    if LEGEND_HOOK_INSTALLED.swap(true, Ordering::SeqCst) {
        return;
    }
    if let Ok(hwnd) = window.hwnd() {
        let hwnd = hwnd.0 as HWND;
        unsafe {
            let orig = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, legend_wndproc as *const () as isize);
            LEGEND_ORIG_WNDPROC.store(orig, Ordering::SeqCst);
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn install_legend_cursor_hook(_window: &WebviewWindow) {}

/// Width of the docked overlay column, in physical pixels.
const LEGEND_WIDTH: u32 = 400;

/// Path string for the legend route. Kept separate from `legend_url()` so it can
/// be asserted in a unit test without constructing a WebviewUrl.
const LEGEND_PATH: &str = "/legend/";

fn legend_url() -> WebviewUrl {
    // Trailing slash is REQUIRED: with Next.js `output: 'export' + trailingSlash: true`
    // the page is emitted at out/legend/index.html. Without the slash, dev returns a
    // 308 redirect and the production asset protocol returns 404 → blank white window.
    // `/legend/` resolves directly to index.html in both dev and production.
    WebviewUrl::App(LEGEND_PATH.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legend_path_has_trailing_slash() {
        // Regression guard: a missing trailing slash causes a 308 redirect in dev
        // and a 404 (blank white window) in the production asset protocol.
        assert!(LEGEND_PATH.ends_with('/'), "LEGEND_PATH must end with '/'");
        assert!(LEGEND_PATH.starts_with('/'), "LEGEND_PATH must be absolute");
    }

    #[test]
    fn right_edge_pins_to_right() {
        // x for a right dock = monitor_x + monitor_width - window_width.
        let mon_x = 0i32;
        let mon_w = 1920u32;
        let win_w = 400u32;
        let x = mon_x + (mon_w as i32 - win_w as i32);
        assert_eq!(x, 1520);
    }

    #[test]
    fn left_edge_pins_to_monitor_origin() {
        let mon_x = -1920i32; // secondary monitor to the left
        let x = mon_x; // left dock uses monitor origin directly
        assert_eq!(x, -1920);
    }
}

/// Work area (in physical pixels) of the monitor the window sits on, EXCLUDING the
/// taskbar/app bars. Returns (x, y, width, height). Windows-only — uses GetMonitorInfo's
/// rcWork so the docked overlay never hides behind the taskbar.
#[cfg(target_os = "windows")]
fn work_area(window: &WebviewWindow) -> Option<(i32, i32, i32, i32)> {
    use winapi::shared::windef::HWND;
    use winapi::um::winuser::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};

    let hwnd = window.hwnd().ok()?.0 as HWND;
    unsafe {
        let hmon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        if hmon.is_null() {
            return None;
        }
        let mut mi: MONITORINFO = std::mem::zeroed();
        mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(hmon, &mut mi) == 0 {
            return None;
        }
        let r = mi.rcWork;
        Some((r.left, r.top, r.right - r.left, r.bottom - r.top))
    }
}

/// Snap the window to the left or right edge of its current monitor's WORK AREA
/// (full height minus the taskbar).
pub fn dock_to_edge(window: &WebviewWindow, edge: &str) -> Result<(), String> {
    // Preferred on Windows: rcWork excludes the taskbar so the bottom stays visible.
    #[cfg(target_os = "windows")]
    {
        if let Some((ax, ay, aw, ah)) = work_area(window) {
            let width = LEGEND_WIDTH.min(aw.max(0) as u32);
            let height = ah.max(0) as u32;
            let x = if edge == "left" { ax } else { ax + aw - width as i32 };
            window
                .set_size(PhysicalSize::new(width, height))
                .map_err(|e| e.to_string())?;
            window
                .set_position(PhysicalPosition::new(x, ay))
                .map_err(|e| e.to_string())?;
            return Ok(());
        }
    }

    // Fallback: full monitor bounds (may sit under the taskbar, but better than nothing).
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No monitor found".to_string())?;

    let m_size = monitor.size();
    let m_pos = monitor.position();
    let width = LEGEND_WIDTH.min(m_size.width);
    let height = m_size.height;
    let x = if edge == "left" {
        m_pos.x
    } else {
        m_pos.x + (m_size.width as i32 - width as i32)
    };

    window
        .set_size(PhysicalSize::new(width, height))
        .map_err(|e| e.to_string())?;
    window
        .set_position(PhysicalPosition::new(x, m_pos.y))
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn ensure_legend_window(app: &AppHandle, edge: &str, always_on_top: bool) -> Result<(), String> {
    // Preferred path: the window is declared in tauri.conf.json (visible:false) so it
    // uses the SAME transparency setup as the main window. Runtime-built transparent
    // windows render fully white on Windows/WebView2 — declaring it in config avoids that.
    if let Some(existing) = app.get_webview_window(LEGEND_LABEL) {
        eprintln!("[legend] show pre-declared window, dock edge={}", edge);
        let _ = dock_to_edge(&existing, edge);
        let _ = existing.show();
        let _ = existing.set_focus();
        apply_inherited_state(&existing, always_on_top);
        return Ok(());
    }

    // Fallback (should not happen if the config window exists): build at runtime.
    eprintln!("[legend] config window missing, building at runtime url={:?}", legend_url());
    WebviewWindowBuilder::new(app, LEGEND_LABEL, legend_url())
        .title("Легенда опыта")
        .inner_size(LEGEND_WIDTH as f64, 900.0)
        .resizable(true)
        .maximizable(false)
        .decorations(false)
        .transparent(true)
        .visible(true)
        .build()
        .map_err(|e| {
            eprintln!("[legend] build FAILED: {}", e);
            e.to_string()
        })?;

    if let Some(created) = app.get_webview_window(LEGEND_LABEL) {
        let _ = dock_to_edge(&created, edge);
        apply_inherited_state(&created, always_on_top);
    }

    Ok(())
}

/// Applies the app-wide window settings to the legend window so it behaves like the
/// rest of the app: always-on-top (its own pref OR the global setting), screen-capture
/// protection, and taskbar visibility. The standard-cursor setting is handled by the
/// shared <StandardCursor> React wrapper that wraps every route.
fn apply_inherited_state(window: &WebviewWindow, always_on_top_pref: bool) {
    // Native cursor hook: keep resize working but never show the resize cursor.
    install_legend_cursor_hook(window);
    if always_on_top_pref || window_manager::is_always_on_top_enabled() {
        window_manager::set_topmost_raw(window, true);
    }
    if crate::screen_protection::is_protection_enabled() {
        let _ = crate::screen_protection::set_protection_mode_sync(window, true);
    }
    let _ = window.set_skip_taskbar(crate::hotkey_manager::is_taskbar_hidden());
}
