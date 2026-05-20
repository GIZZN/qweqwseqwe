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
    action_type: binding?.action_type || 'start_audio_recording',
    is_enabled: binding?.is_enabled ?? true,
  });

  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isRecording) return;
    
    e.preventDefault();
    
    const keys = [];
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');
    if (e.metaKey) keys.push('Win');
    
    // Добавляем основную клавишу
    let mainKey = e.key;
    
    // Преобразуем специальные клавиши
    if (mainKey === ' ') mainKey = 'Space';
    else if (mainKey === 'Control' || mainKey === 'Alt' || mainKey === 'Shift' || mainKey === 'Meta') return;
    else if (mainKey.length === 1) mainKey = mainKey.toUpperCase();
    
    keys.push(mainKey);
    
    if (keys.length > 1) { // Должен быть модификатор + клавиша
      const combination = keys.join('+');
      setFormData(prev => ({ ...prev, key_combination: combination }));
      setIsRecording(false);
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    setFormData(prev => ({ ...prev, key_combination: '' }));
  };

  const stopRecording = () => {
    setIsRecording(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!formData.name.trim()) {
      setError('Название обязательно для заполнения');
      return;
    }
    
    if (!formData.key_combination.trim()) {
      setError('Комбинация клавиш обязательна');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await onSave(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-white mb-6">
          {binding ? 'Редактировать привязку' : 'Добавить привязку'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Название */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Название
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 bg-[#2A2A2A] border border-white/10 rounded-lg text-white 
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
              placeholder="Например: Начать запись"
            />
          </div>

          {/* Описание */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Описание
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 bg-[#2A2A2A] border border-white/10 rounded-lg text-white 
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none"
              rows={2}
              placeholder="Краткое описание действия"
            />
          </div>

          {/* Комбинация клавиш */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Комбинация клавиш
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.key_combination}
                onChange={(e) => setFormData(prev => ({ ...prev, key_combination: e.target.value }))}
                onKeyDown={handleKeyDown}
                className="flex-1 px-3 py-2 bg-[#2A2A2A] border border-white/10 rounded-lg text-white 
                  focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                placeholder={isRecording ? "Нажмите комбинацию клавиш..." : "Ctrl+Shift+R"}
                readOnly={isRecording}
              />
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isRecording
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isRecording ? 'Стоп' : 'Записать'}
              </button>
            </div>
            {isRecording && (
              <p className="text-sm text-blue-400 mt-1">
                Нажмите желаемую комбинацию клавиш (модификатор + клавиша)
              </p>
            )}
          </div>

          {/* Тип действия */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Действие
            </label>
            <CustomSelect
              value={formData.action_type}
              onChange={(value) => setFormData(prev => ({ ...prev, action_type: value }))}
              options={actionTypes}
            />
          </div>

          {/* Включено */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.is_enabled}
              onChange={(e) => setFormData(prev => ({ ...prev, is_enabled: e.target.checked }))}
              className="w-4 h-4 rounded border border-white/20 bg-[#2A2A2A] text-blue-600 
                focus:ring-2 focus:ring-blue-500/50"
            />
            <label htmlFor="enabled" className="text-sm text-white/80">
              Включить привязку
            </label>
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg p-3">
              {error}
            </div>
          )}

          {/* Кнопки */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-white/80 border border-white/20 rounded-lg 
                hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg 
                transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 