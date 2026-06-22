'use client';
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import clsx from 'clsx';
import { PROMPT_PRESETS, getSystemPrompt, saveSystemPrompt } from '../features/prompts/presets';
import { planBadge } from '../features/auth/session';
import { useAuth } from '../features/auth/AuthProvider';
import {
  getLegend, saveLegend, makeBlock, addBlock, updateBlock, removeBlock,
  type LegendData, type ExperienceBlock,
} from '../features/legend';
import LegendEditor from './LegendOverlay/LegendEditor';

/**
 * Profile — the authorised settings page. Auth, the pairing login flow and the
 * plan now live in AuthProvider/AuthGate; this component only renders when the
 * gate has already granted access (logged in + active Pro), so it just reads the
 * current user from context and shows profile / tariff / prompt / legend.
 */
export default function Profile() {
  const { user, logout, planLoading } = useAuth();
  const [systemPrompt, setSystemPrompt] = useState('');
  const [promptSaved, setPromptSaved] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [legend, setLegend] = useState<LegendData | null>(null);
  const [, setNowTick] = useState(0); // re-render so the plan countdown stays fresh

  useEffect(() => {
    setSystemPrompt(getSystemPrompt());
    setLegend(getLegend());
    // Tick once a minute so "Pro · осталось N" updates locally between server reads.
    const tick = setInterval(() => setNowTick(t => t + 1), 60 * 1000);
    return () => clearInterval(tick);
  }, []);

  const openLegendWindow = async () => {
    const l = legend || getLegend();
    try {
      await invoke('open_legend_window', { edge: l.dockEdge, alwaysOnTop: l.alwaysOnTop });
    } catch (e) {
      console.error('open_legend_window failed:', e);
    }
  };

  const handleLegendChange = (id: string, patch: Partial<ExperienceBlock>) => { updateBlock(id, patch); setLegend(getLegend()); };
  const handleLegendAdd = () => { addBlock(makeBlock()); setLegend(getLegend()); };
  const handleLegendRemove = (id: string) => { removeBlock(id); setLegend(getLegend()); };
  const handleVaultChange = (path: string) => { setLegend(saveLegend({ obsidianVaultPath: path })); };

  // The gate guarantees a user here; soft guard just in case.
  if (!user) return null;

  const badge = planBadge(user);
  const isPro = badge.tier === 'pro';
  const showSkeleton = planLoading && user.plan == null;

  return (
    <div className={clsx('flex', 'flex-col', 'bg-[#0a0a0a]', 'h-[calc(100vh-48px)]', 'overflow-y-auto', 'text-white')}>
      <div className={clsx('mx-auto', 'p-6', 'w-full', 'max-w-2xl')}>
        <h1 className={clsx('mb-6', 'font-bold', 'text-[22px]')}>Профиль</h1>

        <div className={clsx('bg-white/[0.02]', 'mb-4', 'p-5', 'border', 'border-white/[0.08]', 'rounded-xl')}>
          <div className={clsx('flex', 'items-center', 'gap-4')}>
            <div className={clsx('flex-shrink-0', 'rounded-full', 'w-14', 'h-14', 'overflow-hidden')}>
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className={clsx('w-full', 'h-full', 'object-cover')} />
              ) : (
                <div className={clsx('w-full', 'h-full', 'flex', 'items-center', 'justify-center', 'bg-gradient-to-br', 'from-[#1CCDAA]', 'to-blue-500', 'font-bold', 'text-white', 'text-xl')}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className={clsx('flex-1', 'min-w-0')}>
              <div className={clsx('font-semibold', 'text-lg')}>{user.name}</div>
              <div className={clsx('text-white/50', 'text-sm')}>{user.email}</div>
              {user.created_at && (
                <div className={clsx('mt-0.5', 'text-white/30', 'text-xs')}>
                  Аккаунт с {new Date(user.created_at).toLocaleDateString('ru-RU')}
                </div>
              )}
            </div>
            <button onClick={logout} className={clsx('flex-shrink-0', 'hover:bg-red-500/10', 'px-3', 'py-1.5', 'border', 'border-red-500/30', 'rounded-lg', 'text-red-400', 'text-xs', 'transition-colors')}>
              Выйти
            </button>
          </div>
        </div>

        {/* Тариф — read-only; план приходит с веба по /api/auth/me */}
        <div className={clsx('bg-white/[0.02]', 'mt-4', 'p-5', 'border', 'border-white/[0.08]', 'rounded-xl')}>
          <div className={clsx('flex', 'justify-between', 'items-center')}>
            <h3 className={clsx('font-medium', 'text-white/70', 'text-sm')}>Тариф</h3>
            {showSkeleton ? (
              <span className={clsx('inline-block', 'w-28', 'h-6', 'rounded-full', 'bg-white/[0.08]', 'animate-pulse')} aria-hidden />
            ) : (
              <span
                className={clsx('px-2.5', 'py-1', 'rounded-full', 'font-medium', 'text-xs')}
                style={isPro
                  ? { background: 'rgba(28,205,170,0.15)', color: '#1CCDAA' }
                  : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
              >
                {badge.label}
              </span>
            )}
          </div>
        </div>

        {/* System Prompt Section */}
        <div className={clsx('bg-white/[0.02]', 'mt-4', 'p-5', 'border', 'border-white/[0.08]', 'rounded-xl')}>
          <h3 className={clsx('mb-3', 'font-medium', 'text-white/70', 'text-sm')}>Системный промпт</h3>
          <p className={clsx('mb-4', 'text-white/40', 'text-xs')}>Определяет как AI отвечает на вопросы. Выберите пресет или напишите свой.</p>

          {/* Presets */}
          <div className={clsx('gap-2', 'grid', 'grid-cols-2', 'mb-4')}>
            {PROMPT_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => { setSelectedPreset(preset.id); setSystemPrompt(preset.prompt); }}
                className={`text-left p-3 rounded-lg border transition-colors ${selectedPreset === preset.id ? 'border-[#1CCDAA]/50 bg-[#1CCDAA]/5' : 'border-white/[0.08] hover:border-white/[0.15] bg-white/[0.02]'}`}
              >
                <div className={clsx('font-medium', 'text-white', 'text-sm')}>{preset.name}</div>
                <div className={clsx('mt-0.5', 'text-white/40', 'text-xs')}>{preset.description}</div>
              </button>
            ))}
          </div>

          {/* Custom prompt textarea */}
          <textarea
            value={systemPrompt}
            onChange={e => { setSystemPrompt(e.target.value); setSelectedPreset('custom'); }}
            rows={6}
            placeholder="Введите свой системный промпт..."
            className={clsx('bg-white/[0.05]', 'px-3', 'py-2', 'border', 'border-white/[0.1]', 'focus:border-[#1CCDAA]/40', 'rounded-lg', 'focus:outline-none', 'w-full', 'text-white', 'text-sm', 'resize-none', 'placeholder-white/30')}
          />
          <div className={clsx('flex', 'justify-between', 'items-center', 'mt-2')}>
            <span className={clsx('text-white/30', 'text-xs')}>{systemPrompt.length} символов</span>
            <button
              onClick={() => { saveSystemPrompt(systemPrompt); setPromptSaved(true); setTimeout(() => setPromptSaved(false), 2000); }}
              className={clsx('px-3', 'py-1.5', 'rounded-lg', 'text-xs', 'transition-colors')}
              style={{ background: 'rgba(28,205,170,0.2)', color: '#1CCDAA' }}
            >
              {promptSaved ? '✓ Сохранено' : 'Сохранить'}
            </button>
          </div>
        </div>

        {/* Легенда опыта */}
        <div className={clsx('bg-white/[0.02]', 'mt-4', 'p-5', 'border', 'border-white/[0.08]', 'rounded-xl')}>
          <div className={clsx('flex', 'justify-between', 'items-center', 'mb-1')}>
            <h3 className={clsx('font-medium', 'text-white/70', 'text-sm')}>Легенда опыта</h3>
            <button
              onClick={openLegendWindow}
              className={clsx('px-3', 'py-1.5', 'rounded-lg', 'text-xs', 'transition-colors')}
              style={{ background: 'rgba(28,205,170,0.2)', color: '#1CCDAA' }}
            >
              Открыть окно легенды
            </button>
          </div>
          <p className={clsx('mb-4', 'text-white/40', 'text-xs')}>Записи опыта для оверлей-окна поверх собеседования. Те же данные видны в окне легенды.</p>

          {/* Obsidian vault path */}
          <label className={clsx('block', 'mb-1', 'text-white/50', 'text-xs')}>Папка Obsidian (для заметок-блоков)</label>
          <input
            value={legend?.obsidianVaultPath ?? ''}
            onChange={e => handleVaultChange(e.target.value)}
            placeholder="C:\\Users\\you\\ObsidianVault"
            className={clsx('bg-white/[0.05]', 'mb-4', 'px-3', 'py-2', 'border', 'border-white/[0.1]', 'focus:border-[#1CCDAA]/40', 'rounded-lg', 'focus:outline-none', 'w-full', 'text-white', 'text-sm', 'placeholder-white/30')}
          />

          {legend && (
            <LegendEditor
              blocks={legend.blocks}
              onChange={handleLegendChange}
              onAdd={handleLegendAdd}
              onRemove={handleLegendRemove}
              compact
            />
          )}
        </div>

        <div className={clsx('bg-white/[0.02]', 'mt-4', 'p-5', 'border', 'border-white/[0.08]', 'rounded-xl')}>
          <h3 className={clsx('mb-3', 'font-medium', 'text-white/70', 'text-sm')}>О приложении</h3>
          <div className={clsx('space-y-2', 'text-sm')}>
            <div className={clsx('flex', 'justify-between')}><span className="text-white/50">Версия</span><span>1.0.0</span></div>
            <div className={clsx('flex', 'justify-between')}><span className="text-white/50">Платформа</span><span>Tauri + Next.js</span></div>
            <div className={clsx('flex', 'justify-between')}><span className="text-white/50">AI провайдер</span><span>{localStorage.getItem('ai_provider') || 'openrouter'}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
