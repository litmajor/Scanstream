/**
 * BTC Convex Grid Search - Find optimal parameters
 * 
 * Focus: Maximize convex PnL while scouts stay strong
 * Design: Convex should WIN MORE than scouts through persistence trading
 * 
 * Grid variables:
 * - convexStopLossPercent: 0.5% to 3.0% (find sweet spot for BTC volatility)
 * - convexMaxHoldingBars: 40 to 100 (longer holds = more momentum capture)
 * - forConfidenceThreshold: 0.30 to 0.60 (signal quality filter)
 * 
 * Metrics tracked:
 * - Scout PnL (baseline - should stay 18k+)
 * - Convex PnL (target - maximize this!)
 * - Combined PnL
 * - Convex win rate
 * - Convex sharpe ratio
 * - Risk/reward for convex
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ConvexityBacktesterWithFoR } from './convexity-backtester-with-for.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GridSearchResult {
  convexStopLossPercent: number;
  convexMaxHoldingBars: number;
  forConfidenceThreshold: number;
  scoutPnL: number;
  convexPnL: number;
  combinedPnL: number;
  scoutWinRate: number;
  convexWinRate: number;
  convexSharpe: number;
  convexAvgWinPct: number;
  convexAvgLossPct: number;
  convexRiskReward: number;
  combinedReturn: number;
  convexVsScoutRatio: number; // convexPnL / scoutPnL (target: >1.0 to beat scouts)
}

async function runGridSearch() {
  console.log('\n' + '═'.repeat(100));
  console.log('BTC CONVEX PARAMETER GRID SEARCH');
  console.log('═'.repeat(100));
  console.log('\n📊 Objective: Find parameters where CONVEX outperforms SCOUTS\n');

  // Grid parameters
  const stopLossValues = [0.005, 0.010, 0.015, 0.020, 0.025, 0.030];  // 0.5% to 3.0%
  const holdingBarValues = [40, 50, 60, 70, 80, 90, 100];  // 40 to 100 bars
  const confidenceValues = [0.30, 0.40, 0.50, 0.60];  // 30% to 60% quality filter

  const results: GridSearchResult[] = [];
  let testCount = 0;
  const totalTests = stopLossValues.length * holdingBarValues.length * confidenceValues.length;

  console.log(`🔍 Testing ${totalTests} parameter combinations...\n`);

  for (const stopLoss of stopLossValues) {
    for (const holdingBars of holdingBarValues) {
      for (const confidence of confidenceValues) {
        testCount++;
        const pct = ((testCount / totalTests) * 100).toFixed(1);
        process.stdout.write(`\r[${pct}%] Testing stop=${(stopLoss*100).toFixed(1)}% hold=${holdingBars}bars conf=${(confidence*100).toFixed(0)}%`);

        // Create backtester with these parameters
        const backtester = new ConvexityBacktesterWithFoR('GridSearch');
        
        // Inject parameters (access private field via any)
        const params = (backtester as any).assetParams['BTC/USDT'];
        params.convexStopLossPercent = stopLoss;
        params.convexMaxHoldingBars = holdingBars;
        params.forConfidenceThreshold = confidence;

        try {
          // Run backtest silently
          const result = backtester.run({
            symbol: 'BTC/USDT',
            dataPath: path.join(__dirname, '../../data/cache/BTCUSDT_1h_365d.json'),
          });

          // Extract metrics
          const scoutPnL = result.vfmdScoutTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
          const convexPnL = result.convexTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
          const combinedPnL = scoutPnL + convexPnL;
          const combinedReturn = (combinedPnL / 10000) * 100;

          const scoutWins = result.vfmdScoutTrades.filter(t => t.pnlPct! > 0).length;
          const scoutWinRate = result.vfmdScoutTrades.length > 0 ? (scoutWins / result.vfmdScoutTrades.length) * 100 : 0;

          const convexWins = result.convexTrades.filter(t => t.pnlPct > 0).length;
          const convexWinRate = result.convexTrades.length > 0 ? (convexWins / result.convexTrades.length) * 100 : 0;

          // Convex metrics
          const convexWinPnLs = result.convexTrades.filter(t => t.pnlPct > 0).map(t => t.pnlPct * 100);
          const convexLossPnLs = result.convexTrades.filter(t => t.pnlPct <= 0).map(t => t.pnlPct * 100);
          const convexAvgWinPct = convexWinPnLs.length > 0 ? convexWinPnLs.reduce((a, b) => a + b, 0) / convexWinPnLs.length : 0;
          const convexAvgLossPct = convexLossPnLs.length > 0 ? convexLossPnLs.reduce((a, b) => a + b, 0) / convexLossPnLs.length : 0;
          const convexRiskReward = convexAvgLossPct !== 0 ? Math.abs(convexAvgWinPct / convexAvgLossPct) : 0;

          // Sharpe ratio for convex
          const convexReturns = result.convexTrades.map(t => t.pnlPct);
          const convexMeanReturn = convexReturns.length > 0 ? convexReturns.reduce((a, b) => a + b, 0) / convexReturns.length : 0;
          const convexStdDev = convexReturns.length > 1
            ? Math.sqrt(convexReturns.reduce((sum, r) => sum + Math.pow(r - convexMeanReturn, 2), 0) / (convexReturns.length - 1))
            : 0;
          const convexSharpe = convexStdDev !== 0 ? convexMeanReturn / convexStdDev : 0;

          const convexVsScoutRatio = scoutPnL !== 0 ? convexPnL / scoutPnL : 0;

          results.push({
            convexStopLossPercent: stopLoss,
            convexMaxHoldingBars: holdingBars,
            forConfidenceThreshold: confidence,
            scoutPnL,
            convexPnL,
            combinedPnL,
            scoutWinRate,
            convexWinRate,
            convexSharpe,
            convexAvgWinPct,
            convexAvgLossPct,
            convexRiskReward,
            combinedReturn,
            convexVsScoutRatio,
          });
        } catch (e) {
          // Skip failed runs
          continue;
        }
      }
    }
  }

  console.log('\n\n' + '═'.repeat(100));
  console.log('GRID SEARCH RESULTS - TOP 20 CONFIGURATIONS');
  console.log('═'.repeat(100) + '\n');

  // Sort by combined PnL (highest return)
  const sortedByReturn = [...results].sort((a, b) => b.combinedPnL - a.combinedPnL);

  // Also sort by convex outperformance
  const sortedByConvexVsScout = [...results].sort((a, b) => b.convexVsScoutRatio - a.convexVsScoutRatio);

  console.log('📊 TOP 10 BY COMBINED PnL (Scouts + Convex):\n');
  console.log(
    'Rank  Stop%  Hold  Conf%  Scout PnL    Convex PnL   Combined PnL  Return%  Conv vs Scout\n' +
    '─────────────────────────────────────────────────────────────────────────────────────────'
  );

  for (let i = 0; i < Math.min(10, sortedByReturn.length); i++) {
    const r = sortedByReturn[i];
    console.log(
      `${(i + 1).toString().padStart(2)}    ${(r.convexStopLossPercent * 100).toFixed(1).padStart(4)}%  ${r.convexMaxHoldingBars.toString().padStart(3)}  ${(r.forConfidenceThreshold * 100).toFixed(0).padStart(3)}%   $${r.scoutPnL.toFixed(0).padStart(8)}   $${r.convexPnL.toFixed(0).padStart(8)}   $${r.combinedPnL.toFixed(0).padStart(9)}   ${r.combinedReturn.toFixed(2).padStart(6)}%  ${r.convexVsScoutRatio.toFixed(2).padStart(5)}`
    );
  }

  console.log('\n\n🎯 TOP 10 WHERE CONVEX OUTPERFORMS SCOUTS (Convex/Scout ratio > 1.0):\n');
  console.log(
    'Rank  Stop%  Hold  Conf%  Scout PnL    Convex PnL   Combined PnL  C/S Ratio  WinRate%  Sharpe\n' +
    '─────────────────────────────────────────────────────────────────────────────────────────────'
  );

  const convexWins = sortedByConvexVsScout.filter(r => r.convexVsScoutRatio > 1.0);
  for (let i = 0; i < Math.min(10, convexWins.length); i++) {
    const r = convexWins[i];
    console.log(
      `${(i + 1).toString().padStart(2)}    ${(r.convexStopLossPercent * 100).toFixed(1).padStart(4)}%  ${r.convexMaxHoldingBars.toString().padStart(3)}  ${(r.forConfidenceThreshold * 100).toFixed(0).padStart(3)}%   $${r.scoutPnL.toFixed(0).padStart(8)}   $${r.convexPnL.toFixed(0).padStart(8)}   $${r.combinedPnL.toFixed(0).padStart(9)}   ${r.convexVsScoutRatio.toFixed(2).padStart(8)}  ${r.convexWinRate.toFixed(1).padStart(6)}%  ${r.convexSharpe.toFixed(3).padStart(6)}`
    );
  }

  // Find best balanced configuration
  console.log('\n\n💡 ANALYSIS & RECOMMENDATIONS:\n');
  
  const bestByReturn = sortedByReturn[0];
  const bestByConvexVsScout = sortedByConvexVsScout.filter(r => r.convexVsScoutRatio > 1.0)[0] || sortedByConvexVsScout[0];
  const bestByWinRate = [...results].sort((a, b) => b.convexWinRate - a.convexWinRate)[0];
  const bestByRiskReward = [...results].sort((a, b) => b.convexRiskReward - a.convexRiskReward)[0];

  console.log(`1️⃣  MAXIMUM RETURN (Combined PnL):
   Stop: ${(bestByReturn.convexStopLossPercent * 100).toFixed(1)}% | Hold: ${bestByReturn.convexMaxHoldingBars} bars | Confidence: ${(bestByReturn.forConfidenceThreshold * 100).toFixed(0)}%
   Scout: $${bestByReturn.scoutPnL.toFixed(0)} | Convex: $${bestByReturn.convexPnL.toFixed(0)} | Combined: $${bestByReturn.combinedPnL.toFixed(0)} (${bestByReturn.combinedReturn.toFixed(2)}%)
   Convex vs Scout: ${bestByReturn.convexVsScoutRatio.toFixed(2)}x\n`);

  console.log(`2️⃣  CONVEX BEATS SCOUTS (Highest Convex/Scout ratio):
   Stop: ${(bestByConvexVsScout.convexStopLossPercent * 100).toFixed(1)}% | Hold: ${bestByConvexVsScout.convexMaxHoldingBars} bars | Confidence: ${(bestByConvexVsScout.forConfidenceThreshold * 100).toFixed(0)}%
   Scout: $${bestByConvexVsScout.scoutPnL.toFixed(0)} | Convex: $${bestByConvexVsScout.convexPnL.toFixed(0)} | Ratio: ${bestByConvexVsScout.convexVsScoutRatio.toFixed(2)}x
   Win Rate: ${bestByConvexVsScout.convexWinRate.toFixed(1)}% | Sharpe: ${bestByConvexVsScout.convexSharpe.toFixed(3)}\n`);

  console.log(`3️⃣  BEST RISK/REWARD (Highest avg win / avg loss):
   Stop: ${(bestByRiskReward.convexStopLossPercent * 100).toFixed(1)}% | Hold: ${bestByRiskReward.convexMaxHoldingBars} bars | Confidence: ${(bestByRiskReward.forConfidenceThreshold * 100).toFixed(0)}%
   Avg Win: ${bestByRiskReward.convexAvgWinPct.toFixed(2)}% | Avg Loss: ${bestByRiskReward.convexAvgLossPct.toFixed(2)}% | Ratio: ${bestByRiskReward.convexRiskReward.toFixed(2)}x
   Combined Return: ${bestByRiskReward.combinedReturn.toFixed(2)}%\n`);

  console.log(`4️⃣  HIGHEST WIN RATE:
   Stop: ${(bestByWinRate.convexStopLossPercent * 100).toFixed(1)}% | Hold: ${bestByWinRate.convexMaxHoldingBars} bars | Confidence: ${(bestByWinRate.forConfidenceThreshold * 100).toFixed(0)}%
   Win Rate: ${bestByWinRate.convexWinRate.toFixed(1)}% | Combined PnL: $${bestByWinRate.combinedPnL.toFixed(0)}\n`);

  // Statistical summary
  console.log('\n📈 GRID SEARCH STATISTICS:\n');
  const avgCombinedReturn = results.reduce((sum, r) => sum + r.combinedReturn, 0) / results.length;
  const avgConvexPnL = results.reduce((sum, r) => sum + r.convexPnL, 0) / results.length;
  const avgConvexWinRate = results.reduce((sum, r) => sum + r.convexWinRate, 0) / results.length;
  const convexBeatsScoutCount = results.filter(r => r.convexVsScoutRatio > 1.0).length;
  const positiveConvexCount = results.filter(r => r.convexPnL > 0).length;

  console.log(`   Total combinations tested: ${results.length}`);
  console.log(`   Avg combined return: ${avgCombinedReturn.toFixed(2)}%`);
  console.log(`   Avg convex PnL: $${avgConvexPnL.toFixed(0)}`);
  console.log(`   Avg convex win rate: ${avgConvexWinRate.toFixed(1)}%`);
  console.log(`   Configs where convex > scouts: ${convexBeatsScoutCount} (${(convexBeatsScoutCount/results.length*100).toFixed(1)}%)`);
  console.log(`   Configs with positive convex: ${positiveConvexCount} (${(positiveConvexCount/results.length*100).toFixed(1)}%)`);

  // Save results to file
  const outputPath = path.join(__dirname, '../../BTC_CONVEX_GRID_SEARCH_RESULTS.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    bestByReturn,
    bestByConvexVsScout,
    bestByWinRate,
    bestByRiskReward,
    allResults: results.sort((a, b) => b.combinedPnL - a.combinedPnL),
  }, null, 2));

  console.log(`\n✅ Full results saved to: BTC_CONVEX_GRID_SEARCH_RESULTS.json`);
  console.log('\n' + '═'.repeat(100) + '\n');
}

runGridSearch().catch(console.error);
