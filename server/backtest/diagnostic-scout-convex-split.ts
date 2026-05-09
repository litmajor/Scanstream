/**
 * Diagnostic Report: Scout vs Convexity Performance Split
 * Shows exact contribution of scouts and convex trades separately
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ConvexityBacktesterWithFoR, type BacktestResult } from './convexity-backtester-with-for.ts';
import { MetricsCalculator, type BacktestMetrics } from './metrics-calculator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DiagnosticReport {
  symbol: string;
  scouts: {
    total: number;
    wins: number;
    losses: number;
    winRate: number;
    totalPnL: number;
    totalPnLPct: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  convex: {
    total: number;
    wins: number;
    losses: number;
    winRate: number;
    totalPnL: number;
    totalPnLPct: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  combined: {
    totalPnL: number;
    totalPnLPct: number;
    scoutContribution: number;
    convexContribution: number;
    netSharpe: number;
    netDrawdown: number;
  };
}

function calculateMetrics(trades: any[]): {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnL: number;
  totalPnLPct: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
} {
  const total = trades.length;
  const wins = trades.filter(t => (t.pnl || 0) > 0).length;
  const losses = trades.filter(t => (t.pnl || 0) < 0).length;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
  
  const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalPnLPct = trades.reduce((sum, t) => sum + (t.pnlPct || 0), 0);
  
  const winTrades = trades.filter(t => (t.pnl || 0) > 0);
  const lossTrades = trades.filter(t => (t.pnl || 0) < 0);
  
  const avgWin = winTrades.length > 0 ? winTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winTrades.length : 0;
  const avgLoss = lossTrades.length > 0 ? lossTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / lossTrades.length : 0;
  
  const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : avgWin > 0 ? 999 : 0;
  
  // Calculate Sharpe Ratio from trade returns
  const returns = trades.map(t => t.pnlPct || 0);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b) / returns.length : 0;
  const variance = returns.length > 0 ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length : 0;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev !== 0 ? avgReturn / stdDev : 0;
  
  // Calculate max drawdown
  let maxDD = 0;
  let runningMax = 0;
  for (const trade of trades) {
    const tradeReturn = trade.pnl || 0;
    runningMax = Math.max(runningMax, tradeReturn);
    const dd = runningMax - tradeReturn;
    maxDD = Math.max(maxDD, dd);
  }
  
  return {
    total,
    wins,
    losses,
    winRate,
    totalPnL,
    totalPnLPct,
    avgWin,
    avgLoss,
    profitFactor,
    sharpeRatio,
    maxDrawdown: maxDD
  };
}

async function runDiagnostic() {
  const symbols = [
    { symbol: 'BTC/USDT', dataPath: path.join(__dirname, '../../data/cache/BTCUSDT_1h_365d.json') },
    { symbol: 'ETH/USDT', dataPath: path.join(__dirname, '../../data/cache/ETHUSDT_1h_365d.json') },
  ];

  const reports: DiagnosticReport[] = [];

  for (const s of symbols) {
    console.log('\n' + '═'.repeat(80));
    console.log(`🔍 DIAGNOSTIC: ${s.symbol}`);
    console.log('═'.repeat(80));

    const backtester = new ConvexityBacktesterWithFoR('Diagnostic');
    const result = backtester.run({ symbol: s.symbol, dataPath: s.dataPath });

    // Scout metrics
    const scoutMetrics = calculateMetrics(result.vfmdScoutTrades);
    console.log('\n📊 VFMD SCOUTS:');
    console.log(`   Total Scouts: ${result.vfmdScoutTrades.length}`);
    console.log(`   Wins: ${scoutMetrics.wins} | Losses: ${scoutMetrics.losses}`);
    console.log(`   Win Rate: ${scoutMetrics.winRate.toFixed(2)}%`);
    console.log(`   Total P&L: $${scoutMetrics.totalPnL.toFixed(2)} (${scoutMetrics.totalPnLPct.toFixed(4)}%)`);
    console.log(`   Avg Win: $${scoutMetrics.avgWin.toFixed(2)} | Avg Loss: $${scoutMetrics.avgLoss.toFixed(2)}`);
    console.log(`   Profit Factor: ${scoutMetrics.profitFactor.toFixed(2)}x`);
    console.log(`   Sharpe Ratio: ${scoutMetrics.sharpeRatio.toFixed(3)}`);
    console.log(`   Max Drawdown: $${scoutMetrics.maxDrawdown.toFixed(2)}`);

    // Convex metrics
    const convexMetrics = calculateMetrics(result.convexTrades);
    console.log('\n🔷 CONVEXITY TRADES:');
    console.log(`   Total Trades: ${result.convexTrades.length}`);
    console.log(`   Wins: ${convexMetrics.wins} | Losses: ${convexMetrics.losses}`);
    console.log(`   Win Rate: ${convexMetrics.winRate.toFixed(2)}%`);
    console.log(`   Total P&L: $${convexMetrics.totalPnL.toFixed(2)} (${convexMetrics.totalPnLPct.toFixed(4)}%)`);
    console.log(`   Avg Win: $${convexMetrics.avgWin.toFixed(2)} | Avg Loss: $${convexMetrics.avgLoss.toFixed(2)}`);
    console.log(`   Profit Factor: ${convexMetrics.profitFactor.toFixed(2)}x`);
    console.log(`   Sharpe Ratio: ${convexMetrics.sharpeRatio.toFixed(3)}`);
    console.log(`   Max Drawdown: $${convexMetrics.maxDrawdown.toFixed(2)}`);

    // Combined analysis
    const combinedPnL = scoutMetrics.totalPnL + convexMetrics.totalPnL;
    const combinedPnLPct = scoutMetrics.totalPnLPct + convexMetrics.totalPnLPct;
    const scoutContrib = scoutMetrics.totalPnL > 0 ? (scoutMetrics.totalPnL / combinedPnL) * 100 : 0;
    const convexContrib = convexMetrics.totalPnL > 0 ? (convexMetrics.totalPnL / combinedPnL) * 100 : 0;

    console.log('\n💡 COMBINED SYSTEM:');
    console.log(`   Total Trades: ${result.vfmdScoutTrades.length + result.convexTrades.length}`);
    console.log(`   Combined P&L: $${combinedPnL.toFixed(2)} (${combinedPnLPct.toFixed(4)}%)`);
    console.log(`   Scout Contribution: ${scoutContrib.toFixed(1)}%`);
    console.log(`   Convex Contribution: ${convexContrib.toFixed(1)}%`);
    console.log(`   Combined Sharpe: ${((scoutMetrics.sharpeRatio + convexMetrics.sharpeRatio) / 2).toFixed(3)}`);
    console.log(`   Max System Drawdown: $${Math.max(scoutMetrics.maxDrawdown, convexMetrics.maxDrawdown).toFixed(2)}`);

    // Store report
    reports.push({
      symbol: s.symbol,
      scouts: scoutMetrics,
      convex: convexMetrics,
      combined: {
        totalPnL: combinedPnL,
        totalPnLPct: combinedPnLPct,
        scoutContribution: scoutContrib,
        convexContribution: convexContrib,
        netSharpe: (scoutMetrics.sharpeRatio + convexMetrics.sharpeRatio) / 2,
        netDrawdown: Math.max(scoutMetrics.maxDrawdown, convexMetrics.maxDrawdown)
      }
    });
  }

  // Save comprehensive report
  const reportPath = path.join(process.cwd(), 'DIAGNOSTIC_SCOUT_CONVEX_SPLIT.json');
  fs.writeFileSync(reportPath, JSON.stringify(reports, null, 2));
  console.log(`\n✅ Full report saved to: DIAGNOSTIC_SCOUT_CONVEX_SPLIT.json`);

  // Print summary comparison
  console.log('\n' + '═'.repeat(80));
  console.log('SUMMARY COMPARISON');
  console.log('═'.repeat(80));
  
  for (const report of reports) {
    console.log(`\n${report.symbol}:`);
    const scoutLine = `  Scouts:  $${report.scouts.totalPnL.toFixed(2).padStart(10)} | WR: ${report.scouts.winRate.toFixed(1).padStart(5)}% | Sharpe: ${report.scouts.sharpeRatio.toFixed(3).padStart(6)}`;
    const convexLine = `  Convex:  $${report.convex.totalPnL.toFixed(2).padStart(10)} | WR: ${report.convex.winRate.toFixed(1).padStart(5)}% | Sharpe: ${report.convex.sharpeRatio.toFixed(3).padStart(6)}`;
    const totalLine = `  TOTAL:   $${report.combined.totalPnL.toFixed(2).padStart(10)} | Scout: ${report.combined.scoutContribution.toFixed(1).padStart(5)}% | Convex: ${report.combined.convexContribution.toFixed(1).padStart(5)}%`;
    console.log(scoutLine);
    console.log(convexLine);
    console.log(`  ───────────────────────────────────────────────────────────`);
    console.log(totalLine);
  }
}

runDiagnostic().catch(console.error);
