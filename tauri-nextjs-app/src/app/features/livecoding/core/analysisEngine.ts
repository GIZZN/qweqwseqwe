/**
 * Analysis Engine Module (Tauri port)
 * Core engine for performing AI-powered code analysis.
 */

import { captureScreenshot } from '../../common/capture';
import { PromptBuilder, type AnalysisType, type ModelInfo } from './promptBuilder';
import { StreamProcessor, type StreamState, type StreamUpdatePayload } from './streamProcessor';
import { createStreamingLLM, type Provider } from './llmClient';

export interface AnalyzeOptions {
  onStateChange?: (state: StreamState) => void;
  onUpdate?: (payload: StreamUpdatePayload) => void;
  screenshotOptions?: { width?: number | null; height?: number | null; jpegQuality?: number };
  customPrompt?: string | null;
  modelInfo: ModelInfo;
}

export interface AnalyzeResult {
  success: boolean;
  response?: string;
  error?: string;
}

export class AnalysisEngine {
  private promptBuilder = new PromptBuilder();
  private streamProcessor = new StreamProcessor();
  private abortController: AbortController | null = null;

  async analyze(analysisType: AnalysisType, options: AnalyzeOptions): Promise<AnalyzeResult> {
    const {
      onStateChange = () => {},
      onUpdate = () => {},
      screenshotOptions = { width: 1920, jpegQuality: 90 },
      customPrompt = null,
      modelInfo,
    } = options;

    console.log(`[AnalysisEngine] Starting ${analysisType} analysis...`);
    onStateChange({ isLoading: true, isStreaming: false, currentResponse: '' });

    if (this.abortController) {
      this.abortController.abort('New request');
    }
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    try {
      if (!modelInfo?.apiKey) throw new Error('AI model or API key not configured.');

      const shot = await captureScreenshot(screenshotOptions);
      if (!shot.success || !shot.base64) {
        throw new Error(shot.error || 'Failed to capture screenshot');
      }

      const messages = this.promptBuilder.buildMessages(analysisType, shot.base64, { customPrompt });
      const llmConfig = this.promptBuilder.getLLMConfig(analysisType, modelInfo);

      const streamingLLM = createStreamingLLM(modelInfo.provider as Provider, llmConfig);
      const response = await streamingLLM.streamChat(messages);

      if (!response.body) throw new Error('No response body');
      const reader = response.body.getReader();
      this.streamProcessor.setupAbortListener(signal, reader, analysisType);

      const fullResponse = await this.streamProcessor.processStream(reader, signal, {
        onStateChange,
        onUpdate,
        responseType: 'code',
      });

      console.log(`[AnalysisEngine] ✅ ${analysisType} completed`);
      return { success: true, response: fullResponse };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[AnalysisEngine] ❌ ${analysisType} failed:`, message);
      onStateChange({ isLoading: false, isStreaming: false, currentResponse: '' });
      return { success: false, error: message };
    } finally {
      this.abortController = null;
    }
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort('User cancelled');
      this.abortController = null;
    }
  }

  isAnalyzing(): boolean {
    return this.abortController !== null;
  }
}
