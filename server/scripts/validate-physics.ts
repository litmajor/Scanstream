/**
 * Physics Validation Test - Using Real BTC Data
 * 
 * Runs comprehensive physics theory validation on the 180-day 1hr BTC/USDT data
 * 
 * Usage:
 *   pnpm exec tsx server/scripts/validate-physics.ts
 */

import BinanceDataFetcher from '../services/vfmd/binanceDataFetcher';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import {
  validatePEGVolatilityPrediction,
  validatePEGPriceMovementPrediction,
  validateRegimeDirectionPrediction
} from '../services/vfmd/correctPhysicsValidator';
import type { MarketTick } from '../services/vfmd/types';

async function runValidation() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 PHYSICS THEORY VALIDATION - REAL BTC DATA');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Load cached BTC data
    console.log('📊 Loading BTC/USDT data from cache...');
    const ticks = BinanceDataFetcher.loadFromFile('./data/cache/BTCUSDT_1h_180d.json');
    console.log(`✅ Loaded ${ticks.length} candles`);
    console.log(`   Date range: ${new Date(ticks[0].timestamp).toISOString().split('T')[0]} to ${new Date(ticks[ticks.length - 1].timestamp).toISOString().split('T')[0]}`);
    console.log('');

    // Initialize VFMD agent
    console.log('🔧 Initializing VFMD Physics Agent...');
    const vfmdAgent = new VFMDPhysicsAgent('validator', 'balanced');
    console.log('✅ Agent ready\n');

    // Calculate PEG values for all candles
    console.log('📈 Calculating PEG energy values for all candles...');
    const pegValues: number[] = [];
    const regimeLabels: string[] = [];

    for (let i = 0; i < ticks.length; i++) {
      const historicalTicks = ticks.slice(0, Math.min(i + 1, ticks.length));

      if (historicalTicks.length < 10) {
        pegValues.push(0);
        regimeLabels.push('UNKNOWN');
        continue;
      }

      const analysis = vfmdAgent.getAnalysisForUI(historicalTicks);

      pegValues.push(analysis?.field_metrics?.peg_energy ? parseFloat(analysis.field_metrics.peg_energy) : 0);
      regimeLabels.push(analysis?.regime?.classification || 'UNKNOWN');

      if (i % 500 === 0) {
        console.log(`  [${i}/${ticks.length}] Computing metrics...`);
      }
    }

    console.log(`✅ Calculated PEG for all ${pegValues.length} candles\n`);

    // Run validation tests
    console.log('=' .repeat(80));
    console.log('RUNNING VALIDATION TESTS');
    console.log('=' .repeat(80));
    console.log('');

    // TEST 1: PEG → Volatility Prediction
    console.log('📊 TEST 1: PEG → VOLATILITY PREDICTION');
    console.log('-' .repeat(80));
    const pegVolTest = validatePEGVolatilityPrediction(ticks, pegValues, 300, 20);
    console.log(`Status: ${pegVolTest.status}`);
    console.log(`Sample Size: ${pegVolTest.sampleSize}`);
    console.log(`Precision: ${(pegVolTest.precision * 100).toFixed(1)}% (target: >55%)`);
    console.log(`Recall: ${(pegVolTest.recall * 100).toFixed(1)}% (target: >50%)`);
    console.log(`True Positives: ${pegVolTest.truePositives}`);
    console.log(`False Positives: ${pegVolTest.falsePositives}`);
    console.log(`False Negatives: ${pegVolTest.falseNegatives}`);
    console.log('');

    // TEST 2: PEG → Price Movement Prediction
    console.log('📊 TEST 2: PEG → PRICE MOVEMENT PREDICTION');
    console.log('-' .repeat(80));
    const pegPriceTest = validatePEGPriceMovementPrediction(ticks, pegValues, 300, 15, 0.015);
    console.log(`Status: ${pegPriceTest.status}`);
    console.log(`Sample Size: ${pegPriceTest.sampleSize}`);
    console.log(`Precision: ${(pegPriceTest.precision * 100).toFixed(1)}% (target: >55%)`);
    console.log(`Recall: ${(pegPriceTest.recall * 100).toFixed(1)}% (target: >50%)`);
    console.log(`True Positives: ${pegPriceTest.truePositives}`);
    console.log(`False Positives: ${pegPriceTest.falsePositives}`);
    console.log(`False Negatives: ${pegPriceTest.falseNegatives}`);
    console.log('');

    // TEST 3: Regime Direction Prediction
    console.log('📊 TEST 3: REGIME → DIRECTION PREDICTION');
    console.log('-' .repeat(80));
    const regimeTest = validateRegimeDirectionPrediction(ticks, regimeLabels, 15, 0.02);
    console.log(`Status: ${regimeTest.status}`);
    console.log(`Sample Size: ${regimeTest.sampleSize}`);
    console.log(`Success Rate: ${(regimeTest.successRate * 100).toFixed(1)}% (target: >55%)`);
    console.log(`True Positives: ${regimeTest.truePositives}`);
    console.log('');

    // SUMMARY
    console.log('=' .repeat(80));
    console.log('📋 VALIDATION SUMMARY');
    console.log('=' .repeat(80));

    const overallAccuracy = (pegVolTest.successRate + pegPriceTest.successRate + regimeTest.successRate) / 3;
    const allTestsPass = pegVolTest.status === 'PASS' && pegPriceTest.status === 'PASS' && regimeTest.status === 'PASS';

    console.log(`\n📊 Overall Accuracy: ${(overallAccuracy * 100).toFixed(1)}%`);
    console.log(`\n✅ Test Results:`);
    console.log(`  PEG → Volatility:  ${pegVolTest.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  PEG → Price Move:  ${pegPriceTest.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Regime → Direction: ${regimeTest.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);

    if (allTestsPass) {
      console.log('\n🎉 ALL TESTS PASSED! Physics theory is validated.');
      console.log('\n✨ Recommendations:');
      console.log('  1. Deploy PEG signals to live trading');
      console.log('  2. Use regime classification for strategy selection');
      console.log('  3. Monitor precision/recall in production');
    } else {
      console.log('\n⚠️  Some tests did not pass. Areas for improvement:');
      if (pegVolTest.status !== 'PASS') {
        console.log(`  - PEG Volatility: Precision ${(pegVolTest.precision * 100).toFixed(1)}% (needs >55%)`);
      }
      if (pegPriceTest.status !== 'PASS') {
        console.log(`  - PEG Price Move: Precision ${(pegPriceTest.precision * 100).toFixed(1)}% (needs >55%)`);
      }
      if (regimeTest.status !== 'PASS') {
        console.log(`  - Regime Direction: Success rate ${(regimeTest.successRate * 100).toFixed(1)}% (needs >55%)`);
      }
    }

    console.log('\n' + '=' .repeat(80));
    console.log('\n');

  } catch (error) {
    console.error('\n❌ VALIDATION FAILED:');
    console.error(error);
    process.exit(1);
  }
}

// Run validation
runValidation()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
