'use client';

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface PrivacySettings {
  hide_from_taskbar: boolean;
  minimize_to_tray: boolean;
  start_minimized: boolean;
  require_password: boolean;
  auto_hide_timeout: number; // в минутах
  hide_when_inactive: boolean;
  hide_from_screen_sharing: boolean; // новая настройка
  standard_cursor: boolean; // новая настройка для стандартного курсора
}

interface PrivacyProps {
  onClose: () => void;
}

export default function Privacy({ onClose }: PrivacyProps) {
  const [settings, setSettings] = useState<PrivacySettings>({
    hide_from_taskbar: false,
    minimize_to_tray: false,
    start_minimized: false,
    require_password: false,
    auto_hide_timeout: 10,
    hide_when_inactive: false,
    hide_from_screen_sharing: false,
    standard_cursor: false, // новая настройка
  });

  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [protectionActive, setProtectionActive] = useState(false);
  const [taskbarHidden, setTaskbarHidden] = useState(false);
  const [standardCursorActive, setStandardCursorActive] = useState(false);

  useEffect(() => {
    loadSettings();
    checkStandardCursorStatus();
  }, []);

  const loadSettings = async () => {
    try {
      // Загружаем настройки приватности из бэкенда
      const savedSettings = await invoke<PrivacySettings>('get_privacy_settings');
      setSettings(prev => ({ ...prev, ...savedSettings }));
      setProtectionActive(savedSettings.hide_from_screen_sharing || false);
      setTaskbarHidden(savedSettings.hide_from_taskbar || false);
      
      // Check if standard cursor is enabled
      const isStandardCursor = await invoke<boolean>('is_standard_cursor_enabled');
      setStandardCursorActive(isStandardCursor);
      setSettings(prev => ({ ...prev, standard_cursor: isStandardCursor }));
    } catch (error) {
      console.error('Error loading privacy settings:', error);
    }
  };

  const checkStandardCursorStatus = async () => {
    try {
      const isStandardCursor = await invoke<boolean>('is_standard_cursor_enabled');
      setStandardCursorActive(isStandardCursor);
    } catch (error) {
      console.error('Error checking standard cursor status:', error);
    }
  };

  const saveSettings = async () => {
    try {
      setIsLoading(true);
      setSaveStatus('saving');
      
      await invoke('save_privacy_settings', { settings });
      
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error saving privacy settings:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (key: keyof PrivacySettings, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));

    // Немедленно применяем изменения для некоторых настроек
    if (key === 'hide_from_taskbar') {
      try {
        if (value) {
          await invoke('hide_from_taskbar');
        } else {
          await invoke('show_in_taskbar');
        }
        setTaskbarHidden(value);
      } catch (error) {
        console.error('Error toggling taskbar visibility:', error);
      }
    } else if (key === 'hide_from_screen_sharing') {
      try {
        await invoke('set_protection_mode', { enabled: value });
        setProtectionActive(value);
        console.log(`Защита от демонстрации экрана ${value ? 'включена' : 'отключена'}`);
      } catch (error) {
        console.error('Error toggling screen sharing protection:', error);
      }
    } else if (key === 'standard_cursor') {
      try {
        await invoke('set_standard_cursor', { enabled: value });
        setStandardCursorActive(value);
        console.log(`Стандартный курсор ${value ? 'включен' : 'отключен'}`);
      } catch (error) {
        console.error('Error toggling standard cursor:', error);
      }
    }
  };

  const handleTimeoutChange = (value: number) => {
    setSettings(prev => ({
      ...prev,
      auto_hide_timeout: value
    }));
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
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 sm:p-6">
          <div className="max-w-6xl mx-auto w-full">
            {/* Заголовок */}
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                <button
                  onClick={onClose}
                  className="p-1.5 sm:p-2 text-white/60 hover:text-white/80 hover:bg-white/[0.05] rounded-lg transition-colors flex-shrink-0"
                  title="Назад"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <h1 className="text-lg sm:text-2xl font-semibold text-white truncate">Настройки скрытности</h1>
                <div className="flex items-center space-x-2">
                  {protectionActive && (
                    <span className="hidden xs:flex px-2 py-1 bg-red-600/20 border border-red-600/30 text-red-300 text-xs rounded-full items-center flex-shrink-0">
                      <div className="w-2 h-2 bg-red-400 rounded-full mr-1 animate-pulse"></div>
                      Защита активна
                    </span>
                  )}
                  {taskbarHidden && (
                    <span className="hidden xs:flex px-2 py-1 bg-green-600/20 border border-green-600/30 text-green-300 text-xs rounded-full items-center flex-shrink-0">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></div>
                      Скрыто из панели
                    </span>
                  )}
                  {standardCursorActive && (
                    <span className="hidden xs:flex px-2 py-1 bg-blue-600/20 border border-blue-600/30 text-blue-300 text-xs rounded-full items-center flex-shrink-0">
                      <div className="w-2 h-2 bg-blue-400 rounded-full mr-1 animate-pulse"></div>
                      Стандартный курсор
                    </span>
                  )}
                </div>
              </div>
              {/* Мобильные индикаторы */}
              <div className="xs:hidden flex items-center space-x-2">
                {protectionActive && (
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse flex-shrink-0"></div>
                )}
                {taskbarHidden && (
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0"></div>
                )}
                {standardCursorActive && (
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse flex-shrink-0"></div>
                )}
              </div>
            </div>

            <div className="space-y-4 sm:space-y-6">
              {/* Основные настройки скрытности */}
              <div className="border border-white/[0.08] rounded-lg p-3 sm:p-6 bg-white/[0.02]">
                <h2 className="text-base sm:text-lg font-medium text-white mb-3 sm:mb-4 flex items-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 text-white/80 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <span className="truncate">Основные настройки</span>
                </h2>

                <div className="space-y-4 sm:space-y-6">

                  {/* Стандартный курсор */}
                  <div className="flex flex-col xs:flex-row xs:items-start xs:justify-between gap-3 xs:gap-0">
                    <div className="flex-1 xs:pr-4">
                      <h3 className="font-medium text-white mb-1 text-sm sm:text-base">Стандартный курсор</h3>
                      <p className="text-xs sm:text-sm text-white/60">
                        Курсор всегда будет отображаться как стандартная стрелка, даже при изменении размера окна.
                        <br />
                        <span className="text-white/40 text-xs">
                          Функциональность ресайза окна сохраняется, но без визуальной индикации
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggle('standard_cursor', !settings.standard_cursor)}
                      className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-all duration-300 ease-in-out flex-shrink-0 ${
                        settings.standard_cursor ? 'bg-[#1CCDAA]' : 'bg-white/20'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white transition-all duration-300 ease-in-out ${
                          settings.standard_cursor ? 'translate-x-5 sm:translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Скрытие при демонстрации экрана */}
                  <div className="flex flex-col xs:flex-row xs:items-start xs:justify-between gap-3 xs:gap-0">
                    <div className="flex-1 xs:pr-4">
                      <h3 className="font-medium text-white mb-1 text-sm sm:text-base">Скрывать при демонстрации экрана</h3>
                      <p className="text-xs sm:text-sm text-white/60">
                        Приложение не будет видно наблюдателям при трансляции экрана.<br />
                        <span className="text-white/40 text-xs">
                            При включении: приложение исчезнет из всех записей экрана и стримов
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggle('hide_from_screen_sharing', !settings.hide_from_screen_sharing)}
                      className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-all duration-300 ease-in-out flex-shrink-0 ${
                        settings.hide_from_screen_sharing ? 'bg-[#1CCDAA]' : 'bg-white/20'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white transition-all duration-300 ease-in-out ${
                          settings.hide_from_screen_sharing ? 'translate-x-5 sm:translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Скрывать из панели задач */}
                  <div className="flex flex-col xs:flex-row xs:items-start xs:justify-between gap-3 xs:gap-0">
                    <div className="flex-1 xs:pr-4">
                      <h3 className="font-medium text-white mb-1 text-sm sm:text-base">Скрывать из панели задач</h3>
                      <p className="text-xs sm:text-sm text-white/60">Приложение не будет отображаться в панели задач Windows</p>
                    </div>
                    <button
                      onClick={() => handleToggle('hide_from_taskbar', !settings.hide_from_taskbar)}
                      className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-all duration-300 ease-in-out flex-shrink-0 ${
                        settings.hide_from_taskbar ? 'bg-[#1CCDAA]' : 'bg-white/20'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white transition-all duration-300 ease-in-out ${
                          settings.hide_from_taskbar ? 'translate-x-5 sm:translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Сворачивание в трей */}
                  <div className="flex flex-col xs:flex-row xs:items-start xs:justify-between gap-3 xs:gap-0">
                    <div className="flex-1 xs:pr-4">
                      <h3 className="font-medium text-white mb-1 text-sm sm:text-base">Сворачивать в системный трей</h3>
                      <p className="text-xs sm:text-sm text-white/60">При закрытии окна приложение останется в трее</p>
                    </div>
                    <button
                      onClick={() => handleToggle('minimize_to_tray', !settings.minimize_to_tray)}
                      className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-all duration-300 ease-in-out flex-shrink-0 ${
                        settings.minimize_to_tray ? 'bg-[#1CCDAA]' : 'bg-white/20'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white transition-all duration-300 ease-in-out ${
                          settings.minimize_to_tray ? 'translate-x-5 sm:translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Запуск в свернутом виде */}
                  <div className="flex flex-col xs:flex-row xs:items-start xs:justify-between gap-3 xs:gap-0">
                    <div className="flex-1 xs:pr-4">
                      <h3 className="font-medium text-white mb-1 text-sm sm:text-base">Запускать в свернутом виде</h3>
                      <p className="text-xs sm:text-sm text-white/60">Приложение будет запускаться скрыто в системном трее</p>
                    </div>
                    <button
                      onClick={() => handleToggle('start_minimized', !settings.start_minimized)}
                      className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-all duration-300 ease-in-out flex-shrink-0 ${
                        settings.start_minimized ? 'bg-[#1CCDAA]' : 'bg-white/20'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white transition-all duration-300 ease-in-out ${
                          settings.start_minimized ? 'translate-x-5 sm:translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Автоматическое скрытие */}
              <div className="border border-white/[0.08] rounded-lg p-3 sm:p-6 bg-white/[0.02]">
                <h2 className="text-base sm:text-lg font-medium text-white mb-3 sm:mb-4 flex items-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 text-white/80 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <span className="truncate">Автоматическое скрытие</span>
                </h2>

                <div className="space-y-4 sm:space-y-6">
                  {/* Скрытие при неактивности */}
                  <div className="flex flex-col xs:flex-row xs:items-start xs:justify-between gap-3 xs:gap-0">
                    <div className="flex-1 xs:pr-4">
                      <h3 className="font-medium text-white mb-1 text-sm sm:text-base">Скрывать при неактивности</h3>
                      <p className="text-xs sm:text-sm text-white/60">Автоматически скрывать приложение после периода бездействия</p>
                    </div>
                    <button
                      onClick={() => handleToggle('hide_when_inactive', !settings.hide_when_inactive)}
                      className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-all duration-300 ease-in-out flex-shrink-0 ${
                        settings.hide_when_inactive ? 'bg-[#1CCDAA]' : 'bg-white/20'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white transition-all duration-300 ease-in-out ${
                          settings.hide_when_inactive ? 'translate-x-5 sm:translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Время ожидания */}
                  {settings.hide_when_inactive && (
                    <div className="pl-2 sm:pl-4 border-l-2 border-white/[0.08]">
                      <label className="block text-xs sm:text-sm font-medium text-white mb-2 sm:mb-3">
                        Время до скрытия: {settings.auto_hide_timeout} мин
                      </label>
                      <div className="flex items-center space-x-2 sm:space-x-4">
                        <span className="text-xs sm:text-sm text-white/60 w-4 sm:w-8 flex-shrink-0">1</span>
                        <input
                          type="range"
                          min="1"
                          max="60"
                          value={settings.auto_hide_timeout}
                          onChange={(e) => handleTimeoutChange(parseInt(e.target.value))}
                          className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
                          style={{
                            background: `linear-gradient(to right, #1CCDAA 0%, #1CCDAA ${(settings.auto_hide_timeout / 60) * 100}%, rgba(255,255,255,0.1) ${(settings.auto_hide_timeout / 60) * 100}%, rgba(255,255,255,0.1) 100%)`
                          }}
                        />
                        <span className="text-xs sm:text-sm text-white/60 w-4 sm:w-8 flex-shrink-0 text-right">60</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Безопасность */}
              <div className="border border-white/[0.08] rounded-lg p-3 sm:p-6 bg-white/[0.02]">
                <h2 className="text-base sm:text-lg font-medium text-white mb-3 sm:mb-4 flex items-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 text-white/80 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="truncate">Безопасность</span>
                </h2>

                <div className="space-y-4 sm:space-y-6">
                  {/* Требовать пароль */}
                  <div className="flex flex-col xs:flex-row xs:items-start xs:justify-between gap-3 xs:gap-0">
                    <div className="flex-1 xs:pr-4">
                      <h3 className="font-medium text-white mb-1 text-sm sm:text-base">Требовать пароль при показе</h3>
                      <p className="text-xs sm:text-sm text-white/60">Запрашивать пароль Windows при восстановлении приложения из скрытого состояния</p>
                    </div>
                    <button
                      onClick={() => handleToggle('require_password', !settings.require_password)}
                      className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-all duration-300 ease-in-out flex-shrink-0 ${
                        settings.require_password ? 'bg-[#1CCDAA]' : 'bg-white/20'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white transition-all duration-300 ease-in-out ${
                          settings.require_password ? 'translate-x-5 sm:translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Кнопки сохранения */}
              <div className="flex flex-col xs:flex-row justify-end gap-2 xs:gap-3 pt-2 sm:pt-4">
                <button
                  onClick={onClose}
                  className="px-3 py-2 sm:px-4 sm:py-2 text-white/60 hover:text-white/80 hover:bg-white/[0.05] border border-white/[0.08] rounded-lg transition-colors text-sm order-2 xs:order-1"
                >
                  Отмена
                </button>
                <button
                  onClick={saveSettings}
                  disabled={isLoading}
                  className="px-3 py-2 sm:px-4 sm:py-2 bg-[#1CCDAA] hover:bg-[#1CCDAA]/80 text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm order-1 xs:order-2"
                >
                  {getSaveStatusIcon()}
                  <span>
                    {saveStatus === 'saving' ? 'Сохранение...' : 
                     saveStatus === 'saved' ? 'Сохранено!' : 
                     saveStatus === 'error' ? 'Ошибка' : 'Сохранить'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 340px) {
          .xs\\:hidden {
            display: none !important;
          }
          .xs\\:flex {
            display: flex !important;
          }
          .xs\\:flex-row {
            flex-direction: row !important;
          }
          .xs\\:items-start {
            align-items: flex-start !important;
          }
          .xs\\:justify-between {
            justify-content: space-between !important;
          }
          .xs\\:gap-0 {
            gap: 0 !important;
          }
          .xs\\:pr-4 {
            padding-right: 1rem !important;
          }
          .xs\\:order-1 {
            order: 1 !important;
          }
          .xs\\:order-2 {
            order: 2 !important;
          }
        }

        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #1CCDAA;
          border: 2px solid #1CCDAA;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #1CCDAA;
          border: 2px solid #1CCDAA;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        @media (min-width: 640px) {
          .slider::-webkit-slider-thumb {
            height: 20px;
            width: 20px;
          }
          .slider::-moz-range-thumb {
            height: 20px;
            width: 20px;
          }
        }
      `}</style>
    </div>
  );
} 