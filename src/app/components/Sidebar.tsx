'use client';

import { useState, useEffect } from 'react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  onNavigate: (page: string) => void;
  currentPage: string;
}

export default function Sidebar({ isCollapsed, onToggle, onNavigate, currentPage }: SidebarProps) {
  const [activeItem, setActiveItem] = useState(currentPage);

  useEffect(() => {
    setActiveItem(currentPage);
  }, [currentPage]);

  const navigationItems = [
    {
      id: 'chat',
      title: 'Чат',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
        </svg>
      ),
      count: null
    },
    {
      id: 'hotkeys',
      title: 'Горячие клавиши',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
        </svg>
      ),
      count: null
    },
    {
      id: 'privacy',
      title: 'Настройки скрытности',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
      ),
      count: null
    },
    {
      id: 'analytics',
      title: 'Аналитика',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
        </svg>
      ),
      count: null
    }
  ];

  const bottomItems = [
    {
      id: 'settings',
      title: 'Настройки',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      id: 'help',
      title: 'Помощь',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      )
    }
  ];

  return (
    <>
      {/* Декоративный уголок для плавного перехода */}
      <div className="fixed left-0 top-12 w-[1px] h-[1px] z-50">
        <div className="absolute -top-[1px] -right-[1px] w-[2px] h-[2px] bg-black/95"></div>
      </div>

      <div className={`fixed left-0 top-12 bottom-0 z-40 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      } bg-black/95 backdrop-blur-md border-r border-white/[0.08]`}>
        
        {/* Кнопка сворачивания */}
        <div className="absolute -right-3 top-6 z-50">
          <button
            onClick={onToggle}
            className="w-6 h-6 bg-black/95 border border-white/[0.08] rounded-full flex items-center justify-center text-white/60 hover:text-white/80 hover:border-white/20 transition-colors"
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

        <div className="h-full flex flex-col">
          {/* Заголовок */}
          <div className="p-4 border-b border-white/[0.05]">
            {!isCollapsed ? (
              <div>
                <h2 className="text-white font-semibold text-lg">Навигация</h2>
                <p className="text-white/40 text-sm mt-1">Интервью-ассистент</p>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* Основная навигация */}
          <div className="flex-1 p-2 space-y-1 overflow-y-auto">
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
                  <div className="flex-1 flex items-center justify-between min-w-0">
                    <span className="font-medium truncate">{item.title}</span>
                  </div>
                )}
                
                {isCollapsed && item.count && (
                  <div className="absolute left-8 -top-1 w-5 h-5 bg-white/[0.1] border border-white/[0.2] rounded-full flex items-center justify-center">
                    <span className="text-xs text-white/70 font-medium">
                      {item.count > 99 ? '99+' : item.count}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Разделитель */}
          <div className="mx-4 border-t border-white/[0.05]"></div>

          {/* Нижняя навигация */}
          <div className="p-2 space-y-1">
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
                  <span className="font-medium truncate">{item.title}</span>
                )}
              </button>
            ))}
          </div>

          {/* Информация о пользователе */}
          {!isCollapsed && (
            <div className="p-4 border-t border-white/[0.05]">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">Пользователь</p>
                  <p className="text-white/40 text-xs truncate">Базовый план</p>
                </div>
                <button
                  className="text-white/40 hover:text-white/60 transition-colors"
                  title="Выйти"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 