/**
 * Live Monitoring Dashboard Service
 * 
 * Real-time display and tracking of:
 * - Current regime classification
 * - PEG (energy) levels and trends
 * - TRIGGER (permission) state and component breakdown
 * - Constraint status and failure modes
 * - Volatility probability
 * - Signal strength per regime
 */

import { TriggerCalculator } from '../vfmd/triggerCalculator';
import { PhysicsCalculator } from '../vfmd/physicsCalculator';

type FlowRegime = 'LAMINAR_TREND' | 'BREAKOUT_TRANSITION' | 'ACCUMULATION' | 'DISTRIBUTION' | 'CONSOLIDATION' | 'TURBULENT_CHOP';
type PhysicsMetrics = any; // From PhysicsCalculator.computeAllMetrics()
type Field2D = any; // From field constructor

type TriggerComponents = {
  liquidity: number;
  structural: number;
  temporal: number;
  fatigue: number;
};

export interface ConstraintMonitorState {
  // Timestamp
  timestamp: number;
  candle_time: string;

  // Regime layer
  regime: FlowRegime;
  regime_confidence: number;

  // Energy layer (PEG)
  peg: number;
  peg_status: 'low' | 'building' | 'ready' | 'extreme';
  peg_trend: number; // Change from previous candle
  peg_signal: boolean;

  // Permission layer (TRIGGER)
  trigger: number;
  trigger_status: 'intact' | 'degrading' | 'failing' | 'collapsed';
  trigger_components: {
    liquidity: number;
    structural: number;
    temporal: number;
    fatigue: number;
  };
  trigger_dominant_mode: string;
  trigger_signal: boolean;

  // Master equation
  volatility_probability: number;
  master_signal: boolean;
  signal_strength: 'weak' | 'moderate' | 'strong' | 'none';

  // Alert flags
  alerts: string[];

  // Historical context
  peg_percentile: number; // 0-100, where 100 is highest in recent history
  trigger_percentile: number;
}

export class ConstraintMonitor {
  private previousPeg: number = 0;
  private pegHistory: number[] = [];
  private triggerHistory: number[] = [];
  private regimeHistory: FlowRegime[] = [];
  private maxHistoryLength: number = 100;

  /**
   * Analyze current market state and return monitoring data
   */
  analyzeConstraints(
    field: Field2D,
    previous?: ConstraintMonitorState
  ): ConstraintMonitorState {
    const now = Date.now();
    const metrics = PhysicsCalculator.computeAllMetrics(field);
    const regime = this.getRegimeFromMetrics(metrics);
    const triggerState = TriggerCalculator.computeTrigger(metrics);

    // Update history
    this.pegHistory.push(metrics.peg);
    this.triggerHistory.push(triggerState.trigger);
    this.regimeHistory.push(regime);
    if (this.pegHistory.length > this.maxHistoryLength) {
      this.pegHistory.shift();
      this.triggerHistory.shift();
      this.regimeHistory.shift();
    }

    // PEG status
    const pegStatus = this.getPegStatus(metrics.peg);
    const pegTrend = metrics.peg - this.previousPeg;
    this.previousPeg = metrics.peg;

    // TRIGGER status and dominant mode
    const triggerDominantMode = this.getDominantFailureMode(
      triggerState.components
    );

    // Master equation
    const volatilityProb = TriggerCalculator.getVolatilityProbability(
      metrics.peg,
      triggerState.trigger
    );

    // Signal evaluation
    // Feb 2025: PEG threshold recalibrated from raw scale (300) to normalized (0.09)
    const pegSignal = metrics.peg > 0.09;
    const triggerSignal = triggerState.trigger > 0.5;
    const masterSignal = pegSignal && triggerSignal;
    const signalStrength = this.evaluateSignalStrength(
      volatilityProb,
      regime
    );

    // Alerts
    const alerts = this.generateAlerts(
      metrics.peg,
      triggerState.trigger,
      regime,
      pegTrend
    );

    // Percentiles (relative to history)
    const pegPercentile = this.calculatePercentile(
      metrics.peg,
      this.pegHistory
    );
    const triggerPercentile = this.calculatePercentile(
      triggerState.trigger,
      this.triggerHistory
    );

    const state: ConstraintMonitorState = {
      timestamp: now,
      candle_time: new Date(now).toISOString(),

      // Regime
      regime,
      regime_confidence: 0.95, // TODO: Get from RegimeAnalyzer if available

      // PEG
      peg: metrics.peg,
      peg_status: pegStatus,
      peg_trend: pegTrend,
      peg_signal: pegSignal,

      // TRIGGER
      trigger: triggerState.trigger,
      trigger_status: triggerState.constraint_status,
      trigger_components: triggerState.components as any,
      trigger_dominant_mode: triggerDominantMode,
      trigger_signal: triggerSignal,

      // Master
      volatility_probability: volatilityProb,
      master_signal: masterSignal,
      signal_strength: signalStrength,

      // Alerts
      alerts,

      // History
      peg_percentile: pegPercentile,
      trigger_percentile: triggerPercentile,
    };

    return state;
  }

  /**
   * Get regime classification from metrics
   */
  private getRegimeFromMetrics(metrics: PhysicsMetrics): FlowRegime {
    // Simplified regime detection based on available metrics
    if (metrics.coherenceScore > 0.7) return 'LAMINAR_TREND';
    if (metrics.turbulenceIndex > 2.0) return 'TURBULENT_CHOP';
    if (Math.abs(metrics.divergenceScore) > 0.6) return 'BREAKOUT_TRANSITION';
    return 'CONSOLIDATION';
  }

  /**
   * Determine PEG status
   */
  private getPegStatus(peg: number): 'low' | 'building' | 'ready' | 'extreme' {
    if (peg < 100) return 'low';
    if (peg < 300) return 'building';
    if (peg < 600) return 'ready';
    return 'extreme';
  }

  /**
   * Identify dominant constraint failure mode
   */
  private getDominantFailureMode(components: {
    liquidity: number;
    structure: number;
    temporal: number;
    fatigue: number;
  }): string {
    const modes = [
      { name: 'Liquidity', score: components.liquidity },
      { name: 'Structural', score: components.structure },
      { name: 'Temporal', score: components.temporal },
      { name: 'Fatigue', score: components.fatigue },
    ];

    const dominant = modes.reduce((a, b) => (a.score > b.score ? a : b));
    return dominant.score > 0.1 ? dominant.name : 'None';
  }

  /**
   * Evaluate signal strength for execution
   */
  private evaluateSignalStrength(
    volatilityProb: number,
    regime: FlowRegime
  ): 'weak' | 'moderate' | 'strong' | 'none' {
    // Don't trade in turbulent chop
    if (regime === 'TURBULENT_CHOP') return 'none';

    if (volatilityProb > 0.6) return 'strong';
    if (volatilityProb > 0.4) return 'moderate';
    if (volatilityProb > 0.2) return 'weak';
    return 'none';
  }

  /**
   * Generate alert messages
   */
  private generateAlerts(
    peg: number,
    trigger: number,
    regime: FlowRegime,
    pegTrend: number
  ): string[] {
    const alerts: string[] = [];

    // Energy alerts
    if (peg > 600) alerts.push('⚠️ Extreme energy buildup (PEG > 600)');
    if (pegTrend > 100) alerts.push('📈 Rapid energy buildup (+' + Math.round(pegTrend) + ')');
    if (pegTrend < -100) alerts.push('📉 Rapid energy dissipation (' + Math.round(pegTrend) + ')');

    // Permission alerts
    if (trigger > 0.7) alerts.push('🔓 Strong constraint failure (TRIGGER > 0.7)');
    if (trigger > 0.5 && peg > 300) alerts.push('✅ Signal conditions met (PEG + TRIGGER)');

    // Regime alerts
    if (regime === 'BREAKOUT_TRANSITION') alerts.push('⚡ Breakout transition detected');
    if (regime === 'TURBULENT_CHOP') alerts.push('🌪️ High chop - reduce position size');

    return alerts;
  }

  /**
   * Calculate percentile rank in history
   */
  private calculatePercentile(value: number, history: number[]): number {
    if (history.length < 2) return 50;
    const sorted = [...history].sort((a, b) => a - b);
    let rank = 0;
    for (const h of sorted) {
      if (h <= value) rank++;
    }
    return Math.round((rank / history.length) * 100);
  }

  /**
   * Format state for display
   */
  static formatForDisplay(state: ConstraintMonitorState): string {
    const lines: string[] = [];

    lines.push('═'.repeat(80));
    lines.push('📊 CONSTRAINT MONITOR — Live Market State');
    lines.push('═'.repeat(80));

    lines.push('');
    lines.push(`⏰ ${state.candle_time}`);

    // Regime
    lines.push('');
    lines.push(`📍 REGIME: ${state.regime}`);
    lines.push(`   Confidence: ${(state.regime_confidence * 100).toFixed(0)}%`);

    // PEG
    lines.push('');
    lines.push(`⚡ ENERGY (PEG): ${state.peg.toFixed(0)}`);
    lines.push(`   Status: ${state.peg_status.toUpperCase()}`);
    lines.push(`   Trend: ${state.peg_trend > 0 ? '↗' : state.peg_trend < 0 ? '↘' : '→'} ${Math.abs(state.peg_trend).toFixed(0)}`);
    lines.push(`   Percentile: ${state.peg_percentile}%`);
    lines.push(`   Signal: ${state.peg_signal ? '✅' : '❌'}`);

    // TRIGGER
    lines.push('');
    lines.push(`🔓 PERMISSION (TRIGGER): ${state.trigger.toFixed(2)}`);
    lines.push(`   Status: ${state.trigger_status.toUpperCase()}`);
    lines.push(`   Dominant Mode: ${state.trigger_dominant_mode}`);
    lines.push(
      `   Components: L=${state.trigger_components.liquidity.toFixed(2)} ` +
        `S=${state.trigger_components.structural.toFixed(2)} ` +
        `T=${state.trigger_components.temporal.toFixed(2)} ` +
        `F=${state.trigger_components.fatigue.toFixed(2)}`
    );
    lines.push(`   Percentile: ${state.trigger_percentile}%`);
    lines.push(`   Signal: ${state.trigger_signal ? '✅' : '❌'}`);

    // Master
    lines.push('');
    lines.push(`🎯 VOLATILITY PROBABILITY: ${(state.volatility_probability * 100).toFixed(1)}%`);
    lines.push(`   Signal Strength: ${state.signal_strength.toUpperCase()}`);
    lines.push(`   Master Signal: ${state.master_signal ? '✅ READY TO TRADE' : '❌ Wait'}`);

    // Alerts
    if (state.alerts.length > 0) {
      lines.push('');
      lines.push('🚨 ALERTS:');
      for (const alert of state.alerts) {
        lines.push(`   ${alert}`);
      }
    }

    lines.push('');
    lines.push('═'.repeat(80));

    return lines.join('\n');
  }

  /**
   * Export state as JSON (for API/dashboard)
   */
  static exportJSON(state: ConstraintMonitorState): object {
    return {
      timestamp: state.timestamp,
      candle_time: state.candle_time,
      regime: {
        name: state.regime,
        confidence: state.regime_confidence,
      },
      energy: {
        peg: state.peg,
        status: state.peg_status,
        trend: state.peg_trend,
        percentile: state.peg_percentile,
        signal: state.peg_signal,
      },
      permission: {
        trigger: state.trigger,
        status: state.trigger_status,
        dominant_mode: state.trigger_dominant_mode,
        components: state.trigger_components,
        percentile: state.trigger_percentile,
        signal: state.trigger_signal,
      },
      master_equation: {
        volatility_probability: state.volatility_probability,
        signal_strength: state.signal_strength,
        ready_to_trade: state.master_signal,
      },
      alerts: state.alerts,
    };
  }
}

export default ConstraintMonitor;
