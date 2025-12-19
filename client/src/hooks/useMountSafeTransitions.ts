import { useCallback } from 'react';

/**
 * Hook to disable CSS transitions globally during big layout changes.
 * Usage: call `disableTransitions()` before making layout changes, then
 * `enableTransitions()` after changes are applied (or rely on the helper's
 * built-in RAF+timeout to re-enable automatically).
 */
export default function useMountSafeTransitions() {
  const disableTransitions = useCallback(() => {
    try {
      document.documentElement.classList.add('no-transitions');
    } catch (e) {
      // ignore in SSR / tests
    }
  }, []);

  const enableTransitions = useCallback(() => {
    try {
      // Wait for a couple frames to allow layout to stabilize
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.documentElement.classList.remove('no-transitions');
        });
      });
    } catch (e) {
      // ignore
    }
  }, []);

  const withTransitionsDisabled = useCallback(async (fn: () => void | Promise<void>) => {
    disableTransitions();
    try {
      await fn();
    } finally {
      // re-enable after RAFs to ensure styles applied
      enableTransitions();
    }
  }, [disableTransitions, enableTransitions]);

  return { disableTransitions, enableTransitions, withTransitionsDisabled };
}
