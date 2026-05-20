/**
 * LiveCoding Service (Tauri port)
 * Main service for AI-powered code analysis and algorithm solving.
 */

import {
  AnalysisEngine,
  type AnalyzeResult,
  type ModelInfo,
  type StreamState,
  type StreamUpdatePayload,
} from './core';

export interface LiveCodingHooks {
  onUpdate?: (payload: StreamUpdatePayload) => void;
}

class LiveCodingService {
  private engine = new AnalysisEngine();
  private state: StreamState = { isLoading: false, isStreaming: false, currentResponse: '' };
  private listeners = new Set<(s: StreamState) => void>();

  subscribe(listener: (s: StreamState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private setState(partial: Partial<StreamState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(l => l(this.state));
  }

  getState(): StreamState {
    return { ...this.state };
  }

  isAnalyzing(): boolean {
    return this.engine.isAnalyzing();
  }

  cancel(): void {
    this.engine.cancel();
  }

  async analyzeScreen(modelInfo: ModelInfo, hooks: LiveCodingHooks = {}): Promise<AnalyzeResult> {
    return this.engine.analyze('ALGORITHM', {
      modelInfo,
      onStateChange: s => this.setState(s),
      onUpdate: hooks.onUpdate,
    });
  }

  async analyzeCode(modelInfo: ModelInfo, hooks: LiveCodingHooks = {}): Promise<AnalyzeResult> {
    return this.engine.analyze('CODE_ANALYSIS', {
      modelInfo,
      onStateChange: s => this.setState(s),
      onUpdate: hooks.onUpdate,
    });
  }

  async iterateCode(modelInfo: ModelInfo, hooks: LiveCodingHooks = {}): Promise<AnalyzeResult> {
    return this.engine.analyze('CODE_ITERATION', {
      modelInfo,
      onStateChange: s => this.setState(s),
      onUpdate: hooks.onUpdate,
    });
  }

  async answerTheory(modelInfo: ModelInfo, hooks: LiveCodingHooks = {}): Promise<AnalyzeResult> {
    return this.engine.analyze('THEORY', {
      modelInfo,
      onStateChange: s => this.setState(s),
      onUpdate: hooks.onUpdate,
    });
  }
}

export const livecodingService = new LiveCodingService();
export default livecodingService;
