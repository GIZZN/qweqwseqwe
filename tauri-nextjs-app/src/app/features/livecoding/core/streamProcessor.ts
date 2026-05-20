/**
 * Stream Processor Module (Tauri port)
 * Handles SSE-style streaming responses from AI models (OpenAI-compatible format).
 */

export interface StreamState {
  isLoading: boolean;
  isStreaming: boolean;
  currentResponse: string;
}

export interface StreamUpdatePayload {
  speaker: 'AI';
  text: string;
  isPartial: boolean;
  isFinal: boolean;
  timestamp: number;
  type: string;
}

export interface StreamProcessOptions {
  onStateChange?: (state: StreamState) => void;
  onUpdate?: (payload: StreamUpdatePayload) => void;
  responseType?: string;
}

export class StreamProcessor {
  private decoder = new TextDecoder();

  async processStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    signal: AbortSignal,
    options: StreamProcessOptions = {},
  ): Promise<string> {
    const { onStateChange = () => {}, onUpdate = () => {}, responseType = 'code' } = options;
    let fullResponse = '';

    try {
      onStateChange({ isLoading: false, isStreaming: true, currentResponse: '' });

      while (true) {
        if (signal.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = this.decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.trim() !== '');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.substring(6);
          if (data === '[DONE]') return fullResponse;

          try {
            const json = JSON.parse(data);
            const token: string = json.choices?.[0]?.delta?.content ?? '';
            if (!token) continue;

            fullResponse += token;
            onStateChange({ isLoading: false, isStreaming: true, currentResponse: fullResponse });
            onUpdate({
              speaker: 'AI',
              text: fullResponse,
              isPartial: true,
              isFinal: false,
              timestamp: Date.now(),
              type: responseType,
            });
          } catch {
            // ignore JSON parse errors on partial chunks
          }
        }
      }
    } finally {
      onStateChange({ isLoading: false, isStreaming: false, currentResponse: fullResponse });
      if (fullResponse) {
        onUpdate({
          speaker: 'AI',
          text: fullResponse,
          isPartial: false,
          isFinal: true,
          timestamp: Date.now(),
          type: responseType,
        });
      }
    }

    return fullResponse;
  }

  setupAbortListener(
    signal: AbortSignal,
    reader: ReadableStreamDefaultReader<Uint8Array>,
    context = 'Stream',
  ): void {
    signal.addEventListener('abort', () => {
      console.log(`[StreamProcessor] 🛑 ${context} aborted`);
      reader.cancel(signal.reason).catch(() => {
        /* ignore */
      });
    });
  }
}
