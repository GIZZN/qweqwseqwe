'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import clsx from 'clsx';

interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: number;
  type: 'question' | 'answer' | 'code';
}
type Status = 'idle' | 'recording' | 'transcribing' | 'generating' | 'error';

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className={clsx('mt-2', 'border', 'border-white/[0.08]', 'rounded-lg', 'overflow-hidden')} style={{ background: '#1e1e2e' }}>
      <div className={clsx('flex', 'justify-between', 'items-center', 'px-3', 'py-1.5', 'border-white/[0.06]', 'border-b')} style={{ background: 'rgba(255,255,255,0.03)' }}>
        <span className={clsx('text-[11px]', 'text-white/50')}>{lang}</span>
        <button onClick={copy} className={clsx('bg-transparent', 'border-none', 'text-[#1CCDAA]', 'text-[11px]', 'hover:text-[#1CCDAA]/80', 'cursor-pointer')}>
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
      <pre className={clsx('m-0', 'p-3', 'overflow-x-auto', 'font-mono', 'text-[#e0e0e0]', 'text-[13px]', 'leading-relaxed')}><code>{code}</code></pre>
    </div>
  );
}

function RenderContent({ text }: { text: string }) {
  const parts: { type: 'text' | 'code'; content: string; lang?: string }[] = [];
  const re = /```(\w*)\n([\s\S]*?)```/g;
  let last = 0; let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', content: text.slice(last, m.index) });
    parts.push({ type: 'code', content: m[2].trim(), lang: m[1] || 'code' });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', content: text.slice(last) });
  if (parts.length === 0) return <span className="whitespace-pre-wrap">{text}</span>;
  return <>{parts.map((p, i) => p.type === 'code' ? <CodeBlock key={i} code={p.content} lang={p.lang || 'code'} /> : <span key={i} className="whitespace-pre-wrap">{p.content}</span>)}</>;
}

export default function LiveAssistant() {
  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const pushToTalkRef = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const [sttMode, setSttMode] = useState<'whisper' | 'openrouter'>(() => {
    if (typeof window === 'undefined') return 'whisper';
    return (localStorage.getItem('stt_mode') as 'whisper' | 'openrouter') || 'whisper';
  });
  const sttModeRef = useRef(sttMode);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const isGeneratingRef = useRef(false);
  const [status, setStatus] = useState<Status>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [autoMode, setAutoMode] = useState(true);
  const [intervalSec, setIntervalSec] = useState(15);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem('live_assistant_session');
      if (s) { const p = JSON.parse(s); if (Array.isArray(p)) { setTranscript(p); transcriptRef.current = p; } }
    } catch {}
  }, []);
  useEffect(() => {
    transcriptRef.current = transcript;
    if (transcript.length > 0) localStorage.setItem('live_assistant_session', JSON.stringify(transcript.slice(-50)));
  }, [transcript]);
  useEffect(() => { sttModeRef.current = sttMode; }, [sttMode]);
  useEffect(() => { isGeneratingRef.current = isGenerating; }, [isGenerating]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript, currentAnswer]);
  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  const getAIConfig = () => {
    const apiKey = localStorage.getItem('ai_api_key') || '';
    const provider = localStorage.getItem('ai_provider') || 'openrouter';
    const aiModel = localStorage.getItem('ai_model') || 'openai/gpt-4o-mini';
    const customEndpoint = localStorage.getItem('ai_endpoint') || '';
    let endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    if (provider === 'openai') endpoint = 'https://api.openai.com/v1/chat/completions';
    else if (provider === 'gptunnel') endpoint = 'https://gptunnel.ru/v1/chat/completions';
    else if (provider === 'ollama') endpoint = 'http://localhost:11434/v1/chat/completions';
    else if (provider === 'custom' && customEndpoint) endpoint = customEndpoint;
    return { apiKey, aiModel, endpoint };
  };

  const streamAI = async (messages: { role: string; content: unknown }[], onToken: (t: string) => void, modelOverride?: string): Promise<string> => {
    const { apiKey, aiModel, endpoint } = getAIConfig();
    if (!apiKey) throw new Error('API ключ не настроен. Перейдите в Настройки ИИ.');
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const useModel = modelOverride || aiModel;
    // Smaller max_tokens => answer ends ~2x faster for typical PTT replies.
    const requestBody = JSON.stringify({ model: useModel, messages, temperature: 0.3, max_tokens: 512, stream: true });

    // Try true streaming via Tauri Channel first — first token in ~300ms instead of waiting for full body.
    try {
      const { Channel } = await import('@tauri-apps/api/core');
      const channel = new Channel<string>();
      let buffer = '';
      let full = '';
      channel.onmessage = (chunk: string) => {
        buffer += chunk;
        // Drain complete SSE lines from the buffer.
        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6).trim();
          if (d === '[DONE]') return;
          try { const j = JSON.parse(d); const t = j.choices?.[0]?.delta?.content || ''; if (t) { full += t; onToken(full); } } catch {}
        }
      };
      await invoke('ai_proxy_stream', { endpoint, apiKey, body: requestBody, onChunk: channel });
      if (full) return full;
      // No tokens parsed — fall through to non-streaming path.
    } catch (e) {
      const errStr = String(e);
      // Real HTTP error from server — surface immediately, don't retry.
      if (errStr.match(/\b[45]\d\d\b/)) throw e;
      // Otherwise (channel API missing, network hiccup, etc.) try fallbacks below.
    }

    try {
      const rawResponse = await invoke<string>('ai_proxy_request', { endpoint, apiKey, body: requestBody });
      // Parse SSE tokens for progressive display
      let full = '';
      const lines = rawResponse.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const d = line.slice(6).trim();
        if (d === '[DONE]') break;
        try { const j = JSON.parse(d); const t = j.choices?.[0]?.delta?.content || ''; if (t) { full += t; onToken(full); } } catch {}
      }
      // Fallback: if no SSE tokens, parse as regular JSON
      if (!full) {
        try { const j = JSON.parse(rawResponse); full = j.choices?.[0]?.message?.content || ''; onToken(full); } catch {}
      }
      return full;
    } catch (err) {
      const errStr = String(err);
      if (!errStr.match(/\b[45]\d\d\b/)) {
        // Fallback: direct fetch for dev
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: useModel, messages, temperature: 0.3, max_tokens: 512, stream: true }),
          signal: abortRef.current!.signal,
        });
        if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`${res.status}: ${t.slice(0, 150)}`); }
        const reader = res.body!.getReader();
        const dec = new TextDecoder(); let full = '';
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          for (const line of dec.decode(value).split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const d = line.slice(6); if (d === '[DONE]') break;
            try { const j = JSON.parse(d); const t = j.choices?.[0]?.delta?.content || ''; if (t) { full += t; onToken(full); } } catch {}
          }
        }
        return full;
      }
      throw err;
    }
  };

  const generateAnswer = useCallback(async (question: string) => {
    const { apiKey } = getAIConfig();
    if (!apiKey) {
      setStatus('error'); setStatusMsg('API ключ не настроен → Настройки ИИ');
      return;
    }
    setStatus('generating'); setStatusMsg('');
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setIsGenerating(true); isGeneratingRef.current = true; setCurrentAnswer('');
    const startTime = Date.now();
    const ctx = transcriptRef.current.slice(-4).map(t => `${t.type === 'question' ? 'Собеседник' : 'Я'}: ${t.text.slice(0, 300)}`).join('\n');
    const { aiModel: dm } = getAIConfig();
    const aiModel = sttModeRef.current === 'openrouter' ? 'openai/gpt-4o-mini' : dm;
    const sp = localStorage.getItem('system_prompt') || 'Ты — опытный senior разработчик с 10+ годами опыта на собеседовании. Отвечай на русском, от первого лица, уверенно, с примерами. Не говори что ты ИИ. Если вопрос про код — дай код в блоке ```язык. Длина: 3-8 предложений.';
    const messages = [
      { role: 'system', content: sp },
      ...(ctx ? [{ role: 'user', content: `Контекст:\n${ctx}` }] : []),
      { role: 'user', content: `Вопрос: "${question}"\nОтветь развёрнуто:` },
    ];
    try {
      const full = await streamAI(messages, (t) => setCurrentAnswer(t), aiModel);
      if (full) {
        const entry: TranscriptEntry = { id: `a-${Date.now()}`, text: full, timestamp: Date.now(), type: 'answer' };
        setTranscript(prev => { const next = [...prev, entry]; transcriptRef.current = next; return next; });
        setCurrentAnswer('');
        invoke('add_analytics_response', { question, response: full, sessionId: 'live-assistant', responseTimeMs: Date.now() - startTime, modelUsed: aiModel, tokensUsed: Math.floor(full.length / 4) }).catch(() => {});
        import('../features/sync/sessionSync').then(({ syncSessionEvent }) => syncSessionEvent({ type: 'live_answer', question, answer: full, model: aiModel, responseTimeMs: Date.now() - startTime, sessionId: 'live-assistant' }));
      }
      setStatus('idle'); setStatusMsg('');
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setStatus('error'); setStatusMsg(String(e).slice(0, 80));
    } finally { setIsGenerating(false); isGeneratingRef.current = false; }
  }, []);

  const generateAnswerRef = useRef(generateAnswer);
  useEffect(() => { generateAnswerRef.current = generateAnswer; }, [generateAnswer]);

  const handleTranscribed = useCallback(async (raw: string) => {
    const noiseOnly = /^\s*(\[музыка\]|\*[^*]{1,20}\*|\[.*?\])\s*$/i;
    const cleaned = raw.replace(/\[музыка\]|\*звук.*?\*|\*смех\*|\*аплодисменты\*/gi, '').trim();
    if (cleaned.length < 4 || noiseOnly.test(raw.trim())) { setStatus('idle'); setStatusMsg('Тишина'); setTimeout(() => setStatusMsg(''), 2000); return; }
    const entry: TranscriptEntry = { id: `q-${Date.now()}`, text: cleaned, timestamp: Date.now(), type: 'question' };
    setTranscript(prev => { const next = [...prev, entry]; transcriptRef.current = next; return next; });
    await generateAnswerRef.current(cleaned);
  }, []);

  const handleTranscribedRef = useRef(handleTranscribed);
  useEffect(() => { handleTranscribedRef.current = handleTranscribed; }, [handleTranscribed]);

  const doPttStart = useCallback(async () => {
    if (pushToTalkRef.current) return;
    pushToTalkRef.current = true; setIsPushToTalk(true); setStatus('recording'); setStatusMsg('');
    try { await invoke('recorder_start'); }
    catch (err) { setStatus('error'); setStatusMsg(`Ошибка: ${String(err).slice(0, 50)}`); pushToTalkRef.current = false; setIsPushToTalk(false); }
  }, []);

  const doPttStop = useCallback(async () => {
    if (!pushToTalkRef.current) return;
    pushToTalkRef.current = false; setIsPushToTalk(false); setStatus('transcribing'); setStatusMsg('');
    try { const text = await invoke<string>('recorder_stop_and_transcribe'); await handleTranscribedRef.current(text || ''); }
    catch (err) { setStatus('error'); setStatusMsg(String(err).slice(0, 60)); }
  }, []);

  const doPttStartRef = useRef(doPttStart);
  const doPttStopRef = useRef(doPttStop);
  useEffect(() => { doPttStartRef.current = doPttStart; }, [doPttStart]);
  useEffect(() => { doPttStopRef.current = doPttStop; }, [doPttStop]);

  // captureScreenRef defined after captureScreen below — use a stable ref pattern
  const captureScreenRef = useRef<() => void>(() => {});

  useEffect(() => {
    let unS: (() => void) | null = null, unE: (() => void) | null = null, unSS: (() => void) | null = null;
    const setup = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unS = await listen('ptt_start', () => doPttStartRef.current());
        unE = await listen('ptt_stop', () => doPttStopRef.current());
        unSS = await listen('screenshot_analyze', () => captureScreenRef.current());
      } catch {}
    };
    setup();
    const kd = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.code === 'Space') { e.preventDefault(); doPttStartRef.current(); }
      if (e.ctrlKey && e.altKey && e.code === 'KeyS') { e.preventDefault(); captureScreenRef.current(); }
    };
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space' && pushToTalkRef.current) doPttStopRef.current(); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { unS?.(); unE?.(); unSS?.(); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  const captureLoop = useCallback(async () => {
    try {
      setStatus('transcribing'); setStatusMsg('');
      const text = await invoke<string>('whisper_transcribe');
      await handleTranscribedRef.current(text || '');
    } catch (e) { setStatus('error'); setStatusMsg(String(e).slice(0, 60)); }
  }, []);

  const startListening = useCallback(() => {
    setIsListening(true); setStatus('idle'); setStatusMsg('Авто-режим');
    captureLoop();
    intervalRef.current = setInterval(captureLoop, intervalSec * 1000);
  }, [intervalSec, captureLoop]);

  const stopListening = useCallback(() => {
    setIsListening(false); setStatus('idle'); setStatusMsg('');
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
  }, []);

  // Эвристика: умеет ли модель видеть картинки
  const isVisionModel = (m: string): boolean => {
    const s = (m || '').toLowerCase();
    return /(gpt-4o|gpt-4\.1|gpt-4-vision|gpt-5|o1|o3|o4|gemini|gemma-3|gemma-4|claude-3|claude-sonnet|claude-opus|claude-haiku|vision|llava|pixtral|qwen.*vl|qwen2-vl|qwen2\.5-vl|qwen3-vl|llama-3\.2.*(11|90)b|llama-4|internvl|nemotron-nano-\d+b-v\d+-vl|mimo|glm-4\.\d+v|grok-4|grok-3|nano-banana|openrouter\/free)/i.test(s);
  };

  const streamAIWithModel = async (
    modelOverride: string,
    messages: { role: string; content: unknown }[],
    onToken: (t: string) => void,
  ): Promise<string> => {
    const apiKey = localStorage.getItem('ai_api_key') || '';
    const provider = localStorage.getItem('ai_provider') || 'openrouter';
    const customEndpoint = localStorage.getItem('ai_endpoint') || '';
    let endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    if (provider === 'openai') endpoint = 'https://api.openai.com/v1/chat/completions';
    else if (provider === 'gptunnel') endpoint = 'https://gptunnel.ru/v1/chat/completions';
    else if (provider === 'ollama') endpoint = 'http://localhost:11434/v1/chat/completions';
    else if (provider === 'custom' && customEndpoint) endpoint = customEndpoint;
    if (!apiKey) throw new Error('API ключ не настроен');
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const requestBody = JSON.stringify({ model: modelOverride, messages, temperature: 0.3, max_tokens: 1024, stream: true });

    // Try true streaming via Tauri Channel first.
    try {
      const { Channel } = await import('@tauri-apps/api/core');
      const channel = new Channel<string>();
      let buffer = '';
      let full = '';
      channel.onmessage = (chunk: string) => {
        buffer += chunk;
        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6).trim();
          if (d === '[DONE]') return;
          try { const j = JSON.parse(d); const t = j.choices?.[0]?.delta?.content || ''; if (t) { full += t; onToken(full); } } catch {}
        }
      };
      await invoke('ai_proxy_stream', { endpoint, apiKey, body: requestBody, onChunk: channel });
      if (full) return full;
    } catch (e) {
      const errStr = String(e);
      if (errStr.match(/\b[45]\d\d\b/)) throw e;
    }

    try {
      const rawResponse = await invoke<string>('ai_proxy_request', { endpoint, apiKey, body: requestBody });
      let full = '';
      const lines = rawResponse.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const d = line.slice(6).trim();
        if (d === '[DONE]') break;
        try { const j = JSON.parse(d); const t = j.choices?.[0]?.delta?.content || ''; if (t) { full += t; onToken(full); } } catch {}
      }
      if (!full) {
        try { const j = JSON.parse(rawResponse); full = j.choices?.[0]?.message?.content || ''; onToken(full); } catch {}
      }
      return full;
    } catch (err) {
      const errStr = String(err);
      if (!errStr.match(/\b[45]\d\d\b/)) {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: modelOverride, messages, temperature: 0.3, max_tokens: 1024, stream: true }),
          signal: abortRef.current!.signal,
        });
        if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`${res.status}: ${t.slice(0, 200)}`); }
        const reader = res.body!.getReader();
        const dec = new TextDecoder(); let full = '';
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          for (const line of dec.decode(value).split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const d = line.slice(6); if (d === '[DONE]') break;
            try { const j = JSON.parse(d); const t = j.choices?.[0]?.delta?.content || ''; if (t) { full += t; onToken(full); } } catch {}
          }
        }
        return full;
      }
      throw err;
    }
  };

  const captureScreen = async () => {
    setStatus('generating'); setStatusMsg('Захват экрана...'); setIsGenerating(true); setCurrentAnswer('');
    const t0 = Date.now();
    const { aiModel: chatModel } = getAIConfig();
    const provider = localStorage.getItem('ai_provider') || 'openrouter';
    // Список vision-моделей: пробуем по порядку, если 404 — fallback на следующую
    const savedVision = localStorage.getItem('ai_vision_model') || '';
    const visionCandidates: string[] = [];
    if (savedVision) visionCandidates.push(savedVision);
    if (isVisionModel(chatModel) && !visionCandidates.includes(chatModel)) visionCandidates.push(chatModel);
    if (provider === 'openrouter') {
      // openrouter/free supports vision and auto-routes to available models
      ['openrouter/free', 'google/gemma-4-31b-it:free', 'google/gemma-4-26b-a4b-it:free', 'nvidia/nemotron-nano-12b-v2-vl:free']
        .forEach(m => { if (!visionCandidates.includes(m)) visionCandidates.push(m); });
    } else if (provider === 'openai' || provider === 'gptunnel') {
      if (!visionCandidates.includes('gpt-4o-mini')) visionCandidates.push('gpt-4o-mini');
    } else if (provider === 'ollama') {
      if (!visionCandidates.includes('llava')) visionCandidates.push('llava');
    } else if (!visionCandidates.length) {
      visionCandidates.push(chatModel);
    }
    let visionModel = visionCandidates[0];
    try {
      const r = await invoke<{ base64: string }>('capture_screenshot', { width: null, height: null, jpegQuality: 80 });
      if (!r?.base64) throw new Error('Скриншот не удался');
      const msgs = [
        { role: 'system', content: 'Ты — senior разработчик на собеседовании. Реши задачу на скриншоте. Дай: 1) Идея 2) Код 3) Сложность O(?) 4) Объяснение. Отвечай на русском.' },
        { role: 'user', content: [{ type: 'text', text: 'Реши задачу:' }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${r.base64}` } }] },
      ];
      // Перебираем кандидатов: первая успешная победила
      let full = '';
      let lastErr: unknown = null;
      for (let i = 0; i < visionCandidates.length; i++) {
        visionModel = visionCandidates[i];
        setStatusMsg(`Анализ (${visionModel})...`);
        try {
          full = await streamAIWithModel(visionModel, msgs, (t) => setCurrentAnswer(t));
          if (full) break;
        } catch (e) {
          lastErr = e;
          const msg = String(e);
          // Только 404 / "no endpoints" / 400 валит на следующего кандидата; прочие ошибки прокидываем
          const isModelMissing = /\b(404|400)\b|No endpoints found|not a valid model|model_not_found/i.test(msg);
          if (!isModelMissing || i === visionCandidates.length - 1) throw e;
          setCurrentAnswer('');
          continue;
        }
      }
      if (!full && lastErr) throw lastErr;
      if (full) {
        setTranscript(prev => { const next = [...prev, { id: `a-${Date.now()}`, text: full, timestamp: Date.now(), type: 'answer' as const }]; transcriptRef.current = next; return next; });
        setCurrentAnswer('');
        invoke('add_analytics_response', { question: '[Скриншот]', response: full, sessionId: 'screen', responseTimeMs: Date.now() - t0, modelUsed: visionModel, tokensUsed: Math.floor(full.length / 4) }).catch(() => {});
      }
      setStatus('idle'); setStatusMsg('');
    } catch (e) { setStatus('error'); setStatusMsg(String(e).slice(0, 60)); }
    finally { setIsGenerating(false); }
  };

  // Keep captureScreenRef up to date
  useEffect(() => { captureScreenRef.current = captureScreen; });

  const handleManualSubmit = async () => {
    const q = manualInput.trim();
    if (!q || isGeneratingRef.current) return;
    setManualInput(''); setShowManualInput(false);
    const entry: TranscriptEntry = { id: `q-${Date.now()}`, text: q, timestamp: Date.now(), type: 'question' };
    setTranscript(prev => { const next = [...prev, entry]; transcriptRef.current = next; return next; });
    await generateAnswerRef.current(q);
  };

  const dotCls = { idle: 'bg-white/20', recording: 'bg-red-500 animate-pulse', transcribing: 'bg-yellow-400 animate-pulse', generating: 'bg-[#1CCDAA] animate-pulse', error: 'bg-red-400' }[status];
  const statusLabel = statusMsg || { idle: isListening ? 'Авто-режим' : 'Готов', recording: 'Запись...', transcribing: 'Транскрибирую...', generating: 'Генерирую...', error: 'Ошибка' }[status];

  return (
    <div className={clsx('flex', 'flex-col', 'bg-[#0a0a0a]', 'h-[calc(100vh-48px)]', 'overflow-hidden', 'text-white')}>
      <div className={clsx('flex', 'justify-between', 'items-center', 'px-6', 'pt-5', 'pb-3', 'shrink-0')}>
        <h1 className={clsx('font-bold', 'text-[22px]')}>Живой ассистент</h1>
        <div className={clsx('flex', 'items-center', 'gap-2')}>
          <button
            onClick={() => { const n = sttMode === 'whisper' ? 'openrouter' : 'whisper'; setSttMode(n); localStorage.setItem('stt_mode', n); }}
            className={clsx('flex items-center gap-1.5 px-2.5 py-1 border rounded-md text-[11px] transition-colors', sttMode === 'openrouter' ? 'border-[#1CCDAA]/50 text-[#1CCDAA] bg-[#1CCDAA]/10' : 'border-white/10 text-white/40 hover:text-white/60')}
          >
            <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
            {sttMode === 'openrouter' ? 'GPT-4o' : 'Авто'}
          </button>
          <button onClick={() => { setTranscript([]); transcriptRef.current = []; localStorage.removeItem('live_assistant_session'); }} className={clsx('p-1.5', 'border', 'border-white/10', 'rounded-md', 'text-white/40', 'hover:text-white/70', 'transition-colors')} title="Очистить">
            <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
          </button>
        </div>
      </div>

      <div className={clsx('px-6', 'pb-4', 'shrink-0')}>
        <button
          onMouseDown={doPttStart} onMouseUp={doPttStop}
          onTouchStart={(e) => { e.preventDefault(); doPttStart(); }} onTouchEnd={(e) => { e.preventDefault(); doPttStop(); }}
          className={clsx('flex flex-col justify-center items-center gap-2.5 py-5 border-2 rounded-2xl w-full transition-all duration-150 cursor-pointer select-none', isPushToTalk ? 'border-red-500 bg-red-500/10 scale-[0.98]' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20')}
        >
          <div className={clsx('relative', 'flex', 'justify-center', 'items-center')}>
            {isPushToTalk && <span className={clsx('inline-flex', 'absolute', 'bg-red-500/25', 'rounded-full', 'w-12', 'h-12', 'animate-ping')} />}
            <div className={clsx('flex justify-center items-center rounded-full w-12 h-12 transition-colors', isPushToTalk ? 'bg-red-500' : 'bg-white/10')}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className={isPushToTalk ? 'text-white' : 'text-white/60'}>
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="text-center">
            <div className={clsx('font-medium text-sm', isPushToTalk ? 'text-red-400' : 'text-white/70')}>
              {isPushToTalk ? 'Отпусти чтобы отправить' : 'Зажми для записи'}
            </div>
            <div className={clsx('mt-0.5', 'text-[11px]', 'text-white/25')}>Ctrl+Alt+Space — PTT &nbsp;·&nbsp; Ctrl+Alt+S — скриншот</div>
          </div>
        </button>
      </div>

      <div className={clsx('flex', 'items-center', 'gap-2', 'px-6', 'pb-3', 'shrink-0')}>
        <div className={clsx('flex', 'flex-1', 'items-center', 'gap-1.5', 'min-w-0')}>
          <span className={clsx('rounded-full w-2 h-2 shrink-0', dotCls)} />
          <span className={clsx('text-[11px]', 'text-white/50', 'truncate')}>{statusLabel}</span>
        </div>
        <label className={clsx('flex', 'items-center', 'gap-1', 'text-[11px]', 'text-white/40', 'cursor-pointer', 'shrink-0')}>
          <input type="checkbox" checked={autoMode} onChange={e => setAutoMode(e.target.checked)} className={clsx('w-3', 'h-3', 'accent-[#1CCDAA]')} />Авто
        </label>
        <label className={clsx('flex', 'items-center', 'gap-1', 'text-[11px]', 'text-white/40', 'shrink-0')}>
          <input type="number" value={intervalSec} onChange={e => setIntervalSec(Number(e.target.value) || 15)} min={5} max={60} className={clsx('bg-white/5', 'py-0.5', 'border', 'border-white/10', 'rounded', 'w-8', 'text-[11px]', 'text-white', 'text-center')} />с
        </label>
        <div className={clsx('flex', 'gap-1.5', 'shrink-0')}>
          <button onClick={captureLoop} disabled={isGenerating || isPushToTalk} title="Слушать" className={clsx('disabled:opacity-30', 'p-1.5', 'border', 'border-white/10', 'rounded-md', 'text-white/40', 'hover:text-white/70', 'transition-colors')}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>
          </button>
          <button onClick={captureScreen} disabled={isGenerating} title="Экран (Ctrl+Alt+S)" className={clsx('disabled:opacity-30', 'p-1.5', 'border', 'border-white/10', 'rounded-md', 'text-white/40', 'hover:text-white/70', 'transition-colors')}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
          </button>
          <button onClick={() => setShowManualInput(!showManualInput)} title="Текст" className={clsx('p-1.5 border rounded-md transition-colors', showManualInput ? 'border-[#1CCDAA]/40 text-[#1CCDAA] bg-[#1CCDAA]/5' : 'border-white/10 text-white/40 hover:text-white/70')}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" /></svg>
          </button>
          {!isListening ? (
            <button onClick={startListening} className={clsx('flex', 'items-center', 'gap-1', 'bg-[#1CCDAA]', 'hover:bg-[#1CCDAA]/80', 'px-2.5', 'py-1', 'rounded-md', 'font-semibold', 'text-[11px]', 'text-black')}>
              <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
              Авто
            </button>
          ) : (
            <button onClick={stopListening} className={clsx('flex', 'items-center', 'gap-1', 'bg-red-500', 'hover:bg-red-600', 'px-2.5', 'py-1', 'rounded-md', 'font-semibold', 'text-[11px]', 'text-white')}>
              <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" /></svg>
              Стоп
            </button>
          )}
        </div>
      </div>

      {showManualInput && (
        <div className={clsx('flex', 'gap-2', 'px-6', 'pb-3', 'shrink-0')}>
          <input value={manualInput} onChange={e => setManualInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleManualSubmit(); } }} placeholder="Введите вопрос и нажмите Enter..." className={clsx('flex-1', 'bg-white/[0.05]', 'px-3', 'py-2', 'border', 'border-white/10', 'focus:border-[#1CCDAA]/40', 'rounded-lg', 'focus:outline-none', 'text-white', 'text-sm', 'placeholder-white/30')} autoFocus />
          <button onClick={handleManualSubmit} disabled={!manualInput.trim() || isGenerating} className={clsx('bg-[#1CCDAA]', 'hover:bg-[#1CCDAA]/80', 'disabled:opacity-40', 'px-3', 'py-2', 'rounded-lg', 'font-medium', 'text-black', 'text-sm')}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
          </button>
        </div>
      )}

      <div className={clsx('flex-1', 'px-6', 'pb-4', 'overflow-y-auto')}>
        {transcript.length === 0 && !currentAnswer && (
          <div className={clsx('flex', 'flex-col', 'justify-center', 'items-center', 'gap-3', 'h-full', 'text-white/20')}>
            <svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor" className="opacity-20"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>
            <p className="text-sm">Зажми кнопку или Ctrl+Alt+Space</p>
            <p className={clsx('text-[11px]', 'text-white/15')}>Работает даже когда приложение не в фокусе</p>
          </div>
        )}
        {transcript.map(entry => (
          <div key={entry.id} className={clsx('mb-3 p-4 border rounded-xl', entry.type === 'question' ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white/[0.03] border-white/[0.08]')}>
            <div className={clsx('flex', 'items-center', 'gap-2', 'mb-2', 'text-xs')}>
              {entry.type === 'question' ? <span className="text-white/40">Собеседник</span> : (
                <span className={clsx('flex', 'items-center', 'gap-1', 'text-[#1CCDAA]')}>
                  <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor"><path d="M13 7H7v6h6V7z" /><path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" /></svg>
                  Ассистент
                </span>
              )}
              <span className="text-white/25">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
            <div className={clsx('text-white/90', 'text-sm', 'leading-relaxed')}><RenderContent text={entry.text} /></div>
          </div>
        ))}
        {currentAnswer && (
          <div className={clsx('bg-white/[0.03]', 'mb-3', 'p-4', 'border', 'border-white/[0.08]', 'rounded-xl')}>
            <div className={clsx('flex', 'items-center', 'gap-2', 'mb-2', 'text-xs')}>
              <span className={clsx('flex', 'items-center', 'gap-1', 'text-[#1CCDAA]')}>
                <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor"><path d="M13 7H7v6h6V7z" /><path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" /></svg>
                Ассистент
              </span>
              <span className={clsx('text-white/30', 'animate-pulse')}>печатает...</span>
            </div>
            <div className={clsx('text-white/90', 'text-sm', 'leading-relaxed')}>
              <RenderContent text={currentAnswer} />
              <span className={clsx('inline-block', 'bg-[#1CCDAA]', 'ml-0.5', 'w-0.5', 'h-4', 'align-middle', 'animate-pulse')} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
