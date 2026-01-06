/**
 * Complete ETH Optimization
 * Tests: FoR thresholds (40%, 50%, 60%) × Targets (1-5%) × Stop Losses (0.5-2%) × Holding Periods (4-16 bars)
 * Goal: Find profitable configuration for ETH/USDT
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import FailureOfReversionCalculator from '../services/vfmd/failureOfReversionCalculator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MarketTick {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface OptimizationConfig {
  forThreshold: number;
  target: number;
  stopLoss: number;
  holdingPeriod: number;
}

interface TradeResult {
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  exitReason: string;
}

interface OptimizationResult extends OptimizationConfig {
  trades: TradeResult[];
  winRate: number;
  profitFactor: number;
  expectedValue: number;
  annualReturn: number;
  avgWin: number;
  avgLoss: number;
  sharpeRatio: number;
}

function loadMarketData(dataPath: string): MarketTick[] {
  const fileContent = fs.readFileSync(dataPath, 'utf-8');
  const parsed = JSON.parse(fileContent);
  const data = Array.isArray(parsed) ? parsed : parsed.data;
  
  return data.map((candle: any) => ({
    timestamp: candle.timestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  }));
}

function runBacktest(
  allCandles: MarketTick[],
  config: OptimizationConfig
): TradeResult[] {
  const forCalculator = new FailureOfReversionCalculator();
  const trades: TradeResult[] = [];
  
  let activeTrade: {
    entryPrice: number;
    entryBar: number;
  } | null = null;
  
  // Suppress logging
  const originalLog = console.log;
  console.log = () => {};
  
  for (let bar = 50; bar < allCandles.length; bar++) {
    const currentCandle = allCandles[bar];
    const recentPrices = allCandles.slice(Math.max(0, bar - 49), bar + 1).map(c => c.close);
    const fairPrice = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    
    forCalculator.processTick(currentCandle, fairPrice, currentCandle.close, 0);
    const forState = forCalculator.calculateFoR(currentCandle.close, fairPrice, 0);
    const forScorePct = forState.forScore * 100;
    
    // ENTRY
    if (forScorePct > config.forThreshold && !activeTrade) {
      activeTrade = {
        entryPrice: currentCandle.close,
        entryBar: bar,
      };
    }
    
    // EXIT
    if (activeTrade) {
      const barsHeld = bar - activeTrade.entryBar;
      const priceMovePercent = (currentCandle.close - activeTrade.entryPrice) / activeTrade.entryPrice * 100;
      
      let shouldExit = false;
      let exitReason = '';
      
      if (priceMovePercent >= config.target) {
        shouldExit = true;
        exitReason = 'TARGET';
      } else if (priceMovePercent <= -config.stopLoss) {
        shouldExit = true;
        exitReason = 'STOP';
      } else if (barsHeld >= config.holdingPeriod) {
        shouldExit = true;
        exitReason = 'TIME';
      }
      
      if (shouldExit) {
        trades.push({
          entryPrice: activeTrade.entryPrice,
          exitPrice: currentCandle.close,
          pnlPct: priceMovePercent,
          exitReason,
        });
        activeTrade = null;
      }
    }
  }
  
  console.log = originalLog;
  return trades;
}

function analyzeResults(trades: TradeResult[], allCandles: MarketTick[]): Partial<OptimizationResult> {
  if (trades.length === 0) {
    return {
      winRate: 0,
      profitFactor: 0,
      expectedValue: 0,
      annualReturn: 0,
      avgWin: 0,
      avgLoss: 0,
      sharpeRatio: 0,
    };
  }
  
  const wins = trades.filter(t => t.pnlPct > 0);
  const losses = trades.filter(t => t.pnlPct <= 0);
  
  const winRate = (wins.length / trades.length) * 100;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length : 0;
  
  const profitFactor = wins.length > 0 && losses.length > 0
    ? Math.abs(wins.reduce((s, t) => s + t.pnlPct, 0) / losses.reduce((s, t) => s + t.pnlPct, 0))
    : 0;
  
  const totalReturn = trades.reduce((s, t) => s + t.pnlPct, 0);
  const annualReturn = totalReturn * (365 / (allCandles.length / trades.length));
  const expectedValue = (winRate / 100 * avgWin) + ((1 - winRate / 100) * avgLoss);
  
  const sharpeRatio = trades.length > 1
    ? (expectedValue * Math.sqrt(trades.length)) / Math.sqrt(trades.reduce((s, t) => s + Math.pow(t.pnlPct - expectedValue, 2), 0) / trades.length)
    : 0;
  
  return { winRate, profitFactor, expectedValue, annualReturn, avgWin, avgLoss, sharpeRatio };
}

async function optimize() {
  console.log('\n' + '='.repeat(70));
  console.log('🔬 COMPLETE ETH OPTIMIZATION');
  console.log('='.repeat(70));
  
  const dataPath = path.join(__dirname, '../../data/cache/ETHUSDT_1h_365d.json');
  const allCandles = loadMarketData(dataPath);
  
  console.log(`📊 Loaded ${allCandles.length} ETH candles`);
  console.log('\n🧪 Testing configurations...\n');
  
  const forThresholds = [40, 50, 60];
  const targets = [1, 1.5, 2, 2.5, 3, 3.5, 4];
  const stopLosses = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const holdingPeriods = [4, 6, 8, 10, 12, 14, 16];
  
  const allResults: OptimizationResult[] = [];
  let tested = 0;
  const total = forThresholds.length * targets.length * stopLosses.length * holdingPeriods.length;
  
  for (const forThreshold of forThresholds) {
    for (const target of targets) {
      for (const stopLoss of stopLosses) {
        for (const holdingPeriod of holdingPeriods) {
          const config: OptimizationConfig = { forThreshold, target, stopLoss, holdingPeriod };
          const trades = runBacktest(allCandles, config);
          const analysis = analyzeResults(trades, allCandles);
          
          allResults.push({
            ...config,
            trades,
            ...(analysis as Partial<OptimizationResult>),
          } as OptimizationResult);
          
          tested++;
          if (tested % 50 === 0) {
            process.stdout.write(`\r✓ ${tested}/${total}`);
          }
        }
      }
    }
  }
  
  console.log(`\r✓ ${total}/${total} complete!`);
  
  // Filter profitable configurations
  const profitable = allResults.filter(r => r.expectedValue > 0 && r.winRate >= 40);
  profitable.sort((a, b) => b.expectedValue - a.expectedValue);
  
  console.log('\n' + '='.repeat(70));
  console.log('📈 RESULTS: TOP PROFITABLE CONFIGURATIONS');
  console.log('='.repeat(70));
  
  if (profitable.length === 0) {
    console.log('\n⚠️  NO PROFITABLE CONFIGURATIONS FOUND');
    console.log('\nClosest to breakeven (highest expected value):');
    const closestBreakeven = allResults.sort((a, b) => b.expectedValue - a.expectedValue).slice(0, 10);
    
    closestBreakeven.forEach((r, i) => {
      console.log(`\n${i + 1}. FoR>${r.forThreshold}% | Target:${r.target}% | SL:${r.stopLoss}% | Hold:${r.holdingPeriod}bars`);
      console.log(`   Trades: ${r.trades.length} | Win: ${r.winRate.toFixed(1)}% | PF: ${r.profitFactor.toFixed(2)}x | EV: ${r.expectedValue.toFixed(4)}% | Annual: ${r.annualReturn.toFixed(1)}%`);
    });
  } else {
    console.log(`\n✅ Found ${profitable.length} profitable configurations!\n`);
    
    profitable.slice(0, 15).forEach((r, i) => {
      console.log(`${(i + 1).toString().padStart(2)}. FoR>${r.forThreshold}% | Target:${r.target}% | SL:${r.stopLoss}% | Hold:${r.holdingPeriod}bars`);
      console.log(`    Trades:${r.trades.length.toString().padStart(2)} | Win:${r.winRate.toFixed(1).padStart(5)}% | PF:${r.profitFactor.toFixed(2).padStart(4)}x | EV:${r.expectedValue.toFixed(4).padStart(7)}% | Annual:${r.annualReturn.toFixed(1).padStart(6)}%`);
    });
  }
  
  // Statistics by FoR threshold
  console.log('\n' + '='.repeat(70));
  console.log('📊 ANALYSIS BY FoR THRESHOLD');
  console.log('='.repeat(70));
  
  for (const forThresh of forThresholds) {
    const filtered = allResults.filter(r => r.forThreshold === forThresh);
    const profitable_count = filtered.filter(r => r.expectedValue > 0).length;
    const avg_ev = filtered.reduce((s, r) => s + r.expectedValue, 0) / filtered.length;
    const best = filtered.reduce((max, r) => r.expectedValue > max.expectedValue ? r : max);
    
    console.log(`\nFoR > ${forThresh}%:`);
    console.log(`  Configs tested: ${filtered.length}`);
    console.log(`  Profitable: ${profitable_count}`);
    console.log(`  Avg EV: ${avg_ev.toFixed(4)}%`);
    console.log(`  Best: ${best.target}% target / ${best.stopLoss}% SL / ${best.holdingPeriod} bars = ${best.expectedValue.toFixed(4)}% EV`);
  }
  
  // Best configuration details
  if (profitable.length > 0) {
    const best = profitable[0];
    console.log('\n' + '='.repeat(70));
    console.log('🎯 BEST CONFIGURATION - DETAILED ANALYSIS');
    console.log('='.repeat(70));
    console.log(`\nFoR > ${best.forThreshold}% | Target: ${best.target}% | Stop Loss: ${best.stopLoss}% | Holding: ${best.holdingPeriod} bars`);
    console.log(`\nMetrics:`);
    console.log(`  Total Trades: ${best.trades.length}`);
    console.log(`  Wins: ${best.trades.filter(t => t.pnlPct > 0).length} (${best.winRate.toFixed(1)}%)`);
    console.log(`  Losses: ${best.trades.filter(t => t.pnlPct <= 0).length}`);
    console.log(`  Avg Win: ${best.avgWin.toFixed(2)}%`);
    console.log(`  Avg Loss: ${best.avgLoss.toFixed(2)}%`);
    console.log(`  Profit Factor: ${best.profitFactor.toFixed(2)}x`);
    console.log(`  Expected Value: ${best.expectedValue.toFixed(4)}%`);
    console.log(`  Expected Annual Return: ${best.annualReturn.toFixed(1)}%`);
    console.log(`  Sharpe Ratio: ${best.sharpeRatio.toFixed(2)}`);
    console.log(`\n💰 Projected 1-Year Results:`);
    console.log(`  $1,000 → $${(1000 * (1 + best.annualReturn / 100)).toFixed(0)}`);
    console.log(`  $5,000 → $${(5000 * (1 + best.annualReturn / 100)).toFixed(0)}`);
  }
  
  // Save results to JSON
  const resultsPath = path.join(__dirname, '../../ETH_OPTIMIZATION_RESULTS.json');
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    symbol: 'ETH/USDT',
    dataCandles: allCandles.length,
    configsTested: allResults.length,
    profitableCount: profitable.length,
    topResults: profitable.slice(0, 50),
    allResults: allResults,
  }, null, 2));
  
  console.log(`\n✅ Full results saved to ETH_OPTIMIZATION_RESULTS.json`);
  console.log('='.repeat(70) + '\n');
}

optimize().catch(console.error);
