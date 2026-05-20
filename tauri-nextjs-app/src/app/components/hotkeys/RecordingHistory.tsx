'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface RecordingHistoryProps {
  onClose: () => void;
}

export default function RecordingHistory({ onClose }: RecordingHistoryProps) {
  const [recordings, setRecordings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    try {
      setIsLoading(true);
      const result = await invoke<string[]>('get_recording_history');
      setRecordings(result);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки записей');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteRecording = async (filename: string) => {
    if (!confirm(`Удалить запись "${filename}"?`)) return;
    
    try {
      await invoke('delete_recording', { filename });
      setRecordings(prev => prev.filter(r => r !== filename));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления записи');
    }
  };

  const formatFileSize = () => {
    // Заглушка для размера файла - в реальном приложении можно получить из backend
    return 'Неизвестно';
  };

  const formatDate = (filename: string) => {
    // Извлекаем дату из имени файла (recording_YYYYMMDD_HHMMSS.wav)
    const match = filename.match(/recording_(\d{8})_(\d{6})/);
    if (match) {
      const dateStr = match[1];
      const timeStr = match[2];
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      const hour = timeStr.substring(0, 2);
      const minute = timeStr.substring(2, 4);
      const second = timeStr.substring(4, 6);
      
      return `${day}.${month}.${year} ${hour}:${minute}:${second}`;
    }
    return 'Неизвестно';
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">История записей</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-400/10 border border-red-400/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border border-white/20 border-t-white/60 rounded-full animate-spin"></div>
            </div>
          ) : recordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="w-16 h-16 text-white/40 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <p className="text-white/60 text-lg">Записи не найдены</p>
              <p className="text-white/40 text-sm mt-1">
                Начните запись, чтобы увидеть файлы здесь
              </p>
            </div>
          ) : (
            <div className="overflow-y-auto space-y-2">
              {recordings.map((filename) => (
                <div
                  key={filename}
                  className="flex items-center justify-between p-4 bg-[#2A2A2A] border border-white/10 rounded-lg hover:bg-[#333] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-600/20 rounded-lg">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate">
                          {filename}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-white/60 mt-1">
                          <span>{formatDate(filename)}</span>
                          <span>{formatFileSize()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => deleteRecording(filename)}
                      className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      title="Удалить запись"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 mt-4 border-t border-white/10">
          <span className="text-sm text-white/60">
            {recordings.length} {recordings.length === 1 ? 'запись' : 'записей'}
          </span>
          <button
            onClick={loadRecordings}
            className="px-4 py-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors text-sm"
          >
            Обновить
          </button>
        </div>
      </div>
    </div>
  );
} 