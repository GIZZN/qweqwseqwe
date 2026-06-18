'use client';

import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  getLegend, saveLegend, makeBlock, addBlock, updateBlock, removeBlock,
  type LegendData, type ExperienceBlock, type DockEdge,
} from '../../features/legend';
import LegendTitleBar from './LegendTitleBar';
import LegendBlock from './LegendBlock';
import LegendEditor from './LegendEditor';
import ObsidianPanel from './ObsidianPanel';

type Tab = 'read' | 'edit' | 'notes';

export default function LegendWindow() {
  const [data, setData] = useState<LegendData | null>(null);
  const [tab, setTab] = useState<Tab>('read');

  useEffect(() => { setData(getLegend()); }, []);

  if (!data) return null;

  const refresh = () => setData(getLegend());

  const setOpacity = (v: number) => setData(saveLegend({ overlayOpacity: v }));
  const setDock = (edge: DockEdge) => setData(saveLegend({ dockEdge: edge }));
  const setAot = (alwaysOnTop: boolean) => setData(saveLegend({ alwaysOnTop }));

  const handleChange = (id: string, patch: Partial<ExperienceBlock>) => { updateBlock(id, patch); refresh(); };
  const handleAdd = () => { addBlock(makeBlock()); refresh(); };
  const handleRemove = (id: string) => { removeBlock(id); refresh(); };

  const tabBtn = (id: Tab, label: string) => (
    <button
      onClick={() => setTab(id)}
      className={clsx('px-2.5', 'py-1', 'rounded-md', 'text-xs', 'transition-colors', tab === id ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80')}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >{label}</button>
  );

  return (
    <div
      className={clsx('flex', 'flex-col', 'h-screen', 'overflow-hidden', 'text-white')}
      style={{ background: `rgba(10,10,10,${data.overlayOpacity})`, backdropFilter: 'blur(6px)' }}
    >
      <LegendTitleBar
        dockEdge={data.dockEdge}
        alwaysOnTop={data.alwaysOnTop}
        onDockChange={setDock}
        onAlwaysOnTopChange={setAot}
      />

      <div className={clsx('flex', 'items-center', 'gap-1', 'px-3', 'py-2', 'border-white/5', 'border-b')}>
        {tabBtn('read', 'Чтение')}
        {tabBtn('edit', 'Редактор')}
        {tabBtn('notes', 'Obsidian')}
      </div>

      <div className={clsx('flex-1', 'space-y-2', 'p-3', 'overflow-y-auto')}>
        {tab === 'read' && (
          data.blocks.length === 0
            ? <p className={clsx('py-6', 'text-white/40', 'text-xs', 'text-center')}>Легенда пуста. Откройте «Редактор» и добавьте опыт.</p>
            : data.blocks.map((b, i) => <LegendBlock key={b.id} block={b} defaultOpen={i === 0} />)
        )}
        {tab === 'edit' && (
          <LegendEditor blocks={data.blocks} onChange={handleChange} onAdd={handleAdd} onRemove={handleRemove} />
        )}
        {tab === 'notes' && <ObsidianPanel vaultPath={data.obsidianVaultPath} />}
      </div>

      {/* Прозрачность — снизу, чтобы быстро подстроить читаемость поверх звонка */}
      <div className={clsx('flex', 'items-center', 'gap-2', 'px-3', 'py-2', 'border-white/5', 'border-t')}>
        <span className={clsx('text-white/40', 'text-[10px]')}>Прозрачность</span>
        <input
          type="range" min={0.1} max={1} step={0.05}
          value={data.overlayOpacity}
          onChange={e => setOpacity(parseFloat(e.target.value))}
          className={clsx('flex-1', 'accent-[#1CCDAA]')}
        />
        <span className={clsx('w-8', 'text-white/40', 'text-[10px]', 'text-right')}>{Math.round(data.overlayOpacity * 100)}%</span>
      </div>
    </div>
  );
}
