'use client';

import React from 'react';

interface HotkeysHeaderProps {
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

export default function HotkeysHeader({ saveStatus }: HotkeysHeaderProps) {
  return (
    <div className="relative mb-8">
      <div className="absolute inset-0 bg-gradient-to-r from-[#1CCDAA]/20 via-transparent to-blue-500/20 rounded-2xl blur-xl"></div>
      <div className="relative backdrop-blur-sm bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1CCDAA] to-blue-500 rounded-xl blur opacity-30 animate-pulse"></div>
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#1CCDAA] to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-white via-white to-[#1CCDAA] bg-clip-text text-transparent leading-tight">
                Горячие клавиши
              </h1>
              <p className="text-white/50 text-xs sm:text-sm mt-1 font-medium hidden sm:block">Управление быстрыми командами и записью</p>
            </div>
          </div>
          <div className="flex items-center justify-center sm:justify-end space-x-2 sm:space-x-3 overflow-x-auto">
            {saveStatus === 'saving' && (
              <div className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg whitespace-nowrap">
                <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-blue-400 text-xs sm:text-sm font-medium">Сохранение...</span>
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 bg-[#1CCDAA]/10 border border-[#1CCDAA]/20 rounded-lg animate-pulse whitespace-nowrap">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-[#1CCDAA]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-[#1CCDAA] text-xs sm:text-sm font-medium">Сохранено</span>
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg whitespace-nowrap">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-red-400 text-xs sm:text-sm font-medium">Ошибка</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 