'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { HotkeyBinding, HotkeySettings } from './hotkeys/types';
import HotkeysHeader from './hotkeys/HotkeysHeader';
import MainSettings from './hotkeys/MainSettings';
import HotkeyBindingsList from './hotkeys/HotkeyBindingsList';
import HotkeyBindingForm from './hotkeys/HotkeyBindingForm';

interface HotkeysProps {
  onClose?: () => void;
}

export default function HotkeysRefactored({}: HotkeysProps) {
  const [settings, setSettings] = useState<HotkeySettings>({
    bindings: [],
    global_enabled: true,
    record_system_audio: true,
    record_microphone: false,
    audio_quality: 'medium',
    auto_save_recordings: true,
    recordings_folder: 'recordings',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showForm, setShowForm] = useState(false);
  const [editingBinding, setEditingBinding] = useState<HotkeyBinding | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await invoke('initialize_privacy_hotkeys');
      } catch {}
      loadSettings();
    })();
  }, []);

  const loadSettings = async () => {
    try {
      const result = await invoke<HotkeySettings>('get_hotkey_settings');
      setSettings(result);
    } catch (error) {
      console.error('Ошибка загрузки настроек горячих клавиш:', error);
    } finally {
      setIsLoading(false);
    }
  };


  const registerPrivacyHotkey = async (binding: HotkeyBinding) => {
    try {
      const available = await invoke<boolean>('is_privacy_hotkey_available', { keyCombination: binding.key_combination });
      if (!available) return;
      await invoke('register_privacy_hotkey', {
        actionId: binding.action_type,
        name: binding.name,
        description: binding.description,
        actionType: binding.action_type,
        keyCombination: binding.key_combination,
      });
    } catch (e) {
      console.error('Ошибка регистрации горячей клавиши:', e);
    }
  };

  const unregisterPrivacyHotkey = async (binding: HotkeyBinding) => {
    try {
      await invoke('unregister_privacy_hotkey', { actionId: binding.action_type });
    } catch (e) {
      console.error('Ошибка снятия регистрации горячей клавиши:', e);
    }
  };




  const handleToggleBinding = async (bindingId: string) => {
    const binding = settings.bindings.find(b => b.id === bindingId);
    if (!binding) return;
    const nextEnabled = !binding.is_enabled;

    // Оптимистично меняем локально
    setSettings(prev => ({
      ...prev,
      bindings: prev.bindings.map(b => b.id === bindingId ? { ...b, is_enabled: nextEnabled } : b)
    }));

    try {
      await invoke<boolean>('toggle_hotkey_binding', { bindingId });
      if (settings.global_enabled) {
        if (nextEnabled) {
          await registerPrivacyHotkey({ ...binding, is_enabled: true });
        } else {
          await unregisterPrivacyHotkey(binding);
        }
      }
    } catch (error) {
      console.error('Ошибка переключения привязки:', error);
      // Откат состояния в случае ошибки
      setSettings(prev => ({
        ...prev,
        bindings: prev.bindings.map(b => b.id === bindingId ? { ...b, is_enabled: !nextEnabled } : b)
      }));
    }
  };

  const handleDeleteBinding = async (bindingId: string) => {
    if (!confirm('Удалить эту привязку клавиш?')) return;
    
    try {
      const binding = settings.bindings.find(b => b.id === bindingId);
      
      if (binding && binding.is_enabled && settings.global_enabled) {
        await unregisterPrivacyHotkey(binding);
      }
      
      await invoke('delete_hotkey_binding', { bindingId });
      
      setSettings(prev => ({
        ...prev,
        bindings: prev.bindings.filter(b => b.id !== bindingId)
      }));
    } catch (error) {
      console.error('Ошибка удаления привязки:', error);
    }
  };

  const handleAddBinding = () => {
    setEditingBinding(null);
    setShowForm(true);
  };

  const handleEditBinding = (binding: HotkeyBinding) => {
    setEditingBinding(binding);
    setShowForm(true);
  };

  const handleSaveBinding = async (bindingData: Omit<HotkeyBinding, 'id' | 'created_at'>) => {
    try {
      if (editingBinding) {
        const updatedBinding: HotkeyBinding = {
          ...editingBinding,
          ...bindingData,
        };
        
        await invoke('update_hotkey_binding', { binding: updatedBinding });
        
        if (settings.global_enabled) {
          try {
            await unregisterPrivacyHotkey(editingBinding);
            if (updatedBinding.is_enabled && updatedBinding.key_combination) {
              await registerPrivacyHotkey(updatedBinding);
            }
          } catch (error) {
            console.error('Ошибка перерегистрации горячей клавиши:', error);
          }
        }
        
        setSettings(prev => ({
          ...prev,
          bindings: prev.bindings.map(b => 
            b.id === editingBinding.id ? updatedBinding : b
          )
        }));
      } else {
        const newBinding = await invoke<HotkeyBinding>('add_hotkey_binding', {
          name: bindingData.name,
          description: bindingData.description,
          key_combination: bindingData.key_combination,
          action_type: bindingData.action_type
        });
        
        if (settings.global_enabled && bindingData.is_enabled && bindingData.key_combination) {
          try {
            await registerPrivacyHotkey({ ...newBinding, is_enabled: true });
          } catch (error) {
            console.error('Ошибка регистрации новой горячей клавиши:', error);
          }
        }
        
        setSettings(prev => ({
          ...prev,
          bindings: [...prev.bindings, { ...newBinding, is_enabled: bindingData.is_enabled }]
        }));
      }
      
      setShowForm(false);
      setEditingBinding(null);
    } catch (error) {
      console.error('Ошибка сохранения привязки:', error);
      throw error;
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingBinding(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-48px)] bg-[#0A0A0A] overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border border-white/20 border-t-white/60 rounded-full animate-spin"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-[#0A0A0A] overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 sm:p-4 lg:p-6">
          <div className="max-w-7xl mx-auto w-full">
            <HotkeysHeader saveStatus={saveStatus} />
            
            <MainSettings />
            
            <HotkeyBindingsList 
              bindings={settings.bindings}
              onToggleBinding={handleToggleBinding}
              onDeleteBinding={handleDeleteBinding}
              onEditBinding={handleEditBinding}
              onAddBinding={handleAddBinding}
            />
          </div>
        </div>
      </div>
      
      {showForm && (
        <HotkeyBindingForm
          binding={editingBinding}
          onSave={handleSaveBinding}
          onCancel={handleCancelForm}
        />
      )}
    </div>
  );
} 