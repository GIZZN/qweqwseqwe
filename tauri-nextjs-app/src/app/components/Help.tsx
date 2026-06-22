'use client';

/**
 * Help — справочная страница: горячие клавиши, где брать API-ключи, быстрый старт.
 * Логотип приложения (как в кастомном тайтл-баре) вынесен в шапку.
 */

import { invoke } from '@tauri-apps/api/core';
import clsx from 'clsx';

// Дефолтные горячие клавиши (см. src-tauri/src/hotkey_manager.rs). Ctrl+Shift+N тоже
// принимается и нормализуется в Ctrl+N. Все клавиши настраиваются в разделе «Хоткеи».
const HOTKEYS: { combo: string; title: string; desc: string }[] = [
  { combo: 'Ctrl + 1', title: 'Стандартный курсор', desc: 'Скрыть/показать курсор для записи и захвата.' },
  { combo: 'Ctrl + 2', title: 'Поверх всех окон', desc: 'Закрепить окно ассистента над остальными.' },
  { combo: 'Ctrl + 3', title: 'Защита от захвата экрана', desc: 'Окно становится невидимым для скриншотов и шаринга.' },
  { combo: 'Ctrl + 4', title: 'Вид в панели задач', desc: 'Скрыть/показать приложение в таскбаре.' },
  { combo: 'Ctrl + 5', title: 'Транскрипция системного звука', desc: 'Распознать речь из системного аудио (Whisper).' },
  { combo: 'Ctrl + 6', title: 'Окно легенды', desc: 'Открыть оверлей-окно с легендой опыта.' },
  { combo: 'Ctrl + 7', title: 'Разрешить разворот окна', desc: 'Переключить возможность максимизации окна.' },
];

// Где брать ключи под каждый провайдер из настроек AI.
const PROVIDERS: { name: string; tag: string; note: string; url: string; cta: string }[] = [
  {
    name: 'OpenRouter',
    tag: 'Рекомендуется · работает в РФ',
    note: 'Есть бесплатные модели. Зарегистрируйтесь, создайте ключ в разделе Keys и вставьте его в «Настройка AI».',
    url: 'https://openrouter.ai/keys',
    cta: 'openrouter.ai/keys',
  },
  {
    name: 'OpenAI',
    tag: 'Платный',
    note: 'Создайте секретный ключ (sk-...) в личном кабинете. Может требоваться VPN.',
    url: 'https://platform.openai.com/api-keys',
    cta: 'platform.openai.com/api-keys',
  },
  {
    name: 'GPTunnel',
    tag: 'Платный · работает в РФ',
    note: 'Российский шлюз к GPT-моделям. Ключ — в личном кабинете после пополнения.',
    url: 'https://gptunnel.ru',
    cta: 'gptunnel.ru',
  },
  {
    name: 'Ollama',
    tag: 'Локально · бесплатно',
    note: 'Модели крутятся на вашем ПК, ключ не нужен. Установите Ollama, запустите модель — endpoint http://localhost:11434.',
    url: 'https://ollama.com/download',
    cta: 'ollama.com/download',
  },
  {
    name: 'Свой endpoint',
    tag: 'Custom',
    note: 'Любой OpenAI-совместимый сервер: укажите URL вида https://your-api.com/v1/chat/completions и ключ, если он нужен.',
    url: 'https://platform.openai.com/docs/api-reference',
    cta: 'Документация OpenAI API',
  },
];

const STEPS: { n: string; title: string; desc: string }[] = [
  { n: '1', title: 'Войдите и активируйте Pro', desc: 'Авторизация и оплата — на сайте в браузере. Приложение читает план и открывает доступ.' },
  { n: '2', title: 'Настройте AI', desc: 'Раздел «Настройка AI»: выберите провайдера и вставьте API-ключ (см. ниже, где его взять).' },
  { n: '3', title: 'Выберите модель', desc: 'Модель для чата и для распознавания изображений. Для старта подойдёт GPT-4o Mini.' },
  { n: '4', title: 'Освойте горячие клавиши', desc: 'Скрытие курсора, защита экрана, легенда — всё на Ctrl + 1…7.' },
];

const openUrl = (url: string) => { invoke('open_auth_url', { url }).catch(() => {}); };

const card = clsx('bg-white/[0.02]', 'p-5', 'border', 'border-white/[0.08]', 'rounded-xl');
const cardTitle = clsx('mb-1', 'font-semibold', 'text-white', 'text-sm');

export default function Help() {
  return (
    <div className={clsx('flex', 'flex-col', 'bg-[#0a0a0a]', 'h-[calc(100vh-48px)]', 'overflow-y-auto', 'text-white')}>
      <div className={clsx('mx-auto', 'p-6', 'w-full', 'max-w-2xl')}>
        {/* Шапка с логотипом приложения */}
        <div className={clsx('relative', 'overflow-hidden', 'mb-6', 'p-6', 'border', 'border-white/[0.08]', 'rounded-2xl', 'bg-gradient-to-b', 'from-white/[0.05]', 'to-transparent')}>
          <div
            aria-hidden
            className={clsx('-top-20', '-right-16', 'absolute', 'rounded-full', 'w-64', 'h-64', 'pointer-events-none')}
            style={{ background: 'radial-gradient(circle, rgba(28,205,170,0.16), transparent 70%)' }}
          />
          <div className={clsx('relative', 'flex', 'items-center', 'gap-4')}>
            {/* Логотип на чёрном кружке (как в кастомном тайтл-баре) */}
            <div className={clsx('flex-shrink-0', 'flex', 'justify-center', 'items-center', 'bg-black', 'border', 'border-white/10', 'rounded-full', 'w-16', 'h-16', 'animate-glow')}>
              <div className={clsx('logo-breathe', 'flex', 'justify-center', 'items-center', 'bg-white', 'rounded-lg', 'w-8', 'h-8')}>
                <div className={clsx('bg-black', 'rounded-full', 'w-3', 'h-3')} />
              </div>
            </div>
            <div className={clsx('min-w-0')}>
              <h1 className={clsx('font-bold', 'text-2xl', 'gradient-text')}>Помощь</h1>
              <p className={clsx('mt-1', 'text-white/50', 'text-sm')}>Горячие клавиши, API-ключи и быстрый старт Interview Assistant.</p>
            </div>
          </div>
        </div>

        {/* Быстрый старт */}
        <div className={clsx(card, 'mb-4')}>
          <h2 className={clsx('mb-4', 'font-medium', 'text-white/70', 'text-sm')}>Быстрый старт</h2>
          <div className={clsx('space-y-3')}>
            {STEPS.map(s => (
              <div key={s.n} className={clsx('flex', 'gap-3')}>
                <div className={clsx('flex-shrink-0', 'flex', 'justify-center', 'items-center', 'rounded-full', 'w-6', 'h-6', 'font-bold', 'text-xs')} style={{ background: 'rgba(28,205,170,0.15)', color: '#1CCDAA' }}>
                  {s.n}
                </div>
                <div className={clsx('min-w-0')}>
                  <div className={cardTitle}>{s.title}</div>
                  <div className={clsx('text-white/40', 'text-xs', 'leading-relaxed')}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Горячие клавиши */}
        <div className={clsx(card, 'mb-4')}>
          <div className={clsx('flex', 'justify-between', 'items-center', 'mb-1')}>
            <h2 className={clsx('font-medium', 'text-white/70', 'text-sm')}>Горячие клавиши</h2>
            <span className={clsx('text-white/30', 'text-xs')}>по умолчанию</span>
          </div>
          <p className={clsx('mb-4', 'text-white/40', 'text-xs')}>Все комбинации настраиваются в разделе «Хоткеи». Вариант Ctrl + Shift + N тоже работает.</p>
          <div className={clsx('divide-y', 'divide-white/[0.06]')}>
            {HOTKEYS.map(h => (
              <div key={h.combo} className={clsx('flex', 'items-center', 'gap-4', 'py-2.5')}>
                <kbd className={clsx('flex-shrink-0', 'inline-flex', 'justify-center', 'items-center', 'bg-white/[0.06]', 'px-2.5', 'py-1', 'border', 'border-white/15', 'border-b-2', 'rounded-md', 'min-w-[72px]', 'font-mono', 'text-white/90', 'text-xs')}>
                  {h.combo}
                </kbd>
                <div className={clsx('min-w-0')}>
                  <div className={clsx('text-white', 'text-sm')}>{h.title}</div>
                  <div className={clsx('text-white/40', 'text-xs')}>{h.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Где брать API-ключи */}
        <div className={clsx(card, 'mb-4')}>
          <h2 className={clsx('mb-1', 'font-medium', 'text-white/70', 'text-sm')}>Где брать API-ключи</h2>
          <p className={clsx('mb-4', 'text-white/40', 'text-xs')}>Ключ вставляется в разделе «Настройка AI». Выберите провайдера по доступности и бюджету.</p>
          <div className={clsx('space-y-3')}>
            {PROVIDERS.map(p => (
              <div key={p.name} className={clsx('p-3', 'border', 'border-white/[0.06]', 'rounded-lg', 'bg-white/[0.015]')}>
                <div className={clsx('flex', 'justify-between', 'items-start', 'gap-3', 'mb-1')}>
                  <div className={clsx('flex', 'items-center', 'gap-2', 'min-w-0')}>
                    <span className={cardTitle}>{p.name}</span>
                    <span className={clsx('flex-shrink-0', 'px-2', 'py-0.5', 'rounded-full', 'text-[10px]')} style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)' }}>{p.tag}</span>
                  </div>
                  <button
                    onClick={() => openUrl(p.url)}
                    className={clsx('flex-shrink-0', 'flex', 'items-center', 'gap-1', 'px-2.5', 'py-1', 'rounded-md', 'text-xs', 'transition-colors')}
                    style={{ background: 'rgba(28,205,170,0.15)', color: '#1CCDAA' }}
                  >
                    {p.cta}
                    <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" /><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" /></svg>
                  </button>
                </div>
                <p className={clsx('text-white/40', 'text-xs', 'leading-relaxed')}>{p.note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Приватность */}
        <div className={clsx(card, 'mb-4')}>
          <h2 className={clsx('mb-1', 'font-medium', 'text-white/70', 'text-sm')}>Приватность на собеседовании</h2>
          <p className={clsx('text-white/40', 'text-xs', 'leading-relaxed')}>
            <b className="text-white/70">Ctrl + 3</b> делает окно невидимым при шаринге экрана и скриншотах. <b className="text-white/70">Ctrl + 1</b> скрывает курсор,
            <b className="text-white/70"> Ctrl + 4</b> убирает приложение из панели задач. Включённые режимы подсвечиваются индикаторами в шапке окна.
          </p>
        </div>

        {/* Поддержка */}
        <div className={clsx(card, 'mb-2')}>
          <h2 className={clsx('mb-1', 'font-medium', 'text-white/70', 'text-sm')}>Не получается?</h2>
          <p className={clsx('mb-3', 'text-white/40', 'text-xs', 'leading-relaxed')}>
            Проверьте план Pro и API-ключ. Если ассистент не отвечает — убедитесь, что ключ активен и хватает баланса у провайдера.
          </p>
          <button
            onClick={() => openUrl('https://diplom-chi-ten.vercel.app')}
            className={clsx('px-3', 'py-1.5', 'border', 'border-white/[0.12]', 'hover:border-white/25', 'rounded-lg', 'text-white/70', 'hover:text-white/90', 'text-xs', 'transition-colors')}
          >
            Открыть сайт
          </button>
        </div>
      </div>
    </div>
  );
}
