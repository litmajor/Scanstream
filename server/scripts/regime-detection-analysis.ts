/**
 * Regime Detection Analysis
 * 
 * Analyzes which regimes are being detected and how signals perform in each regime
 * Helps identify:
 * 1. Why profit factor degraded (which regimes are unprofitable?)
 * 2. Are we getting 0 signals in some regimes?
 * 3. Regime distribution and signal generation by regime
 */

import * as fs from 'fs';
import BinanceDataFetcher from '../services/vfmd/binanceDataFetcher';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import type { MarketTick } from '../services/vfmd/types';

interface RegimeAnalysis {
  regime: string;
  periodCount: number;
  percentageOfTime: number;
  signalsGenerated: number;
  signalDensity: number; // signals per 100 periods
  trades: Array<{
    entryRegime: string;
    exitRegime: string;
    pnl: number;
    pnlPct: number;
    confidence: number;
    duration: number;
  }>;
  tradeStats: {
    count: number;
    wins: number;
    losses: number;
    winRate: number;
    totalPnL: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
  };
}

async function analyzeRegimes() {
  console.log('\n' + '='.repeat(100));
  console.log('🔍 REGIME DETECTION ANALYSIS (1-YEAR DATA)');
  console.log('='.repeat(100));
  console.log('');

  try {
    // Load 1-year data
    console.log('📊 Loading 1-year BTC/USDT data...');
    const cacheFile = './data/cache/BTCUSDT_1h_365d.json';
    const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    const ticks: MarketTick[] = Array.isArray(cachedData) ? cachedData : (cachedData.data || cachedData.ticks || cachedData);
    console.log(`✅ Loaded ${ticks.length} candles\n`);

    // Initialize agent
    console.log('🔧 Initializing VFMDPhysicsAgent...');
    const agent = new VFMDPhysicsAgent('backtest', 'balanced');
    console.log('✅ Agent ready\n');

    // Analyze regimes
    console.log('📈 Analyzing regime distribution and signals...');
    const regimeMap = new Map<string, RegimeAnalysis>();
    const allRegimes: string[] = [];
    const signalsByRegime = new Map<string, number>();

    // First pass: collect regime distribution
    for (let i = 20; i < ticks.length; i++) {
      const historicalTicks = ticks.slice(0, i + 1);
      const analysis = agent.getAnalysisForUI(historicalTicks);
      const regime = analysis?.regime?.classification || 'UNKNOWN';
      
      allRegimes.push(regime);

      if (!regimeMap.has(regime)) {
        regimeMap.set(regime, {
          regime,
          periodCount: 0,
          percentageOfTime: 0,
          signalsGenerated: 0,
          signalDensity: 0,
          trades: [],
          tradeStats: {
            count: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            totalPnL: 0,
            avgWin: 0,
            avgLoss: 0,
            profitFactor: 0
          }
        });
      }

      const regimeData = regimeMap.get(regime)!;
      regimeData.periodCount++;

      // Check if signal generated
      const signal = agent.generateSignal(historicalTicks);
      if (signal.action !== 'HOLD') {
        regimeData.signalsGenerated++;
        signalsByRegime.set(regime, (signalsByRegime.get(regime) || 0) + 1);
      }

      if (i % 1000 === 0) {
        console.log(`  [${i}/${ticks.length}] Current regime: ${regime} (${regimeData.periodCount} periods)`);
      }
    }

    console.log('✅ Regime distribution collected\n');

    // Calculate statistics
    const totalPeriods = ticks.length - 20;
    for (const [regime, data] of regimeMap.entries()) {
      data.percentageOfTime = (data.periodCount / totalPeriods) * 100;
      data.signalDensity = (data.signalsGenerated / data.periodCount) * 100;
    }

    // Load trades from backtest results
    console.log('📊 Loading trades from backtest results...');
    const resultsFile = './backtest-results-physics-engine.json';
    if (fs.existsSync(resultsFile)) {
      const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
      const trades = results.trades || [];

      // Assign trades to regimes and calculate stats
      for (const trade of trades) {
        const entryRegime = trade.regimeAtEntry;
        
        if (regimeMap.has(entryRegime)) {
          const regimeData = regimeMap.get(entryRegime)!;
          regimeData.trades.push({
            entryRegime: trade.regimeAtEntry,
            exitRegime: trade.regimeAtExit,
            pnl: trade.pnl,
            pnlPct: trade.pnlPct,
            confidence: trade.confidence,
            duration: trade.exitIndex - trade.entryIndex
          });
        }
      }

      // Calculate trade statistics per regime
      for (const [regime, data] of regimeMap.entries()) {
        if (data.trades.length > 0) {
          const wins = data.trades.filter(t => t.pnl > 0);
          const losses = data.trades.filter(t => t.pnl <= 0);
          const totalPnL = data.trades.reduce((sum, t) => sum + t.pnl, 0);
          const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
          const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));

          data.tradeStats = {
            count: data.trades.length,
            wins: wins.length,
            losses: losses.length,
            winRate: wins.length / data.trades.length,
            totalPnL,
            avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
            avgLoss: losses.length > 0 ? -(grossLoss / losses.length) : 0,
            profitFactor: grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0)
          };
        }
      }
    }

    // Print detailed regime analysis
    console.log('\n' + '='.repeat(100));
    console.log('📊 DETAILED REGIME ANALYSIS');
    console.log('='.repeat(100));
    console.log('');

    // Sort by period count
    const sortedRegimes = Array.from(regimeMap.values()).sort((a, b) => b.periodCount - a.periodCount);

    console.log('REGIME TIME DISTRIBUTION:');
    console.log('');
    for (const regime of sortedRegimes) {
      console.log(`📍 ${regime.regime.toUpperCase()}`);
      console.log(`   Time: ${regime.periodCount} periods (${regime.percentageOfTime.toFixed(2)}% of backtest)`);
      console.log(`   Signals: ${regime.signalsGenerated} generated (${regime.signalDensity.toFixed(3)}% density - 1 signal per ${(100 / regime.signalDensity).toFixed(0)} periods)`);
      console.log('');
    }

    console.log('');
    console.log('REGIME-SPECIFIC TRADING PERFORMANCE:');
    console.log('');

    const regimesByProfitFactor = Array.from(regimeMap.values())
      .filter(r => r.tradeStats.count > 0)
      .sort((a, b) => b.tradeStats.profitFactor - a.tradeStats.profitFactor);

    for (const regime of regimesByProfitFactor) {
      const stats = regime.tradeStats;
      const profitMargin = stats.totalPnL > 0 ? (stats.totalPnL / Math.abs(stats.avgLoss * stats.losses)) * 100 : 0;
      
      console.log(`📍 ${regime.regime.toUpperCase()}`);
      console.log(`   Trades: ${stats.count} (${stats.wins} wins, ${stats.losses} losses)`);
      console.log(`   Win Rate: ${(stats.winRate * 100).toFixed(2)}%`);
      console.log(`   Total PnL: $${stats.totalPnL.toFixed(2)}`);
      console.log(`   Avg Win/Loss: $${stats.avgWin.toFixed(2)} / $${stats.avgLoss.toFixed(2)}`);
      console.log(`   Profit Factor: ${stats.profitFactor.toFixed(2)}`);
      console.log(`   ✓ Status: ${stats.profitFactor > 1.5 ? '✅ STRONG' : stats.profitFactor > 1.0 ? '⚠️  WEAK' : '❌ NEGATIVE'}`);
      console.log('');
    }

    // Identify problem regimes
    console.log('');
    console.log('⚠️  PROBLEM ANALYSIS:');
    console.log('');

    const zeroSignalRegimes = sortedRegimes.filter(r => r.signalsGenerated === 0);
    if (zeroSignalRegimes.length > 0) {
      console.log('🔴 REGIMES WITH 0 SIGNALS:');
      for (const regime of zeroSignalRegimes) {
        console.log(`   - ${regime.regime.toUpperCase()}: ${regime.periodCount} periods (${regime.percentageOfTime.toFixed(2)}% of time)`);
      }
      console.log('   → These regimes are being detected but skipped by signal generation');
      console.log('');
    }

    const negativeRegimes = regimesByProfitFactor.filter(r => r.tradeStats.profitFactor < 1.0);
    if (negativeRegimes.length > 0) {
      console.log('🔴 REGIMES WITH NEGATIVE PROFIT FACTOR:');
      for (const regime of negativeRegimes) {
        console.log(`   - ${regime.regime.toUpperCase()}: ${regime.tradeStats.trades.length} trades, PF ${regime.tradeStats.profitFactor.toFixed(2)}, PnL $${regime.tradeStats.totalPnL.toFixed(2)}`);
      }
      console.log('   → These regimes are losing money. Need soft gating or avoidance.');
      console.log('');
    }

    // Why profit factor degraded
    console.log('');
    console.log('🔍 WHY PROFIT FACTOR DEGRADED (1.86 → 1.34):');
    console.log('');

    const overallStats = regimesByProfitFactor.reduce(
      (acc, r) => ({
        count: acc.count + r.tradeStats.count,
        wins: acc.wins + r.tradeStats.wins,
        losses: acc.losses + r.tradeStats.losses,
        totalPnL: acc.totalPnL + r.tradeStats.totalPnL,
        grossProfit: acc.grossProfit + (r.tradeStats.avgWin * r.tradeStats.wins),
        grossLoss: acc.grossLoss + Math.abs(r.tradeStats.avgLoss * r.tradeStats.losses)
      }),
      { count: 0, wins: 0, losses: 0, totalPnL: 0, grossProfit: 0, grossLoss: 0 }
    );

    console.log(`Current (1-year): ${overallStats.count} trades, ${(overallStats.wins / overallStats.count * 100).toFixed(2)}% WR, PF ${(overallStats.grossProfit / overallStats.grossLoss).toFixed(2)}`);
    console.log('');
    
    // Identify which regimes hurt profit factor
    console.log('Profit factor breakdown by regime:');
    const profitFactorImpact = regimesByProfitFactor
      .filter(r => r.tradeStats.count > 0)
      .map(r => ({
        regime: r.regime,
        trades: r.tradeStats.count,
        pf: r.tradeStats.profitFactor,
        totalPnL: r.tradeStats.totalPnL,
        weight: (r.tradeStats.count / overallStats.count) * 100
      }))
      .sort((a, b) => a.pf - b.pf);

    for (const item of profitFactorImpact) {
      const impact = item.trades < 10 ? '(small sample)' : item.trades < 30 ? '(medium impact)' : '(major impact)';
      console.log(`   ${item.regime.toUpperCase()}: PF ${item.pf.toFixed(2)}, ${item.trades} trades (${item.weight.toFixed(1)}%) ${impact}`);
    }

    console.log('');
    console.log('='.repeat(100));
    console.log('');

    // Save detailed analysis
    const analysisFile = './regime-analysis-results.json';
    const analysisData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalPeriods,
        totalRegimes: regimeMap.size,
        totalSignals: Array.from(signalsByRegime.values()).reduce((a, b) => a + b, 0),
        averageSignalDensity: Array.from(regimeMap.values())
          .reduce((sum, r) => sum + r.signalDensity, 0) / regimeMap.size
      },
      regimes: sortedRegimes,
      profitFactorDegradation: {
        baseline_180d: 1.86,
        current_1y: overallStats.grossProfit / overallStats.grossLoss,
        change: ((overallStats.grossProfit / overallStats.grossLoss) - 1.86) / 1.86 * 100
      }
    };

    fs.writeFileSync(analysisFile, JSON.stringify(analysisData, null, 2));
    console.log(`💾 Detailed analysis saved to: ${analysisFile}\n`);

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

// Run analysis
analyzeRegimes()
  .then(() => {
    console.log('✅ REGIME ANALYSIS COMPLETE');
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
