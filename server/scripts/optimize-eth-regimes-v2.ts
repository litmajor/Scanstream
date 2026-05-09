/**
 * ETH Regime Parameter Optimizer v2
 * Comprehensive grid search for optimal PEG, TRIGGER, and PROFIT_SCORE
 * Tests 300+ configurations to find best parameter combination
 */

import * as fs from 'fs';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import type { MarketTick } from '../services/vfmd/types';

const DATA_DAYS = 365;
const INITIAL_CAPITAL = 1000;
const MAX_POSITION_SIZE = 0.4;
const SLIPPAGE_BPS = 2;
const COMMISSION_BPS = 1;

// Parameter grid to test - more focused based on previous results
const PROFIT_SCORES = [25, 28, 30, 32, 35, 38, 40, 42, 45];

// Test regime-specific PEG and TRIGGER combinations
const REGIME_PARAMS_GRID = [
  // Conservative (baseline-like)
  {
    name: 'Conservative',
    params: {
      consolidation: { peg: 25, trigger: 0.10 },
      distribution: { peg: 35, trigger: 0.15 },
      turbulent_chop: { peg: 40, trigger: 0.12 },
      laminar_trend: { peg: 25, trigger: 0.10 },
      breakout_transition: { peg: 40, trigger: 0.12 },
      accumulation: { peg: 35, trigger: 0.15 }
    }
  },
  // Moderate (current deployed)
  {
    name: 'Current',
    params: {
      consolidation: { peg: 20, trigger: 0.10 },
      distribution: { peg: 30, trigger: 0.15 },
      turbulent_chop: { peg: 35, trigger: 0.10 },
      laminar_trend: { peg: 20, trigger: 0.10 },
      breakout_transition: { peg: 35, trigger: 0.12 },
      accumulation: { peg: 30, trigger: 0.15 }
    }
  },
  // Aggressive (lower PEG)
  {
    name: 'Aggressive',
    params: {
      consolidation: { peg: 15, trigger: 0.10 },
      distribution: { peg: 25, trigger: 0.12 },
      turbulent_chop: { peg: 30, trigger: 0.10 },
      laminar_trend: { peg: 15, trigger: 0.10 },
      breakout_transition: { peg: 30, trigger: 0.10 },
      accumulation: { peg: 25, trigger: 0.12 }
    }
  },
  // Very Aggressive (even lower PEG)
  {
    name: 'VeryAggressive',
    params: {
      consolidation: { peg: 12, trigger: 0.08 },
      distribution: { peg: 20, trigger: 0.10 },
      turbulent_chop: { peg: 25, trigger: 0.08 },
      laminar_trend: { peg: 12, trigger: 0.08 },
      breakout_transition: { peg: 25, trigger: 0.08 },
      accumulation: { peg: 20, trigger: 0.10 }
    }
  },
  // Trigger-focused relaxation
  {
    name: 'LooseTrigger',
    params: {
      consolidation: { peg: 20, trigger: 0.08 },
      distribution: { peg: 30, trigger: 0.12 },
      turbulent_chop: { peg: 35, trigger: 0.08 },
      laminar_trend: { peg: 20, trigger: 0.08 },
      breakout_transition: { peg: 35, trigger: 0.10 },
      accumulation: { peg: 30, trigger: 0.12 }
    }
  }
];

interface OptimizationResult {
  configName: string;
  profitScore: number;
  trades: number;
  winRate: number;
  profitFactor: number;
  sharpe: number;
  pnl: number;
  maxDD: number;
  score: number;
  buyTrades: number;
  avgConfidence: number;
}

async function runBacktest(
  ticks: MarketTick[],
  profitScore: number,
  regimeParams: Record<string, {peg: number; trigger: number}>,
  configName: string
): Promise<OptimizationResult | null> {
  try {
    const agent = new VFMDPhysicsAgent('optimizer', 'balanced');
    agent.setAsset('ETH');
    (agent as any).setProfitScoreThreshold?.('ETH', profitScore);
    (agent as any).setRegimeParameters?.('ETH', regimeParams);

    let capital = INITIAL_CAPITAL;
    let peakCapital = INITIAL_CAPITAL;
    const equityCurve: number[] = [INITIAL_CAPITAL];
    let winningTrades = 0;
    let losingTrades = 0;
    let totalWinPnL = 0;
    let totalLossPnL = 0;
    let buyTrades = 0;
    let confidenceSum = 0;
    let signalCount = 0;

    for (let i = 20; i < ticks.length - 1; i++) {
      const historicalTicks = ticks.slice(0, i + 1);
      const tick = ticks[i];
      const nextTick = ticks[i + 1];

      const signal = agent.generateSignal(historicalTicks);
      if (signal.action === 'HOLD') continue;

      signalCount++;
      confidenceSum += signal.confidence;

      if (signal.action === 'BUY') buyTrades++;

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
    }

    const totalTrades = winningTrades + losingTrades;
    if (totalTrades === 0) return null;

    const winRate = winningTrades / totalTrades;
    const profitFactor = totalLossPnL > 0 ? totalWinPnL / totalLossPnL : (totalWinPnL > 0 ? 999 : 0);
    const totalPnL = capital - INITIAL_CAPITAL;
    const maxDD = ((Math.min(...equityCurve) - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;
    const avgConfidence = signalCount > 0 ? confidenceSum / signalCount : 0;

    // Calculate Sharpe
    const returns = equityCurve.map((v, i) => i === 0 ? 0 : (v - equityCurve[i - 1]) / equityCurve[i - 1]);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252 * 24) : 0;

    // Composite score: balance between trade count, PnL, and metrics
    // Priorities: PnL (35%), Trade Count (25%), Sharpe (20%), Win Rate (20%)
    const pnlScore = Math.min(totalPnL / 50, 1) * 35; // Target $50 PnL
    const tradeScore = Math.min(totalTrades / 300, 1) * 25; // Target 300 trades
    const sharpeScore = Math.min(sharpe / 3.0, 1) * 20; // Target Sharpe 3.0
    const wrScore = Math.min(winRate / 0.55, 1) * 20; // Target 55% WR
    const compositeScore = pnlScore + tradeScore + sharpeScore + wrScore;

    return {
      configName,
      profitScore,
      trades: totalTrades,
      winRate,
      profitFactor,
      sharpe,
      pnl: totalPnL,
      maxDD,
      score: compositeScore,
      buyTrades,
      avgConfidence
    };
  } catch (error) {
    console.error(`❌ Error in ${configName} / PS ${profitScore}: ${error}`);
    return null;
  }
}

async function optimizeRegimes() {
  console.log('🚀 ETH REGIME PARAMETER OPTIMIZER v2');
  console.log('='.repeat(90));
  console.log(`Testing ${PROFIT_SCORES.length * REGIME_PARAMS_GRID.length} configurations...\n`);

  // Load ETH data
  const cacheFile = `./data/cache/ETHUSDT_1h_${DATA_DAYS}d.json`;
  const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  const ticks: MarketTick[] = Array.isArray(cachedData) ? cachedData : (cachedData.data || cachedData.ticks || cachedData);
  console.log(`✅ Loaded ${ticks.length} ETH candles\n`);

  const allResults: OptimizationResult[] = [];
  let testNum = 0;
  const totalTests = PROFIT_SCORES.length * REGIME_PARAMS_GRID.length;

  for (const regimeConfig of REGIME_PARAMS_GRID) {
    console.log(`\n📋 Testing "${regimeConfig.name}" regime configuration:`);
    console.log('-'.repeat(90));

    const configResults: OptimizationResult[] = [];

    for (const profitScore of PROFIT_SCORES) {
      testNum++;
      process.stdout.write(`  [${testNum}/${totalTests}] PS=${profitScore}... `);

      const result = await runBacktest(ticks, profitScore, regimeConfig.params, regimeConfig.name);
      
      if (result) {
        configResults.push(result);
        allResults.push(result);
        console.log(`✓ ${result.trades} trades | ${(result.winRate * 100).toFixed(1)}% WR | $${result.pnl.toFixed(0)} | Score ${result.score.toFixed(1)}`);
      } else {
        console.log(`✗ No trades`);
      }
    }

    // Show best for this config
    if (configResults.length > 0) {
      configResults.sort((a, b) => b.score - a.score);
      const best = configResults[0];
      console.log(`\n  🏆 Best for ${regimeConfig.name}:`);
      console.log(`     PS=${best.profitScore} | ${best.trades} trades | ${(best.winRate * 100).toFixed(1)}% WR | PF ${best.profitFactor.toFixed(2)} | $${best.pnl.toFixed(2)} | Sharpe ${best.sharpe.toFixed(2)}`);
    }
  }

  // Overall top results
  console.log('\n' + '='.repeat(90));
  console.log('🏆 TOP 10 OVERALL CONFIGURATIONS:\n');

  allResults.sort((a, b) => b.score - a.score);
  allResults.slice(0, 10).forEach((result, idx) => {
    console.log(`${idx + 1}. ${result.configName} + PS ${result.profitScore} (Score: ${result.score.toFixed(1)})`);
    console.log(`   Trades: ${result.trades} | WR: ${(result.winRate * 100).toFixed(1)}% | PF: ${result.profitFactor.toFixed(2)} | Sharpe: ${result.sharpe.toFixed(3)}`);
    console.log(`   PnL: $${result.pnl.toFixed(2)} | DD: ${result.maxDD.toFixed(2)}% | AvgConf: ${result.avgConfidence.toFixed(3)}\n`);
  });

  // Save full results
  fs.writeFileSync('./optimizer-results-eth-v2.json', JSON.stringify(allResults, null, 2));
  console.log('✅ Full results saved to: ./optimizer-results-eth-v2.json\n');

  // Recommend best configuration
  const best = allResults[0];
  console.log('📌 RECOMMENDED CONFIGURATION:');
  console.log(`   Configuration: ${best.configName}`);
  console.log(`   Profit Score: ${best.profitScore}`);
  console.log(`   Expected Trades: ${best.trades}`);
  console.log(`   Win Rate: ${(best.winRate * 100).toFixed(1)}%`);
  console.log(`   Profit Factor: ${best.profitFactor.toFixed(2)}`);
  console.log(`   Expected PnL: $${best.pnl.toFixed(2)}`);
  console.log(`   Sharpe Ratio: ${best.sharpe.toFixed(3)}`);
  console.log(`   Max Drawdown: ${best.maxDD.toFixed(2)}%`);
}

optimizeRegimes().catch(console.error);
