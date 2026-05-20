/**
 * Features Module - Central Export Point
 * Ported from RaxatGlass Electron project to Tauri.
 */

// LiveCoding - AI-powered code analysis
export { livecodingService } from './livecoding/livecodingService';
export type { LiveCodingHooks } from './livecoding/livecodingService';
export {
  AnalysisEngine,
  PromptBuilder,
  StreamProcessor,
  ANALYSIS_TYPES,
  createStreamingLLM,
} from './livecoding/core';
export type {
  AnalysisType,
  ModelInfo,
  StreamState,
  StreamUpdatePayload,
  AnalyzeResult,
} from './livecoding/core';

// Capture - Screenshot & Token tracking
export {
  captureScreenshot,
  getLastScreenshot,
  clearLastScreenshot,
  tokenTracker,
  TokenTracker,
} from './common/capture';
export type { ScreenshotOptions, ScreenshotResult } from './common/capture';

// Whisper - Local speech-to-text
export { whisperService, WhisperService } from './common/whisper';
export type {
  WhisperModel,
  WhisperModelInfo,
  TranscriptionResult,
  WhisperStatus,
} from './common/whisper';
