/**
 * Trade Metadata Analyzer
 * 
 * Extracts and displays all available metadata from backtest trades
 * to understand what signal conditions we can analyze
 * 
 * Usage:
 *   pnpm exec tsx server/scripts/analyze-trade-metadata.ts
 */

import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('📊 TRADE METADATA ANALYZER');
  console.log('='.repeat(80));
  console.log('');

  // Look for trade log files
  const auditDir = './data/audit-reports';
  if (!fs.existsSync(auditDir)) {
    console.error(`❌ Audit reports directory not found: ${auditDir}`);
    console.error('   Run backtest first: pnpm exec tsx server/scripts/backtest-dual-asset-btc-eth.ts');
    process.exit(1);
  }

  const files = fs.readdirSync(auditDir)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => b.localeCompare(a)); // newest first

  if (files.length === 0) {
    console.error(`❌ No trade logs found in ${auditDir}`);
    console.error('   Run backtest first: pnpm exec tsx server/scripts/backtest-dual-asset-btc-eth.ts');
    process.exit(1);
  }

  console.log(`📁 Found ${files.length} audit report(s):`);
  files.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));
  console.log('');

  // Analyze most recent report
  const latestFile = files[0];
  const filepath = path.join(auditDir, latestFile);
  
  console.log(`🔍 Analyzing: ${latestFile}`);
  console.log('');

  const report = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

  // Show baseline
  console.log('📈 BASELINE STATS:');
  console.log(`   Total trades: ${report.baseline.trades}`);
  console.log(`   Win rate: ${(report.baseline.winRate * 100).toFixed(1)}%`);
  console.log(`   Avg PnL: ${(report.baseline.avgPnL * 100).toFixed(3)}%`);
  console.log(`   Profit factor: ${report.baseline.profitFactor.toFixed(2)}`);
  console.log('');

  // Show all slice categories
  console.log('🔑 AVAILABLE CONDITION CATEGORIES:');
  console.log('');

  const categories = [
    { name: 'PEG Z-Score Buckets', data: report.byPegBucket },
    { name: 'Volume Bias', data: report.byVolBias },
    { name: 'Multi-Timeframe Agreement', data: report.byMTFAgreement },
    { name: 'VWAP Direction', data: report.byVwapDirection },
    { name: 'Regime Type', data: report.byRegime },
  ];

  for (const { name, data } of categories) {
    console.log(`📌 ${name}:`);
    for (const [label, slice] of Object.entries(data)) {
      const lift = (slice as any).liftVsBaseline || 1;
      const emoji = lift > 1.05 ? '✅' : lift < 0.95 ? '❌' : '➖';
      console.log(
        `   ${emoji} ${label.padEnd(30)} | ${(slice as any).trades} trades | ${((slice as any).winRate * 100).toFixed(1)}% WR | ${lift.toFixed(2)}x lift`
      );
    }
    console.log('');
  }

  // Show top combinations
  console.log('🎯 TOP 10 WINNING COMBINATIONS:');
  console.log('');
  const combos = report.topCombinations || [];
  combos.slice(0, 10).forEach((c: any, i: number) => {
    const emoji = c.winRate > report.baseline.winRate ? '✅' : '❌';
    const lift = (c as any).liftVsBaseline || 1;
    console.log(
      `   ${i + 1}. ${emoji} ${c.filter.substring(0, 60).padEnd(60)} | ${c.trades}T | ${(c.winRate * 100).toFixed(1)}% WR | ${lift.toFixed(2)}x`
    );
  });
  console.log('');

  // Show feature importance
  console.log('⭐ FEATURE IMPORTANCE RANKING:');
  console.log('');
  const features = report.recommendation?.featureRanking || [];
  features.forEach((f: any, i: number) => {
    const icon = i < 3 ? '🔥' : i < 5 ? '⚡' : '•';
    console.log(`   ${icon} ${i + 1}. ${f}`);
  });
  console.log('');

  // Show recommendation
  console.log('💡 RECOMMENDATION:');
  const rec = report.recommendation || {};
  console.log(`   Best single filter: ${rec.bestSingleFilter || 'N/A'}`);
  console.log(`   Best combination: ${rec.bestCombinationFilter || 'N/A'}`);
  console.log(`   Expected win rate: ${((rec.expectedWinRate || 0) * 100).toFixed(1)}%`);
  console.log(`   Expected avg PnL: ${((rec.expectedAvgPnL || 0) * 100).toFixed(3)}%`);
  console.log(`   Expected trades/year: ${rec.expectedTradesPerYear || 0}`);
  console.log('');

  console.log('='.repeat(80));
  console.log('✅ ANALYSIS COMPLETE');
  console.log('');
  console.log('📊 INSIGHT:');
  console.log('   These slices analyze DIRECTIONAL accuracy');
  console.log('   (when signal says LONG, does price go UP?)');
  console.log('');
  console.log('   NOT exit quality. To find conditions that predict stop_hits,');
  console.log('   backtest needs to log actual signal metadata:');
  console.log('   - peg, pegZscore, ti, coherence, regime');
  console.log('   - volBias, mtf4h agreement, vwapDeviation');
  console.log('   - exitReason (time_stop, stop_hit, etc)');
  console.log('');
  console.log('   Then analyze: which conditions → highest stop_hit %?');
  console.log('   Those are the EXCLUSION filters.');
  console.log('');
}

main().catch(error => {
  console.error('❌ ANALYSIS FAILED:', error);
  process.exit(1);
});
