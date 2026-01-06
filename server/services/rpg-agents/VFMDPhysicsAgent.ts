import { TradingAgent, AgentPersonality, AgentSignal } from './TradingAgent.ts';
import type { MarketTick, PhysicsMetrics } from '../vfmd/types.ts';
import { EarlyEntryDetector } from '../vfmd/earlyEntryDetector.ts';
import { PhysicsCalculator } from '../vfmd/physicsCalculator.ts';
import { FieldConstructor } from '../vfmd/fieldConstructor.ts';
import { RegimeClassifier, FlowRegime, type RegimeConfig } from '../vfmd/regimeClassifier.ts';
import { TriggerCalculator } from '../vfmd/triggerCalculator.ts';
import { ProfitEstimator } from '../vfmd/profitEstimator.ts';

/**
 * VFMDPhysicsAgent
 * 
 * Specialized in early entry detection using the full ported VFMD system
 * - Analyzes vector fields from price/volume data
 * - Identifies accumulation/distribution zones
 * - Detects directional coherence and energy gradients
 * - Provides interpretable early entry signals
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
  private currentRegime: FlowRegime = FlowRegime.CONSOLIDATION;
  private regimeConfidence: number = 0.5;
  private previousMetrics: PhysicsMetrics | null = null;

  // Regime-specific thresholds (optimized per market regime)
  private regimeThresholds = {
    [FlowRegime.LAMINAR_TREND]: { peg: 250, trigger: 0.20 },
    [FlowRegime.BREAKOUT_TRANSITION]: { peg: 400, trigger: 0.25 },
    [FlowRegime.ACCUMULATION]: { peg: 260, trigger: 0.40 },
    [FlowRegime.DISTRIBUTION]: { peg: 260, trigger: 0.40 },
    [FlowRegime.CONSOLIDATION]: { peg: 150, trigger: 0.20 },
    [FlowRegime.TURBULENT_CHOP]: { peg: 350, trigger: 0.20 },
  };

  // Asset-specific regime thresholds (ETH has lower PEG levels, lower TRIGGER thresholds)
  private assetRegimeThresholds: Record<string, Record<string, { peg: number; trigger: number }>> = {
    'ETH': {
      [FlowRegime.LAMINAR_TREND]: { peg: 15, trigger: 0.08 },
      [FlowRegime.BREAKOUT_TRANSITION]: { peg: 28, trigger: 0.10 },
      [FlowRegime.ACCUMULATION]: { peg: 25, trigger: 0.12 },
      [FlowRegime.DISTRIBUTION]: { peg: 25, trigger: 0.12 },
      [FlowRegime.CONSOLIDATION]: { peg: 15, trigger: 0.08 },  // ETH: 1/10x BTC threshold (VeryAggressive)
      [FlowRegime.TURBULENT_CHOP]: { peg: 28, trigger: 0.08 },  // ETH: 1/12.5x BTC threshold (VeryAggressive)
    }
  };

  // Asset-specific profit score thresholds (lower for altcoins like ETH)
  private profitScoreThresholds = {
    'BTC': 65,      // Bitcoin: stricter (proven edge)
    'ETH': 30,      // Ethereum: extremely relaxed (35 point lower, VeryAggressive for 682 trades)
    'default': 60   // Other assets
  };

  private currentAsset: string = 'BTC'; // Track current asset being analyzed

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
  }

  /**
   * Set the current asset being traded (for asset-specific thresholds)
   */
  setAsset(asset: 'BTC' | 'ETH' | string): void {
    this.currentAsset = asset;
  }

  /**
   * Set custom regime parameters for optimization testing
   */
  setRegimeParameters(asset: string, params: Record<string, {peg: number; trigger: number}>): void {
    if (!this.assetRegimeThresholds[asset]) {
      this.assetRegimeThresholds[asset] = {};
    }
    this.assetRegimeThresholds[asset] = params;
  }

  /**
   * Set custom profit score threshold for an asset
   */
  setProfitScoreThreshold(asset: string, threshold: number): void {
    (this.profitScoreThresholds as Record<string, number>)[asset] = threshold;
  }

  /**
   * Get the profit score threshold for current asset
   */
  private getProfitScoreThreshold(): number {
    return (this.profitScoreThresholds as Record<string, number>)[this.currentAsset] ?? 
           this.profitScoreThresholds.default;
  }

  /**
   * Get regime-specific thresholds for current asset
   */
  private getRegimeThreshold(regime: FlowRegime): { peg: number; trigger: number } {
    const assetThresholds = (this.assetRegimeThresholds as Record<string, any>)[this.currentAsset];
    if (assetThresholds && assetThresholds[regime]) {
      return assetThresholds[regime];
    }
    return this.regimeThresholds[regime];
  }

  /**
   * Calculate Average True Range (volatility measure)
   */
  private calculateATR(ticks: MarketTick[], period: number = 14): number {
    if (ticks.length < period) return 0;

    let tr_sum = 0;
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

    return tr_sum / Math.min(period, ticks.length - Math.max(0, ticks.length - period));
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
    const maxSize = profitQualityMultiplier > 0.95 ? 0.4 : 0.25;  // Increased from 0.35 to 0.4 for high confidence
    const maxFraction = profitQualityMultiplier > 0.95 ? 0.5 : 0.35;  // Increased from 0.45 to 0.5
    
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
    const expectedVolatilityPct = (atr / metrics.coherenceScore) * expectedAtrExpansion * 100;
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
    return RegimeClassifier.explainRegime(this.currentRegime, metrics);
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

      // LAYER 1: STATE - Classify market regime
      this.currentRegime = RegimeClassifier.classify(metrics);
      this.regimeConfidence = RegimeClassifier.getRegimeConfidence(metrics);

      // LAYER 2: ENERGY - Compute PEG (potential energy gradient)
      // Already in metrics.peg from PhysicsCalculator

      // LAYER 3: PERMISSION - Compute TRIGGER (constraint failure detection)
      const triggerState = TriggerCalculator.computeTrigger(metrics);

      // LAYER 4 & 5: DIRECTION & PROFIT - Estimate from physics
      const profitEstimate = ProfitEstimator.estimateProfit(
        metrics,
        this.previousMetrics,
        {
          currentPrice: ticks[ticks.length - 1].close,
          atrValue: this.calculateATR(ticks, 14),
          pricePosition: this.calculatePricePosition(ticks, 50),
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
        timestamp: Date.now(),
        dataPointsProcessed: ticks.length
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

    const { metrics, triggerState, profitEstimate, regime } = analysis;
    const currentPrice = ticks[ticks.length - 1].close;
    const regimeThresholds = this.getRegimeThreshold(regime);
    const pegThreshold = regimeThresholds?.peg ?? 300;
    const triggerThreshold = regimeThresholds?.trigger ?? 0.5;

    // LAYER 1: STATE - Handle turbulent markets with reduced sizing instead of hard block
    // Turbulent = high risk, but tradeable with proper risk management
    const turbulenceMultiplier = regime === FlowRegime.TURBULENT_CHOP ? 0.4 : 1.0;
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
        reason: `⚡ Energy insufficient (PEG: ${metrics.peg.toFixed(0)} < ${pegHardThreshold.toFixed(0)}). No pressure buildup detected.`,
        agent_name: this.name,
        agent_level: this.level
      } as AgentSignal;
    }
    
    // Soft penalty if PEG is below full threshold but above hard threshold
    const pegQualityMultiplier = pegSignal ? 1.0 : 0.5 + (metrics.peg / pegThreshold) * 0.5;  // Stricter penalty (was 0.7-1.0)

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
    
    const baseConfidence = (profitEstimate.profit_potential_score / 100) * gateQualityMultiplier;
    const skillInfluence = this.applySkillInfluenceToConfidence(baseConfidence);
    
    const volatilityPrediction = this.getVolatilityPrediction(metrics, triggerState, this.calculateATR(ticks, 14));
    
    // Apply sizing with volatility expansion and profit quality
    const sizeInfluence = this.applySkillInfluenceToSizing(
      profitEstimate.recommended_position_size,
      profitEstimate.kelly_fraction,
      volatilityPrediction.atr_expansion_multiplier,
      profitQualityMultiplier * gateQualityMultiplier
    );
    
    const constraintDiagnostics = this.getConstraintDiagnosticsString(triggerState);

    // Trade specification from physics layers (with skill adjustments)
    const entryPrice = currentPrice;
    const stopPrice = currentPrice * (1 - profitEstimate.recommended_stop_distance_pct);
    const targetPrice = currentPrice * (1 + profitEstimate.recommended_take_profit_pct);
    const positionSize = sizeInfluence.adjustedSize;
    
    // Add internal exit tracking (for external system to implement exit logic)
    const exitConditions = {
      target_hit: targetPrice,
      stop_hit: stopPrice,
      max_duration_candles: isTurbulent ? 3 : 5,  // Shorter in turbulent markets
      use_target_stop_exit: true
    };

    // Build comprehensive reasoning with all enhancements
    const reasoning: string[] = [
      `🎯 ${regime.toUpperCase()} | Conf: ${(this.regimeConfidence * 100).toFixed(0)}%`,
      `⚡ Energy (PEG): ${metrics.peg.toFixed(0)} [Gate: ${pegSignal ? '✅' : '⚠️'}] (${(pegQualityMultiplier * 100).toFixed(0)}%)`,
      `🔓 Permission (TRIGGER): ${triggerState.trigger.toFixed(3)} [Gate: ${triggerSignal ? '✅' : '⚠️'}] (${(triggerQualityMultiplier * 100).toFixed(0)}%) | ${constraintDiagnostics.summary}`,
      ...constraintDiagnostics.detailed,
      `${profitEstimate.direction === 'bullish' ? '📈' : '📉'} Direction: ${profitEstimate.direction.toUpperCase()} (${(profitEstimate.direction_confidence * 100).toFixed(0)}%)`,
      `💰 Expected move: ${(profitEstimate.expected_move_pct * 100).toFixed(2)}% | Volatility: ${volatilityPrediction.volatility_regime.toUpperCase()} (${volatilityPrediction.expected_volatility_pct.toFixed(2)}% expansion expected)`,
      `📊 Profit potential: ${profitEstimate.profit_potential_score}/100 (Quality: ${(profitQualityMultiplier * 100).toFixed(0)}%)`,
      `💎 Risk/Reward: ${profitEstimate.reward_to_risk.toFixed(2)}:1`,
      `📍 Position size: ${(positionSize * 100).toFixed(1)}% (Base: ${(profitEstimate.recommended_position_size * 100).toFixed(1)}% | Skill: ${sizeInfluence.sizeBoost.toFixed(1)}% | Vol: ${sizeInfluence.volatilityBoost.toFixed(1)}%)`,
      `🎓 Skill influence: Confidence ${skillInfluence.confidenceBoost.toFixed(1)}% boost (PR: ${skillInfluence.skillBreakdown.pattern_recognition_boost.toFixed(1)}% + TP: ${skillInfluence.skillBreakdown.timing_precision_boost.toFixed(1)}%)`,
      `🌊 Gate Quality: Overall ${(gateQualityMultiplier * 100).toFixed(0)}% | Turbulence ${(turbulenceMultiplier * 100).toFixed(0)}%`,
      `Coherence: ${(metrics.coherenceScore * 100).toFixed(1)}% | TI: ${metrics.turbulenceIndex.toFixed(2)} | ATR Exp: ${volatilityPrediction.atr_expansion_multiplier.toFixed(1)}x | Exit: ${exitConditions.use_target_stop_exit ? `Target/Stop (${exitConditions.max_duration_candles}h max)` : '5-candle max'}`
    ];

    return {
      action: profitEstimate.direction === 'bullish' ? 'BUY' : 'SELL',
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
        peg_contribution: (metrics.peg / 500).toFixed(3),
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
}

export default VFMDPhysicsAgent;
