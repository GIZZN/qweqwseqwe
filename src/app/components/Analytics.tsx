'use client';

import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface AnalyticsResponse {
  id: string;
  question: string;
  response: string;
  timestamp: string;
  session_id: string;
  is_helpful: boolean | null;
  response_time_ms: number;
  model_used: string;
  tokens_used: number;
}

interface AnalyticsStats {
  total_responses: number;
  helpful_responses: number;
  unhelpful_responses: number;
  average_response_time: number;
  total_tokens_used: number;
  most_used_model: string;
}

interface AnalyticsProps {
  onClose: () => void;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

function CustomSelect({ value, onChange, options, placeholder, className = "" }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedOption = options.find(option => option.value === value);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-white focus:outline-none focus:border-white/20 transition-colors flex items-center justify-between min-w-[120px]"
      >
        <span className={selectedOption ? 'text-white' : 'text-white/40'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[#1A1A1A] border border-white/[0.08] rounded-lg shadow-lg max-h-60 overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left hover:bg-white/[0.05] transition-colors first:rounded-t-lg last:rounded-b-lg ${
                option.value === value ? 'bg-white/[0.08] text-white' : 'text-white/80'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Analytics({ onClose }: AnalyticsProps) {
  const [responses, setResponses] = useState<AnalyticsResponse[]>([]);
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'helpful' | 'unhelpful' | 'unrated'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'helpful'>('newest');

  const filterOptions = [
    { value: 'all', label: 'Все' },
    { value: 'helpful', label: 'Полезные' },
    { value: 'unhelpful', label: 'Неполезные' },
    { value: 'unrated', label: 'Без оценки' }
  ];

  const sortOptions = [
    { value: 'newest', label: 'Новые' },
    { value: 'oldest', label: 'Старые' },
    { value: 'helpful', label: 'По оценке' }
  ];

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      const [responsesData, statsData] = await Promise.all([
        invoke<AnalyticsResponse[]>('get_analytics_responses'),
        invoke<AnalyticsStats>('get_analytics_stats'),
      ]);
      setResponses(responsesData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRating = async (responseId: string, isHelpful: boolean) => {
    try {
      await invoke('rate_response', { responseId, isHelpful });
      setResponses(prev => 
        prev.map(resp => 
          resp.id === responseId ? { ...resp, is_helpful: isHelpful } : resp
        )
      );
      // Обновляем статистику
      await loadAnalytics();
    } catch (error) {
      console.error('Error rating response:', error);
    }
  };

  const clearAnalytics = async () => {
    try {
      await invoke('clear_analytics');
      setResponses([]);
      setStats(null);
    } catch (error) {
      console.error('Error clearing analytics:', error);
    }
  };

  const filteredResponses = responses.filter(response => {
    switch (filter) {
      case 'helpful':
        return response.is_helpful === true;
      case 'unhelpful':
        return response.is_helpful === false;
      case 'unrated':
        return response.is_helpful === null;
      default:
        return true;
    }
  });

  const sortedResponses = [...filteredResponses].sort((a, b) => {
    switch (sortBy) {
      case 'oldest':
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      case 'helpful':
        if (a.is_helpful === b.is_helpful) return 0;
        if (a.is_helpful === true) return -1;
        if (b.is_helpful === true) return 1;
        if (a.is_helpful === false) return -1;
        return 1;
      default: // newest
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }
  });

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}мс`;
    return `${(ms / 1000).toFixed(1)}с`;
  };

  const getHelpfulnessRate = () => {
    if (!stats || stats.total_responses === 0) return 0;
    const rated = stats.helpful_responses + stats.unhelpful_responses;
    if (rated === 0) return 0;
    return Math.round((stats.helpful_responses / rated) * 100);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-[#0A0A0A] overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          <div className="max-w-6xl mx-auto w-full">
            {/* Заголовок */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <button
                  onClick={onClose}
                  className="p-2 text-white/60 hover:text-white/80 hover:bg-white/[0.05] rounded-lg transition-colors"
                  title="Назад"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <h1 className="text-2xl font-semibold text-white">Аналитика</h1>
              </div>
              
              <button
                onClick={clearAnalytics}
                className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-600/10 border border-red-600/30 rounded-lg transition-colors text-sm"
              >
                Очистить историю
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border border-white/20 border-t-white/60 rounded-full animate-spin"></div>
              </div>
            ) : (
              <>
                {/* Статистика */}
                {stats && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="border border-white/[0.08] rounded-lg p-4 bg-white/[0.02]">
                      <h3 className="text-sm font-medium text-white/60 mb-1">Всего ответов</h3>
                      <p className="text-2xl font-semibold text-white">{stats.total_responses}</p>
                    </div>
                    <div className="border border-white/[0.08] rounded-lg p-4 bg-white/[0.02]">
                      <h3 className="text-sm font-medium text-white/60 mb-1">Полезность</h3>
                      <p className="text-2xl font-semibold text-[#1CCDAA]">{getHelpfulnessRate()}%</p>
                    </div>
                    <div className="border border-white/[0.08] rounded-lg p-4 bg-white/[0.02]">
                      <h3 className="text-sm font-medium text-white/60 mb-1">Среднее время</h3>
                      <p className="text-2xl font-semibold text-white">{formatDuration(stats.average_response_time)}</p>
                    </div>
                    <div className="border border-white/[0.08] rounded-lg p-4 bg-white/[0.02]">
                      <h3 className="text-sm font-medium text-white/60 mb-1">Токены</h3>
                      <p className="text-2xl font-semibold text-white">{stats.total_tokens_used.toLocaleString()}</p>
                    </div>
                  </div>
                )}

                {/* Фильтры */}
                <div className="flex flex-wrap items-center gap-4 mb-6">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-white/60">Фильтр:</span>
                    <CustomSelect
                      value={filter}
                      onChange={(value) => setFilter(value as 'all' | 'helpful' | 'unhelpful' | 'unrated')}
                      options={filterOptions}
                      placeholder="Выберите фильтр"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-white/60">Сортировка:</span>
                    <CustomSelect
                      value={sortBy}
                      onChange={(value) => setSortBy(value as 'newest' | 'oldest' | 'helpful')}
                      options={sortOptions}
                      placeholder="Выберите сортировку"
                    />
                  </div>
                </div>

                {/* История ответов */}
                <div className="space-y-4">
                  {sortedResponses.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="w-12 h-12 text-white/20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <p className="text-white/60">Нет данных для отображения</p>
                    </div>
                  ) : (
                    sortedResponses.map((response) => (
                      <div key={response.id} className="border border-white/[0.08] rounded-lg p-6 bg-white/[0.02]">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <span className="text-xs text-white/40">{formatDate(response.timestamp)}</span>
                              <span className="text-xs px-2 py-1 bg-white/[0.05] rounded text-white/60">
                                {response.model_used}
                              </span>
                              <span className="text-xs text-white/40">
                                {formatDuration(response.response_time_ms)}
                              </span>
                              <span className="text-xs text-white/40">
                                {response.tokens_used} токенов
                              </span>
                            </div>
                            <h3 className="text-white font-medium mb-2">Вопрос:</h3>
                            <p className="text-white/80 mb-4 text-sm bg-white/[0.03] p-3 rounded">
                              {response.question}
                            </p>
                            <h3 className="text-white font-medium mb-2">Ответ:</h3>
                            <p className="text-white/70 text-sm leading-relaxed">
                              {response.response}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between pt-4 border-t border-white/[0.05]">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-white/60">Был ли ответ полезным?</span>
                            {response.is_helpful !== null && (
                              <span className={`text-xs px-2 py-1 rounded ${
                                response.is_helpful 
                                  ? 'bg-[#1CCDAA]/20 text-[#1CCDAA]' 
                                  : 'bg-red-600/20 text-red-400'
                              }`}>
                                {response.is_helpful ? 'Полезный' : 'Неполезный'}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleRating(response.id, true)}
                              className={`p-2 rounded-lg transition-colors ${
                                response.is_helpful === true
                                  ? 'bg-[#1CCDAA]/20 text-[#1CCDAA]'
                                  : 'text-white/40 hover:text-[#1CCDAA] hover:bg-[#1CCDAA]/10'
                              }`}
                              title="Полезный ответ"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleRating(response.id, false)}
                              className={`p-2 rounded-lg transition-colors ${
                                response.is_helpful === false
                                  ? 'bg-red-600/20 text-red-400'
                                  : 'text-white/40 hover:text-red-400 hover:bg-red-600/10'
                              }`}
                              title="Неполезный ответ"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.106-1.79l-.05-.025A4 4 0 0011.157 2H5.741a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.439 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}