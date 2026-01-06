/**
 * Regime Performance Analysis & Optimization Script
 * 
 * Analyzes historical performance by regime and provides
 * optimization recommendations for trading parameters
 */

import { RegimeAwareTradingSystem } from '../services/regime-aware-trading-system';
import { RegimeClassifier, FlowRegime } from '../services/vfmd/regimeClassifier';
import type { PhysicsMetrics } from '../services/vfmd/types';

/**
 * Sample historical trades with outcomes
 * In production, this would come from your trade journal/database
 */
interface HistoricalTrade {
  symbol: string;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  risk: number;
  reward: number;
  regime: FlowRegime;
  physicsMetrics: PhysicsMetrics;
  won: boolean;
  riskReward: number;
}

/**
 * Performance metrics for a regime
 */
interface RegimePerformance {
  regime: FlowRegime;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  averageRR: number;
  expectancy: number; // (WR * AvgWin) - ((1-WR) * AvgLoss)
  profitFactor: number; // Gross wins / Gross losses
  sharpeRatio: number;
  recommendation: string;
}

/**
 * Analyze regime performance from historical trades
 */
export function analyzeRegimePerformance(trades: HistoricalTrade[]): Map<FlowRegime, RegimePerformance> {
  const regimeStats = new Map<FlowRegime, RegimePerformance>();

  // Initialize all regimes
  Object.values(FlowRegime).forEach((regime) => {
    regimeStats.set(regime, {
      regime,
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      averageRR: 0,
      expectancy: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      recommendation: '',
    });
  });

  // Process trades by regime
  for (const trade of trades) {
    const stats = regimeStats.get(trade.regime)!;
    stats.totalTrades++;

    if (trade.won) {
      stats.wins++;
      stats.averageWin += trade.reward;
    } else {
      stats.losses++;
      stats.averageLoss += trade.risk;
    }
  }

  // Calculate percentages and averages
  regimeStats.forEach((stats) => {
    if (stats.totalTrades === 0) return;

    stats.winRate = stats.wins / stats.totalTrades;
    stats.averageWin = stats.wins > 0 ? stats.averageWin / stats.wins : 0;
    stats.averageLoss = stats.losses > 0 ? stats.averageLoss / stats.losses : 0;
    stats.averageRR = stats.averageLoss > 0 ? stats.averageWin / stats.averageLoss : 0;

    // Expectancy = (Win% × AvgWin) - (Loss% × AvgLoss)
    stats.expectancy = (stats.winRate * stats.averageWin) - ((1 - stats.winRate) * stats.averageLoss);

    // Profit Factor = Gross Wins / Gross Losses
    const grossWins = stats.averageWin * stats.wins;
    const grossLosses = stats.averageLoss * stats.losses;
    stats.profitFactor = grossLosses > 0 ? grossWins / grossLosses : 0;

    // Sharpe = expectancy / volatility
    // (simplified version - full Sharpe would need return series)
    stats.sharpeRatio = stats.expectancy > 0 ? stats.expectancy / (stats.averageLoss || 1) : -1;

    // Generate recommendation
    stats.recommendation = getRegimeRecommendation(stats);
  });

  return regimeStats;
}

/**
 * Get recommendation for a regime based on performance
 */
function getRegimeRecommendation(stats: RegimePerformance): string {
  if (stats.totalTrades < 5) {
    return `🔍 Insufficient data (${stats.totalTrades} trades) - Need more samples`;
  }

  if (stats.winRate < 0.40) {
    return `❌ Poor performance (${(stats.winRate * 100).toFixed(0)}% win rate) - AVOID trading`;
  }

  if (stats.profitFactor < 1.0) {
    return `⚠️  Unprofitable (${stats.profitFactor.toFixed(2)} PF) - Lose more than win`;
  }

  if (stats.sharpeRatio < 0.5) {
    return `⚠️  Weak risk-adjusted returns - Use tighter stops`;
  }

  if (stats.winRate >= 0.60 && stats.profitFactor >= 1.5) {
    return `✅ Excellent (${(stats.winRate * 100).toFixed(0)}% WR, ${stats.profitFactor.toFixed(2)} PF) - OPTIMAL`;
  }

  if (stats.winRate >= 0.55 && stats.profitFactor >= 1.2) {
    return `✅ Good (${(stats.winRate * 100).toFixed(0)}% WR) - Tradeable`;
  }

  return `⚠️  Marginal (${(stats.winRate * 100).toFixed(0)}% WR) - Improve signal quality`;
}

/**
 * Generate sample historical trades for demonstration
 * In production, replace with real trade data from your system
 */
function generateSampleTrades(): HistoricalTrade[] {
  const trades: HistoricalTrade[] = [];

  // LAMINAR_TREND trades (usually good)
  for (let i = 0; i < 15; i++) {
    trades.push({
      symbol: 'BTC/USDT',
      entryTime: Date.now() - i * 3600000,
      exitTime: Date.now() - (i - 1) * 3600000,
      entryPrice: 42000,
      exitPrice: i % 10 < 6 ? 42210 : 41790, // 60% win rate
      risk: 210,
      reward: 210 * 2.5, // 2.5:1 target
      regime: FlowRegime.LAMINAR_TREND,
      physicsMetrics: {
        peg: 800,
        turbulenceIndex: 0.6,
        coherenceScore: 0.75,
        dominantAngle: 45,
        divergenceScore: 0.1,
        recentDivergence: 0.05,
        curlScore: 0.2,
        recentCurl: 0.1,
        gradientMagnitude: 100,
      },
      won: i % 10 < 6,
      riskReward: 2.5,
    });
  }

  // BREAKOUT_TRANSITION trades (best)
  for (let i = 0; i < 8; i++) {
    trades.push({
      symbol: 'BTC/USDT',
      entryTime: Date.now() - (i + 20) * 3600000,
      exitTime: Date.now() - (i + 19) * 3600000,
      entryPrice: 42000,
      exitPrice: i % 10 < 7 ? 43040 : 41860, // 70% win rate
      risk: 140,
      reward: 140 * 4.0,
      regime: FlowRegime.BREAKOUT_TRANSITION,
      physicsMetrics: {
        peg: 1800,
        turbulenceIndex: 0.5,
        coherenceScore: 0.72,
        dominantAngle: 45,
        divergenceScore: 0.15,
        recentDivergence: 0.1,
        curlScore: 0.1,
        recentCurl: 0.05,
        gradientMagnitude: 200,
      },
      won: i % 10 < 7,
      riskReward: 4.0,
    });
  }

  // CONSOLIDATION trades (harder)
  for (let i = 0; i < 12; i++) {
    trades.push({
      symbol: 'BTC/USDT',
      entryTime: Date.now() - (i + 30) * 3600000,
      exitTime: Date.now() - (i + 29) * 3600000,
      entryPrice: 42000,
      exitPrice: i % 10 < 5 ? 42042 : 41958, // 50% win rate
      risk: 42,
      reward: 42, // 1:1 target
      regime: FlowRegime.CONSOLIDATION,
      physicsMetrics: {
        peg: 600,
        turbulenceIndex: 1.1,
        coherenceScore: 0.45,
        dominantAngle: 30,
        divergenceScore: 0.0,
        recentDivergence: 0.0,
        curlScore: 0.4,
        recentCurl: 0.3,
        gradientMagnitude: 80,
      },
      won: i % 10 < 5,
      riskReward: 1.0,
    });
  }

  // ACCUMULATION trades (slow grind)
  for (let i = 0; i < 10; i++) {
    trades.push({
      symbol: 'BTC/USDT',
      entryTime: Date.now() - (i + 45) * 3600000,
      exitTime: Date.now() - (i + 44) * 3600000,
      entryPrice: 42000,
      exitPrice: i % 10 < 6 ? 42126 : 41874, // 60% win rate
      risk: 126,
      reward: 126 * 1.5,
      regime: FlowRegime.ACCUMULATION,
      physicsMetrics: {
        peg: 800,
        turbulenceIndex: 0.7,
        coherenceScore: 0.55,
        dominantAngle: 35,
        divergenceScore: -0.35,
        recentDivergence: -0.3,
        curlScore: 0.15,
        recentCurl: 0.1,
        gradientMagnitude: 120,
      },
      won: i % 10 < 6,
      riskReward: 1.5,
    });
  }

  // DISTRIBUTION trades (avoid)
  for (let i = 0; i < 8; i++) {
    trades.push({
      symbol: 'BTC/USDT',
      entryTime: Date.now() - (i + 60) * 3600000,
      exitTime: Date.now() - (i + 59) * 3600000,
      entryPrice: 42000,
      exitPrice: i % 10 < 5 ? 42063 : 41937, // 45% win rate (bad)
      risk: 63,
      reward: 63 * 1.5,
      regime: FlowRegime.DISTRIBUTION,
      physicsMetrics: {
        peg: 1300,
        turbulenceIndex: 1.4,
        coherenceScore: 0.5,
        dominantAngle: 50,
        divergenceScore: 0.35,
        recentDivergence: 0.3,
        curlScore: 0.5,
        recentCurl: 0.4,
        gradientMagnitude: 150,
      },
      won: i % 10 < 4,
      riskReward: 1.5,
    });
  }

  return trades;
}

/**
 * Print performance report
 */
function printPerformanceReport(stats: Map<FlowRegime, RegimePerformance>) {
  console.log('\n' + '═'.repeat(100));
  console.log('REGIME PERFORMANCE ANALYSIS');
  console.log('═'.repeat(100));

  // Sort by total trades
  const sorted = Array.from(stats.values()).sort((a, b) => b.totalTrades - a.totalTrades);

  console.log('\n' + '─'.repeat(100));
  console.log('│' + 'REGIME'.padEnd(20) + '│' + 'TRADES'.padEnd(8) + '│' + 'WIN%'.padEnd(8) + '│' + 'AVG RR'.padEnd(10) + '│' + 'PROFIT F'.padEnd(10) + '│' + 'EXPECTANCY'.padEnd(12) + '│' + 'SHARPE'.padEnd(10) + '│' + 'STATUS' + '│');
  console.log('─'.repeat(100));

  for (const stats of sorted) {
    const regimeName = stats.regime
      .replace(/_/g, ' ')
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    const statusIcon =
      stats.totalTrades === 0 ? '❓' :
      stats.winRate < 0.4 ? '❌' :
      stats.profitFactor < 1.0 ? '⚠️ ' :
      stats.winRate >= 0.6 && stats.profitFactor >= 1.5 ? '✅' :
      stats.winRate >= 0.55 ? '✅' :
      '⚠️ ';

    console.log(
      '│' + regimeName.padEnd(20) +
      '│' + stats.totalTrades.toString().padEnd(8) +
      '│' + (stats.totalTrades > 0 ? (stats.winRate * 100).toFixed(0) + '%' : '-').padEnd(8) +
      '│' + (stats.totalTrades > 0 ? stats.averageRR.toFixed(2) : '-').padEnd(10) +
      '│' + (stats.totalTrades > 0 ? stats.profitFactor.toFixed(2) : '-').padEnd(10) +
      '│' + (stats.totalTrades > 0 ? stats.expectancy.toFixed(2) : '-').padEnd(12) +
      '│' + (stats.totalTrades > 0 ? stats.sharpeRatio.toFixed(2) : '-').padEnd(10) +
      '│' + statusIcon + ' ' +
      (stats.recommendation.length > 20 ? stats.recommendation.substring(0, 20) + '...' : stats.recommendation) +
      '│'
    );
  }

  console.log('─'.repeat(100));

  // Recommendations
  console.log('\n' + '═'.repeat(100));
  console.log('DETAILED RECOMMENDATIONS');
  console.log('═'.repeat(100));

  for (const stats of sorted) {
    if (stats.totalTrades === 0) continue;

    const regimeName = stats.regime
      .replace(/_/g, ' ')
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    console.log(`\n📊 ${regimeName}`);
    console.log(`   Win Rate: ${(stats.winRate * 100).toFixed(0)}% (${stats.wins}/${stats.totalTrades})`);
    console.log(`   Average RR: ${stats.averageRR.toFixed(2)}:1`);
    console.log(`   Profit Factor: ${stats.profitFactor.toFixed(2)}`);
    console.log(`   Expectancy: $${stats.expectancy.toFixed(2)} per trade`);
    console.log(`   Sharpe Ratio: ${stats.sharpeRatio.toFixed(2)}`);
    console.log(`   → ${stats.recommendation}`);
  }
}

/**
 * Run analysis and recommendations
 */
export function runRegimeAnalysis() {
  console.log('\n🎯 Regime-Aware Trading System - Performance Analysis\n');
  console.log('Loading sample historical trade data...\n');

  // Generate sample trades
  const trades = generateSampleTrades();
  console.log(`✅ Generated ${trades.length} sample trades across 5 regimes\n`);

  // Analyze by regime
  const stats = analyzeRegimePerformance(trades);

  // Print report
  printPerformanceReport(stats);

  // Summary
  console.log('\n' + '═'.repeat(100));
  console.log('SUMMARY & ACTION ITEMS');
  console.log('═'.repeat(100));

  console.log('\n🏆 BEST PERFORMERS:');
  const sorted = Array.from(stats.values())
    .filter((s) => s.totalTrades >= 5)
    .sort((a, b) => b.profitFactor - a.profitFactor);

  sorted.slice(0, 3).forEach((s, i) => {
    const name = s.regime.replace(/_/g, ' ').toUpperCase();
    console.log(`   ${i + 1}. ${name}: ${s.profitFactor.toFixed(2)} PF, ${(s.winRate * 100).toFixed(0)}% WR`);
  });

  console.log('\n⚠️  NEEDS IMPROVEMENT:');
  sorted.slice(-2).forEach((s, i) => {
    const name = s.regime.replace(/_/g, ' ').toUpperCase();
    console.log(`   • ${name}: ${s.profitFactor.toFixed(2)} PF - ${s.recommendation}`);
  });

  console.log('\n💡 OPTIMIZATION RECOMMENDATIONS:');
  console.log('   1. Trade BREAKOUT_TRANSITION more aggressively (highest win rate)');
  console.log('   2. Reduce position size in DISTRIBUTION (low win rate)');
  console.log('   3. Use tighter stops in CONSOLIDATION (small moves only)');
  console.log('   4. Accumulate in ACCUMULATION regime (build positions)');
  console.log('   5. Scale out of LAMINAR_TREND (secure profits early)');

  console.log('\n📈 NEXT STEPS:');
  console.log('   1. Integrate regime classification into your signal generation');
  console.log('   2. Adjust position sizing by regime (RegimeAwareTradingSystem)');
  console.log('   3. Skip trading in TURBULENT_CHOP regime completely');
  console.log('   4. Track actual trade performance by regime');
  console.log('   5. Optimize parameters based on live results');

  console.log('\n' + '═'.repeat(100) + '\n');
}

// Run if executed directly
if (require.main === module) {
  runRegimeAnalysis();
}

export { RegimePerformance, HistoricalTrade };
