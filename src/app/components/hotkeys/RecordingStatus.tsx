'use client';

import React from 'react';
import { RecordingState } from './types';

interface RecordingStatusProps {
  recordingState: RecordingState;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onShowHistory: () => void;
  formatDuration: (seconds: number) => string;
}

export default function RecordingStatus({ 
  recordingState, 
  onStartRecording, 
  onStopRecording, 
  onShowHistory,
  formatDuration 
}: RecordingStatusProps) {
  return (
    <div className="relative mb-8 group">
      <div className={`absolute inset-0 rounded-2xl blur-xl transition-all duration-500 ${
        recordingState.is_recording 
          ? 'bg-gradient-to-r from-red-500/30 via-pink-500/20 to-red-500/30 animate-pulse' 
          : 'bg-gradient-to-r from-white/10 via-transparent to-white/10'
      }`}></div>
      <div className="relative backdrop-blur-sm bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3 sm:p-4 lg:p-6 hover:bg-white/[0.04] transition-all duration-300">
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0 mb-4 lg:mb-6">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="relative">
              <div className={`w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center relative overflow-hidden ${
                recordingState.is_recording 
                  ? 'bg-gradient-to-br from-red-500 to-pink-600' 
                  : 'bg-gradient-to-br from-gray-600 to-gray-700'
              }`}>
                {recordingState.is_recording && (
                  <div className="absolute inset-0 bg-red-500 animate-ping opacity-20 rounded-2xl"></div>
                )}
                <svg className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white relative z-10" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
              </div>
              {recordingState.is_recording && (
                <div className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-red-500 rounded-full flex items-center justify-center animate-bounce">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full"></div>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-1 leading-tight">Состояние записи</h2>
              <div className={`inline-flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-semibold ${
                recordingState.is_recording 
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
                  : 'bg-gray-600/20 text-gray-300 border border-gray-600/30'
              }`}>
                <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                  recordingState.is_recording ? 'bg-red-400 animate-pulse' : 'bg-gray-400'
                }`}></div>
                <span>{recordingState.is_recording ? 'Идет запись' : 'Остановлена'}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-center lg:justify-end space-x-2">
            <button
              onClick={onStartRecording}
              disabled={recordingState.is_recording}
              className="group relative inline-flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg sm:rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-red-500/25 text-xs sm:text-sm lg:text-base min-w-0 flex-1 sm:flex-none"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              <span>Начать</span>
            </button>
            
            <button
              onClick={onStopRecording}
              disabled={!recordingState.is_recording}
              className="group relative inline-flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 bg-white/[0.08] hover:bg-white/[0.12] disabled:bg-white/[0.03] disabled:cursor-not-allowed border border-white/[0.12] hover:border-white/[0.2] text-white font-medium rounded-lg sm:rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg text-xs sm:text-sm lg:text-base min-w-0 flex-1 sm:flex-none"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
              </svg>
              <span>Остановить</span>
            </button>
            
            <button
              onClick={onShowHistory}
              className="group relative inline-flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 hover:border-blue-500/50 text-blue-300 font-medium rounded-lg sm:rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg text-xs sm:text-sm lg:text-base min-w-0 flex-1 sm:flex-none"
              title="Просмотр истории записей"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="hidden sm:inline">История</span>
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
          <div className="relative overflow-hidden rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 p-3 sm:p-4">
            <div className="absolute top-0 right-0 w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-blue-500/10 rounded-full -translate-y-6 sm:-translate-y-8 lg:-translate-y-10"></div>
            <div className="relative">
              <div className="flex items-center space-x-2 sm:space-x-3 mb-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                <span className="text-blue-300 text-xs sm:text-sm font-medium uppercase tracking-wider">Длительность</span>
              </div>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-white font-mono">{formatDuration(recordingState.duration_seconds)}</p>
            </div>
          </div>
          
          {recordingState.current_file && (
            <div className="relative overflow-hidden rounded-lg sm:rounded-xl bg-gradient-to-br from-[#1CCDAA]/10 to-[#1CCDAA]/5 border border-[#1CCDAA]/20 p-3 sm:p-4">
              <div className="absolute top-0 right-0 w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-[#1CCDAA]/10 rounded-full -translate-y-6 sm:-translate-y-8 lg:-translate-y-10 translate-x-6 sm:translate-x-8 lg:translate-x-10"></div>
              <div className="relative">
                <div className="flex items-center space-x-2 sm:space-x-3 mb-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#1CCDAA]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[#1CCDAA] text-xs sm:text-sm font-medium uppercase tracking-wider">Файл</span>
                </div>
                <p className="text-white font-semibold truncate text-sm sm:text-base" title={recordingState.current_file}>
                  {recordingState.current_file}
                </p>
              </div>
            </div>
          )}
          
          <div className="relative overflow-hidden rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 p-3 sm:p-4">
            <div className="absolute top-0 right-0 w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-purple-500/10 rounded-full -translate-y-6 sm:-translate-y-8 lg:-translate-y-10 translate-x-6 sm:translate-x-8 lg:translate-x-10"></div>
            <div className="relative">
              <div className="flex items-center space-x-2 sm:space-x-3 mb-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-purple-300 text-xs sm:text-sm font-medium uppercase tracking-wider">Статус</span>
              </div>
              <p className="text-white font-semibold text-sm sm:text-base">
                {recordingState.is_recording ? 'Активна' : 'Готова'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 