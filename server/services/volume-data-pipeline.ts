/**
 * Volume Data Pipeline
 * 
 * Provides real-time volume analysis data feeding into VolumeMechanicalVerifierAgent
 * - Volume Profile calculation (POC, HVN, LVN)
 * - OBV/A-D tracking
 * - Cumulative Delta integration
 * - Smart Money signals
 * 
 * Acts as the data feeding mechanism for the volume agent to generate signals
 */

export interface VolumeData {
  // Current candle
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;

  // Price context
  priceNearHigh: boolean;
  priceNearLow: boolean;
  priceAtSupport: boolean;
  priceAtResistance: boolean;

  // Volume history
  volumeHistory: number[];
  avgVolume20: number;
  avgVolume50: number;
  avgVolume100: number;

  // Price history
  priceHistory: number[];
  highHistory: number[];
  lowHistory: number[];

  // Advanced metrics
  volumeProfile: {
    poc: number;           // Point of Control
    hvn: number[];        // High Volume Nodes
    lvn: number[];        // Low Volume Nodes
    totalProfileVolume: number;
  };

  obv: number;            // On-Balance Volume
  obvSignal: number;      // 20-period EMA of OBV
  advLine: number;        // Accumulation/Distribution Line

  cumulativeDelta: number; // Sum of (up volume - down volume)
  deltaMa: number;        // MA of cumulative delta
}

export class VolumePipeline {
  private volumeHistory: number[] = [];
  private priceHistory: number[] = [];
  private highHistory: number[] = [];
  private lowHistory: number[] = [];
  
  // OBV tracking
  private obvHistory: number[] = [];
  private lastOBV: number = 0;

  // A/D Line tracking
  private adHistory: number[] = [];
  private lastAD: number = 0;

  // Cumulative Delta tracking
  private deltaHistory: number[] = [];
  private lastDelta: number = 0;

  // Volume Profile (POC, HVN, LVN) - updated every N candles
  private volumeProfile: Map<number, number> = new Map(); // price level -> accumulated volume
  private profileUpdateInterval: number = 50; // Recalculate every 50 candles
  private candlesSinceProfileUpdate: number = 0;

  // Support/Resistance levels
  private supportLevels: number[] = [];
  private resistanceLevels: number[] = [];

  constructor(supportLevels?: number[], resistanceLevels?: number[]) {
    this.supportLevels = supportLevels || [];
    this.resistanceLevels = resistanceLevels || [];
  }

  /**
   * Process a new candle and update all volume metrics
   */
  processCandle(candle: {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }): VolumeData {
    // Add to history
    this.volumeHistory.push(candle.volume);
    this.priceHistory.push(candle.close);
    this.highHistory.push(candle.high);
    this.lowHistory.push(candle.low);

    // Keep last 100 candles for calculation
    if (this.volumeHistory.length > 100) {
      this.volumeHistory.shift();
      this.priceHistory.shift();
      this.highHistory.shift();
      this.lowHistory.shift();
    }

    // Update volume profile
    this.updateVolumeProfile(candle);

    // Calculate OBV (On-Balance Volume)
    const obv = this.calculateOBV(candle);

    // Calculate A/D Line (Accumulation/Distribution)
    const advLine = this.calculateADLine(candle);

    // Calculate Cumulative Delta
    const delta = this.calculateCumulativeDelta(candle);

    // Price context
    const recentHigh = Math.max(...this.highHistory.slice(-20));
    const recentLow = Math.min(...this.lowHistory.slice(-20));
    const range = recentHigh - recentLow;

    const priceNearHigh = (recentHigh - candle.close) / range < 0.1; // Top 10%
    const priceNearLow = (candle.close - recentLow) / range < 0.1;   // Bottom 10%

    // Check support/resistance proximity
    let priceAtSupport = false;
    let priceAtResistance = false;

    for (const support of this.supportLevels) {
      if (Math.abs(candle.close - support) / support < 0.01) {
        priceAtSupport = true;
        break;
      }
    }

    for (const resistance of this.resistanceLevels) {
      if (Math.abs(candle.close - resistance) / resistance < 0.01) {
        priceAtResistance = true;
        break;
      }
    }

    // Calculate averages
    const avgVolume20 = this.calculateAverage(this.volumeHistory.slice(-20));
    const avgVolume50 = this.calculateAverage(this.volumeHistory.slice(-50));
    const avgVolume100 = this.calculateAverage(this.volumeHistory.slice(-100));

    // Calculate EMA of OBV (20-period)
    const obvSignal = this.calculateEMA(this.obvHistory, 20);

    // Calculate MA of Delta (20-period)
    const deltaMa = this.calculateSimpleMA(this.deltaHistory, 20);

    // Get current volume profile stats
    const profileStats = this.getVolumeProfileStats();

    return {
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      priceNearHigh,
      priceNearLow,
      priceAtSupport,
      priceAtResistance,
      volumeHistory: [...this.volumeHistory],
      avgVolume20,
      avgVolume50,
      avgVolume100,
      priceHistory: [...this.priceHistory],
      highHistory: [...this.highHistory],
      lowHistory: [...this.lowHistory],
      volumeProfile: profileStats,
      obv,
      obvSignal,
      advLine,
      cumulativeDelta: delta,
      deltaMa
    };
  }

  /**
   * Update volume profile (POC, HVN, LVN)
   * Uses price levels from recent candles and accumulates volume
   */
  private updateVolumeProfile(candle: { high: number; low: number; volume: number }): void {
    // Discretize price into levels (using $1 buckets for flexibility)
    const bucketSize = 1;
    
    // Add volume across price range touched by this candle
    const minLevel = Math.floor(candle.low / bucketSize) * bucketSize;
    const maxLevel = Math.ceil(candle.high / bucketSize) * bucketSize;

    // Distribute volume proportionally across touched levels
    const levelsTouched = (maxLevel - minLevel) / bucketSize + 1;
    const volumePerLevel = candle.volume / levelsTouched;

    for (let level = minLevel; level <= maxLevel; level += bucketSize) {
      const currentVol = this.volumeProfile.get(level) || 0;
      this.volumeProfile.set(level, currentVol + volumePerLevel);
    }

    // Increment counter and purge old data if needed
    this.candlesSinceProfileUpdate++;
    if (this.candlesSinceProfileUpdate >= this.profileUpdateInterval) {
      // Keep only recent data (last 50 levels worth)
      if (this.volumeProfile.size > 200) {
        const entries = Array.from(this.volumeProfile.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 100); // Keep top 100 levels
        this.volumeProfile = new Map(entries);
      }
      this.candlesSinceProfileUpdate = 0;
    }
  }

  /**
   * Get volume profile statistics (POC, HVN, LVN)
   */
  private getVolumeProfileStats(): {
    poc: number;
    hvn: number[];
    lvn: number[];
    totalProfileVolume: number;
  } {
    if (this.volumeProfile.size === 0) {
      return {
        poc: this.priceHistory[this.priceHistory.length - 1] || 0,
        hvn: [],
        lvn: [],
        totalProfileVolume: 0
      };
    }

    // Sort by volume
    const entries = Array.from(this.volumeProfile.entries())
      .sort((a, b) => b[1] - a[1]);

    const poc = entries[0][0]; // Highest volume level
    const totalVolume = entries.reduce((sum, [, vol]) => sum + vol, 0);

    // HVN: Top 20% of levels by volume
    const hvnCount = Math.max(3, Math.ceil(entries.length * 0.2));
    const hvn = entries.slice(0, hvnCount).map(([level]) => level);

    // LVN: Bottom 20% of levels
    const lvnCount = Math.max(3, Math.ceil(entries.length * 0.2));
    const lvn = entries.slice(-lvnCount).map(([level]) => level);

    return {
      poc,
      hvn,
      lvn,
      totalProfileVolume: totalVolume
    };
  }

  /**
   * Calculate On-Balance Volume (OBV)
   * Cumulative volume with +/- based on close direction
   */
  private calculateOBV(candle: {
    open: number;
    close: number;
    volume: number;
  }): number {
    let obv = this.lastOBV;

    if (candle.close > candle.open) {
      obv += candle.volume;
    } else if (candle.close < candle.open) {
      obv -= candle.volume;
    }
    // If close === open, no change to OBV

    this.lastOBV = obv;
    this.obvHistory.push(obv);

    if (this.obvHistory.length > 100) {
      this.obvHistory.shift();
    }

    return obv;
  }

  /**
   * Calculate A/D Line (Accumulation/Distribution)
   * Incorporates price location within high-low range
   */
  private calculateADLine(candle: {
    high: number;
    low: number;
    close: number;
    volume: number;
  }): number {
    const range = candle.high - candle.low;
    const closeLocation = range > 0 ? (candle.close - candle.low) / range : 0.5;

    // Money Flow Multiplier
    const mfm = (2 * closeLocation - 1); // -1 to +1
    const mfv = mfm * candle.volume;

    let ad = this.lastAD + mfv;
    this.lastAD = ad;
    this.adHistory.push(ad);

    if (this.adHistory.length > 100) {
      this.adHistory.shift();
    }

    return ad;
  }

  /**
   * Calculate Cumulative Delta
   * Estimates up vs down volume based on close position
   */
  private calculateCumulativeDelta(candle: {
    high: number;
    low: number;
    close: number;
    volume: number;
  }): number {
    const range = candle.high - candle.low;
    const closeRatio = range > 0 ? (candle.close - candle.low) / range : 0.5;

    // Estimate: volume in upper half is "up", lower half is "down"
    const upVolume = candle.volume * closeRatio;
    const downVolume = candle.volume * (1 - closeRatio);
    const delta = upVolume - downVolume;

    let cumDelta = this.lastDelta + delta;
    this.lastDelta = cumDelta;
    this.deltaHistory.push(cumDelta);

    if (this.deltaHistory.length > 100) {
      this.deltaHistory.shift();
    }

    return cumDelta;
  }

  /**
   * Calculate simple moving average
   */
  private calculateSimpleMA(values: number[], period: number): number {
    if (values.length < period) {
      return values.length > 0 ? values[values.length - 1] : 0;
    }
    const sum = values.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  /**
   * Calculate exponential moving average
   */
  private calculateEMA(values: number[], period: number): number {
    if (values.length === 0) return 0;
    if (values.length < period) {
      return values[values.length - 1];
    }

    const multiplier = 2 / (period + 1);
    let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < values.length; i++) {
      ema = (values[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  /**
   * Calculate average
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Update support/resistance levels
   */
  updateStructuralLevels(supportLevels: number[], resistanceLevels: number[]): void {
    this.supportLevels = supportLevels;
    this.resistanceLevels = resistanceLevels;
  }

  /**
   * Get current volume metrics summary
   */
  getCurrentMetrics() {
    const recent = this.volumeHistory.slice(-20);
    const avgRecent = this.calculateAverage(recent);
    const currentVol = this.volumeHistory[this.volumeHistory.length - 1] || 0;
    const ratio = avgRecent > 0 ? currentVol / avgRecent : 1;

    return {
      currentVolume: currentVol,
      avgVolume20: avgRecent,
      volumeRatio: ratio,
      isSpike: ratio > 1.5,
      obv: this.lastOBV,
      adLine: this.lastAD,
      cumulativeDelta: this.lastDelta
    };
  }

  /**
   * Reset all data
   */
  reset(): void {
    this.volumeHistory = [];
    this.priceHistory = [];
    this.highHistory = [];
    this.lowHistory = [];
    this.obvHistory = [];
    this.lastOBV = 0;
    this.adHistory = [];
    this.lastAD = 0;
    this.deltaHistory = [];
    this.lastDelta = 0;
    this.volumeProfile.clear();
    this.candlesSinceProfileUpdate = 0;
  }
}

export default VolumePipeline;
