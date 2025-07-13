'use client';

import React from 'react';
import { HotkeySettings, audioQualities } from './types';
import CustomSelect from './CustomSelect';

interface MainSettingsProps {
  settings: HotkeySettings;
  onGlobalToggle: (enabled: boolean) => void;
  onSettingChange: (key: keyof HotkeySettings, value: string | boolean | number) => void;
}

export default function MainSettings({ settings, onGlobalToggle, onSettingChange }: MainSettingsProps) {
  return (
    <div className="relative mb-8">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1CCDAA]/5 via-transparent to-blue-500/5 rounded-2xl blur-xl"></div>
      <div className="relative backdrop-blur-sm bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3 sm:p-4 lg:p-6">
        <div className="flex items-center space-x-2 sm:space-x-3 mb-4 sm:mb-6">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#1CCDAA] to-blue-500 rounded-lg sm:rounded-xl flex items-center justify-center">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white leading-tight">Основные настройки</h2>
            <p className="text-white/50 text-xs sm:text-sm hidden sm:block">Конфигурация записи и горячих клавиш</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
          <div className="group relative overflow-hidden rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/[0.08] p-3 sm:p-4 hover:border-white/[0.15] transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1CCDAA]/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#1CCDAA]/20 to-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#1CCDAA]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <label className="text-white font-semibold text-sm sm:text-base leading-tight block">Глобальные горячие клавиши</label>
                  <p className="text-white/50 text-xs sm:text-sm hidden sm:block">Работают во всех приложениях</p>
                </div>
              </div>
              <button
                onClick={() => onGlobalToggle(!settings.global_enabled)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 transform hover:scale-105 ${
                  settings.global_enabled 
                    ? 'bg-gradient-to-r from-[#1CCDAA] to-blue-500 shadow-lg shadow-[#1CCDAA]/25' 
                    : 'bg-white/[0.15] hover:bg-white/[0.2]'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-lg ${
                    settings.global_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/[0.08] p-3 sm:p-4 hover:border-white/[0.15] transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-red-500/20 to-pink-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <label className="text-white font-semibold text-sm sm:text-base leading-tight block">Запись системного звука</label>
                  <p className="text-white/50 text-xs sm:text-sm hidden sm:block">Захват аудио из приложений</p>
                </div>
              </div>
              <button
                onClick={() => onSettingChange('record_system_audio', !settings.record_system_audio)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 transform hover:scale-105 ${
                  settings.record_system_audio 
                    ? 'bg-gradient-to-r from-red-500 to-pink-500 shadow-lg shadow-red-500/25' 
                    : 'bg-white/[0.15] hover:bg-white/[0.2]'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-lg ${
                    settings.record_system_audio ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/[0.08] p-3 sm:p-4 hover:border-white/[0.15] transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <label className="text-white font-semibold text-sm sm:text-base leading-tight block">Запись микрофона</label>
                  <p className="text-white/50 text-xs sm:text-sm hidden sm:block">Захват аудио с микрофона</p>
                </div>
              </div>
              <button
                onClick={() => onSettingChange('record_microphone', !settings.record_microphone)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 transform hover:scale-105 ${
                  settings.record_microphone 
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/25' 
                    : 'bg-white/[0.15] hover:bg-white/[0.2]'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-lg ${
                    settings.record_microphone ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/[0.08] p-3 sm:p-4 hover:border-white/[0.15] transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <label className="text-white font-semibold text-sm sm:text-base leading-tight block">Автосохранение записей</label>
                  <p className="text-white/50 text-xs sm:text-sm hidden sm:block">Сохранять файлы автоматически</p>
                </div>
              </div>
              <button
                onClick={() => onSettingChange('auto_save_recordings', !settings.auto_save_recordings)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 transform hover:scale-105 ${
                  settings.auto_save_recordings 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg shadow-green-500/25' 
                    : 'bg-white/[0.15] hover:bg-white/[0.2]'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-lg ${
                    settings.auto_save_recordings ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 mt-4 sm:mt-6">
          <div className="group">
            <label className="block text-white/70 text-xs sm:text-sm font-semibold mb-2 sm:mb-3 group-focus-within:text-[#1CCDAA] transition-colors flex items-center space-x-1 sm:space-x-2">
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              <span>Папка для записей</span>
            </label>
            <input
              type="text"
              value={settings.recordings_folder}
              onChange={(e) => onSettingChange('recordings_folder', e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white/[0.05] border border-white/[0.12] rounded-lg sm:rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-[#1CCDAA]/50 focus:bg-white/[0.08] transition-all duration-200 hover:border-white/[0.2] text-sm sm:text-base"
              placeholder="/path/to/recordings"
            />
          </div>
          
          <div className="group">
            <label className="block text-white/70 text-xs sm:text-sm font-semibold mb-2 sm:mb-3 group-focus-within:text-[#1CCDAA] transition-colors flex items-center space-x-1 sm:space-x-2">
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              <span>Качество аудио</span>
            </label>
            <CustomSelect
              value={settings.audio_quality}
              onChange={(value) => onSettingChange('audio_quality', value)}
              options={audioQualities}
              placeholder="Выберите качество"
            />
          </div>
        </div>
      </div>
    </div>
  );
} 