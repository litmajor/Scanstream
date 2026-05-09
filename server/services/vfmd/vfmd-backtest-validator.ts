/**
 * VFMD BACKTEST VALIDATION HARNESS
 * ================================
 * 
 * Framework for validating VFMD assumptions against real market data
 * Fills the critical gap: "Are these assumptions actually true?"
 * 
 * This harness:
 * 1. Replays VFMDPhysicsAgent on historical data
 * 2. Measures actual outcomes (did signals work?)
 * 3. Validates thresholds empirically
 * 4. Reports regime performance
 * 5. Identifies which assumptions hold and which need fixing
 */

import type { MarketTick, PhysicsMetrics } from './types';
import { FieldConstructor } from './fieldConstructor';
import { PhysicsCalculator } from './physicsCalculator';
import { RegimeClassifier, FlowRegime, type RegimeConfig } from './regimeClassifier.ts';

/**
 * Trade outcome after signal is generated
 * Tracks: did this signal actually work?
 */
export interface TradeOutcome {
  signalPrice: number;
  signalRegime: FlowRegime;
  signalConfidence: number;
  suggestedTarget: number;
  suggestedStop: number;
  
  // Actual outcome
  entryPrice: number;
  hitTarget: boolean;
  hitStop: boolean;
  actualMax: number; // Max price before exit
  actualMin: number; // Min price before exit
  
  // Derived
  profitPrice: number;
  profitPercent: number;
  maxGainPercent: number; // Max profit potential reached
  maxLossPercent: number; // Max loss potential reached
  
  barsTillTarget: number | null; // Bars until target hit (null if never)
  barsTillStop: number | null;   // Bars until stop hit (null if never)
  
  // Classification
  won: boolean; // Hit target before stop
  lost: boolean;
  incomplete: boolean; // Didn't hit either within window
}

/**
 * Regime performance statistics
 */
export interface RegimePerformance {
  regime: FlowRegime;
  signalCount: number;
  wins: number;
  losses: number;
  incompletes: number;
  
  winRate: number; // wins / (wins + losses)
  avgProfit: number;
  avgLoss: number;
  profitFactor: number; // (wins * avgProfit) / (losses * avgLoss)
  
  sharpeRatio: number;
  maxDrawdown: number;
  recoveryFactor: number; // Total profit / max drawdown
  
  maxWin: number;
  maxLoss: number;
}

/**
 * VFMD Validation Report
 * Answers: "Do the three core assumptions hold?"
 */
export interface VFMDValidationReport {
  // Assumption 1: PEG spikes before breakouts
  pegValidation: {
    pegSpikesDetected: number;
    spikesFollowedByMove: number; // Hit target
    falsePositiveRate: number;
    avgLeadTime: number; // Bars from PEG spike to move
    pegMoveCorrelation: number;
    verdict: 'VALID' | 'QUESTIONABLE' | 'INVALID';
  };
  
  // Assumption 2: TI identifies chop
  tiValidation: {
    chopDetected: number; // TI > 2.0
    actuallyChoppy: number; // TI > 2.0 AND had no trend
    chopAccuracy: number;
    falsePositiveRate: number; // TI > 2.0 but market trended
    verdict: 'VALID' | 'QUESTIONABLE' | 'INVALID';
  };
  
  // Assumption 3: Regime classifier accuracy
  regimeValidation: {
    regimePerformance: Record<FlowRegime, RegimePerformance>;
    bestPerformingRegime: FlowRegime;
    worstPerformingRegime: FlowRegime;
    overallWinRate: number;
    overallSharpe: number;
    verdict: 'VALID' | 'QUESTIONABLE' | 'INVALID';
  };
  
  // Summary
  summary: {
    backtestPeriod: { start: Date; end: Date };
    totalSignals: number;
    totalTrades: number;
    confidence: number; // 0-10 scale
    mainIssues: string[];
    recommendations: string[];
  };
}

/**
 * Backtest Validator - Main Harness
 * Replays agent on historical data and measures actual outcomes
 */
export class VFMDBacktestValidator {
  private fieldConstructor: FieldConstructor;
  private outcomes: TradeOutcome[] = [];

  constructor() {
    this.fieldConstructor = new FieldConstructor(50, 100);
  }

  /**
   * Validate assumptions on a dataset
   * Returns: Did the three core assumptions actually hold?
   */
  validateAssumptions(ticks: MarketTick[], asset?: string): VFMDValidationReport {
    if (ticks.length < 200) {
      throw new Error('Need at least 200 bars for validation');
    }

    // Phase 1: Generate signals and outcomes
    const signals = this.generateSignalsOnHistory(ticks, asset);
    const outcomes = this.computeOutcomes(ticks, signals);
    this.outcomes = outcomes;

    // Phase 2: Validate each assumption
    const pegValidation = this.validatePEGAssumption(ticks, outcomes);
    const tiValidation = this.validateTIAssumption(ticks, outcomes);
    const regimeValidation = this.validateRegimeAssumption(outcomes);

    // Phase 3: Generate report
    return this.generateReport(pegValidation, tiValidation, regimeValidation, ticks);
  }

  /**
   * Generate signals on historical data (replay agent)
   */
  private generateSignalsOnHistory(
    ticks: MarketTick[],
    asset?: string
  ): Array<{
    barIndex: number;
    metrics: PhysicsMetrics;
    regime: FlowRegime;
    confidence: number;
    target: number;
    stop: number;
  }> {
    const signals = [];

    // Process in 100-bar windows (like the agent does)
    for (let i = 100; i < ticks.length; i += 10) {
      // Don't look forward past the data
      if (i + 50 > ticks.length) break;

      const windowTicks = ticks.slice(i - 100, i);
      const prices = windowTicks.map(t => t.close);

      try {
        const field = this.fieldConstructor.constructField(prices);
        const metrics = PhysicsCalculator.computeAllMetrics(field);
        const regime = RegimeClassifier.classify(metrics, asset);
        const confidence = RegimeClassifier.getRegimeConfidence(metrics, asset);

        // Simplified target/stop (using ATR)
        const returns = prices.slice(1).map((p, i) => Math.abs(p - prices[i]) / prices[i]);
        const avgMove = returns.reduce((a, b) => a + b, 0) / returns.length;
        const currentPrice = prices[prices.length - 1];

        const config = RegimeClassifier.getRegimeConfig(regime);

        signals.push({
          barIndex: i,
          metrics,
          regime,
          confidence,
          target: currentPrice + currentPrice * avgMove * 2 * config.profitTargetMultiplier,
          stop: currentPrice - currentPrice * avgMove * 0.7
        });
      } catch (err) {
        // Skip bars where analysis fails
        continue;
      }
    }

    return signals;
  }

  /**
   * Compute outcomes: did each signal actually work?
   */
  private computeOutcomes(
    ticks: MarketTick[],
    signals: Array<{
      barIndex: number;
      metrics: PhysicsMetrics;
      regime: FlowRegime;
      confidence: number;
      target: number;
      stop: number;
    }>
  ): TradeOutcome[] {
    const outcomes: TradeOutcome[] = [];

    for (const signal of signals) {
      // Look 50 bars ahead for outcome
      const lookAheadBars = Math.min(50, ticks.length - signal.barIndex - 1);
      const futureTicks = ticks.slice(signal.barIndex, signal.barIndex + lookAheadBars);

      if (futureTicks.length < 5) continue;

      const entryPrice = futureTicks[0].close;
      const prices = futureTicks.map(t => t.close);

      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);

      const hitTarget = maxPrice >= signal.target;
      const hitStop = minPrice <= signal.stop;

      // Determine exit
      let exitPrice = prices[prices.length - 1]; // Default: close of window
      let barsTillTarget: number | null = null;
      let barsTillStop: number | null = null;

      for (let i = 0; i < prices.length; i++) {
        if (hitTarget && barsTillTarget === null && prices[i] >= signal.target) {
          barsTillTarget = i;
          exitPrice = signal.target;
          break;
        }
        if (hitStop && barsTillStop === null && prices[i] <= signal.stop) {
          barsTillStop = i;
          exitPrice = signal.stop;
          break;
        }
      }

      const profitPrice = exitPrice - entryPrice;
      const profitPercent = profitPrice / entryPrice;
      const maxGainPercent = (maxPrice - entryPrice) / entryPrice;
      const maxLossPercent = (minPrice - entryPrice) / entryPrice;

      outcomes.push({
        signalPrice: entryPrice,
        signalRegime: signal.regime,
        signalConfidence: signal.confidence,
        suggestedTarget: signal.target,
        suggestedStop: signal.stop,

        entryPrice,
        hitTarget,
        hitStop,
        actualMax: maxPrice,
        actualMin: minPrice,

        profitPrice,
        profitPercent,
        maxGainPercent,
        maxLossPercent,

        barsTillTarget,
        barsTillStop,

        won: hitTarget && (!hitStop || barsTillTarget! < barsTillStop!),
        lost: hitStop && (!hitTarget || barsTillStop! < barsTillTarget!),
        incomplete: !hitTarget && !hitStop
      });
    }

    return outcomes;
  }

  /**
   * ASSUMPTION 1: Does PEG actually spike before breakouts?
   */
  private validatePEGAssumption(
    ticks: MarketTick[],
    outcomes: TradeOutcome[]
  ): VFMDValidationReport['pegValidation'] {
    // Find PEG spikes in winning trades
    let pegSpikesDetected = 0;
    let spikesFollowedByMove = 0;
    let totalLeadTime = 0;

    // Group outcomes by regime
    const breakoutTransitionOutcomes = outcomes.filter(
      o => o.signalRegime === FlowRegime.BREAKOUT_TRANSITION
    );

    if (breakoutTransitionOutcomes.length === 0) {
      return {
        pegSpikesDetected: 0,
        spikesFollowedByMove: 0,
        falsePositiveRate: 0,
        avgLeadTime: 0,
        pegMoveCorrelation: 0,
        verdict: 'QUESTIONABLE' // Not enough data
      };
    }

    // BREAKOUT_TRANSITION regime = PEG spike (by definition)
    pegSpikesDetected = breakoutTransitionOutcomes.length;
    spikesFollowedByMove = breakoutTransitionOutcomes.filter(o => o.won).length;

    // Calculate lead time
    const leadTimes = breakoutTransitionOutcomes
      .filter(o => o.barsTillTarget !== null)
      .map(o => o.barsTillTarget!);

    totalLeadTime = leadTimes.length > 0 ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : 0;

    // False positive rate
    const falsePositiveRate = 1 - spikesFollowedByMove / pegSpikesDetected;

    // Correlation: PEG (confidence) vs actual profit
    const confidenceVsProfits = breakoutTransitionOutcomes.map(o => ({
      confidence: o.signalConfidence,
      profit: o.profitPercent
    }));

    const correlation = this.calculateCorrelation(
      confidenceVsProfits.map(x => x.confidence),
      confidenceVsProfits.map(x => x.profit)
    );

    const verdict =
      spikesFollowedByMove / pegSpikesDetected > 0.55 && falsePositiveRate < 0.45
        ? 'VALID'
        : falsePositiveRate > 0.6
          ? 'INVALID'
          : 'QUESTIONABLE';

    return {
      pegSpikesDetected,
      spikesFollowedByMove,
      falsePositiveRate,
      avgLeadTime: totalLeadTime,
      pegMoveCorrelation: correlation,
      verdict
    };
  }

  /**
   * ASSUMPTION 2: Does TI correctly identify choppy vs trending?
   */
  private validateTIAssumption(
    ticks: MarketTick[],
    outcomes: TradeOutcome[]
  ): VFMDValidationReport['tiValidation'] {
    // Outcomes in TURBULENT_CHOP regime should have low win rate
    const choppyOutcomes = outcomes.filter(o => o.signalRegime === FlowRegime.TURBULENT_CHOP);

    if (choppyOutcomes.length === 0) {
      return {
        chopDetected: 0,
        actuallyChoppy: 0,
        chopAccuracy: 0,
        falsePositiveRate: 0,
        verdict: 'QUESTIONABLE'
      };
    }

    const chopDetected = choppyOutcomes.length;
    const actuallyChoppy = choppyOutcomes.filter(o => o.incomplete).length;
    const chopAccuracy = actuallyChoppy / chopDetected;

    // False positive: TI says choppy but market actually trended
    const falsePositives = choppyOutcomes.filter(o => o.won).length;
    const falsePositiveRate = falsePositives / chopDetected;

    const verdict =
      chopAccuracy > 0.7 && falsePositiveRate < 0.15
        ? 'VALID'
        : falsePositiveRate > 0.4
          ? 'INVALID'
          : 'QUESTIONABLE';

    return {
      chopDetected,
      actuallyChoppy,
      chopAccuracy,
      falsePositiveRate,
      verdict
    };
  }

  /**
   * ASSUMPTION 3: Does regime classifier improve trading results?
   */
  private validateRegimeAssumption(outcomes: TradeOutcome[]): VFMDValidationReport['regimeValidation'] {
    const regimePerformance: Record<FlowRegime, RegimePerformance> = {} as any;

    // Calculate performance for each regime
    for (const regime of Object.values(FlowRegime)) {
      const regimeOutcomes = outcomes.filter(o => o.signalRegime === regime);

      if (regimeOutcomes.length === 0) {
        continue;
      }

      const wins = regimeOutcomes.filter(o => o.won).length;
      const losses = regimeOutcomes.filter(o => o.lost).length;
      const incompletes = regimeOutcomes.filter(o => o.incomplete).length;

      const winRate = wins + losses > 0 ? wins / (wins + losses) : 0;
      const avgProfit = wins > 0 ? regimeOutcomes.filter(o => o.won).reduce((sum, o) => sum + o.profitPercent, 0) / wins : 0;
      const avgLoss = losses > 0 ? regimeOutcomes.filter(o => o.lost).reduce((sum, o) => sum + o.profitPercent, 0) / losses : 0;

      const profitFactor = avgLoss !== 0 ? (wins * avgProfit) / (Math.abs(losses * avgLoss)) : wins * avgProfit;

      // Calculate Sharpe (simplified)
      const returns = regimeOutcomes.map(o => o.profitPercent);
      const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
      const stdDev = Math.sqrt(variance);
      const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0; // Annualized

      // Max drawdown
      let maxDrawdown = 0;
      let runningMax = 0;
      for (const outcome of regimeOutcomes) {
        runningMax = Math.max(runningMax, outcome.profitPercent);
        maxDrawdown = Math.min(maxDrawdown, outcome.profitPercent - runningMax);
      }

      const recoveryFactor = maxDrawdown !== 0 ? (wins * avgProfit + losses * avgLoss) / Math.abs(maxDrawdown) : 0;

      const maxWin = Math.max(...regimeOutcomes.map(o => o.profitPercent));
      const maxLoss = Math.min(...regimeOutcomes.map(o => o.profitPercent));

      regimePerformance[regime] = {
        regime,
        signalCount: regimeOutcomes.length,
        wins,
        losses,
        incompletes,
        winRate,
        avgProfit,
        avgLoss,
        profitFactor,
        sharpeRatio,
        maxDrawdown: Math.abs(maxDrawdown),
        recoveryFactor,
        maxWin,
        maxLoss
      };
    }

    const regimeEntries = Object.entries(regimePerformance);
    let bestRegime: FlowRegime = Object.keys(regimePerformance)[0] as FlowRegime;
    let bestWinRate = 0;
    
    for (const [regime, perf] of regimeEntries) {
      if (perf.winRate > bestWinRate) {
        bestWinRate = perf.winRate;
        bestRegime = regime as FlowRegime;
      }
    }

    let worstRegime: FlowRegime = Object.keys(regimePerformance)[0] as FlowRegime;
    let worstWinRate = 1;
    
    for (const [regime, perf] of regimeEntries) {
      if (perf.winRate < worstWinRate) {
        worstWinRate = perf.winRate;
        worstRegime = regime as FlowRegime;
      }
    }

    const totalOutcomes = outcomes.length;
    const totalWins = outcomes.filter(o => o.won).length;
    const totalLosses = outcomes.filter(o => o.lost).length;
    const overallWinRate = totalWins + totalLosses > 0 ? totalWins / (totalWins + totalLosses) : 0;

    // Overall Sharpe
    const allReturns = outcomes.map(o => o.profitPercent);
    const meanReturn = allReturns.reduce((a, b) => a + b, 0) / allReturns.length;
    const variance = allReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / allReturns.length;
    const stdDev = Math.sqrt(variance);
    const overallSharpe = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0;

    return {
      regimePerformance,
      bestPerformingRegime: bestRegime,
      worstPerformingRegime: worstRegime,
      overallWinRate,
      overallSharpe,
      verdict: overallWinRate > 0.52 ? 'VALID' : overallWinRate > 0.48 ? 'QUESTIONABLE' : 'INVALID'
    };
  }

  /**
   * Generate final validation report
   */
  private generateReport(
    pegValidation: VFMDValidationReport['pegValidation'],
    tiValidation: VFMDValidationReport['tiValidation'],
    regimeValidation: VFMDValidationReport['regimeValidation'],
    ticks: MarketTick[]
  ): VFMDValidationReport {
    const startDate = new Date(ticks[0].timestamp);
    const endDate = new Date(ticks[ticks.length - 1].timestamp);

    // Calculate overall confidence
    const verdicts = [pegValidation.verdict, tiValidation.verdict, regimeValidation.verdict];
    const validCount = verdicts.filter(v => v === 'VALID').length;
    const invalidCount = verdicts.filter(v => v === 'INVALID').length;
    const confidence = validCount * 3 - invalidCount * 3; // 0-10 scale

    const mainIssues: string[] = [];
    if (pegValidation.verdict !== 'VALID') {
      mainIssues.push(
        `PEG assumption questionable: ${(pegValidation.falsePositiveRate * 100).toFixed(0)}% false positive rate`
      );
    }
    if (tiValidation.verdict !== 'VALID') {
      mainIssues.push(`TI threshold may be miscalibrated: ${(tiValidation.falsePositiveRate * 100).toFixed(0)}% false positives`);
    }
    if (regimeValidation.verdict !== 'VALID') {
      mainIssues.push(`Regime classification needs tuning: ${(regimeValidation.overallWinRate * 100).toFixed(0)}% win rate`);
    }

    const recommendations: string[] = [];
    if (pegValidation.falsePositiveRate > 0.45) {
      recommendations.push('Increase PEG threshold or add confirmation filters');
    }
    if (tiValidation.falsePositiveRate > 0.4) {
      recommendations.push('Adjust TI threshold or use dynamic threshold per asset');
    }
    if (regimeValidation.overallWinRate < 0.52) {
      recommendations.push('Optimize regime thresholds using grid search');
    }

    return {
      pegValidation,
      tiValidation,
      regimeValidation,
      summary: {
        backtestPeriod: { start: startDate, end: endDate },
        totalSignals: this.outcomes.length,
        totalTrades: this.outcomes.filter(o => o.won || o.lost).length,
        confidence: Math.max(0, Math.min(10, confidence)),
        mainIssues,
        recommendations
      }
    };
  }

  /**
   * Calculate Pearson correlation between two arrays
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const meanX = x.reduce((a, b) => a + b, 0) / x.length;
    const meanY = y.reduce((a, b) => a + b, 0) / y.length;

    let numerator = 0;
    let denominatorX = 0;
    let denominatorY = 0;

    for (let i = 0; i < x.length; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denominatorX += dx * dx;
      denominatorY += dy * dy;
    }

    const denominator = Math.sqrt(denominatorX * denominatorY);
    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * Get outcomes (for testing)
   */
  getOutcomes(): TradeOutcome[] {
    return this.outcomes;
  }

  /**
   * Get performance metrics
   */
  getPerformanceByRegime(regime: FlowRegime): RegimePerformance | null {
    const regimeOutcomes = this.outcomes.filter(o => o.signalRegime === regime);
    if (regimeOutcomes.length === 0) return null;

    const wins = regimeOutcomes.filter(o => o.won).length;
    const losses = regimeOutcomes.filter(o => o.lost).length;
    const incompletes = regimeOutcomes.filter(o => o.incomplete).length;

    const winRate = wins + losses > 0 ? wins / (wins + losses) : 0;
    const avgProfit = wins > 0 ? regimeOutcomes.filter(o => o.won).reduce((sum, o) => sum + o.profitPercent, 0) / wins : 0;
    const avgLoss = losses > 0 ? regimeOutcomes.filter(o => o.lost).reduce((sum, o) => sum + o.profitPercent, 0) / losses : 0;

    const profitFactor = avgLoss !== 0 ? (wins * avgProfit) / (Math.abs(losses * avgLoss)) : wins * avgProfit;

    const returns = regimeOutcomes.map(o => o.profitPercent);
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0;

    let maxDrawdown = 0;
    let runningMax = 0;
    for (const outcome of regimeOutcomes) {
      runningMax = Math.max(runningMax, outcome.profitPercent);
      maxDrawdown = Math.min(maxDrawdown, outcome.profitPercent - runningMax);
    }

    return {
      regime,
      signalCount: regimeOutcomes.length,
      wins,
      losses,
      incompletes,
      winRate,
      avgProfit,
      avgLoss,
      profitFactor,
      sharpeRatio,
      maxDrawdown: Math.abs(maxDrawdown),
      recoveryFactor: maxDrawdown !== 0 ? (wins * avgProfit + losses * avgLoss) / Math.abs(maxDrawdown) : 0,
      maxWin: Math.max(...regimeOutcomes.map(o => o.profitPercent)),
      maxLoss: Math.min(...regimeOutcomes.map(o => o.profitPercent))
    };
  }
}

export default VFMDBacktestValidator;
