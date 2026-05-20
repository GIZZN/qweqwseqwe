'use client';

import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Image from 'next/image';
import clsx from 'clsx';

interface Message {
  id: string;
  role: string;
  content: string;
  timestamp: string;
}

interface ChatSession {
  id: string;
  context: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

interface ChatSessionSummary {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export default function InterviewAssistant() {
  const [context, setContext] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<{ id: string; name: string; type: string; dataUrl: string }[]>([]);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [contextSaveStatus, setContextSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contextSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isChatExpanded, setIsChatExpanded] = useState(true);
  const [chatSessions, setChatSessions] = useState<ChatSessionSummary[]>([]);
  const [isNavExpanded, setIsNavExpanded] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadChatSessions();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [session?.messages]);

  // слушаем событие для транскрипции (опциональное будущее использование)
  useEffect(() => {
    type UnlistenFn = () => void;
    const w = window as unknown as { __TAURI__?: { event?: { listen?: (ev: string, cb: (e: { payload: unknown }) => void) => Promise<UnlistenFn> } } };
    let unlisten: UnlistenFn | undefined;
    const setup = async () => {
      const listen = w.__TAURI__?.event?.listen;
      if (!listen) return;
      unlisten = await listen('transcription_ready', (e: { payload: unknown }) => {
        const text = typeof e.payload === 'string' ? e.payload : '';
        if (text) setMessage(prev => (prev ? prev + '\n' : '') + text);
      });
    };
    void setup();
    return () => {
      if (typeof unlisten === 'function') unlisten();
    };
  }, []);

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAttachFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (list.length === 0) return;
    const next: { id: string; name: string; type: string; dataUrl: string }[] = [];
    for (const f of list) {
      try {
        const dataUrl = await fileToDataUrl(f);
        next.push({ id: `${Date.now()}-${f.name}-${Math.random().toString(36).slice(2)}`, name: f.name, type: f.type, dataUrl });
      } catch {}
    }
    if (next.length) setAttachments(prev => [...prev, ...next]);
  };

  const handlePasteIntoMessage = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items: DataTransferItemList | undefined = e.clipboardData?.items as unknown as DataTransferItemList | undefined;
    if (!items) return;
    const images: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'file') {
        const file = it.getAsFile();
        if (file && file.type.startsWith('image/')) images.push(file);
      }
    }
    if (images.length) {
      e.preventDefault();
      await handleAttachFiles(images);
    }
  };

  const handleDropOnMessage = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    if (e.dataTransfer?.files && e.dataTransfer.files.length) {
      await handleAttachFiles(e.dataTransfer.files);
    }
  };

  const handlePickFiles = () => fileInputRef.current?.click();

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const renderMessageContent = (content: string) => {
    // Регулярное выражение для поиска markdown изображений
    const imageRegex = /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = imageRegex.exec(content)) !== null) {
      // Добавляем текст до изображения
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }
      
      // Добавляем изображение как превью
      const [, altText, dataUrl] = match;
      parts.push(
        <div key={match.index} className={clsx('inline-block', 'my-2')}>
          <div className={clsx('group', 'relative', 'max-w-xs')}>
            <Image 
              src={dataUrl} 
              alt={altText || 'Изображение'} 
              width={300}
              height={200}
              className={clsx('shadow-lg', 'hover:shadow-xl', 'border', 'border-white/20', 'rounded-lg', 'max-w-full', 'h-auto', 'transition-shadow', 'cursor-pointer')}
              onClick={() => {
                const newWindow = window.open();
                if (newWindow) {
                  newWindow.document.write(`<img src="${dataUrl}" style="max-width: 100%; height: auto;" alt="${altText || 'Изображение'}">`);
                }
              }}
            />
                                        <div className={clsx('right-0.5', 'bottom-0.5', 'left-0.5', 'absolute', 'bg-black/80', 'opacity-0', 'group-hover:opacity-100', 'backdrop-blur-sm', 'px-1.5', 'py-0.5', 'rounded', 'text-white/90', 'text-xs', 'text-center', 'transition-opacity')}>
                              {altText || 'image.png'}
                            </div>
          </div>
        </div>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Добавляем оставшийся текст
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }
    
    return parts.length > 1 ? parts : content;
  };

  const saveChatSessionsToStorage = (sessions: ChatSessionSummary[]) => {
    try { localStorage.setItem('chat_sessions', JSON.stringify(sessions)); } catch {}
  };

  const saveChatToStorage = (chatSession: ChatSession) => {
    try {
      const key = `chat_session_${chatSession.id}`;
      localStorage.setItem(key, JSON.stringify(chatSession));
    } catch {}
  };

  const loadChatFromStorage = (sessionId: string): ChatSession | null => {
    try {
      const raw = localStorage.getItem(`chat_session_${sessionId}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  const loadChatSessions = async () => {
    try {
      const sessions = await invoke<ChatSessionSummary[]>('list_chat_sessions');
      
      // Merge with localStorage sessions (Rust may have lost them on restart)
      const storedRaw = localStorage.getItem('chat_sessions');
      const storedSessions: ChatSessionSummary[] = storedRaw ? JSON.parse(storedRaw) : [];
      
      // Restore sessions from localStorage into Rust if they're missing
      for (const stored of storedSessions) {
        if (!sessions.find(s => s.id === stored.id)) {
          const full = loadChatFromStorage(stored.id);
          if (full) {
            try {
              await invoke('create_chat_session', { context: full.context });
              // Re-add messages
              for (const msg of full.messages) {
                if (msg.role === 'user') {
                  await invoke('send_message', { sessionId: full.id, content: msg.content }).catch(() => {});
                }
              }
            } catch {}
          }
        }
      }
      
      const finalSessions = await invoke<ChatSessionSummary[]>('list_chat_sessions');
      setChatSessions(finalSessions);
      saveChatSessionsToStorage(finalSessions);
      
      if (!session) {
        if (finalSessions.length > 0) {
          await switchToChat(finalSessions[0].id);
        } else {
          await createNewChat();
        }
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      // Fallback: load from localStorage
      const storedRaw = localStorage.getItem('chat_sessions');
      if (storedRaw) {
        try {
          const stored: ChatSessionSummary[] = JSON.parse(storedRaw);
          setChatSessions(stored);
          if (!session && stored.length > 0) {
            const full = loadChatFromStorage(stored[0].id);
            if (full) { setSession(full); setContext(full.context || ''); }
          }
        } catch {}
      } else {
        await createNewChat();
      }
    }
  };

  const createNewChat = async () => {
    try {
      const newSession = await invoke<ChatSession>('create_chat_session', { context: '' });
      setSession(newSession);
      setContext('');
      await loadChatSessions();
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  };

  const switchToChat = async (sessionId: string) => {
    try {
      const chatSession = await invoke<ChatSession>('get_chat_session', { sessionId });
      setSession(chatSession);
      setContext(chatSession.context);
    } catch (error) {
      console.error('Error switching to chat:', error);
    }
  };

  const deleteChat = async (sessionId: string) => {
    try {
      await invoke('delete_chat_session', { sessionId });
      await loadChatSessions();
      
      // Если удалили активный чат, переключаемся на другой или создаем новый
      if (session?.id === sessionId) {
        const remainingSessions = chatSessions.filter(s => s.id !== sessionId);
        if (remainingSessions.length > 0) {
          await switchToChat(remainingSessions[0].id);
        } else {
          await createNewChat();
        }
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const startEditingChat = (chatId: string, currentTitle: string) => {
    setEditingChatId(chatId);
    setEditingTitle(currentTitle);
  };

  const saveEditingChat = async () => {
    if (!editingChatId || !editingTitle.trim()) return;
    
    try {
      await invoke('rename_chat_session', {
        sessionId: editingChatId,
        newTitle: editingTitle.trim()
      });
      await loadChatSessions();
      
      // Если редактируем активный чат, обновляем его контекст
      if (session?.id === editingChatId) {
        setContext(editingTitle.trim());
      }
      
      setEditingChatId(null);
      setEditingTitle('');
    } catch (error) {
      console.error('Error renaming chat:', error);
    }
  };

  const cancelEditingChat = () => {
    setEditingChatId(null);
    setEditingTitle('');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const updateContext = async (newContext: string) => {
    if (!session) return;
    
    setContext(newContext);
    setContextSaveStatus('saving');
    
    // Очищаем предыдущий таймер
    if (contextSaveTimeout.current) {
      clearTimeout(contextSaveTimeout.current);
    }
    
    // Устанавливаем новый таймер для сохранения
    contextSaveTimeout.current = setTimeout(async () => {
      try {
        const updatedSession = await invoke<ChatSession>('update_chat_context', {
          sessionId: session.id,
          context: newContext
        });
        setSession(updatedSession);
        setContextSaveStatus('saved');
        // Save to localStorage immediately
        saveChatToStorage({ ...session, context: newContext });
        // Обновляем список чатов для отображения нового заголовка
        await loadChatSessions();
      } catch (error) {
        console.error('Error updating context:', error);
        setContextSaveStatus('unsaved');
      }
    }, 500);
  };

  const clearContext = () => {
    setContext('');
    updateContext('');
  };

  const getSaveStatusIcon = () => {
    switch (contextSaveStatus) {
      case 'saving':
        return (
          <div className={clsx('border', 'border-white/20', 'border-t-white/60', 'rounded-full', 'w-3', 'h-3', 'animate-spin')}></div>
        );
      case 'saved':
        return (
          <svg className={clsx('w-3', 'h-3', 'text-green-400')} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'unsaved':
        return (
          <svg className={clsx('w-3', 'h-3', 'text-red-400')} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  const handleSubmit = async () => {
    if (!message.trim() || !session) return;

    const imagesBlock = attachments
      .map(a => `![${a.name}](${a.dataUrl})`)
      .join('\n');
    const userMessage = imagesBlock ? `${message.trim()}\n\n${imagesBlock}` : message.trim();
    const startTime = Date.now();
    
    try {
      setIsLoading(true);

      // Add user message to local state immediately
      const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: userMessage, timestamp: new Date().toISOString() };
      setSession(prev => prev ? { ...prev, messages: [...prev.messages, userMsg] } : null);
      setMessage('');
      setAttachments([]);

      // Also save to Rust backend (without base64 images to avoid storage bloat)
      const cleanForStorage = userMessage.replace(/!\[.*?\]\(data:image\/[^)]+\)/g, '[изображение]');
      await invoke('send_message', { sessionId: session.id, content: cleanForStorage }).catch(() => {});

      // Get AI settings from localStorage
      const apiKey = localStorage.getItem('ai_api_key') || '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';
      const provider = localStorage.getItem('ai_provider') || 'openrouter';
      const aiModel = localStorage.getItem('ai_model') || 'openai/gpt-4o-mini';
      const customEndpoint = localStorage.getItem('ai_endpoint') || '';

      if (!apiKey) {
        const errMsg: Message = { id: `e-${Date.now()}`, role: 'assistant', content: '⚠️ API ключ не настроен. Перейдите в Настройки ИИ и укажите ключ OpenRouter.', timestamp: new Date().toISOString() };
        setSession(prev => prev ? { ...prev, messages: [...prev.messages, errMsg] } : null);
        setIsLoading(false);
        return;
      }

      // Determine endpoint
      let endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      if (provider === 'openai') endpoint = 'https://api.openai.com/v1/chat/completions';
      else if (provider === 'openrouter') endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      else if (provider === 'gptunnel') endpoint = 'https://gptunnel.ru/v1/chat/completions';
      else if (provider === 'ollama') endpoint = 'http://localhost:11434/v1/chat/completions';
      else if (provider === 'custom' && customEndpoint) endpoint = customEndpoint;

      // Build messages for AI (include context + history, strip image data URLs from history)
      const activeContext = context || session.context || '';
      const savedSystemPrompt = localStorage.getItem('system_prompt') || '';
      const systemPrompt = savedSystemPrompt
        ? (activeContext ? `${savedSystemPrompt}\n\nКонтекст собеседования: ${activeContext}` : savedSystemPrompt)
        : (activeContext
          ? `Ты — ИИ-ассистент для собеседований. Контекст собеседования: ${activeContext}. Отвечай на русском, кратко и по делу. Используй контекст чтобы давать релевантные ответы.`
          : 'Ты — ИИ-ассистент для собеседований. Отвечай на русском, кратко и по делу.');

      // Strip base64 images from history to avoid token overflow
      const cleanHistory = session.messages.slice(-20).map(m => ({
        role: m.role,
        content: m.content.replace(/!\[.*?\]\(data:image\/[^)]+\)/g, '[изображение]').slice(0, 2000),
      }));

      // If model supports vision and we have attachments, send them as proper image_url parts.
      const isVision = (m: string) => /(gpt-4o|gpt-4\.1|gpt-4-vision|gpt-5|o1|o3|o4|gemini|gemma-3|gemma-4|claude-3|claude-sonnet|claude-opus|claude-haiku|vision|llava|pixtral|qwen.*vl|qwen2-vl|qwen2\.5-vl|qwen3-vl|llama-3\.2.*(11|90)b|llama-4|internvl|nemotron-nano-\d+b-v\d+-vl|mimo|glm-4\.\d+v|grok-4|grok-3|nano-banana|openrouter\/free)/i.test((m || '').toLowerCase());

      const userTextOnly = userMessage.replace(/!\[.*?\]\(data:image\/[^)]+\)/g, '').trim().slice(0, 4000);
      let userPart: { role: string; content: unknown };
      if (attachments.length > 0 && isVision(aiModel)) {
        const parts: unknown[] = [];
        if (userTextOnly) parts.push({ type: 'text', text: userTextOnly });
        for (const a of attachments) parts.push({ type: 'image_url', image_url: { url: a.dataUrl } });
        userPart = { role: 'user', content: parts };
      } else {
        userPart = {
          role: 'user',
          content: userMessage
            .replace(/!\[.*?\]\(data:image\/[^)]+\)/g, '[изображение прикреплено]')
            .slice(0, 4000),
        };
      }

      const aiMessages: { role: string; content: unknown }[] = [
        { role: 'system', content: systemPrompt },
        ...cleanHistory,
        userPart,
      ];

      // Stream AI response through Rust proxy
      const requestBody = JSON.stringify({ model: aiModel, messages: aiMessages, temperature: 0.3, max_tokens: 4096, stream: true });

      const assistantMsgId = `a-${Date.now()}`;
      setSession(prev => prev ? { ...prev, messages: [...prev.messages, { id: assistantMsgId, role: 'assistant', content: '', timestamp: new Date().toISOString() }] } : null);

      let fullResponse = '';
      const applyToken = (text: string) => {
        fullResponse = text;
        setSession(prev => {
          if (!prev) return null;
          const msgs = [...prev.messages];
          const idx = msgs.findIndex(m => m.id === assistantMsgId);
          if (idx >= 0) msgs[idx] = { ...msgs[idx], content: fullResponse };
          return { ...prev, messages: msgs };
        });
      };

      // 1) Try real streaming through Tauri Channel — first token in ~300ms.
      let streamedOk = false;
      try {
        const { Channel } = await import('@tauri-apps/api/core');
        const channel = new Channel<string>();
        let buffer = '';
        let acc = '';
        channel.onmessage = (chunk: string) => {
          buffer += chunk;
          let nl: number;
          while ((nl = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith('data: ')) continue;
            const d = line.slice(6).trim();
            if (d === '[DONE]') return;
            try {
              const j = JSON.parse(d);
              const t = j.choices?.[0]?.delta?.content || '';
              if (t) { acc += t; applyToken(acc); }
            } catch {}
          }
        };
        await invoke('ai_proxy_stream', { endpoint, apiKey, body: requestBody, onChunk: channel });
        if (acc) { streamedOk = true; }
      } catch (err) {
        const errStr = String(err);
        // Real HTTP error from server — surface immediately, skip fallback.
        if (errStr.match(/\b[45]\d\d\b/)) {
          throw err;
        }
        // Otherwise fall through to non-streaming proxy below.
      }

      // 2) Fallback: non-streaming Rust proxy (parses the whole SSE body at once).
      if (!streamedOk) try {
        const rawResponse = await invoke<string>('ai_proxy_request', { endpoint, apiKey, body: requestBody });

        // Parse SSE stream response (Rust returns the full body including data: lines)
        const lines = rawResponse.split('\n');
        let acc = '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const json = JSON.parse(data);
            const token = json.choices?.[0]?.delta?.content || '';
            if (token) { acc += token; applyToken(acc); }
          } catch {}
        }

        // If no streaming tokens parsed, try as regular JSON response
        if (!acc) {
          try {
            const json = JSON.parse(rawResponse);
            const t = json.choices?.[0]?.message?.content || '';
            if (t) { acc = t; applyToken(acc); }
          } catch {}
        }
      } catch (err) {
        const errStr = String(err);
        if (!errStr.match(/\b[45]\d\d\b/)) {
          // Fallback: direct fetch for dev mode
          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({ model: aiModel, messages: aiMessages, temperature: 0.3, max_tokens: 4096, stream: true }),
            });
            if (!response.ok) throw new Error(`${response.status}`);
            const reader = response.body?.getReader();
            if (reader) {
              const decoder = new TextDecoder();
              let acc = '';
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                for (const line of decoder.decode(value).split('\n')) {
                  if (!line.startsWith('data: ')) continue;
                  const d = line.slice(6); if (d === '[DONE]') break;
                  try {
                    const j = JSON.parse(d);
                    const t = j.choices?.[0]?.delta?.content || '';
                    if (t) { acc += t; applyToken(acc); }
                  } catch {}
                }
              }
            }
          } catch { throw err; }
        } else {
          throw err;
        }
      }

      if (!fullResponse) fullResponse = '(Пустой ответ от модели)';

      // Final update
      setSession(prev => {
        if (!prev) return null;
        const msgs = [...prev.messages];
        const idx = msgs.findIndex(m => m.id === assistantMsgId);
        if (idx >= 0) msgs[idx] = { ...msgs[idx], content: fullResponse };
        return { ...prev, messages: msgs };
      });

      // Save assistant message to Rust session for persistence
      await invoke('save_assistant_message', { sessionId: session.id, content: fullResponse }).catch(() => {});

      // Analytics
      const responseTime = Date.now() - startTime;
      invoke('add_analytics_response', {
        question: userMessage, response: fullResponse, sessionId: session.id,
        responseTimeMs: responseTime, modelUsed: aiModel,
        tokensUsed: Math.floor(fullResponse.length / 4)
      }).catch(() => {});

      // Sync to web dashboard
      import('../features/sync/sessionSync').then(({ syncSessionEvent }) => {
        syncSessionEvent({
          type: 'chat_message',
          question: userMessage.replace(/!\[.*?\]\(data:image\/[^)]+\)/g, '[изображение]').slice(0, 500),
          answer: fullResponse,
          model: aiModel,
          responseTimeMs: responseTime,
          sessionId: session.id,
        });
      });

      await loadChatSessions();
      // Save updated session to localStorage
      setSession(prev => { if (prev) saveChatToStorage(prev); return prev; });
    } catch (error) {
      console.error('Error sending message:', error);
      // no-op
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const clearChat = async () => {
    if (session) {
      // Создаем новый чат вместо очистки текущего
      await createNewChat();
    }
  };

  // getMessageStatusIcon removed (inline icons used elsewhere)

  return (
    <div className={clsx('flex', 'flex-col', 'bg-[#0A0A0A]', 'h-[calc(100vh-48px)]', 'overflow-hidden')}>
      <style jsx global>{`
        svg:not(.mx-auto) {
          margin: 0 !important;
          padding: 0 !important;
        }
        textarea {
          margin: 0;
        }
    `}</style>

      <div className={clsx('flex-1', 'p-6', 'overflow-y-auto')}>
        <div className={clsx('mx-auto', 'w-full', 'max-w-5xl')}>
          <div className={clsx('top-0', 'z-10', 'sticky', 'flex', 'justify-between', 'items-center', 'bg-[#0A0A0A]', 'mb-6', 'py-3')}>
            <h1 className={clsx('font-semibold', 'text-white', 'text-2xl')}>Интервью-ассистент</h1>
          </div>

          {/* Контекст собеседования */}
          <div className={clsx('top-20', 'z-20', 'sticky', 'bg-[#0A0A0A]/80', 'backdrop-blur-md', 'mb-6', 'border', 'border-white/[0.08]', 'rounded-lg', 'transition-all', 'duration-300')}>
            <div className={clsx('flex', 'justify-between', 'items-center', 'p-3', 'pb-2')}>
              <div className={clsx('flex', 'items-center', 'space-x-2')}>
                <h2 className={clsx('font-medium', 'text-white', 'text-sm')}>Контекст собеседования</h2>
                <div className={clsx('flex', 'items-center', 'space-x-1')}>
                  {getSaveStatusIcon()}
                  <span className={clsx('text-white/40', 'text-xs')}>
                    {context.length}/500
                  </span>
                </div>
              </div>
              <div className={clsx('flex', 'items-center', 'space-x-2')}>
                {context.length > 0 && (
                  <button
                    onClick={clearContext}
                    className={clsx('text-white/40', 'hover:text-white/60', 'transition-colors')}
                    title="Очистить контекст"
                  >
                    <svg className={clsx('w-3', 'h-3')} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => setIsContextExpanded(!isContextExpanded)}
                  className={clsx('text-white/40', 'hover:text-white/60', 'transition-colors')}
                  title={isContextExpanded ? "Свернуть" : "Развернуть"}
                >
                  <svg 
                    className={`w-3 h-3 transition-transform duration-200 ${isContextExpanded ? 'rotate-180' : ''}`} 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className={`px-3 pb-3 transition-all duration-300 ${isContextExpanded ? 'opacity-100' : 'opacity-100'}`}>
              <textarea
                value={context}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    updateContext(e.target.value);
                  }
                }}
                rows={isContextExpanded ? 4 : 2}
                className={clsx('bg-transparent', 'px-2.5', 'py-1.5', 'border', 'border-white/[0.08]', 'focus:border-white/20', 'rounded-md', 'focus:outline-none', 'w-full', 'text-white', 'text-xs', 'transition-all', 'duration-200', 'resize-none', 'placeholder-white/40')}
                placeholder="Опишите роль, требования, технологии и другие важные детали для собеседования..."
                onKeyDown={(e) => {
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = e.currentTarget.selectionStart;
                    const end = e.currentTarget.selectionEnd;
                    const newValue = context.substring(0, start) + '  ' + context.substring(end);
                    if (newValue.length <= 500) {
                      updateContext(newValue);
                      setTimeout(() => {
                        e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
                      }, 0);
                    }
                  }
                }}
              />
              
              {/* Быстрые шаблоны */}
              {context.length === 0 && (
                <div className={clsx('flex', 'flex-wrap', 'gap-1', 'mt-2')}>
                  {[
                    'Frontend разработчик',
                    'Backend разработчик',
                    'Full-stack разработчик',
                    'DevOps инженер'
                  ].map((template) => (
                    <button
                      key={template}
                      onClick={() => updateContext(template)}
                      className={clsx('bg-white/[0.05]', 'hover:bg-white/[0.1]', 'px-2', 'py-1', 'border', 'border-white/[0.08]', 'rounded', 'text-white/60', 'hover:text-white/80', 'text-xs', 'transition-colors')}
                    >
                      {template}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Чат с ассистентом */}
          <div className={clsx('flex', 'flex-col', 'bg-[#0A0A0A]/80', 'backdrop-blur-sm', 'border', 'border-white/[0.08]', 'rounded-lg')}>
            <div className={clsx('flex', 'justify-between', 'items-center', 'p-3', 'pb-2', 'border-white/[0.05]', 'border-b')}>
              <div className={clsx('flex', 'items-center', 'space-x-2')}>
                <h2 className={clsx('font-medium', 'text-white', 'text-sm')}>Диалог</h2>
                <div className={clsx('flex', 'items-center', 'space-x-1')}>
                  {session?.messages && session.messages.length > 0 && (
                    <span className={clsx('text-white/40', 'text-xs')}>
                      {session.messages.length} сообщ.
                    </span>
                  )}
                </div>
              </div>
              <div className={clsx('flex', 'items-center', 'space-x-2')}>
                {session?.messages && session.messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    className={clsx('text-white/40', 'hover:text-white/60', 'transition-colors')}
                    title="Очистить чат"
                  >
                    <svg className={clsx('w-3', 'h-3')} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => setIsChatExpanded(!isChatExpanded)}
                  className={clsx('text-white/40', 'hover:text-white/60', 'transition-colors')}
                  title={isChatExpanded ? "Свернуть чат" : "Развернуть чат"}
                >
                  <svg 
                    className={`w-3 h-3 transition-transform duration-200 ${isChatExpanded ? 'rotate-180' : ''}`} 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* История сообщений */}
            <div className={`transition-all duration-300 ${isChatExpanded ? 'opacity-100' : 'opacity-100'}`}>
              <div 
                className={clsx('space-y-3', 'p-3', 'overflow-y-auto', 'custom-scrollbar')} 
                style={{ maxHeight: isChatExpanded ? 'calc(100vh - 450px)' : 'calc(100vh - 600px)' }}
              >
                {session?.messages && session.messages.length === 0 && (
                  <div className={clsx('py-8', 'text-center')}>
                    <svg className={clsx('mx-auto', 'mb-3', 'w-12', 'h-12', 'text-white/20')} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                    </svg>
                    <p className={clsx('text-white/40', 'text-sm')}>Начните диалог с ассистентом</p>
                    <p className={clsx('mt-1', 'text-white/30', 'text-xs')}>Задайте вопрос или опишите ситуацию</p>
                  </div>
                )}
                
                                 {session?.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}
                  >
                    <div className={`max-w-[80%] relative ${
                      msg.role === 'user'
                        ? 'ml-auto'
                        : ''
                    }`}>
                      <div className={`p-3 rounded-lg border transition-all duration-200 ${
                        msg.role === 'user'
                          ? 'border-white/[0.08] bg-white/[0.02]'
                          : 'border-white/[0.08] bg-white/[0.01]'
                      }`}>
                        <div className={clsx('flex', 'justify-between', 'items-center', 'mb-1')}>
                          <div className={clsx('flex', 'items-center', 'space-x-2')}>
                            <div className={clsx('flex', 'items-center', 'space-x-1')}>
                              {msg.role === 'user' ? (
                                <svg className={clsx('w-3', 'h-3', 'text-blue-400')} fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className={clsx('w-3', 'h-3', 'text-green-400')} fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                                  <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                                </svg>
                              )}
                              <span className={clsx('font-medium', 'text-white/60', 'text-xs')}>
                                {msg.role === 'user' ? 'Вы' : 'Ассистент'}
                              </span>
                            </div>
                            <span className={clsx('text-white/40', 'text-xs')}>
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          
                          {/* Действия с сообщением */}
                          <div className={clsx('flex', 'items-center', 'space-x-1', 'opacity-0', 'group-hover:opacity-100', 'transition-opacity')}>
                            <button
                              onClick={() => copyMessage(msg.content)}
                              className={clsx('text-white/30', 'hover:text-white/60', 'transition-colors')}
                              title="Копировать"
                            >
                              <svg className={clsx('w-3', 'h-3')} fill="currentColor" viewBox="0 0 20 20">
                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className={clsx('text-white', 'text-sm', 'leading-relaxed', 'whitespace-pre-wrap')}>
                          {msg.role === 'assistant' && !msg.content?.trim() ? (
                            <span className={clsx('inline-flex', 'items-center', 'space-x-1', 'py-1')} aria-label="Ассистент печатает">
                              <span className={clsx('bg-white/50', 'rounded-full', 'w-1.5', 'h-1.5', 'animate-bounce')} style={{ animationDelay: '0ms' }} />
                              <span className={clsx('bg-white/50', 'rounded-full', 'w-1.5', 'h-1.5', 'animate-bounce')} style={{ animationDelay: '150ms' }} />
                              <span className={clsx('bg-white/50', 'rounded-full', 'w-1.5', 'h-1.5', 'animate-bounce')} style={{ animationDelay: '300ms' }} />
                            </span>
                          ) : (
                            renderMessageContent(msg.content)
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Show typing indicator only if we don't already have a streaming-in-progress assistant bubble */}
                {isLoading && !(session?.messages.length && session.messages[session.messages.length - 1].role === 'assistant') && (
                  <div className={clsx('flex', 'justify-start')}>
                    <div className={clsx('bg-white/[0.01]', 'p-3', 'border', 'border-white/[0.08]', 'rounded-lg', 'max-w-[80%]')}>
                      <div className={clsx('flex', 'items-center', 'space-x-2')}>
                        <svg className={clsx('w-3', 'h-3', 'text-green-400')} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                          <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                        </svg>
                        <span className={clsx('text-white/60', 'text-xs')}>Ассистент печатает</span>
                        <span className={clsx('flex', 'items-center', 'space-x-1')}>
                          <span className={clsx('bg-white/50', 'rounded-full', 'w-1.5', 'h-1.5', 'animate-bounce')} style={{ animationDelay: '0ms' }} />
                          <span className={clsx('bg-white/50', 'rounded-full', 'w-1.5', 'h-1.5', 'animate-bounce')} style={{ animationDelay: '150ms' }} />
                          <span className={clsx('bg-white/50', 'rounded-full', 'w-1.5', 'h-1.5', 'animate-bounce')} style={{ animationDelay: '300ms' }} />
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Ввод сообщения */}
              <div className={clsx('p-4', 'border-white/[0.08]', 'border-t')}>
                <div className={clsx('relative', 'bg-[#1A1A1A]', 'border', 'border-[#2A2A2A]', 'rounded-lg')}>
                  <div className="p-3">
                    {/* Привью вложений */}
                    {attachments.length > 0 && (
                      <div className={clsx('flex', 'flex-wrap', 'gap-1.5', 'mb-2')}>
                        {attachments.map(att => (
                          <div key={att.id} className={clsx('group', 'relative')}>
                            <div className={clsx('relative', 'bg-gray-700/50', 'shadow-sm', 'border', 'border-gray-600/50', 'rounded-md', 'w-10', 'h-10', 'overflow-hidden')}>
                              <Image src={att.dataUrl} alt={att.name} width={40} height={40} className={clsx('w-full', 'h-full', 'object-cover')} />
                              <div className={clsx('absolute', 'inset-0', 'bg-black/10', 'opacity-0', 'group-hover:opacity-100', 'transition-opacity', 'duration-150')} />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(att.id)}
                              className={clsx('top-0', 'right-0', 'absolute', 'flex', 'justify-center', 'items-center', 'bg-gray-900/60', 'hover:bg-red-500/80', 'opacity-0', 'group-hover:opacity-100', 'rounded-tr-md', 'rounded-bl-md', 'w-4', 'h-4', 'text-white/80', 'hover:text-white', 'text-xs', 'transition-all', 'duration-200')}
                              title="Удалить"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="relative">
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyUp={handleKeyPress}
                        onPaste={handlePasteIntoMessage}
                        onDrop={handleDropOnMessage}
                        onDragOver={(e) => e.preventDefault()}
                        rows={1}
                        className={clsx('bg-transparent', 'px-3', 'py-2', 'border-none', 'focus:border-none', 'focus:outline-none', 'focus:ring-0', 'w-full', 'min-h-[40px]', 'font-sans', 'text-white', 'text-sm', 'resize-none', 'placeholder-gray-400')}
                        placeholder="Введите ваше сообщение..."
                        disabled={isLoading}
                        style={{ maxHeight: '200px' }}
                      />
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => e.target.files && handleAttachFiles(e.target.files)}
                      />
                    </div>
                    
                    {/* Кнопки на линии окна */}
                    <div className={clsx('absolute', 'flex', 'items-center', 'space-x-2', 'p-1')} style={{ bottom: '-0px', right: '-0px' }}>
                      <button
                        type="button"
                        onClick={handlePickFiles}
                        className={clsx('flex', 'justify-center', 'items-center', 'hover:bg-gray-600/50', 'rounded-full', 'w-6', 'h-6', 'text-gray-400', 'hover:text-gray-300', 'hover:scale-105', 'transition-all', 'duration-200')}
                        title="Прикрепить изображение"
                      >
                        <svg className={clsx('w-3', 'h-3')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49"/>
                        </svg>
                      </button>

                      <button
                        onClick={handleSubmit}
                        disabled={!message.trim() || isLoading}
                        className={clsx('flex', 'justify-center', 'items-center', 'bg-gray-600', 'hover:bg-gray-500', 'disabled:bg-gray-600', 'shadow-md', 'rounded-full', 'w-6', 'h-6', 'text-white', 'disabled:text-gray-400', 'hover:scale-105', 'disabled:hover:scale-100', 'transition-all', 'duration-200')}
                      >
                        {isLoading ? (
                          <div className={clsx('border', 'border-white/30', 'border-t-white', 'rounded-full', 'w-2', 'h-2', 'animate-spin')}></div>
                        ) : (
                          <svg className={clsx('w-3', 'h-3')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="m22 2-7 20-4-9-9-4z"/>
                            <path d="M22 2 11 13"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Подсказка под окном */}
                <div className={clsx('mt-2', 'text-gray-500', 'text-xs', 'text-center')}>
                  Enter для отправки, Shift+Enter для новой строки
                </div>
              </div>
            </div>
          </div>

          {/* Навигация по чатам */}
          <div className={clsx('bg-[#0A0A0A]/80', 'backdrop-blur-sm', 'mt-4', 'border', 'border-white/[0.08]', 'rounded-lg')}>
            <div className={clsx('flex', 'justify-between', 'items-center', 'p-3', 'pb-2', 'border-white/[0.05]', 'border-b')}>
              <div className={clsx('flex', 'items-center', 'space-x-2')}>
                <h2 className={clsx('font-medium', 'text-white', 'text-sm')}>Сохраненные чаты</h2>
                <span className={clsx('text-white/40', 'text-xs')}>
                  {chatSessions.length}
                </span>
              </div>
              <div className={clsx('flex', 'items-center', 'space-x-2')}>
                <button
                  onClick={createNewChat}
                  className={clsx('text-white/40', 'hover:text-white/60', 'transition-colors')}
                  title="Новый чат"
                >
                  <svg className={clsx('w-3', 'h-3')} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={() => setIsNavExpanded(!isNavExpanded)}
                  className={clsx('text-white/40', 'hover:text-white/60', 'transition-colors')}
                  title={isNavExpanded ? "Свернуть" : "Развернуть"}
                >
                  <svg 
                    className={`w-3 h-3 transition-transform duration-200 ${isNavExpanded ? 'rotate-180' : ''}`} 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Список чатов */}
            <div className={`transition-all duration-300 ${isNavExpanded ? 'max-h-96 opacity-100' : 'max-h-32 opacity-100'} overflow-y-auto`}>
              <div className={clsx('space-y-2', 'p-3')}>
                {chatSessions.length === 0 ? (
                  <div className={clsx('py-4', 'text-center')}>
                    <p className={clsx('text-white/40', 'text-sm')}>Нет сохраненных чатов</p>
                  </div>
                ) : (
                  chatSessions.map((chatSummary) => (
                    <div
                      key={chatSummary.id}
                      className={`group flex items-center space-x-2 p-2 rounded-lg border transition-all duration-200 ${
                        session?.id === chatSummary.id
                          ? 'border-white/20 bg-transparent'
                          : 'border-white/[0.05] hover:border-white/10 bg-transparent'
                      }`}
                    >
                      <button
                        onClick={() => switchToChat(chatSummary.id)}
                        className={clsx('flex-1', 'text-left')}
                      >
                        <div className={clsx('flex', 'items-center', 'space-x-2')}>
                          <div className={clsx('bg-green-400', 'rounded-full', 'w-3', 'h-3', 'animate-pulse')}></div>
                          <div className={clsx('flex-1', 'min-w-0')}>
                            {editingChatId === chatSummary.id ? (
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onBlur={saveEditingChat}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') saveEditingChat();
                                  if (e.key === 'Escape') cancelEditingChat();
                                }}
                                className={clsx('bg-transparent', 'px-1', 'py-0.5', 'border', 'border-white/20', 'focus:border-white/40', 'rounded', 'focus:outline-none', 'w-full', 'text-white', 'text-xs')}
                                autoFocus
                              />
                            ) : (
                              <p className={clsx('font-medium', 'text-white', 'text-xs', 'truncate')}>
                                {chatSummary.title}
                              </p>
                            )}
                            <div className={clsx('flex', 'items-center', 'space-x-2', 'mt-1')}>
                              <span className={clsx('text-white/30', 'text-xs')}>
                                {chatSummary.message_count} сообщ.
                              </span>
                              <span className={clsx('text-white/30', 'text-xs')}>
                                {new Date(chatSummary.updated_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                      
                      {/* Действия с чатом */}
                      <div className={clsx('flex', 'items-center', 'space-x-1', 'opacity-0', 'group-hover:opacity-100', 'transition-opacity')}>
                        <button
                          onClick={() => startEditingChat(chatSummary.id, chatSummary.title)}
                          className={clsx('text-white/30', 'hover:text-white/60', 'transition-colors')}
                          title="Переименовать"
                        >
                          <svg className={clsx('w-3', 'h-3')} fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                        {chatSessions.length > 1 && (
                          <button
                            onClick={() => deleteChat(chatSummary.id)}
                            className={clsx('text-white/30', 'hover:text-red-400', 'transition-colors')}
                            title="Удалить"
                          >
                            <svg className={clsx('w-3', 'h-3')} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 