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
}

export function getJwt(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('auth_jwt') || '';
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
  localStorage.removeItem('auth_jwt');
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
