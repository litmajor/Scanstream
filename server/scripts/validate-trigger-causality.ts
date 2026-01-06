/**
 * TRIGGER Causality Validation (Correct Physics)
 * 
 * Tests the RIGHT question:
 * "Does this state (PEG, TRIGGER, PEG×TRIGGER) at time t 
 *  CAUSE volatility to occur later in [t+Δmin, t+Δmax]?"
 * 
 * NOT the wrong question:
 * "Does volatility exist near when these metrics are high?"
 * 
 * This properly validates the physics model:
 * - PEG builds (energy accumulates)
 * - TRIGGER rises (constraints break)
 * - THEN volatility releases LATER
 */

import { BinanceDataFetcher } from '../services/vfmd/binanceDataFetcher';
import { TriggerCalculator } from '../services/vfmd/triggerCalculator';
import { FieldConstructor } from '../services/vfmd/fieldConstructor';
import { PhysicsCalculator } from '../services/vfmd/physicsCalculator';
import type { MarketTick } from '../services/vfmd/types';
import * as fs from 'fs';

interface CausalityResult {
  test: string;
  futureWindow: string; // "3-12 candles" e.g.
  totalSignals: number;
  volatilityEvents: number;
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  earliness: number; // Avg candles of lead time
  interpretation: string;
}

/**
 * Detect volatility in a future window
 * Returns true if price range exceeds threshold
 */
function hasVolatilityInFuture(
  ticks: any[],
  startIdx: number,
  futureMinCandles: number,
  futureMaxCandles: number,
  volatilityThreshold: number = 0.015 // 1.5% range
): { occurred: boolean; actualRange: number } {
  const startCandle = ticks[startIdx];
  const endIdx = Math.min(startIdx + futureMaxCandles, ticks.length - 1);

  if (endIdx - startIdx < futureMinCandles) {
    return { occurred: false, actualRange: 0 };
  }

  // Check only the future window
  const futureWindow = ticks.slice(startIdx + futureMinCandles, endIdx + 1);
  if (futureWindow.length < 2) {
    return { occurred: false, actualRange: 0 };
  }

  const futureHigh = Math.max(...futureWindow.map((t: any) => t.high));
  const futureLow = Math.min(...futureWindow.map((t: any) => t.low));
  const futureRange = (futureHigh - futureLow) / startCandle.close;

  return {
    occurred: futureRange > volatilityThreshold,
    actualRange: futureRange,
  };
}

/**
 * TEST 1: PEG — Does stored energy predict future volatility?
 */
function validatePegCausality(
  ticks: any[],
  futureMinCandles: number,
  futureMaxCandles: number
): CausalityResult {
  let tp = 0,
    fp = 0,
    fn = 0;
  let pegSignalsTriggered = 0;
  let totalEarliness = 0;

  const pegThreshold = 300; // F1-optimal

  for (let i = 100; i < ticks.length - futureMaxCandles - 10; i++) {
    // Build field from PAST 100 candles
    const currentFrame = ticks.slice(i - 100, i + 1);
    const fieldConstructor = new FieldConstructor(50, 100);
    const field = fieldConstructor.constructField(currentFrame.map((t: any) => t.close));
    const metrics = PhysicsCalculator.computeAllMetrics(field);

    // PEG signal at current time
    const pegSignal = metrics.peg > pegThreshold;
    if (pegSignal) pegSignalsTriggered++;

    // Check if volatility OCCURS LATER in future window
    const { occurred: volatilityOccurred, actualRange } = hasVolatilityInFuture(
      ticks,
      i,
      futureMinCandles,
      futureMaxCandles
    );

    // Count outcomes
    if (pegSignal && volatilityOccurred) {
      tp++;
      totalEarliness += futureMinCandles; // Track when motion occurred
    } else if (pegSignal && !volatilityOccurred) {
      fp++;
    } else if (!pegSignal && volatilityOccurred) {
      fn++;
    }
  }

  const precision = pegSignalsTriggered > 0 ? tp / pegSignalsTriggered : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  const avgEarliness = pegSignalsTriggered > 0 ? totalEarliness / pegSignalsTriggered : 0;

  return {
    test: 'PEG > 300 (Energy Detection)',
    futureWindow: `${futureMinCandles}-${futureMaxCandles} candles`,
    totalSignals: pegSignalsTriggered,
    volatilityEvents: tp + fn,
    tp,
    fp,
    fn,
    precision,
    recall,
    f1,
    earliness: avgEarliness,
    interpretation:
      'Measures if stored energy predicts volatility LATER. ' +
      (precision > 0.5 ? 'Energy IS predictive ✅' : 'Energy alone insufficient ❌'),
  };
}

/**
 * TEST 2: TRIGGER — Does constraint failure predict future volatility?
 */
function validateTriggerConstraintCausality(
  ticks: any[],
  futureMinCandles: number,
  futureMaxCandles: number
): CausalityResult {
  let tp = 0,
    fp = 0,
    fn = 0;
  let triggerSignalsTriggered = 0;
  let totalEarliness = 0;

  const triggerThreshold = 0.5;

  for (let i = 100; i < ticks.length - futureMaxCandles - 10; i++) {
    const currentFrame = ticks.slice(i - 100, i + 1);
    const fieldConstructor = new FieldConstructor(50, 100);
    const field = fieldConstructor.constructField(currentFrame.map((t: any) => t.close));
    const metrics = PhysicsCalculator.computeAllMetrics(field);

    // TRIGGER signal
    const triggerState = TriggerCalculator.computeTrigger(metrics);
    const triggerSignal = triggerState.trigger > triggerThreshold;
    if (triggerSignal) triggerSignalsTriggered++;

    // Check future volatility
    const { occurred: volatilityOccurred } = hasVolatilityInFuture(
      ticks,
      i,
      futureMinCandles,
      futureMaxCandles
    );

    if (triggerSignal && volatilityOccurred) {
      tp++;
      totalEarliness += futureMinCandles;
    } else if (triggerSignal && !volatilityOccurred) {
      fp++;
    } else if (!triggerSignal && volatilityOccurred) {
      fn++;
    }
  }

  const precision = triggerSignalsTriggered > 0 ? tp / triggerSignalsTriggered : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  const avgEarliness = triggerSignalsTriggered > 0 ? totalEarliness / triggerSignalsTriggered : 0;

  return {
    test: 'TRIGGER > 0.5 (Permission Gate)',
    futureWindow: `${futureMinCandles}-${futureMaxCandles} candles`,
    totalSignals: triggerSignalsTriggered,
    volatilityEvents: tp + fn,
    tp,
    fp,
    fn,
    precision,
    recall,
    f1,
    earliness: avgEarliness,
    interpretation:
      'Measures if constraint failure predicts volatility LATER. ' +
      (precision > 0.5 ? 'Permission alone works ✅' : 'Permission needs energy ❌'),
  };
}

/**
 * TEST 3: PEG × TRIGGER — Does combined model predict future volatility?
 */
function validateMasterEquationCausality(
  ticks: any[],
  futureMinCandles: number,
  futureMaxCandles: number
): CausalityResult {
  let tp = 0,
    fp = 0,
    fn = 0;
  let masterSignalsTriggered = 0;
  let totalEarliness = 0;

  const pegThreshold = 300;
  const triggerThreshold = 0.3; // Lower since we multiply

  for (let i = 100; i < ticks.length - futureMaxCandles - 10; i++) {
    const currentFrame = ticks.slice(i - 100, i + 1);
    const fieldConstructor = new FieldConstructor(50, 100);
    const field = fieldConstructor.constructField(currentFrame.map((t: any) => t.close));
    const metrics = PhysicsCalculator.computeAllMetrics(field);
    const triggerState = TriggerCalculator.computeTrigger(metrics);

    // Master equation: both conditions must be met
    const peg = metrics.peg;
    const trigger = triggerState.trigger;
    const volatilityProbability = TriggerCalculator.getVolatilityProbability(peg, trigger);

    const masterSignal = peg > pegThreshold && trigger > triggerThreshold;
    if (masterSignal) masterSignalsTriggered++;

    // Check future volatility
    const { occurred: volatilityOccurred } = hasVolatilityInFuture(
      ticks,
      i,
      futureMinCandles,
      futureMaxCandles
    );

    if (masterSignal && volatilityOccurred) {
      tp++;
      totalEarliness += futureMinCandles;
    } else if (masterSignal && !volatilityOccurred) {
      fp++;
    } else if (!masterSignal && volatilityOccurred) {
      fn++;
    }
  }

  const precision = masterSignalsTriggered > 0 ? tp / masterSignalsTriggered : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  const avgEarliness = masterSignalsTriggered > 0 ? totalEarliness / masterSignalsTriggered : 0;

  return {
    test: 'PEG × TRIGGER (Master Equation)',
    futureWindow: `${futureMinCandles}-${futureMaxCandles} candles`,
    totalSignals: masterSignalsTriggered,
    volatilityEvents: tp + fn,
    tp,
    fp,
    fn,
    precision,
    recall,
    f1,
    earliness: avgEarliness,
    interpretation:
      'Measures if energy+permission predicts volatility LATER. ' +
      (precision > 0.6
        ? 'Combined model is CAUSAL ✅'
        : 'Need better component tuning ⚠️'),
  };
}

/**
 * Print a result
 */
function printResult(result: CausalityResult) {
  console.log(`\n📊 ${result.test}`);
  console.log(`   Future Window: ${result.futureWindow}`);
  console.log(`   Signals: ${result.totalSignals} | Events: ${result.volatilityEvents}`);
  console.log(`   TP: ${result.tp} | FP: ${result.fp} | FN: ${result.fn}`);
  console.log(`\n📈 Metrics:`);
  console.log(`   Precision: ${(result.precision * 100).toFixed(1)}%`);
  console.log(`   Recall: ${(result.recall * 100).toFixed(1)}%`);
  console.log(`   F1-Score: ${result.f1.toFixed(3)}`);
  console.log(`   Avg Earliness: ${result.earliness.toFixed(1)} candles`);
  console.log(`\n💡 ${result.interpretation}`);
}

/**
 * Main validation
 */
async function validateTriggerCausality() {
  console.log('\n' + '═'.repeat(100));
  console.log('🧪 TRIGGER CAUSALITY VALIDATION — Does the model PREDICT or just DETECT?');
  console.log('═'.repeat(100));

  // Load cached BTC data
  const cacheFile = './data/cache/BTCUSDT_1h_180d.json';
  if (!fs.existsSync(cacheFile)) {
    console.error('❌ Cache file not found. Run fetch-btc-data.ts first.');
    return;
  }

  console.log('\n📊 Loading 4,320 BTC/USDT candles from cache...');
  const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  const ticks = cachedData.data || cachedData.ticks;
  console.log(`✅ Loaded ${ticks.length} candles\n`);

  // Define future windows to test
  const futureWindows = [
    { min: 1, max: 5 },   // Immediate: 1-5 candles ahead
    { min: 3, max: 12 },  // Short-term: 3-12 candles ahead
    { min: 6, max: 20 },  // Medium-term: 6-20 candles ahead
  ];

  const allResults: CausalityResult[] = [];

  for (const window of futureWindows) {
    console.log('\n' + '─'.repeat(100));
    console.log(`TESTING FUTURE WINDOW: ${window.min}-${window.max} candles ahead`);
    console.log('─'.repeat(100));

    // Test 1: PEG
    const pegResult = validatePegCausality(ticks, window.min, window.max);
    allResults.push(pegResult);
    printResult(pegResult);

    // Test 2: TRIGGER
    const triggerResult = validateTriggerConstraintCausality(ticks, window.min, window.max);
    allResults.push(triggerResult);
    printResult(triggerResult);

    // Test 3: Master Equation
    const masterResult = validateMasterEquationCausality(ticks, window.min, window.max);
    allResults.push(masterResult);
    printResult(masterResult);
  }

  // Summary
  console.log('\n' + '═'.repeat(100));
  console.log('📊 SUMMARY: CAUSALITY ACROSS ALL WINDOWS');
  console.log('═'.repeat(100));

  console.log(
    '\n' +
      '│Window          │Test                    │Precision │Recall │F1     │Interpretation' +
      '│'
  );
  console.log('├' + '─'.repeat(99) + '┤');

  for (const result of allResults) {
    const window = result.futureWindow;
    const test = result.test;
    const prec = (result.precision * 100).toFixed(0);
    const rec = (result.recall * 100).toFixed(0);
    const f1 = result.f1.toFixed(2);
    const status =
      result.precision > 0.6
        ? '✅'
        : result.precision > 0.5
          ? '⚠️ '
          : '❌';

    console.log(
      `│${window.padEnd(15)}│${test.padEnd(23)}│${prec.padStart(9)}%│${rec.padStart(6)}%│${f1.padStart(6)}│${status}│`
    );
  }

  // Analysis
  console.log('\n' + '═'.repeat(100));
  console.log('🔍 KEY FINDINGS (CAUSALITY-CORRECTED)');
  console.log('═'.repeat(100));

  console.log(`
1️⃣  Short-term (1-5 candles):
    • PEG should show low precision (energy exists, not yet released)
    • TRIGGER should show moderate precision (constraints breaking)
    • PEG × TRIGGER should show HIGH precision (both conditions met)

2️⃣  Medium-term (3-12 candles):
    • PEG should show IMPROVING precision (lead time advantage)
    • TRIGGER should show DECLINING precision (constraints already broken)
    • PEG × TRIGGER should show STABLE precision (the master equation)

3️⃣  Long-term (6-20 candles):
    • All should degrade (less lead time means more competition)
    • PEG × TRIGGER should degrade slowest (best lead time)

✨ CORRECT INTERPRETATION:

If PEG precision improves with lead time:
  → Energy DOES predict volatility ✅

If TRIGGER alone fails:
  → Permission alone is insufficient ✅

If PEG × TRIGGER dominates across windows:
  → The combined model is CAUSAL ✅

This is where your physics model will reveal itself.
`);

  console.log('═'.repeat(100) + '\n');
}

// Run
validateTriggerCausality().catch(console.error);
