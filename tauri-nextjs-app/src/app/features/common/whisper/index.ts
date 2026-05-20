/**
 * Whisper Module - Central Export Point (Tauri port)
 * All heavy lifting (binary management, model download, transcription)
 * is done in Rust via whisper-rs. This TS layer provides a clean API.
 */

export { WhisperService, whisperService } from './whisperService';
export type {
  WhisperModel,
  WhisperModelInfo,
  TranscriptionResult,
  WhisperStatus,
} from './whisperService';
