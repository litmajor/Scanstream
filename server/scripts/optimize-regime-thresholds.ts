/**
 * Regime-Specific TRIGGER & PEG Threshold Optimizer
 * 
 * Finds optimal thresholds for each regime by testing against
 * historical volatility patterns. Maximizes precision and recall
 * per regime independently.
 */

import { TriggerCalculator } from '../services/vfmd/triggerCalculator';
import { FieldConstructor } from '../services/vfmd/fieldConstructor';
import { PhysicsCalculator } from '../services/vfmd/physicsCalculator';
import * as fs from 'fs';

type FlowRegime = 'LAMINAR_TREND' | 'BREAKOUT_TRANSITION' | 'ACCUMULATION' | 'DISTRIBUTION' | 'CONSOLIDATION' | 'TURBULENT_CHOP';

interface ThresholdConfig {
  regime: FlowRegime;
  peg_threshold: number;
  trigger_threshold: number;
  precision: number;
  recall: number;
  f1_score: number;
  signal_count: number;
  volatility_events: number;
  recommended: boolean;
}

interface OptimizationResult {
  regime: FlowRegime;
  baseline_config: ThresholdConfig;
  optimal_config: ThresholdConfig;
  improvement: {
    precision_delta: number;
    recall_delta: number;
    f1_delta: number;
  };
}

/**
 * Placeholder regime analyzer for optimization
 * In practice, use RegimeClassifier for full analysis
 */
function getRegimeForOptimization(metrics: any): FlowRegime {
  // Simplified regime detection based on coherence and other metrics
  // This is good enough for threshold tuning
  if (metrics.coherenceScore > 0.7) return 'LAMINAR_TREND';
  if (metrics.turbulenceIndex > 2.0) return 'TURBULENT_CHOP';
  if (metrics.divergenceScore > 0.6) return 'BREAKOUT_TRANSITION';
  return 'CONSOLIDATION';
}

/**
 * Calculate metrics for a given threshold pair
 */
function calculateMetricsForThresholds(
  ticks: any[],
  regimeFilter: FlowRegime,
  pegThreshold: number,
  triggerThreshold: number,
  futureWindow: { min: number; max: number }
): {
  tp: number;
  fp: number;
  fn: number;
  signal_count: number;
  volatility_events: number;
} {
  let tp = 0,
    fp = 0,
    fn = 0;
  let signals = 0;
  let volatilityEvents = 0;

  for (let i = 100; i < ticks.length - futureWindow.max - 10; i++) {
    const currentFrame = ticks.slice(i - 100, i + 1);
    const fieldConstructor = new FieldConstructor(50, 100);
    const field = fieldConstructor.constructField(
      currentFrame.map((t: any) => t.close)
    );
    const metrics = PhysicsCalculator.computeAllMetrics(field);
    const regime = getRegimeForOptimization(metrics);

    // Filter by regime
    if (regime !== regimeFilter) continue;

    const triggerState = TriggerCalculator.computeTrigger(metrics);

    // Test signal
    const signal = metrics.peg > pegThreshold && triggerState.trigger > triggerThreshold;
    if (signal) signals++;

    // Check future volatility
    const startCandle = ticks[i];
    const endIdx = Math.min(i + futureWindow.max, ticks.length - 1);
    const futureWindow_actual = ticks.slice(
      i + futureWindow.min,
      endIdx + 1
    );

    if (futureWindow_actual.length >= 2) {
      const high = Math.max(...futureWindow_actual.map((t: any) => t.high));
      const low = Math.min(...futureWindow_actual.map((t: any) => t.low));
      const range = (high - low) / startCandle.close;
      const volatilityOccurred = range > 0.015;

      if (volatilityOccurred) volatilityEvents++;

      if (signal && volatilityOccurred) tp++;
      else if (signal && !volatilityOccurred) fp++;
      else if (!signal && volatilityOccurred) fn++;
    }
  }

  return { tp, fp, fn, signal_count: signals, volatility_events: volatilityEvents };
}

/**
 * Calculate precision, recall, F1
 */
function calculateMetrics(
  tp: number,
  fp: number,
  fn: number
): { precision: number; recall: number; f1: number } {
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1 };
}

/**
 * Find optimal thresholds for a regime
 */
function optimizeRegimeThresholds(
  ticks: any[],
  regime: FlowRegime,
  regimeName: string
): OptimizationResult {
  console.log(`\n🔧 Optimizing ${regimeName}...`);

  const pegRange = [150, 200, 250, 300, 350, 400, 450, 500];
  const triggerRange = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
  const futureWindow = { min: 6, max: 20 }; // Use validated window

  let bestConfig: ThresholdConfig | null = null;
  let bestF1 = 0;

  // Brute force search
  for (const pegThresh of pegRange) {
    for (const triggerThresh of triggerRange) {
      const { tp, fp, fn, signal_count, volatility_events } =
        calculateMetricsForThresholds(
          ticks,
          regime,
          pegThresh,
          triggerThresh,
          futureWindow
        );

      const { precision, recall, f1 } = calculateMetrics(tp, fp, fn);

      if (f1 > bestF1 && signal_count > 0) {
        bestF1 = f1;
        bestConfig = {
          regime,
          peg_threshold: pegThresh,
          trigger_threshold: triggerThresh,
          precision,
          recall,
          f1_score: f1,
          signal_count,
          volatility_events,
          recommended: true,
        };
      }
    }
  }

  // Baseline (original thresholds: PEG=300, TRIGGER=0.5)
  const { tp: baseTp, fp: baseFp, fn: baseFn, signal_count: baseSignals } =
    calculateMetricsForThresholds(ticks, regime, 300, 0.5, futureWindow);
  const { precision: basePrec, recall: baseRecall, f1: baseF1 } = calculateMetrics(
    baseTp,
    baseFp,
    baseFn
  );

  const baselineConfig: ThresholdConfig = {
    regime,
    peg_threshold: 300,
    trigger_threshold: 0.5,
    precision: basePrec,
    recall: baseRecall,
    f1_score: baseF1,
    signal_count: baseSignals,
    volatility_events: baseTp + baseFn,
    recommended: false,
  };

  return {
    regime,
    baseline_config: baselineConfig,
    optimal_config: bestConfig || baselineConfig,
    improvement: {
      precision_delta:
        (bestConfig?.precision || basePrec) - basePrec,
      recall_delta: (bestConfig?.recall || baseRecall) - baseRecall,
      f1_delta: (bestConfig?.f1_score || baseF1) - baseF1,
    },
  };
}

/**
 * Display results
 */
function printResults(results: OptimizationResult[]) {
  console.log('\n' + '═'.repeat(120));
  console.log(
    '📊 REGIME-SPECIFIC THRESHOLD OPTIMIZATION RESULTS (6-20 candle window)'
  );
  console.log('═'.repeat(120));

  console.log(
    '\n│ Regime                   │ PEG Threshold │ TRIGGER Threshold │ Precision │ Recall │ F1     │ Improvement │\n'
  );
  console.log('├' + '─'.repeat(119) + '┤');

  for (const result of results) {
    const regimeName = result.regime.padEnd(24);
    const pegThresh = result.optimal_config.peg_threshold.toString().padStart(13);
    const triggerThresh = result.optimal_config.trigger_threshold.toFixed(2).padStart(17);
    const precision = (result.optimal_config.precision * 100).toFixed(1).padStart(9);
    const recall = (result.optimal_config.recall * 100).toFixed(1).padStart(6);
    const f1 = result.optimal_config.f1_score.toFixed(2).padStart(6);
    const improvement =
      result.improvement.f1_delta > 0.05
        ? `+${(result.improvement.f1_delta * 100).toFixed(0)}%`
        : '→';

    console.log(
      `│ ${regimeName} │ ${pegThresh} │ ${triggerThresh} │ ${precision}% │ ${recall}% │ ${f1} │ ${improvement.padStart(11)} │`
    );
  }

  console.log('├' + '─'.repeat(119) + '┤');

  // Detailed analysis
  console.log('\n📈 DETAILED ANALYSIS:\n');

  for (const result of results) {
    console.log(`\n🔹 ${result.regime}`);
    console.log(`   Baseline (PEG=300, TRIGGER=0.5):`);
    console.log(`      Precision: ${(result.baseline_config.precision * 100).toFixed(1)}%`);
    console.log(`      Recall:    ${(result.baseline_config.recall * 100).toFixed(1)}%`);
    console.log(`      F1:        ${result.baseline_config.f1_score.toFixed(3)}`);
    console.log(`      Signals:   ${result.baseline_config.signal_count}`);

    console.log(`\n   Optimized (PEG=${result.optimal_config.peg_threshold}, TRIGGER=${result.optimal_config.trigger_threshold.toFixed(2)}):`);
    console.log(`      Precision: ${(result.optimal_config.precision * 100).toFixed(1)}%`);
    console.log(`      Recall:    ${(result.optimal_config.recall * 100).toFixed(1)}%`);
    console.log(`      F1:        ${result.optimal_config.f1_score.toFixed(3)}`);
    console.log(`      Signals:   ${result.optimal_config.signal_count}`);

    if (result.improvement.f1_delta > 0.05) {
      const precisionSign = result.improvement.precision_delta >= 0 ? '+' : '';
      const recallSign = result.improvement.recall_delta >= 0 ? '+' : '';
      console.log(
        `\n   ✅ IMPROVEMENT: F1 +${(result.improvement.f1_delta * 100).toFixed(0)}% ` +
          `(Precision ${precisionSign}${(result.improvement.precision_delta * 100).toFixed(1)}%, ` +
          `Recall ${recallSign}${(result.improvement.recall_delta * 100).toFixed(1)}%)`
      );
    } else {
      console.log(`\n   → No significant improvement from baseline`);
    }
  }

  // Generate config file
  console.log('\n' + '═'.repeat(120));
  console.log('💾 GENERATED CONFIGURATION:\n');

  const config: Record<string, { peg: number; trigger: number }> = {};
  for (const result of results) {
    config[result.regime] = {
      peg: result.optimal_config.peg_threshold,
      trigger: result.optimal_config.trigger_threshold,
    };
  }

  console.log('Export to triggerCalculator.ts:');
  console.log('\nstatic getRegimeAdjustedThresholds(regime: FlowRegime): { peg: number; trigger: number } {');
  console.log('  const thresholds: Record<FlowRegime, { peg: number; trigger: number }> = {');
  for (const [regime, thresholds] of Object.entries(config)) {
    console.log(`    [FlowRegime.${regime}]: { peg: ${thresholds.peg}, trigger: ${thresholds.trigger.toFixed(2)} },`);
  }
  console.log('  };');
  console.log('  return thresholds[regime];');
  console.log('}');
}

/**
 * Main
 */
async function optimizeThresholds() {
  const cacheFile = './data/cache/BTCUSDT_1h_180d.json';
  if (!fs.existsSync(cacheFile)) {
    console.error('❌ Cache file not found. Run fetch-btc-data.ts first.');
    return;
  }

  console.log('\n📊 Loading 4,320 BTC/USDT candles...');
  const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  const ticks = cachedData.data || cachedData.ticks;
  console.log(`✅ Loaded ${ticks.length} candles\n`);

  // Regimes to optimize
  const regimes: [FlowRegime, string][] = [
    ['LAMINAR_TREND' as FlowRegime, 'Laminar Trend'],
    ['BREAKOUT_TRANSITION' as FlowRegime, 'Breakout Transition'],
    ['ACCUMULATION' as FlowRegime, 'Accumulation'],
    ['DISTRIBUTION' as FlowRegime, 'Distribution'],
    ['CONSOLIDATION' as FlowRegime, 'Consolidation'],
    ['TURBULENT_CHOP' as FlowRegime, 'Turbulent Chop'],
  ];

  const results: OptimizationResult[] = [];
  for (const [regime, name] of regimes) {
    const result = optimizeRegimeThresholds(ticks, regime, name);
    results.push(result);
  }

  printResults(results);
}

// Run
optimizeThresholds().catch(console.error);
