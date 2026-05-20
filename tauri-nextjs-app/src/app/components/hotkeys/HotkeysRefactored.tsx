'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { HotkeyBinding, HotkeySettings, RecordingState } from './types';
import HotkeysHeader from './HotkeysHeader';
import RecordingStatus from './RecordingStatus';
import MainSettings from './MainSettings';
import HotkeyBindingsList from './HotkeyBindingsList';
import HotkeyBindingForm from './HotkeyBindingForm';
import RecordingHistory from './RecordingHistory';

export default function HotkeysRefactored() {
  const [settings, setSettings] = useState<HotkeySettings>({
    bindings: [],
    global_enabled: true,
    record_system_audio: true,
    record_microphone: false,
    audio_quality: 'medium',
    auto_save_recordings: true,
    recordings_folder: 'recordings',
  });
  const [recordingState, setRecordingState] = useState<RecordingState>({
    is_recording: false,
    current_file: null,
    start_time: null,
    duration_seconds: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showForm, setShowForm] = useState(false);
  const [editingBinding, setEditingBinding] = useState<HotkeyBinding | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // гарантируем инициализацию privacy hotkeys на стороне Rust
        await invoke('initialize_privacy_hotkeys');
      } catch {}
      loadSettings();
      loadRecordingState();
      await loadRegisteredHotkeys();
    })();
    const interval = setInterval(loadRecordingState, 1000);
    return () => clearInterval(interval);
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

  const loadRecordingState = async () => {
    try {
      const result = await invoke<RecordingState>('get_recording_state');
      setRecordingState(result);
    } catch (error) {
      console.error('Ошибка загрузки состояния записи:', error);
    }
  };



  const loadRegisteredHotkeys = async () => {
    try {
      const list = await invoke<[string, { id: string; name: string; description: string; action_type: string; is_enabled: boolean; } ][]>('get_privacy_hotkeys');
      const map: Record<string, string> = {};
      for (const [combo, action] of list) {
        map[action.action_type] = combo;
      }
    } catch (error) {
      console.error('Ошибка загрузки зарегистрированных хоткеев:', error);
    }
  };

  const registerPrivacyHotkey = async (binding: HotkeyBinding) => {
    await invoke('register_privacy_hotkey', {
      actionId: binding.id,
      name: binding.name,
      description: binding.description,
      actionType: binding.action_type,
      keyCombination: binding.key_combination,
    });
  };

  const unregisterPrivacyHotkey = async (binding: HotkeyBinding) => {
    await invoke('unregister_privacy_hotkey', { actionId: binding.id });
  };



  const handleToggleBinding = async (bindingId: string) => {
    try {
      const isEnabled = await invoke<boolean>('toggle_hotkey_binding', { bindingId });
      
      const binding = settings.bindings.find(b => b.id === bindingId);
      if (binding && settings.global_enabled) {
        if (isEnabled) {
          await registerPrivacyHotkey({ ...binding, is_enabled: true });
        } else {
          await unregisterPrivacyHotkey(binding);
        }
      }
      
      setSettings((prev: HotkeySettings) => ({
        ...prev,
        bindings: prev.bindings.map((b: HotkeyBinding) => 
          b.id === bindingId ? { ...b, is_enabled: isEnabled } : b
        )
      }));
      await loadRegisteredHotkeys();
    } catch (error) {
      console.error('Ошибка переключения привязки:', error);
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
      
      setSettings((prev: HotkeySettings) => ({
        ...prev,
        bindings: prev.bindings.filter(b => b.id !== bindingId)
      }));
      await loadRegisteredHotkeys();
    } catch (error) {
      console.error('Ошибка удаления привязки:', error);
    }
  };

  const startRecording = async () => {
    try {
      await invoke('start_audio_recording');
      loadRecordingState();
    } catch (error) {
      console.error('Ошибка начала записи:', error);
    }
  };

  const stopRecording = async () => {
    try {
      await invoke('stop_audio_recording');
      loadRecordingState();
    } catch (error) {
      console.error('Ошибка остановки записи:', error);
    }
  };

  // testHotkey удалён из UI

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        
        setSettings((prev: HotkeySettings) => ({
          ...prev,
          bindings: prev.bindings.map((b: HotkeyBinding) => 
            b.id === editingBinding.id ? updatedBinding : b
          )
        }));
        await loadRegisteredHotkeys();
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
        
        setSettings((prev: HotkeySettings) => ({
          ...prev,
          bindings: [...prev.bindings, { ...newBinding, is_enabled: bindingData.is_enabled }]
        }));
        await loadRegisteredHotkeys();
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
            
            <RecordingStatus 
              recordingState={recordingState}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onShowHistory={() => setShowHistory(true)}
              formatDuration={formatDuration}
            />
            
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
      
      {showHistory && (
        <RecordingHistory onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}
