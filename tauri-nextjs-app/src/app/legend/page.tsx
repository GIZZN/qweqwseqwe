'use client';

import LegendWindow from '../components/LegendOverlay/LegendWindow';
import LegendErrorBoundary from '../components/LegendOverlay/LegendErrorBoundary';

export default function LegendPage() {
  return (
    // Fully transparent base so the opacity slider can make the window see-through
    // to the desktop behind it. The only opaque layer is LegendWindow's own
    // rgba(10,10,10,<opacity>) background, which the slider controls.
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <style jsx global>{`
        html { background: transparent !important; }
        body { background: transparent !important; }
        #__next { background: transparent !important; }
      `}</style>

      <LegendErrorBoundary>
        <LegendWindow />
      </LegendErrorBoundary>
    </div>
  );
}
