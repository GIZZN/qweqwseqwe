'use client';

/**
 * AuthGate — blocks the whole app behind authentication AND an active Pro plan.
 * Renders full-screen hero states (login / initialising / waiting / no-Pro) and
 * only lets `children` (the real app, incl. onboarding) through when the user is
 * logged in with active Pro. The CustomTitleBar is rendered OUTSIDE this gate so
 * the window can always be moved/closed.
 */

import { invoke } from '@tauri-apps/api/core';
import clsx from 'clsx';
import { useAuth } from '../features/auth/AuthProvider';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://diplom-chi-ten.vercel.app';

const formatWait = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}с`;
};

/** The app mark (white square + black dot), breathing. */
const logoMark = (
  <div className={clsx('logo-breathe', 'flex', 'justify-center', 'items-center', 'bg-white', 'rounded-lg', 'w-11', 'h-11')}>
    <div className={clsx('bg-black', 'rounded-full', 'w-4', 'h-4')} />
  </div>
);

/** Logo on a black circle. `loading` → running arc; otherwise → soft pulse. */
function LogoBadge({ loading }: { loading: boolean }) {
  return (
    <div className={clsx('relative', 'mx-auto', 'mb-7', 'flex', 'justify-center', 'items-center', 'w-24', 'h-24')}>
      {loading ? (
        <>
          <div className="absolute inset-0 logo-halo" />
          <div className={clsx('absolute', 'inset-2', 'flex', 'justify-center', 'items-center', 'bg-black', 'border', 'border-white/10', 'rounded-full')}>
            {logoMark}
          </div>
        </>
      ) : (
        <div className={clsx('absolute', 'inset-2', 'flex', 'justify-center', 'items-center', 'bg-black', 'border', 'border-white/10', 'rounded-full', 'animate-glow')}>
          {logoMark}
        </div>
      )}
    </div>
  );
}

/** Full-screen hero chrome (glows + centered column), placed below the title bar. */
function HeroShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-12">
      <div className={clsx('flex', 'p-4', 'h-[calc(100vh-48px)]')}>
        <div className={clsx('relative', 'flex', 'flex-col', 'flex-1', 'justify-center', 'items-center', 'overflow-hidden', 'p-8', 'border', 'border-white/[0.08]', 'rounded-2xl', 'bg-gradient-to-b', 'from-white/[0.04]', 'to-transparent')}>
          <div
            aria-hidden
            className={clsx('-top-32', 'left-1/2', '-translate-x-1/2', 'absolute', 'rounded-full', 'w-[460px]', 'h-[460px]', 'pointer-events-none')}
            style={{ background: 'radial-gradient(circle, rgba(28,205,170,0.13), transparent 65%)' }}
          />
          <div
            aria-hidden
            className={clsx('-right-20', '-bottom-20', 'absolute', 'rounded-full', 'w-80', 'h-80', 'pointer-events-none')}
            style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.10), transparent 70%)' }}
          />
          <div className={clsx('relative', 'w-full', 'max-w-sm', 'text-center')}>{children}</div>
        </div>
      </div>
    </div>
  );
}

const heroTitle = clsx('mb-3', 'font-bold', 'text-2xl', 'gradient-text');
const heroText = clsx('text-white/50', 'text-sm', 'leading-relaxed');

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, authState, error, waitSeconds, planLoading, hasPro, login, cancelLogin, logout, refreshMe } = useAuth();

  // Access granted — render the actual app.
  if (authState === 'success' && user && hasPro) {
    return <>{children}</>;
  }

  // Logged in, but plan not yet known — avoid flashing the block before /me answers.
  if (authState === 'success' && user && planLoading && user.plan == null) {
    return (
      <HeroShell>
        <LogoBadge loading />
        <h2 className={heroTitle}>Проверяем подписку…</h2>
        <p className={heroText}>Секунду — сверяемся с сервером.</p>
      </HeroShell>
    );
  }

  // Logged in, but no active Pro — hard block with a path to upgrade on the web.
  if (authState === 'success' && user) {
    return (
      <HeroShell>
        <LogoBadge loading={false} />
        <h2 className={heroTitle}>Нужна подписка Pro</h2>
        <p className={clsx(heroText, 'mb-8')}>
          Доступ к приложению открыт только по плану Pro.<br />Оформите подписку на сайте — это займёт пару минут.
        </p>

        <button
          onClick={() => { invoke('open_auth_url', { url: `${BASE_URL}/checkout` }).catch(() => {}); }}
          className={clsx('group', 'relative', 'bg-[#1CCDAA]', 'py-3.5', 'rounded-[99px]', 'w-full', 'font-semibold', 'text-black', 'transition-all', 'duration-200', 'hover:brightness-110', 'hover:-translate-y-0.5', 'active:scale-[0.98]')}
          style={{ boxShadow: '0 10px 30px rgba(28,205,170,0.28)' }}
        >
          <span className={clsx('flex', 'justify-center', 'items-center', 'gap-2')}>
            Оформить на сайте
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" className={clsx('transition-transform', 'duration-200', 'group-hover:translate-x-0.5')}>
              <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </span>
        </button>

        <div className={clsx('flex', 'justify-center', 'items-center', 'gap-3', 'mt-4')}>
          <button
            onClick={() => { refreshMe(); }}
            disabled={planLoading}
            className={clsx('px-5', 'py-2.5', 'border', 'border-white/[0.12]', 'hover:border-white/25', 'rounded-[99px]', 'text-white/70', 'hover:text-white/90', 'text-sm', 'transition-colors', 'disabled:opacity-50')}
          >
            {planLoading ? 'Обновляем…' : 'Обновить статус'}
          </button>
          <button
            onClick={() => { logout(); }}
            className={clsx('px-5', 'py-2.5', 'rounded-[99px]', 'text-white/40', 'hover:text-white/70', 'text-sm', 'transition-colors')}
          >
            Выйти
          </button>
        </div>
      </HeroShell>
    );
  }

  // Initialising the pairing request.
  if (authState === 'loading') {
    return (
      <HeroShell>
        <LogoBadge loading />
        <h2 className={heroTitle}>Инициализация</h2>
        <p className={heroText}>Готовим безопасный вход…</p>
      </HeroShell>
    );
  }

  // Waiting for the browser confirmation.
  if (authState === 'waiting') {
    return (
      <HeroShell>
        <LogoBadge loading />
        <h2 className={heroTitle}>Ожидание подтверждения</h2>
        <p className={clsx(heroText, 'mb-2')}>Подтвердите вход в открывшемся браузере</p>
        <p className={clsx('mb-8', 'text-white/30', 'text-xs', 'tabular-nums')}>{formatWait(waitSeconds)} / 10:00</p>
        <button
          onClick={cancelLogin}
          className={clsx('mx-auto', 'px-6', 'py-2.5', 'border', 'border-white/[0.12]', 'hover:border-white/25', 'rounded-[99px]', 'text-white/60', 'hover:text-white/90', 'text-sm', 'transition-colors')}
        >
          Отменить
        </button>
      </HeroShell>
    );
  }

  // Not logged in (idle / error).
  return (
    <HeroShell>
      <LogoBadge loading={false} />
      <h2 className={heroTitle}>Войдите в аккаунт</h2>
      <p className={clsx(heroText, 'mb-8')}>
        Подтверждение откроется в браузере.<br />Это безопасно и займёт пару секунд.
      </p>

      {error && (
        <div className={clsx('flex', 'items-center', 'gap-2', 'bg-red-500/10', 'mb-5', 'px-4', 'py-2.5', 'border', 'border-red-500/20', 'rounded-lg', 'text-red-400', 'text-sm', 'text-left')}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" className="flex-shrink-0">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={login}
        className={clsx('group', 'relative', 'bg-[#1CCDAA]', 'py-3.5', 'rounded-[99px]', 'w-full', 'font-semibold', 'text-black', 'transition-all', 'duration-200', 'hover:brightness-110', 'hover:-translate-y-0.5', 'active:scale-[0.98]')}
        style={{ boxShadow: '0 10px 30px rgba(28,205,170,0.28)' }}
      >
        <span className={clsx('flex', 'justify-center', 'items-center', 'gap-2')}>
          Войти через браузер
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" className={clsx('transition-transform', 'duration-200', 'group-hover:translate-x-0.5')}>
            <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </span>
      </button>

      <div className={clsx('flex', 'justify-center', 'items-center', 'gap-1.5', 'mt-5', 'text-white/30', 'text-xs')}>
        <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" className="flex-shrink-0">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        <span>Вход обязателен для работы приложения</span>
      </div>
    </HeroShell>
  );
}
