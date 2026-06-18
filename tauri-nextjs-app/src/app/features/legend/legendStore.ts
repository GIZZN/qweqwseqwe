/**
 * Single source of truth for the "Легенда опыта" feature, persisted in localStorage.
 * Both the overlay window and the Profile block read/write through here so edits
 * stay in sync. Mirrors the style of features/aiConfig.ts (SSR-safe, defaults-merged).
 */

import type { ExperienceBlock, LegendData, DockEdge } from './types';

const STORAGE_KEY = 'legend_data';

export const LEGEND_DEFAULTS: LegendData = {
  blocks: [],
  obsidianVaultPath: '',
  overlayOpacity: 0.6,
  dockEdge: 'left',
  alwaysOnTop: true,
};

const hasStorage = (): boolean =>
  typeof globalThis !== 'undefined' &&
  typeof (globalThis as { localStorage?: Storage }).localStorage !== 'undefined';

function clampOpacity(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : LEGEND_DEFAULTS.overlayOpacity;
  return Math.min(1, Math.max(0.1, n));
}

function normalizeEdge(v: unknown): DockEdge {
  return v === 'left' || v === 'right' ? v : LEGEND_DEFAULTS.dockEdge;
}

function normalizeBlock(raw: Partial<ExperienceBlock> | null | undefined): ExperienceBlock {
  const b = raw || {};
  return {
    id: typeof b.id === 'string' && b.id ? b.id : makeId(),
    company: String(b.company ?? ''),
    role: String(b.role ?? ''),
    period: String(b.period ?? ''),
    stack: Array.isArray(b.stack) ? b.stack.map(String) : [],
    bullets: Array.isArray(b.bullets) ? b.bullets.map(String) : [],
    story: b.story !== undefined ? String(b.story) : undefined,
    sourceNotePath: b.sourceNotePath !== undefined ? String(b.sourceNotePath) : undefined,
  };
}

function makeId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `blk-${Math.floor(performance.now())}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Read the full legend state, merged with defaults and normalized. Never throws. */
export function getLegend(): LegendData {
  if (!hasStorage()) return { ...LEGEND_DEFAULTS, blocks: [] };
  let parsed: Partial<LegendData> = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) parsed = JSON.parse(raw) as Partial<LegendData>;
  } catch {
    parsed = {};
  }
  return {
    blocks: Array.isArray(parsed.blocks) ? parsed.blocks.map(normalizeBlock) : [],
    obsidianVaultPath: typeof parsed.obsidianVaultPath === 'string' ? parsed.obsidianVaultPath : '',
    overlayOpacity: clampOpacity(parsed.overlayOpacity),
    dockEdge: normalizeEdge(parsed.dockEdge),
    alwaysOnTop: typeof parsed.alwaysOnTop === 'boolean' ? parsed.alwaysOnTop : LEGEND_DEFAULTS.alwaysOnTop,
  };
}

/** Merge a partial update into the stored state and persist it. Returns the new state. */
export function saveLegend(partial: Partial<LegendData>): LegendData {
  const next: LegendData = { ...getLegend(), ...partial };
  // Re-normalize the fields a partial may have set to invalid values.
  next.overlayOpacity = clampOpacity(next.overlayOpacity);
  next.dockEdge = normalizeEdge(next.dockEdge);
  next.blocks = Array.isArray(next.blocks) ? next.blocks.map(normalizeBlock) : [];
  if (hasStorage()) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }
  return next;
}

/** Create an empty experience block with a fresh unique id. */
export function makeBlock(): ExperienceBlock {
  return { id: makeId(), company: '', role: '', period: '', stack: [], bullets: [] };
}

export function addBlock(block: ExperienceBlock): LegendData {
  const data = getLegend();
  return saveLegend({ blocks: [...data.blocks, normalizeBlock(block)] });
}

export function updateBlock(id: string, patch: Partial<ExperienceBlock>): LegendData {
  const data = getLegend();
  const blocks = data.blocks.map(b => (b.id === id ? normalizeBlock({ ...b, ...patch, id: b.id }) : b));
  return saveLegend({ blocks });
}

export function removeBlock(id: string): LegendData {
  const data = getLegend();
  return saveLegend({ blocks: data.blocks.filter(b => b.id !== id) });
}

export function reorderBlocks(from: number, to: number): LegendData {
  const data = getLegend();
  const blocks = [...data.blocks];
  if (from < 0 || from >= blocks.length || to < 0 || to >= blocks.length) return data;
  const [moved] = blocks.splice(from, 1);
  blocks.splice(to, 0, moved);
  return saveLegend({ blocks });
}
