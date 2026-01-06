/**
 * Target & Stop Loss Optimizer
 * Tests combinations of targets and stop losses on real market data
 * Using FoR > 60% entry signals
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import FailureOfReversionCalculator from '../services/vfmd/failureOfReversionCalculator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MarketTick {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OptimizationResult {
  target: number;
  stopLoss: number;
  rrr: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  totalReturn: number;
  expectedValue: number;  // (wins × avgWin + losses × avgLoss) / trades
  sharpeRatio: number;
}

export class TargetSLOptimizer {
  private forCalculator: FailureOfReversionCalculator;
  
  constructor() {
    this.forCalculator = new FailureOfReversionCalculator();
  }
  
  private loadMarketData(dataPath: string): MarketTick[] {
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
  
  private calculateSharpe(pnls: number[]): number {
    if (pnls.length < 2) return 0;
    
    const mean = pnls.reduce((a, b) => a + b, 0) / pnls.length;
    const variance = pnls.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / pnls.length;
    const stddev = Math.sqrt(variance);
    
    if (stddev === 0) return 0;
    return (mean / stddev) * Math.sqrt(252); // Annualized
  }
  
  async run(symbol: string, dataPath: string): Promise<OptimizationResult[]> {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`OPTIMIZING TARGETS & STOP LOSSES: ${symbol}`);
    console.log(`${'='.repeat(80)}`);
    
    const allCandles = this.loadMarketData(dataPath);
    console.log(`📊 Loaded ${allCandles.length} candles`);
    
    const FoR_THRESHOLD = 60;
    const HOLDING_PERIOD = symbol === 'BTC/USDT' ? 30 : 8;
    
    // Test combinations
    const targets = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
    const stopLosses = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0];
    
    const results: OptimizationResult[] = [];
    let completed = 0;
    const total = targets.length * stopLosses.length;
    
    for (const target of targets) {
      for (const sl of stopLosses) {
        // Reset FoR calculator for each combination
        this.forCalculator = new FailureOfReversionCalculator();
        
        const trades: { pnl: number; win: boolean }[] = [];
        let activeTrade: {
          entryPrice: number;
          entryBar: number;
        } | null = null;
        
        const rrr = target / sl;
        
        // Run backtest for this combination
        for (let bar = 50; bar < allCandles.length; bar++) {
          const currentCandle = allCandles[bar];
          const recentPrices = allCandles.slice(Math.max(0, bar - 49), bar + 1).map(c => c.close);
          const fairPrice = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
          
          // Feed FoR
          this.forCalculator.processTick(currentCandle, fairPrice, currentCandle.close, 0);
          const forState = this.forCalculator.calculateFoR(currentCandle.close, fairPrice, 0);
          const forScorePct = forState.forScore * 100;
          
          // ENTRY
          if (forScorePct > FoR_THRESHOLD && !activeTrade) {
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
            let pnl = 0;
            let isWin = false;
            
            if (priceMovePercent >= target) {
              shouldExit = true;
              pnl = target;
              isWin = true;
            } else if (priceMovePercent <= -sl) {
              shouldExit = true;
              pnl = -sl;
              isWin = false;
            } else if (barsHeld >= HOLDING_PERIOD) {
              shouldExit = true;
              pnl = priceMovePercent;
              isWin = priceMovePercent > 0;
            }
            
            if (shouldExit) {
              trades.push({ pnl, win: isWin });
              activeTrade = null;
            }
          }
        }
        
        // Calculate metrics
        if (trades.length > 0) {
          const wins = trades.filter(t => t.win).length;
          const losses = trades.length - wins;
          const winRate = (wins / trades.length) * 100;
          
          const avgWin = wins > 0 
            ? trades.filter(t => t.win).reduce((sum, t) => sum + t.pnl, 0) / wins 
            : 0;
          
          const avgLoss = losses > 0 
            ? trades.filter(t => !t.win).reduce((sum, t) => sum + t.pnl, 0) / losses 
            : 0;
          
          const totalReturn = trades.reduce((sum, t) => sum + t.pnl, 0);
          const profitFactor = wins > 0 && losses > 0
            ? Math.abs(trades.filter(t => t.win).reduce((sum, t) => sum + t.pnl, 0) / 
                       trades.filter(t => !t.win).reduce((sum, t) => sum + t.pnl, 0))
            : (wins > 0 ? Infinity : 0);
          
          const expectedValue = (wins * avgWin + losses * avgLoss) / trades.length;
          const sharpe = this.calculateSharpe(trades.map(t => t.pnl));
          
          results.push({
            target,
            stopLoss: sl,
            rrr,
            trades: trades.length,
            wins,
            losses,
            winRate,
            avgWin,
            avgLoss,
            profitFactor,
            totalReturn,
            expectedValue,
            sharpeRatio: sharpe,
          });
        } else {
          results.push({
            target,
            stopLoss: sl,
            rrr,
            trades: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            avgWin: 0,
            avgLoss: 0,
            profitFactor: 0,
            totalReturn: 0,
            expectedValue: 0,
            sharpeRatio: 0,
          });
        }
        
        completed++;
        if (completed % 10 === 0) {
          process.stdout.write(`\r  Progress: ${completed}/${total} combinations tested`);
        }
      }
    }
    
    console.log(`\r  Progress: ${total}/${total} combinations tested ✅\n`);
    
    return results.sort((a, b) => b.expectedValue - a.expectedValue);
  }
}

async function runOptimization() {
  const optimizer = new TargetSLOptimizer();
  
  const configs = [
    {
      symbol: 'BTC/USDT',
      dataPath: path.join(__dirname, '../../data/cache/BTCUSDT_1h_365d.json'),
    },
    {
      symbol: 'ETH/USDT',
      dataPath: path.join(__dirname, '../../data/cache/ETHUSDT_1h_365d.json'),
    },
  ];
  
  const allResults: Map<string, OptimizationResult[]> = new Map();
  
  for (const config of configs) {
    try {
      const results = await optimizer.run(config.symbol, config.dataPath);
      allResults.set(config.symbol, results);
      
      // Display top 15 results
      console.log(`\n📊 TOP 15 CONFIGURATIONS FOR ${config.symbol}:\n`);
      console.log('Rank | Target | SL    | RRR  | Trades | Win% | Profit Factor | Expected Value | Sharpe');
      console.log('-'.repeat(95));
      
      for (let i = 0; i < Math.min(15, results.length); i++) {
        const r = results[i];
        const rank = (i + 1).toString().padEnd(4);
        const tgt = r.target.toFixed(2).padEnd(6);
        const sl = r.stopLoss.toFixed(2).padEnd(5);
        const rrr = r.rrr.toFixed(2).padEnd(5);
        const trades = r.trades.toString().padEnd(7);
        const wr = r.winRate.toFixed(1).padEnd(5);
        const pf = r.profitFactor === Infinity ? '∞'.padEnd(14) : r.profitFactor.toFixed(2).padEnd(14);
        const ev = r.expectedValue.toFixed(3).padEnd(15);
        const sharpe = r.sharpeRatio.toFixed(2);
        
        console.log(`${rank}| ${tgt}| ${sl}| ${rrr}| ${trades}| ${wr}| ${pf}| ${ev}| ${sharpe}`);
      }
      
      // Highlight best by different metrics
      const bestByEV = results[0];
      const bestByWinRate = [...results].sort((a, b) => b.winRate - a.winRate)[0];
      const bestByPF = [...results].filter(r => r.trades > 0).sort((a, b) => b.profitFactor - a.profitFactor)[0];
      const bestByRRR = [...results].filter(r => r.trades > 0).sort((a, b) => b.rrr - a.rrr)[0];
      
      console.log(`\n🎯 BEST BY METRIC:\n`);
      console.log(`├─ Expected Value: ${bestByEV.target}% target / ${bestByEV.stopLoss}% SL (EV: ${bestByEV.expectedValue.toFixed(3)}%)`);
      console.log(`├─ Win Rate: ${bestByWinRate.target}% target / ${bestByWinRate.stopLoss}% SL (${bestByWinRate.winRate.toFixed(1)}%)`);
      console.log(`├─ Profit Factor: ${bestByPF.target}% target / ${bestByPF.stopLoss}% SL (${bestByPF.profitFactor.toFixed(2)}x)`);
      console.log(`└─ Risk/Reward: ${bestByRRR.target}% target / ${bestByRRR.stopLoss}% SL (${bestByRRR.rrr.toFixed(2)}:1)\n`);
      
    } catch (error) {
      console.error(`❌ Error optimizing ${config.symbol}:`, error);
    }
  }
  
  // Comparison
  console.log(`\n${'='.repeat(80)}`);
  console.log('FINAL RECOMMENDATIONS');
  console.log(`${'='.repeat(80)}\n`);
  
  for (const [symbol, results] of allResults) {
    if (results.length > 0) {
      const best = results[0];
      console.log(`${symbol}:`);
      console.log(`  🎯 Optimal: ${best.target}% target / ${best.stopLoss}% stop loss`);
      console.log(`  📊 Metrics: ${best.winRate.toFixed(1)}% WR, ${best.profitFactor.toFixed(2)}x PF, EV: ${best.expectedValue.toFixed(3)}%`);
      console.log(`  📈 Expected year return: ${(best.expectedValue * (symbol === 'BTC/USDT' ? 91 : 169)).toFixed(1)}% on ${best.trades} trades`);
      console.log(`  🚀 $1k account after 1 year: $${(1000 * (1 + best.expectedValue * (symbol === 'BTC/USDT' ? 91 : 169) / 100)).toFixed(0)}\n`);
    }
  }
  
  console.log(`${'='.repeat(80)}`);
  console.log('✅ Optimization complete');
  console.log(`${'='.repeat(80)}`);
}

runOptimization().catch(console.error);
