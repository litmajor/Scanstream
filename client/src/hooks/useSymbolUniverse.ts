/**
 * useSymbolUniverse — React Hook for Symbol Universe
 * 
 * Provides consistent access to symbols across all components.
 * Automatically handles normalization, formatting, and validation.
 * 
 * Key Promise: BTC/USDT and EUR/USD render and behave identically.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import type {
  Symbol,
  AssetClass,
  SymbolLookupQuery,
  SymbolUIConfig,
  SymbolRuntimeState,
  FormattedSymbolResult,
} from '../types';

/**
 * API response types
 */
interface SymbolManagerState {
  symbols: Record<string, Symbol>;
  groups: Record<string, any>;
  uiConfig: SymbolUIConfig;
  stats: {
    totalSymbols: number;
    byAssetClass: Record<string, number>;
    activeSymbols: number;
    lastUpdated: number;
  };
}

// Use shared FormattedSymbolResult from client types

interface LookupResult {
  found: boolean;
  symbols: Symbol[];
  totalMatches: number;
}

/**
 * Hook configuration
 */
interface UseSymbolUniverseOptions {
  /**
   * Auto-load symbol universe on mount?
   */
  autoLoad?: boolean;

  /**
   * Watch for universe changes?
   */
  watchChanges?: boolean;

  /**
   * Initial asset class filter
   */
  assetClassFilter?: AssetClass | AssetClass[];
}

/**
 * Hook return type
 */
interface UseSymbolUniverseReturn {
  /**
   * All symbols in the universe
   */
  symbols: Symbol[];

  /**
   * Groups for UI organization
   */
  groups: Record<string, any>;

  /**
   * UI configuration
   */
  uiConfig: SymbolUIConfig;

  /**
   * Statistics
   */
  stats: any;

  /**
   * Loading state
   */
  loading: boolean;

  /**
   * Any error that occurred
   */
  error: Error | null;

  /**
   * Get symbol by canonical name
   */
  getSymbol: (canonical: string) => Symbol | undefined;

  /**
   * Get formatted symbol for display
   */
  formatSymbol: (canonical: string) => FormattedSymbolResult | null;

  /**
   * Lookup symbols by query
   */
  lookup: (query: SymbolLookupQuery) => LookupResult;

  /**
   * Resolve venue-specific format to canonical
   * Example: "BTCUSDT" on binance → "BTC/USDT"
   */
  resolveVenue: (format: string, venue: string) => string | null;

  /**
   * Get venue-specific format for canonical symbol
   * Example: "BTC/USDT" on binance → "BTCUSDT"
   */
  getVenueFormat: (canonical: string, venue: string) => string | null;

  /**
   * Normalize a symbol format to canonical
   */
  normalizeSymbol: (
    format: string,
    venue: string
  ) => Promise<{ success: boolean; canonical?: string; error?: string }>;

  /**
   * Watch universe changes
   */
  onChange: (listener: (event: any) => void) => () => void;

  /**
   * Refresh universe from server
   */
  refresh: () => Promise<void>;

  /**
   * GET RUNTIME STATE
   * Time-dependent tradability conditions
   * 
   * Examples:
   * - EUR/USD: closed on weekends
   * - AAPL: closed outside market hours
   * - BTC/USDT: always open but venue can go down
   */
  getRuntimeState: (canonical: string) => Promise<SymbolRuntimeState | null>;

  /**
   * Check if symbol is currently tradeable
   * Combines: market open + venue available + good liquidity
   */
  isTradeable: (canonical: string) => Promise<boolean>;

  /**
   * Check if market is open for a symbol
   * Independent of venue status
   */
  isMarketOpen: (canonical: string) => Promise<boolean>;

  /**
   * Check if venue is available
   */
  isVenueAvailable: (canonical: string) => Promise<boolean>;

  /**
   * Get estimated spread (bid-ask) for symbol right now
   */
  getEstimatedSpread: (canonical: string) => Promise<number | undefined>;

  /**
   * Get current liquidity state
   */
  getLiquidity: (canonical: string) => Promise<'HIGH' | 'MEDIUM' | 'LOW' | undefined>;
}

/**
 * Main hook for accessing symbol universe
 */
export function useSymbolUniverse(
  options: UseSymbolUniverseOptions = {}
): UseSymbolUniverseReturn {
  const { autoLoad = true, watchChanges = true, assetClassFilter } = options;

  const [state, setState] = useState<SymbolManagerState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [listeners, setListeners] = useState<Map<string, (event: any) => void>>(new Map());

  // Load universe state
  const loadUniverse = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/symbol-universe/state');
      if (!response.ok) {
        throw new Error(`Failed to load symbol universe: ${response.statusText}`);
      }

      const data = await response.json();
      setState(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error('[useSymbolUniverse] Error loading universe:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad) {
      loadUniverse();
    }
  }, [autoLoad, loadUniverse]);

  // Watch for changes (via WebSocket or polling)
  useEffect(() => {
    if (!watchChanges || !state) return;

    const eventSource = new EventSource('/api/symbol-universe/changes');

    const handleChange = (event: MessageEvent) => {
      try {
        const changeEvent = JSON.parse(event.data);

        // Update state
        setState((prev) =>
          prev
            ? {
                ...prev,
                stats: {
                  ...prev.stats,
                  lastUpdated: Date.now(),
                },
              }
            : null
        );

        // Notify listeners
        listeners.forEach((listener) => {
          try {
            listener(changeEvent);
          } catch (err) {
            console.error('[useSymbolUniverse] Listener error:', err);
          }
        });
      } catch (err) {
        console.error('[useSymbolUniverse] Error parsing change event:', err);
      }
    };

    eventSource.addEventListener('message', handleChange);

    return () => {
      eventSource.close();
    };
  }, [watchChanges, state, listeners]);

  // Filter symbols by asset class
  const filteredSymbols = useMemo(() => {
    if (!state) return [];

    let results = Object.values(state.symbols).filter((s) => s.active);

    if (assetClassFilter) {
      const classes = Array.isArray(assetClassFilter)
        ? assetClassFilter
        : [assetClassFilter];

      results = results.filter((s) => classes.includes(s.assetClass));
    }

    return results;
  }, [state, assetClassFilter]);

  // Get symbol by canonical name
  const getSymbol = useCallback(
    (canonical: string): Symbol | undefined => {
      return state?.symbols[canonical];
    },
    [state]
  );

  // Format symbol for display
  const formatSymbol = useCallback(
    (canonical: string): FormattedSymbolResult | null => {
      const symbol = getSymbol(canonical);
      if (!symbol) return null;

      const [base, quote] = symbol.symbol.split('/');
      const uiConfig = state?.uiConfig;

      if (!uiConfig) return null;

      return {
        canonical: symbol.symbol,
        displayName: symbol.name,
        shortCode: base,
        pairDisplay: quote ? `${base} / ${quote}` : base,
        assetClassBadge: symbol.assetClass.toUpperCase(),
        assetClassIcon: uiConfig.icons[symbol.assetClass] || '',
        color: uiConfig.colors[symbol.assetClass] || '#666',
        tradingHours: symbol.metadata.tradingHours,
        volumeDisplay: formatVolume(symbol.metadata.volume24h),
        instrumentTypeBadge: symbol.instrumentType ? symbol.instrumentType.toUpperCase() : 'SPOT',
        meta: {
          assetClass: symbol.assetClass,
          base: symbol.base,
          quote: symbol.quote,
          precisionPrice: symbol.metadata.precisionPrice,
          precisionSize: symbol.metadata.precisionSize,
          custody: symbol.metadata.custody,
          settlement: symbol.metadata.settlement,
          settlementCurrency: symbol.metadata.settlementCurrency,
          marginCurrency: symbol.metadata.marginCurrency,
          instrumentType: symbol.instrumentType || 'spot',
          maxLeverage: symbol.metadata.maxLeverage,
          contractMultiplier: symbol.metadata.contractMultiplier,
          expirationDate: symbol.metadata.expirationDate,
          minOrderValue: symbol.metadata.minOrderValue,
          tags: symbol.metadata.tags,
        },
      };
    },
    [getSymbol, state?.uiConfig]
  );

  // Lookup symbols by query
  const lookup = useCallback(
    (query: SymbolLookupQuery): LookupResult => {
      if (!state) {
        return { found: false, symbols: [], totalMatches: 0 };
      }

      let results = Object.values(state.symbols);

      // Filter by symbol (substring match)
      if (query.symbol) {
        const q = query.symbol.toUpperCase();
        results = results.filter((s) =>
          s.symbol.toUpperCase().includes(q) ||
          s.base.toUpperCase().includes(q) ||
          s.name.toUpperCase().includes(q)
        );
      }

      // Filter by asset class
      if (query.assetClass) {
        const classes = Array.isArray(query.assetClass)
          ? query.assetClass
          : [query.assetClass];
        results = results.filter((s) => classes.includes(s.assetClass));
      }

      // Filter by venue
      if (query.venue) {
        results = results.filter((s) => query.venue! in s.venues);
      }

      // Filter by active status
      if (query.activeOnly !== false) {
        results = results.filter((s) => s.active);
      }

      // Apply limit
      if (query.limit && query.limit > 0) {
        results = results.slice(0, query.limit);
      }

      return {
        found: results.length > 0,
        symbols: results,
        totalMatches: results.length,
      };
    },
    [state]
  );

  // Resolve venue format to canonical
  const resolveVenue = useCallback(
    (format: string, venue: string): string | null => {
      if (!state) return null;

      for (const symbol of Object.values(state.symbols)) {
        if (symbol.venues[venue] === format) {
          return symbol.symbol;
        }
      }

      return null;
    },
    [state]
  );

  // Get venue format for canonical symbol
  const getVenueFormat = useCallback(
    (canonical: string, venue: string): string | null => {
      const symbol = getSymbol(canonical);
      return symbol?.venues[venue] || null;
    },
    [getSymbol]
  );

  // Normalize symbol format
  const normalizeSymbol = useCallback(
    async (format: string, venue: string) => {
      try {
        const response = await fetch('/api/symbol-universe/normalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ format, venue }),
        });

        if (!response.ok) {
          return {
            success: false,
            error: `Failed to normalize: ${response.statusText}`,
          };
        }

        return await response.json();
      } catch (err) {
        return {
          success: false,
          error: String(err),
        };
      }
    },
    []
  );

  // Register change listener
  const onChange = useCallback((listener: (event: any) => void) => {
    setListeners((prev) => {
      const next = new Map(prev);
      const id = Math.random().toString(36);
      next.set(id, listener);
      return next;
    });

    // Return cleanup function
    return () => {
      setListeners((prev) => {
        const next = new Map(prev);
        // Note: we'd need to track the ID to remove it properly
        return next;
      });
    };
  }, []);

  // Refresh universe from server
  const refresh = useCallback(async () => {
    await loadUniverse();
  }, [loadUniverse]);

  // Get runtime state for a symbol
  const getRuntimeState = useCallback(
    async (canonical: string): Promise<SymbolRuntimeState | null> => {
      try {
        const response = await fetch(`/api/symbol-universe/runtime/${canonical}`);
        if (!response.ok) return null;
        return await response.json();
      } catch (err) {
        console.error('[useSymbolUniverse] Error fetching runtime state:', err);
        return null;
      }
    },
    []
  );

  // Check if symbol is tradeable
  const isTradeable = useCallback(
    async (canonical: string): Promise<boolean> => {
      const state = await getRuntimeState(canonical);
      return state?.isTradeable ?? false;
    },
    [getRuntimeState]
  );

  // Check if market is open
  const isMarketOpen = useCallback(
    async (canonical: string): Promise<boolean> => {
      const state = await getRuntimeState(canonical);
      return state?.isMarketOpen ?? false;
    },
    [getRuntimeState]
  );

  // Check if venue is available
  const isVenueAvailable = useCallback(
    async (canonical: string): Promise<boolean> => {
      const state = await getRuntimeState(canonical);
      return state?.venueAvailable ?? false;
    },
    [getRuntimeState]
  );

  // Get estimated spread
  const getEstimatedSpread = useCallback(
    async (canonical: string): Promise<number | undefined> => {
      const state = await getRuntimeState(canonical);
      return state?.estimatedSpread;
    },
    [getRuntimeState]
  );

  // Get liquidity level
  const getLiquidity = useCallback(
    async (canonical: string): Promise<'HIGH' | 'MEDIUM' | 'LOW' | undefined> => {
      const state = await getRuntimeState(canonical);
      return state?.liquidityState;
    },
    [getRuntimeState]
  );

  return {
    symbols: filteredSymbols,
    groups: state?.groups || {},
    uiConfig: state?.uiConfig || DEFAULT_UI_CONFIG,
    stats: state?.stats,
    loading,
    error,
    getSymbol,
    formatSymbol,
    lookup,
    resolveVenue,
    getVenueFormat,
    normalizeSymbol,
    onChange,
    refresh,
    getRuntimeState,
    isTradeable,
    isMarketOpen,
    isVenueAvailable,
    getEstimatedSpread,
    getLiquidity,
  };
}

/**
 * Hook for single symbol formatting
 * More lightweight than full universe hook
 */
export function useFormattedSymbol(canonical?: string) {
  const { formatSymbol } = useSymbolUniverse({ autoLoad: true });
  const [formatted, setFormatted] = useState<FormattedSymbolResult | null>(null);

  useEffect(() => {
    if (canonical) {
      setFormatted(formatSymbol(canonical));
    }
  }, [canonical, formatSymbol]);

  return formatted;
}

/**
 * Hook for symbol lookup
 */
export function useSymbolLookup(query?: SymbolLookupQuery) {
  const { lookup } = useSymbolUniverse({ autoLoad: true });
  const [results, setResults] = useState<LookupResult>({
    found: false,
    symbols: [],
    totalMatches: 0,
  });

  useEffect(() => {
    if (query) {
      setResults(lookup(query));
    }
  }, [query, lookup]);

  return results;
}

/**
 * Helper: Format volume for display
 */
function formatVolume(volume?: number): string {
  if (!volume || volume === 0) return 'N/A';

  if (volume >= 1_000_000_000) {
    return `$${(volume / 1_000_000_000).toFixed(1)}B`;
  }
  if (volume >= 1_000_000) {
    return `$${(volume / 1_000_000).toFixed(1)}M`;
  }
  if (volume >= 1_000) {
    return `$${(volume / 1_000).toFixed(1)}K`;
  }
  return `$${volume.toFixed(0)}`;
}

/**
 * Hook for runtime state (tradability, market hours, liquidity)
 * 
 * Example:
 * const runtime = useSymbolRuntimeState('EUR/USD');
 * if (runtime?.isTradeable) {
 *   // Safe to trade
 * }
 */
export function useSymbolRuntimeState(canonical?: string) {
  const { getRuntimeState } = useSymbolUniverse({ autoLoad: true });
  const [runtime, setRuntime] = useState<SymbolRuntimeState | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canonical) return;

    setLoading(true);
    getRuntimeState(canonical).then((state) => {
      setRuntime(state);
      setLoading(false);
    });

    // Refresh every 10 seconds (market conditions change)
    const interval = setInterval(() => {
      getRuntimeState(canonical).then(setRuntime);
    }, 10000);

    return () => clearInterval(interval);
  }, [canonical, getRuntimeState]);

  return { runtime, loading };
}

/**
 * Default UI config
 */
const DEFAULT_UI_CONFIG: SymbolUIConfig = {
  showAssetClass: true,
  showQuote: true,
  showLiquidity: true,
  showTradingHours: true,
  abbreviate: false,
  colors: {
    crypto: '#F7931A',
    forex: '#1E40AF',
    equities: '#059669',
    commodities: '#DC2626',
    indices: '#7C3AED',
  } as any,
  icons: {
    crypto: '₿',
    forex: '💱',
    equities: '📈',
    commodities: '⛽',
    indices: '📊',
  } as any,
  displayVariants: ['COMPACT', 'STANDARD', 'FULL', 'CARD'],
};

