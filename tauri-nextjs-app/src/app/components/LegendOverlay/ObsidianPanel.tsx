'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { listObsidianNotes, readObsidianNote, type ObsidianNote } from '../../features/legend';

/** Minimal markdown → React renderer (headings, bold, inline code, bullet lists). */
function renderMarkdown(md: string) {
  const lines = md.split('\n');
  return lines.map((line, i) => {
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls = level === 1 ? 'text-sm font-semibold text-white' : level === 2 ? 'text-xs font-semibold text-white/90' : 'text-xs font-medium text-white/80';
      return <div key={i} className={clsx(cls, 'mt-2')}>{renderInline(h[2])}</div>;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      return <div key={i} className={clsx('flex', 'gap-1.5', 'text-white/75', 'text-xs', 'leading-relaxed')}><span className="text-white/40">•</span><span>{renderInline(bullet[1])}</span></div>;
    }
    if (line.trim() === '') return <div key={i} className="h-2" />;
    return <div key={i} className={clsx('text-white/75', 'text-xs', 'leading-relaxed')}>{renderInline(line)}</div>;
  });
}

function renderInline(text: string) {
  // Split on **bold** and `code` while keeping delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="text-white">{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i} className="bg-white/10 px-1 rounded text-[11px]">{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  });
}

interface Props { vaultPath: string; }

export default function ObsidianPanel({ vaultPath }: Props) {
  const [notes, setNotes] = useState<ObsidianNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState<ObsidianNote | null>(null);
  const [content, setContent] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!vaultPath.trim()) { setNotes([]); setError(''); return; }
    setLoading(true); setError('');
    listObsidianNotes(vaultPath)
      .then(n => { if (!cancelled) { setNotes(n); if (n.length === 0) setError('Заметки .md не найдены (или нет доступа к Tauri).'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [vaultPath]);

  const open = async (note: ObsidianNote) => {
    setActive(note);
    setContent('Загрузка…');
    setContent(await readObsidianNote(note.path) || '(пусто)');
  };

  if (!vaultPath.trim()) {
    return <p className={clsx('text-white/40', 'text-xs')}>Укажите папку Obsidian в Профиле, чтобы открывать заметки здесь.</p>;
  }

  if (active) {
    return (
      <div className={clsx('space-y-2')}>
        <button onClick={() => setActive(null)} className={clsx('text-white/50', 'hover:text-white/80', 'text-xs', 'transition-colors')}>← Назад к заметкам</button>
        <div className={clsx('font-medium', 'text-white', 'text-xs')}>{active.name}</div>
        <div className={clsx('bg-black/20', 'p-2', 'border', 'border-white/10', 'rounded-lg', 'max-h-[40vh]', 'overflow-y-auto')}>
          {renderMarkdown(content)}
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('space-y-1.5')}>
      {loading && <p className={clsx('text-white/40', 'text-xs')}>Загрузка заметок…</p>}
      {!loading && error && <p className={clsx('text-white/40', 'text-xs')}>{error}</p>}
      {notes.map(n => (
        <button
          key={n.path}
          onClick={() => open(n)}
          className={clsx('flex', 'items-center', 'gap-2', 'bg-white/[0.03]', 'hover:bg-white/[0.07]', 'px-2.5', 'py-1.5', 'border', 'border-white/10', 'rounded-md', 'w-full', 'text-left', 'transition-colors')}
        >
          <span className="text-white/40 text-xs">📄</span>
          <span className={clsx('flex-1', 'text-white/80', 'text-xs', 'truncate')}>{n.name}</span>
        </button>
      ))}
    </div>
  );
}
