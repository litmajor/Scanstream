/**
 * Cost Stress Test
 * 
 * Tests system robustness by increasing realistic trading costs:
 * - Commission: 0.01% → 0.1% (10x increase)
 * - Slippage: 0.02% → 0.05% (2.5x increase)
 * 
 * Many systems die when costs increase. This isolates the impact.
 * 
 * Usage:
 *   pnpm exec tsx server/scripts/backtest-cost-stress-test.ts
 */

import * as fs from 'fs';
import BinanceDataFetcher from '../services/vfmd/binanceDataFetcher';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import { RegimeClassifier } from '../services/vfmd/regimeClassifier';
import type { MarketTick } from '../services/vfmd/types';

interface CostTestResult {
  costLevel: string;
  commission_bps: number;
  slippage_bps: number;
  btc_trades: number;
  btc_profit: number;
  btc_profit_pct: number;
  btc_win_rate: number;
  btc_sharpe: number;
  eth_trades: number;
  eth_profit: number;
  eth_profit_pct: number;
  eth_win_rate: number;
  eth_sharpe: number;
  combined_trades: number;
  combined_profit: number;
  combined_profit_pct: number;
  combined_win_rate: number;
  combined_sharpe: number;
}

async function runBacktestWithCosts(
  asset: 'BTC' | 'ETH',
  commissionBps: number,
  slippageBps: number
): Promise<{
  trades: number;
  profit: number;
  profitPct: number;
  winRate: number;
  sharpe: number;
}> {
  const agent = new VFMDPhysicsAgent('stress-test', 'balanced');
  agent.setAsset(asset);
  
  const pair = asset === 'BTC' ? 'BTCUSDT' : 'ETHUSDT';
  const cacheFile = `./data/cache/${pair}_1h_365d.json`;
  
  let ticks: MarketTick[];
  if (fs.existsSync(cacheFile)) {
    const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    ticks = Array.isArray(cachedData) ? cachedData : (cachedData.data || cachedData.ticks || cachedData);
  } else {
    const fetcher = new BinanceDataFetcher();
    ticks = await fetcher.fetchHistoricalData(pair, 365, '1h');
    fs.mkdirSync('./data/cache', { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(ticks, null, 2));
  }

  if (ticks.length < 100) {
    throw new Error(`Insufficient data: ${ticks.length} candles`);
  }

  let capital = 1000;
  let trades = 0;
  let wins = 0;
  const dailyReturns: number[] = [];
  const equityCurve = [1000];

  for (let i = 20; i < ticks.length - 1; i++) {
    const historicalTicks = ticks.slice(0, i + 1);
    const signal = agent.generateSignal(historicalTicks);
    const tick = ticks[i];
    const nextTick = ticks[i + 1];

    if (signal.action === 'HOLD' || signal.confidence < 0.25) {
      continue;
    }

    const direction = signal.action === 'BUY' ? 'long' : 'short';
    const positionSize = Math.min((capital * 0.4) / tick.close, capital * 0.4);
    
    const slippageFactor = 1 + (direction === 'long' ? slippageBps : -slippageBps) / 10000;
    const entryPrice = tick.close * slippageFactor;
    
    // Simple exit: opposite signal or 10 candles
    let exitPrice = nextTick.close;
    let candlesHeld = 1;
    
    for (let j = i + 2; j < Math.min(i + 11, ticks.length); j++) {
      const nextSignal = agent.generateSignal(ticks.slice(0, j + 1));
      candlesHeld++;
      
      if ((direction === 'long' && nextSignal.action === 'SELL') ||
          (direction === 'short' && nextSignal.action === 'BUY')) {
        exitPrice = ticks[j].close;
        break;
      }
    }

    // Calculate PnL with realistic costs
    const pnl = direction === 'long'
      ? positionSize * (exitPrice - entryPrice)
      : positionSize * (entryPrice - exitPrice);
    
    const entryCommission = (entryPrice * positionSize * commissionBps / 10000);
    const exitCommission = (exitPrice * positionSize * commissionBps / 10000);
    const totalCost = entryCommission + exitCommission;
    
    const netPnl = pnl - totalCost;
    capital += netPnl;
    
    if (netPnl > 0) wins++;
    trades++;
    
    equityCurve.push(capital);
    dailyReturns.push((capital - equityCurve[equityCurve.length - 2]) / equityCurve[equityCurve.length - 2]);
  }

  const profit = capital - 1000;
  const profitPct = (profit / 1000) * 100;
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;
  
  // Sharpe calculation
  const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b) / dailyReturns.length : 0;
  const variance = dailyReturns.length > 0
    ? dailyReturns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / dailyReturns.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(365) : 0;

  return { trades, profit, profitPct, winRate, sharpe };
}

async function main() {
  console.log('\n🔬 COST STRESS TEST');
  console.log('='.repeat(90));
  console.log('Measuring system robustness as trading costs increase\n');

  const results: CostTestResult[] = [];

  // Test 1: Original costs (baseline)
  console.log('📊 Test 1/3: Original costs (commission 0.01%, slippage 0.02%)');
  const baseline_btc = await runBacktestWithCosts('BTC', 1, 2);
  const baseline_eth = await runBacktestWithCosts('ETH', 1, 2);
  console.log(`  BTC: ${baseline_btc.trades} trades | +${baseline_btc.profitPct.toFixed(2)}% | WR ${baseline_btc.winRate.toFixed(1)}%`);
  console.log(`  ETH: ${baseline_eth.trades} trades | +${baseline_eth.profitPct.toFixed(2)}% | WR ${baseline_eth.winRate.toFixed(1)}%\n`);

  results.push({
    costLevel: 'BASELINE (normal costs)',
    commission_bps: 1,
    slippage_bps: 2,
    btc_trades: baseline_btc.trades,
    btc_profit: baseline_btc.profit,
    btc_profit_pct: baseline_btc.profitPct,
    btc_win_rate: baseline_btc.winRate,
    btc_sharpe: baseline_btc.sharpe,
    eth_trades: baseline_eth.trades,
    eth_profit: baseline_eth.profit,
    eth_profit_pct: baseline_eth.profitPct,
    eth_win_rate: baseline_eth.winRate,
    eth_sharpe: baseline_eth.sharpe,
    combined_trades: baseline_btc.trades + baseline_eth.trades,
    combined_profit: baseline_btc.profit + baseline_eth.profit,
    combined_profit_pct: ((baseline_btc.profit + baseline_eth.profit) / 2000) * 100,
    combined_win_rate: ((baseline_btc.winRate * baseline_btc.trades + baseline_eth.winRate * baseline_eth.trades) / (baseline_btc.trades + baseline_eth.trades)),
    combined_sharpe: (baseline_btc.sharpe + baseline_eth.sharpe) / 2
  });

  // Test 2: Moderate costs
  console.log('📊 Test 2/3: Moderate costs (commission 0.05%, slippage 0.03%)');
  const moderate_btc = await runBacktestWithCosts('BTC', 5, 3);
  const moderate_eth = await runBacktestWithCosts('ETH', 5, 3);
  console.log(`  BTC: ${moderate_btc.trades} trades | +${moderate_btc.profitPct.toFixed(2)}% | WR ${moderate_btc.winRate.toFixed(1)}%`);
  console.log(`  ETH: ${moderate_eth.trades} trades | +${moderate_eth.profitPct.toFixed(2)}% | WR ${moderate_eth.winRate.toFixed(1)}%\n`);

  results.push({
    costLevel: 'MODERATE (realistic costs)',
    commission_bps: 5,
    slippage_bps: 3,
    btc_trades: moderate_btc.trades,
    btc_profit: moderate_btc.profit,
    btc_profit_pct: moderate_btc.profitPct,
    btc_win_rate: moderate_btc.winRate,
    btc_sharpe: moderate_btc.sharpe,
    eth_trades: moderate_eth.trades,
    eth_profit: moderate_eth.profit,
    eth_profit_pct: moderate_eth.profitPct,
    eth_win_rate: moderate_eth.winRate,
    eth_sharpe: moderate_eth.sharpe,
    combined_trades: moderate_btc.trades + moderate_eth.trades,
    combined_profit: moderate_btc.profit + moderate_eth.profit,
    combined_profit_pct: ((moderate_btc.profit + moderate_eth.profit) / 2000) * 100,
    combined_win_rate: ((moderate_btc.winRate * moderate_btc.trades + moderate_eth.winRate * moderate_eth.trades) / (moderate_btc.trades + moderate_eth.trades)),
    combined_sharpe: (moderate_btc.sharpe + moderate_eth.sharpe) / 2
  });

  // Test 3: High costs (stress test)
  console.log('📊 Test 3/3: High costs (commission 0.1%, slippage 0.05%) [STRESS]');
  const stress_btc = await runBacktestWithCosts('BTC', 10, 5);
  const stress_eth = await runBacktestWithCosts('ETH', 10, 5);
  console.log(`  BTC: ${stress_btc.trades} trades | +${stress_btc.profitPct.toFixed(2)}% | WR ${stress_btc.winRate.toFixed(1)}%`);
  console.log(`  ETH: ${stress_eth.trades} trades | +${stress_eth.profitPct.toFixed(2)}% | WR ${stress_eth.winRate.toFixed(1)}%\n`);

  results.push({
    costLevel: 'HIGH (stress test)',
    commission_bps: 10,
    slippage_bps: 5,
    btc_trades: stress_btc.trades,
    btc_profit: stress_btc.profit,
    btc_profit_pct: stress_btc.profitPct,
    btc_win_rate: stress_btc.winRate,
    btc_sharpe: stress_btc.sharpe,
    eth_trades: stress_eth.trades,
    eth_profit: stress_eth.profit,
    eth_profit_pct: stress_eth.profitPct,
    eth_win_rate: stress_eth.winRate,
    eth_sharpe: stress_eth.sharpe,
    combined_trades: stress_btc.trades + stress_eth.trades,
    combined_profit: stress_btc.profit + stress_eth.profit,
    combined_profit_pct: ((stress_btc.profit + stress_eth.profit) / 2000) * 100,
    combined_win_rate: ((stress_btc.winRate * stress_btc.trades + stress_eth.winRate * stress_eth.trades) / (stress_btc.trades + stress_eth.trades)),
    combined_sharpe: (stress_btc.sharpe + stress_eth.sharpe) / 2
  });

  // Analysis
  console.log('\n' + '='.repeat(90));
  console.log('📈 COST IMPACT ANALYSIS\n');

  console.log('Profit % Impact (combined):');
  const baseline_combined_pct = results[0].combined_profit_pct;
  const moderate_combined_pct = results[1].combined_profit_pct;
  const stress_combined_pct = results[2].combined_profit_pct;

  console.log(`  Baseline:  ${baseline_combined_pct.toFixed(2)}%`);
  console.log(`  Moderate:  ${moderate_combined_pct.toFixed(2)}% (${((moderate_combined_pct - baseline_combined_pct) / baseline_combined_pct * 100).toFixed(1)}% impact)`);
  console.log(`  Stress:    ${stress_combined_pct.toFixed(2)}% (${((stress_combined_pct - baseline_combined_pct) / baseline_combined_pct * 100).toFixed(1)}% impact)\n`);

  console.log('System Health Assessment:');
  if (stress_combined_pct > baseline_combined_pct * 0.5) {
    console.log('  ✅ ROBUST: System retains >50% profitability under high costs');
  } else if (stress_combined_pct > baseline_combined_pct * 0.2) {
    console.log('  ⚠️  FRAGILE: System loses >50% profitability but still profitable');
  } else if (stress_combined_pct > 0) {
    console.log('  ❌ VULNERABLE: High costs eliminate most edge');
  } else {
    console.log('  💀 DEAD: System becomes unprofitable at realistic costs');
  }

  // Sharpe comparison
  console.log('\nSharpe Ratio Stability:');
  console.log(`  Baseline:  ${results[0].combined_sharpe.toFixed(3)}`);
  console.log(`  Moderate:  ${results[1].combined_sharpe.toFixed(3)}`);
  console.log(`  Stress:    ${results[2].combined_sharpe.toFixed(3)}`);

  // Save results
  fs.writeFileSync(
    './backtest-cost-stress-results.json',
    JSON.stringify(results, null, 2)
  );

  console.log('\n✅ Results saved to: ./backtest-cost-stress-results.json\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
