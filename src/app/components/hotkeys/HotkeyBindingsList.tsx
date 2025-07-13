'use client';

import React from 'react';
import { HotkeyBinding, actionTypes } from './types';

interface HotkeyBindingsListProps {
  bindings: HotkeyBinding[];
  onToggleBinding: (bindingId: string) => void;
  onDeleteBinding: (bindingId: string) => void;
  onEditBinding: (binding: HotkeyBinding) => void;
  onTestHotkey: (keyCombination: string) => void;
  onAddBinding: () => void;
}

export default function HotkeyBindingsList({
  bindings,
  onToggleBinding,
  onDeleteBinding,
  onEditBinding,
  onTestHotkey,
  onAddBinding
}: HotkeyBindingsListProps) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1CCDAA]/5 via-transparent to-blue-500/5 rounded-2xl blur-xl"></div>
      <div className="relative backdrop-blur-sm bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 mb-4 sm:mb-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-1 leading-tight">Привязки клавиш</h2>
            <p className="text-white/50 text-xs sm:text-sm hidden sm:block">Управляйте горячими клавишами для быстрых действий</p>
          </div>
          <button
            onClick={onAddBinding}
            className="group relative inline-flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 lg:py-3 bg-gradient-to-r from-[#1CCDAA] to-blue-500 hover:from-[#18B894] hover:to-blue-600 text-white font-semibold rounded-lg sm:rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-[#1CCDAA]/25 text-xs sm:text-sm lg:text-base whitespace-nowrap"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:rotate-90" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            <span className="hidden xs:inline">Добавить привязку</span>
            <span className="xs:hidden">Добавить</span>
          </button>
        </div>
        
        <div className="space-y-2 sm:space-y-3">
          {bindings.length === 0 ? (
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1CCDAA]/5 via-transparent to-blue-500/5 rounded-2xl"></div>
              <div className="relative text-center py-8 sm:py-12 lg:py-16 px-4 sm:px-6 lg:px-8">
                <div className="relative mb-4 sm:mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1CCDAA]/20 to-blue-500/20 rounded-full blur-xl"></div>
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-gradient-to-br from-[#1CCDAA]/10 to-blue-500/10 rounded-full flex items-center justify-center border border-white/[0.08]">
                    <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Создайте свою первую привязку</h3>
                <p className="text-white/50 max-w-sm sm:max-w-md mx-auto leading-relaxed text-sm sm:text-base">
                  Настройте горячие клавиши для быстрого доступа к записи аудио, 
                  скрытию окна и другим полезным функциям
                </p>
                <button
                  onClick={onAddBinding}
                  className="mt-4 sm:mt-6 inline-flex items-center space-x-1 sm:space-x-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-[#1CCDAA] to-blue-500 hover:from-[#18B894] hover:to-blue-600 text-white font-semibold rounded-lg sm:rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg text-sm sm:text-base"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  <span>Добавить первую привязку</span>
                </button>
              </div>
            </div>
          ) : (
            bindings.map((binding) => (
              <div key={binding.id} className="border border-white/[0.08] rounded-lg sm:rounded-xl bg-white/[0.02] overflow-hidden hover:bg-white/[0.03] transition-colors">
                <div className="p-3 sm:p-4 lg:p-6">
                  <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-3 mb-3">
                        <h3 className="text-white font-semibold text-base sm:text-lg leading-tight">{binding.name}</h3>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => onToggleBinding(binding.id)}
                            className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-colors ${
                              binding.is_enabled ? 'bg-[#1CCDAA]' : 'bg-white/[0.1]'
                            }`}
                            title={binding.is_enabled ? 'Отключить' : 'Включить'}
                          >
                            <span
                              className={`inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white transition-transform ${
                                binding.is_enabled ? 'translate-x-5 sm:translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                          <span className={`text-xs px-2 py-0.5 sm:py-1 rounded-full whitespace-nowrap ${
                            binding.is_enabled 
                              ? 'bg-[#1CCDAA]/20 text-[#1CCDAA]' 
                              : 'bg-white/[0.05] text-white/40'
                          }`}>
                            {binding.is_enabled ? 'Активна' : 'Отключена'}
                          </span>
                        </div>
                      </div>
                      
                      {binding.description && (
                        <p className="text-white/60 text-xs sm:text-sm mb-3 sm:mb-4 leading-relaxed">{binding.description}</p>
                      )}
                      
                      <div className="flex flex-col space-y-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:space-y-0">
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <span className="text-white/40 text-xs uppercase tracking-wider font-medium">Комбинация:</span>
                          <kbd className="px-2 sm:px-3 py-1 sm:py-1.5 bg-white/[0.08] border border-white/[0.12] rounded text-white text-xs sm:text-sm font-mono shadow-sm">
                            {binding.key_combination}
                          </kbd>
                        </div>
                        
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <span className="text-white/40 text-xs uppercase tracking-wider font-medium">Действие:</span>
                          <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-blue-600/15 border border-blue-600/25 text-blue-400 text-xs rounded font-medium">
                            {actionTypes.find(a => a.value === binding.action_type)?.label || binding.action_type}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-1 sm:space-x-2 text-white/30">
                          <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs">
                            Создано {new Date(binding.created_at).toLocaleDateString('ru-RU', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-white/[0.05] px-3 sm:px-4 lg:px-6 py-3 sm:py-4 bg-white/[0.01]">
                  <div className="flex items-center justify-between space-x-2">
                    <button
                      onClick={() => onTestHotkey(binding.key_combination)}
                      className="inline-flex items-center justify-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1.5 sm:py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-600/20 hover:border-blue-600/30 text-blue-400 text-xs sm:text-sm rounded transition-all hover:scale-105 min-w-0"
                      title="Протестировать комбинацию клавиш"
                    >
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                      </svg>
                      <span>Тест</span>
                    </button>
                    
                    <div className="flex items-center justify-center space-x-1 sm:space-x-2">
                      <button
                        onClick={() => onEditBinding(binding)}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1.5 sm:py-2 bg-yellow-600/10 hover:bg-yellow-600/20 border border-yellow-600/20 hover:border-yellow-600/30 text-yellow-400 text-xs sm:text-sm rounded transition-all hover:scale-105 min-w-0"
                        title="Редактировать привязку"
                      >
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        <span className="hidden sm:inline">Изменить</span>
                        <span className="sm:hidden">Изм.</span>
                      </button>
                      
                      <button
                        onClick={() => onDeleteBinding(binding.id)}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1.5 sm:py-2 bg-red-600/10 hover:bg-red-600/20 border border-red-600/20 hover:border-red-600/30 text-red-400 text-xs sm:text-sm rounded transition-all hover:scale-105 min-w-0"
                        title="Удалить привязку"
                      >
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="hidden sm:inline">Удалить</span>
                        <span className="sm:hidden">Удал.</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 