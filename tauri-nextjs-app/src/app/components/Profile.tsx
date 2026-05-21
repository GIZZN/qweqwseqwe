'use client';
import { useState, useLayoutEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import clsx from 'clsx';
import { PROMPT_PRESETS, getSystemPrompt, saveSystemPrompt } from '../features/prompts/presets';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://diplom-chi-ten.vercel.app';

interface User { id: string; name: string; email: string; avatar?: string; created_at?: string; }

type AuthState = 'idle' | 'loading' | 'waiting' | 'success' | 'error';

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<AuthState>('idle');
  const [error, setError] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [promptSaved, setPromptSaved] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [waitSeconds, setWaitSeconds] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  // Restore session from localStorage BEFORE first paint
  useLayoutEffect(() => {
    const savedProfile = localStorage.getItem('user_profile');
    const savedJwt = localStorage.getItem('auth_jwt');
    if (savedProfile && savedJwt) {
      try {
        const parsed = JSON.parse(savedProfile);
        if (parsed && parsed.id) {
          setUser(parsed);
          setAuthState('success');
        }
      } catch {}
    }
    // Load system prompt
    setSystemPrompt(getSystemPrompt());
    return () => stopPolling();
  }, []);

  const saveJwt = (jwt: string) => localStorage.setItem('auth_jwt', jwt);
  const clearJwt = () => localStorage.removeItem('auth_jwt');

  const stopPolling = () => {
    if (pollingRef.current) { clearTimeout(pollingRef.current); pollingRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const handleLogin = async () => {
    setAuthState('loading');
    setError('');
    cancelledRef.current = false;

    // In production the webview origin is tauri://, which the auth API doesn't allow
    // via CORS. We proxy through Rust commands and fall back to fetch in dev.
    // Errors from Rust come as "NNN: body" strings; we expose status separately so the
    // poller can distinguish 4xx (terminal) from 5xx (transient, retry with backoff).
    type HttpResp = { ok: boolean; status: number; data: unknown };
    const httpPost = async (url: string, body?: string): Promise<HttpResp> => {
      try {
        const raw = await invoke<string>('http_proxy_post', { url, bearer: null, body: body ?? null });
        return { ok: true, status: 200, data: JSON.parse(raw) };
      } catch (e) {
        const m = String(e).match(/^(\d{3}):/);
        if (m) return { ok: false, status: Number(m[1]), data: null };
        // Not an HTTP error — try direct fetch (dev mode)
        try {
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors',
            body: body ?? '{}',
          });
          const data = await r.json().catch(() => null);
          return { ok: r.ok, status: r.status, data };
        } catch {
          return { ok: false, status: 0, data: null };
        }
      }
    };
    const httpGet = async (url: string): Promise<HttpResp> => {
      try {
        const raw = await invoke<string>('http_proxy_get', { url, bearer: null });
        return { ok: true, status: 200, data: JSON.parse(raw) };
      } catch (e) {
        const m = String(e).match(/^(\d{3}):/);
        if (m) return { ok: false, status: Number(m[1]), data: null };
        try {
          const r = await fetch(url, { mode: 'cors' });
          const data = await r.json().catch(() => null);
          return { ok: r.ok, status: r.status, data };
        } catch {
          return { ok: false, status: 0, data: null };
        }
      }
    };

    try {
      // Step 1: Get one-time token
      const initResp = await httpPost(`${BASE_URL}/api/auth/app/init`);
      if (!initResp.ok) throw new Error(`Сервер вернул ${initResp.status || 'неизвестную'} ошибку`);
      const token = (initResp.data as { token?: string })?.token;
      if (!token) throw new Error('Сервер не вернул токен');

      // Step 2: Open system browser via Rust command
      await invoke('open_auth_url', { url: `${BASE_URL}/auth/app?token=${token}` });

      // Step 3: Start polling with self-rescheduling setTimeout (lets us back off on errors).
      setAuthState('waiting');
      setWaitSeconds(0);

      const startedAt = Date.now();
      const totalTimeoutMs = 10 * 60 * 1000; // 10 min
      const baseDelayMs = 2000;
      const maxDelayMs = 8000;
      let approvedHandled = false; // ignore 'invalid' that follows successful approve
      let delayMs = baseDelayMs;

      timerRef.current = setInterval(() => {
        setWaitSeconds(Math.floor((Date.now() - startedAt) / 1000));
      }, 1000);

      const tick = async () => {
        if (cancelledRef.current || approvedHandled) { stopPolling(); return; }
        if (Date.now() - startedAt > totalTimeoutMs) {
          stopPolling();
          setAuthState('error');
          setError('Время ожидания истекло. Попробуйте снова.');
          return;
        }

        const resp = await httpGet(`${BASE_URL}/api/auth/app/check?token=${token}`);

        // Treat any 5xx or network failure as transient — keep polling, exponential backoff.
        const transient = !resp.ok && (resp.status === 0 || resp.status >= 500 || resp.status === 429);
        if (transient) {
          delayMs = Math.min(delayMs * 2, maxDelayMs);
          pollingRef.current = setTimeout(tick, delayMs);
          return;
        }

        // 410 Gone — token expired (terminal).
        if (resp.status === 410) {
          stopPolling();
          setAuthState('error');
          setError('Токен истёк. Попробуйте снова.');
          return;
        }
        // 404 Not Found — token unknown / already consumed (terminal, but only if we haven't
        // just successfully approved — server marks token used after approve).
        if (resp.status === 404) {
          if (approvedHandled) { stopPolling(); return; }
          stopPolling();
          setAuthState('error');
          setError('Ошибка авторизации. Попробуйте снова.');
          return;
        }
        // Other 4xx — terminal error.
        if (!resp.ok && resp.status >= 400) {
          stopPolling();
          setAuthState('error');
          setError(`Ошибка авторизации (${resp.status}).`);
          return;
        }

        const data = resp.data as { status?: string; jwt?: string; user?: User } | null;
        const status = data?.status;

        if (status === 'approved' && data?.jwt && data?.user?.id && data?.user?.name) {
          approvedHandled = true;
          stopPolling();
          saveJwt(data.jwt);
          setUser(data.user);
          setAuthState('success');
          localStorage.setItem('user_profile', JSON.stringify(data.user));
          invoke('set_auth_status', { isAuthenticated: true, userName: data.user.name }).catch(() => {});
          return;
        }
        if (status === 'expired') {
          stopPolling();
          setAuthState('error');
          setError('Токен истёк. Попробуйте снова.');
          return;
        }
        if (status === 'invalid') {
          if (approvedHandled) { stopPolling(); return; }
          stopPolling();
          setAuthState('error');
          setError('Ошибка авторизации. Попробуйте снова.');
          return;
        }
        // 'pending' or anything else — keep polling, reset backoff after success response.
        delayMs = baseDelayMs;
        pollingRef.current = setTimeout(tick, delayMs);
      };

      pollingRef.current = setTimeout(tick, baseDelayMs);

    } catch (e) {
      setAuthState('error');
      setError(String(e));
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    stopPolling();
    setAuthState('idle');
    setError('');
  };

  const handleLogout = async () => {
    // Call server logout
    import('../features/sync/sessionSync').then(({ logoutFromServer }) => {
      logoutFromServer();
    });
    clearJwt();
    localStorage.removeItem('user_profile');
    setUser(null);
    setAuthState('idle');
    invoke('set_auth_status', { isAuthenticated: false, userName: '' }).catch(() => {});
  };

  const formatWait = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}с`;
  };

  return (
    <div className={clsx('flex', 'flex-col', 'bg-[#0a0a0a]', 'h-[calc(100vh-48px)]', 'overflow-y-auto', 'text-white')}>
      <div className={clsx('mx-auto', 'p-6', 'w-full', 'max-w-2xl')}>
        <h1 className={clsx('mb-6', 'font-bold', 'text-[22px]')}>Профиль</h1>

        {/* Authorized */}
        {user && authState === 'success' && (
          <>
            <div className={clsx('bg-white/[0.02]', 'mb-4', 'p-5', 'border', 'border-white/[0.08]', 'rounded-xl')}>
                <div className={clsx('flex', 'items-center', 'gap-4')}>
                <div className={clsx('flex-shrink-0', 'rounded-full', 'w-14', 'h-14', 'overflow-hidden')}>
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className={clsx('w-full', 'h-full', 'object-cover')} />
                  ) : (
                    <div className={clsx('w-full', 'h-full', 'flex', 'items-center', 'justify-center', 'bg-gradient-to-br', 'from-[#1CCDAA]', 'to-blue-500', 'font-bold', 'text-white', 'text-xl')}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className={clsx('flex-1', 'min-w-0')}>
                  <div className={clsx('font-semibold', 'text-lg')}>{user.name}</div>
                  <div className={clsx('text-white/50', 'text-sm')}>{user.email}</div>
                  {user.created_at && (
                    <div className={clsx('mt-0.5', 'text-white/30', 'text-xs')}>
                      Аккаунт с {new Date(user.created_at).toLocaleDateString('ru-RU')}
                    </div>
                  )}
                </div>
                <button onClick={handleLogout} className={clsx('flex-shrink-0', 'hover:bg-red-500/10', 'px-3', 'py-1.5', 'border', 'border-red-500/30', 'rounded-lg', 'text-red-400', 'text-xs', 'transition-colors')}>
                  Выйти
                </button>
              </div>
            </div>

            {/* System Prompt Section */}
            <div className={clsx('bg-white/[0.02]', 'mt-4', 'p-5', 'border', 'border-white/[0.08]', 'rounded-xl')}>
              <h3 className={clsx('mb-3', 'font-medium', 'text-white/70', 'text-sm')}>Системный промпт</h3>
              <p className={clsx('mb-4', 'text-white/40', 'text-xs')}>Определяет как AI отвечает на вопросы. Выберите пресет или напишите свой.</p>

              {/* Presets */}
              <div className={clsx('gap-2', 'grid', 'grid-cols-2', 'mb-4')}>
                {PROMPT_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => { setSelectedPreset(preset.id); setSystemPrompt(preset.prompt); }}
                    className={`text-left p-3 rounded-lg border transition-colors ${selectedPreset === preset.id ? 'border-[#1CCDAA]/50 bg-[#1CCDAA]/5' : 'border-white/[0.08] hover:border-white/[0.15] bg-white/[0.02]'}`}
                  >
                    <div className={clsx('font-medium', 'text-white', 'text-sm')}>{preset.name}</div>
                    <div className={clsx('mt-0.5', 'text-white/40', 'text-xs')}>{preset.description}</div>
                  </button>
                ))}
              </div>

              {/* Custom prompt textarea */}
              <textarea
                value={systemPrompt}
                onChange={e => { setSystemPrompt(e.target.value); setSelectedPreset('custom'); }}
                rows={6}
                placeholder="Введите свой системный промпт..."
                className={clsx('bg-white/[0.05]', 'px-3', 'py-2', 'border', 'border-white/[0.1]', 'focus:border-[#1CCDAA]/40', 'rounded-lg', 'focus:outline-none', 'w-full', 'text-white', 'text-sm', 'resize-none', 'placeholder-white/30')}
              />
              <div className={clsx('flex', 'justify-between', 'items-center', 'mt-2')}>
                <span className={clsx('text-white/30', 'text-xs')}>{systemPrompt.length} символов</span>
                <button
                  onClick={() => { saveSystemPrompt(systemPrompt); setPromptSaved(true); setTimeout(() => setPromptSaved(false), 2000); }}
                  className={clsx('px-3', 'py-1.5', 'rounded-lg', 'text-xs', 'transition-colors')}
                  style={{ background: 'rgba(28,205,170,0.2)', color: '#1CCDAA' }}
                >
                  {promptSaved ? '✓ Сохранено' : 'Сохранить'}
                </button>
              </div>
            </div>

            <div className={clsx('bg-white/[0.02]', 'mt-4', 'p-5', 'border', 'border-white/[0.08]', 'rounded-xl')}>
              <h3 className={clsx('mb-3', 'font-medium', 'text-white/70', 'text-sm')}>О приложении</h3>
              <div className={clsx('space-y-2', 'text-sm')}>
                <div className={clsx('flex', 'justify-between')}><span className="text-white/50">Версия</span><span>1.0.0</span></div>
                <div className={clsx('flex', 'justify-between')}><span className="text-white/50">Платформа</span><span>Tauri + Next.js</span></div>
                <div className={clsx('flex', 'justify-between')}><span className="text-white/50">AI провайдер</span><span>{localStorage.getItem('ai_provider') || 'openrouter'}</span></div>
              </div>
            </div>
          </>
        )}

        {/* Waiting for browser confirmation */}
        {authState === 'waiting' && (
          <div className={clsx('bg-white/[0.02]', 'p-8', 'border', 'border-white/[0.08]', 'rounded-xl', 'text-center')}>
            {/* SVG spinner with gradient */}
            <div className="flex justify-center mb-6">
              <svg width="64" height="64" viewBox="0 0 64 64" className="animate-spin" style={{animationDuration:'1.2s'}}>
                <defs>
                  <linearGradient id="spinnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1CCDAA" stopOpacity="1"/>
                    <stop offset="100%" stopColor="#1CCDAA" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4"/>
                <path d="M32 4 A28 28 0 0 1 60 32" fill="none" stroke="url(#spinnerGrad)" strokeWidth="4" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 className={clsx('mb-2', 'font-semibold', 'text-lg')}>Ожидание подтверждения</h2>
            <p className={clsx('mb-1', 'text-white/50', 'text-sm')}>Подтвердите вход в открывшемся браузере</p>
            <p className={clsx('mb-6', 'text-white/30', 'text-xs')}>{formatWait(waitSeconds)} / 10:00</p>
            <button onClick={handleCancel} className={clsx('hover:bg-white/[0.05]', 'px-4', 'py-2', 'border', 'border-white/[0.1]', 'rounded-lg', 'text-white/60', 'text-sm', 'transition-colors')}>
              Отменить
            </button>
          </div>
        )}

        {/* Loading */}
        {authState === 'loading' && (
          <div className={clsx('bg-white/[0.02]', 'p-8', 'border', 'border-white/[0.08]', 'rounded-xl', 'text-center')}>
            <div className="flex justify-center mb-3">
              <svg width="36" height="36" viewBox="0 0 36 36" className="animate-spin" style={{animationDuration:'0.9s'}}>
                <defs>
                  <linearGradient id="spinnerGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1CCDAA" stopOpacity="1"/>
                    <stop offset="100%" stopColor="#1CCDAA" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3"/>
                <path d="M18 4 A14 14 0 0 1 32 18" fill="none" stroke="url(#spinnerGrad2)" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
            <p className={clsx('text-white/50', 'text-sm')}>Инициализация...</p>
          </div>
        )}

        {/* Not logged in / error */}
        {(authState === 'idle' || authState === 'error') && !user && (
          <div className={clsx('border', 'border-white/[0.08]', 'rounded-xl', 'p-8', 'bg-white/[0.02]', 'text-center')}>
            <div className={clsx('w-16', 'h-16', 'rounded-full', 'bg-white/[0.05]', 'flex', 'items-center', 'justify-center', 'mx-auto', 'mb-4')}>
              <svg width="28" height="28" viewBox="0 0 20 20" fill="rgba(255,255,255,0.3)">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
              </svg>
            </div>
            <h2 className={clsx('text-lg', 'font-semibold', 'mb-2')}>Войдите в аккаунт</h2>
            <p className={clsx('mb-6', 'text-white/50', 'text-sm')}>Откроется браузер для подтверждения</p>

            {error && (
              <div className={clsx('bg-red-500/10', 'mb-4', 'px-4', 'py-2', 'border', 'border-red-500/20', 'rounded-lg', 'text-red-400', 'text-sm')}>
                {error}
              </div>
            )}

            <button onClick={handleLogin} className={clsx('bg-[#1CCDAA]', 'hover:bg-[#1CCDAA]/80', 'mb-3', 'py-3', 'rounded-lg', 'w-full', 'font-semibold', 'text-black', 'transition-colors')}>
              Войти через браузер
            </button>
            <p className={clsx('text-white/30', 'text-xs')}>Приложение работает и без авторизации</p>
          </div>
        )}
      </div>
    </div>
  );
}
