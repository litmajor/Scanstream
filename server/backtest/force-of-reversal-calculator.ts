/**
 * Force of Reversal (FoR) Physics-Based Calculator
 * 
 * Detects genuine mean reversion exhaustion through 4 physics-based metrics:
 * 1. Decay Strength (40%): How fast Reversion Quality (R_i) is degrading
 * 2. Depth Compression (25%): Pullbacks getting shallower over time
 * 3. Time Compression (25%): Pullbacks resolving faster
 * 4. Volatility Paradox (10% bonus/mandatory): Price deviation ↑ but volatility ↓
 * 
 * Deployment Rule: Need 2/3 of (Decay, Depth, Time) + Volatility Paradox for confidence
 */

export interface MarketTick {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ForScoreComponents {
  decayStrength: number;      // 0-1: How fast R_i degrades (40% weight)
  depthCompression: number;   // 0-1: Shallower pullbacks (25% weight)
  timeCompression: number;    // 0-1: Faster pullback resolution (25% weight)
  volatilityParadox: boolean; // Binary: Price away from mean, vol down (10% bonus/mandatory)
}

export interface ForAnalysis {
  score: number;              // Final 0-100 score
  components: ForScoreComponents;
  primaryConditionsMet: number;  // How many of 3 met (need ≥2)
  volatilityParadoxPresent: boolean;
  shouldDeploy: boolean;      // True if ≥2 conditions + volatility paradox
  reasoning: string;
}

/**
 * Physics-Based Force of Reversal Calculator
 */
export class ForceOfReversalCalculator {
  
  /**
   * Calculate complete FoR analysis for a scout window
   * 
   * @param ticks Market ticks covering the scout period (entry bar through current bar)
   * @param scoutDirection The scout direction ('BUY' or 'SELL')
   * @param scoutEntryPrice The scout entry price
   * @returns ForAnalysis with score and deployment decision
   */
  static analyze(
    ticks: MarketTick[],
    scoutDirection: 'BUY' | 'SELL',
    scoutEntryPrice: number
  ): ForAnalysis {
    if (ticks.length < 2) {
      return {
        score: 0,
        components: {
          decayStrength: 0,
          depthCompression: 0,
          timeCompression: 0,
          volatilityParadox: false,
        },
        primaryConditionsMet: 0,
        volatilityParadoxPresent: false,
        shouldDeploy: false,
        reasoning: 'Not enough data (need ≥2 ticks)',
      };
    }

    const components = this.calculateComponents(ticks, scoutDirection, scoutEntryPrice);
    const primaryConditionsMet = this.countPrimaryConditions(components);
    const volatilityParadoxPresent = components.volatilityParadox;
    
    // Deployment rule: ≥2 of 3 primary conditions + volatility paradox
    const shouldDeploy = primaryConditionsMet >= 2 && volatilityParadoxPresent;
    
    // Calculate weighted score
    const score = this.calculateScore(components, primaryConditionsMet, volatilityParadoxPresent);
    
    // Build reasoning
    const reasoning = this.buildReasoning(components, primaryConditionsMet, volatilityParadoxPresent, shouldDeploy);

    return {
      score,
      components,
      primaryConditionsMet,
      volatilityParadoxPresent,
      shouldDeploy,
      reasoning,
    };
  }

  /**
   * Calculate all four FoR components
   */
  private static calculateComponents(
    ticks: MarketTick[],
    scoutDirection: 'BUY' | 'SELL',
    scoutEntryPrice: number
  ): ForScoreComponents {
    // Split ticks into early and late periods to detect decay
    const midpoint = Math.ceil(ticks.length / 2);
    const earlyTicks = ticks.slice(0, midpoint);
    const lateTicks = ticks.slice(midpoint);

    // Calculate Decay Strength: Compare R_i (reversion quality) across periods
    const decayStrength = this.calculateDecayStrength(earlyTicks, lateTicks, scoutDirection, scoutEntryPrice);

    // Calculate Depth Compression: Are pullbacks getting shallower?
    const depthCompression = this.calculateDepthCompression(ticks, scoutDirection, scoutEntryPrice);

    // Calculate Time Compression: Are pullbacks resolving faster?
    const timeCompression = this.calculateTimeCompression(ticks, scoutDirection, scoutEntryPrice);

    // Detect Volatility Paradox: Price away from mean BUT volatility DOWN
    const volatilityParadox = this.detectVolatilityParadox(ticks, scoutDirection, scoutEntryPrice);

    return {
      decayStrength,
      depthCompression,
      timeCompression,
      volatilityParadox,
    };
  }

  /**
   * Decay Strength (40% weight)
   * Measures how fast Reversion Quality (R_i) is degrading
   * R_i = (Price pull back toward mean) / (Total price movement)
   * If R_i drops significantly early to late, mean is being exhausted
   */
  private static calculateDecayStrength(
    earlyTicks: MarketTick[],
    lateTicks: MarketTick[],
    scoutDirection: 'BUY' | 'SELL',
    scoutEntryPrice: number
  ): number {
    if (earlyTicks.length < 2 || lateTicks.length < 2) return 0;

    const earlyRi = this.calculateReversionQuality(earlyTicks, scoutDirection, scoutEntryPrice);
    const lateRi = this.calculateReversionQuality(lateTicks, scoutDirection, scoutEntryPrice);

    // Decay = How much R_i dropped (higher drop = more decay = more exhaustion)
    const decay = Math.max(0, earlyRi - lateRi);
    
    // Normalize to 0-1 range
    return Math.min(1, decay / (earlyRi || 1));
  }

  /**
   * Calculate Reversion Quality (R_i)
   * Measures how much price is reverting back toward the mean vs continuing away
   */
  private static calculateReversionQuality(
    ticks: MarketTick[],
    scoutDirection: 'BUY' | 'SELL',
    scoutEntryPrice: number
  ): number {
    if (ticks.length < 2) return 0;

    const meanPrice = this.calculateMean(ticks);
    let reversionMove = 0;
    let totalMove = 0;

    for (let i = 1; i < ticks.length; i++) {
      const prevClose = ticks[i - 1].close;
      const currClose = ticks[i].close;
      const move = currClose - prevClose;
      const moveTowardsMean = scoutDirection === 'BUY'
        ? Math.min(0, move) // BUY scout wants price DOWN (toward entry)
        : Math.max(0, move); // SELL scout wants price UP (toward entry)

      reversionMove += Math.abs(moveTowardsMean);
      totalMove += Math.abs(move);
    }

    return totalMove > 0 ? reversionMove / totalMove : 0;
  }

  /**
   * Depth Compression (25% weight)
   * Pullbacks getting shallower = opposing liquidity exhausted
   * Compare depth of pullbacks in early vs late period
   */
  private static calculateDepthCompression(
    ticks: MarketTick[],
    scoutDirection: 'BUY' | 'SELL',
    scoutEntryPrice: number
  ): number {
    if (ticks.length < 3) return 0;

    const midpoint = Math.ceil(ticks.length / 2);
    
    // Calculate average pullback depth in early period
    const earlyDepth = this.calculateAveragePullbackDepth(
      ticks.slice(0, midpoint),
      scoutDirection,
      scoutEntryPrice
    );
    
    // Calculate average pullback depth in late period
    const lateDepth = this.calculateAveragePullbackDepth(
      ticks.slice(midpoint),
      scoutDirection,
      scoutEntryPrice
    );

    // Compression = Early depth was deeper than late depth
    if (earlyDepth === 0) return 0;
    const compression = (earlyDepth - lateDepth) / earlyDepth;
    
    return Math.max(0, Math.min(1, compression));
  }

  /**
   * Calculate average pullback depth for a tick series
   */
  private static calculateAveragePullbackDepth(
    ticks: MarketTick[],
    scoutDirection: 'BUY' | 'SELL',
    scoutEntryPrice: number
  ): number {
    if (ticks.length < 2) return 0;

    let totalDepth = 0;
    let pullbackCount = 0;

    for (let i = 1; i < ticks.length; i++) {
      const prevClose = ticks[i - 1].close;
      const currClose = ticks[i].close;

      // Check if this is a pullback (move against scout direction)
      if ((scoutDirection === 'BUY' && currClose < prevClose) ||
          (scoutDirection === 'SELL' && currClose > prevClose)) {
        const depth = Math.abs(currClose - prevClose);
        totalDepth += depth;
        pullbackCount++;
      }
    }

    return pullbackCount > 0 ? totalDepth / pullbackCount : 0;
  }

  /**
   * Time Compression (25% weight)
   * Pullbacks resolving faster = opposing side can't sustain counter-moves
   */
  private static calculateTimeCompression(
    ticks: MarketTick[],
    scoutDirection: 'BUY' | 'SELL',
    scoutEntryPrice: number
  ): number {
    if (ticks.length < 3) return 0;

    const midpoint = Math.ceil(ticks.length / 2);
    
    // Calculate average pullback duration in early period
    const earlyDuration = this.calculateAveragePullbackDuration(
      ticks.slice(0, midpoint),
      scoutDirection
    );
    
    // Calculate average pullback duration in late period
    const lateDuration = this.calculateAveragePullbackDuration(
      ticks.slice(midpoint),
      scoutDirection
    );

    // Compression = Early pullbacks lasted longer than late pullbacks
    if (earlyDuration === 0) return 0;
    const compression = (earlyDuration - lateDuration) / earlyDuration;
    
    return Math.max(0, Math.min(1, compression));
  }

  /**
   * Calculate average pullback duration
   */
  private static calculateAveragePullbackDuration(
    ticks: MarketTick[],
    scoutDirection: 'BUY' | 'SELL'
  ): number {
    if (ticks.length < 2) return 0;

    let totalDuration = 0;
    let pullbackCount = 0;
    let inPullback = false;
    let pullbackStart = 0;

    for (let i = 0; i < ticks.length; i++) {
      const currClose = ticks[i].close;
      const prevClose = i > 0 ? ticks[i - 1].close : ticks[i].open;

      const isAgainstDirection = 
        (scoutDirection === 'BUY' && currClose < prevClose) ||
        (scoutDirection === 'SELL' && currClose > prevClose);

      if (isAgainstDirection && !inPullback) {
        inPullback = true;
        pullbackStart = i;
      } else if (!isAgainstDirection && inPullback) {
        totalDuration += i - pullbackStart;
        pullbackCount++;
        inPullback = false;
      }
    }

    // Handle case where pullback extends to end
    if (inPullback) {
      totalDuration += ticks.length - pullbackStart;
      pullbackCount++;
    }

    return pullbackCount > 0 ? totalDuration / pullbackCount : 0;
  }

  /**
   * Volatility Paradox (10% bonus/mandatory flag)
   * True when: Price deviation from mean INCREASES but realized volatility DECREASES
   * This is the "smoking gun" of force exhaustion
   */
  private static detectVolatilityParadox(
    ticks: MarketTick[],
    scoutDirection: 'BUY' | 'SELL',
    scoutEntryPrice: number
  ): boolean {
    if (ticks.length < 3) return false;

    const midpoint = Math.ceil(ticks.length / 2);
    const earlyTicks = ticks.slice(0, midpoint);
    const lateTicks = ticks.slice(midpoint);

    // Calculate mean price for reference
    const meanPrice = this.calculateMean(ticks);

    // Early period metrics
    const earlyDeviation = this.calculateAverageDeviation(earlyTicks, meanPrice);
    const earlyVolatility = this.calculateRealizedVolatility(earlyTicks);

    // Late period metrics
    const lateDeviation = this.calculateAverageDeviation(lateTicks, meanPrice);
    const lateVolatility = this.calculateRealizedVolatility(lateTicks);

    // Paradox: Deviation increased (price moved further from mean)
    // BUT volatility decreased (weak force pulling back)
    const deviationIncreased = lateDeviation > earlyDeviation;
    const volatilityDecreased = lateVolatility < earlyVolatility;

    return deviationIncreased && volatilityDecreased;
  }

  /**
   * Calculate average deviation from mean
   */
  private static calculateAverageDeviation(ticks: MarketTick[], meanPrice: number): number {
    if (ticks.length === 0) return 0;
    const totalDeviation = ticks.reduce((sum, tick) => sum + Math.abs(tick.close - meanPrice), 0);
    return totalDeviation / ticks.length;
  }

  /**
   * Calculate realized volatility (standard deviation of returns)
   */
  private static calculateRealizedVolatility(ticks: MarketTick[]): number {
    if (ticks.length < 2) return 0;

    const returns: number[] = [];
    for (let i = 1; i < ticks.length; i++) {
      const ret = (ticks[i].close - ticks[i - 1].close) / ticks[i - 1].close;
      returns.push(ret);
    }

    if (returns.length === 0) return 0;

    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Calculate mean price
   */
  private static calculateMean(ticks: MarketTick[]): number {
    if (ticks.length === 0) return 0;
    const sum = ticks.reduce((total, tick) => total + tick.close, 0);
    return sum / ticks.length;
  }

  /**
   * Count how many of the 3 primary conditions are met (threshold 0.5)
   */
  private static countPrimaryConditions(components: ForScoreComponents): number {
    let count = 0;
    if (components.decayStrength >= 0.5) count++;
    if (components.depthCompression >= 0.5) count++;
    if (components.timeCompression >= 0.5) count++;
    return count;
  }

  /**
   * Calculate weighted FoR score
   */
  private static calculateScore(
    components: ForScoreComponents,
    primaryConditionsMet: number,
    volatilityParadoxPresent: boolean
  ): number {
    let score = 0;

    // Weighted sum of primary components
    score += components.decayStrength * 0.40;      // 40%
    score += components.depthCompression * 0.25;   // 25%
    score += components.timeCompression * 0.25;    // 25%

    // Volatility paradox: 10% bonus if present
    if (volatilityParadoxPresent) {
      score += 0.10;
    }

    // Bonus for having multiple conditions met
    if (primaryConditionsMet >= 2) {
      score += 0.05; // 5% bonus for meeting ≥2 conditions
    }

    return Math.min(100, Math.round(score * 100));
  }

  /**
   * Build human-readable reasoning
   */
  private static buildReasoning(
    components: ForScoreComponents,
    primaryConditionsMet: number,
    volatilityParadoxPresent: boolean,
    shouldDeploy: boolean
  ): string {
    const parts: string[] = [];

    parts.push(`Decay: ${(components.decayStrength * 100).toFixed(0)}%`);
    parts.push(`Depth: ${(components.depthCompression * 100).toFixed(0)}%`);
    parts.push(`Time: ${(components.timeCompression * 100).toFixed(0)}%`);
    parts.push(`Paradox: ${volatilityParadoxPresent ? 'YES' : 'NO'}`);
    parts.push(`Conditions met: ${primaryConditionsMet}/3`);

    let reason = parts.join(' | ');

    if (shouldDeploy) {
      reason += ' → ✅ DEPLOY (≥2 conditions + paradox)';
    } else if (primaryConditionsMet < 2) {
      reason += ` → ❌ REJECT (need ≥2 of 3, have ${primaryConditionsMet})`;
    } else if (!volatilityParadoxPresent) {
      reason += ' → ❌ REJECT (paradox required)';
    }

    return reason;
  }
}
