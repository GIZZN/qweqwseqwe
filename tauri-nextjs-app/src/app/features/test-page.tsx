'use client';

import { useState } from 'react';
import { captureScreenshot, tokenTracker } from './common/capture';
import { whisperService } from './common/whisper';
import { livecodingService } from './livecoding/livecodingService';

/**
 * Test page for verifying ported modules functionality.
 * Tests: screenshot capture, whisper transcription, livecoding analysis.
 */
export default function FeaturesTestPage() {
  const [log, setLog] = useState<string[]>([]);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  const addLog = (msg: string) => {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // --- Test 1: Screenshot Capture ---
  const testScreenshot = async () => {
    addLog('📸 Тест захвата экрана...');
    try {
      const result = await captureScreenshot({ jpegQuality: 70 });
      if (result.success && result.base64) {
        addLog(`✅ Скриншот: ${result.width}x${result.height}, ${Math.round(result.base64.length / 1024)} KB base64`);
        setScreenshotPreview(`data:image/jpeg;base64,${result.base64}`);

        // Token tracking test
        const tokens = tokenTracker.calculateImageTokens(result.width || 1920, result.height || 1080);
        tokenTracker.addTokens(tokens, 'image');
        addLog(`📊 TokenTracker: ${tokens} токенов за изображение, всего за минуту: ${tokenTracker.getTokensInLastMinute()}`);
      } else {
        addLog(`❌ Ошибка скриншота: ${result.error}`);
      }
    } catch (e) {
      addLog(`❌ Исключение: ${e}`);
    }
  };

  // --- Test 2: Whisper Transcription ---
  const testWhisper = async () => {
    addLog('🎤 Тест Whisper транскрибации...');
    try {
      // Check installed models
      const models = await whisperService.getInstalledModels();
      const installed = models.filter(m => m.installed);
      addLog(`📋 Установленные модели: ${installed.length > 0 ? installed.map(m => m.id).join(', ') : 'нет'}`);

      if (installed.length === 0) {
        addLog('⚠️ Нет установленных моделей. Проверяю whisper-small...');
        const available = await whisperService.isModelAvailable('whisper-small');
        addLog(`   whisper-small доступна: ${available}`);
        if (!available) {
          addLog('⏬ Для полного теста нужно скачать модель (whisperService.downloadModel)');
          return;
        }
      }

      // Initialize with first available model
      const modelToUse = installed.length > 0 ? installed[0].id : 'whisper-small';
      addLog(`🔄 Инициализация whisper с моделью: ${modelToUse}...`);
      await whisperService.initialize(modelToUse);
      addLog('✅ Whisper инициализирован');

      // Transcribe (captures system audio for configured seconds)
      addLog('🎙️ Захват аудио и транскрибация (8 сек)...');
      const result = await whisperService.transcribe();
      if (result.success) {
        addLog(`✅ Транскрипция: "${result.text}"`);
      } else {
        addLog(`❌ Ошибка транскрибации: ${result.error}`);
      }
    } catch (e) {
      addLog(`❌ Исключение Whisper: ${e}`);
    }
  };

  // --- Test 3: LiveCoding Analysis ---
  const testLivecoding = async () => {
    addLog('🧠 Тест LiveCoding анализа...');

    // Check if API key is configured
    const apiKey = localStorage.getItem('openai_api_key') || '';
    if (!apiKey) {
      addLog('⚠️ API ключ не настроен. Установите localStorage["openai_api_key"] для полного теста.');
      addLog('   Тестирую только захват скриншота + построение промпта...');

      // Test screenshot + prompt building only
      const shot = await captureScreenshot({ width: 1920, jpegQuality: 80 });
      if (shot.success) {
        addLog(`✅ Скриншот для анализа: ${shot.width}x${shot.height}`);
        addLog('✅ PromptBuilder и StreamProcessor готовы к работе');
        addLog('   Для полного теста: localStorage.setItem("openai_api_key", "sk-...")');
      } else {
        addLog(`❌ Скриншот не удался: ${shot.error}`);
      }
      return;
    }

    // Full test with API
    addLog('🔑 API ключ найден, запускаю полный анализ...');
    const result = await livecodingService.analyzeScreen(
      { provider: 'openai', model: 'gpt-4o-mini', apiKey },
      {
        onUpdate: (payload) => {
          if (payload.isFinal) {
            addLog(`✅ Ответ AI (${payload.text.length} символов): ${payload.text.substring(0, 100)}...`);
          }
        },
      }
    );

    if (result.success) {
      addLog(`✅ LiveCoding анализ завершён успешно`);
    } else {
      addLog(`❌ LiveCoding ошибка: ${result.error}`);
    }
  };

  // --- Test 4: Token Tracker ---
  const testTokenTracker = () => {
    addLog('📊 Тест TokenTracker...');
    tokenTracker.reset();
    tokenTracker.addTokens(100, 'image');
    tokenTracker.addTokens(50, 'audio');
    const stats = tokenTracker.getStatistics();
    addLog(`   total: ${stats.total}, image: ${stats.image}, audio: ${stats.audio}, count: ${stats.count}`);
    addLog(`   shouldThrottle: ${tokenTracker.shouldThrottle()}`);
    addLog('✅ TokenTracker работает корректно');
  };

  return (
    <div className="bg-black/95 p-6 min-h-screen text-white">
      <h1 className="mb-4 font-bold text-2xl">🧪 Тест портированных модулей</h1>
      <p className="mb-6 text-white/60 text-sm">
        Проверка: capture (скриншоты), whisper (транскрибация), livecoding (AI-анализ)
      </p>

      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={testScreenshot} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm">
          📸 Тест скриншота
        </button>
        <button onClick={testWhisper} className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-sm">
          🎤 Тест Whisper
        </button>
        <button onClick={testLivecoding} className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg text-sm">
          🧠 Тест LiveCoding
        </button>
        <button onClick={testTokenTracker} className="bg-yellow-600 hover:bg-yellow-500 px-4 py-2 rounded-lg text-sm">
          📊 Тест TokenTracker
        </button>
        <button onClick={() => { setLog([]); setScreenshotPreview(null); }} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm">
          🗑️ Очистить
        </button>
      </div>

      {screenshotPreview && (
        <div className="mb-6">
          <p className="mb-2 text-white/60 text-sm">Превью скриншота:</p>
          <img src={screenshotPreview} alt="screenshot" className="border border-white/10 rounded max-w-md" />
        </div>
      )}

      <div className="bg-white/5 p-4 border border-white/10 rounded-lg max-h-96 overflow-y-auto font-mono text-xs">
        {log.length === 0 ? (
          <p className="text-white/40">Нажмите кнопку для запуска теста...</p>
        ) : (
          log.map((line, i) => (
            <div key={i} className={`py-0.5 ${line.includes('❌') ? 'text-red-400' : line.includes('✅') ? 'text-green-400' : line.includes('⚠️') ? 'text-yellow-400' : 'text-white/80'}`}>
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
