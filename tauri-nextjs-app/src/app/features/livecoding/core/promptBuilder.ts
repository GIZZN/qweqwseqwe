/**
 * Prompt Builder Module (Tauri port)
 * Builds prompts for different LiveCoding analysis types.
 */

export type AnalysisType = 'ALGORITHM' | 'CODE_ANALYSIS' | 'CODE_ITERATION' | 'THEORY';

export interface AnalysisConfig {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
}

export interface ChatMessagePart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatMessagePart[];
}

export interface LLMConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface ModelInfo {
  provider: string;
  model: string;
  apiKey: string;
}

/**
 * Russian-language system prompts extracted from original prompt templates.
 * Kept inline so module does not depend on server-side template files.
 */
const SYSTEM_PROMPTS: Record<string, string> = {
  live_coding:
    'ВАЖНО: ВСЕ ОТВЕТЫ НА РУССКОМ ЯЗЫКЕ.\n' +
    'Ты — опытный наставник по алгоритмам и собеседованиям. ' +
    'Помоги кандидату быстро понять задачу, предложить оптимальное решение и объяснить его интервьюеру.',
  code_analysis:
    'ВАЖНО: ВСЕ ОТВЕТЫ НА РУССКОМ ЯЗЫКЕ.\n' +
    'Ты — старший разработчик. Анализируй код: объясняй, предсказывай вывод, находи ошибки, предлагай рефакторинг.',
  code_iteration:
    'ВАЖНО: ВСЕ ОТВЕТЫ НА РУССКОМ ЯЗЫКЕ.\n' +
    'Ты — опытный ревьюер. Предлагай улучшения кода: оптимизация, архитектура, безопасность, читаемость.',
  theory_interview:
    'ВАЖНО: ВСЕ ОТВЕТЫ НА РУССКОМ ЯЗЫКЕ.\n' +
    'Ты — эксперт. Отвечай на теоретические вопросы как на собеседовании: структурно, глубоко, с примерами.',
};

export const ANALYSIS_TYPES: Record<AnalysisType, AnalysisConfig> = {
  ALGORITHM: {
    systemPrompt: SYSTEM_PROMPTS.live_coding,
    userPrompt:
      'Проанализируй алгоритмическую задачу на скриншоте. Дай ответ в формате: ' +
      '1) ИДЕЯ 2) БРУТФОРС 3) ОПТИМАЛЬНОЕ РЕШЕНИЕ 4) КОД (первая версия с ошибкой → исправление → граничные случаи) ' +
      '5) КАК ОБЪЯСНИТЬ ИНТЕРВЬЮЕРУ 6) ТЕСТЫ. Будь краток.',
    temperature: 0.3,
    maxTokens: 4096,
  },
  CODE_ANALYSIS: {
    systemPrompt: SYSTEM_PROMPTS.code_analysis,
    userPrompt:
      'Проанализируй код на скриншоте. Определи что нужно: объяснить, предсказать вывод, найти ошибки или рефакторить.',
    temperature: 0.3,
    maxTokens: 4096,
  },
  CODE_ITERATION: {
    systemPrompt: SYSTEM_PROMPTS.code_iteration,
    userPrompt:
      'Посмотри на код и предложи улучшения: оптимизация, функциональность, исправление багов или смена подхода.',
    temperature: 0.3,
    maxTokens: 4096,
  },
  THEORY: {
    systemPrompt: SYSTEM_PROMPTS.theory_interview,
    userPrompt:
      'Ответь на теоретический вопрос как на собеседовании. Дай структурированный, глубокий и практичный ответ.',
    temperature: 0.3,
    maxTokens: 4096,
  },
};

export class PromptBuilder {
  buildMessages(
    analysisType: AnalysisType,
    screenshotBase64: string,
    options: { customPrompt?: string | null } = {},
  ): ChatMessage[] {
    const config = ANALYSIS_TYPES[analysisType];
    if (!config) throw new Error(`Unknown analysis type: ${analysisType}`);

    return [
      { role: 'system', content: config.systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: options.customPrompt || config.userPrompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${screenshotBase64}` } },
        ],
      },
    ];
  }

  getLLMConfig(analysisType: AnalysisType, modelInfo: ModelInfo): LLMConfig {
    const config = ANALYSIS_TYPES[analysisType];
    if (!config) throw new Error(`Unknown analysis type: ${analysisType}`);

    return {
      apiKey: modelInfo.apiKey,
      model: modelInfo.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    };
  }

  getAnalysisTypes(): Record<AnalysisType, AnalysisConfig> {
    return { ...ANALYSIS_TYPES };
  }
}
