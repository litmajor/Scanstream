/**
 * VOLUME MECHANICAL VERIFIER AGENT
 * 
 * Role: System-wide "truth verifier" embodying "Volume Precedes Price" and "Effort vs. Result"
 * 
 * This is a FULL RPG agent participating in main consensus voting (not exit-only).
 * It validates entries, confirms trend strength, detects fakeouts, and signals exhaustion.
 * 
 * Position in Architecture:
 * - Full voting member in RPG Agent Arena (same level as BreakoutHunter, TrendRider, etc.)
 * - Feeds into main consensus → unified pipeline
 * - ExitOrchestrator can reference volume insights if needed
 * 
 * Key Principles:
 * - Volume Precedes Price: True price moves have volume support
 * - Effort vs. Result: Large moves on small volume = exhaustion/trap
 * - Smart Money: Accumulation at support, distribution at resistance
 * - Climax: Extreme volume at extremes = reversal potential
 */

import { TradingAgent } from './TradingAgent.ts';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface VolumeAnalysisInput {
  // Current candle data
  currentPrice: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;

  // Price context
  priceNearHigh: boolean;
  priceNearLow: boolean;
  priceAtSupport: boolean;
  priceAtResistance: boolean;

  // Volume history (last N candles)
  volumeHistory: number[];  // Last 20-50 volumes
  avgVolume20: number;
  avgVolume50: number;
  avgVolume100: number;

  // Price history (for trends)
  priceHistory: number[];   // Last 20-50 closes
  highHistory: number[];
  lowHistory: number[];

  // Volume Profile (if available, calculated from recent candles)
  volumeProfile?: {
    poc: number;              // Point of Control (price level with most volume)
    hvn: number[];            // High Volume Nodes
    lvn: number[];            // Low Volume Nodes
    totalProfileVolume: number;
  };

  // Accumulation/Distribution Line
  obv?: number;              // On-Balance Volume
  obvSignal?: number;        // 20-period EMA of OBV
  advLine?: number;          // Accumulation/Distribution Line

  // Tick data (if available)
  cumulativeDelta?: number;  // Sum of (up volume - down volume)
  deltaMa?: number;          // MA of cumulative delta
}

export interface ValueZones {
  poc: number;              // Point of Control
  hvnLevels: number[];      // High Volume Nodes
  lvnLevels: number[];      // Low Volume Nodes
  controlLevel: string;     // 'SUPPORT' | 'RESISTANCE' | 'NEUTRAL'
}

export type SmartMoneySignal = 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
export type BreakoutValidity = 'VALID' | 'FAKEOUT' | 'NONE';
export type AggressionDelta = 'BUYERS_DOMINANT' | 'SELLERS_DOMINANT' | 'BALANCED';
export type ClimaticEvent = 'BUYING_CLIMAX' | 'SELLING_CLIMAX' | 'NONE';

export interface VolumeProfile {
  poc: number;              // Point of Control (highest volume price level)
  hvn: number[];            // High Volume Nodes (top 70% of volume)
  lvn: number[];            // Low Volume Nodes (bottom 30% of volume)
  totalVolume: number;
  bins: Map<number, number>; // Price bin -> volume mapping
}

export interface VolumeAnalysisResult {
  convictionScore: number;              // 0-100, effort vs result
  valueZones: ValueZones;
  smartMoneySignal: SmartMoneySignal;
  breakoutValidity: BreakoutValidity;
  climaxDetected: ClimaticEvent;
  trueIntent: AggressionDelta;          // From aggression delta
  significantEvent: string;             // 'NONE' | 'VALID_BREAKOUT' | 'FAKEOUT' | 'CLIMAX' | 'DISTRIBUTION' | 'ACCUMULATION'
  detectedPatterns: string[];           // Readable patterns found
  reasoning: string[];
  
  // Advanced VSA & Volume Profile
  noDemandDetected: boolean;
  noSupplyDetected: boolean;
  stoppingVolumeDetected: boolean;
  testOfLevelDetected: boolean;
  volumeOscillator: number;
}

// ============================================================================
// VOLUME MECHANICAL VERIFIER AGENT
// ============================================================================

export class VolumeMechanicalVerifierAgent extends TradingAgent {
  // Personality-driven thresholds & regime awareness
  private volumeThreshold: number;
  private minConvictionThreshold: number;
  private regimeMode: 'trending' | 'ranging' = 'ranging';
  private patternWinRates: Map<string, { wins: number; total: number }> = new Map();
  private lastAnalysis: VolumeAnalysisResult | null = null;
  private baseConfidence: number = 0.65;
  private tickSize: number = 0.01; // Default for crypto, adjust per asset
  private volumeOscillatorHistory: number[] = []; // For EMA smoothing

  constructor(
    name: string = 'MechanicalVerifier',
    personality: 'aggressive' | 'balanced' | 'conservative' = 'balanced',
    regime: 'trending' | 'ranging' = 'ranging'
  ) {
    super(name, 'SUPPORT_BOUNCE' as any, personality);

    // Skill levels (1-10 scale)
    this.skill_levels = {
      conviction_check: 6,              // Effort vs Result validation
      structural_anchor: 5,             // POC, HVN, LVN mapping
      smart_money_insight: 4,           // Acc/Dist divergence detection
      breakout_integrity: 7,            // Volume surge validation
      aggression_delta: 3,              // Cumulative Delta (advanced)
      climax_detection: 5,              // Buying/selling climax
    };

    this.baseConfidence = 0.65;
    this.regimeMode = regime;

    // Personality-driven thresholds for signal generation
    if (personality === 'aggressive') {
      this.volumeThreshold = 1.3;       // Accept lower volume for breakouts
      this.minConvictionThreshold = 55; // Signal more often
    } else if (personality === 'conservative') {
      this.volumeThreshold = 1.8;       // Require strong volume confirmation
      this.minConvictionThreshold = 75; // Only signal on high conviction
    } else {
      this.volumeThreshold = 1.5;       // Balanced approach
      this.minConvictionThreshold = 60; // Moderate threshold
    }
  }

  /**
   * Set or update regime mode (affects volume thresholds)
   */
  setRegime(regime: 'trending' | 'ranging'): void {
    this.regimeMode = regime;
  }

  /**
   * Set tick size for proper volume profile binning
   * Prevents floating point drift in bin calculations
   */
  setTickSize(tickSize: number): void {
    this.tickSize = tickSize;
  }

  /**
   * Get combo partners for synergy detector integration
   * Returns agent types that work well with this volume verifier
   */
  getComboPartners(): string[] {
    return [
      'BREAKOUT',           // Volume Validated Breakout combo
      'REVERSAL',           // Climax Reversal combo
      'ML_PREDICTION',      // Smart Money Flow combo
      'TREND_RIDER',        // Volume Conviction Buy combo
      'SUPPORT_BOUNCE',     // Fakeout Guard combo
    ];
  }

  /**
   * Record pattern outcomes for statistical learning
   */
  recordPatternOutcome(eventType: string, wasSuccessful: boolean): void {
    if (!this.patternWinRates.has(eventType)) {
      this.patternWinRates.set(eventType, { wins: 0, total: 0 });
    }
    const stats = this.patternWinRates.get(eventType)!;
    stats.total++;
    if (wasSuccessful) stats.wins++;
  }

  /**
   * Get historical win rate for pattern type (auto-adjust confidence)
   */
  private getPatternWinRate(eventType: string): number {
    const stats = this.patternWinRates.get(eventType);
    if (!stats || stats.total < 5) return 0.5; // Default 50% if insufficient data
    return stats.wins / stats.total;
  }

  /**
   * Main signal generation — called every candle
   * Analyzes volume to validate/invalidate other agents' enthusiasm
   */
  generateSignal(state: VolumeAnalysisInput): any {
    const analysis = this.analyzeVolume(state);
    this.lastAnalysis = analysis;

    // Only generate signal if something meaningful detected
    if (analysis.significantEvent === 'NONE') {
      return null;
    }

    // Conviction threshold filter — prevents flooding in choppy markets
    if (analysis.convictionScore < this.minConvictionThreshold) {
      return null; // Conviction too low for this personality
    }

    const action = this.determineAction(analysis);
    const confidence = this.calculateConfidence(analysis);

    return {
      action,
      confidence: Math.min(confidence * (1 + (this.level - 1) * 0.02), 0.95),
      entry: state.currentPrice,
      stop: this.calculateStop(state, analysis),
      target: this.calculateTarget(state, analysis),
      reason: analysis.reasoning.join('; '),
      agent_name: this.name,
      agent_level: this.level,
      patterns_detected: analysis.detectedPatterns,
      priority: this.getPriority(analysis),
    };
  }

  /**
   * Multi-faceted volume analysis
   */
  private analyzeVolume(state: VolumeAnalysisInput): VolumeAnalysisResult {
    const result: VolumeAnalysisResult = {
      convictionScore: this.convictionCheck(state),
      valueZones: this.mapStructuralAnchors(state),
      smartMoneySignal: this.detectSmartMoney(state),
      breakoutValidity: this.validateBreakout(state),
      climaxDetected: this.detectClimax(state),
      trueIntent: this.revealAggressionDelta(state),
      significantEvent: 'NONE',
      detectedPatterns: [],
      reasoning: [],
      noDemandDetected: false,
      noSupplyDetected: false,
      stoppingVolumeDetected: false,
      testOfLevelDetected: false,
      volumeOscillator: 0,
    };

    // Advanced VSA techniques
    result.noDemandDetected = this.detectNoDemand(state);
    result.noSupplyDetected = this.detectNoSupply(state);
    result.stoppingVolumeDetected = this.detectStoppingVolume(state);
    result.testOfLevelDetected = this.detectTestOfLevel(state);
    result.volumeOscillator = this.calculateVolumeOscillator(state);

    // Determine if there's a meaningful event (priority order)
    if (result.climaxDetected !== 'NONE') {
      result.significantEvent = `CLIMAX_${result.climaxDetected}`;
      result.detectedPatterns.push(result.climaxDetected);
      result.reasoning.push(`Volume climax detected: ${result.climaxDetected} — high probability reversal`);
    } else if (result.stoppingVolumeDetected) {
      result.significantEvent = 'STOPPING_VOLUME';
      result.detectedPatterns.push('INSTITUTIONAL_BUY_SUPPORT');
      result.reasoning.push('Stopping volume halting decline — strong institutional support');
    } else if (result.noDemandDetected) {
      result.significantEvent = 'NO_DEMAND';
      result.detectedPatterns.push('VSA_NO_DEMAND');
      result.reasoning.push('No demand pattern detected — bearish weakness, sellers in control');
    } else if (result.noSupplyDetected) {
      result.significantEvent = 'NO_SUPPLY';
      result.detectedPatterns.push('VSA_NO_SUPPLY');
      result.reasoning.push('No supply pattern detected — bullish strength, buyers in control');
    } else if (result.testOfLevelDetected) {
      result.significantEvent = 'TEST_OF_LEVEL';
      result.detectedPatterns.push('STRENGTH_CONFIRMATION');
      result.reasoning.push('Price retesting level on low volume — strength confirmation');
    } else if (result.breakoutValidity === 'VALID') {
      result.significantEvent = 'VALID_BREAKOUT';
      result.detectedPatterns.push('VALIDATED_BREAKOUT');
      result.reasoning.push('Volume surge confirms breakout integrity — high conviction entry');
    } else if (result.breakoutValidity === 'FAKEOUT') {
      result.significantEvent = 'FAKEOUT';
      result.detectedPatterns.push('FAKEOUT_TRAP');
      result.reasoning.push('Price break on weak volume — classic fakeout trap, avoid entry');
    } else if (result.smartMoneySignal === 'DISTRIBUTION' && state.priceNearHigh) {
      result.significantEvent = 'DISTRIBUTION';
      result.detectedPatterns.push('SMART_MONEY_DISTRIBUTION');
      result.reasoning.push('Smart money distributing at highs — risk reward unfavorable');
    } else if (result.smartMoneySignal === 'ACCUMULATION' && state.priceNearLow) {
      result.significantEvent = 'ACCUMULATION';
      result.detectedPatterns.push('SMART_MONEY_ACCUMULATION');
      result.reasoning.push('Smart money accumulating at lows — strong setup for reversal');
    } else if (result.convictionScore > 75 && result.trueIntent === 'BUYERS_DOMINANT') {
      result.significantEvent = 'HIGH_CONVICTION_BUY';
      result.detectedPatterns.push('BUYER_DOMINANCE');
      result.reasoning.push(`High conviction buyers: effort vs result = ${result.convictionScore.toFixed(0)}`);
    } else if (result.convictionScore > 75 && result.trueIntent === 'SELLERS_DOMINANT') {
      result.significantEvent = 'HIGH_CONVICTION_SELL';
      result.detectedPatterns.push('SELLER_DOMINANCE');
      result.reasoning.push(`High conviction sellers: effort vs result = ${result.convictionScore.toFixed(0)}`);
    }

    return result;
  }

  /**
   * ABILITY 1: Conviction Check (Effort vs. Result)
   * Compares price move magnitude against volume spent
   * 
   * High conviction: Big move on above-average volume
   * Low conviction: Small move on huge volume (accumulation) or big move on tiny volume (trap)
   */
  private convictionCheck(state: VolumeAnalysisInput): number {
    // Recent average move
    const recentMoves = [];
    for (let i = 1; i < Math.min(5, state.priceHistory.length); i++) {
      recentMoves.push(Math.abs(state.priceHistory[i] - state.priceHistory[i - 1]));
    }
    const avgMove = recentMoves.length > 0 ? recentMoves.reduce((a, b) => a + b) / recentMoves.length : 0;

    // Current move
    const currentMove = Math.abs(state.close - state.open);

    // Volume ratio
    const volumeRatio = state.volume / state.avgVolume20;

    // Conviction score (0-100)
    let conviction = 50; // baseline

    // Big move on big volume = high conviction
    if (currentMove > avgMove * 1.5 && volumeRatio > 1.3) {
      conviction = 85 + Math.min(15, (volumeRatio - 1.3) * 10);
    }
    // Big move on low volume = trap
    else if (currentMove > avgMove * 1.5 && volumeRatio < 0.8) {
      conviction = 20; // Low conviction, likely trap
    }
    // Small move on high volume = accumulation/distribution
    else if (currentMove < avgMove * 0.5 && volumeRatio > 1.5) {
      conviction = 65; // Moderate-high conviction (smart money positioning)
    }
    // Normal move on normal volume = moderate conviction
    else if (currentMove > avgMove && volumeRatio > 1.0) {
      conviction = 70;
    }
    // Declining move with rising volume = climax potential
    else if (currentMove < avgMove && volumeRatio > 1.2) {
      conviction = 60; // Caution flag
    }

    return Math.min(conviction, 100);
  }

  /**
   * ABILITY 2: Structural Anchors (Volume Profile)
   * Maps price levels with high/low volume history
   * Identifies support/resistance based on volume concentration
   * Checks price proximity to POC/HVN for fair value context
   */
  private mapStructuralAnchors(state: VolumeAnalysisInput): ValueZones {
    const result: ValueZones = {
      poc: 0,
      hvnLevels: [],
      lvnLevels: [],
      controlLevel: 'NEUTRAL',
    };

    if (!state.volumeProfile) {
      // If no profile, estimate from current volume
      result.poc = state.close;
      result.hvnLevels = [state.high];
      result.lvnLevels = [state.low];
      return result;
    }

    // Use provided volume profile
    result.poc = state.volumeProfile.poc;
    result.hvnLevels = state.volumeProfile.hvn || [state.high];
    result.lvnLevels = state.volumeProfile.lvn || [state.low];

    // Determine control level with proximity awareness
    if (state.priceAtSupport) {
      result.controlLevel = 'SUPPORT';
    } else if (state.priceAtResistance) {
      result.controlLevel = 'RESISTANCE';
    } else {
      // Check proximity to POC/HVN for fair value assessment
      const pocDistance = Math.abs(state.close - result.poc);
      const pocRange = state.high - state.low || 1;
      if (pocDistance < pocRange * 0.02) {
        // Price near POC = at fair value
        result.controlLevel = 'FAIR_VALUE';
      } else {
        result.controlLevel = 'NEUTRAL';
      }
    }

    return result;
  }

  /**
   * ABILITY 3: Smart Money Insight
   * Detects accumulation (rising OBV/A-D at lows) vs distribution (falling OBV at highs)
   * Reveals institutional positioning
   */
  private detectSmartMoney(state: VolumeAnalysisInput): SmartMoneySignal {
    let signal: SmartMoneySignal = 'NEUTRAL';

    // Use OBV or A/D line if available
    if (state.obv !== undefined && state.obvSignal !== undefined) {
      const obvDivergence = state.obv - state.obvSignal;

      // Accumulation: Price low, OBV rising
      if (state.priceNearLow && obvDivergence > 0) {
        signal = 'ACCUMULATION';
      }
      // Distribution: Price high, OBV falling
      else if (state.priceNearHigh && obvDivergence < 0) {
        signal = 'DISTRIBUTION';
      }
    }

    // Cross-check with cumulative delta if available
    if (state.cumulativeDelta !== undefined && state.deltaMa !== undefined) {
      const deltaDivergence = state.cumulativeDelta - state.deltaMa;

      if (state.priceNearLow && deltaDivergence > 0) {
        signal = 'ACCUMULATION';
      } else if (state.priceNearHigh && deltaDivergence < 0) {
        signal = 'DISTRIBUTION';
      }
    }

    return signal;
  }

  /**
   * ABILITY 4: Breakout Integrity
   * Validates price breakouts with volume confirmation
   * Scales thresholds by personality, skill level, and regime
   * 
   * Personality:
   *   Aggressive: 1.3x volume (more trades)
   *   Balanced: 1.5x volume
   *   Conservative: 1.8x volume (higher confidence)
   * 
   * Skill Scaling: breakout_integrity skill (1-10) reduces required volume by up to 15%
   * Regime: Trending mode reduces volume requirement by 10%
   */
  private validateBreakout(state: VolumeAnalysisInput): BreakoutValidity {
    const volumeRatio = state.volume / state.avgVolume20;
    const priceBreak = Math.abs(state.high - state.low) / state.low;

    // Scale threshold by skill level (higher skill = lower required volume)
    // breakout_integrity skill ranges 1-10, scales volumeThreshold down to -15%
    const skillAdjustment = 1.0 - ((this.skill_levels.breakout_integrity - 1) / 9) * 0.15;
    const adjustedThreshold = this.volumeThreshold * skillAdjustment;

    // Regime adjustment: trending requires less volume confirmation (institutions move fast)
    const regimeMultiplier = this.regimeMode === 'trending' ? 0.9 : 1.0;
    const finalThreshold = adjustedThreshold * regimeMultiplier;

    // Breakout with sufficient volume = VALID
    if (priceBreak > 0.02 && volumeRatio > finalThreshold) {
      return 'VALID';
    }

    // Price break but volume declining = FAKEOUT
    if (priceBreak > 0.02 && volumeRatio < 0.9) {
      return 'FAKEOUT';
    }

    // Price break with moderate volume = uncertain (conservative threshold) or valid (aggressive)
    if (priceBreak > 0.02 && volumeRatio > 1.0 && volumeRatio <= finalThreshold) {
      // For aggressive personality, accept moderate volume
      if (this.volumeThreshold <= 1.4) return 'VALID';
      return 'NONE';
    }

    return 'NONE';
  }

  /**
   * ABILITY 5: Climax Detection
   * Identifies buying/selling climaxes (volume + price extremes = exhaustion)
   * 
   * BUYING_CLIMAX: High at multi-period high + extreme volume
   * SELLING_CLIMAX: Low at multi-period low + extreme volume
   */
  private detectClimax(state: VolumeAnalysisInput): ClimaticEvent {
    const volumeRatio = state.volume / state.avgVolume20;
    const isExtremely = volumeRatio > 2.0; // 2x average is extreme

    // Check for multi-candle highs/lows
    let isHighestRecent = true;
    let isLowestRecent = true;

    if (state.highHistory && state.highHistory.length > 10) {
      const max = Math.max(...state.highHistory.slice(-10));
      isHighestRecent = state.high >= max * 0.99;
    }

    if (state.lowHistory && state.lowHistory.length > 10) {
      const min = Math.min(...state.lowHistory.slice(-10));
      isLowestRecent = state.low <= min * 1.01;
    }

    // Buying climax: Highest + extreme volume
    if (isHighestRecent && isExtremely && state.close > state.open) {
      return 'BUYING_CLIMAX';
    }

    // Selling climax: Lowest + extreme volume
    if (isLowestRecent && isExtremely && state.close < state.open) {
      return 'SELLING_CLIMAX';
    }

    return 'NONE';
  }

  /**
   * ABILITY 6: Aggression Delta (Cumulative Delta)
   * If tick data available: reveals true buyer vs seller aggression
   * Otherwise: estimates from price action + volume
   */
  private revealAggressionDelta(state: VolumeAnalysisInput): AggressionDelta {
    // Prefer cumulative delta if available
    if (state.cumulativeDelta !== undefined && state.deltaMa !== undefined) {
      if (state.cumulativeDelta > state.deltaMa) {
        return 'BUYERS_DOMINANT';
      } else if (state.cumulativeDelta < state.deltaMa) {
        return 'SELLERS_DOMINANT';
      } else {
        return 'BALANCED';
      }
    }

    // Fallback: Estimate from close position + volume
    // Close in upper half + high volume = buyers dominant
    const closeRatio = (state.close - state.low) / (state.high - state.low);
    const volumeRatio = state.volume / state.avgVolume20;

    if (closeRatio > 0.6 && volumeRatio > 1.0) {
      return 'BUYERS_DOMINANT';
    } else if (closeRatio < 0.4 && volumeRatio > 1.0) {
      return 'SELLERS_DOMINANT';
    } else {
      return 'BALANCED';
    }
  }

  /**
   * Determine action (BUY/SELL/HOLD) based on analysis
   * Uses VSA patterns more aggressively for stronger signals
   */
  private determineAction(analysis: VolumeAnalysisResult): 'BUY' | 'SELL' | 'HOLD' {
    // Climax reversals - highest conviction reversals
    if (analysis.climaxDetected === 'SELLING_CLIMAX') {
      return 'BUY';
    }
    if (analysis.climaxDetected === 'BUYING_CLIMAX') {
      return 'SELL';
    }

    // VSA patterns - aggressive usage for strong signals
    // No supply: Strong bullish signal with conviction
    if (analysis.noSupplyDetected && analysis.convictionScore > 60) {
      return 'BUY';
    }

    // No demand: Strong bearish signal with conviction
    if (analysis.noDemandDetected && analysis.convictionScore > 60) {
      return 'SELL';
    }

    // Stopping volume with direction confirmation
    // Bullish: High volume stopping decline + buyers dominant
    if (analysis.stoppingVolumeDetected && analysis.trueIntent === 'BUYERS_DOMINANT') {
      return 'BUY';
    }
    // Bearish: High volume stopping rally + sellers dominant
    if (analysis.stoppingVolumeDetected && analysis.trueIntent === 'SELLERS_DOMINANT') {
      return 'SELL';
    }

    // Test of level = confirm direction of breakout
    if (analysis.testOfLevelDetected && analysis.volumeOscillator > 0) {
      return 'BUY';
    }
    if (analysis.testOfLevelDetected && analysis.volumeOscillator < 0) {
      return 'SELL';
    }

    // Fakeouts to avoid
    if (analysis.breakoutValidity === 'FAKEOUT') {
      return 'HOLD'; // Don't trade, risk is high
    }

    // Valid breakouts
    if (analysis.breakoutValidity === 'VALID' && analysis.trueIntent === 'BUYERS_DOMINANT') {
      return 'BUY';
    }
    if (analysis.breakoutValidity === 'VALID' && analysis.trueIntent === 'SELLERS_DOMINANT') {
      return 'SELL';
    }

    // Smart money distribution/accumulation
    if (analysis.smartMoneySignal === 'ACCUMULATION') {
      return 'BUY';
    }
    if (analysis.smartMoneySignal === 'DISTRIBUTION') {
      return 'SELL';
    }

    // High conviction buyers/sellers with positive volume oscillator
    if (analysis.trueIntent === 'BUYERS_DOMINANT' && analysis.convictionScore > 70 && analysis.volumeOscillator > 10) {
      return 'BUY';
    }
    if (analysis.trueIntent === 'SELLERS_DOMINANT' && analysis.convictionScore > 70 && analysis.volumeOscillator < -10) {
      return 'SELL';
    }

    return 'HOLD';
  }

  /**
   * ADVANCED TECHNIQUE 1: Volume-by-Price Histogram (True Volume Profile)
   * Bins prices into levels and sums volume per bin
   * Rounds bin prices to nearest tick size to prevent floating point drift
   * Identifies Point of Control (POC), High Volume Nodes (HVN), Low Volume Nodes (LVN)
   */
  private calculateVolumeProfile(prices: number[], volumes: number[], bins: number = 30): VolumeProfile {
    if (prices.length === 0 || volumes.length === 0) {
      return {
        poc: 0,
        hvn: [],
        lvn: [],
        totalVolume: 0,
        bins: new Map(),
      };
    }

    // Find price range
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;
    const binSize = priceRange / bins;

    // Bin volumes by price level with tick size rounding
    const binMap = new Map<number, number>();
    let totalVolume = 0;

    for (let i = 0; i < prices.length; i++) {
      const binIndex = Math.floor((prices[i] - minPrice) / binSize);
      let binPrice = minPrice + binIndex * binSize + binSize / 2;
      
      // Round to nearest tick size to prevent floating point drift
      binPrice = Math.round(binPrice / this.tickSize) * this.tickSize;
      
      binMap.set(binPrice, (binMap.get(binPrice) || 0) + volumes[i]);
      totalVolume += volumes[i];
    }

    // Find Point of Control (highest volume bin)
    let poc = minPrice;
    let pocVolume = 0;
    binMap.forEach((vol, price) => {
      if (vol > pocVolume) {
        pocVolume = vol;
        poc = price;
      }
    });

    // Sort bins by volume
    const sortedBins = Array.from(binMap.entries())
      .sort((a, b) => b[1] - a[1]);

    // Calculate HVN (top 70% of volume) and LVN (bottom 30%)
    const hvnThreshold = totalVolume * 0.7;
    const lvnThreshold = totalVolume * 0.3;

    let hvnVolume = 0;
    let lvnVolume = 0;
    const hvnPrices: number[] = [];
    const lvnPrices: number[] = [];

    for (const [price, vol] of sortedBins) {
      if (hvnVolume < hvnThreshold) {
        hvnPrices.push(price);
        hvnVolume += vol;
      } else if (lvnVolume < lvnThreshold) {
        lvnPrices.push(price);
        lvnVolume += vol;
      }
    }

    return {
      poc,
      hvn: hvnPrices,
      lvn: lvnPrices,
      totalVolume,
      bins: binMap,
    };
  }

  /**
   * ADVANCED TECHNIQUE 2: VSA - No Demand
   * Up bar closing lower half + low volume → "No Demand" (bearish)
   * Reveals institutional weakness, potential reversal down
   */
  private detectNoDemand(state: VolumeAnalysisInput): boolean {
    const closeRatio = (state.close - state.low) / (state.high - state.low);
    const volumeRatio = state.volume / state.avgVolume20;

    // Up bar (close > open) closing in lower half + low volume = no demand
    const isUpBar = state.close > state.open;
    const closesLowerHalf = closeRatio < 0.5;
    const lowVolume = volumeRatio < 0.8;

    return isUpBar && closesLowerHalf && lowVolume;
  }

  /**
   * ADVANCED TECHNIQUE 3: VSA - No Supply
   * Down bar closing upper half + low volume → "No Supply" (bullish)
   * Reveals institutional strength, buyers overpower sellers
   */
  private detectNoSupply(state: VolumeAnalysisInput): boolean {
    const closeRatio = (state.close - state.low) / (state.high - state.low);
    const volumeRatio = state.volume / state.avgVolume20;

    // Down bar (close < open) closing in upper half + low volume = no supply
    const isDownBar = state.close < state.open;
    const closesUpperHalf = closeRatio > 0.5;
    const lowVolume = volumeRatio < 0.8;

    return isDownBar && closesUpperHalf && lowVolume;
  }

  /**
   * ADVANCED TECHNIQUE 4: Stopping Volume (Bullish & Bearish)
   * Bullish: Very high volume halting a decline → reversal (institutional buying)
   * Bearish: Very high volume halting a rally → reversal (institutional selling)
   * Marks turning points with institutional footprints
   */
  private detectStoppingVolume(state: VolumeAnalysisInput): boolean {
    const volumeRatio = state.volume / state.avgVolume20;
    const isExtreme = volumeRatio > 2.0; // 2x+ average

    if (!isExtreme) return false;

    // Check if price moved significantly before this candle
    let priorDecline = false;
    let priorRally = false;
    if (state.priceHistory && state.priceHistory.length > 1) {
      const prevPrice = state.priceHistory[state.priceHistory.length - 1];
      priorDecline = prevPrice > state.close;  // Price was going down
      priorRally = prevPrice < state.close;    // Price was going up
    }

    // Bullish stopping volume: Down move halted, closes in upper half
    const closeInUpperHalf = (state.close - state.low) / (state.high - state.low) > 0.5;
    const bullishStopping = priorDecline && closeInUpperHalf;

    // Bearish stopping volume: Up move halted, closes in lower half
    const closeInLowerHalf = (state.close - state.low) / (state.high - state.low) < 0.5;
    const bearishStopping = priorRally && closeInLowerHalf;

    return bullishStopping || bearishStopping;
  }

  /**
   * ADVANCED TECHNIQUE 5: Test of Level
   * Price retests breakout level on low volume → confirmation of strength
   * If price can return to breakout level without much selling, breakout is valid
   */
  private detectTestOfLevel(state: VolumeAnalysisInput): boolean {
    // Look for recent high/low level in history
    if (!state.priceHistory || state.priceHistory.length < 10) {
      return false;
    }

    // Find recent significant level (recent high or low)
    const recentPrices = state.priceHistory.slice(-10);
    const recentMax = Math.max(...recentPrices);
    const recentMin = Math.min(...recentPrices);

    const volumeRatio = state.volume / state.avgVolume20;

    // Test: Price retests level, stays there, low volume (no selling)
    const priceNearLevel =
      Math.abs(state.close - recentMax) < Math.abs(recentMax - recentMin) * 0.02 ||
      Math.abs(state.close - recentMin) < Math.abs(recentMax - recentMin) * 0.02;

    const lowVolume = volumeRatio < 0.9;

    return priceNearLevel && lowVolume;
  }

  /**
   * ADVANCED TECHNIQUE 6: Volume Oscillator with EMA Smoothing
   * (Current volume - 20-period average) / average → smoothed via EMA
   * Positive = buying pressure, Negative = selling pressure
   * Normalized to -100 to +100 scale, then smoothed for less noise
   */
  private calculateVolumeOscillator(state: VolumeAnalysisInput): number {
    const volumeRatio = state.volume / state.avgVolume20;
    
    // Convert to oscillator (-100 to +100 scale)
    // ratio of 1.0 = 0, ratio of 2.0 = +50, ratio of 0.5 = -33
    const rawOscillator = ((volumeRatio - 1) / (volumeRatio + 1)) * 100;
    const clampedOscillator = Math.max(-100, Math.min(100, rawOscillator));

    // Apply EMA smoothing (alpha = 0.33 for 3-period EMA)
    // Reduces noise while preserving responsiveness
    this.volumeOscillatorHistory.push(clampedOscillator);
    
    // Keep only last 10 values for memory efficiency
    if (this.volumeOscillatorHistory.length > 10) {
      this.volumeOscillatorHistory.shift();
    }

    // Calculate EMA of oscillator
    if (this.volumeOscillatorHistory.length === 1) {
      return clampedOscillator; // First value, no smoothing yet
    }

    const alpha = 0.33; // 3-period EMA smoothing constant
    let ema = this.volumeOscillatorHistory[0];
    for (let i = 1; i < this.volumeOscillatorHistory.length; i++) {
      ema = alpha * this.volumeOscillatorHistory[i] + (1 - alpha) * ema;
    }

    return ema;
  }

  /**
   * Calculate volume profile if not provided
   * Generates POC, HVN, LVN from recent price/volume history
   */
  private ensureVolumeProfile(state: VolumeAnalysisInput): VolumeProfile {
    if (state.volumeProfile) {
      // Convert from input format to VolumeProfile format
      return {
        poc: state.volumeProfile.poc,
        hvn: state.volumeProfile.hvn,
        lvn: state.volumeProfile.lvn,
        totalVolume: state.volumeProfile.totalProfileVolume,
        bins: new Map(),
      };
    }

    // Calculate from history if available
    if (state.priceHistory && state.volumeHistory) {
      return this.calculateVolumeProfile(state.priceHistory, state.volumeHistory, 30);
    }

    // Fallback: current level
    return {
      poc: state.close,
      hvn: [state.high],
      lvn: [state.low],
      totalVolume: state.volume,
      bins: new Map(),
    };
  }

  /**
   * Calculate confidence based on analysis strength
   * Includes pattern win rate learning and VSA signal confidence
   */
  private calculateConfidence(analysis: VolumeAnalysisResult): number {
    let confidence = this.baseConfidence;

    // Add conviction component (effort vs result)
    confidence += (analysis.convictionScore / 100) * 0.15;

    // Climax is very high confidence (historical win rate)
    if (analysis.climaxDetected !== 'NONE') {
      const climaxWinRate = this.getPatternWinRate('CLIMAX');
      confidence += 0.15 * climaxWinRate;
    }

    // Stopping volume is institutional support (very high confidence)
    if (analysis.stoppingVolumeDetected) {
      const stoppingWinRate = this.getPatternWinRate('STOPPING_VOLUME');
      confidence += 0.15 * stoppingWinRate;
    }

    // VSA patterns: No supply/demand (high confidence, classic patterns)
    if (analysis.noSupplyDetected) {
      const noSupplyWinRate = this.getPatternWinRate('NO_SUPPLY');
      confidence += 0.12 * noSupplyWinRate;
    }
    if (analysis.noDemandDetected) {
      const noDemandWinRate = this.getPatternWinRate('NO_DEMAND');
      confidence += 0.12 * noDemandWinRate;
    }

    // Test of level confirmation (strength verification)
    if (analysis.testOfLevelDetected) {
      const testWinRate = this.getPatternWinRate('TEST_OF_LEVEL');
      confidence += 0.08 * testWinRate;
    }

    // Volume oscillator strengthens conviction
    if (Math.abs(analysis.volumeOscillator) > 50) {
      confidence += 0.10;
    }

    // Fakeout should lower confidence in following trades
    if (analysis.breakoutValidity === 'FAKEOUT') {
      confidence -= 0.20;
    }

    // Smart money signals are moderate confidence boosters
    if (analysis.smartMoneySignal !== 'NEUTRAL') {
      const smartMoneyWinRate = this.getPatternWinRate('SMART_MONEY');
      confidence += 0.10 * smartMoneyWinRate;
    }

    // Personality adjustment: Conservative gets lower base, Aggressive gets lower but wider range
    if (this.personality === 'conservative') {
      confidence = Math.min(Math.max(confidence, 0.50), 0.95);
    } else if (this.personality === 'aggressive') {
      confidence = Math.min(Math.max(confidence, 0.35), 0.90);
    } else {
      confidence = Math.min(Math.max(confidence, 0.35), 0.95);
    }

    return confidence;
  }

  /**
   * Calculate stop loss based on volume structure
   */
  private calculateStop(state: VolumeAnalysisInput, analysis: VolumeAnalysisResult): number {
    const rangeSize = state.high - state.low;

    // For buys: stop below low or below nearest HVN support
    if (analysis.valueZones.lvnLevels.length > 0) {
      return Math.min(...analysis.valueZones.lvnLevels) - rangeSize * 0.1;
    }

    return state.low - rangeSize * 0.2;
  }

  /**
   * Calculate target based on volume profile
   */
  private calculateTarget(state: VolumeAnalysisInput, analysis: VolumeAnalysisResult): number {
    const rangeSize = state.high - state.low;

    // For buys: target next HVN resistance
    if (analysis.valueZones.hvnLevels.length > 0) {
      return Math.max(...analysis.valueZones.hvnLevels) + rangeSize * 0.1;
    }

    return state.high + rangeSize * 0.5;
  }

  /**
   * Priority for consensus voting (1-10, higher = higher priority)
   * Accounts for pattern win rates and regime state
   */
  private getPriority(analysis: VolumeAnalysisResult): number {
    // Climax detections are top priority
    if (analysis.climaxDetected !== 'NONE') {
      const winRate = this.getPatternWinRate('CLIMAX');
      return winRate > 0.6 ? 10 : 8; // Scale down if poor historical performance
    }

    // Stopping volume (institutional) is very high priority
    if (analysis.stoppingVolumeDetected) {
      const winRate = this.getPatternWinRate('STOPPING_VOLUME');
      return winRate > 0.6 ? 9 : 7;
    }

    // VSA patterns (no supply/demand) high priority
    if (analysis.noSupplyDetected || analysis.noDemandDetected) {
      const signalType = analysis.noSupplyDetected ? 'NO_SUPPLY' : 'NO_DEMAND';
      const winRate = this.getPatternWinRate(signalType);
      return winRate > 0.6 ? 8 : 6;
    }

    // Validated breakouts are high priority (adjusted by skill + regime)
    if (analysis.breakoutValidity === 'VALID') {
      let priority = 7;
      // Trending regime boosts breakout priority
      if (this.regimeMode === 'trending') priority += 1;
      return priority;
    }

    // Test of level confirmation
    if (analysis.testOfLevelDetected) {
      const winRate = this.getPatternWinRate('TEST_OF_LEVEL');
      return winRate > 0.6 ? 7 : 5;
    }

    // Smart money signals
    if (analysis.smartMoneySignal !== 'NEUTRAL') {
      const winRate = this.getPatternWinRate('SMART_MONEY');
      return winRate > 0.6 ? 6 : 4;
    }

    // High conviction moves
    if (analysis.convictionScore > 75) {
      return 5;
    }

    return 4; // Default priority
  }

  /**
   * Get last analysis (for debugging/display)
   */
  getLastAnalysis(): VolumeAnalysisResult | null {
    return this.lastAnalysis;
  }

  /**
   * Utility: Format analysis for readable output (includes debug zones)
   */
  formatAnalysis(): string {
    if (!this.lastAnalysis) return 'No analysis available';

    const analysis = this.lastAnalysis;
    const vsa = [
      analysis.noSupplyDetected ? '✓ No Supply' : '',
      analysis.noDemandDetected ? '✓ No Demand' : '',
      analysis.stoppingVolumeDetected ? '✓ Stopping Volume' : '',
      analysis.testOfLevelDetected ? '✓ Test of Level' : '',
    ].filter(x => x).join(' | ');

    const pocStr = analysis.valueZones.poc.toFixed(2);
    const hvnStr = analysis.valueZones.hvnLevels.map((x: number) => x.toFixed(2)).join(', ');
    const lvnStr = analysis.valueZones.lvnLevels.map((x: number) => x.toFixed(2)).join(', ');

    return `
Volume Analysis:
  Event: ${analysis.significantEvent}
  Conviction: ${analysis.convictionScore.toFixed(0)}/100
  Volume Oscillator: ${analysis.volumeOscillator.toFixed(1)}
  Smart Money: ${analysis.smartMoneySignal}
  Breakout: ${analysis.breakoutValidity}
  Climax: ${analysis.climaxDetected}
  Intent: ${analysis.trueIntent}
  VSA Signals: ${vsa || 'None'}
  Patterns: ${analysis.detectedPatterns.join(', ')}
  
  Value Zones (Volume Profile):
    POC: ${pocStr}
    HVN Levels: ${hvnStr || 'None'}
    LVN Levels: ${lvnStr || 'None'}
    Control: ${analysis.valueZones.controlLevel}
  
  Thresholds (Personality: ${this.personality}, Regime: ${this.regimeMode}):
    Min Conviction: ${this.minConvictionThreshold}
    Volume Threshold: ${this.volumeThreshold.toFixed(2)}x
  
  Pattern Win Rates:
    ${Array.from(this.patternWinRates.entries())
      .map(([type, stats]) => `${type}: ${stats.wins}/${stats.total} (${(stats.wins/stats.total*100).toFixed(0)}%)`)
      .join('\n    ') || 'None tracked yet'}
  
  Reasoning: ${analysis.reasoning.join('; ')}
    `.trim();
  }
}

export default VolumeMechanicalVerifierAgent;
