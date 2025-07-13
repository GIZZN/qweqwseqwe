'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { HotkeyBinding, HotkeySettings, RecordingState } from './hotkeys/types';
import HotkeysHeader from './hotkeys/HotkeysHeader';
import RecordingStatus from './hotkeys/RecordingStatus';
import MainSettings from './hotkeys/MainSettings';
import HotkeyBindingsList from './hotkeys/HotkeyBindingsList';
import HotkeyBindingForm from './hotkeys/HotkeyBindingForm';
import RecordingHistory from './hotkeys/RecordingHistory';

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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showForm, setShowForm] = useState(false);
  const [editingBinding, setEditingBinding] = useState<HotkeyBinding | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadSettings();
    loadRecordingState();
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

  const saveSettings = async (newSettings: HotkeySettings) => {
    setSaveStatus('saving');
    try {
      await invoke('save_hotkey_settings', { settings: newSettings });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Ошибка сохранения настроек:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleGlobalToggle = async (enabled: boolean) => {
    const newSettings = { ...settings, global_enabled: enabled };
    setSettings(newSettings);
    await saveSettings(newSettings);
    
    // Регистрируем или отменяем регистрацию всех активных горячих клавиш
    if (enabled) {
      for (const binding of newSettings.bindings) {
        if (binding.is_enabled) {
          try {
            await invoke('register_hotkey', {
              hotkeyString: binding.key_combination,
              action: binding.action_type
            });
          } catch (error) {
            console.error(`Ошибка регистрации горячей клавиши ${binding.key_combination}:`, error);
          }
        }
      }
    } else {
      // Отменяем регистрацию всех горячих клавиш
      for (const binding of settings.bindings) {
        if (binding.is_enabled) {
          try {
            await invoke('unregister_hotkey', { action: binding.action_type });
          } catch (error) {
            console.error(`Ошибка отмены регистрации горячей клавиши ${binding.action_type}:`, error);
          }
        }
      }
    }
  };

  const handleSettingChange = (key: keyof HotkeySettings, value: string | boolean | number) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleToggleBinding = async (bindingId: string) => {
    try {
      const isEnabled = await invoke<boolean>('toggle_hotkey_binding', { bindingId });
      
      const binding = settings.bindings.find(b => b.id === bindingId);
      if (binding && settings.global_enabled) {
        if (isEnabled) {
          // Регистрируем горячую клавишу
          await invoke('register_hotkey', {
            hotkeyString: binding.key_combination,
            action: binding.action_type
          });
        } else {
          // Отменяем регистрацию
          await invoke('unregister_hotkey', { action: binding.action_type });
        }
      }
      
      setSettings(prev => ({
        ...prev,
        bindings: prev.bindings.map(b => 
          b.id === bindingId ? { ...b, is_enabled: isEnabled } : b
        )
      }));
    } catch (error) {
      console.error('Ошибка переключения привязки:', error);
    }
  };

  const handleDeleteBinding = async (bindingId: string) => {
    if (!confirm('Удалить эту привязку клавиш?')) return;
    
    try {
      const binding = settings.bindings.find(b => b.id === bindingId);
      
      // Сначала отменяем регистрацию горячей клавиши
      if (binding && binding.is_enabled && settings.global_enabled) {
        await invoke('unregister_hotkey', { action: binding.action_type });
      }
      
      // Удаляем из backend
      await invoke('delete_hotkey_binding', { bindingId });
      
      // Обновляем состояние
      setSettings(prev => ({
        ...prev,
        bindings: prev.bindings.filter(b => b.id !== bindingId)
      }));
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

  const testHotkey = async (keyCombination: string) => {
    try {
      await invoke('test_hotkey_combination', { keyCombination });
      alert('Комбинация клавиш валидна!');
    } catch (error) {
      alert(`Ошибка: ${error}`);
    }
  };

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
        // Редактирование существующей привязки
        const updatedBinding: HotkeyBinding = {
          ...editingBinding,
          ...bindingData,
        };
        
        // Обновляем в backend
        await invoke('update_hotkey_binding', { binding: updatedBinding });
        
        // Перерегистрируем горячую клавишу если нужно
        if (settings.global_enabled && updatedBinding.is_enabled) {
          try {
            // Сначала отменяем старую регистрацию
            await invoke('unregister_hotkey', { action: editingBinding.action_type });
            // Регистрируем новую
            await invoke('register_hotkey', {
              hotkeyString: updatedBinding.key_combination,
              action: updatedBinding.action_type
            });
          } catch (error) {
            console.error('Ошибка перерегистрации горячей клавиши:', error);
          }
        }
        
        // Обновляем состояние
        setSettings(prev => ({
          ...prev,
          bindings: prev.bindings.map(b => 
            b.id === editingBinding.id ? updatedBinding : b
          )
        }));
      } else {
        // Добавление новой привязки
        const newBinding = await invoke<HotkeyBinding>('add_hotkey_binding', {
          name: bindingData.name,
          description: bindingData.description,
          key_combination: bindingData.key_combination,
          action_type: bindingData.action_type
        });
        
        // Регистрируем горячую клавишу если настройки включены
        if (settings.global_enabled && bindingData.is_enabled) {
          try {
            await invoke('register_hotkey', {
              hotkeyString: bindingData.key_combination,
              action: bindingData.action_type
            });
          } catch (error) {
            console.error('Ошибка регистрации новой горячей клавиши:', error);
          }
        }
        
        // Обновляем состояние
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
            
            <RecordingStatus 
              recordingState={recordingState}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onShowHistory={() => setShowHistory(true)}
              formatDuration={formatDuration}
            />
            
            <MainSettings 
              settings={settings}
              onGlobalToggle={handleGlobalToggle}
              onSettingChange={handleSettingChange}
            />
            
            <HotkeyBindingsList 
              bindings={settings.bindings}
              onToggleBinding={handleToggleBinding}
              onDeleteBinding={handleDeleteBinding}
              onEditBinding={handleEditBinding}
              onTestHotkey={testHotkey}
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