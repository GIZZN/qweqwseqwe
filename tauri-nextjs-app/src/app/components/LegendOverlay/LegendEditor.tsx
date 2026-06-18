'use client';

import clsx from 'clsx';
import type { ExperienceBlock } from '../../features/legend';

interface Props {
  blocks: ExperienceBlock[];
  onChange: (id: string, patch: Partial<ExperienceBlock>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  /** Compact spacing for embedding inside the Profile page. */
  compact?: boolean;
}

const input = clsx('bg-white/[0.05]', 'px-2.5', 'py-1.5', 'border', 'border-white/10', 'focus:border-[#1CCDAA]/40', 'rounded-md', 'focus:outline-none', 'w-full', 'text-white', 'text-xs', 'placeholder-white/30');

/** CRUD form for experience blocks. Shared between the overlay window and Profile. */
export default function LegendEditor({ blocks, onChange, onAdd, onRemove, compact }: Props) {
  const toList = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean);

  return (
    <div className={clsx(compact ? 'space-y-3' : 'space-y-4')}>
      {blocks.length === 0 && (
        <p className={clsx('py-4', 'text-white/40', 'text-xs', 'text-center')}>Пока нет записей опыта. Добавьте первую.</p>
      )}

      {blocks.map(b => (
        <div key={b.id} className={clsx('bg-white/[0.02]', 'space-y-2', 'p-3', 'border', 'border-white/10', 'rounded-lg')}>
          <div className={clsx('flex', 'justify-between', 'items-center')}>
            <span className={clsx('text-white/40', 'text-[10px]', 'uppercase', 'tracking-wide')}>Запись</span>
            <button
              onClick={() => onRemove(b.id)}
              className={clsx('hover:bg-red-500/10', 'px-2', 'py-0.5', 'border', 'border-red-500/30', 'rounded', 'text-red-400', 'text-[10px]', 'transition-colors')}
            >Удалить</button>
          </div>
          <div className={clsx('gap-2', 'grid', 'grid-cols-2')}>
            <input className={input} placeholder="Компания" value={b.company} onChange={e => onChange(b.id, { company: e.target.value })} />
            <input className={input} placeholder="Должность" value={b.role} onChange={e => onChange(b.id, { role: e.target.value })} />
          </div>
          <input className={input} placeholder="Период (напр. 2021–2024)" value={b.period} onChange={e => onChange(b.id, { period: e.target.value })} />
          <input className={input} placeholder="Стек через запятую: React, TS, Next" value={b.stack.join(', ')} onChange={e => onChange(b.id, { stack: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} />
          <textarea className={clsx(input, 'resize-none')} rows={3} placeholder="Тезисы — по одному в строке" value={b.bullets.join('\n')} onChange={e => onChange(b.id, { bullets: toList(e.target.value) })} />
          <textarea className={clsx(input, 'resize-none')} rows={3} placeholder="STAR-история (Situation, Task, Action, Result)" value={b.story ?? ''} onChange={e => onChange(b.id, { story: e.target.value })} />
        </div>
      ))}

      <button
        onClick={onAdd}
        className={clsx('hover:bg-white/[0.05]', 'py-2', 'border', 'border-white/15', 'border-dashed', 'rounded-lg', 'w-full', 'text-white/60', 'hover:text-white/80', 'text-xs', 'transition-colors')}
      >+ Добавить запись опыта</button>
    </div>
  );
}
