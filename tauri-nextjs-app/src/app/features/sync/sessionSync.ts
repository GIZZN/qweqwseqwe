/**
 * Session Sync Service
 * Sends desktop app session data to the web dashboard API.
 * Uses Rust proxy to bypass webview CSP in production builds.
 */

import { invoke } from '@tauri-apps/api/core';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://diplom-chi-ten.vercel.app';

export interface SessionEvent {
  type: 'chat_message' | 'live_answer' | 'screen_analysis';
  question: string;
  answer: string;
  model: string;
  responseTimeMs: number;
  tokensUsed?: number;
  sessionId?: string;
}

function getJwt(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('auth_jwt') || '';
}

export async function syncSessionEvent(event: SessionEvent): Promise<void> {
  const jwt = getJwt();
  if (!jwt) return;

  const body = JSON.stringify({
    type: event.type,
    question: event.question.slice(0, 1000),
    answer: event.answer.slice(0, 5000),
    model: event.model,
    response_time_ms: event.responseTimeMs,
    tokens_used: event.tokensUsed || Math.floor(event.answer.length / 4),
    session_id: event.sessionId || 'desktop',
    created_at: new Date().toISOString(),
  });

  try {
    await invoke('ai_proxy_request', {
      endpoint: `${BASE_URL}/api/desktop/sessions`,
      apiKey: jwt,
      body,
    });
  } catch {
    // Fallback to direct fetch
    try {
      await fetch(`${BASE_URL}/api/desktop/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        mode: 'cors',
        body,
      });
    } catch {}
  }
}

export async function logoutFromServer(): Promise<void> {
  const jwt = getJwt();
  if (!jwt) return;
  try {
    await invoke('ai_proxy_request', {
      endpoint: `${BASE_URL}/api/auth/logout`,
      apiKey: jwt,
      body: '{}',
    });
  } catch {
    try {
      await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        mode: 'cors',
      });
    } catch {}
  }
}
