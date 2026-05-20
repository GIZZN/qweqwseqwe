export interface HotkeyBinding {
  id: string;
  name: string;
  description: string;
  key_combination: string;
  action_type: string;
  is_enabled: boolean;
  created_at: string;
}

export interface HotkeySettings {
  bindings: HotkeyBinding[];
  global_enabled: boolean;
  record_system_audio: boolean;
  record_microphone: boolean;
  audio_quality: string;
  auto_save_recordings: boolean;
  recordings_folder: string;
}

export interface RecordingState {
  is_recording: boolean;
  current_file: string | null;
  start_time: string | null;
  duration_seconds: number;
}

// Действия приватности (обновлённый список)
export const actionTypes = [
  { value: 'toggle_standard_cursor', label: 'Стандартный курсор' },
  { value: 'toggle_always_on_top', label: 'Поверх всех окон' },
  { value: 'toggle_screen_protection', label: 'Защита от захвата экрана' },
  { value: 'toggle_taskbar_visibility', label: 'Вид в панели задач' },
  { value: 'open_popup_window', label: 'Открыть окно (popup)' },
];

export const audioQualities = [
  { value: 'low', label: 'Низкое качество' },
  { value: 'medium', label: 'Среднее качество' },
  { value: 'high', label: 'Высокое качество' },
]; 