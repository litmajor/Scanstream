/**
 * SYMBOL MANAGER — Central Symbol Registry
 * 
 * Manages the canonical symbol universe:
 * - Registration and discovery
 * - Cross-venue symbol mapping
 * - Consistency validation
 * - Event notifications
 * 
 * This is the single source of truth for all symbols.
 */

import { EventEmitter } from 'events';
import type {
  Symbol,
  SymbolGroup,
  SymbolUIConfig,
  SymbolUniverseState,
  UniverseChangeEvent,
  SymbolLookupQuery,
  SymbolLookupResult,
  UniverseValidationRule,
} from '../types/symbol-universe';
import { AssetClass } from '../types/symbol-universe';

/**
 * Default UI configuration
 * Consistent across all components
 */
const DEFAULT_UI_CONFIG: SymbolUIConfig = {
  showAssetClass: true,
  showQuote: true,
  showLiquidity: true,
  showTradingHours: true,
  abbreviate: false,
  colors: {
    [AssetClass.CRYPTO]: '#F7931A',      // Bitcoin orange
    [AssetClass.FOREX]: '#1E40AF',       // Deep blue
    [AssetClass.EQUITIES]: '#059669',    // Green
    [AssetClass.COMMODITIES]: '#DC2626', // Red
    [AssetClass.INDICES]: '#7C3AED',     // Purple
  },
  icons: {
    [AssetClass.CRYPTO]: '₿',            // Bitcoin symbol
    [AssetClass.FOREX]: '💱',            // Currency exchange
    [AssetClass.EQUITIES]: '📈',         // Chart
    [AssetClass.COMMODITIES]: '⛽',      // Fuel
    [AssetClass.INDICES]: '📊',          // Bar chart
  },
};

export class SymbolManager extends EventEmitter {
  private symbols: Map<string, Symbol> = new Map();
  private groups: Map<string, SymbolGroup> = new Map();
  private uiConfig: SymbolUIConfig = DEFAULT_UI_CONFIG;
  private validationRules: UniverseValidationRule[] = [];

  // Reverse mapping for quick lookups
  // venue -> exchange-format -> canonical-symbol
  private venueMapping: Map<string, Map<string, string>> = new Map();

  constructor() {
    super();
    this.initializeValidationRules();
  }

  /**
   * Register a new symbol in the universe
   * @throws if symbol already exists or validation fails
   */
  registerSymbol(symbol: Symbol): void {
    const canonical = symbol.symbol;

    // Check for duplicates
    if (this.symbols.has(canonical)) {
      throw new Error(`Symbol already registered: ${canonical}`);
    }

    // Validate
    this.validate(symbol);

    // Register
    this.symbols.set(canonical, {
      ...symbol,
      createdAt: symbol.createdAt || Date.now(),
    });

    // Index by venue
    for (const [venue, format] of Object.entries(symbol.venues)) {
      if (!this.venueMapping.has(venue)) {
        this.venueMapping.set(venue, new Map());
      }
      this.venueMapping.get(venue)!.set(format, canonical);
    }

    // Emit event
    this.emitEvent({
      type: 'symbol.added',
      symbol: canonical,
      current: this.symbols.get(canonical),
      timestamp: Date.now(),
    });

    console.log(`[SymbolManager] Registered: ${canonical} (${symbol.assetClass})`);
  }

  /**
   * Register multiple symbols at once
   */
  registerBatch(symbols: Symbol[]): void {
    const errors: string[] = [];

    for (const symbol of symbols) {
      try {
        this.registerSymbol(symbol);
      } catch (error: any) {
        errors.push(error.message);
      }
    }

    if (errors.length > 0) {
      console.warn(
        `[SymbolManager] ${errors.length} registration errors:`,
        errors
      );
    }
  }

  /**
   * Get symbol by canonical name
   */
  getSymbol(canonical: string): Symbol | undefined {
    return this.symbols.get(canonical);
  }

  /**
   * Resolve exchange format to canonical symbol
   * @param format Exchange-specific format (e.g., "BTCUSDT" on binance)
   * @param venue Exchange name (e.g., "binance")
   * @returns Canonical symbol or undefined
   */
  resolveVenue(format: string, venue: string): string | undefined {
    return this.venueMapping.get(venue)?.get(format);
  }

  /**
   * Get how a symbol should be formatted for a specific venue
   * @param canonical Canonical symbol (e.g., "BTC/USDT")
   * @param venue Exchange name (e.g., "binance")
   * @returns Exchange format or undefined if not available on this venue
   */
  getVenueFormat(canonical: string, venue: string): string | undefined {
    const symbol = this.getSymbol(canonical);
    return symbol?.venues[venue];
  }

  /**
   * Lookup symbols by query
   */
  lookup(query: SymbolLookupQuery): SymbolLookupResult {
    let results = Array.from(this.symbols.values());

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

    // Filter by group
    if (query.group) {
      const group = this.groups.get(query.group);
      if (group) {
        const groupSymbols = new Set(group.symbols);
        results = results.filter((s) => groupSymbols.has(s.symbol));
      }
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
  }

  /**
   * Create a symbol group for UI organization
   */
  createGroup(group: SymbolGroup): void {
    this.groups.set(group.id, {
      ...group,
      symbols: group.symbols.filter((s) => this.symbols.has(s)),
    });

    this.emitEvent({
      type: 'group.updated',
      timestamp: Date.now(),
    });

    console.log(`[SymbolManager] Created group: ${group.id} (${group.symbols.length} symbols)`);
  }

  /**
   * Get all groups
   */
  getGroups(): SymbolGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Get symbols in a group
   */
  getGroupSymbols(groupId: string): Symbol[] {
    const group = this.groups.get(groupId);
    if (!group) return [];

    return group.symbols
      .map((s) => this.symbols.get(s))
      .filter((s) => s !== undefined) as Symbol[];
  }

  /**
   * Update symbol metadata (keeps it fresh)
   */
  updateSymbol(canonical: string, updates: Partial<Symbol>): void {
    const current = this.symbols.get(canonical);
    if (!current) {
      throw new Error(`Symbol not found: ${canonical}`);
    }

    const updated: Symbol = {
      ...current,
      ...updates,
      symbol: current.symbol, // Never change this
      assetClass: current.assetClass, // Never change this
    };

    this.validate(updated);
    this.symbols.set(canonical, updated);

    this.emitEvent({
      type: 'symbol.updated',
      symbol: canonical,
      previous: current,
      current: updated,
      timestamp: Date.now(),
    });

    console.log(`[SymbolManager] Updated: ${canonical}`);
  }

  /**
   * Mark symbol as inactive (but keep it in universe)
   */
  deactivateSymbol(canonical: string): void {
    this.updateSymbol(canonical, { active: false });
  }

  /**
   * Get universe state (for serialization/export)
   */
  getUniverseState(): SymbolUniverseState {
    const byAssetClass: Record<AssetClass, number> = {
      [AssetClass.CRYPTO]: 0,
      [AssetClass.FOREX]: 0,
      [AssetClass.EQUITIES]: 0,
      [AssetClass.COMMODITIES]: 0,
      [AssetClass.INDICES]: 0,
    };

    let activeCount = 0;

    for (const symbol of this.symbols.values()) {
      byAssetClass[symbol.assetClass]++;
      if (symbol.active) activeCount++;
    }

    return {
      symbols: this.symbols,
      groups: this.groups,
      uiConfig: this.uiConfig,
      validationRules: this.validationRules,
      stats: {
        totalSymbols: this.symbols.size,
        byAssetClass,
        activeSymbols: activeCount,
        lastUpdated: Date.now(),
      },
    };
  }

  /**
   * Get UI configuration
   */
  getUIConfig(): SymbolUIConfig {
    return this.uiConfig;
  }

  /**
   * Update UI configuration (affects all components)
   */
  setUIConfig(config: Partial<SymbolUIConfig>): void {
    this.uiConfig = {
      ...this.uiConfig,
      ...config,
    };

    console.log('[SymbolManager] UI configuration updated');
  }

  /**
   * Listen to universe changes
   */
  onChange(listener: (event: UniverseChangeEvent) => void): () => void {
    this.on('change', listener);
    return () => this.off('change', listener);
  }

  /**
   * Validate symbol against all rules
   * @throws if validation fails with severity 'error'
   */
  private validate(symbol: Symbol): void {
    const issues: string[] = [];

    for (const rule of this.validationRules) {
      const passed = rule.validate(symbol);

      if (!passed) {
        const issue = `[${rule.id}] ${rule.description}`;

        if (rule.severity === 'error') {
          issues.push(issue);
        } else {
          console.warn(`[SymbolManager] ${issue}`);
        }
      }
    }

    if (issues.length > 0) {
      throw new Error(`Symbol validation failed:\n${issues.join('\n')}`);
    }
  }

  /**
   * Setup default validation rules
   */
  private initializeValidationRules(): void {
    this.validationRules = [
      {
        id: 'symbol-format',
        description: 'Symbol must match expected format',
        validate: (symbol) => {
          const isPair = symbol.symbol.includes('/');
          const isEquity = !isPair;

          if (isPair) {
            const [base, quote] = symbol.symbol.split('/');
            return base.length > 0 && quote.length > 0;
          }

          return isEquity && symbol.symbol.length > 0;
        },
        severity: 'error',
      },

      {
        id: 'asset-class-match',
        description: 'Asset class must be consistent with symbol format',
        validate: (symbol) => {
          const isPair = symbol.symbol.includes('/');

          // Pairs must be crypto or forex
          if (isPair) {
            return (
              symbol.assetClass === AssetClass.CRYPTO ||
              symbol.assetClass === AssetClass.FOREX
            );
          }

          // Equities are usually single tickers
          if (symbol.assetClass === AssetClass.EQUITIES) {
            return !isPair;
          }

          return false;
        },
        severity: 'error',
      },

      {
        id: 'venues-not-empty',
        description: 'Symbol must be available on at least one venue',
        validate: (symbol) => {
          return Object.keys(symbol.venues).length > 0;
        },
        severity: 'error',
      },

      {
        id: 'precision-positive',
        description: 'Price precision must be positive',
        validate: (symbol) => {
          return symbol.metadata.precisionPrice > 0;
        },
        severity: 'error',
      },

      {
        id: 'base-quote-match',
        description: 'Base and quote must match symbol format',
        validate: (symbol) => {
          const [base, quote] = symbol.symbol.split('/');

          if (base && symbol.base !== base.toUpperCase()) {
            return false;
          }

          if (quote && symbol.quote !== quote.toUpperCase()) {
            return false;
          }

          return true;
        },
        severity: 'warn',
      },
    ];
  }

  /**
   * Emit universe change event
   */
  private emitEvent(event: UniverseChangeEvent): void {
    this.emit('change', event);
  }

  /**
   * Get statistics
   */
  getStats() {
    const state = this.getUniverseState();
    return state.stats;
  }

  /**
   * Export universe to JSON (for persistence)
   */
  toJSON(): SymbolUniverseState {
    return this.getUniverseState();
  }
}

/**
 * Global symbol manager instance
 */
export const symbolManager = new SymbolManager();
