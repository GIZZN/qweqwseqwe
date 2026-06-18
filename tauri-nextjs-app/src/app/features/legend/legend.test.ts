/**
 * Unit tests for the legend store (tests-first).
 * Execute: npx tsx src/app/features/legend/legend.test.ts
 */

// --- Minimal in-memory localStorage polyfill for Node ---
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string): void { this.m.set(k, String(v)); }
  removeItem(k: string): void { this.m.delete(k); }
  clear(): void { this.m.clear(); }
}
(globalThis as unknown as { localStorage: MemoryStorage; window: unknown }).localStorage = new MemoryStorage();
(globalThis as unknown as { window: unknown }).window = globalThis;

import {
  getLegend, saveLegend, makeBlock, addBlock, updateBlock, removeBlock, reorderBlocks,
  LEGEND_DEFAULTS,
} from './legendStore';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✅ ${msg}`);
}

function reset() {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage.clear();
}

function runTests() {
  console.log('🧪 legendStore Tests\n');

  // Test 1: defaults on empty storage
  reset();
  const def = getLegend();
  assert(Array.isArray(def.blocks) && def.blocks.length === 0, 'getLegend(): blocks default to []');
  assert(def.obsidianVaultPath === '', 'getLegend(): empty vault path by default');
  assert(def.dockEdge === LEGEND_DEFAULTS.dockEdge, 'getLegend(): default dockEdge');
  assert(def.overlayOpacity === LEGEND_DEFAULTS.overlayOpacity, 'getLegend(): default overlayOpacity');
  assert(def.alwaysOnTop === LEGEND_DEFAULTS.alwaysOnTop, 'getLegend(): default alwaysOnTop');

  // Test 2: makeBlock produces unique ids and empty shape
  reset();
  const b1 = makeBlock();
  const b2 = makeBlock();
  assert(typeof b1.id === 'string' && b1.id.length > 0, 'makeBlock(): non-empty id');
  assert(b1.id !== b2.id, 'makeBlock(): ids are unique');
  assert(Array.isArray(b1.stack) && Array.isArray(b1.bullets), 'makeBlock(): stack/bullets are arrays');

  // Test 3: saveLegend merges partial and persists
  reset();
  saveLegend({ obsidianVaultPath: 'C:/vault' });
  assert(getLegend().obsidianVaultPath === 'C:/vault', 'saveLegend(): persists partial');
  assert(getLegend().blocks.length === 0, 'saveLegend(): partial does not wipe other fields');

  // Test 4: addBlock appends and persists
  reset();
  const added = addBlock({ ...makeBlock(), company: 'ООО Рога' });
  assert(added.blocks.length === 1, 'addBlock(): returns updated data with 1 block');
  assert(getLegend().blocks[0].company === 'ООО Рога', 'addBlock(): persisted to storage');

  // Test 5: updateBlock patches by id
  reset();
  const blk = makeBlock();
  addBlock(blk);
  updateBlock(blk.id, { role: 'Senior Frontend' });
  assert(getLegend().blocks[0].role === 'Senior Frontend', 'updateBlock(): patches matching block');
  updateBlock('nonexistent', { role: 'X' });
  assert(getLegend().blocks[0].role === 'Senior Frontend', 'updateBlock(): unknown id is a no-op');

  // Test 6: removeBlock deletes by id
  reset();
  const r1 = makeBlock(); const r2 = makeBlock();
  addBlock(r1); addBlock(r2);
  removeBlock(r1.id);
  const afterRemove = getLegend().blocks;
  assert(afterRemove.length === 1 && afterRemove[0].id === r2.id, 'removeBlock(): removes only target');

  // Test 7: reorderBlocks moves item
  reset();
  const o1 = { ...makeBlock(), company: 'A' };
  const o2 = { ...makeBlock(), company: 'B' };
  const o3 = { ...makeBlock(), company: 'C' };
  addBlock(o1); addBlock(o2); addBlock(o3);
  reorderBlocks(0, 2); // move A to the end -> B, C, A
  const order = getLegend().blocks.map(b => b.company).join('');
  assert(order === 'BCA', `reorderBlocks(): expected BCA, got ${order}`);

  // Test 8: overlayOpacity is clamped to [0.1, 1]
  reset();
  saveLegend({ overlayOpacity: 5 });
  assert(getLegend().overlayOpacity === 1, 'overlayOpacity clamped to max 1');
  saveLegend({ overlayOpacity: 0 });
  assert(getLegend().overlayOpacity === 0.1, 'overlayOpacity clamped to min 0.1');

  // Test 9: invalid dockEdge falls back to default
  reset();
  saveLegend({ dockEdge: 'top' as unknown as 'left' });
  assert(getLegend().dockEdge === LEGEND_DEFAULTS.dockEdge, 'invalid dockEdge falls back to default');

  // Test 10: corrupt JSON in storage yields defaults, not a throw
  reset();
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage.setItem('legend_data', '{not valid json');
  const recovered = getLegend();
  assert(recovered.blocks.length === 0 && recovered.dockEdge === LEGEND_DEFAULTS.dockEdge, 'corrupt JSON recovers to defaults');

  // Test 11: round-trip serialization preserves a full block
  reset();
  const full = { ...makeBlock(), company: 'X', role: 'Y', period: '2021–2024', stack: ['React', 'TS'], bullets: ['a', 'b'], story: 'S' };
  addBlock(full);
  const back = getLegend().blocks[0];
  assert(back.stack.length === 2 && back.bullets.length === 2 && back.story === 'S', 'round-trip preserves arrays and story');

  console.log('\n✅ All legendStore tests passed!');
}

runTests();
