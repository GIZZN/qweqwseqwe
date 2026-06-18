'use client';

import React from 'react';

interface State { error: Error | null; }

/**
 * Catches render errors in the legend window so a crash shows a readable message
 * on an opaque background instead of a blank white window.
 */
export default class LegendErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[LegendWindow] render error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#0a0a0a', color: '#fff', minHeight: '100vh', padding: 16, fontSize: 12, fontFamily: 'monospace' }}>
          <div style={{ color: '#ff6b6b', marginBottom: 8 }}>Ошибка рендера окна легенды</div>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error?.stack || this.state.error?.message || this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
