'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface StandardCursorProps {
  children: React.ReactNode;
}

const StandardCursor: React.FC<StandardCursorProps> = ({ children }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const styleElementRef = useRef<HTMLStyleElement | null>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);

  const removeStyles = useCallback(() => {
    if (styleElementRef.current) {
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
        mutationObserverRef.current = null;
      }
      styleElementRef.current.remove();
      styleElementRef.current = null;
    }
    if (document.body.style.cursor === 'default') {
      document.body.style.cursor = '';
    }
    const existingStyle = document.getElementById('standard-cursor-override');
    if (existingStyle) {
      existingStyle.remove();
    }
  }, []);

  const checkStandardCursorSetting = async () => {
    try {
      const enabled = await invoke<boolean>('is_standard_cursor_enabled');
      setIsEnabled(enabled);
    } catch (error) {
      console.error('Error checking standard cursor setting:', error);
    }
  };

  const applyStandardCursor = useCallback(() => {
    // Удаляем старые стили если есть
    removeStyles();

    // Создаём новые стили для принудительного установки стандартного курсора
    const newStyleElement = document.createElement('style');
    newStyleElement.id = 'standard-cursor-override';
    
    const cursorCSS = `
      *, *::before, *::after {
        cursor: default !important;
      }
      
      /* Специальные случаи для интерактивных элементов */
      button, 
      [role="button"], 
      input[type="button"], 
      input[type="submit"], 
      input[type="reset"],
      select,
      a,
      [onclick] {
        cursor: default !important;
      }
      
      /* Для текстовых полей оставляем стандартный курсор */
      input[type="text"], 
      input[type="password"], 
      input[type="email"], 
      input[type="search"], 
      input[type="url"], 
      input[type="tel"], 
      input[type="number"],
      textarea,
      [contenteditable="true"] {
        cursor: default !important;
      }
      
      /* Для элементов с изменением размера */
      [resize] {
        cursor: default !important;
      }
      
      /* Убираем все hover эффекты курсора */
      *:hover {
        cursor: default !important;
      }
      
      /* Убираем курсоры изменения размера для краёв окна */
      html, body {
        cursor: default !important;
      }
    `;
    
    newStyleElement.innerHTML = cursorCSS;
    document.head.appendChild(newStyleElement);
    styleElementRef.current = newStyleElement;
    
    // Также устанавливаем курсор для body
    document.body.style.cursor = 'default';
    
    // Добавляем обработчик для динамически создаваемых элементов
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              // Принудительно устанавливаем стандартный курсор для новых элементов
              element.style.cursor = 'default';
              
              // Также для всех дочерних элементов
              const allChildren = element.querySelectorAll('*');
              allChildren.forEach((child) => {
                (child as HTMLElement).style.cursor = 'default';
              });
            }
          });
        }
      });
    });
    
    // Начинаем наблюдение за изменениями в DOM
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    mutationObserverRef.current = observer;
  }, [removeStyles]);

  useEffect(() => {
    checkStandardCursorSetting();
    const interval = setInterval(checkStandardCursorSetting, 1000);
    return () => {
      clearInterval(interval);
      removeStyles();
    };
  }, [removeStyles]);

  useEffect(() => {
    if (isEnabled) {
      applyStandardCursor();
    } else {
      removeStyles();
    }
  }, [isEnabled, applyStandardCursor, removeStyles]);

  return (
    <div 
      style={{ cursor: isEnabled ? 'default' : undefined }} 
      className={isEnabled ? "standard-cursor-wrapper" : ""}
    >
      {children}
    </div>
  );
};

export default StandardCursor; 