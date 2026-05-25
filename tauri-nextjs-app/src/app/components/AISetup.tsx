'use client';
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AI_DEFAULTS, saveAIConfig } from '../features/aiConfig';

interface WhisperModelInfo { id: string; name: string; size: string; installed: boolean; }
interface AISetupProps { onComplete?: () => void; isOnboarding?: boolean; }

const MODELS: WhisperModelInfo[] = [
  { id: 'whisper-tiny',   name: 'Tiny',                size: '39 МБ',  installed: false },
  { id: 'whisper-base',   name: 'Base',                size: '74 МБ',  installed: false },
  { id: 'whisper-small',  name: 'Small (рекомендуется)', size: '244 МБ', installed: false },
  { id: 'whisper-medium', name: 'Medium',              size: '769 МБ', installed: false },
];

export default function AISetup({ onComplete, isOnboarding = false }: AISetupProps) {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [provider, setProvider] = useState('openrouter');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [aiModel, setAiModel] = useState('openai/gpt-4o-mini');
  const [visionModel, setVisionModel] = useState('openai/gpt-4o-mini');
  const [selectedModel, setSelectedModel] = useState('whisper-small');
  const [models, setModels] = useState<WhisperModelInfo[]>(MODELS);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Show user's saved values, otherwise the AI_DEFAULTS so the form is functional out of the box.
    const s = localStorage.getItem('ai_api_key') ?? AI_DEFAULTS.apiKey;
    const p = localStorage.getItem('ai_provider') || AI_DEFAULTS.provider;
    const e = localStorage.getItem('ai_endpoint') ?? AI_DEFAULTS.customEndpoint;
    const m = localStorage.getItem('ai_model') || AI_DEFAULTS.aiModel;
    const vm = localStorage.getItem('ai_vision_model') || AI_DEFAULTS.visionModel;
    setApiKey(s);
    setProvider(p);
    setCustomEndpoint(e);
    setAiModel(m);
    setVisionModel(vm);
    loadModels();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadModels = async () => {
    try {
      const result = await invoke<string[]>('whisper_get_installed_models');
      const installed = Array.isArray(result) ? result : [];
      const updated = MODELS.map(m => ({ ...m, installed: installed.includes(m.id) }));
      setModels(updated);

      const savedModel = localStorage.getItem('whisper_model');
      let active = '';
      if (savedModel && updated.find(m => m.id === savedModel && m.installed)) {
        setSelectedModel(savedModel);
        active = savedModel;
      } else {
        const first = updated.find(m => m.installed);
        if (first) {
          setSelectedModel(first.id);
          localStorage.setItem('whisper_model', first.id);
          active = first.id;
        }
      }
      if (active) {
        // Initialize in background — don't await, just fire and forget
        invoke('whisper_initialize', { model: active }).catch(() => {});
      }
    } catch {
      setModels(MODELS);
    }
  };

  const handleSelectModel = (id: string, isInstalled: boolean) => {
    setSelectedModel(id);
    if (isInstalled) {
      localStorage.setItem('whisper_model', id);
      invoke('whisper_initialize', { model: id }).catch(() => {});
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError('');
    setDownloadProgress('Скачивание...');
    try {
      await invoke('whisper_download_model', { model: selectedModel });
      setDownloadProgress('');
      await loadModels();
      localStorage.setItem('whisper_model', selectedModel);
      invoke('whisper_initialize', { model: selectedModel }).catch(() => {});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(String(e));
      setDownloadProgress('');
    } finally {
      setDownloading(false);
    }
  };

  const handleSave = () => {
    // Persist via central config so all components (Chat, LiveAssistant) pick up the change.
    saveAIConfig({
      apiKey,
      provider: provider as Parameters<typeof saveAIConfig>[0]['provider'],
      customEndpoint,
      aiModel,
      visionModel,
    });
    localStorage.setItem('whisper_model', selectedModel);
    invoke('whisper_initialize', { model: selectedModel }).catch(() => {});
    invoke('save_settings', {
      settings: {
        language: 'ru', auto_save: true, notifications: true,
        ai_model: aiModel, api_key: apiKey, max_tokens: 4096,
        temperature: 0.3, system_prompt: '', is_authenticated: false, user_display_name: '',
      },
    }).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleComplete = () => {
    handleSave();
    localStorage.setItem('ai_setup_complete', 'true');
    onComplete?.();
  };

  const isInstalled = models.find(m => m.id === selectedModel)?.installed;
  const selSize = models.find(m => m.id === selectedModel)?.size || '';

  const containerStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', background: '#0A0A0A',
    height: isOnboarding ? '100vh' : 'calc(100vh - 48px)', overflow: 'hidden',
  };
  const cardStyle: React.CSSProperties = {
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 20,
    marginBottom: 16, background: 'rgba(255,255,255,0.02)',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
    color: '#fff', fontSize: 14, outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4, display: 'block',
  };

  return (
    <div style={containerStyle}>
      {isOnboarding && (
        <div style={{ flexShrink: 0, textAlign: 'center', padding: '2rem 1.5rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: 56, height: 56, background: '#fff', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="6" fill="#000" />
              <circle cx="12" cy="12" r="5" fill="#fff" />
            </svg>
          </div>
          <h1 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, marginBottom: 6 }}>Настройка ИИ</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Настройте API ключ и модель распознавания речи</p>
        </div>
      )}
      {!isOnboarding && (
        <div style={{ flexShrink: 0, padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Настройки ИИ и распознавания речи</h2>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
        <div style={{ maxWidth: isOnboarding ? '32rem' : '56rem', margin: '0 auto', width: '100%' }}>

          {/* AI API */}
          <div style={cardStyle}>
            <h3 style={{ color: '#fff', fontWeight: 500, marginBottom: 4 }}>API нейросети</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 16 }}>GPTunnel, OpenAI или свой endpoint</p>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Провайдер</label>
              <select
                value={provider}
                onChange={e => {
                  const v = e.target.value;
                  setProvider(v);
                  if (v === 'openrouter') { setAiModel('openai/gpt-4o-mini'); setVisionModel('openai/gpt-4o-mini'); }
                  else if (v === 'ollama') { setAiModel('llama3.1'); setVisionModel('llava'); }
                  else if (v === 'gptunnel' || v === 'openai') { setAiModel('gpt-4o-mini'); setVisionModel('gpt-4o-mini'); }
                }}
                style={{ ...inputStyle }}
              >
                <option value="openrouter" style={{ background: '#1a1a1a' }}>OpenRouter (бесплатные модели, работает в РФ)</option>
                <option value="ollama" style={{ background: '#1a1a1a' }}>Ollama (локально, бесплатно)</option>
                <option value="gptunnel" style={{ background: '#1a1a1a' }}>GPTunnel (платный, работает в РФ)</option>
                <option value="openai" style={{ background: '#1a1a1a' }}>OpenAI (платный)</option>
                <option value="custom" style={{ background: '#1a1a1a' }}>Свой endpoint</option>
              </select>
            </div>

            {provider === 'custom' && (
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Endpoint URL</label>
                <input
                  value={customEndpoint}
                  onChange={e => setCustomEndpoint(e.target.value)}
                  placeholder="https://your-api.com/v1/chat/completions"
                  style={{ ...inputStyle, fontSize: 13 }}
                />
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Модель (чат)</label>
              <select
                value={aiModel}
                onChange={e => { setAiModel(e.target.value); localStorage.setItem('ai_model', e.target.value); }}
                style={{ ...inputStyle }}
              >
                {provider === 'openrouter' && <>
                  <option value="openai/gpt-4o-mini" style={{ background: '#1a1a1a' }}>GPT-4o Mini (платный, быстрый, без лимитов)</option>
                  <option value="openai/gpt-4o" style={{ background: '#1a1a1a' }}>GPT-4o (платный, мощный)</option>
                  <option value="openrouter/free" style={{ background: '#1a1a1a' }}>Авто бесплатная (openrouter/free)</option>
                  <option value="deepseek/deepseek-v4-flash:free" style={{ background: '#1a1a1a' }}>DeepSeek V4 Flash (бесплатная)</option>
                  <option value="meta-llama/llama-3.3-70b-instruct:free" style={{ background: '#1a1a1a' }}>Llama 3.3 70B (бесплатная)</option>
                  <option value="qwen/qwen3-coder:free" style={{ background: '#1a1a1a' }}>Qwen3 Coder (бесплатная, код)</option>
                  <option value="google/gemini-2.5-flash" style={{ background: '#1a1a1a' }}>Gemini 2.5 Flash (платный)</option>
                  <option value="anthropic/claude-sonnet-4" style={{ background: '#1a1a1a' }}>Claude Sonnet 4 (платный)</option>
                </>}
                {provider === 'openai' && <>
                  <option value="gpt-4o-mini" style={{ background: '#1a1a1a' }}>GPT-4o Mini</option>
                  <option value="gpt-4o" style={{ background: '#1a1a1a' }}>GPT-4o</option>
                  <option value="gpt-4.1" style={{ background: '#1a1a1a' }}>GPT-4.1</option>
                </>}
                {provider === 'gptunnel' && <>
                  <option value="gpt-4o-mini" style={{ background: '#1a1a1a' }}>GPT-4o Mini</option>
                  <option value="gpt-4o" style={{ background: '#1a1a1a' }}>GPT-4o</option>
                </>}
                {provider === 'ollama' && <>
                  <option value="llama3.1" style={{ background: '#1a1a1a' }}>Llama 3.1</option>
                  <option value="mistral" style={{ background: '#1a1a1a' }}>Mistral</option>
                  <option value="qwen2.5" style={{ background: '#1a1a1a' }}>Qwen 2.5</option>
                </>}
                {provider === 'custom' && <option value={aiModel} style={{ background: '#1a1a1a' }}>{aiModel}</option>}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Модель для анализа экрана (vision)</label>
              <select
                value={visionModel}
                onChange={e => { setVisionModel(e.target.value); localStorage.setItem('ai_vision_model', e.target.value); }}
                style={{ ...inputStyle }}
              >
                {provider === 'openrouter' && <>
                  <option value="openai/gpt-4o-mini" style={{ background: '#1a1a1a' }}>GPT-4o Mini (платный, без лимитов)</option>
                  <option value="openai/gpt-4o" style={{ background: '#1a1a1a' }}>GPT-4o (платный, лучшее качество)</option>
                  <option value="openrouter/free" style={{ background: '#1a1a1a' }}>Авто бесплатная (openrouter/free)</option>
                  <option value="google/gemma-4-31b-it:free" style={{ background: '#1a1a1a' }}>Gemma 4 31B (бесплатная)</option>
                  <option value="google/gemma-4-26b-a4b-it:free" style={{ background: '#1a1a1a' }}>Gemma 4 26B (бесплатная)</option>
                  <option value="nvidia/nemotron-nano-12b-v2-vl:free" style={{ background: '#1a1a1a' }}>Nemotron VL (бесплатная)</option>
                  <option value="google/gemini-2.5-flash" style={{ background: '#1a1a1a' }}>Gemini 2.5 Flash (платный)</option>
                </>}
                {provider === 'openai' && <>
                  <option value="gpt-4o-mini" style={{ background: '#1a1a1a' }}>GPT-4o Mini</option>
                  <option value="gpt-4o" style={{ background: '#1a1a1a' }}>GPT-4o</option>
                </>}
                {provider === 'gptunnel' && <>
                  <option value="gpt-4o-mini" style={{ background: '#1a1a1a' }}>GPT-4o Mini</option>
                  <option value="gpt-4o" style={{ background: '#1a1a1a' }}>GPT-4o</option>
                </>}
                {provider === 'ollama' && <>
                  <option value="llava" style={{ background: '#1a1a1a' }}>LLaVA</option>
                </>}
                {provider === 'custom' && <option value={visionModel} style={{ background: '#1a1a1a' }}>{visionModel}</option>}
              </select>
            </div>
            </div>

            <div style={{ position: 'relative', marginBottom: 12 }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="API ключ..."
                style={{ ...inputStyle, padding: '10px 80px 10px 12px' }}
              />
              <div style={{ position: 'absolute', right: 8, top: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => setShowApiKey(!showApiKey)} style={{ padding: 4, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {showApiKey ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
                <button onClick={handleSave} style={{ padding: '4px 10px', background: 'rgba(28,205,170,0.2)', color: '#1CCDAA', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                  {saved ? '✓' : 'Сохранить'}
                </button>
              </div>
            </div>

            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
              OpenRouter:{' '}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ color: '#1CCDAA', textDecoration: 'underline' }}>получить бесплатный ключ</a>
              {' | '}Ollama:{' '}
              <a href="https://ollama.com" target="_blank" rel="noreferrer" style={{ color: '#1CCDAA', textDecoration: 'underline' }}>скачать</a>
              {' '}(ключ: ollama)
            </p>
          </div>

          {/* Whisper */}
          <div style={cardStyle}>
            <h3 style={{ color: '#fff', fontWeight: 500, marginBottom: 4 }}>Модель Whisper (распознавание речи)</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 16 }}>Локально, бесплатно, без интернета. Русский язык.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {models.map(m => (
                <label
                  key={m.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: 12, borderRadius: 8, cursor: 'pointer',
                    border: selectedModel === m.id ? '1px solid rgba(28,205,170,0.5)' : '1px solid rgba(255,255,255,0.08)',
                    background: selectedModel === m.id ? 'rgba(28,205,170,0.05)' : 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="radio"
                      name="wm"
                      value={m.id}
                      checked={selectedModel === m.id}
                      onChange={() => handleSelectModel(m.id, m.installed)}
                    />
                    <span style={{ color: '#fff', fontSize: 14 }}>{m.name}</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{m.size}</span>
                  </div>
                  {m.installed && (
                    <span style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(34,197,94,0.2)', color: '#4ade80', fontSize: 11 }}>
                      Установлена
                    </span>
                  )}
                </label>
              ))}
            </div>

            {!isInstalled && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                style={{ width: '100%', padding: '10px', background: '#1CCDAA', color: '#000', border: 'none', borderRadius: 8, fontWeight: 500, fontSize: 14, cursor: 'pointer', opacity: downloading ? 0.5 : 1 }}
              >
                {downloading ? downloadProgress : `Скачать (${selSize})`}
              </button>
            )}
            {isInstalled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#4ade80', fontSize: 14 }}>
                ✓ Модель готова к работе
              </div>
            )}
            {error && <p style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{error}</p>}
          </div>

          {isOnboarding && (
            <button
              onClick={handleComplete}
              style={{ width: '100%', padding: 12, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, background: 'transparent', color: '#fff', fontWeight: 500, fontSize: 14, cursor: 'pointer', marginTop: 16 }}
            >
              {apiKey ? 'Продолжить' : 'Пропустить'}
            </button>
          )}
        </div>
      </div>
  );
}
