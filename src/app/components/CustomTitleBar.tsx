'use client';

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface CustomTitleBarProps {
  isSidebarCollapsed?: boolean;
}

export default function CustomTitleBar({ isSidebarCollapsed = false }: CustomTitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    checkMaximizedState();
  }, []);

  const checkMaximizedState = async () => {
    try {
      const maximized = await invoke('is_maximized') as boolean;
      setIsMaximized(maximized);
    } catch (error) {
      console.error('Error checking window state:', error);
    }
  };

  const handleClose = async () => {
    try {
      await invoke('close_window');
    } catch (error) {
      console.error('Error closing window:', error);
    }
  };

  const handleMinimize = async () => {
    try {
      await invoke('minimize_window');
    } catch (error) {
      console.error('Error minimizing window:', error);
    }
  };

  const handleMaximize = async () => {
    try {
      if (isMaximized) {
        await invoke('unmaximize_window');
      } else {
        await invoke('maximize_window');
      }
      setIsMaximized(!isMaximized);
    } catch (error) {
      console.error('Error toggling maximize:', error);
    }
  };

  // Обработчики событий мыши для заголовка
  const handleTitleBarMouseMove = async () => {
    try {
      await invoke('handle_window_message', { messageType: 'titlebar_mousemove' });
    } catch (error) {
      console.error('Error handling titlebar mouse move:', error);
    }
  };

  const handleTitleBarMouseEnter = async () => {
    try {
      await invoke('handle_window_message', { messageType: 'titlebar_mouseenter' });
    } catch (error) {
      console.error('Error handling titlebar mouse enter:', error);
    }
  };

  return (
    <div 
      className="fixed top-0 left-0 right-0 h-12 z-50 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      onMouseMove={handleTitleBarMouseMove}
      onMouseEnter={handleTitleBarMouseEnter}
    >
      {/* Главный контейнер в стиле Vercel */}
      <div className="relative h-full bg-black/95 backdrop-blur-md">
        {/* Нижняя граница с пропуском слева для сайдбара */}
        <div className={`absolute bottom-0 transition-all duration-300 h-[1px] bg-white/10 ${
          isSidebarCollapsed ? 'left-16' : 'left-64'
        } right-0`}></div>
        
        {/* Тонкий акцентный градиент сверху */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
        
        {/* Основной контент */}
        <div 
          className="relative h-full flex items-center justify-between pl-4"
          onMouseMove={handleTitleBarMouseMove}
          onMouseEnter={handleTitleBarMouseEnter}
        >
          {/* Левая часть - Логотип и название */}
          <div className="flex items-center space-x-3">
            {/* Vercel-style логотип */}
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 bg-white rounded-sm flex items-center justify-center">
                <div className="w-2 h-2 bg-black rounded-full"></div>
              </div>
              <span className="text-white text-sm font-medium tracking-tight">
              Interview Assistant
              </span>
            </div>
          </div>

          {/* Центральная часть - Навигация (опционально) */}
          <div className="hidden md:flex items-center space-x-1">
            <div className="px-2 py-1 text-xs text-gray-400 font-mono bg-gray-800/50 rounded border border-gray-700/50">
              localhost:3000
            </div>
          </div>

          {/* Правая часть - Кнопка профиля и кнопки управления */}
          <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            {/* Кнопка профиля */}
            <button
              className="flex items-center space-x-2 px-3 py-1 mr-2 rounded-md hover:bg-white/10 transition-colors duration-200 group"
              title="Профиль пользователя"
            >
              <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center group-hover:bg-gray-500 transition-colors">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-gray-400 text-xs font-medium group-hover:text-white transition-colors">
                Войти
              </span>
            </button>
            
            {/* Разделитель */}
            <div className="w-px h-4 bg-gray-700 mr-2"></div>
            
            {/* Кнопка свернуть */}
            <button
              onClick={handleMinimize}
              className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200"
              title="Minimize"
            >
              <svg 
                width="12" 
                height="12" 
                viewBox="0 0 12 12" 
                fill="none" 
                className="transform scale-100 hover:scale-105 transition-transform duration-200"
              >
                <path 
                  d="M2.5 6h7"
                  stroke="currentColor" 
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  className="transform origin-center"
                />
              </svg>
            </button>

            {/* Кнопка развернуть/восстановить */}
            <button
              onClick={handleMaximize}
              className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? (
                <svg 
                  width="12" 
                  height="12" 
                  viewBox="0 0 12 12" 
                  fill="none"
                  className="transform scale-100 hover:scale-105 transition-transform duration-200"
                >
                  <path 
                    d="M4.5 2.5h5v5h-5v-5zM2.5 4.5v5h5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinejoin="round"
                    className="transform origin-center"
                  />
                </svg>
              ) : (
                <svg 
                  width="12" 
                  height="12" 
                  viewBox="0 0 12 12" 
                  fill="none"
                  className="transform scale-100 hover:scale-105 transition-transform duration-200"
                >
                  <rect 
                    x="2.5" 
                    y="2.5" 
                    width="7" 
                    height="7"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    className="transform origin-center"
                  />
                </svg>
              )}
            </button>

            {/* Кнопка закрыть */}
            <button
              onClick={handleClose}
              className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-500/90 transition-all duration-200"
              title="Close"
            >
              <svg 
                width="12" 
                height="12" 
                viewBox="0 0 12 12" 
                fill="none"
                className="transform scale-100 hover:scale-105 transition-transform duration-200"
              >
                <path 
                  d="M3.5 3.5l5 5M8.5 3.5l-5 5"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  className="transform origin-center"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 