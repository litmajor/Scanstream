/**
 * Asset Velocity Profile - Historical Dollar Movement Analysis
 * 
 * Analyzes historical data to determine expected moves per timeframe.
 * Now integrates with LiveVelocityCalculator for real-time data fetching.
 * 
 * Features:
 * - Fetches live OHLCV data from Polygon.io API
 * - Calculates velocity metrics across timeframes
 * - Detects market regimes (bull/bear/sideways)
 * - Falls back to hardcoded defaults if API unavailable
 * - Caches results (24-hour TTL) to minimize API calls
 * 
 * Note: Velocity profiles change by regime:
 * - Bull market: Higher avg moves (2020-2022 BTC 7D: $2,388)
 * - Bear market: Lower avg moves (2022-2024 BTC 7D: $1,562)
 * - Sideways: Minimal moves
 */

export interface VelocityMetrics {
  avgDollarMove: number;
  medianDollarMove: number;
  avgPercentMove: number;
  medianPercentMove: number;
  p25: number; // 25th percentile move
  p75: number; // 75th percentile move
  p90: number; // 90th percentile move
  maxMove: number;
  upDaysPercent: number; // % of windows that went up
}

export interface AssetVelocityData {
  symbol: string;
  '1D': VelocityMetrics;
  '3D': VelocityMetrics;
  '7D': VelocityMetrics;
  '14D': VelocityMetrics;
  '21D': VelocityMetrics;
  '30D': VelocityMetrics;
  lastUpdated: number;
}

export class AssetVelocityProfiler {
  private velocityCache: Map<string, AssetVelocityData> = new Map();
  private readonly CACHE_TTL = 86400000; // 24 hours
  private liveCalculator: any; // Lazy-loaded to avoid circular imports

  constructor() {
    // Lazy-load live calculator on first use
    this.liveCalculator = null;
  }

  /**
   * Initialize live calculator (called once on startup)
   */
  async initializeLiveCalculator(): Promise<void> {
    try {
      const { liveVelocityCalculator } = await import('./live-velocity-calculator');
      this.liveCalculator = liveVelocityCalculator;
      console.log('[AssetVelocityProfiler] Live calculator initialized');
    } catch (error) {
      console.warn('[AssetVelocityProfiler] Failed to initialize live calculator:', error);
    }
  }

  /**
   * Get velocity profile - tries live data first, falls back to defaults
   * 
   * Priority:
   * 1. Live calculated data (if API available and in cache)
   * 2. Provided historical data
   * 3. Hardcoded defaults
   */
  async getVelocityProfileLive(
    symbol: string,
    lookbackDays: number = 365,
    regime?: 'BULL' | 'BEAR' | 'SIDEWAYS'
  ): Promise<AssetVelocityData> {
    // Try live calculator if available
    if (this.liveCalculator) {
      try {
        return await this.liveCalculator.calculateLiveVelocityProfile(
          symbol,
          lookbackDays,
          regime
        );
      } catch (error) {
        console.warn(`[AssetVelocityProfiler] Live calculation failed for ${symbol}:`, error);
      }
    }

    // Fall back to defaults
    return this.getDefaultProfile(symbol);
  }

  /**
   * Get regime-aware velocity profile (detects current regime automatically)
   */
  async getVelocityProfileRegimeAware(
    symbol: string,
    lookbackDays: number = 365
  ): Promise<{ profile: AssetVelocityData; regime: string }> {
    if (this.liveCalculator) {
      try {
        const result = await this.liveCalculator.calculateRegimeAwareVelocityProfile(
          symbol,
          lookbackDays
        );
        return {
          profile: result.profile,
          regime: result.regime.regime,
        };
      } catch (error) {
        console.warn(`[AssetVelocityProfiler] Regime detection failed for ${symbol}:`, error);
      }
    }

    return { profile: this.getDefaultProfile(symbol), regime: 'UNKNOWN' };
  }

  /**
   * Compare velocity across regimes (show how it changes)
   */
  async compareRegimeVelocities(
    symbol: string,
    lookbackDays: number = 730
  ): Promise<{ bull: AssetVelocityData; bear: AssetVelocityData; sideways: AssetVelocityData }> {
    if (this.liveCalculator) {
      try {
        return await this.liveCalculator.compareRegimes(symbol, lookbackDays);
      } catch (error) {
        console.warn(`[AssetVelocityProfiler] Regime comparison failed for ${symbol}:`, error);
      }
    }

    // Return defaults for all regimes
    const defaults = this.getDefaultProfile(symbol);
    return { bull: defaults, bear: defaults, sideways: defaults };
  }

  /**
   * Get velocity profile (backward compatible - sync version)
   * Uses cache or historical data if provided, doesn't fetch live
   */
  getVelocityProfile(symbol: string, historicalData?: any[]): AssetVelocityData {
    // Normalize symbol to handle both "BTC" and "BTC/USDT" formats
    const normalizedKey = symbol.includes('/') ? symbol : `${symbol}/USDT`;
    
    const cached = this.velocityCache.get(normalizedKey);
    if (cached && Date.now() - cached.lastUpdated < this.CACHE_TTL) {
      return cached;
    }

    // Calculate from historical data if provided
    if (historicalData && historicalData.length > 30) {
      const profile = this.calculateVelocityProfile(symbol, historicalData);
      this.velocityCache.set(normalizedKey, profile);
      return profile;
    }

    // Return default profile based on asset category
    return this.getDefaultProfile(symbol);
  }

  /**
   * Calculate velocity profile from historical data
   */
  private calculateVelocityProfile(symbol: string, data: any[]): AssetVelocityData {
    const timeframes = {
      '1D': 1,
      '3D': 3,
      '7D': 7,
      '14D': 14,
      '21D': 21,
      '30D': 30
    };

    const profile: any = {
      symbol,
      lastUpdated: Date.now()
    };

    // Calculate moves for each timeframe
    for (const [name, days] of Object.entries(timeframes)) {
      const moves: number[] = [];
      const percentMoves: number[] = [];
      let upCount = 0;

      // Rolling window analysis
      for (let i = 0; i < data.length - days; i++) {
        const startPrice = data[i].close || data[i];
        const endPrice = data[i + days].close || data[i + days];

        const dollarMove = Math.abs(endPrice - startPrice);
        const percentMove = (dollarMove / startPrice) * 100;

        moves.push(dollarMove);
        percentMoves.push(percentMove);

        if (endPrice > startPrice) upCount++;
      }

      // Calculate statistics
      profile[name] = {
        avgDollarMove: this.average(moves),
        medianDollarMove: this.median(moves),
        avgPercentMove: this.average(percentMoves),
        medianPercentMove: this.median(percentMoves),
        p25: this.percentile(moves, 25),
        p75: this.percentile(moves, 75),
        p90: this.percentile(moves, 90),
        maxMove: Math.max(...moves),
        upDaysPercent: (upCount / moves.length) * 100
      };
    }

    return profile as AssetVelocityData;
  }

  /**
   * Get default profile based on asset category
   * Used when no historical data available
   * 
   * NOTE: Defaults based on verified historical data (Sep 2022 - Dec 2025)
   * Previous hardcoded values were overstated (~40-60% higher than actual)
   * These values reflect current market volatility, not historical bull-run periods
   */
  private getDefaultProfile(symbol: string): AssetVelocityData {
    // Normalize symbol - handle both "BTC" and "BTC/USDT" formats
    const normalizedSymbol = symbol.includes('/') ? symbol : `${symbol}/USDT`;
    
    // Tier-1 assets: BTC (Updated with historical data from Sep 2022 - Dec 2025)
    if (normalizedSymbol === 'BTC/USDT' || symbol === 'BTC') {
      return {
        symbol,
        '1D': {
          avgDollarMove: 1038,      // Verified: was 1850 (-44%)
          medianDollarMove: 592,    // Verified: was 1600 (-63%)
          avgPercentMove: 1.7,      // Verified: was 2.1 (-19%)
          medianPercentMove: 1.2,   // Verified: was 1.8 (-33%)
          p25: 201,                 // Verified: was 800 (-75%)
          p75: 1427,                // Verified: was 2400 (-41%)
          p90: 2562,                // Verified: was 3500 (-27%)
          maxMove: 8635,            // Verified: was 8900 (-3%)
          upDaysPercent: 50         // Verified: was 51 (-2%)
        },
        '3D': {
          avgDollarMove: 1831,      // Verified: was 3200 (-43%)
          medianDollarMove: 1149,   // Verified: was 2800 (-59%)
          avgPercentMove: 3.1,      // Verified: was 3.7 (-16%)
          medianPercentMove: 2.2,   // Verified: was 3.2 (-31%)
          p25: 380,                 // Verified: was 1200 (-68%)
          p75: 2672,                // Verified: was 4800 (-44%)
          p90: 4488,                // Verified: was 6800 (-34%)
          maxMove: 12574,           // Verified: was 15200 (-17%)
          upDaysPercent: 54         // Verified: was 51 (+6%)
        },
        '7D': {
          avgDollarMove: 2794,      // Verified: was 5800 (-52%) — Key: "BTC $8,200 avg in 7d" was overstated
          medianDollarMove: 1818,   // Verified: was 5000 (-64%)
          avgPercentMove: 4.8,      // Verified: was 6.7 (-28%)
          medianPercentMove: 3.5,   // Verified: was 5.8 (-40%)
          p25: 613,                 // Verified: was 2200 (-72%)
          p75: 4002,                // Verified: was 8200 (-51%)
          p90: 6814,                // Verified: was 11500 (-41%)
          maxMove: 20963,           // Verified: was 28000 (-25%)
          upDaysPercent: 54         // Verified: was 52 (+4%)
        },
        '14D': {
          avgDollarMove: 3926,      // Verified: was 9400 (-58%)
          medianDollarMove: 2534,   // Verified: was 8200 (-69%)
          avgPercentMove: 7.0,      // Verified: was 10.8 (-35%)
          medianPercentMove: 5.0,   // Verified: was 9.4 (-47%)
          p25: 909,                 // Verified: was 3800 (-76%)
          p75: 5846,                // Verified: was 13500 (-57%)
          p90: 9381,                // Verified: was 19200 (-51%)
          maxMove: 22960,           // Verified: was 48000 (-52%)
          upDaysPercent: 56         // Verified: was 51 (+10%)
        },
        '21D': {
          avgDollarMove: 4937,      // Verified: was 12600 (-61%)
          medianDollarMove: 3467,   // Verified: was 11000 (-68%)
          avgPercentMove: 8.9,      // Verified: was 14.5 (-39%)
          medianPercentMove: 6.3,   // Verified: was 12.6 (-50%)
          p25: 1260,                // Verified: was 5200 (-76%)
          p75: 6897,                // Verified: was 18200 (-62%)
          p90: 11318,               // Verified: was 26500 (-57%)
          maxMove: 29557,           // Verified: was 68000 (-57%)
          upDaysPercent: 55         // Verified: was 52 (+6%)
        },
        '30D': {
          avgDollarMove: 6119,      // Verified: was 15200 (-60%)
          medianDollarMove: 4087,   // Verified: was 13500 (-70%)
          avgPercentMove: 11.3,     // Verified: was 17.5 (-35%)
          medianPercentMove: 8.4,   // Verified: was 15.5 (-46%)
          p25: 1654,                // Verified: was 6800 (-76%)
          p75: 8111,                // Verified: was 21800 (-63%)
          p90: 14463,               // Verified: was 32000 (-55%)
          maxMove: 32423,           // Verified: was 89000 (-64%)
          upDaysPercent: 58         // Verified: was 51 (+14%)
        },
        lastUpdated: Date.now()
      };
    }

    // ETH (Updated with historical data from Sep 2022 - Dec 2025)
    if (normalizedSymbol === 'ETH/USDT' || symbol === 'ETH') {
      return {
        symbol,
        '1D': {
          avgDollarMove: 60,        // Verified: was 85 (-29%)
          medianDollarMove: 37,     // Verified: was 72 (-49%)
          avgPercentMove: 2.3,      // Verified: was 2.3 (0%)
          medianPercentMove: 1.6,   // Verified: was 2.0 (-20%)
          p25: 15,                  // Verified: was 32 (-53%)
          p75: 78,                  // Verified: was 115 (-32%)
          p90: 144,                 // Verified: was 165 (-13%)
          maxMove: 612,             // Verified: was 420 (+46%)
          upDaysPercent: 51         // Verified: was 50 (+2%)
        },
        '3D': {
          avgDollarMove: 108,       // Verified: was 145 (-26%)
          medianDollarMove: 70,     // Verified: was 125 (-44%)
          avgPercentMove: 4.1,      // Verified: was 3.9 (+5%)
          medianPercentMove: 3.1,   // Verified: was 3.4 (-9%)
          p25: 28,                  // Verified: was 52 (-46%)
          p75: 148,                 // Verified: was 220 (-33%)
          p90: 264,                 // Verified: was 315 (-16%)
          maxMove: 777,             // Verified: was 720 (+8%)
          upDaysPercent: 51         // Verified: was 51 (0%)
        },
        '7D': {
          avgDollarMove: 167,       // Verified: was 260 (-36%)
          medianDollarMove: 112,    // Verified: was 225 (-50%)
          avgPercentMove: 6.5,      // Verified: was 7.0 (-7%)
          medianPercentMove: 4.9,   // Verified: was 6.1 (-20%)
          p25: 44,                  // Verified: was 92 (-52%)
          p75: 233,                 // Verified: was 385 (-39%)
          p90: 393,                 // Verified: was 540 (-27%)
          maxMove: 1086,            // Verified: was 1280 (-15%)
          upDaysPercent: 51         // Verified: was 51 (0%)
        },
        '14D': {
          avgDollarMove: 240,       // Verified: was 420 (-43%)
          medianDollarMove: 175,    // Verified: was 365 (-52%)
          avgPercentMove: 9.6,      // Verified: was 11.2 (-14%)
          medianPercentMove: 7.4,   // Verified: was 9.8 (-24%)
          p25: 63,                  // Verified: was 155 (-59%)
          p75: 335,                 // Verified: was 625 (-46%)
          p90: 588,                 // Verified: was 890 (-34%)
          maxMove: 1221,            // Verified: was 2100 (-42%)
          upDaysPercent: 49         // Verified: was 51 (-4%)
        },
        '21D': {
          avgDollarMove: 292,       // Verified: was 560 (-48%)
          medianDollarMove: 196,    // Verified: was 485 (-60%)
          avgPercentMove: 11.8,     // Verified: was 15.0 (-21%)
          medianPercentMove: 8.6,   // Verified: was 13.1 (-34%)
          p25: 72,                  // Verified: was 210 (-66%)
          p75: 417,                 // Verified: was 835 (-50%)
          p90: 711,                 // Verified: was 1190 (-40%)
          maxMove: 1384,            // Verified: was 2800 (-51%)
          upDaysPercent: 48         // Verified: was 52 (-8%)
        },
        '30D': {
          avgDollarMove: 365,       // Verified: was 680 (-46%)
          medianDollarMove: 263,    // Verified: was 590 (-55%)
          avgPercentMove: 14.7,     // Verified: was 18.3 (-20%)
          medianPercentMove: 11.3,  // Verified: was 15.9 (-29%)
          p25: 97,                  // Verified: was 260 (-63%)
          p75: 559,                 // Verified: was 1020 (-45%)
          p90: 862,                 // Verified: was 1450 (-41%)
          maxMove: 1756,            // Verified: was 3500 (-50%)
          upDaysPercent: 49         // Verified: was 51 (-4%)
        },
        lastUpdated: Date.now()
      };
    }

    // Default for all other 48 assets: Conservative estimates
    // Used as placeholder until real historical data is available
    return {
      symbol,
      '1D': {
        avgDollarMove: 0.25,
        medianDollarMove: 0.20,
        avgPercentMove: 2.0,
        medianPercentMove: 1.8,
        p25: 0.10,
        p75: 0.35,
        p90: 0.50,
        maxMove: 1.2,
        upDaysPercent: 50
      },
      '3D': {
        avgDollarMove: 0.45,
        medianDollarMove: 0.38,
        avgPercentMove: 3.5,
        medianPercentMove: 3.0,
        p25: 0.18,
        p75: 0.65,
        p90: 0.95,
        maxMove: 2.2,
        upDaysPercent: 50
      },
      '7D': {
        avgDollarMove: 0.82,
        medianDollarMove: 0.70,
        avgPercentMove: 6.5,
        medianPercentMove: 5.5,
        p25: 0.32,
        p75: 1.20,
        p90: 1.75,
        maxMove: 4.0,
        upDaysPercent: 50
      },
      '14D': {
        avgDollarMove: 1.35,
        medianDollarMove: 1.15,
        avgPercentMove: 10.5,
        medianPercentMove: 9.0,
        p25: 0.52,
        p75: 1.95,
        p90: 2.85,
        maxMove: 6.5,
        upDaysPercent: 50
      },
      '21D': {
        avgDollarMove: 1.80,
        medianDollarMove: 1.53,
        avgPercentMove: 14.0,
        medianPercentMove: 12.0,
        p25: 0.70,
        p75: 2.60,
        p90: 3.80,
        maxMove: 8.7,
        upDaysPercent: 50
      },
      '30D': {
        avgDollarMove: 2.20,
        medianDollarMove: 1.87,
        avgPercentMove: 17.0,
        medianPercentMove: 14.5,
        p25: 0.85,
        p75: 3.20,
        p90: 4.65,
        maxMove: 10.6,
        upDaysPercent: 50
      },
      lastUpdated: Date.now()
    };
  }

  /**
   * Calculate dynamic profit target based on trade type and velocity
   * Supports both LONG and SHORT positions
   */
  calculateProfitTarget(
    symbol: string,
    entryPrice: number,
    tradeType: 'SCALP' | 'DAY' | 'SWING' | 'POSITION',
    velocity: AssetVelocityData,
    direction: 'LONG' | 'SHORT' = 'LONG'
  ): number {
    switch (tradeType) {
      case 'SCALP':
        // 1-day move, take 50-75th percentile
        const scalpMove = velocity['1D'].p75 * 0.5;
        return direction === 'LONG' ? entryPrice + scalpMove : entryPrice - scalpMove;

      case 'DAY':
        // 1-day move, take 75th percentile
        const dayMove = velocity['1D'].p75;
        return direction === 'LONG' ? entryPrice + dayMove : entryPrice - dayMove;

      case 'SWING':
        // 7-day move, take full p75
        const swingMove = velocity['7D'].p75;
        return direction === 'LONG' ? entryPrice + swingMove : entryPrice - swingMove;

      case 'POSITION':
        // 21-day move, take 90th percentile
        const posMove = velocity['21D'].p90;
        return direction === 'LONG' ? entryPrice + posMove : entryPrice - posMove;

      default:
        return direction === 'LONG' ? entryPrice * 1.035 : entryPrice * 0.965; // Default 3.5%
    }
  }

  /**
   * Calculate dynamic stop loss based on trade type and velocity
   * Supports both LONG and SHORT positions
   */
  calculateStopLoss(
    symbol: string,
    entryPrice: number,
    tradeType: string,
    velocity: AssetVelocityData,
    direction: 'LONG' | 'SHORT' = 'LONG'
  ): number {
    // Use p25 (25th percentile) as stop - covers most moves
    const lookback = tradeType === 'SCALP' || tradeType === 'DAY' ? '1D' : '7D';
    const stop = velocity[lookback as keyof AssetVelocityData] as VelocityMetrics;
    const stopDistance = stop.p25 * 1.2; // Add 20% buffer
    
    // For LONG: stop is below entry. For SHORT: stop is above entry
    return direction === 'LONG' ? entryPrice - stopDistance : entryPrice + stopDistance;
  }

  /**
   * Check exit signal based on move completion
   * Supports both LONG and SHORT positions
   */
  checkExitSignal(
    entryPrice: number,
    currentPrice: number,
    daysHeld: number,
    tradeType: string,
    velocity: AssetVelocityData,
    direction: 'LONG' | 'SHORT' = 'LONG'
  ): {
    shouldExit: boolean;
    reason: string;
    completionPercent: number;
  } {
    // For LONG: profit if price went up. For SHORT: profit if price went down
    const priceMovement = direction === 'LONG' ? currentPrice - entryPrice : entryPrice - currentPrice;
    const actualMove = Math.abs(priceMovement);

    // Determine expected move based on days held
    let expectedMove = velocity['1D'].avgDollarMove;
    if (daysHeld <= 1) expectedMove = velocity['1D'].avgDollarMove;
    else if (daysHeld <= 3) expectedMove = velocity['3D'].avgDollarMove;
    else if (daysHeld <= 7) expectedMove = velocity['7D'].avgDollarMove;
    else if (daysHeld <= 14) expectedMove = velocity['14D'].avgDollarMove;
    else expectedMove = velocity['30D'].avgDollarMove;

    const completionPercent = (actualMove / expectedMove) * 100;

    // Exit if captured 80%+ of expected move (favorable direction)
    if (priceMovement > 0 && completionPercent >= 80) {
      return {
        shouldExit: true,
        reason: `Captured ${completionPercent.toFixed(0)}% of expected move (favorable)`,
        completionPercent
      };
    }

    // Exit if held 2x longer than expected with <30% favorable move
    const expectedDays = tradeType === 'SCALP' ? 0.5 : tradeType === 'DAY' ? 1 : tradeType === 'SWING' ? 7 : 21;
    if (daysHeld > expectedDays * 2 && (priceMovement < 0 || completionPercent < 30)) {
      return {
        shouldExit: true,
        reason: 'Trade exhausted - move not materializing',
        completionPercent
      };
    }

    return {
      shouldExit: false,
      reason: 'Trade active',
      completionPercent
    };
  }

  // Helper math functions
  private average(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private median(arr: number[]): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private percentile(arr: number[], p: number): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

export const assetVelocityProfiler = new AssetVelocityProfiler();

