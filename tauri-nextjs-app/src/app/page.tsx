'use client';

import { useState, useEffect } from 'react';
import InterviewAssistant from './components/Chat';
import CustomTitleBar from './components/CustomTitleBar';
import Sidebar from './components/Sidebar';
import Analytics from './components/Analytics';
import Privacy from './components/Privacy';
import HotkeysRefactored from './components/HotkeysRefactored';
import StandardCursor from './components/StandardCursor';
import AISetup from './components/AISetup';
import LiveAssistant from './components/LiveAssistant';
import Profile from './components/Profile';
import Help from './components/Help';
import AuthGate from './components/AuthGate';
import { AuthProvider } from './features/auth/AuthProvider';

export default function Home() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState<'chat' | 'settings' | 'privacy' | 'analytics' | 'hotkeys' | 'help' | 'ai-setup' | 'live'>('chat');
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Migrate only truly dead/removed models from localStorage
    const DEAD_MODELS = [
      'meta-llama/llama-3.1-8b-instruct:free',
      'google/gemini-2.0-flash-exp:free',
      'google/gemma-2-9b-it:free',
    ];
    const currentModel = localStorage.getItem('ai_model') || '';
    if (DEAD_MODELS.includes(currentModel)) {
      localStorage.setItem('ai_model', 'openai/gpt-4o-mini');
    }
    const currentVision = localStorage.getItem('ai_vision_model') || '';
    if (DEAD_MODELS.includes(currentVision)) {
      localStorage.setItem('ai_vision_model', 'openai/gpt-4o-mini');
    }

    const setupDone = localStorage.getItem('ai_setup_complete');
    if (!setupDone) {
      setShowOnboarding(true);
    }
  }, []);

  const handleNavigation = (page: string) => {
    setCurrentPage(page as typeof currentPage);
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'settings':
        return <Profile />;
      case 'analytics':
        return <Analytics onClose={() => setCurrentPage('chat')} />;
      case 'privacy':
        return <Privacy onClose={() => setCurrentPage('chat')} />;
      case 'hotkeys':
        return <HotkeysRefactored />;
      case 'ai-setup':
        return <AISetup />;
      case 'help':
        return <Help />;
      case 'live':
        return <LiveAssistant />;
      case 'chat':
      default:
        return <InterviewAssistant />;
      }
  };

  return (
    <StandardCursor>
      <AuthProvider>
        <div className='bg-black/95'>
          {/* Title bar stays outside the gate so the window is always movable/closable. */}
          <CustomTitleBar isSidebarCollapsed={isSidebarCollapsed} onNavigate={handleNavigation} />
          {/* Everything below — onboarding included — requires auth + active Pro. */}
          <AuthGate>
            {showOnboarding ? (
              <AISetup isOnboarding onComplete={() => setShowOnboarding(false)} />
            ) : (
              <>
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
              </>
            )}
          </AuthGate>
        </div>
      </AuthProvider>
    </StandardCursor>
  );
}
