'use client';

import { useState, useEffect } from 'react';
import clsx from 'clsx';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  onNavigate: (page: string) => void;
  currentPage: string;
}

export default function Sidebar({ isCollapsed, onToggle, onNavigate, currentPage }: SidebarProps) {
  const [activeItem, setActiveItem] = useState(currentPage);
  const [userProfile, setUserProfile] = useState<{name: string; avatar?: string} | null>(null);

  useEffect(() => {
    setActiveItem(currentPage);
  }, [currentPage]);

  useEffect(() => {
    const load = () => {
      try {
        const saved = localStorage.getItem('user_profile');
        if (saved) setUserProfile(JSON.parse(saved));
        else setUserProfile(null);
      } catch {}
    };
    load();
    window.addEventListener('storage', load);
    const interval = setInterval(load, 3000);
    return () => { window.removeEventListener('storage', load); clearInterval(interval); };
  }, []);

  const navigationItems = [
    {
      id: 'live',
      title: ' Ассистент',
      icon: (
        <svg className={clsx('w-5', 'h-5')} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
        </svg>
      ),
      count: null
    },
    {
      id: 'chat',
      title: 'Чат',
      icon: (
        <svg className={clsx('w-5', 'h-5')} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
        </svg>
      ),
      count: null
    },
    {
      id: 'hotkeys',
      title: 'Горячие клавиши',
      icon: (
        <svg className={clsx('w-5', 'h-5')} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
        </svg>
      ),
      count: null
    },
    {
      id: 'privacy',
      title: 'Настройки скрытности',
      icon: (
        <svg className={clsx('w-5', 'h-5')} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
      ),
      count: null
    },
    {
      id: 'analytics',
      title: 'Аналитика',
      icon: (
        <svg className={clsx('w-5', 'h-5')} fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
        </svg>
      ),
      count: null
    }
  ];

  const bottomItems = [
{
      id: 'ai-setup',
      title: 'Настройки ИИ',
      icon: (
        <svg className={clsx('w-5', 'h-5')} fill="currentColor" viewBox="0 0 20 20">
          <path d="M13 7H7v6h6V7z" />
          <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      id: 'help',
      title: 'Помощь',
      icon: (
        <svg className={clsx('w-5', 'h-5')} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      )
    }
  ];

  return (
    <>
      {/* Декоративный уголок для плавного перехода */}
      <div className={clsx('top-12', 'left-0', 'z-50', 'fixed', 'w-[1px]', 'h-[1px]')}>
        <div className={clsx('-top-[1px]', '-right-[1px]', 'absolute', 'bg-black/95', 'w-[2px]', 'h-[2px]')}></div>
      </div>

      <div className={`fixed left-0 top-12 bottom-0 z-40 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      } bg-black/95 backdrop-blur-md border-r border-white/[0.08]`}>
        
        {/* Кнопка сворачивания */}
        <div className={clsx('top-6', '-right-3', 'z-50', 'absolute')}>
          <button
            onClick={onToggle}
            className={clsx('flex', 'justify-center', 'items-center', 'bg-black/95', 'border', 'border-white/[0.08]', 'hover:border-white/20', 'rounded-full', 'w-6', 'h-6', 'text-white/60', 'hover:text-white/80', 'transition-colors')}
            title={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
          >
            <svg 
              className={`w-3 h-3 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className={clsx('flex', 'flex-col', 'h-full')}>
          {/* Заголовок */}
          <div className={clsx('p-4', 'border-white/[0.05]', 'border-b')}>
            {!isCollapsed ? (
              <div>
                <h2 className={clsx('font-semibold', 'text-white', 'text-lg')}>Навигация</h2>
                <p className={clsx('mt-1', 'text-white/40', 'text-sm')}>Интервью-ассистент</p>
              </div>
            ) : (
              <div className={clsx('flex', 'justify-center')}>
                <div className={clsx('flex', 'justify-center', 'items-center', 'bg-white/10', 'rounded-lg', 'w-8', 'h-8')}>
                  <svg className={clsx('w-4', 'h-4', 'text-white')} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* Основная навигация */}
          <div className={clsx('flex-1', 'space-y-1', 'p-2', 'overflow-y-auto')}>
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveItem(item.id);
                  onNavigate(item.id);
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                  activeItem === item.id
                    ? 'bg-white/[0.08] text-white border border-white/[0.1]'
                    : 'text-white/60 hover:text-white/80 hover:bg-white/[0.04] border border-transparent'
                }`}
                title={isCollapsed ? item.title : undefined}
              >
                <div className={`flex-shrink-0 ${activeItem === item.id ? 'text-white' : 'text-white/60 group-hover:text-white/80'}`}>
                  {item.icon}
                </div>
                
                {!isCollapsed && (
                  <div className={clsx('flex', 'flex-1', 'justify-between', 'items-center', 'min-w-0')}>
                    <span className={clsx('font-medium', 'truncate')}>{item.title}</span>
                  </div>
                )}
                
                {isCollapsed && item.count && (
                  <div className={clsx('-top-1', 'left-8', 'absolute', 'flex', 'justify-center', 'items-center', 'bg-white/[0.1]', 'border', 'border-white/[0.2]', 'rounded-full', 'w-5', 'h-5')}>
                    <span className={clsx('font-medium', 'text-white/70', 'text-xs')}>
                      {item.count > 99 ? '99+' : item.count}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Разделитель */}
          <div className={clsx('mx-4', 'border-white/[0.05]', 'border-t')}></div>

          {/* Нижняя навигация */}
          <div className={clsx('space-y-1', 'p-2')}>
            {bottomItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveItem(item.id);
                  onNavigate(item.id);
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                  activeItem === item.id
                    ? 'bg-white/[0.08] text-white border border-white/[0.1]'
                    : 'text-white/60 hover:text-white/80 hover:bg-white/[0.04] border border-transparent'
                }`}
                title={isCollapsed ? item.title : undefined}
              >
                <div className={`flex-shrink-0 ${activeItem === item.id ? 'text-white' : 'text-white/60 group-hover:text-white/80'}`}>
                  {item.icon}
                </div>
                
                {!isCollapsed && (
                  <span className={clsx('font-medium', 'truncate')}>{item.title}</span>
                )}
              </button>
            ))}
          </div>

          {/* Информация о пользователе — клик открывает профиль */}
          {!isCollapsed && (
            <div className={clsx('p-4', 'border-white/[0.05]', 'border-t')}>
              <button
                onClick={() => { onNavigate('settings'); }}
                className={clsx('flex', 'items-center', 'space-x-3', 'hover:bg-white/[0.04]', '-m-1', 'p-1', 'rounded-lg', 'w-full', 'text-left', 'transition-colors')}
              >
                <div className={clsx('flex-shrink-0', 'rounded-full', 'w-8', 'h-8', 'overflow-hidden')}>
                  {userProfile?.avatar ? (
                    <img src={userProfile.avatar} alt={userProfile.name} className={clsx('w-full', 'h-full', 'object-cover')} />
                  ) : (
                    <div className={clsx('flex', 'justify-center', 'items-center', 'bg-gradient-to-br', 'from-blue-500', 'to-purple-600', 'w-full', 'h-full')}>
                      {userProfile?.name ? (
                        <span className={clsx('font-bold', 'text-white', 'text-xs')}>{userProfile.name.charAt(0).toUpperCase()}</span>
                      ) : (
                        <svg className={clsx('w-4', 'h-4', 'text-white')} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  )}
                </div>
                <div className={clsx('flex-1', 'min-w-0')}>
                  <p className={clsx('font-medium', 'text-white', 'text-sm', 'truncate')}>{userProfile?.name || 'Пользователь'}</p>
                  <p className={clsx('text-white/40', 'text-xs', 'truncate')}>{userProfile ? 'Авторизован' : 'Базовый план'}</p>
                </div>
                <svg className={clsx('flex-shrink-0', 'w-4', 'h-4', 'text-white/40')} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 
