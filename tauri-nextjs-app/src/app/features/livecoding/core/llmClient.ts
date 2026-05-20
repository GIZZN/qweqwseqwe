/**
 * LLM Streaming Client (Tauri port)
 * Minimal browser-compatible streaming client supporting OpenAI-like APIs.
 * Uses Rust `ai_proxy_request` command to bypass webview CSP in production builds.
 */

import { invoke } from '@tauri-apps/api/core';
import type { ChatMessage, LLMConfig } from './promptBuilder';

export interface StreamingLLM {
  streamChat(messages: ChatMessage[]): Promise<Response>;
}

export type Provider = 'openai' | 'openai-glass' | 'anthropic' | 'gemini' | 'gptunnel' | 'openrouter' | 'ollama' | 'custom';

/** OpenAI-compatible client that proxies through Rust. */
function createOpenAICompatibleClient(config: LLMConfig, endpoint: string): StreamingLLM {
  return {
    async streamChat(messages: ChatMessage[]): Promise<Response> {
      const requestBody = JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: true,
      });

      try {
        // Try Rust proxy first (works in production exe)
        const rawResponse = await invoke<string>('ai_proxy_request', {
          endpoint,
          apiKey: config.apiKey || '',
          body: JSON.stringify({
            model: config.model,
            messages,
            temperature: config.temperature,
            max_tokens: config.maxTokens,
          }),
        });
        // Wrap in a fake Response for compatibility with streamProcessor
        return new Response(rawResponse, { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch {
        // Fallback: direct fetch (works in dev mode)
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: requestBody,
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`LLM request failed ${response.status}: ${text}`);
        }
        if (!response.body) {
          throw new Error('LLM response has no body');
        }
        return response;
      }
    },
  };
}

export function createStreamingLLM(provider: Provider, config: LLMConfig & { endpoint?: string }): StreamingLLM {
  switch (provider) {
    case 'openai':
    case 'openai-glass':
      return createOpenAICompatibleClient(config, 'https://api.openai.com/v1/chat/completions');
    case 'gptunnel':
      return createOpenAICompatibleClient(config, 'https://gptunnel.ru/v1/chat/completions');
    case 'openrouter':
      return createOpenAICompatibleClient(config, 'https://openrouter.ai/api/v1/chat/completions');
    case 'ollama':
      return createOpenAICompatibleClient(config, 'http://localhost:11434/v1/chat/completions');
    case 'custom':
      if (!config.endpoint) throw new Error('Custom provider requires endpoint URL');
      return createOpenAICompatibleClient(config, config.endpoint);
    case 'anthropic':
    case 'gemini':
      throw new Error(`Provider "${provider}" — use "openrouter" or "custom" with compatible endpoint.`);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
