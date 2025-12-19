import { useCallback, useEffect, useState } from 'react';

export type PanelPosition = 'docked' | 'floating' | 'hidden';

export interface PanelMeta {
  id: string;
  title?: string;
  position: PanelPosition;
  collapsed: boolean;
  width?: number; // optional width for docked sidebar
}

const STORAGE_KEY = 'scanstream:panelState';

export function usePanelState(initialPanels: PanelMeta[] = []) {
  const [panels, setPanels] = useState<Record<string, PanelMeta>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Back-compat: stored as array of PanelMeta
        if (Array.isArray(parsed)) {
          return (parsed as PanelMeta[]).reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, PanelMeta>);
        }
        // New shape: { panels: PanelMeta[] }
        if (parsed && Array.isArray(parsed.panels)) {
          return (parsed.panels as PanelMeta[]).reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, PanelMeta>);
        }
      }
    } catch (e) {
      // ignore
    }
    return initialPanels.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, PanelMeta>);
  });

  const [order, setOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return (parsed as PanelMeta[]).map(p => p.id);
        }
        if (parsed && Array.isArray(parsed.order)) {
          return parsed.order as string[];
        }
        if (parsed && Array.isArray(parsed.panels)) {
          return (parsed.panels as PanelMeta[]).map(p => p.id);
        }
      }
    } catch (e) {
      // ignore
    }
    return initialPanels.map(p => p.id);
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ panels: Object.values(panels), order }));
    } catch (e) {
      // ignore
    }
  }, [panels, order]);

  const toggleCollapse = useCallback((id: string) => {
    setPanels(prev => {
      const item = prev[id];
      if (!item) return prev;
      return { ...prev, [id]: { ...item, collapsed: !item.collapsed } };
    });
  }, []);

  const setPosition = useCallback((id: string, position: PanelPosition) => {
    setPanels(prev => {
      const item = prev[id];
      if (!item) return prev;
      return { ...prev, [id]: { ...item, position } };
    });
  }, []);

  const setWidth = useCallback((id: string, width: number) => {
    setPanels(prev => {
      const item = prev[id];
      if (!item) return prev;
      return { ...prev, [id]: { ...item, width } };
    });
  }, []);

  const registerPanel = useCallback((meta: PanelMeta) => {
    setPanels(prev => {
      if (prev[meta.id]) return prev; // don't overwrite
      return { ...prev, [meta.id]: meta };
    });
    setOrder(prev => (prev.includes(meta.id) ? prev : [...prev, meta.id]));
  }, []);

  const removePanel = useCallback((id: string) => {
    setPanels(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setOrder(prev => prev.filter(p => p !== id));
  }, []);

  const moveUp = useCallback((id: string) => {
    setOrder(prev => {
      const idx = prev.indexOf(id);
      if (idx <= 0) return prev;
      const copy = [...prev];
      [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
      return copy;
    });
  }, []);

  const moveDown = useCallback((id: string) => {
    setOrder(prev => {
      const idx = prev.indexOf(id);
      if (idx === -1 || idx >= prev.length - 1) return prev;
      const copy = [...prev];
      [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
      return copy;
    });
  }, []);

  const reset = useCallback(() => {
    setPanels(initialPanels.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, PanelMeta>));
    setOrder(initialPanels.map(p => p.id));
  }, [initialPanels]);

  return {
    panels,
    order,
    toggleCollapse,
    setPosition,
    setWidth,
    registerPanel,
    removePanel,
    moveUp,
    moveDown,
    reset,
  };
}
