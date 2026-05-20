/**
 * Whisper Service (Tauri port)
 * TypeScript wrapper over Rust Tauri commands for Whisper transcription.
 * The Rust backend (audio_transcriber.rs) handles model loading and inference.
 */

import { invoke } from '@tauri-apps/api/core';

export type WhisperModel = 'whisper-tiny' | 'whisper-base' | 'whisper-small' | 'whisper-medium';

export interface WhisperModelInfo {
  id: WhisperModel;
  name: string;
  size: string;
  installed: boolean;
}

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  error?: string;
}

export interface WhisperStatus {
  initialized: boolean;
  currentModel: WhisperModel | null;
  isTranscribing: boolean;
}

const AVAILABLE_MODELS: Record<WhisperModel, { name: string; size: string }> = {
  'whisper-tiny': { name: 'Tiny', size: '39M' },
  'whisper-base': { name: 'Base', size: '74M' },
  'whisper-small': { name: 'Small', size: '244M' },
  'whisper-medium': { name: 'Medium', size: '769M' },
};

type Listener = (status: WhisperStatus) => void;

export class WhisperService {
  private status: WhisperStatus = {
    initialized: false,
    currentModel: null,
    isTranscribing: false,
  };
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private setStatus(partial: Partial<WhisperStatus>): void {
    this.status = { ...this.status, ...partial };
    this.listeners.forEach(l => l(this.status));
  }

  getStatus(): WhisperStatus {
    return { ...this.status };
  }

  /** Initialize whisper with a given model. Calls Rust to load the model. */
  async initialize(model: WhisperModel = 'whisper-small'): Promise<void> {
    try {
      await invoke('whisper_initialize', { model });
      this.setStatus({ initialized: true, currentModel: model });
      console.log(`[WhisperService] Initialized with model: ${model}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[WhisperService] Init failed:', msg);
      throw new Error(msg);
    }
  }

  /** Transcribe captured audio. Rust handles capture + inference. */
  async transcribe(): Promise<TranscriptionResult> {
    if (!this.status.initialized) {
      return { success: false, error: 'Whisper not initialized' };
    }

    this.setStatus({ isTranscribing: true });
    try {
      const text = await invoke<string>('whisper_transcribe');
      return { success: true, text };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    } finally {
      this.setStatus({ isTranscribing: false });
    }
  }

  /** Download a model (Rust handles the download). */
  async downloadModel(model: WhisperModel): Promise<{ success: boolean; error?: string }> {
    try {
      await invoke('whisper_download_model', { model });
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }

  /** Get list of models with installed status. */
  async getInstalledModels(): Promise<WhisperModelInfo[]> {
    try {
      const installed = await invoke<string[]>('whisper_get_installed_models');
      return Object.entries(AVAILABLE_MODELS).map(([id, info]) => ({
        id: id as WhisperModel,
        name: info.name,
        size: info.size,
        installed: installed.includes(id),
      }));
    } catch {
      // Fallback: assume none installed
      return Object.entries(AVAILABLE_MODELS).map(([id, info]) => ({
        id: id as WhisperModel,
        name: info.name,
        size: info.size,
        installed: false,
      }));
    }
  }

  /** Check if whisper model is available. */
  async isModelAvailable(model: WhisperModel): Promise<boolean> {
    try {
      return await invoke<boolean>('whisper_is_model_available', { model });
    } catch {
      return false;
    }
  }
}

export const whisperService = new WhisperService();
export default whisperService;
