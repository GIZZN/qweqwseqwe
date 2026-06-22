/**
 * Auth session helpers.
 *
 * The desktop app stores the JWT + user profile in localStorage. These helpers
 * add the validity checks the UI was missing:
 *  - client-side `exp` check so an obviously-expired token is never treated as a
 *    live session on startup;
 *  - a server revalidation probe (`GET /api/auth/me`) that fails OPEN — only an
 *    explicit 401/403 invalidates the session, so an offline launch or a backend
 *    that hasn't deployed the route yet keeps the user logged in.
 *  - an `auth:expired` window event so any request that gets a 401 can ask the UI
 *    to drop the session.
 */

import { invoke } from '@tauri-apps/api/core';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://diplom-chi-ten.vercel.app';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  created_at?: string;
  /** Tariff fields — read-only on the desktop, written only by the backend. */
  plan?: 'free' | 'pro';
  pro_expires_at?: string | null;
}

const JWT_KEY = 'auth_jwt';
const REFRESH_KEY = 'auth_refresh';

export function getJwt(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(JWT_KEY) || '';
}

/** The long-lived refresh token issued at pairing (used to mint new JWTs). */
export function getRefreshToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(REFRESH_KEY) || '';
}

/** Persist the access JWT and (if rotated) the refresh token together. */
export function saveTokens(jwt: string, refreshToken?: string | null): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(JWT_KEY, jwt);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user_profile');
  if (!raw) return null;
  try {
    const u = JSON.parse(raw);
    return u && u.id ? (u as StoredUser) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(JWT_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem('user_profile');
}

/** Decode the `exp` claim (seconds since epoch) from a JWT WITHOUT verifying the signature. */
export function getJwtExp(jwt: string): number | null {
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  try {
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    payload = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    const claims = JSON.parse(atob(payload));
    return typeof claims.exp === 'number' ? claims.exp : null;
  } catch {
    return null;
  }
}

/**
 * True only when we can PROVE the token is past its `exp` (minus a small skew).
 * Tokens with no parseable `exp` return false (fail open) — we never log a user
 * out just because we couldn't read the claim.
 */
export function isJwtExpired(jwt: string, skewSeconds = 30): boolean {
  const exp = getJwtExp(jwt);
  if (exp == null) return false;
  return Date.now() / 1000 >= exp - skewSeconds;
}

export type RevalidateResult = 'valid' | 'invalid' | 'unknown';

/**
 * Ask the server whether the stored JWT is still valid.
 *
 * Returns 'invalid' ONLY on an explicit 401/403. Network failures, a missing
 * endpoint (404 — backend route not deployed yet) and 5xx all return 'unknown'
 * so an offline launch never drops a valid session.
 */
export async function revalidateSession(jwt: string): Promise<RevalidateResult> {
  if (!jwt) return 'invalid';
  const url = `${BASE_URL}/api/auth/me`;
  try {
    // Production path: Rust proxy bypasses the tauri:// CORS restriction.
    await invoke<string>('http_proxy_get', { url, bearer: jwt });
    return 'valid';
  } catch (e) {
    const m = String(e).match(/^(\d{3}):/);
    if (m) {
      const status = Number(m[1]);
      if (status === 401 || status === 403) return 'invalid';
      return 'unknown';
    }
    // Not an HTTP error from the proxy — try a direct fetch (dev mode).
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` }, mode: 'cors' });
      if (r.status === 401 || r.status === 403) return 'invalid';
      if (r.ok) return 'valid';
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }
}

export const AUTH_EXPIRED_EVENT = 'auth:expired';

/** Signal the UI that the server rejected our token, so it should drop the session. */
export function notifyAuthExpired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
}

export interface MeResult {
  /** True only on a 2xx with a usable user object. */
  ok: boolean;
  /** HTTP status (401/403 → token rejected; 0/5xx → transient, keep last known). */
  status: number;
  user: StoredUser | null;
}

/**
 * Fetch the authoritative profile (incl. tariff) from `GET /api/auth/me`.
 *
 * This is the SINGLE source of truth for `plan` / `pro_expires_at`. It mirrors
 * `revalidateSession`'s fail-open contract: only 401/403 means "logged out";
 * network errors and 5xx surface as a non-ok result with the original status so
 * the caller can keep showing the last known plan offline.
 */
export async function fetchMe(jwt: string): Promise<MeResult> {
  if (!jwt) return { ok: false, status: 401, user: null };
  const url = `${BASE_URL}/api/auth/me`;
  const pickUser = (data: unknown): StoredUser | null => {
    const u = (data as { user?: StoredUser } | null)?.user;
    return u && u.id ? u : null;
  };
  try {
    // Production path: Rust proxy bypasses the tauri:// CORS restriction.
    const raw = await invoke<string>('http_proxy_get', { url, bearer: jwt });
    return { ok: true, status: 200, user: pickUser(JSON.parse(raw)) };
  } catch (e) {
    const m = String(e).match(/^(\d{3}):/);
    if (m) return { ok: false, status: Number(m[1]), user: null };
    // Not an HTTP error from the proxy — try a direct fetch (dev mode).
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` }, mode: 'cors' });
      const data = await r.json().catch(() => null);
      return { ok: r.ok, status: r.status, user: r.ok ? pickUser(data) : null };
    } catch {
      return { ok: false, status: 0, user: null };
    }
  }
}

export type RefreshResult = 'refreshed' | 'invalid' | 'unknown';

// Single-flight guard: rotating refresh tokens are single-use, so two parallel
// /api/auth/refresh calls would invalidate each other. Everyone awaits one call.
let refreshInFlight: Promise<RefreshResult> | null = null;

/**
 * Exchange the stored refresh token for a fresh JWT via `POST /api/auth/refresh`.
 *
 * Security for the desktop client:
 *  - the refresh token is sent in the POST **body** (never in the URL/query), so it
 *    never lands in server access logs or browser history;
 *  - the request goes through the Rust proxy (`http_proxy_post`) in production;
 *  - calls are single-flighted so token rotation can't race itself.
 *
 * Returns:
 *  - 'refreshed' — got a new JWT (and rotated refresh token), already saved;
 *  - 'invalid'   — refresh token rejected (401/403) → the session is truly dead;
 *  - 'unknown'   — network / 5xx / route missing → keep the session, retry later.
 */
export async function refreshJwt(): Promise<RefreshResult> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async (): Promise<RefreshResult> => {
    const rt = getRefreshToken();
    if (!rt) return 'invalid';
    const url = `${BASE_URL}/api/auth/refresh`;
    const body = JSON.stringify({ refresh_token: rt });
    const handle = (data: unknown): RefreshResult => {
      const d = data as { jwt?: string; refresh_token?: string } | null;
      if (!d?.jwt) return 'unknown';
      saveTokens(d.jwt, d.refresh_token ?? rt); // rotate if a new one is returned
      return 'refreshed';
    };
    try {
      const raw = await invoke<string>('http_proxy_post', { url, bearer: null, body });
      return handle(JSON.parse(raw));
    } catch (e) {
      const m = String(e).match(/^(\d{3}):/);
      if (m) {
        const s = Number(m[1]);
        return s === 401 || s === 403 ? 'invalid' : 'unknown';
      }
      // Not an HTTP error from the proxy — try a direct fetch (dev mode).
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          mode: 'cors',
          body,
        });
        if (r.status === 401 || r.status === 403) return 'invalid';
        if (!r.ok) return 'unknown';
        return handle(await r.json().catch(() => null));
      } catch {
        return 'unknown';
      }
    }
  })();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export interface PlanBadge {
  label: string;
  tier: 'free' | 'pro';
  /** ISO expiry if the Pro plan is time-limited; null for free or lifetime. */
  expires: string | null;
}

/**
 * Derive the display badge from the server's `plan` / `pro_expires_at`.
 * An expired or unparseable `pro_expires_at` collapses to Free — the server
 * does the real downgrade lazily on the next `/api/auth/me`.
 */
export function planBadge(user: Pick<StoredUser, 'plan' | 'pro_expires_at'> | null): PlanBadge {
  if (!user || user.plan !== 'pro') return { label: 'Free', tier: 'free', expires: null };
  if (!user.pro_expires_at) return { label: 'Pro · навсегда', tier: 'pro', expires: null };

  const ms = new Date(user.pro_expires_at).getTime() - Date.now();
  if (!(ms > 0)) return { label: 'Free', tier: 'free', expires: null }; // expired or NaN

  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const left = days >= 1 ? `${days} дн.` : `${hours} ч.`;
  return { label: `Pro · осталось ${left}`, tier: 'pro', expires: user.pro_expires_at };
}

/**
 * True when the user has an ACTIVE Pro plan (lifetime or not-yet-expired).
 * Single source of truth for gating the app — reuses `planBadge`, so expired
 * or unparseable `pro_expires_at` collapses to "not pro".
 */
export function hasActivePro(user: Pick<StoredUser, 'plan' | 'pro_expires_at'> | null): boolean {
  return planBadge(user).tier === 'pro';
}
