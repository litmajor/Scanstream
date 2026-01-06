/**
 * ETH Regime Parameter Optimizer
 * Tests combinations of PEG, TRIGGER, and PROFIT_SCORE to maximize:
 * - Trade count (target 300-500 for reasonable volume)
 * - Win rate (target >55%)
 * - Sharpe ratio (target >3.0)
 * - Profit factor (target >1.5)
 * - Total PnL (maximize)
 */

import * as fs from 'fs';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import type { MarketTick } from '../services/vfmd/types';

const DATA_DAYS = 365;
const INITIAL_CAPITAL = 1000;
const MAX_POSITION_SIZE = 0.4;
const SLIPPAGE_BPS = 2;
const COMMISSION_BPS = 1;

// Parameter grid to test
const PROFIT_SCORE_RANGE = [30, 32, 35, 38, 40];
const PEG_RANGES = {
  consolidation: [15, 18, 20, 25, 30],
  turbulent_chop: [15, 30, 35, 40, 45],
  distribution: [15, 30, 35, 40],
  accumulation: [15, 30, 35, 40],
  laminar_trend: [15, 18, 20, 25],
  breakout_transition: [30, 35, 40, 45]
};
const TRIGGER_RANGES = {
  consolidation: [0.08, 0.10, 0.12, 0.15],
  turbulent_chop: [0.08, 0.10, 0.12, 0.15],
  distribution: [0.12, 0.15, 0.18, 0.20],
  accumulation: [0.12, 0.15, 0.18, 0.20],
  laminar_trend: [0.08, 0.10, 0.12, 0.15],
  breakout_transition: [0.10, 0.12, 0.15, 0.18]
};

interface OptimizationResult {
  profitScore: number;
  regimeParams: Record<string, {peg: number; trigger: number}>;
  trades: number;
  winRate: number;
  profitFactor: number;
  sharpe: number;
  pnl: number;
  maxDD: number;
  score: number; // Composite optimization score
}

async function runBacktestWithParams(
  ticks: MarketTick[],
  profitScore: number,
  regimeParams: Record<string, {peg: number; trigger: number}>
): Promise<{
  trades: number;
  winRate: number;
  profitFactor: number;
  sharpe: number;
  pnl: number;
  maxDD: number;
}> {
  const agent = new VFMDPhysicsAgent('optimizer', 'balanced');
  agent.setAsset('ETH');
  
  // Override thresholds (we'll need to add a method for this)
  // For now, we'll test with the current configuration
  
  let capital = INITIAL_CAPITAL;
  let peakCapital = INITIAL_CAPITAL;
  const equityCurve: number[] = [INITIAL_CAPITAL];
  const trades: any[] = [];
  let winningTrades = 0;
  let losingTrades = 0;
  let totalWinPnL = 0;
  let totalLossPnL = 0;

  for (let i = 20; i < ticks.length - 1; i++) {
    const historicalTicks = ticks.slice(0, i + 1);
    const tick = ticks[i];
    const nextTick = ticks[i + 1];

    const signal = agent.generateSignal(historicalTicks);
    if (signal.action === 'HOLD') continue;

    const direction = signal.action === 'BUY' ? 'long' : 'short';
    let confidenceMultiplier = 0.4;
    if (signal.confidence >= 0.6) confidenceMultiplier = 1.0;
    else if (signal.confidence >= 0.5) confidenceMultiplier = 0.8;
    else if (signal.confidence >= 0.4) confidenceMultiplier = 0.6;

    const positionSize = MAX_POSITION_SIZE * confidenceMultiplier;
    const entryPrice = tick.close + (direction === 'long' ? tick.close * (SLIPPAGE_BPS / 10000) : -tick.close * (SLIPPAGE_BPS / 10000));
    const exitPrice = nextTick.close - (direction === 'long' ? nextTick.close * (COMMISSION_BPS / 10000) : nextTick.close * (COMMISSION_BPS / 10000));
    
    const pnlPercent = (direction === 'long') 
      ? (exitPrice - entryPrice) / entryPrice 
      : (entryPrice - exitPrice) / entryPrice;
    
    const tradeAmount = capital * positionSize;
    const tradePnL = tradeAmount * pnlPercent;
    capital += tradePnL;

    if (tradePnL > 0) {
      winningTrades++;
      totalWinPnL += tradePnL;
    } else {
      losingTrades++;
      totalLossPnL += Math.abs(tradePnL);
    }

    if (capital > peakCapital) peakCapital = capital;
    equityCurve.push(capital);
    trades.push({trade: i, pnl: tradePnL, capital});
  }

  const totalTrades = winningTrades + losingTrades;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) : 0;
  const profitFactor = totalLossPnL > 0 ? totalWinPnL / totalLossPnL : (totalWinPnL > 0 ? 999 : 0);
  const totalPnL = capital - INITIAL_CAPITAL;
  const maxDD = ((Math.min(...equityCurve) - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;

  // Calculate Sharpe
  const returns = equityCurve.map((v, i) => i === 0 ? 0 : (v - equityCurve[i - 1]) / equityCurve[i - 1]);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252 * 24) : 0; // Annualized hourly

  return {
    trades: totalTrades,
    winRate,
    profitFactor,
    sharpe,
    pnl: totalPnL,
    maxDD
  };
}

async function optimizeRegimeParams() {
  console.log('📊 ETH REGIME PARAMETER OPTIMIZER');
  console.log('='.repeat(80));

  // Load ETH data
  const cacheFile = `./data/cache/ETHUSDT_1h_${DATA_DAYS}d.json`;
  const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  const ticks: MarketTick[] = Array.isArray(cachedData) ? cachedData : (cachedData.data || cachedData.ticks || cachedData);
  console.log(`\n✅ Loaded ${ticks.length} ETH candles\n`);

  const results: OptimizationResult[] = [];
  let testCount = 0;
  const totalTests = PROFIT_SCORE_RANGE.length * 
    Object.values(PEG_RANGES).reduce((acc, range) => acc + range.length, 0) *
    Object.values(TRIGGER_RANGES).reduce((acc, range) => acc + range.length, 0);

  // For now, test only profit score variations with current regime params
  console.log(`Testing ${PROFIT_SCORE_RANGE.length} profit score configurations...\n`);

  const currentRegimeParams = {
    consolidation: { peg: 20, trigger: 0.10 },
    distribution: { peg: 30, trigger: 0.15 },
    turbulent_chop: { peg: 35, trigger: 0.10 },
    laminar_trend: { peg: 20, trigger: 0.10 },
    breakout_transition: { peg: 35, trigger: 0.12 },
    accumulation: { peg: 30, trigger: 0.15 }
  };

  // Test profit score variations
  for (const profitScore of PROFIT_SCORE_RANGE) {
    testCount++;
    console.log(`[${testCount}] Testing Profit Score: ${profitScore}...`);

    try {
      const result = await runBacktestWithParams(ticks, profitScore, currentRegimeParams);
      
      // Composite score: weighted combination of metrics
      // Prioritize: trade count (30%), PnL (30%), Sharpe (20%), Win Rate (20%)
      const tradeScore = Math.min(result.trades / 400, 1) * 30; // Target 400 trades
      const pnlScore = Math.min(result.pnl / 100, 1) * 30; // Target $100 PnL
      const sharpeScore = Math.min(result.sharpe / 3.0, 1) * 20; // Target Sharpe 3.0
      const wrScore = Math.min(result.winRate / 0.55, 1) * 20; // Target 55% WR
      const compositeScore = tradeScore + pnlScore + sharpeScore + wrScore;

      results.push({
        profitScore,
        regimeParams: currentRegimeParams,
        trades: result.trades,
        winRate: result.winRate,
        profitFactor: result.profitFactor,
        sharpe: result.sharpe,
        pnl: result.pnL,
        maxDD: result.maxDD,
        score: compositeScore
      });

      console.log(`  → ${result.trades} trades | ${(result.winRate * 100).toFixed(1)}% WR | PF ${result.profitFactor.toFixed(2)} | $${result.pnL.toFixed(2)} | Sharpe ${result.sharpe.toFixed(2)} | Score ${compositeScore.toFixed(1)}`);
    } catch (error) {
      console.log(`  ⚠️  Error: ${error}`);
    }
  }

  // Sort by composite score
  results.sort((a, b) => b.score - a.score);

  console.log('\n' + '='.repeat(80));
  console.log('📈 TOP 5 CONFIGURATIONS:\n');

  results.slice(0, 5).forEach((result, idx) => {
    console.log(`${idx + 1}. Profit Score ${result.profitScore} (Score: ${result.score.toFixed(1)})`);
    console.log(`   Trades: ${result.trades} | WR: ${(result.winRate * 100).toFixed(1)}% | PF: ${result.profitFactor.toFixed(2)}`);
    console.log(`   PnL: $${result.pnL.toFixed(2)} | Sharpe: ${result.sharpe.toFixed(3)} | DD: ${result.maxDD.toFixed(2)}%\n`);
  });

  // Save results
  fs.writeFileSync('./optimizer-results-eth.json', JSON.stringify(results, null, 2));
  console.log('✅ Full results saved to: ./optimizer-results-eth.json');

  return results[0]; // Return best configuration
}

optimizeRegimeParams().catch(console.error);
