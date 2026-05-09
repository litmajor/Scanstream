import { TradingAgent, AgentPersonality, AgentSignal } from './TradingAgent.ts';
import type { MarketTick, PhysicsMetrics } from '../vfmd/types.ts';
import { EarlyEntryDetector } from '../vfmd/earlyEntryDetector.ts';
import { PhysicsCalculator } from '../vfmd/physicsCalculator.ts';
import { FieldConstructor } from '../vfmd/fieldConstructor.ts';
import { RegimeClassifier, FlowRegime, type RegimeConfig } from '../vfmd/regimeClassifier.ts';
import { TriggerCalculator } from '../vfmd/triggerCalculator.ts';
import { ProfitEstimator } from '../vfmd/profitEstimator.ts';
import { PressureFragilityEngine } from '../vfmd/pressureFragilityEngine.ts';
import { VFMDDirectionPatch, type HTFBar } from '../vfmd/VFMDDirectionPatch.ts';
import { VFMDEntryGate, type EntryGateResult, DEFAULT_GATE_CONFIG } from '../vfmd/VFMDEntryGate.ts';
import { PEGSlopeTracker, DEFAULT_PEG_CONFIG } from '../vfmd/PEGSlopeTracker.ts';
import { ClusteringCalculator } from '../clustering/ClusteringCalculator.ts';
import { UnifiedRegimeDetector, UnifiedRegimeType, RegimeDetectionResult } from '../unified-regime-system.ts';
import { RegimeConsolidationBridge } from '../regime-consolidation-bridge.ts';

/**
 * VFMDPhysicsAgent
 * 
 * Specialized in early entry detection using the full ported VFMD system
 * - Analyzes vector fields from price/volume data
 * - Identifies accumulation/distribution zones
 * - Detects directional coherence and energy gradients
 * - Provides interpretable early entry signals
 * 
 * HYBRID ARCHITECTURE (Entry + Exit Strategy):
 * ============================================
 * 
 * ENTRY LOGIC (Agent-Controlled via Physics)
 * Why agent works well for entries:
 * - Entries detect pressure release (clear signal)
 * - Uses PEG spike, coherence alignment, divergence confirmation
 * - Measurable and consistent across market conditions
 * 
 * Implementation: generateSignal() → 5-layer gating:
 *   Layer 1: Regime classification (CONSOLIDATION, TURBULENT_CHOP, etc.)
 *   Layer 2: Energy gate (PEG > threshold)
 *   Layer 3: Permission gate (TRIGGER > threshold)
 *   Layer 4: Direction bias (bullish/bearish from gradient)
 *   Layer 5: Profit potential (expected move + risk/reward)
 * 
 * EXIT LOGIC (Hardcoded Regime Rules + Energy Decay)
 * Why agent exit logic failed:
 * - Agent tried to predict optimal exit timing via static target/stop
 * - Exit prediction requires forecasting entire future price path
 * - Mathematically: max(P(win)×W - P(loss)×L) requires accurate probability estimates
 * - Agent can't accurately forecast price continuation probabilities
 * 
 * What works instead (from backtesting):
 * - Hardcoded regime-based stops (per regime performance history)
 * - Energy decay tracking (PEG trend analysis) for dynamic adjustments
 * 
 * Energy Decay Approach:
 *   PEG rising → momentum building → hold, move stop to breakeven
 *   PEG plateau → momentum stable but plateauing → tighten stops
 *   PEG falling → momentum dissipating → exit (energy is gone)
 * 
 * Why this works:
 * - Doesn't require price forecasting, just measures energy state
 * - Aligns with physics framework (PEG = potential energy gradient)
 * - Objective and measurable (no probabilistic estimates)
 * - Similar to: don't predict when ball lands, just measure if it's going up/down
 * 
 * Abilities unlock as agent levels up:
 * - Level 1: Basic field analysis
 * - Level 5: Coherence detection
 * - Level 10: Multi-timeframe fusion
 * - Level 15: Pattern memory
 */
export class VFMDPhysicsAgent extends TradingAgent {
  private earlyEntryDetector: EarlyEntryDetector;
  private fieldConstructor: FieldConstructor;
  private pressureFragility: PressureFragilityEngine;
  private directionPatch: VFMDDirectionPatch = new VFMDDirectionPatch();
  private entryGate: VFMDEntryGate = new VFMDEntryGate();
  private pegTracker: PEGSlopeTracker = new PEGSlopeTracker();
  private currentRegime: FlowRegime = FlowRegime.CONSOLIDATION;
  private regimeConfidence: number = 0.5;
  
  // Unified regime detection (Phase 3 wiring)
  private unifiedRegime: UnifiedRegimeType = 'RANGING';
  private unifiedRegimeResult: RegimeDetectionResult | null = null;
  
  private previousMetrics: PhysicsMetrics | null = null;
  
  // PEG history for derivative-based signal quality tiering
  private pegHistory: number[] = [];
  private readonly PEG_HISTORY_WINDOW = 20; // Rolling window for derivatives
  
  // Volume history for vacuum score computation
  private volumeHistory: number[] = [];
  
  // Compression tracking for volatility-based entry filtering
  private compressionHistory: number[] = [];
  private readonly COMPRESSION_TIGHT_THRESHOLD = 0.6; // Only trade when compressed

  // Regime-specific thresholds (optimized per market regime)
  // ✅ PRIORITY 2: Loosened thresholds (LAMINAR 0.25→0.22, BREAKOUT 0.30→0.27)
  private regimeThresholds = {
    // Mar 2026: Spatial gradient sigmoid PEG ranges [0.0007, 0.6385] (200 sample mean: 0.3173)
    // Thresholds calibrated for continuous compression values, not discrete tiers
    [FlowRegime.LAMINAR_TREND]: { peg: 0.22, trigger: 0.20 },        // Loosened: 0.25→0.22 for more entries
    [FlowRegime.BREAKOUT_TRANSITION]: { peg: 0.27, trigger: 0.25 },  // Loosened: 0.30→0.27 for better breakout capture
    [FlowRegime.ACCUMULATION]: { peg: 0.20, trigger: 0.40 },         // Lower compression needed
    [FlowRegime.DISTRIBUTION]: { peg: 0.20, trigger: 0.40 },         // Lower compression needed
    [FlowRegime.CONSOLIDATION]: { peg: 0.15, trigger: 0.20 },        // Tight compression for consolidation
    [FlowRegime.TURBULENT_CHOP]: { peg: 0.22, trigger: 0.20 },       // Moderate compression for chop
  };

  // Asset-specific regime thresholds removed (Mar 2026)
  // After FieldConstructor normalization, BTC and ETH have identical PEG distributions
  // No longer using per-asset overrides — global regimeThresholds work universally

  // Asset-specific profit score thresholds (FIX #7: raise ETH threshold now that regime is fixed)
  private profitScoreThresholds = {
    'BTC': 50,      // Bitcoin: relaxed to match ETH (65 was too strict, 0 trades)
    'ETH': 50,      // Ethereum: raised from 30 (was VeryAggressive, blind classifier) to 50 (match regime fix)
    'default': 60   // Other assets
  };

  private currentAsset: string = 'BTC'; // Track current asset being analyzed

  /**
   * Static metrics tracker for analyzing normalized PEG/TI distribution
   * Accumulates during backtest to understand post-normalization metric ranges
   * O(1) per metric: tracks sum instead of storing all values (was O(n²) recalculation)
   */
  private static metricsLog: Record<string, {
    count: number;
    regime_distribution: Record<string, number>;
    peg: { min: number; max: number; mean: number; sum?: number };
    ti: { min: number; max: number; mean: number; sum?: number };
    coherence: { min: number; max: number; mean: number; sum?: number };
    divergence: { min: number; max: number; mean: number; sum?: number };
  }> = {};

  /**
   * Add metrics to the tracking log. Called during each analysis.
   */
  private static logMetrics(asset: string, metrics: PhysicsMetrics, regime: FlowRegime): void {
    if (!VFMDPhysicsAgent.metricsLog[asset]) {
      VFMDPhysicsAgent.metricsLog[asset] = {
        count: 0,
        regime_distribution: {},
        peg: { min: Infinity, max: -Infinity, mean: 0, sum: 0 },
        ti: { min: Infinity, max: -Infinity, mean: 0, sum: 0 },
        coherence: { min: Infinity, max: -Infinity, mean: 0, sum: 0 },
        divergence: { min: Infinity, max: -Infinity, mean: 0, sum: 0 }
      };
    }

    const log = VFMDPhysicsAgent.metricsLog[asset];
    log.count++;

    // Regime distribution
    log.regime_distribution[regime] = (log.regime_distribution[regime] || 0) + 1;

    // Track PEG (O(n) mean calculation via running sum)
    log.peg.min = Math.min(log.peg.min, metrics.peg);
    log.peg.max = Math.max(log.peg.max, metrics.peg);
    const pegSum = (log.peg.sum ?? 0) + metrics.peg;
    (log.peg as any).sum = pegSum;
    log.peg.mean = pegSum / log.count;

    // Track TI
    log.ti.min = Math.min(log.ti.min, metrics.turbulenceIndex);
    log.ti.max = Math.max(log.ti.max, metrics.turbulenceIndex);
    const tiSum = (log.ti.sum ?? 0) + metrics.turbulenceIndex;
    (log.ti as any).sum = tiSum;
    log.ti.mean = tiSum / log.count;

    // Track Coherence
    log.coherence.min = Math.min(log.coherence.min, metrics.coherenceScore);
    log.coherence.max = Math.max(log.coherence.max, metrics.coherenceScore);
    const coherenceSum = (log.coherence.sum ?? 0) + metrics.coherenceScore;
    (log.coherence as any).sum = coherenceSum;
    log.coherence.mean = coherenceSum / log.count;

    // Track Divergence
    log.divergence.min = Math.min(log.divergence.min, metrics.divergenceScore);
    log.divergence.max = Math.max(log.divergence.max, metrics.divergenceScore);
    const divergenceSum = (log.divergence.sum ?? 0) + metrics.divergenceScore;
    (log.divergence as any).sum = divergenceSum;
    log.divergence.mean = divergenceSum / log.count;
  }

  /**
   * Dump metrics analysis to console - call this after backtest completes
   * Shows normalized PEG distribution and current active thresholds (Mar 2026)
   */
  static dumpMetricsAnalysis(): void {
    console.log('\n========== NORMALIZED METRICS ANALYSIS (Post-FieldConstructor Fix) ==========\n');
    
    for (const [asset, data] of Object.entries(VFMDPhysicsAgent.metricsLog)) {
      console.log(`Asset: ${asset} (${data.count} candles analyzed)`);
      console.log(` Regime Distribution:`, data.regime_distribution);
      console.log(` PEG: min=${data.peg.min.toFixed(4)}, max=${data.peg.max.toFixed(4)}, mean=${data.peg.mean.toFixed(4)}`);
      console.log(` TI: min=${data.ti.min.toFixed(4)}, max=${data.ti.max.toFixed(4)}, mean=${data.ti.mean.toFixed(4)}`);
      console.log(` Coherence: min=${data.coherence.min.toFixed(4)}, max=${data.coherence.max.toFixed(4)}, mean=${data.coherence.mean.toFixed(4)}`);
      console.log(` Divergence: min=${data.divergence.min.toFixed(4)}, max=${data.divergence.max.toFixed(4)}, mean=${data.divergence.mean.toFixed(4)}`);
      console.log('');
    }
    console.log('========== ACTIVE THRESHOLD CONFIGURATION (Mar 2026 – Updated) ==========\n');
    console.log('Current VFMDPhysicsAgent regime-specific thresholds (normalized sigmoid):');
    console.log(' - LAMINAR_TREND: PEG > 0.22, TRIGGER > 0.20');
    console.log(' - BREAKOUT_TRANSITION: PEG > 0.27, TRIGGER > 0.25');
    console.log(' - ACCUMULATION: PEG > 0.20, TRIGGER > 0.40');
    console.log(' - DISTRIBUTION: PEG > 0.20, TRIGGER > 0.40');
    console.log(' - CONSOLIDATION: PEG > 0.15, TRIGGER > 0.20');
    console.log(' - TURBULENT_CHOP: PEG > 0.22, TRIGGER > 0.20');
    console.log('');
    console.log('Asset-specific profit score thresholds:');
    console.log(' - BTC: 50 (base), 75 if DISTRIBUTION regime');
    console.log(' - ETH: 50');
    console.log(' - Default: 60');
    console.log('');
    console.log('Note: Thresholds loosened for more laminar/breakout entries. Energy Decay now active.');
  }

  constructor(name: string, personality: AgentPersonality = 'balanced') {
    super(name, 'PHYSICS_VFMD', personality);
    
    // VFMD-specific abilities
    this.abilities.push('vfmd_analysis');
    this.abilities.push('early_entry_detection');
    this.abilities.push('field_coherence_analysis');
    this.abilities.push('regime_classification');

    // Initialize detectors
    this.earlyEntryDetector = new EarlyEntryDetector(50, 100);
    this.fieldConstructor = new FieldConstructor(50, 100);
    this.pressureFragility = new PressureFragilityEngine();

    // Sync thresholds with RegimeClassifier for consistency (keep them in sync across changes)
    (RegimeClassifier as any)['PEG_THRESHOLDS'] = this.regimeThresholds;
  }

  /**
   * Public access to metrics log for backtest analysis
   * Call after backtest completes to analyze signal distribution
   */
  static getMetricsLog() {
    return VFMDPhysicsAgent.metricsLog;
  }

  /**
   * Public access to metrics dump for backtest output
   * Prints normalized metric ranges and active threshold configuration
   */
  static printMetricsAnalysis(): void {
    VFMDPhysicsAgent.dumpMetricsAnalysis();
  }

  /**
   * Set the current asset being traded (for asset-specific thresholds)
   */
  setAsset(asset: 'BTC' | 'ETH' | string): void {
    this.currentAsset = asset;
  }

  // Removed: setRegimeParameters (asset-specific overrides no longer needed post-normalization)

  /**
   * Set custom profit score threshold for an asset
   */
  setProfitScoreThreshold(asset: string, threshold: number): void {
    (this.profitScoreThresholds as Record<string, number>)[asset] = threshold;
  }

  /**
   * Get the profit score threshold for current asset
   * Regime-aware: Adjusts threshold based on historical performance per regime
   * - TURBULENT_CHOP: Lower threshold (45) since turbulent trades historically outperform
   * - DISTRIBUTION: Higher threshold (75) for BTC to reduce false positives
   * - Others: Use configured asset-specific thresholds (BTC/ETH: 50, default: 60)
   */
  private getProfitScoreThreshold(): number {
    // Regime-specific overrides (empirically tuned)
    if (this.currentRegime === FlowRegime.TURBULENT_CHOP) {
      return 45;  // Turbulent trades hold longer, generate higher PnL - lower gate
    }
    if (this.currentAsset === 'BTC' && this.currentRegime === FlowRegime.DISTRIBUTION) {
      return 75;  // Distribution setups underperform for BTC - raise gate significantly
    }

    return (this.profitScoreThresholds as Record<string, number>)[this.currentAsset] ?? 
           this.profitScoreThresholds.default;
  }

  /**
   * Get regime-specific thresholds (unified across all assets post-normalization)
   */
  private getRegimeThreshold(regime: FlowRegime): { peg: number; trigger: number } {
    return this.regimeThresholds[regime];
  }

  /**
   * ENERGY DECAY TRACKING - Physics-aligned dynamic exit system
   * 
   * Why this works better than agent-predicted static targets:
   * - Agent exit logic requires forecasting entire future price path (impossible to predict accurately)
   * - Energy decay is directly measurable: just track if PEG (potential energy gradient) is rising/stable/falling
   * - PEG rising → momentum building → hold position, move stop to breakeven
   * - PEG plateau → momentum stable → tighten stops (entering risk-taking zone)
   * - PEG falling → momentum dissipating → exit (energy is gone)
   * 
   * This aligns with physics: we don't predict price, we measure energy state
   * Similar to how you wouldn't try to predict when a launched ball will land,
   * you'd just measure if it's still moving up or coming down.
   */
  private analyzeEnergyDecay(
    ticks: MarketTick[],
    lookbackLength: number = 10
  ): {
    pegTrend: 'rising' | 'plateau' | 'falling';
    pegWindowValues: number[];
    pegSlope: number;
    averagePeg: number;
    pegAcceleration: number;
    exitRecommendation: 'hold' | 'tighten_stops' | 'exit';
    adjustStopRecommendation: 'to_breakeven' | 'tighten_10pct' | 'normal';
  } {
    // Guard: FieldConstructor needs 100+ prices
    if (ticks.length < 100) {
      return {
        pegTrend: 'plateau',
        pegWindowValues: [],
        pegSlope: 0,
        averagePeg: 0,
        pegAcceleration: 0,
        exitRecommendation: 'hold',
        adjustStopRecommendation: 'normal'
      };
    }

    // Ensure we have data to analyze
    const minLookback = Math.min(lookbackLength, ticks.length - 10);
    if (minLookback < 3) {
      return {
        pegTrend: 'plateau',
        pegWindowValues: [],
        pegSlope: 0,
        averagePeg: 0,
        pegAcceleration: 0,
        exitRecommendation: 'hold',
        adjustStopRecommendation: 'normal'
      };
    }

    // Calculate recent PEG values using full historical window
    const pegValues: number[] = [];
    const recentTicks = ticks.slice(Math.max(0, ticks.length - minLookback));
    
    if (recentTicks.length >= 100) {
      // Compute PEG on full recent history
      const prices = recentTicks.map(t => t.close);
      const field = this.fieldConstructor.constructField(prices);
      const metrics = PhysicsCalculator.computeAllMetrics(field);
      pegValues.push(metrics.peg);
      
      // Also compute on previous window for trend detection
      const previousTicks = ticks.slice(Math.max(0, ticks.length - minLookback * 2), ticks.length - minLookback);
      if (previousTicks.length >= 100) {
        const prevPrices = previousTicks.map(t => t.close);
        const prevField = this.fieldConstructor.constructField(prevPrices);
        const prevMetrics = PhysicsCalculator.computeAllMetrics(prevField);
        pegValues.push(prevMetrics.peg);
      }
    }

    if (pegValues.length < 3) {
      return {
        pegTrend: 'plateau',
        pegWindowValues: pegValues,
        pegSlope: 0,
        averagePeg: pegValues.length > 0 ? pegValues.reduce((a, b) => a + b, 0) / pegValues.length : 0,
        pegAcceleration: 0,
        exitRecommendation: 'hold',
        adjustStopRecommendation: 'normal'
      };
    }

    // Calculate PEG slope (linear regression on recent window)
    const n = pegValues.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += pegValues[i];
      sumXY += i * pegValues[i];
      sumX2 += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgPeg = sumY / n;

    // Calculate PEG acceleration (second derivative)
    let acceleration = 0;
    if (pegValues.length >= 5) {
      const firstHalf = pegValues.slice(0, Math.floor(pegValues.length / 2));
      const secondHalf = pegValues.slice(Math.floor(pegValues.length / 2));
      const slopeFirst = (firstHalf[firstHalf.length - 1] - firstHalf[0]) / (firstHalf.length - 1);
      const slopeSecond = (secondHalf[secondHalf.length - 1] - secondHalf[0]) / (secondHalf.length - 1);
      acceleration = slopeSecond - slopeFirst;
    }

    // Classify trend based on slope and acceleration
    let pegTrend: 'rising' | 'plateau' | 'falling' = 'plateau';
    let exitRecommendation: 'hold' | 'tighten_stops' | 'exit' = 'hold';
    let adjustStopRecommendation: 'to_breakeven' | 'tighten_10pct' | 'normal' = 'normal';

    if (slope > 0.002 && acceleration > -0.0001) {
      // PEG rising strongly
      pegTrend = 'rising';
      exitRecommendation = 'hold';
      adjustStopRecommendation = 'to_breakeven';  // Protect gains while momentum builds
    } else if (slope < -0.002) {
      // PEG falling steadily
      pegTrend = 'falling';
      exitRecommendation = 'exit';
      adjustStopRecommendation = 'normal';  // Exit imminent
    } else {
      // PEG plateau or slight movement
      pegTrend = 'plateau';
      if (avgPeg > 0.3) {
        // High PEG plateau = entering profit-taking zone
        exitRecommendation = 'tighten_stops';
        adjustStopRecommendation = 'tighten_10pct';
      } else {
        exitRecommendation = 'hold';
        adjustStopRecommendation = 'normal';
      }
    }

    return {
      pegTrend,
      pegWindowValues: pegValues,
      pegSlope: slope,
      averagePeg: avgPeg,
      pegAcceleration: acceleration,
      exitRecommendation,
      adjustStopRecommendation
    };
  }

  /**
   * Calculate Average True Range (volatility measure)
   * Fixed: edge case when ticks.length < period + 1 (divide by correct number of TRs)
   */
  private calculateATR(ticks: MarketTick[], period: number = 14): number {
    if (ticks.length < 2) return 0;

    let tr_sum = 0;
    const numTR = Math.max(1, ticks.length - 1);  // Number of TR values we can calculate
    for (let i = Math.max(1, ticks.length - period); i < ticks.length; i++) {
      const curr = ticks[i];
      const prev = ticks[i - 1];
      const tr = Math.max(
        curr.high - curr.low,
        Math.abs(curr.high - prev.close),
        Math.abs(curr.low - prev.close)
      );
      tr_sum += tr;
    }

    const actualPeriod = Math.min(period, numTR);
    return actualPeriod > 0 ? tr_sum / actualPeriod : 0;
  }

  /**
   * Calculate price position in recent range (0-1, where 0=low, 1=high)
   */
  private calculatePricePosition(ticks: MarketTick[], lookback: number = 50): number {
    const recentTicks = ticks.slice(-lookback);
    const low = Math.min(...recentTicks.map(t => t.low));
    const high = Math.max(...recentTicks.map(t => t.high));
    const range = high - low;

    if (range === 0) return 0.5;

    const current = ticks[ticks.length - 1].close;
    return (current - low) / range;
  }

  /**
   * Convert 1h ticks to 4h bars for HTF trend analysis
   * Groups consecutive ticks into 4h OHLCV bars
   */
  private convertTicksTo4hBars(ticks: MarketTick[]): HTFBar[] {
    if (ticks.length === 0) return [];
    
    const bars: HTFBar[] = [];
    let currentBar: HTFBar | null = null;
    let barTickCount = 0;
    const TICKS_PER_4H_BAR = 4; // One bar per 4 ticks (assuming 1h each)

    for (const tick of ticks) {
      if (!currentBar) {
        // Start new bar
        currentBar = {
          open: tick.open,
          high: tick.high,
          low: tick.low,
          close: tick.close,
          volume: tick.volume,
          timestamp: tick.timestamp,
        };
        barTickCount = 1;
      } else {
        // Update current bar
        if (currentBar) {
          currentBar.high = Math.max(currentBar.high, tick.high);
          currentBar.low = Math.min(currentBar.low, tick.low);
          currentBar.close = tick.close;
          currentBar.volume = (currentBar.volume || 0) + tick.volume;
          barTickCount++;

          // Check if bar is complete
          if (barTickCount >= TICKS_PER_4H_BAR) {
            bars.push(currentBar);
            currentBar = null;
            barTickCount = 0;
          }
        }
      }
    }

    // Add incomplete bar if present
    if (currentBar !== null) {
      bars.push(currentBar);
    }

    return bars;
  }

  /**
   * ✅ NEW: Called when a trade position is closed/exited
   * Resets PEG tracker to prevent stale arming state carrying over to next setup
   * Call this in the backtest/live system after position closes
   */
  onTradeClosed(): void {
    this.entryGate.onTradeClosed();
  }

  /**
   * ✅ NEW: Called when a trade position is opened
   * Can be used for diagnostic logging or state initialization
   */
  onTradeOpened(direction: 'BUY' | 'SELL'): void {
    // Could track entry metrics for exit optimization
    console.log(`[${this.name}] Trade opened: ${direction}`);
  }

  /**
   * Apply skill multipliers to position sizing (Kelly Criterion adjustment)
   * - timing_precision: Affects entry timing confidence (5% per level)
   * - risk_management: Affects position sizing (10% per level)
   * - volatility prediction: Scales size by expected volatility expansion
   * - profit quality: Scales size down for marginal profit setups
   */
  private applySkillInfluenceToSizing(
    baseSize: number,
    baseFraction: number,
    volatilityExpansion: number = 1.0,
    profitQualityMultiplier: number = 1.0
  ): {
    adjustedSize: number;
    adjustedFraction: number;
    sizeBoost: number;
    volatilityBoost: number;
  } {
    const riskMultiplier = 1 + (this.skills.risk_management - 1) * 0.1;
    const adjustedFraction = baseFraction * riskMultiplier;
    const timingMultiplier = 1 + (this.skills.timing_precision - 1) * 0.05;
    const adjustedSize = baseSize * timingMultiplier;
    
    // Scale position by volatility expansion (1x-5x range)
    // Higher volatility = higher sizing (captures larger moves)
    const volatilityScaler = Math.min(2.0, volatilityExpansion * 0.5);
    const volatilityAdjustedSize = adjustedSize * volatilityScaler * profitQualityMultiplier;
    
    // Caps: relaxed for high-confidence setups
    const maxSize = profitQualityMultiplier > 0.95 ? 2.0 : 1.0;  // 5x increase (0.4→2.0) for high confidence, proportional for normal
    const maxFraction = profitQualityMultiplier > 0.95 ? 2.5 : 1.75;  // Proportional increase (0.5→2.5, 0.35→1.75)
    
    const clampedFraction = Math.min(maxFraction, adjustedFraction);
    const clampedSize = Math.min(maxSize, volatilityAdjustedSize);
    return {
      adjustedSize: clampedSize,
      adjustedFraction: clampedFraction,
      sizeBoost: (clampedSize / baseSize - 1) * 100,
      volatilityBoost: (volatilityScaler - 1) * 100
    };
  }

  /**
   * Apply skill multipliers to confidence score
   */
  private applySkillInfluenceToConfidence(baseConfidence: number): {
    adjustedConfidence: number;
    confidenceBoost: number;
    skillBreakdown: { pattern_recognition_boost: number; timing_precision_boost: number }
  } {
    const patternBoost = (this.skills.pattern_recognition - 1) * 0.05;
    const timingBoost = (this.skills.timing_precision - 1) * 0.03;
    const totalBoost = patternBoost + timingBoost;
    const adjustedConfidence = Math.min(1, baseConfidence * (1 + totalBoost));
    return {
      adjustedConfidence,
      confidenceBoost: totalBoost * 100,
      skillBreakdown: {
        pattern_recognition_boost: patternBoost * 100,
        timing_precision_boost: timingBoost * 100
      }
    };
  }

  /**
   * Expose volatility prediction from TRIGGER strength and ATR expansion
   * Fixed: division-by-zero protection for coherenceScore
   */
  private getVolatilityPrediction(metrics: PhysicsMetrics, triggerState: any, atr: number): {
    expected_volatility_pct: number;
    atr_expansion_multiplier: number;
    volatility_regime: 'low' | 'normal' | 'high' | 'extreme';
    confidence: number;
  } {
    const triggerIntensity = triggerState.trigger;
    const atrExpansion = 1 + triggerIntensity * 3;
    const expectedAtrExpansion = Math.min(atrExpansion, 5);
    const safeCoherence = Math.max(metrics.coherenceScore, 0.01);  // Prevent division by zero
    const expectedVolatilityPct = (atr / safeCoherence) * expectedAtrExpansion * 100;
    let regime: 'low' | 'normal' | 'high' | 'extreme';
    let confidence = 0.5;
    if (expectedAtrExpansion > 4) {
      regime = 'extreme';
      confidence = Math.min(triggerIntensity, 0.9);
    } else if (expectedAtrExpansion > 2.5) {
      regime = 'high';
      confidence = Math.min(triggerIntensity * 0.9, 0.85);
    } else if (expectedAtrExpansion > 1.5) {
      regime = 'normal';
      confidence = Math.min(triggerIntensity * 0.8, 0.8);
    } else {
      regime = 'low';
      confidence = Math.min(triggerIntensity * 0.7, 0.6);
    }
    return {
      expected_volatility_pct: Math.max(0, expectedVolatilityPct),
      atr_expansion_multiplier: expectedAtrExpansion,
      volatility_regime: regime,
      confidence
    };
  }

  /**
   * Extract and format constraint diagnostics for signal reasoning
   */
  private getConstraintDiagnosticsString(triggerState: any): {
    summary: string;
    detailed: string[];
    dominant_failure_mode: string;
  } {
    const diagnostics = triggerState?.diagnostics || {};
    const failureMode = triggerState?.dominantFailureMode || triggerState?.constraint_status || 'unknown';
    const details: string[] = [];
    if (diagnostics.liquidityFailure) details.push(`💧 Liquidity crisis: ${diagnostics.liquidityFailure.toFixed(3)}`);
    if (diagnostics.structuralBreak) details.push(`📊 Structural break: ${diagnostics.structuralBreak.toFixed(3)}`);
    if (diagnostics.temporalUnlock) details.push(`⏰ Temporal unlock: Session change detected`);
    if (diagnostics.fatigueExhaustion) details.push(`😩 Containment fatigue: ${diagnostics.fatigueExhaustion.toFixed(3)}`);
    const summary = `${failureMode.replace(/_/g, ' ').toUpperCase()}: ${details.length} constraints failing`;
    return { summary, detailed: details, dominant_failure_mode: failureMode };
  }

  /**
   * Get current market regime classification
   */
  getRegime(): FlowRegime {
    return this.currentRegime;
  }

  /**
   * Get regime-specific configuration
   */
  getRegimeConfig(): RegimeConfig {
    return RegimeClassifier.getRegimeConfig(this.currentRegime);
  }

  /**
   * Get human-readable regime explanation
   */
  explainRegime(metrics: any): string {
    // include asset so confidence in explanation is normalized correctly
    return RegimeClassifier.explainRegime(this.currentRegime, metrics, this.currentAsset);
  }

  /**
   * Analyze market data using full VFMD system + Five-Layer Physics
   * - Layer 1: STATE (Regime detection)
   * - Layer 2: ENERGY (PEG gradient)
   * - Layer 3: PERMISSION (TRIGGER constraint failure)
   * - Layer 4: DIRECTION (Bias estimation)
   * - Layer 5: PROFIT (Sizing & Risk/Reward)
   */
  analyzeVFMD(ticks: MarketTick[]) {
    if (!ticks || ticks.length < 100) {
      return null;
    }

    try {
      // Get underlying physics metrics
      const prices = ticks.map(t => t.close);
      const field = this.fieldConstructor.constructField(prices);
      const metrics = PhysicsCalculator.computeAllMetrics(field);

      // ✅ NEW: Cluster analysis for dynamic regime boost
      const clusterMetrics = ClusteringCalculator.calculateMetrics(
        ClusteringCalculator.convertFromCCXTFormat(
          ticks.map(t => [t.timestamp, t.open, t.high, t.low, t.close, t.volume])
        )
      );

      // LAYER 1: STATE - Classify market regime (now asset-aware)
      this.currentRegime = RegimeClassifier.classify(metrics, this.currentAsset);
      this.regimeConfidence = RegimeClassifier.getRegimeConfidence(metrics, this.currentAsset);

      // ✅ NEW: UNIFIED REGIME DETECTION (Phase 3 wiring)
      // Convert VFMD physics metrics to unified regime parameters
      // Note: PhysicsMetrics uses different field names (coherenceScore not coherence, etc.)
      const unifiedRegimeParams = {
        adx: 20 + (metrics.coherenceScore * 60), // Map coherence (0-1) to ADX range (20-80)
        volatility: Math.min(metrics.turbulenceIndex / 100 || 0.02, 1), // Normalize turbulence
        priceVsMA: (metrics.dominantAngle / 180 - 0.5) * 2, // Convert angle to -1..1
        rangeWidth: metrics.gradientMagnitude / 100 || 0.1, // Normalize gradient
        divergence: metrics.divergenceScore || 0, // Already -1 to +1
        coherence: metrics.coherenceScore || 0.5,
        momentum: metrics.recentDivergence || 0,
        rsi: 50 + (metrics.divergenceScore * 50) // Map divergence to RSI range
      };
      
      this.unifiedRegimeResult = UnifiedRegimeDetector.detectRegime(unifiedRegimeParams);
      this.unifiedRegime = this.unifiedRegimeResult.regime;

      // Log metrics for post-analysis (Feb 2025 FieldConstructor normalization)
      VFMDPhysicsAgent.logMetrics(this.currentAsset, metrics, this.currentRegime);

      // LAYER 2: ENERGY - Compute PEG (potential energy gradient)
      // Already in metrics.peg from PhysicsCalculator

      // LAYER 3: PERMISSION - Compute TRIGGER (constraint failure detection)
      const triggerState = TriggerCalculator.computeTrigger(metrics);

      // ✅ NEW: INTEGRATED ENTRY GATE (replaces separate direction + profit evaluation)
      // Combines PEG arming state, regime gating, HTF bias, and session filtering
      const htf4hBars = this.convertTicksTo4hBars(ticks);
      const currentTimestamp = ticks[ticks.length - 1].timestamp;
      
      const gateResult = this.entryGate.evaluate(
        metrics as any,  // Type-flexible, VFMDDirectionPatch handles field mapping
        htf4hBars,
        currentTimestamp,
        DEFAULT_GATE_CONFIG
      );

      // LAYER 4 & 5: DIRECTION & PROFIT - Use gate result + traditional profit estimation
      // direction_score from gate replaces sin(dominantAngle)
      const profitEstimate = ProfitEstimator.estimateProfit(
        metrics,
        this.previousMetrics,
        {
          currentPrice: ticks[ticks.length - 1].close,
          atrValue: this.calculateATR(ticks, 14),
          pricePosition: this.calculatePricePosition(ticks, 50),
          direction_score: gateResult.direction_score,
        }
      );

      // Use the specialized early entry detector for supplementary analysis
      const earlyEntry = this.earlyEntryDetector.analyzeForEntry(ticks);

      // Store for next iteration (direction calculation uses previous metrics)
      const prevMetrics = this.previousMetrics;
      this.previousMetrics = metrics;

      return {
        earlyEntry,
        metrics,
        triggerState,
        profitEstimate,
        regime: this.currentRegime,
        regimeConfidence: this.regimeConfidence,
        unifiedRegime: this.unifiedRegime,
        unifiedRegimeResult: this.unifiedRegimeResult,
        timestamp: Date.now(),
        dataPointsProcessed: ticks.length,
        entryGateResult: gateResult,  // ✅ NEW: Include gate result in analysis
        clusterMetrics,  // ✅ NEW: Cluster analysis for regime boost
      };
    } catch (err) {
      console.error(`[VFMDPhysicsAgent ${this.name}] Analysis failed:`, err);
      return null;
    }
  }

  /**
   * Generate RPG-compatible trading signal using all 5 physics layers
   * 
   * Decision flow:
   * 1. Check regime (STATE)
   * 2. Check PEG > threshold (ENERGY)
   * 3. Check TRIGGER > threshold (PERMISSION)
   * 4. Check profit_potential_score (DIRECTION + PROFIT)
   * 5. Return physics-based trade recommendation
   */
  generateSignal(ticks: MarketTick[]): AgentSignal {
    const analysis = this.analyzeVFMD(ticks);

    if (!analysis) {
      return {
        action: 'HOLD',
        confidence: 0,
        entry: ticks[ticks.length - 1]?.close || 0,
        target: 0,
        stop: 0,
        reason: 'Insufficient data for VFMD analysis',
        agent_name: this.name,
        agent_level: this.level
      } as AgentSignal;
    }

    //INTEGRATED ENTRY GATE - Early hard block for regime, session, HTF
    // This replaces the separated direction + regime gating with unified logic
    const gateResult = (analysis as any).entryGateResult;
    if (gateResult && gateResult.status === 'BLOCKED') {
      return {
        action: 'HOLD',
        confidence: 0,
        entry: ticks[ticks.length - 1].close,
        target: 0,
        stop: 0,
        reason: `🚫 Entry gate blocked: ${gateResult.block_reason}`,
        agent_name: this.name,
        agent_level: this.level
      } as AgentSignal;
    }

    const { metrics, triggerState, profitEstimate, regime } = analysis;
    const clusterMetrics = (analysis as any).clusterMetrics;  // ✅ NEW: Get cluster analysis
    
    const currentPrice = ticks[ticks.length - 1].close;
    const regimeThresholds = this.getRegimeThreshold(regime);
    const pegThreshold = regimeThresholds?.peg ?? 0.25;  // Default 0.25 for normalized sigmoid range
    const triggerThreshold = regimeThresholds?.trigger ?? 0.5;

    // ✅ NEW: Cluster-based quality multiplier (boosts confidence & sizing if trend forming)
    // trend_formation_signal = true when cluster_strength > 0.65 + directional_ratio > 0.65 + follow_through > 0.50
    // scale 0.3x (weak) to 1.2x (very_high strength)
    const clusterQualityMultiplier = clusterMetrics 
      ? (clusterMetrics.trend_formation_signal ? 1.15 : 1.0) * (0.8 + clusterMetrics.cluster_strength * 0.4)
      : 1.0;

    // LAYER 1: STATE - Handle turbulent markets with reduced sizing instead of hard block
    // Turbulent = high risk, but actually outperforms! Raise from 0.4 to 0.75 (FIX #2)
    // Turbulent trades hold longer and generate higher PnL per trade
    const turbulenceMultiplier = regime === FlowRegime.TURBULENT_CHOP ? 0.75 : 1.0;
    const isTurbulent = regime === FlowRegime.TURBULENT_CHOP;

    // LAYER 2: ENERGY - Tighter soft gating on PEG
    // Hard gate at 80% of threshold (was 70%), soft gate (reduced confidence) below threshold
    const pegHardThreshold = pegThreshold * 0.8;
    const pegSignal = metrics.peg > pegThreshold;
    const pegSoftPass = metrics.peg > pegHardThreshold;
    
    if (!pegSoftPass) {
      return {
        action: 'HOLD',
        confidence: 0,
        entry: currentPrice,
        target: 0,
        stop: 0,
        reason: `⚡ Energy insufficient (PEG: ${metrics.peg.toFixed(4)} < ${pegHardThreshold.toFixed(4)}). No pressure buildup detected.`,
        agent_name: this.name,
        agent_level: this.level
      } as AgentSignal;
    }
    
    // Soft penalty if PEG is below full threshold but above hard threshold
    const pegQualityMultiplier = pegSignal ? 1.0 : 0.5 + (metrics.peg / pegThreshold) * 0.5;  // Stricter penalty (was 0.7-1.0)

    // THREE-TIER SIGNAL QUALITY GATING (Physics-Derived)
    // Track PEG history for derivative-based quality assessment
    this.pegHistory.push(metrics.peg);
    if (this.pegHistory.length > this.PEG_HISTORY_WINDOW) {
      this.pegHistory.shift();
    }
    
    // Compute PEG derivatives: ΔPEG (jerk), Δ²PEG (snap), momentum
    const pegDerivatives = PhysicsCalculator.computePEGDerivatives(
      this.pegHistory,
      pegThreshold
    );
    
    // Apply tier-based position sizing multiplier
    // EXPLOSIVE: 1.3x (true breakout, all conditions aligned)
    // BUILDING: 1.1x (strong signal, momentum present)
    // BASE: 0.6x (current signal, but energy less convincing)
    const pegTierMultiplier = pegDerivatives.multiplier;
    const signalTier = pegDerivatives.tier;

    // LAYER 3: PERMISSION - Tighter soft gating on TRIGGER
    // Hard gate at 75% of threshold (was 60%), soft gate (reduced confidence) below threshold  
    const triggerHardThreshold = triggerThreshold * 0.75;
    const triggerSignal = triggerState.trigger > triggerThreshold;
    const triggerSoftPass = triggerState.trigger > triggerHardThreshold;
    
    if (!triggerSoftPass) {
      return {
        action: 'HOLD',
        confidence: 0,
        entry: currentPrice,
        target: 0,
        stop: 0,
        reason: `🔒 Permission denied (TRIGGER: ${triggerState.trigger.toFixed(3)} < ${triggerHardThreshold.toFixed(3)}). Constraints still intact.`,
        agent_name: this.name,
        agent_level: this.level
      } as AgentSignal;
    }
    
    // Soft penalty if TRIGGER is below full threshold but above hard threshold
    const triggerQualityMultiplier = triggerSignal ? 1.0 : 0.4 + (triggerState.trigger / triggerThreshold) * 0.6;  // Stricter (was 0.5-1.0)

    // LAYER 4 & 5: DIRECTION & PROFIT - High-quality entry filter
    // BTC: 65+ (strict), ETH: 55+ (relaxed for higher volatility)
    const profitScoreThreshold = this.getProfitScoreThreshold();
    const isProfitableSetup = profitEstimate.profit_potential_score >= profitScoreThreshold;
    if (!isProfitableSetup) {
      return {
        action: 'HOLD',
        confidence: 0,
        entry: currentPrice,
        target: 0,
        stop: 0,
        reason: `📊 Profit potential insufficient (Score: ${profitEstimate.profit_potential_score}/${profitScoreThreshold}). ${profitEstimate.profit_interpretation}`,
        agent_name: this.name,
        agent_level: this.level
      } as AgentSignal;
    }
    
    // Soft penalty for scores in 65-70 range, full confidence for 70+
    const profitQualityMultiplier = profitEstimate.profit_potential_score < 70 
      ? 0.75 + (profitEstimate.profit_potential_score - 65) * 0.05  // 0.75 to 1.0 scale
      : 1.0;

    // ✅ SOFT GATES PASSED - Generate trade signal with physics-based recommendation
    // Combine all quality multipliers from soft gates
    const gateQualityMultiplier = pegQualityMultiplier * triggerQualityMultiplier * turbulenceMultiplier;
    
    // LAYER 6: PRESSURE FRAGILITY GATING (Asset-Agnostic Z-Score Based)
    // NEW: Track volume history for fragility computation
    this.volumeHistory.push(ticks[ticks.length - 1].volume);
    if (this.volumeHistory.length > 168) {
      this.volumeHistory.shift();
    }
    
    // Compute ATR for range compression analysis
    const atr10 = this.calculateATR(ticks, 10);
    const atr100 = this.calculateATR(ticks, 100);
    const rangeCompression = atr10 / atr100;
    
    // Track compression history
    this.compressionHistory.push(rangeCompression);
    if (this.compressionHistory.length > 50) {
      this.compressionHistory.shift();
    }
    
    // Compute pressure fragility score with z-score normalization
    // ADVISORY ONLY: Fragility is tracked in metadata but does NOT block trades
    // This lets us observe fragility scores during backtest without gating
    const fragility = this.pressureFragility.compute(
      metrics.peg,
      this.pegHistory.slice(-5),
      ticks.map((t: MarketTick) => t.close).slice(-100),
      this.volumeHistory,
      metrics.coherenceScore,
      rangeCompression
    );
    
    const baseConfidence = (profitEstimate.profit_potential_score / 100) * gateQualityMultiplier * clusterQualityMultiplier;
    const skillInfluence = this.applySkillInfluenceToConfidence(baseConfidence);
    
    const volatilityPrediction = this.getVolatilityPrediction(metrics, triggerState, this.calculateATR(ticks, 14));
    
    // Apply sizing with volatility expansion, profit quality, fragility multiplier, AND three-tier PEG quality
    const sizeInfluence = this.applySkillInfluenceToSizing(
      profitEstimate.recommended_position_size * pegTierMultiplier * fragility.positionMultiplier * clusterQualityMultiplier,
      profitEstimate.kelly_fraction,
      volatilityPrediction.atr_expansion_multiplier,
      profitQualityMultiplier * gateQualityMultiplier * clusterQualityMultiplier
    );
    
    const constraintDiagnostics = this.getConstraintDiagnosticsString(triggerState);

    // ========= FILTERING ADDED: Empirical filters from trade analysis =========
    // Filter #1: Skip very low-confidence trades (empirically 44.7% WR vs 50% for high confidence)
    if (skillInfluence.adjustedConfidence < 0.5) {
      return {
        action: 'HOLD',
        confidence: skillInfluence.adjustedConfidence,
        entry: currentPrice,
        target: 0,
        stop: 0,
        reason: `🔴 FILTERED: Low confidence (${(skillInfluence.adjustedConfidence * 100).toFixed(1)}% < 50% threshold). Historical win rate 44.7% in this range.`,
        agent_name: this.name,
        agent_level: this.level
      } as AgentSignal;
    }

    // Filter #2: Turbulent_chop regime has 44.8% WR vs 50% in consolidation
    // Skip or reduce position sizing in turbulent conditions
    if (regime === FlowRegime.TURBULENT_CHOP && skillInfluence.adjustedConfidence < 0.55) {
      return {
        action: 'HOLD',
        confidence: skillInfluence.adjustedConfidence,
        entry: currentPrice,
        target: 0,
        stop: 0,
        reason: `🔴 FILTERED: Turbulent_chop regime with insufficient confidence (${(skillInfluence.adjustedConfidence * 100).toFixed(1)}% < 55% threshold). Historical win rate 44.8% in turbulent.`,
        agent_name: this.name,
        agent_level: this.level
      } as AgentSignal;
    }
    // =========================================================================

    // HYBRID EXIT STRATEGY:
    // Entry logic: Controlled by agent (Physics-based signal generation)
    // Exit logic: Controlled by hardcoded regime rules + energy decay tracking
    // 
    // Why this split works:
    // - Entries: Agent excels at detecting pressure release (PEG spike, coherence, divergence)
    // - Exits: Agent's static targets failed (requires forecasting future price path)
    // - Energy decay: Just measures if PEG is rising/stable/falling (no forecasting needed)
    const energyDecay = this.analyzeEnergyDecay(ticks, 10);

    // Trade specification from physics layers (with skill adjustments)
    // USE GATE RESULT: Direction from gateResult (HTF-based) instead of profitEstimate
    const entryPrice = currentPrice;
    let direction = gateResult && gateResult.allowed 
      ? (gateResult.direction === 'LONG' ? 'BUY' : 'SELL')
      : (profitEstimate.direction === 'bullish' ? 'BUY' : 'SELL');

    // ✅ TEMPORARY: Force occasional long bias for testing (remove after confirming works)
    if (Math.random() < 0.15 && direction === 'SELL') {
      direction = 'BUY';
    }
    
    // ✅ PRIORITY 1 COMPLETE: Enforce energy decay recommendation
    if (energyDecay.exitRecommendation === 'exit') {
      return {
        action: 'HOLD',  // or force close if you have position tracking in caller
        confidence: skillInfluence.adjustedConfidence,
        entry: 0,
        target: 0,
        stop: 0,
        reason: `⚡ ENERGY DECAY EXIT: PEG ${energyDecay.pegTrend} (slope ${energyDecay.pegSlope.toFixed(5)}) → momentum dissipated. Closing position.`,
        agent_name: this.name,
        agent_level: this.level
      } as AgentSignal;
    }

    if (energyDecay.exitRecommendation === 'tighten_stops') {
      // Dynamically tighten stop (example: move 50% closer to entry)
      const tightenFactor = 0.5;
      const adjustedStopDistance = profitEstimate.recommended_stop_distance_pct * 0.75 * tightenFactor;
      // Will apply below in stop price calculation
    }

    // CRITICAL: Flip target/stop geometry for SELL vs BUY
    // BUY:  entry → target ABOVE, stop BELOW
    // SELL: entry → target BELOW, stop ABOVE
    // ENHANCEMENT: 1:2 Risk/Reward Ratio
    // - Widen target by 1.5x to increase win magnitude
    // - Tighten stop by 0.75x to reduce loss magnitude
    // - Result: (wider distance) / (tighter distance) → 2:1 reward:risk
    const targetPrice = direction === 'BUY' 
      ? currentPrice * (1 + profitEstimate.recommended_take_profit_pct * 1.5)
      : currentPrice * (1 - profitEstimate.recommended_take_profit_pct * 1.5);
    
    let stopPrice = direction === 'BUY'
      ? currentPrice * (1 - profitEstimate.recommended_stop_distance_pct * 0.75)
      : currentPrice * (1 + profitEstimate.recommended_stop_distance_pct * 0.75);

    if (energyDecay.exitRecommendation === 'tighten_stops') {
      const tightenFactor = 0.5;
      const tightenedDistance = profitEstimate.recommended_stop_distance_pct * 0.75 * (1 - tightenFactor);
      stopPrice = direction === 'BUY'
        ? currentPrice * (1 - tightenedDistance)
        : currentPrice * (1 + tightenedDistance);
    }
    
    const positionSize = sizeInfluence.adjustedSize;
    
    // Add internal exit tracking (for external system to implement exit logic)
    // ✅ PRIORITY 1: Wire energy decay recommendation into exit conditions
    const exitConditions = {
      target_hit: targetPrice,
      stop_hit: stopPrice,
      // FIX: Backtest data shows turbulent trades held >3 candles generate $129 vs $53 for ≤3
      // Average good turbulent hold is 7.70 candles. Extend from 3 to 10 to capture this.
      max_duration_candles: isTurbulent ? 10 : 5,  // Longer hold better in turbulent (was wrong at 3)
      use_target_stop_exit: true,
      // ✅ NEW: Energy decay exit recommendation
      energy_decay_recommendation: energyDecay.exitRecommendation,  // 'hold' | 'tighten_stops' | 'exit'
      energy_decay_trend: energyDecay.pegTrend,                     // 'rising' | 'plateau' | 'falling'
      energy_decay_slope: energyDecay.pegSlope
    };

    // Build comprehensive reasoning with all enhancements
    const reasoning: string[] = [
      `🎯 ${regime.toUpperCase()} | Conf: ${(this.regimeConfidence * 100).toFixed(0)}%`,
      `⚡ Energy (PEG): ${metrics.peg.toFixed(4)} [Gate: ${pegSignal ? '✅' : '⚠️'}] (${(pegQualityMultiplier * 100).toFixed(0)}%)`,
      `   Threshold: ${pegThreshold.toFixed(4)} (Hard: ${pegHardThreshold.toFixed(4)})`,
      `   Mean PEG range: [0.0007, 0.6385] μ=0.3173`,
      `🔓 Permission (TRIGGER): ${triggerState.trigger.toFixed(3)} [Gate: ${triggerSignal ? '✅' : '⚠️'}] (${(triggerQualityMultiplier * 100).toFixed(0)}%) | ${constraintDiagnostics.summary}`,
      ...constraintDiagnostics.detailed,
      `${profitEstimate.direction === 'bullish' ? '📈' : '📉'} Direction: ${profitEstimate.direction.toUpperCase()} (${(profitEstimate.direction_confidence * 100).toFixed(0)}%)`,
      `💰 Expected move: ${(profitEstimate.expected_move_pct * 100).toFixed(2)}% | Volatility: ${volatilityPrediction.volatility_regime.toUpperCase()} (${volatilityPrediction.expected_volatility_pct.toFixed(2)}% expansion expected)`,
      `📊 Profit potential: ${profitEstimate.profit_potential_score}/100 (Quality: ${(profitQualityMultiplier * 100).toFixed(0)}%)`,
      `💎 Risk/Reward: ${profitEstimate.reward_to_risk.toFixed(2)}:1`,
      `� Clustering: Strength ${(clusterMetrics?.cluster_strength || 0).toFixed(2)}, Trend ${clusterMetrics?.trend_formation_signal ? '✅' : '❌'} (×${(clusterQualityMultiplier).toFixed(2)})`,
      `�📍 Position size: ${(positionSize * 100).toFixed(1)}% (Base: ${(profitEstimate.recommended_position_size * 100).toFixed(1)}% | Skill: ${sizeInfluence.sizeBoost.toFixed(1)}% | Vol: ${sizeInfluence.volatilityBoost.toFixed(1)}%)`,
      `🎓 Skill influence: Confidence ${skillInfluence.confidenceBoost.toFixed(1)}% boost (PR: ${skillInfluence.skillBreakdown.pattern_recognition_boost.toFixed(1)}% + TP: ${skillInfluence.skillBreakdown.timing_precision_boost.toFixed(1)}%)`,
      `🌊 Gate Quality: Overall ${(gateQualityMultiplier * 100).toFixed(0)}% | Turbulence ${(turbulenceMultiplier * 100).toFixed(0)}%`,
      `Coherence: ${(metrics.coherenceScore * 100).toFixed(1)}% | TI: ${metrics.turbulenceIndex.toFixed(2)} | ATR Exp: ${volatilityPrediction.atr_expansion_multiplier.toFixed(1)}x | Exit: ${exitConditions.use_target_stop_exit ? `Target/Stop (${exitConditions.max_duration_candles}h max)` : '5-candle max'}`,
      `⚡ Energy Decay: PEG ${energyDecay.pegTrend} (slope: ${energyDecay.pegSlope.toFixed(5)}) → ${energyDecay.exitRecommendation.toUpperCase()}`
    ];

    // ==================== FILTERING (v3: Aggressive for 1:2 RR + 2% sizing) ====================
    // With tighter stops (0.75x), we need higher conviction to maintain 50% WR
    // Filter #1: Raise confidence threshold from 0.50 to 0.55 (excludes more low-conviction trades)
    // Filter #2: Raise turbulent_chop threshold from 0.55 to 0.60 (extra caution in choppy markets)
    if (skillInfluence.adjustedConfidence < 0.55) {
      return {
        action: 'HOLD',
        confidence: skillInfluence.adjustedConfidence,
        entry: 0,
        target: 0,
        stop: 0,
        reason: `🔴 LOW CONFIDENCE FILTERED (${(skillInfluence.adjustedConfidence * 100).toFixed(0)}% < 55% threshold | RR1:2 needs higher conviction)`,
        agent_name: this.name,
        agent_level: this.level
      } as AgentSignal;
    }

    // Filter #2: Extra caution in turbulent_chop regime (raise bar to 0.60)
    if (regime === 'turbulent_chop' && skillInfluence.adjustedConfidence < 0.60) {
      return {
        action: 'HOLD',
        confidence: skillInfluence.adjustedConfidence,
        entry: 0,
        target: 0,
        stop: 0,
        reason: `🔴 TURBULENT CHOP + WEAK CONVICTION FILTERED (${(skillInfluence.adjustedConfidence * 100).toFixed(0)}% < 60% threshold)`,
        agent_name: this.name,
        agent_level: this.level
      } as AgentSignal;
    }
    // ====================================================================================

    return {
      action: direction,
      confidence: skillInfluence.adjustedConfidence,
      entry: entryPrice,
      target: targetPrice,
      stop: stopPrice,
      reason: reasoning.join(' | '),
      agent_name: this.name,
      agent_level: this.level,
      metadata: {
        profit_potential_score: profitEstimate.profit_potential_score,
        position_size_recommended: positionSize,
        position_size_base: profitEstimate.recommended_position_size,
        skill_sizing_boost_pct: sizeInfluence.sizeBoost,
        volatility_sizing_boost_pct: sizeInfluence.volatilityBoost,
        confidence_base: baseConfidence,
        confidence_adjusted: skillInfluence.adjustedConfidence,
        skill_confidence_boost_pct: skillInfluence.confidenceBoost,
        gate_quality_multiplier: gateQualityMultiplier,
        peg_quality: pegQualityMultiplier,
        peg_tier_signal: {
          tier: signalTier,
          multiplier: pegTierMultiplier,
          peg_current: metrics.peg,
          peg_threshold: pegThreshold,
          delta_peg: pegDerivatives.deltaPeg,
          delta2_peg: pegDerivatives.delta2Peg,
          peg_momentum: pegDerivatives.pegMomentum,
          is_building: pegDerivatives.isBuilding,
          is_explosive: pegDerivatives.isExplosive
        },
        trigger_quality: triggerQualityMultiplier,
        turbulence_adjustment: turbulenceMultiplier,
        profit_quality: profitQualityMultiplier,
        volatility_prediction: volatilityPrediction,
        exit_conditions: exitConditions,
        constraint_diagnostics: constraintDiagnostics,
        trigger_state: triggerState,
        profit_estimate: profitEstimate,
        regime: regime,
        skills_applied: {
          pattern_recognition: this.skills.pattern_recognition,
          timing_precision: this.skills.timing_precision,
          risk_management: this.skills.risk_management
        },
        //  NEW: Integrated entry gate result (direction patch + session filter)
        entry_gate_result: gateResult && gateResult.regime ? {
          status: gateResult.status,
          direction: gateResult.direction,
          direction_score: gateResult.direction_score,
          block_reason: gateResult.block_reason,
          regime: gateResult.regime?.regime || 'UNKNOWN',
          peg_phase: (gateResult.peg_state as any)?.phase,
          htf_bias: gateResult.htf_trend?.bias,
          htf_confidence: gateResult.htf_trend?.confidence,
          session_allowed: gateResult.session_filter?.allowed,
          session_reason: gateResult.session_filter?.reason
        } : null,
        // ✅ NEW: Energy decay tracking for dynamic exits
        energy_decay: {
          peg_trend: energyDecay.pegTrend,
          peg_slope: energyDecay.pegSlope,
          peg_avg: energyDecay.averagePeg,
          peg_acceleration: energyDecay.pegAcceleration,
          exit_recommendation: energyDecay.exitRecommendation,
          stop_adjustment_recommendation: energyDecay.adjustStopRecommendation,
          peg_window: energyDecay.pegWindowValues
        },
        // ✅ NEW: Clustering metrics for dynamic regime and position sizing
        clustering_metrics: clusterMetrics ? {
          trend_formation_signal: clusterMetrics.trend_formation_signal,
          cluster_strength: clusterMetrics.cluster_strength,
          directional_ratio: clusterMetrics.directional_ratio,
          follow_through: clusterMetrics.follow_through,
          total_clusters: clusterMetrics.total_clusters,
          bullish_clusters: clusterMetrics.bullish_clusters,
          bearish_clusters: clusterMetrics.bearish_clusters,
          quality_multiplier: clusterQualityMultiplier
        } : null,
        // ✅ NEW: Pressure fragility assessment (z-score based signal quality)
        pressure_fragility: {
          tier: fragility.tier,
          composite_score: fragility.score,
          position_multiplier: fragility.positionMultiplier,
          peg_z_score: fragility.components.pegZScore,
          peg_strength: fragility.components.pegStrength,
          peg_acceleration_score: fragility.components.pegAccel,
          vacuum_score: fragility.components.vacuumScore,
          coherence_norm: fragility.components.coherenceNorm,
          snap_bonus: fragility.components.snapBonus,
          reasoning: fragility.reasoning
        }
      }
    } as AgentSignal & { metadata?: any };
  }

  /**
   * Get interpretable analysis for UI/logging showing all 5 physics layers
   */
  getAnalysisForUI(ticks: MarketTick[]): any {
    const analysis = this.analyzeVFMD(ticks);
    if (!analysis) return null;

    const { metrics, triggerState, profitEstimate, regime, regimeConfidence } = analysis;
    const regimeConfig = this.getRegimeConfig();
    const currentPrice = ticks[ticks.length - 1].close;

    // Calculate master equation (PEG × TRIGGER normalized)
    const volatilityProb = TriggerCalculator.getVolatilityProbability(
      metrics.peg,
      triggerState.trigger
    );

    return {
      // LAYER 1: STATE
      regime: {
        classification: regime,
        confidence: (regimeConfidence * 100).toFixed(0) + '%',
        description: regimeConfig.description,
        advice: regimeConfig.tradingAdvice,
      },

      // LAYER 2: ENERGY
      energy_layer: {
        peg_score: metrics.peg.toFixed(2),
        threshold: this.getRegimeThreshold(regime).peg,
        gate_status: metrics.peg > this.getRegimeThreshold(regime).peg ? '✅ OPEN' : '❌ CLOSED',
        interpretation: 'Potential Energy Gradient - measures stored pressure before movement'
      },

      // LAYER 3: PERMISSION
      permission_layer: {
        trigger_score: triggerState.trigger.toFixed(3),
        threshold: this.getRegimeThreshold(regime).trigger,
        gate_status: triggerState.trigger > this.getRegimeThreshold(regime).trigger ? '✅ OPEN' : '❌ CLOSED',
        dominant_failure: (triggerState as any)?.dominantFailureMode || triggerState.constraint_status || 'unknown',
        diagnostics: (triggerState as any)?.diagnostics || {},
        interpretation: 'Constraint Failure Detection - gates release of energy'
      },

      // LAYER 4: DIRECTION
      direction_layer: {
        bias: profitEstimate.direction,
        confidence: (profitEstimate.direction_confidence * 100).toFixed(1) + '%',
        arrow: profitEstimate.direction === 'bullish' ? '📈' : profitEstimate.direction === 'bearish' ? '📉' : '↔️',
        interpretation: 'Physics-based directional bias from metrics alignment'
      },

      // LAYER 5: PROFIT
      profit_layer: {
        potential_score: profitEstimate.profit_potential_score + '/100',
        interpretation: profitEstimate.profit_interpretation,
        expected_move_pct: (profitEstimate.expected_move_pct * 100).toFixed(2) + '%',
        expected_atr_expansion: profitEstimate.expected_atr_expansion.toFixed(1) + 'x',
        reward_to_risk: profitEstimate.reward_to_risk.toFixed(2) + ':1',
        kelly_fraction: (profitEstimate.kelly_fraction * 100).toFixed(1) + '%',
        position_size: (profitEstimate.recommended_position_size * 100).toFixed(1) + '%'
      },

      // MASTER EQUATION
      master_equation: {
        formula: 'VOLATILITY ≈ PEG × TRIGGER',
        peg_contribution: (metrics.peg / 0.64).toFixed(3),  // Normalized to [0, 1] range
        trigger_contribution: triggerState.trigger.toFixed(3),
        combined_probability: (volatilityProb * 100).toFixed(1) + '%',
        interpretation: 'Synchronized measurement of energy buildup + permission release'
      },

      // TRADE SPECIFICATION
      trade_specification: {
        entry: currentPrice.toFixed(2),
        stop_loss: (currentPrice * (1 - profitEstimate.recommended_stop_distance_pct)).toFixed(2),
        take_profit: (currentPrice * (1 + profitEstimate.recommended_take_profit_pct)).toFixed(2),
        stop_distance_pct: (profitEstimate.recommended_stop_distance_pct * 100).toFixed(2) + '%',
        profit_target_pct: (profitEstimate.recommended_take_profit_pct * 100).toFixed(2) + '%',
        position_size: (profitEstimate.recommended_position_size * 100).toFixed(1) + '%',
        risk_reward_ratio: profitEstimate.reward_to_risk.toFixed(2) + ':1'
      },

      // FIELD METRICS (underlying data)
      field_metrics: {
        coherence: (metrics.coherenceScore * 100).toFixed(1) + '%',
        turbulence_index: metrics.turbulenceIndex.toFixed(2),
        divergence: metrics.recentDivergence.toFixed(4),
        curl: metrics.recentCurl.toFixed(4),
        gradient_magnitude: metrics.gradientMagnitude.toFixed(4)
      },

      agent_level: this.level,
      agent_skills: {
        pattern_recognition: this.skills.pattern_recognition,
        timing_precision: this.skills.timing_precision,
        risk_management: this.skills.risk_management
      }
    };
  }

  /**
   * Analyze market data across multiple timeframes for signal fusion
   * Sequential processing: Analyzes each timeframe individually, then fuses signals
   * 
   * @param symbol Asset being analyzed (BTC, ETH, etc)
   * @param timeframeData Map of timeframe → candles
   * @returns {individual, fused} analyses per timeframe + combined multi-TF signal
   */
  analyzeMultiTimeframe(
    symbol: string,
    timeframeData: Map<string, MarketTick[]>
  ) {
    // Set asset for threshold lookup
    this.setAsset(symbol);

    // Timeframe weighting for signal fusion (higher timeframes have more influence)
    const timeframeWeights: Record<string, number> = {
      '5m': 1.0,
      '15m': 1.2,
      '30m': 1.4,
      '1h': 1.5,
      '2h': 1.7,
      '4h': 2.0,
      '6h': 2.2,
      '8h': 2.4,
      '12h': 2.7,
      '1d': 3.0,
    };

    // Process each timeframe
    const analyses: Record<string, any> = {};
    const signals: Record<string, AgentSignal | null> = {};
    const validTimeframes: string[] = [];

    for (const [timeframe, candles] of timeframeData.entries()) {
      // Skip if insufficient data (need 100+ candles for proper analysis)
      if (!candles || candles.length < 100) {
        analyses[timeframe] = null;
        signals[timeframe] = null;
        continue;
      }

      try {
        // Analyze single timeframe
        const analysis = this.analyzeVFMD(candles);
        analyses[timeframe] = analysis;

        if (analysis) {
          // Generate signal for this timeframe
          const signal = this.generateSignal(candles);
          signals[timeframe] = signal;
          validTimeframes.push(timeframe);
        } else {
          signals[timeframe] = null;
        }
      } catch (error) {
        console.error(`Error analyzing ${timeframe}:`, error);
        analyses[timeframe] = null;
        signals[timeframe] = null;
      }
    }

    // Fuse signals across timeframes
    const fusedSignal = this.fuseMultiTimeframeSignals(
      symbol,
      signals,
      validTimeframes,
      timeframeWeights
    );

    return {
      symbol,
      timestamp: Date.now(),
      analyses,
      signals,
      validTimeframes,
      fused: fusedSignal,
      diagnostics: {
        totalTimeframes: timeframeData.size,
        validTimeframes: validTimeframes.length,
        timeframesUsedInFusion: validTimeframes.length,
      }
    };
  }

  /**
   * Fuse multi-timeframe signals into a unified recommendation
   * Strategy: Weighted signal fusion with cross-timeframe alignment detection
   * 
   * Weights higher timeframes more heavily (1d > 4h > 1h)
   * Boosts confidence when multiple timeframes agree
   * Flags conflicts when signals diverge
   */
  private fuseMultiTimeframeSignals(
    symbol: string,
    signals: Record<string, AgentSignal | null>,
    validTimeframes: string[],
    timeframeWeights: Record<string, number>
  ): AgentSignal & { multiframe_diagnostics?: any } {
    // Default to HOLD if no valid signals
    if (validTimeframes.length === 0) {
      return {
        action: 'HOLD',
        confidence: 0,
        entry: 0,
        target: 0,
        stop: 0,
        reason: '❌ No valid multi-timeframe data available for fusion',
        agent_name: this.name,
        agent_level: this.level,
        multiframe_diagnostics: {
          fusion_method: 'weighted_signal_fusion',
          alignment_score: 0,
          conflict_detected: false,
          timeframe_agreement: [],
          recommendation: 'HOLD'
        }
      } as AgentSignal & { multiframe_diagnostics?: any };
    }

    // Extract action and confidence for each valid timeframe
    const timeframeActions: Array<{ tf: string; action: string; conf: number; weight: number }> = [];
    let totalConfidence = 0;
    let totalWeight = 0;
    let buyVotes = 0;
    let sellVotes = 0;
    let holdVotes = 0;

    const timeframeAgreement: Array<{ timeframe: string; action: string; confidence: number }> = [];

    for (const tf of validTimeframes) {
      const signal = signals[tf];
      if (!signal) continue;

      const weight = timeframeWeights[tf] || 1.0;
      const conf = signal.confidence || 0;

      timeframeActions.push({
        tf,
        action: signal.action,
        conf,
        weight
      });

      totalConfidence += conf * weight;
      totalWeight += weight;

      // Vote counting for alignment detection
      if (signal.action === 'BUY') buyVotes++;
      else if (signal.action === 'SELL') sellVotes++;
      else holdVotes++;

      timeframeAgreement.push({
        timeframe: tf,
        action: signal.action,
        confidence: conf
      });
    }

    // Calculate alignment score (0-1: how much agreement across timeframes)
    const maxVotes = Math.max(buyVotes, sellVotes, holdVotes);
    const alignmentScore = validTimeframes.length > 0 ? maxVotes / validTimeframes.length : 0;

    // Weighted average confidence
    const baseConfidence = totalWeight > 0 ? totalConfidence / totalWeight : 0;

    // Determine fused action based on weighted votes
    let fusedAction: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (buyVotes > sellVotes && buyVotes > holdVotes) fusedAction = 'BUY';
    else if (sellVotes > buyVotes && sellVotes > holdVotes) fusedAction = 'SELL';
    else if (alignmentScore < 0.5) fusedAction = 'HOLD';

    // Confidence boosting: Aligned timeframes increase confidence
    // Conflicted timeframes reduce confidence
    let confidenceMultiplier = 1.0;

    if (alignmentScore >= 0.8) {
      // Strong alignment: 3+ TFs agree
      confidenceMultiplier = 1.5;
    } else if (alignmentScore >= 0.6) {
      // Good alignment: 2+ TFs agree
      confidenceMultiplier = 1.25;
    } else if (alignmentScore < 0.4) {
      // Conflict detected: Reduce confidence significantly
      confidenceMultiplier = 0.6;
    }

    const fusedConfidence = Math.min(1.0, baseConfidence * confidenceMultiplier);

    // Detect cross-timeframe conflicts
    const conflictDetected = alignmentScore < 0.5 && validTimeframes.length > 1;

    // Get entry/target/stop from highest-weight valid signal matching fused action
    let fusedEntry = 0;
    let fusedTarget = 0;
    let fusedStop = 0;
    let sourceTimeframe = '';

    // Find the highest-weight signal that matches our fused action
    let bestSignal: AgentSignal | null = null;
    let bestWeight = -1;

    for (const tf of validTimeframes) {
      const signal = signals[tf];
      if (!signal || signal.action !== fusedAction) continue;

      const weight = timeframeWeights[tf] || 1.0;
      if (weight > bestWeight) {
        bestWeight = weight;
        bestSignal = signal;
        sourceTimeframe = tf;
      }
    }

    // If no perfect match, prefer holding over mismatched action signal
    // (can't use BUY signal entry/target/stop for SELL action or vice versa)
    if (!bestSignal) {
      // Log conflict but don't force mismatched geometry
      console.warn(
        `⚠️  Multi-TF Fusion: No signal matches fused action ${fusedAction}. ` +
        `Available: ${validTimeframes.map(tf => signals[tf]?.action).filter(a => a).join('/')}`
      );
      // Will use synthetic entry/target/stop = 0, forcing HOLD behavior in caller
    } else if (bestSignal.action !== fusedAction) {
      // Safety check: if we somehow selected a mismatched signal, warn and NULL it
      console.warn(
        `⚠️  Multi-TF Fusion: Selected signal action ${bestSignal.action} != fused action ${fusedAction}. ` +
        `Forcing HOLD to avoid geometry mismatch.`
      );
      bestSignal = null;
    }

    if (bestSignal && bestSignal.action === fusedAction) {
      fusedEntry = bestSignal.entry;
      fusedTarget = bestSignal.target;
      fusedStop = bestSignal.stop;
    }

    // Build comprehensive reasoning
    const reasoning: string[] = [
      `📊 Multi-Timeframe Fusion (${validTimeframes.length} TFs)`,
      `🎯 Action: ${fusedAction} (${alignmentScore < 0.5 ? '⚠️ CONFLICT' : alignmentScore >= 0.8 ? '✅ STRONG' : '📈 MODERATE'} agreement)`,
      `📈 Alignment: ${(alignmentScore * 100).toFixed(0)}% (${buyVotes}B/${sellVotes}S/${holdVotes}H)`,
      `🔧 Confidence: ${(baseConfidence * 100).toFixed(0)}% base × ${confidenceMultiplier.toFixed(1)}x alignment = ${(fusedConfidence * 100).toFixed(0)}%`,
      `📍 Source (highest weight): ${sourceTimeframe}`,
      `🌍 Timeframe votes: ${timeframeAgreement.map(a => `${a.timeframe}:${a.action}(${(a.confidence * 100).toFixed(0)}%)`).join(' | ')}`
    ];

    if (conflictDetected) {
      reasoning.push(`⚡ CONFLICT: Multiple timeframes disagree (alignment ${(alignmentScore * 100).toFixed(0)}% < 50%)`);
    }

    return {
      action: fusedAction,
      confidence: fusedConfidence,
      entry: fusedEntry,
      target: fusedTarget,
      stop: fusedStop,
      reason: reasoning.join(' | '),
      agent_name: this.name,
      agent_level: this.level,
      multiframe_diagnostics: {
        fusion_method: 'weighted_signal_fusion',
        alignment_score: alignmentScore,
        alignment_grade: alignmentScore >= 0.8 ? 'STRONG' : alignmentScore >= 0.6 ? 'GOOD' : alignmentScore >= 0.4 ? 'WEAK' : 'CONFLICT',
        conflict_detected: conflictDetected,
        confidence_multiplier: confidenceMultiplier,
        timeframe_agreement: timeframeAgreement,
        votes: { buy: buyVotes, sell: sellVotes, hold: holdVotes },
        source_timeframe: sourceTimeframe,
        base_confidence: baseConfidence,
        valid_timeframes_used: validTimeframes.length,
        recommendation: fusedAction
      }
    } as AgentSignal & { multiframe_diagnostics?: any };
  }
}

export default VFMDPhysicsAgent;
