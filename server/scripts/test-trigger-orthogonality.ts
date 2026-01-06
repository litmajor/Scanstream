/**
 * TRIGGER Orthogonality Test (Measurement Independence)
 * 
 * Tests whether TRIGGER is truly independent from PEG
 * by looking at conditional probabilities and signal correlation.
 * 
 * The question: Does TRIGGER add information beyond PEG?
 * Or is it just a noisy copy of the same underlying signal?
 */

import { TriggerCalculator } from '../services/vfmd/triggerCalculator';
import { FieldConstructor } from '../services/vfmd/fieldConstructor';
import { PhysicsCalculator } from '../services/vfmd/physicsCalculator';
import * as fs from 'fs';

interface IndependenceMetrics {
  // Signal counts
  peg_signals: number;
  trigger_signals: number;
  concurrent_signals: number; // Both fire at same candle
  exclusive_peg: number; // PEG only
  exclusive_trigger: number; // TRIGGER only
  neither: number;

  // Correlation analysis
  correlation_coefficient: number; // Pearson correlation
  mutual_information: number; // Information theory measure
  jaccard_similarity: number; // Set overlap

  // Conditional probabilities
  p_trigger_given_peg: number; // P(TRIGGER | PEG)
  p_trigger_given_not_peg: number; // P(TRIGGER | ¬PEG)
  p_peg_given_trigger: number; // P(PEG | TRIGGER)
  p_peg_given_not_trigger: number; // P(PEG | ¬TRIGGER)

  // Interpretation
  is_independent: boolean;
  independence_score: number; // 0-1, higher = more independent
  interpretation: string;
}

/**
 * Test whether TRIGGER and PEG are independent measurements
 */
function testOrthogonality(ticks: any[]): IndependenceMetrics {
  const pegThreshold = 300;
  const triggerThreshold = 0.5;

  // Collect signal history
  const pegSignals: boolean[] = [];
  const triggerSignals: boolean[] = [];
  const pegValues: number[] = [];
  const triggerValues: number[] = [];

  console.log('\n📊 Analyzing signal independence over 4,200 candles...');

  for (let i = 100; i < Math.min(ticks.length - 50, 4200); i++) {
    const currentFrame = ticks.slice(i - 100, i + 1);
    const fieldConstructor = new FieldConstructor(50, 100);
    const field = fieldConstructor.constructField(currentFrame.map((t: any) => t.close));
    const metrics = PhysicsCalculator.computeAllMetrics(field);
    const triggerState = TriggerCalculator.computeTrigger(metrics);

    // Record raw values
    pegValues.push(metrics.peg);
    triggerValues.push(triggerState.trigger);

    // Record signals
    pegSignals.push(metrics.peg > pegThreshold);
    triggerSignals.push(triggerState.trigger > triggerThreshold);
  }

  // Count signal combinations
  let peg_signals = 0;
  let trigger_signals = 0;
  let concurrent = 0;
  let exclusive_peg = 0;
  let exclusive_trigger = 0;
  let neither = 0;

  for (let i = 0; i < pegSignals.length; i++) {
    const peg = pegSignals[i];
    const trigger = triggerSignals[i];

    if (peg) peg_signals++;
    if (trigger) trigger_signals++;

    if (peg && trigger) concurrent++;
    else if (peg) exclusive_peg++;
    else if (trigger) exclusive_trigger++;
    else neither++;
  }

  // Correlation coefficient
  const pegMean = pegValues.reduce((a, b) => a + b) / pegValues.length;
  const triggerMean = triggerValues.reduce((a, b) => a + b) / triggerValues.length;

  let covariance = 0;
  let pegVariance = 0;
  let triggerVariance = 0;

  for (let i = 0; i < pegValues.length; i++) {
    const pegDev = pegValues[i] - pegMean;
    const triggerDev = triggerValues[i] - triggerMean;
    covariance += pegDev * triggerDev;
    pegVariance += pegDev * pegDev;
    triggerVariance += triggerDev * triggerDev;
  }

  covariance /= pegValues.length;
  pegVariance /= pegValues.length;
  triggerVariance /= pegValues.length;

  const correlation =
    Math.sqrt(pegVariance * triggerVariance) > 0
      ? covariance / Math.sqrt(pegVariance * triggerVariance)
      : 0;

  // Jaccard similarity (signal overlap)
  const jaccard =
    concurrent / (peg_signals + trigger_signals - concurrent || 1);

  // Conditional probabilities
  const p_trigger_given_peg = peg_signals > 0 ? concurrent / peg_signals : 0;
  const p_trigger_given_not_peg =
    exclusive_trigger > 0
      ? exclusive_trigger / (exclusive_trigger + neither)
      : 0;
  const p_peg_given_trigger =
    trigger_signals > 0 ? concurrent / trigger_signals : 0;
  const p_peg_given_not_trigger =
    exclusive_peg > 0
      ? exclusive_peg / (exclusive_peg + neither)
      : 0;

  // Independence score: how different are the conditional probabilities?
  // If independent, P(A|B) ≈ P(A) for all A, B
  // We measure deviation from independence
  const p_peg = peg_signals / pegSignals.length;
  const p_trigger = trigger_signals / triggerSignals.length;

  const independence_deviation =
    Math.abs(p_trigger_given_peg - p_trigger) +
    Math.abs(p_trigger_given_not_peg - p_trigger) +
    Math.abs(p_peg_given_trigger - p_peg) +
    Math.abs(p_peg_given_not_trigger - p_peg);

  const independence_score = Math.max(
    0,
    1 - independence_deviation / 4
  );

  // Interpretation
  const is_independent = independence_score > 0.5;

  let interpretation = '';
  if (is_independent) {
    interpretation =
      `✅ INDEPENDENT: TRIGGER and PEG measure different physics. ` +
      `Correlation ${correlation.toFixed(2)}, Jaccard ${jaccard.toFixed(2)}, ` +
      `Independence Score ${independence_score.toFixed(2)}`;
  } else {
    interpretation =
      `❌ ENTANGLED: TRIGGER is highly correlated with PEG. ` +
      `Correlation ${correlation.toFixed(2)}, Jaccard ${jaccard.toFixed(2)}, ` +
      `Independence Score ${independence_score.toFixed(2)}. ` +
      `TRIGGER is measuring ${
        p_trigger_given_peg > 0.7
          ? 'primarily the same thing as PEG'
          : 'complementary information to PEG'
      }.`;
  }

  return {
    peg_signals,
    trigger_signals,
    concurrent_signals: concurrent,
    exclusive_peg,
    exclusive_trigger,
    neither,
    correlation_coefficient: correlation,
    mutual_information: 0, // TODO: implement
    jaccard_similarity: jaccard,
    p_trigger_given_peg,
    p_trigger_given_not_peg,
    p_peg_given_trigger,
    p_peg_given_not_trigger,
    is_independent,
    independence_score,
    interpretation,
  };
}

/**
 * Display results
 */
function printOrthogonalityResults(metrics: IndependenceMetrics) {
  console.log('\n' + '═'.repeat(100));
  console.log('🔬 ORTHOGONALITY TEST: Are TRIGGER and PEG Independent Measurements?');
  console.log('═'.repeat(100));

  console.log(`\n📊 Signal Distribution:`);
  console.log(
    `   PEG-only (exclusive):    ${metrics.exclusive_peg.toString().padStart(5)} candles`
  );
  console.log(
    `   TRIGGER-only (excl):     ${metrics.exclusive_trigger.toString().padStart(5)} candles`
  );
  console.log(
    `   Both (concurrent):       ${metrics.concurrent_signals.toString().padStart(5)} candles`
  );
  console.log(`   Neither:                ${metrics.neither.toString().padStart(5)} candles`);
  console.log(`\n   Total PEG signals:      ${metrics.peg_signals}`);
  console.log(`   Total TRIGGER signals:  ${metrics.trigger_signals}`);

  console.log(`\n📈 Independence Metrics:`);
  console.log(`   Pearson Correlation:    ${metrics.correlation_coefficient.toFixed(3)}`);
  console.log(`   Jaccard Similarity:     ${metrics.jaccard_similarity.toFixed(3)}`);
  console.log(`   Independence Score:     ${metrics.independence_score.toFixed(3)}`);

  console.log(`\n🔗 Conditional Probabilities:`);
  console.log(`   P(TRIGGER | PEG):       ${(metrics.p_trigger_given_peg * 100).toFixed(1)}%`);
  console.log(`   P(TRIGGER | ¬PEG):      ${(metrics.p_trigger_given_not_peg * 100).toFixed(1)}%`);
  console.log(`   P(PEG | TRIGGER):       ${(metrics.p_peg_given_trigger * 100).toFixed(1)}%`);
  console.log(`   P(PEG | ¬TRIGGER):      ${(metrics.p_peg_given_not_trigger * 100).toFixed(1)}%`);

  console.log(`\n💡 Interpretation:`);
  console.log(`   ${metrics.interpretation}`);

  console.log('\n' + '═'.repeat(100));

  if (!metrics.is_independent) {
    console.log(
      '\n⚠️  DIAGNOSIS: TRIGGER implementation is still entangled with PEG.\n' +
        '   Next steps:\n' +
        '   1. Remove any metrics from TRIGGER that correlate with PEG directly\n' +
        '   2. Use ONLY structural/liquidity/temporal metrics (not volatility proxies)\n' +
        '   3. Re-test orthogonality\n' +
        '   4. Once independent, causality test will show true separation'
    );
  } else {
    console.log(
      '\n✅ SUCCESS: TRIGGER is independent from PEG.\n' +
        '   You now have two orthogonal layers:\n' +
        '   • PEG = Energy layer (leads motion)\n' +
        '   • TRIGGER = Permission layer (contemporaneous constraint detection)\n' +
        '   • PEG × TRIGGER = Master equation (causal prediction)'
    );
  }
}

/**
 * Main
 */
async function testTriggerOrthogonality() {
  const cacheFile = './data/cache/BTCUSDT_1h_180d.json';
  if (!fs.existsSync(cacheFile)) {
    console.error('❌ Cache file not found. Run fetch-btc-data.ts first.');
    return;
  }

  console.log('\n📊 Loading 4,320 BTC/USDT candles...');
  const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  const ticks = cachedData.data || cachedData.ticks;
  console.log(`✅ Loaded ${ticks.length} candles`);

  const metrics = testOrthogonality(ticks);
  printOrthogonalityResults(metrics);
}

// Run
testTriggerOrthogonality().catch(console.error);
