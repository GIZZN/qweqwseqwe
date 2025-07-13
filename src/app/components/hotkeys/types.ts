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

export const actionTypes = [
  { value: 'start_audio_recording', label: 'Начать запись аудио' },
  { value: 'stop_recording', label: 'Остановить запись' },
  { value: 'toggle_window_visibility', label: 'Скрыть/показать окно' },
  { value: 'take_screenshot', label: 'Сделать скриншот' },
  { value: 'toggle_microphone', label: 'Вкл/выкл микрофон' },
  { value: 'pause_recording', label: 'Пауза записи' },
];

export const audioQualities = [
  { value: 'low', label: 'Низкое качество' },
  { value: 'medium', label: 'Среднее качество' },
  { value: 'high', label: 'Высокое качество' },
]; 