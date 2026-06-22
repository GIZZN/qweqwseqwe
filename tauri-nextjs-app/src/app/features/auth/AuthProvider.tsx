'use client';

/**
 * AuthProvider — single owner of the desktop session, the pairing login flow
 * and the (read-only) Pro plan. Previously this lived inside Profile; it was
 * lifted into a context so the whole app can be gated behind auth + active Pro
 * (see AuthGate) while Profile keeps showing the authorised settings.
 */

import {
  createContext, useContext, useState, useLayoutEffect, useEffect, useRef, useCallback,
} from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  getStoredUser, getJwt, getJwtExp, clearSession, isJwtExpired, fetchMe, hasActivePro,
  saveTokens, refreshJwt, AUTH_EXPIRED_EVENT,
} from './session';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://diplom-chi-ten.vercel.app';

export interface User {
  id: string; name: string; email: string; avatar?: string; created_at?: string;
  plan?: 'free' | 'pro'; pro_expires_at?: string | null;
}

export type AuthState = 'idle' | 'loading' | 'waiting' | 'success' | 'error';

interface AuthContextValue {
  user: User | null;
  authState: AuthState;
  error: string;
  waitSeconds: number;
  planLoading: boolean;
  /** True only when logged in AND the Pro plan is active (lifetime or unexpired). */
  hasPro: boolean;
  login: () => Promise<void>;
  cancelLogin: () => void;
  logout: () => Promise<void>;
  /** Re-read /api/auth/me; returns the fresh user or null. */
  refreshMe: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<AuthState>('idle');
  const [error, setError] = useState('');
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [planLoading, setPlanLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearTimeout(pollingRef.current); pollingRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const applyUser = useCallback((u: User) => {
    setUser(u);
    localStorage.setItem('user_profile', JSON.stringify(u));
  }, []);

  const dropSession = useCallback((message: string) => {
    clearSession();
    setUser(null);
    setAuthState('error');
    setError(message);
    invoke('set_auth_status', { isAuthenticated: false, userName: '' }).catch(() => {});
  }, []);

  // Mint a fresh JWT from the refresh token. A rejected refresh token (invalid)
  // means the session is truly dead → drop it. Network/5xx (unknown) keeps it.
  const attemptRefresh = useCallback(async () => {
    const r = await refreshJwt();
    if (r === 'invalid') dropSession('Сессия истекла. Войдите снова.');
    return r;
  }, [dropSession]);

  // Re-read the authoritative tariff from /api/auth/me. Self-heals an expired
  // access token via refresh before giving up. Fail-open: only a dead refresh
  // token (or a 401 that survives a refresh) drops the session; offline / 5xx
  // keeps the last known plan.
  const refreshMe = useCallback(async (): Promise<User | null> => {
    let jwt = getJwt();
    if (!jwt) return null;
    // Access token already past exp — renew before touching /me with a dead token.
    if (isJwtExpired(jwt)) {
      if (await attemptRefresh() !== 'refreshed') return null;
      jwt = getJwt();
    }
    setPlanLoading(true);
    try {
      let res = await fetchMe(jwt);
      if (res.status === 401 || res.status === 403) {
        if (await attemptRefresh() !== 'refreshed') return null; // invalid→dropped, unknown→keep
        res = await fetchMe(getJwt());
        if (res.status === 401 || res.status === 403) {
          dropSession('Сессия истекла. Войдите снова.');
          return null;
        }
      }
      if (res.ok && res.user) applyUser(res.user as User);
      return res.user as User | null;
    } finally {
      setPlanLoading(false);
    }
  }, [applyUser, attemptRefresh, dropSession]);

  // Restore session from localStorage BEFORE first paint.
  useLayoutEffect(() => {
    const savedUser = getStoredUser();
    const savedJwt = localStorage.getItem('auth_jwt');
    if (savedUser && savedJwt) {
      if (isJwtExpired(savedJwt)) {
        clearSession();
      } else {
        setUser(savedUser as User);
        setAuthState('success');
        refreshMe();
      }
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A 401 anywhere dispatches auth:expired — try to refresh the token first;
  // only a dead refresh token actually drops the session.
  useEffect(() => {
    const onExpired = async () => {
      const r = await refreshJwt();
      if (r === 'invalid') {
        stopPolling();
        dropSession('Сессия истекла. Войдите снова.');
      }
      // 'refreshed' / 'unknown' → keep the session; the next request uses the new JWT.
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [dropSession, stopPolling]);

  // Proactive renewal: refresh the JWT ~90s before its `exp` so a short-lived
  // token never actually expires while the app is open. Re-arms from each new
  // token; opaque tokens (no exp) fall back to the reactive 401 path above.
  useEffect(() => {
    if (!user || authState !== 'success') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const exp = getJwtExp(getJwt());
      if (!exp) return;
      const leadMs = 90_000;
      const maxMs = 6 * 60 * 60 * 1000; // setTimeout cap + periodic re-check
      const ms = Math.min(maxMs, Math.max(5_000, exp * 1000 - Date.now() - leadMs));
      timer = setTimeout(async () => {
        const r = await refreshJwt();
        if (r === 'invalid') { dropSession('Сессия истекла. Войдите снова.'); return; }
        schedule();
      }, ms);
    };
    schedule();
    return () => { if (timer) clearTimeout(timer); };
  }, [user, authState, dropSession]);

  // Keep the plan fresh while logged in: re-read on focus and every 5 minutes.
  useEffect(() => {
    if (!user || authState !== 'success') return;
    const onFocus = () => { refreshMe(); };
    window.addEventListener('focus', onFocus);
    const refresh = setInterval(() => { refreshMe(); }, 5 * 60 * 1000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(refresh);
    };
  }, [user, authState, refreshMe]);

  const login = useCallback(async () => {
    setAuthState('loading');
    setError('');
    cancelledRef.current = false;

    // In production the webview origin is tauri://, which the auth API doesn't allow
    // via CORS. We proxy through Rust commands and fall back to fetch in dev.
    type HttpResp = { ok: boolean; status: number; data: unknown };
    const httpPost = async (url: string, body?: string): Promise<HttpResp> => {
      try {
        const raw = await invoke<string>('http_proxy_post', { url, bearer: null, body: body ?? null });
        return { ok: true, status: 200, data: JSON.parse(raw) };
      } catch (e) {
        const m = String(e).match(/^(\d{3}):/);
        if (m) return { ok: false, status: Number(m[1]), data: null };
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
      // Step 1: one-time token
      const initResp = await httpPost(`${BASE_URL}/api/auth/app/init`);
      if (!initResp.ok) throw new Error(`Сервер вернул ${initResp.status || 'неизвестную'} ошибку`);
      const token = (initResp.data as { token?: string })?.token;
      if (!token) throw new Error('Сервер не вернул токен');

      // Step 2: open the system browser
      await invoke('open_auth_url', { url: `${BASE_URL}/auth/app?token=${token}` });

      // Step 3: poll with self-rescheduling setTimeout (so we can back off on errors).
      setAuthState('waiting');
      setWaitSeconds(0);

      const startedAt = Date.now();
      const totalTimeoutMs = 10 * 60 * 1000; // 10 min
      const baseDelayMs = 2000;
      const maxDelayMs = 8000;
      let approvedHandled = false;
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

        const transient = !resp.ok && (resp.status === 0 || resp.status >= 500 || resp.status === 429);
        if (transient) {
          delayMs = Math.min(delayMs * 2, maxDelayMs);
          pollingRef.current = setTimeout(tick, delayMs);
          return;
        }

        if (resp.status === 410) {
          stopPolling();
          setAuthState('error');
          setError('Токен истёк. Попробуйте снова.');
          return;
        }
        if (resp.status === 404) {
          if (approvedHandled) { stopPolling(); return; }
          stopPolling();
          setAuthState('error');
          setError('Ошибка авторизации. Попробуйте снова.');
          return;
        }
        if (!resp.ok && resp.status >= 400) {
          stopPolling();
          setAuthState('error');
          setError(`Ошибка авторизации (${resp.status}).`);
          return;
        }

        const data = resp.data as { status?: string; jwt?: string; refresh_token?: string; user?: User } | null;
        const status = data?.status;

        if (status === 'approved' && data?.jwt && data?.user?.id && data?.user?.name) {
          approvedHandled = true;
          stopPolling();
          saveTokens(data.jwt, data.refresh_token ?? null);
          applyUser(data.user);
          setAuthState('success');
          invoke('set_auth_status', { isAuthenticated: true, userName: data.user.name }).catch(() => {});
          // Pull the authoritative plan right away so the gate can decide.
          refreshMe();
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
        delayMs = baseDelayMs;
        pollingRef.current = setTimeout(tick, delayMs);
      };

      pollingRef.current = setTimeout(tick, baseDelayMs);
    } catch (e) {
      setAuthState('error');
      setError(String(e));
    }
  }, [applyUser, refreshMe, stopPolling]);

  const cancelLogin = useCallback(() => {
    cancelledRef.current = true;
    stopPolling();
    setAuthState('idle');
    setError('');
  }, [stopPolling]);

  const logout = useCallback(async () => {
    import('../sync/sessionSync').then(({ logoutFromServer }) => { logoutFromServer(); });
    stopPolling();
    clearSession();
    setUser(null);
    setAuthState('idle');
    setError('');
    invoke('set_auth_status', { isAuthenticated: false, userName: '' }).catch(() => {});
  }, [stopPolling]);

  const value: AuthContextValue = {
    user,
    authState,
    error,
    waitSeconds,
    planLoading,
    hasPro: !!user && hasActivePro(user),
    login,
    cancelLogin,
    logout,
    refreshMe,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
