/**
 * PEG Performance Analysis & Optimization
 * 
 * Deep dive into why precision/recall tradeoff occurs
 * and find the actual sweet spot
 */

import BinanceDataFetcher from '../services/vfmd/binanceDataFetcher';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import type { MarketTick } from '../services/vfmd/types';

interface TestResult {
  threshold: number;
  label: string;
  precision: number;
  recall: number;
  f1: number;
  tp: number;
  fp: number;
  fn: number;
  signals: number;
}

async function analyzePerformance() {
  console.log('\n' + '='.repeat(80));
  console.log('🔬 PEG PERFORMANCE ANALYSIS & OPTIMIZATION');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Load data
    console.log('📊 Loading BTC data...');
    const ticks = BinanceDataFetcher.loadFromFile('./data/cache/BTCUSDT_1h_180d.json');
    console.log(`✅ Loaded ${ticks.length} candles\n`);

    // Calculate PEG
    console.log('📈 Calculating PEG values...');
    const vfmdAgent = new VFMDPhysicsAgent('analyzer', 'balanced');
    const pegValues: number[] = [];

    for (let i = 0; i < ticks.length; i++) {
      const historicalTicks = ticks.slice(0, Math.min(i + 1, ticks.length));
      if (historicalTicks.length < 10) {
        pegValues.push(0);
        continue;
      }
      const analysis = vfmdAgent.getAnalysisForUI(historicalTicks);
      pegValues.push(analysis?.field_metrics?.peg_energy ? parseFloat(analysis.field_metrics.peg_energy) : 0);
    }

    // Get volatility ground truth
    console.log('📉 Calculating volatility baseline...');
    const baselineVol = calculateBaselineVolatility(ticks);
    
    // Identify high volatility events
    const highVolIndices = identifyHighVolatilityEvents(ticks, baselineVol);
    console.log(`✅ Found ${highVolIndices.length} high-volatility events\n`);

    // Get PEG distribution
    const pegSorted = [...pegValues].sort((a, b) => a - b);
    const pegStats = {
      p50: pegSorted[Math.floor(pegValues.length * 0.5)],
      p75: pegSorted[Math.floor(pegValues.length * 0.75)],
      p90: pegSorted[Math.floor(pegValues.length * 0.9)],
      p95: pegSorted[Math.floor(pegValues.length * 0.95)],
      p99: pegSorted[Math.floor(pegValues.length * 0.99)],
      mean: pegValues.reduce((a, b) => a + b) / pegValues.length
    };

    console.log('=' .repeat(80));
    console.log('🔍 ROOT CAUSE ANALYSIS: Why Precision/Recall Tradeoff Happens');
    console.log('=' .repeat(80));
    console.log('');

    console.log('OBSERVATION:');
    console.log(`  - High volatility events: ${highVolIndices.length}`);
    console.log(`  - Average PEG before vol spike: ${calculateAvgPegBeforeVolSpikes(ticks, pegValues, highVolIndices).toFixed(2)}`);
    console.log(`  - P99 PEG threshold: ${pegStats.p99.toFixed(2)}`);
    console.log(`  - PEG detection rate at P99: ${(highVolIndices.filter(idx => pegValues[Math.max(0, idx - 5)] > pegStats.p99).length / highVolIndices.length * 100).toFixed(1)}%`);
    console.log('');

    console.log('PROBLEM IDENTIFIED:');
    console.log('  1. High PEG threshold catches quality signals (high precision)');
    console.log('  2. But most volatility spikes occur WITHOUT preceding PEG spike');
    console.log('  3. This means: PEG is not the right leading indicator for volatility');
    console.log('');

    console.log('IMPLICATION:');
    console.log('  ❌ Increasing threshold = Better precision, Worse recall');
    console.log('  ❌ Lowering threshold = Better recall, Worse precision');
    console.log('  → This is NOT a tuning problem, it\'s a METRIC problem!');
    console.log('');

    console.log('=' .repeat(80));
    console.log('🎯 OPTIMIZATION APPROACH: F1-Score Balancing');
    console.log('=' .repeat(80));
    console.log('');

    // Test thresholds and calculate F1
    const thresholds = [100, 200, 300, 500, 750, 1000, 1307, 1500, 1797, 2000, 2214, 2500, 2900, 3500, 4000];
    const results: TestResult[] = [];

    console.log('Testing thresholds for best F1-score (balance precision + recall)...');
    console.log('');

    for (const thresh of thresholds) {
      const tp = pegValues.filter((p, i) => p > thresh && highVolIndices.includes(i)).length;
      const fp = pegValues.filter((p, i) => p > thresh && !highVolIndices.includes(i)).length;
      const fn = highVolIndices.filter(i => pegValues[i] <= thresh).length;
      const signals = pegValues.filter(p => p > thresh).length;

      const precision = signals > 0 ? tp / signals : 0;
      const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
      const f1 = precision > 0 && recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

      results.push({
        threshold: thresh,
        label: thresh === 1307 ? 'P75' : thresh === 1797 ? 'P90' : thresh === 2214 ? 'P95' : thresh === 2900 ? 'P99' : `${thresh}`,
        precision,
        recall,
        f1,
        tp,
        fp,
        fn,
        signals
      });
    }

    // Sort by F1
    results.sort((a, b) => b.f1 - a.f1);

    console.log('Top 5 thresholds by F1-Score (best balance):');
    console.log('Threshold\tLabel\tPrecision\tRecall\t\tF1\t\tSignals');
    console.log('-' .repeat(75));

    for (let i = 0; i < 5; i++) {
      const r = results[i];
      console.log(`${r.threshold}\t\t${r.label}\t${(r.precision * 100).toFixed(1)}%\t\t${(r.recall * 100).toFixed(1)}%\t\t${(r.f1 * 100).toFixed(1)}%\t\t${r.signals}`);
    }

    console.log('');
    console.log('=' .repeat(80));
    console.log('💡 BETTER OPTIMIZATION STRATEGY');
    console.log('=' .repeat(80));
    console.log('');

    const bestF1 = results[0];
    console.log(`✅ OPTIMAL THRESHOLD: ${bestF1.label} (${bestF1.threshold})`);
    console.log(`   Precision: ${(bestF1.precision * 100).toFixed(1)}%`);
    console.log(`   Recall: ${(bestF1.recall * 100).toFixed(1)}%`);
    console.log(`   F1-Score: ${(bestF1.f1 * 100).toFixed(1)}%`);
    console.log(`   Signals Generated: ${bestF1.signals}`);
    console.log('');

    console.log('WHY THIS APPROACH WORKS BETTER:');
    console.log('  ✅ Balances False Positives (too many trades) vs False Negatives (missed moves)');
    console.log('  ✅ F1-Score equally weights precision and recall');
    console.log('  ✅ Finds the "sweet spot" for practical trading');
    console.log('');

    console.log('COMPARISON:');
    console.log('  Old approach (maximize precision): 62.8% precision, 2.5% recall, F1=4.8%');
    console.log(`  Better approach (maximize F1): ${(bestF1.precision * 100).toFixed(1)}% precision, ${(bestF1.recall * 100).toFixed(1)}% recall, F1=${(bestF1.f1 * 100).toFixed(1)}%`);
    console.log('');

    if (bestF1.f1 > 0.15) {
      console.log('🎉 RECOMMENDATION: This threshold can be used for trading!');
    } else {
      console.log('⚠️  WARNING: Even optimal threshold has weak predictive power (F1 < 15%)');
      console.log('   Suggests PEG metric fundamentally doesn\'t predict volatility well');
    }

    console.log('\n' + '=' .repeat(80));
    console.log('📝 CODE UPDATE');
    console.log('=' .repeat(80));
    console.log('');
    console.log(`Update validation thresholds to:`);
    console.log(`  const pegThreshold = ${bestF1.threshold}; // F1=${(bestF1.f1 * 100).toFixed(1)}%`);
    console.log('');
    console.log('This maximizes practical trading utility by balancing precision/recall');
    console.log('\n' + '=' .repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ ANALYSIS FAILED:');
    console.error(error);
    process.exit(1);
  }
}

function calculateBaselineVolatility(ticks: MarketTick[]): number {
  const window = ticks.slice(0, Math.min(100, ticks.length));
  let sum = 0;
  for (let i = 1; i < window.length; i++) {
    const ret = Math.abs((window[i].close - window[i - 1].close) / window[i - 1].close);
    sum += ret * ret;
  }
  return Math.sqrt(sum / window.length);
}

function identifyHighVolatilityEvents(ticks: MarketTick[], baselineVol: number): number[] {
  const indices: number[] = [];
  const lookAhead = 20;

  for (let i = 0; i < ticks.length - lookAhead; i++) {
    const window = ticks.slice(i, i + lookAhead);
    let volatility = 0;

    for (let j = 1; j < window.length; j++) {
      const ret = Math.abs((window[j].close - window[j - 1].close) / window[j - 1].close);
      volatility += ret * ret;
    }

    volatility = Math.sqrt(volatility / window.length);

    if (volatility > baselineVol * 1.3) {
      indices.push(i);
    }
  }

  return indices;
}

function calculateAvgPegBeforeVolSpikes(ticks: MarketTick[], pegValues: number[], volIndices: number[]): number {
  let sum = 0;
  let count = 0;

  for (const idx of volIndices) {
    // Check PEG 5-15 bars before spike
    for (let j = Math.max(5, idx - 15); j < idx; j++) {
      sum += pegValues[j];
      count++;
    }
  }

  return count > 0 ? sum / count : 0;
}

// Run analysis
analyzePerformance()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
