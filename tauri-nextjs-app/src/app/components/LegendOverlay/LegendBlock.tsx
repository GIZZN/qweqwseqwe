'use client';

import { useState } from 'react';
import clsx from 'clsx';
import type { ExperienceBlock } from '../../features/legend';

interface Props {
  block: ExperienceBlock;
  defaultOpen?: boolean;
}

/** Read-only, expandable view of one experience entry (teleprompter style). */
export default function LegendBlock({ block, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const title = block.company || block.role || 'Без названия';

  return (
    <div className={clsx('bg-white/[0.04]', 'border', 'border-white/10', 'rounded-lg', 'overflow-hidden')}>
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx('flex', 'justify-between', 'items-center', 'gap-2', 'hover:bg-white/[0.03]', 'px-3', 'py-2', 'w-full', 'text-left', 'transition-colors')}
      >
        <div className={clsx('min-w-0')}>
          <div className={clsx('font-semibold', 'text-white', 'text-sm', 'truncate')}>{title}</div>
          <div className={clsx('text-white/50', 'text-xs', 'truncate')}>
            {[block.role, block.period].filter(Boolean).join(' · ')}
          </div>
        </div>
        <span className={clsx('text-white/40', 'text-xs', 'transition-transform', open && 'rotate-180')}>▾</span>
      </button>

      {open && (
        <div className={clsx('space-y-2', 'px-3', 'pt-1', 'pb-3', 'border-white/5', 'border-t')}>
          {block.stack.length > 0 && (
            <div className={clsx('flex', 'flex-wrap', 'gap-1')}>
              {block.stack.map((t, i) => (
                <span key={i} className={clsx('bg-white/[0.06]', 'px-1.5', 'py-0.5', 'rounded', 'text-white/70', 'text-[10px]')}>{t}</span>
              ))}
            </div>
          )}
          {block.bullets.length > 0 && (
            <ul className={clsx('space-y-1', 'pl-4', 'text-white/80', 'text-xs', 'list-disc', 'leading-relaxed')}>
              {block.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          )}
          {block.story && (
            <p className={clsx('text-white/70', 'text-xs', 'whitespace-pre-wrap', 'leading-relaxed')}>{block.story}</p>
          )}
        </div>
      )}
    </div>
  );
}
