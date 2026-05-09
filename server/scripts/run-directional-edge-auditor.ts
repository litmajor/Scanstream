/**
 * Run Directional Edge Auditor
 *
 * Analyzes directional trading edge by:
 * - Simulating trades based on VFMD signals
 * - Slicing results by regime, volume bias, MTF agreement, VWAP, PEG
 * - Computing lift (win rate improvement) for each condition
 * - Ranking features by directional edge quality
 * - Recommending optimal filter combinations
 *
 * Usage:
 *   pnpm exec tsx server/scripts/run-directional-edge-auditor.ts [symbol] [year]
 *
 * Examples:
 *   pnpm exec tsx server/scripts/run-directional-edge-auditor.ts BTC 2024
 *   pnpm exec tsx server/scripts/run-directional-edge-auditor.ts ETH 2025
 *   pnpm exec tsx server/scripts/run-directional-edge-auditor.ts SOL 2024
 */

import DirectionalEdgeAuditor from '../services/vfmd/DirectionalEdgeAuditor';
import * as fs from 'fs';

async function main() {
  try {
    console.log('🔍 DIRECTIONAL EDGE AUDITOR');
    console.log('='.repeat(80));
    console.log('');

    // Parse arguments
    const args = process.argv.slice(2);
    const assetShort = args[0]?.toUpperCase() || 'BTC';
    const year = args[1] ? parseInt(args[1]) : 2024;

    // Map short names to symbols
    const assetMap: Record<string, string> = {
      'BTC': 'BTCUSDT',
      'ETH': 'ETHUSDT',
      'SOL': 'SOLUSDT',
      'BTCUSDT': 'BTCUSDT',
      'ETHUSDT': 'ETHUSDT',
      'SOLUSDT': 'SOLUSDT',
    };

    const symbol = assetMap[assetShort];
    if (!symbol) {
      console.error(`❌ Unknown asset: ${assetShort}`);
      console.error(`   Supported: BTC, ETH, SOL`);
      process.exit(1);
    }

    // Load data from cache (1h candles)
    console.log(`📊 Loading ${symbol} 1h candles from cache...`);
    const cacheFile = `./data/cache/${symbol}_1h_${year}.json`;

    let ticks;

    if (fs.existsSync(cacheFile)) {
      console.log(`✅ Found cached file: ${cacheFile}`);
      const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      ticks = Array.isArray(cachedData) ? cachedData : (cachedData.data || cachedData.ticks || cachedData);
      console.log(`✅ Loaded ${ticks.length} candles\n`);
    } else {
      console.error(`\n❌ Cache file not found: ${cacheFile}`);
      console.error('\n📁 Available cache files:');
      const cacheDir = './data/cache';
      if (fs.existsSync(cacheDir)) {
        const files = fs.readdirSync(cacheDir)
          .filter(f => f.endsWith('.json') && f.includes('_1h_'))
          .sort();
        if (files.length > 0) {
          files.forEach(f => console.error(`   - ${f}`));
        } else {
          console.error('   (no 1h candle files found)');
        }
      }
      console.error('\n💡 Try fetching data first:');
      console.error('   pnpm exec tsx server/services/vfmd/binanceDataFetcher.ts 3years-1h');
      process.exit(1);
    }

    if (ticks.length < 100) {
      console.error(`❌ Not enough candles: ${ticks.length} (need at least 100)`);
      process.exit(1);
    }

    // Run auditor
    console.log('🚀 Running directional edge analysis...');
    console.log('   Max hold: 8 candles');
    console.log('   Stop multiplier: 1.5× ATR');
    console.log('   Fees: 0.14% round-trip (0.07% taker × 2)');
    console.log('');

    const auditor = new DirectionalEdgeAuditor();
    const report = await auditor.run(
      ticks,
      8,                    // maxCandles
      1.5,                  // stopMultiplier
      0.0014                // feeRtPct
    );

    // Save report to JSON
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = `./data/audit-reports/${symbol}_1h_${year}_${timestamp}.json`;

    const reportDir = './data/audit-reports';
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log('✅ ANALYSIS COMPLETE');
    console.log(`📊 Report saved to: ${reportFile}`);
    console.log('');

    // Print summary
    console.log('📈 KEY METRICS:');
    console.log(`   Baseline win rate: ${(report.baseline.winRate * 100).toFixed(1)}%`);
    console.log(`   Baseline avg PnL: ${(report.baseline.avgPnl * 100).toFixed(3)}%`);
    console.log(`   Total trades simulated: ${report.baseline.trades}`);
    console.log('');
    console.log('🎯 RECOMMENDATION:');
    console.log(`   Best single filter: ${report.recommendation.bestSingleFilter}`);
    console.log(`   Best combination: ${report.recommendation.bestCombinationFilter}`);
    console.log(`   Expected win rate: ${(report.recommendation.expectedWinRate * 100).toFixed(1)}%`);
    console.log(`   Expected avg PnL: ${(report.recommendation.expectedAvgPnl * 100).toFixed(3)}%`);
    console.log('');
    console.log('🔑 TOP FEATURES (by directional lift):');
    report.recommendation.featureRanking.slice(0, 5).forEach((f, i) => {
      console.log(`   ${i + 1}. ${f}`);
    });
    console.log('');

  } catch (error) {
    console.error('\n❌ AUDIT FAILED:', error);
    process.exit(1);
  }
}

main();
