//! Screenshot capture module.
//! Uses Windows GDI to capture the primary screen and return JPEG base64.

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;
use std::io::Cursor;

#[derive(Serialize)]
pub struct ScreenshotResult {
    pub base64: String,
    pub width: u32,
    pub height: u32,
}

/// Capture the primary screen, optionally resize, encode as JPEG.
pub fn capture(
    _target_width: Option<u32>,
    _target_height: Option<u32>,
    jpeg_quality: u8,
) -> Result<ScreenshotResult, String> {
    #[cfg(target_os = "windows")]
    {
        capture_windows(_target_width, _target_height, jpeg_quality)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Screenshot capture not implemented for this platform".to_string())
    }
}

#[cfg(target_os = "windows")]
fn capture_windows(
    _target_width: Option<u32>,
    _target_height: Option<u32>,
    jpeg_quality: u8,
) -> Result<ScreenshotResult, String> {
    use winapi::um::wingdi::{
        BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject,
        GetDIBits, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
        SRCCOPY,
    };
    use winapi::um::winuser::{GetDC, GetSystemMetrics, ReleaseDC, SM_CXSCREEN, SM_CYSCREEN};
    use winapi::shared::windef::HBITMAP;

    unsafe {
        let screen_w = GetSystemMetrics(SM_CXSCREEN) as u32;
        let screen_h = GetSystemMetrics(SM_CYSCREEN) as u32;

        let hdc_screen = GetDC(std::ptr::null_mut());
        if hdc_screen.is_null() {
            return Err("GetDC failed".into());
        }

        let hdc_mem = CreateCompatibleDC(hdc_screen);
        let hbm = CreateCompatibleBitmap(hdc_screen, screen_w as i32, screen_h as i32);
        let old = SelectObject(hdc_mem, hbm as *mut _);

        BitBlt(
            hdc_mem,
            0,
            0,
            screen_w as i32,
            screen_h as i32,
            hdc_screen,
            0,
            0,
            SRCCOPY,
        );

        // Read pixels
        let mut bmi: BITMAPINFO = std::mem::zeroed();
        bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmiHeader.biWidth = screen_w as i32;
        bmi.bmiHeader.biHeight = -(screen_h as i32); // top-down
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = BI_RGB;

        let mut pixels: Vec<u8> = vec![0u8; (screen_w * screen_h * 4) as usize];
        GetDIBits(
            hdc_mem,
            hbm as HBITMAP,
            0,
            screen_h,
            pixels.as_mut_ptr() as *mut _,
            &mut bmi,
            DIB_RGB_COLORS,
        );

        // Cleanup GDI
        SelectObject(hdc_mem, old);
        DeleteObject(hbm as *mut _);
        DeleteDC(hdc_mem);
        ReleaseDC(std::ptr::null_mut(), hdc_screen);

        // Convert BGRA -> RGB for JPEG encoding
        let mut rgb_pixels: Vec<u8> = Vec::with_capacity((screen_w * screen_h * 3) as usize);
        for chunk in pixels.chunks_exact(4) {
            rgb_pixels.push(chunk[2]); // R
            rgb_pixels.push(chunk[1]); // G
            rgb_pixels.push(chunk[0]); // B
        }

        // Encode JPEG using a simple encoder
        let mut jpeg_buf = Cursor::new(Vec::new());
        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
            &mut jpeg_buf,
            jpeg_quality,
        );
        encoder
            .encode(&rgb_pixels, screen_w, screen_h, image::ExtendedColorType::Rgb8)
            .map_err(|e| format!("JPEG encode failed: {}", e))?;

        let base64_str = STANDARD.encode(jpeg_buf.into_inner());

        Ok(ScreenshotResult {
            base64: base64_str,
            width: screen_w,
            height: screen_h,
        })
    }
}
