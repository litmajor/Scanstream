import { TradingAgent, AgentPersonality, AgentSignal } from './TradingAgent';
import type { MarketTick } from '../vfmd/types';
import { EarlyEntryDetector } from '../vfmd/earlyEntryDetector';
import { PhysicsCalculator } from '../vfmd/physicsCalculator';
import { FieldConstructor } from '../vfmd/fieldConstructor';
import { RegimeClassifier, FlowRegime, type RegimeConfig } from '../vfmd/regimeClassifier';

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
   * Analyze market data using full VFMD system
   * Specializes in identifying early entry setups
   * Includes regime-aware analysis
   */
  analyzeVFMD(ticks: MarketTick[]) {
    if (!ticks || ticks.length < 100) {
      return null;
    }

    try {
      // Use the specialized early entry detector
      const earlyEntry = this.earlyEntryDetector.analyzeForEntry(ticks);

      // Get underlying physics metrics
      const prices = ticks.map(t => t.close);
      const field = this.fieldConstructor.constructField(prices);
      const metrics = PhysicsCalculator.computeAllMetrics(field);

      // Classify market regime
      this.currentRegime = RegimeClassifier.classify(metrics);
      this.regimeConfidence = RegimeClassifier.getRegimeConfidence(metrics);

      return {
        earlyEntry,
        metrics,
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
   * Generate RPG-compatible trading signal
   * Leverages VFMD early entry detection with regime-aware thresholds
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

    const { earlyEntry, metrics, regime } = analysis;
    const currentPrice = ticks[ticks.length - 1].close;
    const regimeConfig = this.getRegimeConfig();

    // Get regime-specific threshold
    const signalThreshold = regimeConfig.minConfidence;

    // CRITICAL: Avoid trading in turbulent markets
    if (regime === FlowRegime.TURBULENT_CHOP) {
      return {
        action: 'HOLD',
        confidence: 0,
        entry: currentPrice,
        target: 0,
        stop: 0,
        reason: `Market too turbulent (TI: ${metrics.turbulenceIndex.toFixed(2)}). Waiting for chaos to settle.`,
        agent_name: this.name,
        agent_level: this.level
      } as AgentSignal;
    }

    // Map VFMD signal to agent signal
    let action: AgentSignal['action'] = 'HOLD';

    // High-confidence early entry signals are prioritized
    if (earlyEntry.confidence > signalThreshold) {
      action = earlyEntry.type === 'bullish' ? 'BUY' : 'SELL';
    } else if (
      earlyEntry.confidence > signalThreshold * 0.8 &&
      earlyEntry.strength > 0.5
    ) {
      // Medium confidence but strong directional flow (in non-turbulent regimes)
      action = earlyEntry.type === 'bullish' ? 'BUY' : 'SELL';
    }

    // Skill multiplier: agent level and pattern_recognition improve accuracy
    const skillMultiplier = 1 + (this.skills.pattern_recognition - 1) * 0.05;
    const adjustedConfidence = Math.min(1, earlyEntry.confidence * skillMultiplier);

    // Build reasoning from VFMD insights
    const reasoning: string[] = [
      `Regime: ${regime} (confidence: ${(this.regimeConfidence * 100).toFixed(0)}%)`,
      earlyEntry.reason,
      `Field coherence: ${(metrics.coherenceScore * 100).toFixed(1)}%`,
      `Energy (PEG): ${metrics.peg.toFixed(3)}`,
      `Turbulence (TI): ${metrics.turbulenceIndex.toFixed(2)}`,
      `Imbalance: ${(earlyEntry.imbalanceScore * 100).toFixed(1)}%`,
      `Pressure gradient: ${(earlyEntry.pressureGradient * 100).toFixed(1)}%`,
      ...earlyEntry.factors
    ];

    return {
      action,
      confidence: adjustedConfidence,
      entry: earlyEntry.suggestedEntry || currentPrice,
      target: earlyEntry.suggestedTarget,
      stop: earlyEntry.suggestedStop,
      reason: `[${regime.toUpperCase()}] ${earlyEntry.reason}`,
      agent_name: this.name,
      agent_level: this.level
    } as AgentSignal;
  }

  /**
   * Get interpretable analysis for UI/logging
   */
  getAnalysisForUI(ticks: MarketTick[]): any {
    const analysis = this.analyzeVFMD(ticks);
    if (!analysis) return null;

    const { earlyEntry, metrics, regime, regimeConfidence } = analysis;
    const regimeConfig = this.getRegimeConfig();

    return {
      regime: {
        classification: regime,
        confidence: (regimeConfidence * 100).toFixed(0) + '%',
        description: regimeConfig.description,
        advice: regimeConfig.tradingAdvice,
        config: {
          minConfidence: (regimeConfig.minConfidence * 100).toFixed(0) + '%',
          positionSize: (regimeConfig.positionSizeMultiplier * 100).toFixed(0) + '%',
          riskPerTrade: (regimeConfig.riskPercentPerTrade * 100).toFixed(1) + '%',
          profitTargetMultiplier: regimeConfig.profitTargetMultiplier.toFixed(1) + ':1'
        }
      },
      signal: {
        type: earlyEntry.type,
        confidence: (earlyEntry.confidence * 100).toFixed(1) + '%',
        strength: (earlyEntry.strength * 100).toFixed(1) + '%',
        recommendation: earlyEntry.reason
      },
      entry_guidance: {
        suggested_entry: earlyEntry.suggestedEntry.toFixed(2),
        profit_target: earlyEntry.suggestedTarget.toFixed(2),
        stop_loss: earlyEntry.suggestedStop.toFixed(2),
        risk_reward: (
          Math.abs(earlyEntry.suggestedTarget - earlyEntry.suggestedEntry) /
          Math.abs(earlyEntry.suggestedEntry - earlyEntry.suggestedStop)
        ).toFixed(2)
      },
      field_metrics: {
        coherence: (metrics.coherenceScore * 100).toFixed(1) + '%',
        peg_energy: metrics.peg.toFixed(4),
        turbulence_index: metrics.turbulenceIndex.toFixed(2),
        divergence: metrics.recentDivergence.toFixed(4),
        curl: metrics.recentCurl.toFixed(4),
        gradient_magnitude: metrics.gradientMagnitude.toFixed(4)
      },
      market_state: {
        volatility_regime: earlyEntry.volatilityRegime,
        imbalance_score: (earlyEntry.imbalanceScore * 100).toFixed(1) + '%',
        pressure_gradient: (earlyEntry.pressureGradient * 100).toFixed(1) + '%',
        flow_momentum: (earlyEntry.flowMomentum * 100).toFixed(1) + '%'
      },
      factors: earlyEntry.factors,
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
