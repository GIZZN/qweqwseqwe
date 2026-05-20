'use client';

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import clsx from 'clsx';

interface CustomTitleBarProps {
  isSidebarCollapsed?: boolean;
  onNavigate?: (page: string) => void;
}

export default function CustomTitleBar({ isSidebarCollapsed = false, onNavigate }: CustomTitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [recentAction, setRecentAction] = useState<string | null>(null);
  const [activeIndicators, setActiveIndicators] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<{name: string; avatar?: string} | null>(null);

  useEffect(() => {
    const load = () => {
      try {
        const saved = localStorage.getItem('user_profile');
        setUserProfile(saved ? JSON.parse(saved) : null);
      } catch {}
    };
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    checkMaximizedState();
    const unlistenPromise = listen<string>('privacy_hotkey_triggered', (event) => {
      setRecentAction(event.payload);
      refreshIndicators();
      setTimeout(() => setRecentAction((prev) => (prev === event.payload ? null : prev)), 2000);
    });
    refreshIndicators();
    const poll = setInterval(refreshIndicators, 3000);
    return () => {
      unlistenPromise.then((un) => un());
      clearInterval(poll);
    };
  }, []);

  const refreshIndicators = async () => {
    try {
      const list = await invoke<string[]>('get_privacy_indicators');
      setActiveIndicators(list);
    } catch {}
  };

  const checkMaximizedState = async () => {
    try {
      const maximized = (await invoke('is_maximized')) as boolean;
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

  // Индикация последнего срабатывания
  const indicatorMap: Record<string, { color: string; title: string }> = {
    toggle_standard_cursor: { color: 'bg-green-500', title: 'Скрытый курсор' },
    toggle_always_on_top: { color: 'bg-yellow-400', title: 'Поверх всех окон' },
    toggle_screen_protection: { color: 'bg-red-500', title: 'Защита экрана' },
    toggle_taskbar_visibility: { color: 'bg-blue-500', title: 'Вид в панели задач' },
  };

  const last = recentAction && indicatorMap[recentAction];

  return (
    <div 
      className={clsx('top-0', 'right-0', 'left-0', 'z-50', 'fixed', 'h-12', 'select-none')}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      onMouseMove={handleTitleBarMouseMove}
      onMouseEnter={handleTitleBarMouseEnter}
    >
      {/* Главный контейнер в стиле Vercel */}
      <div className={clsx('relative', 'bg-black/95', 'backdrop-blur-md', 'h-full')}>
        {/* Нижняя граница с пропуском слева для сайдбара */}
        <div className={`absolute bottom-0 transition-all duration-300 h-[1px] bg-white/10 ${
          isSidebarCollapsed ? 'left-16' : 'left-64'
        } right-0`}></div>
        
        {/* Тонкий акцентный градиент сверху */}
        <div className={clsx('top-0', 'right-0', 'left-0', 'absolute', 'bg-gradient-to-r', 'from-transparent', 'via-white/10', 'to-transparent', 'h-px')}></div>
        
        {/* Основной контент */}
        <div 
          className={clsx('relative', 'flex', 'justify-between', 'items-center', 'pl-4', 'h-full')}
          onMouseMove={handleTitleBarMouseMove}
          onMouseEnter={handleTitleBarMouseEnter}
        >
          {/* Левая часть - Логотип и название */}
          <div className={clsx('flex', 'items-center', 'space-x-3')}>
            <div className={clsx('flex', 'items-center', 'space-x-2')}>
              <div className={clsx('flex', 'justify-center', 'items-center', 'bg-white', 'rounded-sm', 'w-5', 'h-5')}>
                <div className={clsx('bg-black', 'rounded-full', 'w-2', 'h-2')}></div>
              </div>
              <span className={clsx('font-medium', 'text-white', 'text-sm', 'tracking-tight')}>
              Interview Assistant
              </span>
            </div>
          </div>

          {/* Центральная часть - Индикация последнего нажатия */}
          <div className={clsx('flex', 'items-center', 'space-x-2')} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            {/* Постоянные индикаторы активных состояний (показываем только если есть активные) */}
            {activeIndicators.length > 0 && (
              <div className={clsx('flex', 'items-center', 'space-x-2', 'bg-white/5', 'px-2', 'py-1', 'border', 'border-white/10', 'rounded-full')}>
                {activeIndicators.map(key => (
                  <div key={key} className={`w-2.5 h-2.5 rounded-full ${indicatorMap[key]?.color || 'bg-gray-500'}`} title={`${indicatorMap[key]?.title || key} — включено`}></div>
                ))}
              </div>
            )}
            {/* Вспышка последнего */}
            {last && (
              <div className={clsx('flex', 'items-center', 'space-x-2', 'bg-white/5', 'px-2', 'py-1', 'border', 'border-white/10', 'rounded-full')}>
                <div className={`w-2.5 h-2.5 rounded-full ${last.color}`}></div>
                <span className={clsx('text-white/80', 'text-xs')}>{last.title}</span>
              </div>
            )}
          </div>

          {/* Правая часть - Кнопка профиля и кнопки управления */}
          <div className={clsx('flex', 'items-center')} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            {/* Кнопка профиля */}
            <button
              onClick={() => onNavigate?.('settings')}
              className={clsx('group', 'flex', 'items-center', 'mr-2', 'transition-colors', 'duration-200')}
              title="Профиль пользователя"
            >
              <div className={clsx('rounded-full', 'w-6', 'h-6', 'overflow-hidden', 'group-hover:ring-1', 'group-hover:ring-white/30', 'transition-all')}>
                {userProfile?.avatar ? (
                  <img src={userProfile.avatar} alt={userProfile.name} className={clsx('w-full', 'h-full', 'object-cover')} />
                ) : (
                  <div className={clsx('flex', 'justify-center', 'items-center', 'bg-gray-600', 'group-hover:bg-gray-500', 'w-full', 'h-full', 'transition-colors')}>
                    {userProfile?.name ? (
                      <span className={clsx('text-white', 'font-bold')} style={{fontSize:9}}>{userProfile.name.charAt(0).toUpperCase()}</span>
                    ) : (
                      <svg className={clsx('w-3', 'h-3', 'text-white')} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                )}
              </div>
            </button>
            
            {/* Разделитель */}
            <div className={clsx('bg-gray-700', 'mr-2', 'w-px', 'h-4')}></div>
            
            {/* Кнопка свернуть */}
            <button
              onClick={handleMinimize}
              className={clsx('flex', 'justify-center', 'items-center', 'hover:bg-white/10', 'w-12', 'h-12', 'text-gray-400', 'hover:text-white', 'transition-all', 'duration-200')}
              title="Minimize"
            >
              <svg 
                width="12" 
                height="12" 
                viewBox="0 0 12 12" 
                fill="none" 
                className={clsx('scale-100', 'hover:scale-105', 'transition-transform', 'duration-200', 'transform')}
              >
                <path 
                  d="M2.5 6h7"
                  stroke="currentColor" 
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  className={clsx('origin-center', 'transform')}
                />
              </svg>
            </button>

            {/* Кнопка развернуть/восстановить */}
            <button
              onClick={handleMaximize}
              className={clsx('flex', 'justify-center', 'items-center', 'hover:bg-white/10', 'w-12', 'h-12', 'text-gray-400', 'hover:text-white', 'transition-all', 'duration-200')}
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? (
                <svg 
                  width="12" 
                  height="12" 
                  viewBox="0 0 12 12" 
                  fill="none"
                  className={clsx('scale-100', 'hover:scale-105', 'transition-transform', 'duration-200', 'transform')}
                >
                  <path 
                    d="M4.5 2.5h5v5h-5v-5zM2.5 4.5v5h5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinejoin="round"
                    className={clsx('origin-center', 'transform')}
                  />
                </svg>
              ) : (
                <svg 
                  width="12" 
                  height="12" 
                  viewBox="0 0 12 12" 
                  fill="none"
                  className={clsx('scale-100', 'hover:scale-105', 'transition-transform', 'duration-200', 'transform')}
                >
                  <rect 
                    x="2.5" 
                    y="2.5" 
                    width="7" 
                    height="7"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    className={clsx('origin-center', 'transform')}
                  />
                </svg>
              )}
            </button>

            {/* Кнопка закрыть */}
            <button
              onClick={handleClose}
              className={clsx('flex', 'justify-center', 'items-center', 'hover:bg-red-500/90', 'w-12', 'h-12', 'text-gray-400', 'hover:text-white', 'transition-all', 'duration-200')}
              title="Close"
            >
              <svg 
                width="12" 
                height="12" 
                viewBox="0 0 12 12" 
                fill="none"
                className={clsx('scale-100', 'hover:scale-105', 'transition-transform', 'duration-200', 'transform')}
              >
                <path 
                  d="M3.5 3.5l5 5M8.5 3.5l-5 5"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  className={clsx('origin-center', 'transform')}
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 