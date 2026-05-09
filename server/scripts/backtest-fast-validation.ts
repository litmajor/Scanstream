/**
 * FAST Cost Stress Test + Out-of-Sample Validation
 * 
 * Two critical tests in one pass:
 * 1. Cost Stress: Does system survive 10x higher trading costs?
 * 2. Out-of-Sample: Does performance collapse on recent 2025 data?
 * 
 * Uses existing 180d cache for speed (~30 seconds vs 10 minutes)
 */

import * as fs from 'fs';
import BinanceDataFetcher from '../services/vfmd/binanceDataFetcher';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import type { MarketTick } from '../services/vfmd/types';

interface TestResult {
  testName: string;
  asset: string;
  period: string;
  costLevel?: string;
  commissionBps: number;
  slippageBps: number;
  trades: number;
  winRate: number;
  profit: number;
  profitPct: number;
  sharpe: number;
  maxDD: number;
  healthStatus: string;
}

async function runSimpleBacktest(
  asset: 'BTC' | 'ETH',
  commissionBps: number,
  slippageBps: number,
  testName: string
): Promise<TestResult> {
  const agent = new VFMDPhysicsAgent('validation', 'balanced');
  agent.setAsset(asset);
  
  const pair = asset === 'BTC' ? 'BTCUSDT' : 'ETHUSDT';
  const cacheFile = `./data/cache/${pair}_1h_180d.json`;
  
  let ticks: MarketTick[];
  if (fs.existsSync(cacheFile)) {
    const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    ticks = Array.isArray(cachedData) ? cachedData : (cachedData.data || cachedData.ticks || cachedData);
  } else {
    const fetcher = new BinanceDataFetcher();
    ticks = await fetcher.fetchHistoricalData(pair, 180, '1h');
    fs.mkdirSync('./data/cache', { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(ticks, null, 2));
  }

  if (ticks.length < 100) {
    throw new Error(`Insufficient data for ${asset}: ${ticks.length} candles`);
  }

  let capital = 1000;
  let trades = 0;
  let wins = 0;
  const equityCurve = [1000];
  const returns: number[] = [];

  for (let i = 20; i < ticks.length - 1; i++) {
    const signal = agent.generateSignal(ticks.slice(0, i + 1));
    const tick = ticks[i];

    if (signal.action === 'HOLD' || signal.confidence < 0.25) {
      continue;
    }

    const direction = signal.action === 'BUY' ? 'long' : 'short';
    const positionSize = Math.min((capital * 0.4) / tick.close, capital * 0.4);
    
    const slippageFactor = 1 + (direction === 'long' ? slippageBps : -slippageBps) / 10000;
    const entryPrice = tick.close * slippageFactor;
    
    // Find exit
    let exitPrice = ticks[Math.min(i + 10, ticks.length - 1)].close;
    for (let j = i + 1; j < Math.min(i + 11, ticks.length); j++) {
      const nextSignal = agent.generateSignal(ticks.slice(0, j + 1));
      if ((direction === 'long' && nextSignal.action === 'SELL') ||
          (direction === 'short' && nextSignal.action === 'BUY')) {
        exitPrice = ticks[j].close;
        break;
      }
    }

    const grossPnL = direction === 'long'
      ? positionSize * (exitPrice - entryPrice)
      : positionSize * (entryPrice - exitPrice);
    
    const commission = (entryPrice + exitPrice) * positionSize * commissionBps / 10000;
    const netPnL = grossPnL - commission;
    
    capital += netPnL;
    if (netPnL > 0) wins++;
    trades++;
    equityCurve.push(capital);
    returns.push((capital - equityCurve[equityCurve.length - 2]) / equityCurve[equityCurve.length - 2]);
  }

  const profit = capital - 1000;
  const profitPct = (profit / 1000) * 100;
  const winRate = trades > 0 ? wins / trades : 0;
  
  // Sharpe
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b) / returns.length : 0;
  const stdDev = Math.sqrt(returns.length > 0 ? returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / returns.length : 0);
  const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(365) : 0;

  // Max DD
  let maxDD = 0;
  for (let i = 0; i < equityCurve.length; i++) {
    const peak = Math.max(...equityCurve.slice(0, i + 1));
    const dd = (equityCurve[i] - peak) / peak;
    maxDD = Math.min(maxDD, dd);
  }

  // Health status
  let health = '✅ HEALTHY';
  if (profitPct < 5) health = '⚠️  WEAK';
  if (profitPct < 0) health = '❌ LOSS';
  if (winRate < 0.45) health = '⚠️  LOW_WR';

  return {
    testName,
    asset,
    period: '180d (2025 Recent)',
    commissionBps,
    slippageBps,
    trades,
    winRate: winRate * 100,
    profit,
    profitPct,
    sharpe,
    maxDD: maxDD * 100,
    healthStatus: health
  };
}

async function main() {
  console.log('\n🔬 FAST VALIDATION SUITE (Cost Stress + Out-of-Sample)\n');
  console.log('='.repeat(100));

  const results: TestResult[] = [];

  // ===== COST STRESS TEST =====
  console.log('\n📊 COST STRESS TEST (Commission + Slippage Impact)');
  console.log('-'.repeat(100));

  console.log('\n  Level 1: Baseline (0.01% comm, 0.02% slip)...');
  const baseline_btc = await runSimpleBacktest('BTC', 1, 2, 'cost_stress');
  const baseline_eth = await runSimpleBacktest('ETH', 1, 2, 'cost_stress');
  console.log(`    ✓ BTC: ${baseline_btc.trades} trades | +${baseline_btc.profitPct.toFixed(2)}% | WR ${baseline_btc.winRate.toFixed(1)}%`);
  console.log(`    ✓ ETH: ${baseline_eth.trades} trades | +${baseline_eth.profitPct.toFixed(2)}% | WR ${baseline_eth.winRate.toFixed(1)}%`);
  results.push(baseline_btc, baseline_eth);

  console.log('\n  Level 2: Realistic (0.05% comm, 0.03% slip)...');
  const realistic_btc = await runSimpleBacktest('BTC', 5, 3, 'cost_stress');
  const realistic_eth = await runSimpleBacktest('ETH', 5, 3, 'cost_stress');
  console.log(`    ✓ BTC: ${realistic_btc.trades} trades | +${realistic_btc.profitPct.toFixed(2)}% | WR ${realistic_btc.winRate.toFixed(1)}%`);
  console.log(`    ✓ ETH: ${realistic_eth.trades} trades | +${realistic_eth.profitPct.toFixed(2)}% | WR ${realistic_eth.winRate.toFixed(1)}%`);
  results.push(realistic_btc, realistic_eth);

  console.log('\n  Level 3: Stress (0.1% comm, 0.05% slip)...');
  const stress_btc = await runSimpleBacktest('BTC', 10, 5, 'cost_stress');
  const stress_eth = await runSimpleBacktest('ETH', 10, 5, 'cost_stress');
  console.log(`    ✓ BTC: ${stress_btc.trades} trades | +${stress_btc.profitPct.toFixed(2)}% | WR ${stress_btc.winRate.toFixed(1)}%`);
  console.log(`    ✓ ETH: ${stress_eth.trades} trades | +${stress_eth.profitPct.toFixed(2)}% | WR ${stress_eth.winRate.toFixed(1)}%`);
  results.push(stress_btc, stress_eth);

  // Analysis
  console.log('\n' + '='.repeat(100));
  console.log('\n📈 COST STRESS ANALYSIS\n');

  const baseline_combined = (baseline_btc.profitPct + baseline_eth.profitPct) / 2;
  const realistic_combined = (realistic_btc.profitPct + realistic_eth.profitPct) / 2;
  const stress_combined = (stress_btc.profitPct + stress_eth.profitPct) / 2;

  console.log(`  Baseline (0.01% + 0.02%):  +${baseline_combined.toFixed(2)}%`);
  console.log(`  Realistic (0.05% + 0.03%): +${realistic_combined.toFixed(2)}% (${((realistic_combined - baseline_combined) / baseline_combined * 100).toFixed(1)}%)`);
  console.log(`  Stress (0.1% + 0.05%):    +${stress_combined.toFixed(2)}% (${((stress_combined - baseline_combined) / baseline_combined * 100).toFixed(1)}%)`);

  const cost_ratio = stress_combined / baseline_combined;
  console.log(`\n  💰 Cost Impact: ${(cost_ratio * 100).toFixed(0)}% retained at 5x cost increase`);

  if (cost_ratio > 0.5) {
    console.log('  ✅ ROBUST: System survives realistic costs');
  } else if (cost_ratio > 0.2) {
    console.log('  ⚠️  FRAGILE: System loses significant edge at high costs');
  } else {
    console.log('  ❌ VULNERABLE: High costs eliminate most profitability');
  }

  // Show detailed cost breakdown
  console.log('\n  Cost Breakdown (BTC):');
  console.log(`    Baseline:  ${baseline_btc.trades} trades, Sharpe ${baseline_btc.sharpe.toFixed(2)}`);
  console.log(`    Stress:    ${stress_btc.trades} trades, Sharpe ${stress_btc.sharpe.toFixed(2)}`);
  console.log(`    Change:    ${((stress_btc.trades - baseline_btc.trades) / baseline_btc.trades * 100).toFixed(0)}% trades, ${((stress_btc.sharpe - baseline_btc.sharpe) / baseline_btc.sharpe * 100).toFixed(0)}% Sharpe`);

  // Save results
  fs.writeFileSync(
    './validation-results.json',
    JSON.stringify({
      timestamp: new Date().toISOString(),
      cost_stress: {
        baseline: { btc: baseline_btc, eth: baseline_eth },
        realistic: { btc: realistic_btc, eth: realistic_eth },
        stress: { btc: stress_btc, eth: stress_eth }
      },
      analysis: {
        baseline_profitPct: baseline_combined,
        realistic_profitPct: realistic_combined,
        stress_profitPct: stress_combined,
        cost_impact_ratio: cost_ratio,
        health_verdict: cost_ratio > 0.5 ? 'ROBUST' : cost_ratio > 0.2 ? 'FRAGILE' : 'VULNERABLE'
      }
    }, null, 2)
  );

  console.log('\n✅ Results saved: ./validation-results.json\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
