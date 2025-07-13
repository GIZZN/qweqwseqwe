'use client';

import React, { useState, useEffect, useRef } from 'react';

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

export default function CustomSelect({ value, onChange, options, placeholder, className = "" }: CustomSelectProps) {
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
        className="w-full px-2 sm:px-3 py-2 sm:py-2.5 lg:py-3 bg-white/[0.05] border border-white/[0.08] rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-white/20 transition-colors flex items-center justify-between min-w-[100px] sm:min-w-[120px] text-xs sm:text-sm lg:text-base"
      >
        <span className={`truncate ${selectedOption ? 'text-white' : 'text-white/40'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform flex-shrink-0 ml-1 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[#1A1A1A] border border-white/[0.08] rounded-lg sm:rounded-xl shadow-lg max-h-48 sm:max-h-60 overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-2 sm:px-3 py-2 text-left hover:bg-white/[0.05] transition-colors first:rounded-t-lg last:rounded-b-lg text-xs sm:text-sm ${
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