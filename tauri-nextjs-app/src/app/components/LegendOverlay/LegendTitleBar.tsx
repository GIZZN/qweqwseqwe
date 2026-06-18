'use client';

import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import type { DockEdge } from '../../features/legend';

async function invokeSafe(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke(cmd, args);
  } catch {
    return null;
  }
}

interface Props {
  dockEdge: DockEdge;
  alwaysOnTop: boolean;
  onDockChange: (edge: DockEdge) => void;
  onAlwaysOnTopChange: (value: boolean) => void;
}

export default function LegendTitleBar({ dockEdge, alwaysOnTop, onDockChange, onAlwaysOnTopChange }: Props) {
  const [aot, setAot] = useState(alwaysOnTop);

  useEffect(() => { setAot(alwaysOnTop); }, [alwaysOnTop]);

  const handleClose = () => { void invokeSafe('close_window'); };
  const handleMinimize = () => { void invokeSafe('minimize_window'); };

  const dock = (edge: DockEdge) => {
    onDockChange(edge);
    void invokeSafe('dock_legend_window', { edge });
  };

  const toggleAot = async () => {
    const next = !aot;
    setAot(next);
    onAlwaysOnTopChange(next);
    await invokeSafe('set_always_on_top', { enabled: next });
  };

  return (
    <div
      className={clsx('flex', 'items-center', 'gap-2', 'bg-[#0f0f0f]/80', 'backdrop-blur-md', 'px-3', 'border-white/10', 'border-b', 'w-full', 'h-8', 'select-none')}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className={clsx('flex', 'items-center', 'gap-2', 'mr-2')} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button aria-label="Закрыть" onClick={handleClose} className={clsx('bg-red-500/80', 'hover:bg-red-500', 'rounded-full', 'w-3', 'h-3', 'transition-colors')} />
        <button aria-label="Свернуть" onClick={handleMinimize} className={clsx('bg-yellow-500/80', 'hover:bg-yellow-500', 'rounded-full', 'w-3', 'h-3', 'transition-colors')} />
      </div>

      <span className={clsx('flex-1', 'text-white/70', 'text-xs', 'truncate')}>Легенда опыта</span>

      <div className={clsx('flex', 'items-center', 'gap-1')} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={() => dock('left')}
          title="К левому краю"
          className={clsx('px-1.5', 'py-0.5', 'rounded', 'text-[10px]', 'transition-colors', dockEdge === 'left' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70')}
        >◧</button>
        <button
          onClick={() => dock('right')}
          title="К правому краю"
          className={clsx('px-1.5', 'py-0.5', 'rounded', 'text-[10px]', 'transition-colors', dockEdge === 'right' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70')}
        >◨</button>
        <button
          onClick={toggleAot}
          title="Поверх всех окон"
          className={clsx('ml-1', 'px-1.5', 'py-0.5', 'rounded', 'text-[10px]', 'transition-colors', aot ? 'bg-[#1CCDAA]/20 text-[#1CCDAA]' : 'text-white/40 hover:text-white/70')}
        >📌</button>
      </div>
    </div>
  );
}
