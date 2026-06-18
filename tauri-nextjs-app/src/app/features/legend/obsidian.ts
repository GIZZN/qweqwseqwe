/**
 * Thin wrapper over the Rust Obsidian commands. Gracefully degrades when the
 * Tauri runtime is absent (e.g. plain `next dev` in a browser) so the overlay
 * still renders — it just shows no vault notes.
 */

import type { ObsidianNote } from './types';

async function invokeSafe<T>(cmd: string, args: Record<string, unknown>): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch {
    return null;
  }
}

/** List markdown notes in an Obsidian vault folder. Returns [] if unavailable. */
export async function listObsidianNotes(vaultPath: string): Promise<ObsidianNote[]> {
  if (!vaultPath.trim()) return [];
  const res = await invokeSafe<ObsidianNote[]>('list_obsidian_notes', { vaultPath });
  return Array.isArray(res) ? res : [];
}

/** Read a single markdown note's raw content. Returns '' if unavailable. */
export async function readObsidianNote(path: string): Promise<string> {
  if (!path) return '';
  const res = await invokeSafe<string>('read_obsidian_note', { path });
  return typeof res === 'string' ? res : '';
}
