/**
 * SYMBOL RUNTIME MANAGER — Time-Dependent Tradability
 * 
 * Tracks runtime conditions for symbols:
 * - Market open/close times
 * - Venue availability
 * - Liquidity states
 * - Trading mode (live vs replay)
 * 
 * Not stored. Generated on-demand from market data.
 * Agents use this to decide if they can trade RIGHT NOW.
 */

import { EventEmitter } from 'events';
import type { SymbolRuntimeState } from '../types/symbol-universe';
import { AssetClass } from '../types/symbol-universe';
import { symbolManager } from './symbol-manager';

/**
 * Market hours definition
 */
interface MarketHoursRule {
  /**
   * Asset class this rule applies to
   */
  assetClass: AssetClass;

  /**
   * Hours (UTC)
   * Format: "HH:MM-HH:MM"
   * Or "24h" for always open
   */
  hours: string;

  /**
   * Days open (0=Monday, 6=Sunday)
   * Omitted = all days
   */
  daysOpen?: number[];

  /**
   * Holidays when market is closed (ISO dates YYYY-MM-DD)
   */
  holidays?: string[];
}

/**
 * Venue availability tracker
 */
interface VenueStatus {
  venue: string;
  available: boolean;
  lastCheckTime: number;
  lastError?: string;
  consecutiveFailures: number;
}

/**
 * Liquidity state
 */
type LiquidityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Liquidity estimator based on time-of-day
 */
interface LiquidityRule {
  assetClass: AssetClass;
  rules: {
    time: string; // "HH:MM-HH:MM" UTC
    liquidity: LiquidityLevel;
  }[];
}

export class SymbolRuntimeManager extends EventEmitter {
  private runtimeState: Map<string, SymbolRuntimeState> = new Map();
  private marketHours: Map<AssetClass, MarketHoursRule> = new Map();
  private venueStatus: Map<string, VenueStatus> = new Map();
  private liquidityRules: Map<AssetClass, LiquidityRule> = new Map();
  private currentMode: 'LIVE' | 'REPLAY' = 'LIVE';
  private replayTime?: number; // Current time in replay mode

  constructor() {
    super();
    this.initializeDefaults();
  }

  /**
   * Get runtime state for a symbol
   * Computed on-demand, not cached
   */
  getState(canonical: string): SymbolRuntimeState | null {
    const symbol = symbolManager.getSymbol(canonical);
    if (!symbol) return null;

    const now = this.currentMode === 'REPLAY' ? this.replayTime! : Date.now();

    // Determine market hours
    const { isOpen, reason } = this.isMarketOpen(canonical, now);

    // Determine venue availability
    const primaryVenue = symbol.primaryVenue || Object.keys(symbol.venues)[0];
    const venueAvailable = this.isVenueAvailable(primaryVenue);

    // Determine tradability
    const isTradeable = isOpen && venueAvailable;

    // Determine liquidity
    const liquidity = this.getLiquidity(canonical, now);

    const state: SymbolRuntimeState = {
      symbol: canonical,
      isMarketOpen: isOpen,
      isTradeable,
      venueAvailable,
      liquidityState: liquidity,
      lastTradeTs: this.runtimeState.get(canonical)?.lastTradeTs,
      lastQuoteTs: this.runtimeState.get(canonical)?.lastQuoteTs,
      mode: this.currentMode,
      closureReason: reason,
      nextOpenTime: !isOpen ? this.getNextOpenTime(canonical, now) : undefined,
      estimatedSpread: this.estimateSpread(canonical, liquidity),
      meta: {
        assetClass: symbol.assetClass,
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
      },
    };

    this.runtimeState.set(canonical, state);
    return state;
  }

  /**
   * Get states for multiple symbols
   */
  getStates(canonicals: string[]): SymbolRuntimeState[] {
    return canonicals
      .map((c) => this.getState(c))
      .filter((s) => s !== null) as SymbolRuntimeState[];
  }

  /**
   * Update venue availability
   * Called by health check or API monitoring
   */
  setVenueStatus(venue: string, available: boolean, error?: string): void {
    const status = this.venueStatus.get(venue) || {
      venue,
      available: true,
      lastCheckTime: Date.now(),
      consecutiveFailures: 0,
    };

    status.available = available;
    status.lastCheckTime = Date.now();
    status.lastError = error;

    if (!available) {
      status.consecutiveFailures++;
    } else {
      status.consecutiveFailures = 0;
    }

    this.venueStatus.set(venue, status);

    this.emit('venue-status-changed', {
      venue,
      available,
      timestamp: Date.now(),
    });

    console.log(`[SymbolRuntimeManager] ${venue}: ${available ? '✅ ONLINE' : '❌ OFFLINE'}`);
  }

  /**
   * Get venue availability
   */
  isVenueAvailable(venue: string): boolean {
    const status = this.venueStatus.get(venue);
    return status?.available ?? true; // Default to available if no status
  }

  /**
   * Set trading mode (live vs replay)
   */
  setMode(mode: 'LIVE' | 'REPLAY', replayTime?: number): void {
    this.currentMode = mode;
    this.replayTime = replayTime;

    console.log(
      `[SymbolRuntimeManager] Mode: ${mode}${
        replayTime ? ` (time: ${new Date(replayTime).toISOString()})` : ''
      }`
    );

    this.emit('mode-changed', { mode, replayTime });
  }

  /**
   * Update last trade timestamp
   */
  recordTrade(canonical: string): void {
    const state = this.runtimeState.get(canonical);
    if (state) {
      state.lastTradeTs = Date.now();
    }
  }

  /**
   * Update last quote timestamp
   */
  recordQuote(canonical: string): void {
    const state = this.runtimeState.get(canonical);
    if (state) {
      state.lastQuoteTs = Date.now();
    }
  }

  /**
   * Check if market is open for a symbol
   */
  private isMarketOpen(canonical: string, time: number): { isOpen: boolean; reason?: string } {
    const symbol = symbolManager.getSymbol(canonical);
    if (!symbol) {
      return { isOpen: false, reason: 'symbol-not-found' };
    }

    const rule = this.marketHours.get(symbol.assetClass);
    if (!rule) {
      // No rule = always open (crypto)
      return { isOpen: true };
    }

    // Parse hours
    if (rule.hours === '24h') {
      return { isOpen: true };
    }

    // Check day of week
    const date = new Date(time);
    const dayOfWeek = date.getUTCDay();
    const isWeekday = dayOfWeek > 0 && dayOfWeek < 6; // 1-5 = Mon-Fri

    if (rule.daysOpen && !rule.daysOpen.includes(dayOfWeek)) {
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek];
      return { isOpen: false, reason: `closed-on-${dayName.toLowerCase()}` };
    }

    // Check holiday
    const dateStr = date.toISOString().split('T')[0];
    if (rule.holidays?.includes(dateStr)) {
      return { isOpen: false, reason: 'holiday' };
    }

    // Check time of day
    const [openHour, openMin] = rule.hours.split('-')[0].split(':').map(Number);
    const [closeHour, closeMin] = rule.hours.split('-')[1].split(':').map(Number);

    const currentHour = date.getUTCHours();
    const currentMin = date.getUTCMinutes();

    const openTime = openHour * 60 + openMin;
    const closeTime = closeHour * 60 + closeMin;
    const currentTime = currentHour * 60 + currentMin;

    if (currentTime < openTime || currentTime >= closeTime) {
      return { isOpen: false, reason: 'market-hours-closed' };
    }

    return { isOpen: true };
  }

  /**
   * Get next market open time
   */
  private getNextOpenTime(canonical: string, fromTime: number): number | undefined {
    const symbol = symbolManager.getSymbol(canonical);
    if (!symbol) return undefined;

    const rule = this.marketHours.get(symbol.assetClass);
    if (!rule || rule.hours === '24h') return fromTime; // Already open or always open

    // Simple implementation: check next 7 days
    let checkTime = fromTime;
    for (let i = 0; i < 7 * 24; i++) {
      checkTime += 60 * 60 * 1000; // Add 1 hour

      const { isOpen } = this.isMarketOpen(canonical, checkTime);
      if (isOpen) {
        return checkTime;
      }
    }

    return undefined;
  }

  /**
   * Get current liquidity state
   */
  private getLiquidity(canonical: string, time: number): LiquidityLevel {
    const symbol = symbolManager.getSymbol(canonical);
    if (!symbol) return 'LOW';

    const rule = this.liquidityRules.get(symbol.assetClass);
    if (!rule) return 'HIGH'; // Default to high if no rule

    const date = new Date(time);
    const hour = date.getUTCHours();
    const min = date.getUTCMinutes();
    const currentTime = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

    for (const timeRule of rule.rules) {
      const [startTime, endTime] = timeRule.time.split('-');
      if (currentTime >= startTime && currentTime < endTime) {
        return timeRule.liquidity;
      }
    }

    return 'MEDIUM';
  }

  /**
   * Estimate spread based on liquidity
   */
  private estimateSpread(canonical: string, liquidity: LiquidityLevel): number | undefined {
    const symbol = symbolManager.getSymbol(canonical);
    if (!symbol) return undefined;

    const baseSpread = symbol.metadata.minTick || 0.0001;

    const multipliers: Record<LiquidityLevel, number> = {
      HIGH: 1,
      MEDIUM: 3,
      LOW: 10,
    };

    return baseSpread * multipliers[liquidity];
  }

  /**
   * Initialize default market hours rules
   */
  private initializeDefaults(): void {
    // Crypto: 24/7
    this.marketHours.set(AssetClass.CRYPTO, {
      assetClass: AssetClass.CRYPTO,
      hours: '24h',
    });

    // Forex: 22:00 Sunday - 21:00 Friday UTC (5 days)
    this.marketHours.set(AssetClass.FOREX, {
      assetClass: AssetClass.FOREX,
      hours: '22:00-21:00',
      daysOpen: [0, 1, 2, 3, 4, 5], // Sun-Fri
    });

    // Equities: 09:30 - 16:00 ET (14:30-21:00 UTC), weekdays
    this.marketHours.set(AssetClass.EQUITIES, {
      assetClass: AssetClass.EQUITIES,
      hours: '14:30-21:00', // US market in UTC
      daysOpen: [1, 2, 3, 4, 5], // Mon-Fri
    });

    // Commodities: varies, but typically market hours
    this.marketHours.set(AssetClass.COMMODITIES, {
      assetClass: AssetClass.COMMODITIES,
      hours: '00:00-23:59',
      daysOpen: [1, 2, 3, 4, 5],
    });

    // Indices: market hours (usually follow equities)
    this.marketHours.set(AssetClass.INDICES, {
      assetClass: AssetClass.INDICES,
      hours: '14:30-21:00',
      daysOpen: [1, 2, 3, 4, 5],
    });

    // Initialize liquidity rules
    // Forex: High during overlap times, low at edges
    this.liquidityRules.set(AssetClass.FOREX, {
      assetClass: AssetClass.FOREX,
      rules: [
        { time: '08:00-12:00', liquidity: 'HIGH' }, // London/Asia overlap
        { time: '12:00-16:00', liquidity: 'HIGH' }, // London/US overlap
        { time: '16:00-20:00', liquidity: 'MEDIUM' }, // US session
        { time: '20:00-08:00', liquidity: 'LOW' }, // Asian session
      ],
    });

    // Crypto: Generally high, low during volatility
    this.liquidityRules.set(AssetClass.CRYPTO, {
      assetClass: AssetClass.CRYPTO,
      rules: [
        { time: '00:00-23:59', liquidity: 'HIGH' },
      ],
    });

    // Equities: High during market hours, zero after hours
    this.liquidityRules.set(AssetClass.EQUITIES, {
      assetClass: AssetClass.EQUITIES,
      rules: [
        { time: '14:30-21:00', liquidity: 'HIGH' },
        { time: '21:00-14:30', liquidity: 'LOW' },
      ],
    });
  }

  /**
   * Get all runtime states
   */
  getAllStates(): SymbolRuntimeState[] {
    return Array.from(this.runtimeState.values());
  }

  /**
   * Get venue statuses
   */
  getVenueStatuses(): VenueStatus[] {
    return Array.from(this.venueStatus.values());
  }
}

/**
 * Global runtime manager instance
 */
export const symbolRuntimeManager = new SymbolRuntimeManager();
