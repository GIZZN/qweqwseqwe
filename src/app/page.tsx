'use client';

import { useState } from 'react';
import InterviewAssistant from './components/FileOperations';
import CustomTitleBar from './components/CustomTitleBar';
import Sidebar from './components/Sidebar';
import Settings from './components/Settings';
import Analytics from './components/Analytics';
import Privacy from './components/Privacy';
import HotkeysRefactored from './components/HotkeysRefactored';

export default function Home() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState<'chat' | 'settings' | 'privacy' | 'analytics' | 'hotkeys' | 'help'>('chat');

  const handleNavigation = (page: string) => {
    setCurrentPage(page as 'chat' | 'settings' | 'privacy' | 'analytics' | 'hotkeys' | 'help');
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'settings':
        return <Settings onClose={() => setCurrentPage('chat')} />;
      case 'analytics':
        return <Analytics onClose={() => setCurrentPage('chat')} />;
      case 'privacy':
        return <Privacy onClose={() => setCurrentPage('chat')} />;
      case 'hotkeys':
        return <HotkeysRefactored />;
      case 'chat':
      default:
        return <InterviewAssistant />;
      }
  };

  return (
    <div className="min-h-screen bg-black/95">
      <CustomTitleBar isSidebarCollapsed={isSidebarCollapsed} />
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onNavigate={handleNavigation}
        currentPage={currentPage}
            />
      <div 
        className={`pt-12 transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-16' : 'ml-64'
        }`}
      >
        {renderCurrentPage()}
        </div>
    </div>
  );
}
