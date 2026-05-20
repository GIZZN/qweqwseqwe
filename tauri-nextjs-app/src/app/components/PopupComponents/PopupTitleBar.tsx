'use client';

import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface PopupTitleBarProps {
  title?: string;
  sizeLabel?: string;
}

export default function PopupTitleBar({ title = 'Camera',}: PopupTitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const maximized = (await invoke('is_maximized')) as boolean;
        setIsMaximized(!!maximized);
      } catch {}
    })();
  }, []);

  const handleClose = async () => {
    try { await invoke('close_window'); } catch {}
  };
  const handleMinimize = async () => {
    try { await invoke('minimize_window'); } catch {}
  };
  const handleMaximize = async () => {
    try {
      if (isMaximized) {
        await invoke('unmaximize_window');
      } else {
        await invoke('maximize_window');
      }
      setIsMaximized(!isMaximized);
    } catch {}
  };

  return (
    <div
      className="w-full h-8 bg-[#0f0f0f] border-b border-white/10 flex items-center px-3 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 mr-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button aria-label="Close" onClick={handleClose} className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors" />
        <button aria-label="Minimize" onClick={handleMinimize} className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-colors" />
        <button aria-label="Maximize" onClick={handleMaximize} className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-500 transition-colors" />
      </div>
      <div className="text-white/80 text-xs">{title}</div>
    </div>
  );
}


