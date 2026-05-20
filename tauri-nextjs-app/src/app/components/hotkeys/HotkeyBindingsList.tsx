'use client';
import React from 'react';
import { HotkeyBinding, actionTypes } from './types';

interface HotkeyBindingsListProps {
  bindings: HotkeyBinding[];
  onToggleBinding: (bindingId: string) => void;
  onDeleteBinding: (bindingId: string) => void;
  onEditBinding: (binding: HotkeyBinding) => void;
  onAddBinding: () => void;
}

export default function HotkeyBindingsList({
  bindings, onToggleBinding, onDeleteBinding, onEditBinding, onAddBinding,
}: HotkeyBindingsListProps) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl">
      {/* Header */}
      <div className="flex justify-between items-center px-5 py-4 border-white/[0.06] border-b">
        <div>
          <h2 className="font-semibold text-white text-base">Привязки клавиш</h2>
          <p className="mt-0.5 text-white/40 text-xs">Назначайте сочетания для управления приватностью</p>
        </div>
        <button
          onClick={onAddBinding}
          className="flex items-center gap-1.5 bg-[#1CCDAA] hover:bg-[#1CCDAA]/80 px-3 py-1.5 rounded-lg font-medium text-black text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Добавить
        </button>
      </div>

      {/* List */}
      {bindings.length === 0 ? (
        <div className="flex flex-col justify-center items-center py-16 text-white/25">
          <svg className="opacity-40 mb-3 w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
          </svg>
          <p className="text-sm">Нет привязок</p>
          <button onClick={onAddBinding} className="mt-3 text-[#1CCDAA] text-sm hover:underline">Добавить первую</button>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.05]">
          {bindings.map((binding) => (
            <div key={binding.id} className="hover:bg-white/[0.02] px-5 py-4 transition-colors">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="font-medium text-white text-sm">{binding.name}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                      binding.is_enabled ? 'bg-[#1CCDAA]/15 text-[#1CCDAA]' : 'bg-white/[0.05] text-white/30'
                    }`}>
                      {binding.is_enabled ? 'Активна' : 'Выкл'}
                    </span>
                  </div>
                  {binding.description && (
                    <p className="mb-2 text-white/40 text-xs leading-relaxed">{binding.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-white/30 uppercase tracking-wider">Клавиши:</span>
                      <kbd className="bg-white/[0.06] px-2 py-0.5 border border-white/[0.1] rounded font-mono text-white text-xs">
                        {binding.key_combination || 'Не назначена'}
                      </kbd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-white/30 uppercase tracking-wider">Функция:</span>
                      <span className="text-white/60 text-xs">
                        {actionTypes.find(a => a.value === binding.action_type)?.label || binding.action_type}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Toggle */}
                  <button
                    onClick={() => onToggleBinding(binding.id)}
                    className={`ui-switch relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      binding.is_enabled ? 'bg-[#1CCDAA]' : 'bg-white/[0.1]'
                    }`}
                  >
                    <span className={`ui-switch__thumb inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      binding.is_enabled ? 'translate-x-5' : 'translate-x-1'
                    }`} />
                  </button>
                  {/* Edit */}
                  <button
                    onClick={() => onEditBinding(binding)}
                    className="hover:bg-white/[0.05] p-1.5 rounded-lg text-white/40 hover:text-white/70 transition-colors"
                    title="Редактировать"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => onDeleteBinding(binding.id)}
                    className="hover:bg-red-500/[0.08] p-1.5 rounded-lg text-white/30 hover:text-red-400 transition-colors"
                    title="Удалить"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
