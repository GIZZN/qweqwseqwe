/**
 * Token Tracker Module (Tauri port)
 * Tracks token usage for images and audio to prevent API quota exhaustion.
 * Pure TypeScript — no OS-specific dependencies.
 */

type TokenType = 'image' | 'audio';

interface TokenEntry {
  timestamp: number;
  count: number;
  type: TokenType;
}

export class TokenTracker {
  private tokens: TokenEntry[] = [];
  private audioStartTime: number | null = null;
  private trackingInterval: ReturnType<typeof setInterval> | null = null;

  addTokens(count: number, type: TokenType = 'image'): void {
    this.tokens.push({ timestamp: Date.now(), count, type });
    this.cleanOldTokens();
  }

  /** Rough OpenAI-like image token estimation. */
  calculateImageTokens(width: number, height: number): number {
    const pixels = width * height;
    if (pixels <= 384 * 384) return 85;
    const tiles = Math.ceil(pixels / (768 * 768));
    return tiles * 85;
  }

  /** 16 tokens per second of audio. */
  trackAudioTokens(): void {
    if (!this.audioStartTime) {
      this.audioStartTime = Date.now();
      return;
    }
    const now = Date.now();
    const elapsedSeconds = (now - this.audioStartTime) / 1000;
    const audioTokens = Math.floor(elapsedSeconds * 16);
    if (audioTokens > 0) {
      this.addTokens(audioTokens, 'audio');
      this.audioStartTime = now;
    }
  }

  private cleanOldTokens(): void {
    const cutoff = Date.now() - 60 * 1000;
    this.tokens = this.tokens.filter(t => t.timestamp > cutoff);
  }

  getTokensInLastMinute(): number {
    this.cleanOldTokens();
    return this.tokens.reduce((sum, t) => sum + t.count, 0);
  }

  shouldThrottle(): boolean {
    if (typeof localStorage === 'undefined') return false;
    if (localStorage.getItem('throttleTokens') !== 'true') return false;

    const maxTokensPerMin = parseInt(localStorage.getItem('maxTokensPerMin') || '500000', 10);
    const throttleAtPercent = parseInt(localStorage.getItem('throttleAtPercent') || '75', 10);
    const threshold = Math.floor((maxTokensPerMin * throttleAtPercent) / 100);
    return this.getTokensInLastMinute() >= threshold;
  }

  reset(): void {
    this.tokens = [];
    this.audioStartTime = null;
  }

  startAutoTracking(intervalMs = 2000): void {
    if (this.trackingInterval) clearInterval(this.trackingInterval);
    this.trackingInterval = setInterval(() => this.trackAudioTokens(), intervalMs);
  }

  stopAutoTracking(): void {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
  }

  getStatistics() {
    this.cleanOldTokens();
    const image = this.tokens.filter(t => t.type === 'image').reduce((s, t) => s + t.count, 0);
    const audio = this.tokens.filter(t => t.type === 'audio').reduce((s, t) => s + t.count, 0);
    return {
      total: this.getTokensInLastMinute(),
      image,
      audio,
      count: this.tokens.length,
    };
  }
}

export const tokenTracker = new TokenTracker();

if (typeof window !== 'undefined') {
  tokenTracker.startAutoTracking(2000);
}

export default tokenTracker;
