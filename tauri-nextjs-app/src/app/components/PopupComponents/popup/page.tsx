'use client';

import React from 'react';
import PopupTitleBar from '../PopupTitleBar';

export default function PopupPage() {
  return (
    <div className="min-h-screen" style={{ background: 'transparent' }}>
      <style jsx global>{`
        body { background: transparent !important; }
        html { background: transparent !important; }
        #__next { background: transparent !important; }
      `}</style>
      <PopupTitleBar />
      {/* Основная прозрачная область окна */}
      <div className="relative w-full" style={{ height: 'calc(100vh - 32px)' }}>
        {/* Центр: большая кнопка скриншота */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            aria-label="Сделать снимок"
            className="group relative w-14 h-14 rounded-full border border-white/30 bg-white/5 hover:bg-white/10 transition-all duration-200 flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            onClick={() => console.log('capture-click')}
          >
            <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/15 group-hover:ring-white/25 transition-colors" />
            <span className="pointer-events-none absolute -inset-px rounded-full bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="relative block w-4 h-4 rounded-[6px] bg-gradient-to-br from-red-500 to-red-600 shadow-[0_6px_18px_rgba(239,68,68,0.55)] group-active:scale-95 transition-transform" />
          </button>
          <span className="text-white/75 text-[11px] leading-none">Снимок</span>
        </div>

        {/* Низ: панель быстрых действий */}
        <div
          className="absolute left-0 right-0 bottom-3 flex items-center justify-between px-4"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <div className="flex items-center gap-3">
            <button
              aria-label="Переключить камеру"
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 transition-colors flex items-center justify-center"
              onClick={() => console.log('switch-camera')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white/80">
                <path d="M4 7h8l2-2h6v12h-6l-2-2H4z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M6 12h6" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </button>
            <button
              aria-label="Таймер"
              className="px-3 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 text-xs transition-colors"
              onClick={() => console.log('timer')}
            >
              Таймер 3с
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              aria-label="Открыть папку"
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 transition-colors flex items-center justify-center"
              onClick={() => console.log('open-folder')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white/80">
                <path d="M3 7h6l2 2h10v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </button>
            <button
              aria-label="Настройки"
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 transition-colors flex items-center justify-center"
              onClick={() => console.log('settings')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white/80">
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M19.4 15a7.97 7.97 0 0 0 .1-2 7.97 7.97 0 0 0-.1-2l2-1.5-2-3.5-2.4 1a8.23 8.23 0 0 0-3.4-2l-.4-2.5h-4l-.4 2.5a8.23 8.23 0 0 0-3.4 2l-2.4-1-2 3.5 2 1.5a7.97 7.97 0 0 0-.1 2 7.97 7.97 0 0 0 .1 2l-2 1.5 2 3.5 2.4-1a8.23 8.23 0 0 0 3.4 2l.4 2.5h4l.4-2.5a8.23 8.23 0 0 0 3.4-2l2.4 1 2-3.5Z" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


