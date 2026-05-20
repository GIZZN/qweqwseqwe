'use client';
import React from 'react';

interface HotkeysHeaderProps {
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

export default function HotkeysHeader({ saveStatus }: HotkeysHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-6">
      <div>
        <h1 className="font-bold text-[22px] text-white">Горячие клавиши</h1>
        <p className="mt-0.5 text-white/40 text-sm">Управление функциями приватности</p>
      </div>
      {saveStatus === 'saving' && (
        <div className="flex items-center gap-2 bg-white/[0.05] px-3 py-1.5 border border-white/[0.08] rounded-lg">
          <div className="border border-white/20 border-t-white/60 rounded-full w-3 h-3 animate-spin" />
          <span className="text-white/60 text-xs">Сохранение...</span>
        </div>
      )}
      {saveStatus === 'saved' && (
        <div className="flex items-center gap-2 bg-[#1CCDAA]/10 px-3 py-1.5 border border-[#1CCDAA]/20 rounded-lg">
          <svg className="w-3 h-3 text-[#1CCDAA]" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span className="text-[#1CCDAA] text-xs">Сохранено</span>
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 border border-red-500/20 rounded-lg">
          <span className="text-red-400 text-xs">Ошибка</span>
        </div>
      )}
    </div>
  );
}
