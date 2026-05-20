'use client';

import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface AppSettings {
  language: string;
  auto_save: boolean;
  notifications: boolean;
  ai_model: string;
  api_key: string;
  max_tokens: number;
  temperature: number;
  system_prompt: string;
  is_authenticated: boolean;
  user_display_name: string;
}

interface SettingsProps {
  onClose: () => void;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

function CustomSelect({ value, onChange, options, placeholder, className = "" }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedOption = options.find(option => option.value === value);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-white focus:outline-none focus:border-white/20 transition-colors flex items-center justify-between"
      >
        <span className={selectedOption ? 'text-white' : 'text-white/40'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[#1A1A1A] border border-white/[0.08] rounded-lg shadow-lg max-h-60 overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left hover:bg-white/[0.05] transition-colors first:rounded-t-lg last:rounded-b-lg ${
                option.value === value ? 'bg-white/[0.08] text-white' : 'text-white/80'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Settings({ onClose }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings>({
    language: 'ru',
    auto_save: true,
    notifications: true,
    ai_model: 'gpt-3.5-turbo',
    api_key: '',
    max_tokens: 2000,
    temperature: 0.7,
    system_prompt: 'Ты - помощник для проведения собеседований. Помогай кандидатам и интервьюерам.',
    is_authenticated: false,
    user_display_name: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showApiKey, setShowApiKey] = useState(false);

  const aiModelOptions = [
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
    { value: 'claude-3-opus', label: 'Claude 3 Opus' },
  ];

  const languageOptions = [
    { value: 'ru', label: 'Русский' },
    { value: 'en', label: 'English' },
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await invoke<AppSettings>('get_settings');
      setSettings(prev => ({ ...prev, ...savedSettings }));
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      setIsLoading(true);
      setSaveStatus('saving');
      
      await invoke('save_settings', { settings });
      
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const resetSettings = async () => {
    try {
      await invoke('reset_settings');
      await loadSettings();
    } catch (error) {
      console.error('Error resetting settings:', error);
    }
  };

  const handleLogout = async () => {
    try {
      // Здесь будет вызов функции выхода
      await invoke('logout_user');
      setSettings(prev => ({ 
        ...prev, 
        is_authenticated: false, 
        user_display_name: '' 
      }));
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleLogin = async () => {
    try {
      // Открываем браузер для авторизации на внешнем сайте
      await invoke('open_auth_url');
    } catch (error) {
      console.error('Error opening auth URL:', error);
    }
  };

  const getSaveStatusIcon = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <div className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin"></div>
        );
      case 'saved':
        return (
          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-[#0A0A0A] overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto w-full">
          {/* Заголовок */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="p-2 text-white/60 hover:text-white/80 hover:bg-white/[0.05] rounded-lg transition-colors"
                title="Назад"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
              <h1 className="text-2xl font-semibold text-white">Настройки</h1>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={resetSettings}
                className="px-4 py-2 text-white/60 hover:text-white/80 hover:bg-white/[0.05] border border-white/[0.08] rounded-lg transition-colors text-sm"
              >
                Сбросить
              </button>
              <button
                onClick={saveSettings}
                disabled={isLoading}
                className="px-4 py-2 bg-white/[0.08] hover:bg-white/[0.12] disabled:bg-white/[0.04] disabled:text-white/30 text-white rounded-lg transition-colors text-sm font-medium disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {getSaveStatusIcon()}
                <span>Сохранить</span>
              </button>
            </div>
          </div>

          {/* Основные настройки */}
          <div className="space-y-6">
            {/* Статус авторизации */}
            <div className="border border-white/[0.08] rounded-lg p-6 bg-white/[0.02]">
              <h2 className="text-lg font-semibold text-white mb-4">Авторизация</h2>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${settings.is_authenticated ? 'bg-green-400' : 'bg-red-400'}`}></div>
                  <div>
                    <p className="text-white/80 font-medium">
                      {settings.is_authenticated ? 'Авторизован' : 'Не авторизован'}
                    </p>
                    {settings.is_authenticated && settings.user_display_name && (
                      <p className="text-sm text-white/60">
                        {settings.user_display_name}
                      </p>
                    )}
                  </div>
                </div>
                
                {settings.is_authenticated ? (
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 border border-red-600/30 rounded-lg transition-colors text-sm font-medium"
                  >
                    Выйти
                  </button>
                ) : (
                  <button
                    onClick={handleLogin}
                    className="px-4 py-2 bg-[#1CCDAA]/20 hover:bg-[#1CCDAA]/30 text-[#1CCDAA] hover:text-[#1CCDAA]/80 border border-[#1CCDAA]/30 rounded-lg transition-colors text-sm font-medium"
                  >
                    Войти
                  </button>
                )}
              </div>
              
              {!settings.is_authenticated && (
                <p className="text-xs text-white/60 mt-3">
                  Авторизация происходит на внешнем сайте. Нажмите &quot;Войти&quot; для перехода.
                </p>
              )}
            </div>

            {/* Поведение приложения */}
            <div className="border border-white/[0.08] rounded-lg p-6 bg-white/[0.02]">
              <h2 className="text-lg font-semibold text-white mb-4">Поведение приложения</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Язык интерфейса
                  </label>
                  <CustomSelect
                    value={settings.language}
                    onChange={(value) => setSettings(prev => ({ ...prev, language: value }))}
                    options={languageOptions}
                    placeholder="Выберите язык"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-white/80">
                        Автосохранение
                      </label>
                      <p className="text-xs text-white/60">
                        Автоматически сохранять изменения
                      </p>
                    </div>
                    <button
                      onClick={() => setSettings(prev => ({ ...prev, auto_save: !prev.auto_save }))}
                      className={`ui-switch relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ease-in-out ${
                        settings.auto_save ? 'bg-[#1CCDAA]' : 'bg-white/[0.2]'
                      }`}
                    >
                      <span
                        className={`ui-switch__thumb inline-block h-4 w-4 transform rounded-full bg-white transition-all duration-300 ease-in-out shadow-sm ${
                          settings.auto_save ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-white/80">
                        Уведомления
                      </label>
                      <p className="text-xs text-white/60">
                        Показывать системные уведомления
                      </p>
                    </div>
                    <button
                      onClick={() => setSettings(prev => ({ ...prev, notifications: !prev.notifications }))}
                      className={`ui-switch relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ease-in-out ${
                        settings.notifications ? 'bg-[#1CCDAA]' : 'bg-white/[0.2]'
                      }`}
                    >
                      <span
                        className={`ui-switch__thumb inline-block h-4 w-4 transform rounded-full bg-white transition-all duration-300 ease-in-out shadow-sm ${
                          settings.notifications ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Настройки ИИ */}
            <div className="border border-white/[0.08] rounded-lg p-6 bg-white/[0.02]">
              <h2 className="text-lg font-semibold text-white mb-4">Настройки ИИ</h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Модель ИИ
                    </label>
                    <CustomSelect
                      value={settings.ai_model}
                      onChange={(value) => setSettings(prev => ({ ...prev, ai_model: value }))}
                      options={aiModelOptions}
                      placeholder="Выберите модель"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      API ключ
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={settings.api_key}
                        onChange={(e) => setSettings(prev => ({ ...prev, api_key: e.target.value }))}
                        className="w-full px-3 py-2 pr-10 bg-white/[0.05] border border-white/[0.08] rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/20 transition-colors"
                        placeholder="sk-..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/60 hover:text-white/80"
                      >
                        {showApiKey ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-white/60 mt-1">
                      Получите API ключ на openai.com или anthropic.com
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Максимальное количество токенов: {settings.max_tokens}
                  </label>
                  <input
                    type="range"
                    min="500"
                    max="8000"
                    step="100"
                    value={settings.max_tokens}
                    onChange={(e) => setSettings(prev => ({ ...prev, max_tokens: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-white/[0.1] rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-white/60 mt-1">
                    <span>500</span>
                    <span>8000</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Температура: {settings.temperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.temperature}
                    onChange={(e) => setSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-white/[0.1] rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-white/60 mt-1">
                    <span>0.0 (точный)</span>
                    <span>2.0 (очень творческий)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Системный промпт
                  </label>
                  <textarea
                    value={settings.system_prompt}
                    onChange={(e) => setSettings(prev => ({ ...prev, system_prompt: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/20 transition-colors resize-none"
                    placeholder="Введите системный промпт для ИИ..."
                  />
                  <p className="text-xs text-white/60 mt-1">
                    Определяет поведение и роль ИИ-ассистента
                  </p>
                </div>
              </div>
            </div>

            {/* Информация о приложении */}
            <div className="border border-white/[0.08] rounded-lg p-6 bg-white/[0.02]">
              <h2 className="text-lg font-semibold text-white mb-4">О приложении</h2>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/80">Версия</span>
                  <span className="text-white/60">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/80">Платформа</span>
                  <span className="text-white/60">Tauri + Next.js</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/80">Последнее обновление</span>
                  <span className="text-white/60">Сегодня</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/80">Разработчик</span>
                  <span className="text-white/60">Interview Assistant</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #1CCDAA;
          cursor: pointer;
          border: 2px solid #169e83;
        }
        
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #1CCDAA;
          cursor: pointer;
          border: 2px solid #169e83;
        }
      `}</style>
    </div>
  );
}