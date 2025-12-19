import { useEffect } from 'react';

/**
 * usePerformanceMark
 * Mark the mount/unmount times for a component so a PerformanceObserver
 * can measure render duration. Usage:
 *  usePerformanceMark('SignalCard');
 */
export function usePerformanceMark(name: string) {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof performance === 'undefined' || !performance.mark) return;
    const start = `${name}-start`;
    const end = `${name}-end`;
    try {
      performance.mark(start);
    } catch (e) {
      // ignore duplicate mark errors in some environments
    }

    return () => {
      try {
        performance.mark(end);
        performance.measure(name, start, end);
      } catch (e) {
        // swallow measurement errors
      }
    };
  }, [name]);
}

export default usePerformanceMark;
