/**
 * Screenshot Capture Module (Tauri port)
 * Uses Tauri `capture_screenshot` command (Rust side uses `xcap` crate).
 */

import { invoke } from '@tauri-apps/api/core';

export interface ScreenshotOptions {
  quality?: 'low' | 'medium' | 'high';
  width?: number | null;
  height?: number | null;
  jpegQuality?: number;
}

export interface ScreenshotResult {
  success: boolean;
  base64?: string;
  width?: number | null;
  height?: number | null;
  error?: string;
}

interface RustScreenshotResult {
  base64: string;
  width: number;
  height: number;
}

let lastScreenshot: {
  base64: string;
  width: number | null;
  height: number | null;
  timestamp: number;
} | null = null;

export async function captureScreenshot(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
  const { width = null, height = null, jpegQuality = 80 } = options;

  try {
    const result = await invoke<RustScreenshotResult>('capture_screenshot', {
      width,
      height,
      jpegQuality,
    });

    lastScreenshot = {
      base64: result.base64,
      width: result.width,
      height: result.height,
      timestamp: Date.now(),
    };

    return {
      success: true,
      base64: result.base64,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[ScreenshotCapture] Failed:', message);
    return { success: false, error: message };
  }
}

export function getLastScreenshot() {
  return lastScreenshot;
}

export function clearLastScreenshot() {
  lastScreenshot = null;
}
