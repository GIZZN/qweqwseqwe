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

    // Buffer for an SSE line split across two reads. Without it, a `data: {...}`
    // line cut at a chunk boundary fails to parse and the token is dropped,
    // making the response read as if it were truncated mid-thought.
    let buffer = '';

    const handleData = (data: string): boolean => {
      if (data === '[DONE]') return true;
      try {
        const json = JSON.parse(data);
        const token: string = json.choices?.[0]?.delta?.content ?? '';
        if (!token) return false;

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
      return false;
    };

    try {
      onStateChange({ isLoading: false, isStreaming: true, currentResponse: '' });

      while (true) {
        if (signal.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;

        // stream:true keeps multi-byte UTF-8 chars (e.g. Cyrillic) split across
        // chunk boundaries intact instead of corrupting them into `�`.
        buffer += this.decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith('data: ')) continue;
          if (handleData(line.substring(6).trim())) return fullResponse;
        }
      }

      // Flush any final buffered line that arrived without a trailing newline.
      buffer += this.decoder.decode();
      const last = buffer.trim();
      if (last.startsWith('data: ')) handleData(last.substring(6).trim());
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
