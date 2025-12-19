/**
 * perf utilities
 * Provides a small hook to report slow components. In production replace
 * the console.warn with a proper analytics sink (Sentry, Influx, custom API).
 */

export function trackSlowComponent(name: string, duration: number) {
  try {
    if (typeof window !== 'undefined' && (window as any).__scanstreamTracker) {
      // user can inject a tracker: window.__scanstreamTracker.track(event, payload)
      (window as any).__scanstreamTracker.track('slow_component', { name, duration, ts: Date.now() });
    } else {
      // default: console.warn (developer UX)
      console.warn(`[Perf] slow_component: ${name} ${duration.toFixed(2)}ms`);
    }
  } catch (e) {
    // swallow any tracking errors
  }
}

export default trackSlowComponent;
