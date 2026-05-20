/**
 * Capture Module - Central Export Point (Tauri port)
 */

export {
  captureScreenshot,
  getLastScreenshot,
  clearLastScreenshot,
} from './screenshotCapture';

export type { ScreenshotOptions, ScreenshotResult } from './screenshotCapture';

export { TokenTracker, tokenTracker } from './tokenTracker';

// Platform detection
export const isLinux =
  typeof navigator !== 'undefined' && /linux/i.test(navigator.userAgent);
export const isMacOS =
  typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);

// Audio constants (kept for API compatibility with original module)
export const SAMPLE_RATE = 24000;
export const AUDIO_CHUNK_DURATION = 0.1;
export const BUFFER_SIZE = 4096;
