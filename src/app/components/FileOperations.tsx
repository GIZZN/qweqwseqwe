'use client';

import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

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
  const [session, setSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [contextSaveStatus, setContextSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contextSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isChatExpanded, setIsChatExpanded] = useState(true);
  const [messageStatus, setMessageStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [chatSessions, setChatSessions] = useState<ChatSessionSummary[]>([]);
  const [isNavExpanded, setIsNavExpanded] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  useEffect(() => {
    loadChatSessions();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [session?.messages]);

  const loadChatSessions = async () => {
    try {
      const sessions = await invoke<ChatSessionSummary[]>('list_chat_sessions');
      setChatSessions(sessions);
      
      // Если нет активной сессии, создаем новую или выбираем первую
      if (!session) {
        if (sessions.length > 0) {
          await switchToChat(sessions[0].id);
        } else {
          await createNewChat();
        }
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      // Если не удалось загрузить, создаем новую сессию
      await createNewChat();
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
          <div className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin"></div>
        );
      case 'saved':
        return (
          <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'unsaved':
        return (
          <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  const handleSubmit = async () => {
    if (!message.trim() || !session) return;

    const userMessage = message.trim();
    const startTime = Date.now();
    
    try {
      setIsLoading(true);
      setMessageStatus('sending');
      
      await invoke('send_message', {
        sessionId: session.id,
        content: userMessage
      });

      const messages = await invoke<Message[]>('get_chat_messages', {
        sessionId: session.id
      });

      // Находим последний ответ ассистента
      const assistantMessages = messages.filter(m => m.role === 'assistant');
      const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
      
      if (lastAssistantMessage) {
        const responseTime = Date.now() - startTime;
        
        // Добавляем в аналитику
        try {
          await invoke('add_analytics_response', {
            question: userMessage,
            response: lastAssistantMessage.content,
            sessionId: session.id,
            responseTimeMs: responseTime,
            modelUsed: 'gpt-3.5-turbo', // TODO: получать из настроек
            tokensUsed: Math.floor(lastAssistantMessage.content.length / 4) // Примерная оценка токенов
          });
        } catch (analyticsError) {
          console.error('Error saving to analytics:', analyticsError);
        }
      }

      setSession(prev => prev ? { ...prev, messages } : null);
      setMessage('');
      setMessageStatus('sent');
      
      // Обновляем список чатов для отображения нового количества сообщений
      await loadChatSessions();
      
      // Сброс статуса через 2 секунды
      setTimeout(() => setMessageStatus('idle'), 2000);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessageStatus('error');
      setTimeout(() => setMessageStatus('idle'), 3000);
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

  const getMessageStatusIcon = () => {
    switch (messageStatus) {
      case 'sending':
        return (
          <div className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin"></div>
        );
      case 'sent':
        return (
          <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-[#0A0A0A] overflow-hidden">
      <style jsx global>{`
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
        }
        svg:not(.mx-auto) {
          margin: 0 !important;
          padding: 0 !important;
        }
        
        textarea {
          margin: 0;
        }
    `}</style>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto w-full">
          <div className="flex justify-between items-center mb-6 sticky top-0 bg-[#0A0A0A] z-10 py-3">
            <h1 className="text-2xl font-semibold text-white">Интервью-ассистент</h1>
          </div>

          {/* Контекст собеседования */}
          <div className="sticky top-20 z-20 border border-white/[0.08] rounded-lg backdrop-blur-md bg-[#0A0A0A]/80 mb-6 transition-all duration-300">
            <div className="flex items-center justify-between p-3 pb-2">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-medium text-white">Контекст собеседования</h2>
                <div className="flex items-center space-x-1">
                  {getSaveStatusIcon()}
                  <span className="text-xs text-white/40">
                    {context.length}/500
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {context.length > 0 && (
                  <button
                    onClick={clearContext}
                    className="text-white/40 hover:text-white/60 transition-colors"
                    title="Очистить контекст"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => setIsContextExpanded(!isContextExpanded)}
                  className="text-white/40 hover:text-white/60 transition-colors"
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
                className="w-full px-2.5 py-1.5 bg-transparent rounded-md border border-white/[0.08] text-white placeholder-white/40 focus:outline-none focus:border-white/20 transition-all duration-200 resize-none text-xs"
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
                <div className="mt-2 flex flex-wrap gap-1">
                  {[
                    'Frontend разработчик',
                    'Backend разработчик',
                    'Full-stack разработчик',
                    'DevOps инженер'
                  ].map((template) => (
                    <button
                      key={template}
                      onClick={() => updateContext(template)}
                      className="px-2 py-1 text-xs bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] rounded text-white/60 hover:text-white/80 transition-colors"
                    >
                      {template}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Чат с ассистентом */}
          <div className="border border-white/[0.08] rounded-lg backdrop-blur-sm bg-[#0A0A0A]/80 flex flex-col">
            <div className="flex items-center justify-between p-3 pb-2 border-b border-white/[0.05]">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-medium text-white">Диалог</h2>
                <div className="flex items-center space-x-1">
                  {session?.messages && session.messages.length > 0 && (
                    <span className="text-xs text-white/40">
                      {session.messages.length} сообщ.
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {session?.messages && session.messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    className="text-white/40 hover:text-white/60 transition-colors"
                    title="Очистить чат"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => setIsChatExpanded(!isChatExpanded)}
                  className="text-white/40 hover:text-white/60 transition-colors"
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
                className="space-y-3 p-3 overflow-y-auto custom-scrollbar" 
                style={{ maxHeight: isChatExpanded ? 'calc(100vh - 450px)' : 'calc(100vh - 600px)' }}
              >
                {session?.messages && session.messages.length === 0 && (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-white/20 mx-auto mb-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                    </svg>
                    <p className="text-white/40 text-sm">Начните диалог с ассистентом</p>
                    <p className="text-white/30 text-xs mt-1">Задайте вопрос или опишите ситуацию</p>
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
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-1">
                              {msg.role === 'user' ? (
                                <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                                  <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                                </svg>
                              )}
                              <span className="text-xs text-white/60 font-medium">
                                {msg.role === 'user' ? 'Вы' : 'Ассистент'}
                              </span>
                            </div>
                            <span className="text-xs text-white/40">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          
                          {/* Действия с сообщением */}
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => copyMessage(msg.content)}
                              className="text-white/30 hover:text-white/60 transition-colors"
                              title="Копировать"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <p className="text-white text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] p-3 rounded-lg border border-white/[0.08] bg-white/[0.01]">
                      <div className="flex items-center space-x-2">
                        <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                          <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                        </svg>
                        <span className="text-xs text-white/60">Ассистент печатает</span>
                        <div className="flex space-x-1">
                          <div className="w-1 h-1 bg-white/40 rounded-full animate-pulse"></div>
                          <div className="w-1 h-1 bg-white/40 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-1 h-1 bg-white/40 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Ввод сообщения */}
              <div className="p-3 border-t border-white/[0.05]">
                <div className="flex space-x-2 items-start">
                  <div className="flex-1 relative">
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyUp={handleKeyPress}
                      rows={1}
                      className="w-full px-3 py-2 bg-transparent rounded-lg border border-white/[0.08] text-white placeholder-white/40 focus:outline-none focus:border-white/20 transition-colors resize-none text-sm pr-10 h-10"
                      placeholder="Введите ваше сообщение..."
                      disabled={isLoading}
                      style={{ maxHeight: '120px' }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        if (target.scrollHeight > 40) {
                          target.style.height = 'auto';
                          target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                        } else {
                          target.style.height = '40px';
                        }
                      }}
                    />
                    <div className="absolute right-2 top-2 flex items-center space-x-1">
                      {getMessageStatusIcon()}
                    </div>
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={!message.trim() || isLoading}
                    className="px-4 py-2 bg-white/[0.08] hover:bg-white/[0.12] disabled:bg-white/[0.04] disabled:text-white/30 text-white rounded-lg transition-colors text-sm font-medium disabled:cursor-not-allowed flex items-center space-x-2 h-10 flex-shrink-0"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                    )}
                    <span className="hidden sm:inline">Отправить</span>
                  </button>
                </div>
                
                {/* Подсказка */}
                <div className="mt-2 text-xs text-white/30">
                  <kbd className="px-1 py-0.5 bg-white/[0.05] rounded text-white/40">Enter</kbd> для отправки, 
                  <kbd className="px-1 py-0.5 bg-white/[0.05] rounded text-white/40 ml-1">Shift+Enter</kbd> для новой строки
                </div>
              </div>
            </div>
          </div>

          {/* Навигация по чатам */}
          <div className="border border-white/[0.08] rounded-lg backdrop-blur-sm bg-[#0A0A0A]/80 mt-4">
            <div className="flex items-center justify-between p-3 pb-2 border-b border-white/[0.05]">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-medium text-white">Сохраненные чаты</h2>
                <span className="text-xs text-white/40">
                  {chatSessions.length}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={createNewChat}
                  className="text-white/40 hover:text-white/60 transition-colors"
                  title="Новый чат"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={() => setIsNavExpanded(!isNavExpanded)}
                  className="text-white/40 hover:text-white/60 transition-colors"
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
              <div className="p-3 space-y-2">
                {chatSessions.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-white/40 text-sm">Нет сохраненных чатов</p>
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
                        className="flex-1 text-left"
                      >
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                          <div className="flex-1 min-w-0">
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
                                className="w-full px-1 py-0.5 bg-transparent border border-white/20 rounded text-white text-xs focus:outline-none focus:border-white/40"
                                autoFocus
                              />
                            ) : (
                              <p className="text-white text-xs font-medium truncate">
                                {chatSummary.title}
                              </p>
                            )}
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-xs text-white/30">
                                {chatSummary.message_count} сообщ.
                              </span>
                              <span className="text-xs text-white/30">
                                {new Date(chatSummary.updated_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                      
                      {/* Действия с чатом */}
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditingChat(chatSummary.id, chatSummary.title)}
                          className="text-white/30 hover:text-white/60 transition-colors"
                          title="Переименовать"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                        {chatSessions.length > 1 && (
                          <button
                            onClick={() => deleteChat(chatSummary.id)}
                            className="text-white/30 hover:text-red-400 transition-colors"
                            title="Удалить"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
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