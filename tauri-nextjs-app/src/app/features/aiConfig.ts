/**
 * Single source of truth for AI provider configuration.
 * All components (Chat, LiveAssistant, AISetup, syncSessionEvent) read from here
 * so user-set values from AISetup propagate everywhere consistently.
 *
 * Persistence: localStorage (survives app restarts via WebView profile).
 * Keys: ai_api_key, ai_provider, ai_endpoint, ai_model, ai_vision_model.
 */

export type AIProvider = 'openrouter' | 'openai' | 'gptunnel' | 'ollama' | 'custom';

export interface AIConfig {
  apiKey: string;
  provider: AIProvider;
  customEndpoint: string;
  endpoint: string;
  aiModel: string;
  visionModel: string;
}

/** Default values used when the user hasn't opened AISetup yet. */
export const AI_DEFAULTS = {
  apiKey: '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',
  provider: 'openrouter' as AIProvider,
  customEndpoint: '',
  aiModel: 'openai/gpt-4o-mini',
  visionModel: 'openai/gpt-4o-mini',
};

const PROVIDER_ENDPOINTS: Record<Exclude<AIProvider, 'custom'>, string> = {
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  gptunnel: 'https://gptunnel.ru/v1/chat/completions',
  ollama: 'http://localhost:11434/v1/chat/completions',
};

function getEndpoint(provider: AIProvider, customEndpoint: string): string {
  if (provider === 'custom') return customEndpoint || PROVIDER_ENDPOINTS.openrouter;
  return PROVIDER_ENDPOINTS[provider];
}

/**
 * Read the active AI configuration. SSR-safe (returns defaults on the server).
 * Always returns a usable config — uses AI_DEFAULTS as fallback for missing keys.
 */
export function getAIConfig(): AIConfig {
  if (typeof window === 'undefined') {
    return {
      apiKey: AI_DEFAULTS.apiKey,
      provider: AI_DEFAULTS.provider,
      customEndpoint: AI_DEFAULTS.customEndpoint,
      endpoint: getEndpoint(AI_DEFAULTS.provider, AI_DEFAULTS.customEndpoint),
      aiModel: AI_DEFAULTS.aiModel,
      visionModel: AI_DEFAULTS.visionModel,
    };
  }

  const apiKey = localStorage.getItem('ai_api_key') || AI_DEFAULTS.apiKey;
  const provider = (localStorage.getItem('ai_provider') as AIProvider) || AI_DEFAULTS.provider;
  const customEndpoint = localStorage.getItem('ai_endpoint') || AI_DEFAULTS.customEndpoint;
  const aiModel = localStorage.getItem('ai_model') || AI_DEFAULTS.aiModel;
  const visionModel = localStorage.getItem('ai_vision_model') || AI_DEFAULTS.visionModel;

  return {
    apiKey,
    provider,
    customEndpoint,
    endpoint: getEndpoint(provider, customEndpoint),
    aiModel,
    visionModel,
  };
}

export function saveAIConfig(partial: Partial<Pick<AIConfig, 'apiKey' | 'provider' | 'customEndpoint' | 'aiModel' | 'visionModel'>>): void {
  if (typeof window === 'undefined') return;
  if (partial.apiKey !== undefined) localStorage.setItem('ai_api_key', partial.apiKey);
  if (partial.provider !== undefined) localStorage.setItem('ai_provider', partial.provider);
  if (partial.customEndpoint !== undefined) localStorage.setItem('ai_endpoint', partial.customEndpoint);
  if (partial.aiModel !== undefined) localStorage.setItem('ai_model', partial.aiModel);
  if (partial.visionModel !== undefined) localStorage.setItem('ai_vision_model', partial.visionModel);
}

/** Returns true if the user has explicitly set their own API key (vs using default). */
export function hasUserApiKey(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem('ai_api_key');
  return Boolean(stored && stored.trim());
}
