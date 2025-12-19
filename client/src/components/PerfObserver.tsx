import React, { useEffect, useState } from 'react';
import { trackSlowComponent } from '../utils/perf';

/**
 * PerfObserver
 * Small component that installs a PerformanceObserver for 'measure' entries
 * and logs/measures slow renders. Place it near root (App or Terminal).
 */
export const PerfObserver: React.FC<{ thresholdMs?: number }> = ({ thresholdMs = 50 }) => {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;

    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const name = entry.name;
        const duration = entry.duration || 0;
        // Send to analytics if above threshold
        if (duration >= thresholdMs) {
          trackSlowComponent(name, duration);
        }
        // Also keep a console trace for developers
        // NOTE: in production you may prefer sampling instead of logging everything
        console.debug('[Perf]', name, `${duration.toFixed(2)}ms`);
      }
    });

    try {
      obs.observe({ entryTypes: ['measure'] });
    } catch (e) {
      // Some browsers may restrict observe usage
    }

    return () => obs.disconnect();
  }, [enabled, thresholdMs]);

  return (
    <div className="performance-toast" style={{ position: 'fixed', right: 'var(--space-4)', bottom: 'var(--space-4)', zIndex: 9999 }}>
      <div style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', padding: 'var(--space-2) var(--space-3)', borderRadius: 8, boxShadow: 'var(--shadow-md)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span style={{ fontSize: 'var(--text-xs)' }}>Perf observer</span>
        </label>
      </div>
    </div>
  );
};

export default PerfObserver;
