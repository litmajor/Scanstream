/**
 * PEG Threshold Optimizer
 * 
 * Tests different PEG thresholds to find optimal precision/recall balance
 * 
 * Usage:
 *   pnpm exec tsx server/scripts/optimize-peg-threshold.ts
 */

import BinanceDataFetcher from '../services/vfmd/binanceDataFetcher';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import { validatePEGVolatilityPrediction } from '../services/vfmd/correctPhysicsValidator';

async function optimizeThreshold() {
  console.log('\n' + '='.repeat(80));
  console.log('🎯 PEG THRESHOLD OPTIMIZER');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Load cached BTC data
    console.log('📊 Loading BTC/USDT data...');
    const ticks = BinanceDataFetcher.loadFromFile('./data/cache/BTCUSDT_1h_180d.json');
    console.log(`✅ Loaded ${ticks.length} candles\n`);

    // Initialize VFMD agent
    console.log('🔧 Initializing VFMD Physics Agent...');
    const vfmdAgent = new VFMDPhysicsAgent('optimizer', 'balanced');
    console.log('✅ Agent ready\n');

    // Calculate PEG values
    console.log('📈 Calculating PEG values...');
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

    console.log(`✅ Calculated PEG for ${pegValues.length} candles\n`);

    // Get PEG statistics
    const pegSorted = [...pegValues].sort((a, b) => a - b);
    const p50 = pegSorted[Math.floor(pegValues.length * 0.5)];
    const p75 = pegSorted[Math.floor(pegValues.length * 0.75)];
    const p90 = pegSorted[Math.floor(pegValues.length * 0.9)];
    const p95 = pegSorted[Math.floor(pegValues.length * 0.95)];
    const p99 = pegSorted[Math.floor(pegValues.length * 0.99)];

    console.log('📊 PEG Value Distribution:');
    console.log(`  Min: ${pegSorted[0].toFixed(2)}`);
    console.log(`  P50 (median): ${p50.toFixed(2)}`);
    console.log(`  P75: ${p75.toFixed(2)}`);
    console.log(`  P90: ${p90.toFixed(2)}`);
    console.log(`  P95: ${p95.toFixed(2)}`);
    console.log(`  P99: ${p99.toFixed(2)}`);
    console.log(`  Max: ${pegSorted[pegValues.length - 1].toFixed(2)}\n`);

    // Test different thresholds
    console.log('=' .repeat(80));
    console.log('TESTING DIFFERENT PEG THRESHOLDS');
    console.log('=' .repeat(80));
    console.log('');

    const thresholds = [
      { value: p75, label: 'P75' },
      { value: p90, label: 'P90' },
      { value: p95, label: 'P95' },
      { value: p99, label: 'P99' },
      { value: 100, label: '100' },
      { value: 200, label: '200' },
      { value: 500, label: '500' },
      { value: 1000, label: '1000' }
    ];

    let bestThreshold = { precision: 0, threshold: 0, label: '' };

    console.log('Threshold\tPrecision\tRecall\t\tF1 Score\tSignals');
    console.log('-' .repeat(70));

    for (const thresh of thresholds) {
      const result = validatePEGVolatilityPrediction(ticks, pegValues, thresh.value, 20);

      const f1 = result.precision > 0 && result.recall > 0
        ? 2 * (result.precision * result.recall) / (result.precision + result.recall)
        : 0;

      const signals = pegValues.filter(p => p > thresh.value).length;

      console.log(`${thresh.label}\t\t${(result.precision * 100).toFixed(1)}%\t\t${(result.recall * 100).toFixed(1)}%\t\t${(f1 * 100).toFixed(1)}%\t\t${signals}`);

      if (result.precision > bestThreshold.precision && result.precision >= 0.5) {
        bestThreshold = {
          precision: result.precision,
          threshold: thresh.value,
          label: thresh.label
        };
      }
    }

    console.log('\n' + '=' .repeat(80));
    console.log('🎯 RECOMMENDATION');
    console.log('=' .repeat(80));

    if (bestThreshold.threshold > 0) {
      console.log(`\n✅ Optimal threshold: ${bestThreshold.label} (${bestThreshold.threshold.toFixed(0)})`);
      console.log(`   Precision: ${(bestThreshold.precision * 100).toFixed(1)}%`);
      console.log(`\nUpdate your code:`);
      console.log(`   const pegThreshold = ${bestThreshold.threshold.toFixed(0)};`);
    } else {
      console.log('\n⚠️  No threshold achieved >50% precision.');
      console.log('\nPossible issues:');
      console.log('  1. PEG calculation may not correlate with volatility');
      console.log('  2. Baseline window or parameters need adjustment');
      console.log('  3. Market data quality or normalization issue');
      console.log('\nNext steps:');
      console.log('  1. Review PEG calculation formula');
      console.log('  2. Adjust baseline window size');
      console.log('  3. Try different volatility metrics');
    }

    console.log('\n' + '=' .repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ OPTIMIZATION FAILED:');
    console.error(error);
    process.exit(1);
  }
}

// Run optimizer
optimizeThreshold()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
