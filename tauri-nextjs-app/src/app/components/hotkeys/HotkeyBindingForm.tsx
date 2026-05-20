'use client';
import React, { useState } from 'react';
import { HotkeyBinding, actionTypes } from './types';
import CustomSelect from './CustomSelect';

interface HotkeyBindingFormProps {
  binding?: HotkeyBinding | null;
  onSave: (binding: Omit<HotkeyBinding, 'id' | 'created_at'>) => Promise<void>;
  onCancel: () => void;
}

export default function HotkeyBindingForm({ binding, onSave, onCancel }: HotkeyBindingFormProps) {
  const [formData, setFormData] = useState({
    name: binding?.name || '',
    description: binding?.description || '',
    key_combination: binding?.key_combination || '',
    action_type: binding?.action_type || actionTypes[0].value,
    is_enabled: binding?.is_enabled ?? true,
  });
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isRecording) return;
    e.preventDefault();
    if (!e.ctrlKey) return;
    let key = e.key;
    if (key === ' ') key = 'Space';
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return;
    if (key.length === 1) key = key.toUpperCase();
    const combination = e.shiftKey ? `Ctrl+Shift+${key}` : `Ctrl+${key}`;
    setFormData(prev => ({ ...prev, key_combination: combination }));
    setIsRecording(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.name.trim()) { setError('Название обязательно'); return; }
    if (!formData.key_combination.trim()) { setError('Комбинация клавиш обязательна'); return; }
    setIsSubmitting(true);
    try { await onSave(formData); }
    catch (err) { setError(err instanceof Error ? err.message : 'Ошибка сохранения'); setIsSubmitting(false); }
  };

  const inputCls = "w-full px-3 py-2 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#1CCDAA]/40 transition-colors";

  return (
    <div className="z-50 fixed inset-0 flex justify-center items-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111111] p-6 border border-white/[0.08] rounded-xl w-full max-w-md">
        <h2 className="mb-5 font-semibold text-white text-lg">
          {binding ? 'Редактировать привязку' : 'Добавить привязку'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1.5 text-white/50 text-xs">Название</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className={inputCls}
              placeholder="Например: Стандартный курсор"
            />
          </div>

          <div>
            <label className="block mb-1.5 text-white/50 text-xs">Описание</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className={`${inputCls} resize-none`}
              rows={2}
              placeholder="Краткое описание действия"
            />
          </div>

          <div>
            <label className="block mb-1.5 text-white/50 text-xs">Комбинация клавиш</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.key_combination}
                onChange={e => setFormData(prev => ({ ...prev, key_combination: e.target.value }))}
                onKeyDown={handleKeyDown}
                className={inputCls}
                placeholder={isRecording ? 'Нажмите Ctrl+Клавиша...' : 'Ctrl+1'}
                readOnly={isRecording}
              />
              <button
                type="button"
                onClick={() => { setIsRecording(!isRecording); if (!isRecording) setFormData(prev => ({ ...prev, key_combination: '' })); }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isRecording
                    ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                    : 'bg-white/[0.05] border border-white/[0.1] text-white/60 hover:text-white/80'
                }`}
              >
                {isRecording ? 'Стоп' : 'Записать'}
              </button>
            </div>
            {isRecording && <p className="mt-1 text-[#1CCDAA] text-xs">Нажмите Ctrl + клавишу</p>}
          </div>

          <div>
            <label className="block mb-1.5 text-white/50 text-xs">Действие</label>
            <CustomSelect
              value={formData.action_type}
              onChange={value => setFormData(prev => ({ ...prev, action_type: value }))}
              options={actionTypes}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_enabled}
              onChange={e => setFormData(prev => ({ ...prev, is_enabled: e.target.checked }))}
              className="w-4 h-4 accent-[#1CCDAA]"
            />
            <span className="text-white/60 text-sm">Включить привязку</span>
          </label>

          {error && (
            <div className="bg-red-400/10 px-3 py-2 border border-red-400/20 rounded-lg text-red-400 text-sm">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 hover:bg-white/[0.05] disabled:opacity-50 px-4 py-2 border border-white/[0.1] rounded-lg text-white/60 text-sm transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-[#1CCDAA] hover:bg-[#1CCDAA]/80 disabled:opacity-50 px-4 py-2 rounded-lg font-medium text-black text-sm transition-colors"
            >
              {isSubmitting ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
