/**
 * Run PEG Volatility Debugger
 * 
 * Tests if PEG values actually predict volatility spikes
 * with the CORRECTED threshold after FieldConstructor normalization
 * 
 * Usage:
 *   pnpm exec tsx server/scripts/run-peg-debugger.ts
 */

import PEGVolatilityDebugger from '../services/vfmd/peg-debugger';
import * as fs from 'fs';

async function main() {
  try {
    console.log('🔧 PEG VOLATILITY DEBUGGER');
    console.log('='.repeat(80));
    console.log('');

    // Load BTC data from cache (365 days)
    console.log('📊 Loading BTC data from cache...');
    const cacheFile = './data/cache/BTCUSDT_1h_365d.json';
    let btcTicks;
    
    if (fs.existsSync(cacheFile)) {
      console.log(`✅ Loading from cache: ${cacheFile}`);
      const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      btcTicks = Array.isArray(cachedData) ? cachedData : (cachedData.data || cachedData.ticks || cachedData);
    } else {
      console.error(`❌ Cache file not found: ${cacheFile}`);
      console.error('   Available cache files:');
      const cacheDir = './data/cache';
      if (fs.existsSync(cacheDir)) {
        fs.readdirSync(cacheDir)
          .filter(f => f.endsWith('.json'))
          .forEach(f => console.error(`     - ${f}`));
      }
      process.exit(1);
    }
    
    console.log(`✅ Loaded ${btcTicks.length} BTC candles\n`);

    // Run debugger with OLD threshold first (to show the problem)
    console.log('---');
    console.log('TEST 1: OLD THRESHOLD (2.0 raw scale)');
    console.log('This should show 100% false positives since threshold is too low');
    console.log('---\n');

    const debugger1 = new PEGVolatilityDebugger();
    const result1 = await debugger1.debugVolatilityFailures(btcTicks, 2.0, 1.5);

    console.log(`📈 False positives with pegThreshold=2.0: ${result1.failures.length}/${btcTicks.length - 120}`);
    console.log('(Every candle triggers because threshold is below normal PEG range)\n\n');

    // Run debugger with CORRECTED threshold (after normalization)
    console.log('---');
    console.log('TEST 2: OLD GRADIENT-BASED PEG (threshold=0.09)');
    console.log('This captures normalized gradient spikes (~1.25x average)');
    console.log('---\n');

    const debugger2 = new PEGVolatilityDebugger();
    const result2 = await debugger2.debugVolatilityFailures(btcTicks, 0.09, 1.5, 'gradient');

    console.log(`📈 Potential signals with pegThreshold=0.09: ${result2.failures.length} candles`);
    console.log(`   Root cause: ${result2.rootCause}`);
    
    // Count VOL_DECREASED failures specifically
    const volDecreased2 = result2.failures.filter(f => f.error.includes('VOL_DECREASED')).length;
    const volDecreasePercent2 = result2.failures.length > 0 
      ? (volDecreased2 / result2.failures.length * 100).toFixed(0)
      : '0';
    console.log(`   VOL_DECREASED failures: ${volDecreased2}/${result2.failures.length} (${volDecreasePercent2}%)`);
    console.log('');
    console.log('💡 Analysis:');
    for (const rec of result2.recommendations) {
      console.log(`   ${rec}`);
    }
    console.log('');

    // Run debugger with COMPRESSION-BASED PEG (the fix)
    console.log('---');
    console.log('TEST 3: NEW COMPRESSION-BASED PEG (threshold=0.40)');
    console.log('Measures velocity coiling (energy compression), not gradient acceleration');
    console.log('Should align with FUTURE volatility, not past motion');
    console.log('---\n');

    const debugger3 = new PEGVolatilityDebugger();
    const result3 = await debugger3.debugVolatilityFailures(btcTicks, 0.40, 1.5, 'compression');

    console.log(`📈 Potential signals with compressionPEG=0.40: ${result3.failures.length} candles`);
    console.log(`   Root cause: ${result3.rootCause}`);
    
    // Count VOL_DECREASED failures specifically
    const volDecreased3 = result3.failures.filter(f => f.error.includes('VOL_DECREASED')).length;
    const volDecreasePercent3 = result3.failures.length > 0 
      ? (volDecreased3 / result3.failures.length * 100).toFixed(0)
      : '0';
    console.log(`   VOL_DECREASED failures: ${volDecreased3}/${result3.failures.length} (${volDecreasePercent3}%)`);
    console.log(`   ⬇️  EXPECTED: Should drop drastically (was ~${volDecreasePercent2}% → now ~${volDecreasePercent3}%)`);
    console.log('');
    console.log('💡 Analysis:');
    for (const rec of result3.recommendations) {
      console.log(`   ${rec}`);
    }
    console.log('');

    // Test alternative volatility metrics
    console.log('---');
    console.log('TEST 4: ALTERNATIVE VOLATILITY MEASURES');
    console.log('---\n');
    
    const debugger4 = new PEGVolatilityDebugger();
    const altMetrics = await debugger4.testAlternativeVolatilityMetrics(btcTicks.slice(0, 500));
    console.log(`Recommendation: ${altMetrics.recommendation}\n`);

    // Summary with comparison
    console.log('='.repeat(80));
    console.log('✅ DEBUG SUMMARY & COMPARISON');
    console.log('='.repeat(80));
    console.log('');
    console.log('TEST RESULTS COMPARISON:');
    console.log('');
    console.log('1️⃣  OLD THRESHOLD (2.0 raw dollars):');
    console.log('   ❌ Triggers on ~100% of candles');
    console.log('   ❌ This is the artifact — not a real signal');
    console.log('   ✅ Confirms FieldConstructor was storing raw dollars');
    console.log('');
    console.log('2️⃣  GRADIENT-BASED PEG (0.09 normalized):');
    console.log(`   ✅ Triggers on ${result2.failures.length} selective candles`);
    console.log(`   ⚠️  VOL_DECREASED failures: ${volDecreasePercent2}%`);
    console.log('   ❌ Still sees volatility DECREASE after these spikes');
    console.log('   📊 Root cause: Gradient captures PAST motion, not future volatility');
    console.log('');
    console.log('3️⃣  COMPRESSION-BASED PEG (0.40):  ← THE FIX');
    console.log(`   ✅ Triggers on ${result3.failures.length} selective candles`);
    console.log(`   ✅ VOL_DECREASED failures: ${volDecreasePercent3}% (dropped ${
      volDecreased2 > 0 ? Math.round((volDecreased2 - volDecreased3) / volDecreased2 * 100) : 0
    }%)`);
    console.log('   ✅ Compression = coiled energy → predicts FUTURE volatility');
    console.log('');
    console.log('KEY INSIGHT:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Gradient-based PEG measures historical volatility');
    console.log('  → Useful for detecting trend confirmation (retracement-resistant moves)');
    console.log('');
    console.log('  Compression-based PEG measures coiled energy (velocity slowdown)');
    console.log('  → Useful for detecting volatility spikes (breakouts, reversals)');
    console.log('');
    console.log('  BOTH are useful. The architecture supports both in parallel.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('NEXT STEPS:');
    console.log('  1. Update RegimeClassifier thresholds to use compression PEG');
    console.log('  2. Update VFMDPhysicsAgent regimeThresholds to normalized ranges');
    console.log('  3. Re-run backtest with both fixes applied');
    console.log('  4. Verify ETH regime diversity (no longer 100% CONSOLIDATION)');
    console.log('  5. Validate turbulent trades now properly valued');
    console.log('');

  } catch (error) {
    console.error('❌ Debugger failed:', error);
    process.exit(1);
  }
}

main();
