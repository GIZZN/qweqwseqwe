/**
 * Data models for the "Легенда опыта" (experience legend) overlay feature.
 */

/** One experience entry — an "info block" shown/edited in the overlay and profile. */
export interface ExperienceBlock {
  id: string;
  company: string;
  role: string;
  period: string;
  stack: string[];
  bullets: string[];
  story?: string;
  /** Optional link to an Obsidian note this block was derived from. */
  sourceNotePath?: string;
}

export type DockEdge = 'left' | 'right';

/** Full persisted state of the legend feature (single localStorage entry). */
export interface LegendData {
  blocks: ExperienceBlock[];
  obsidianVaultPath: string;
  /** Overlay background opacity, 0.1–1. */
  overlayOpacity: number;
  dockEdge: DockEdge;
  alwaysOnTop: boolean;
}

/** A markdown note discovered in an Obsidian vault. */
export interface ObsidianNote {
  name: string;
  path: string;
  /** Last-modified time, ms since epoch. */
  modified: number;
}
