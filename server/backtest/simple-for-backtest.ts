/**
 * Simple FoR Backtest
 * Tests Failure of Reversion directly without VFMD dependencies
 * Directly evaluates FoR score against 60 threshold (optimal from Phase 2)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import FailureOfReversionCalculator from '../services/vfmd/failureOfReversionCalculator.ts';
import { MetricsCalculator, type TradeResult } from './metrics-calculator.ts';

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

export class SimpleForBacktester {
  private forCalculator: FailureOfReversionCalculator;
  private trades: TradeResult[] = [];
  
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
  
  async run(symbol: string, dataPath: string): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log(`SIMPLE FoR BACKTEST: ${symbol}`);
    console.log('='.repeat(60));
    
    const allCandles = this.loadMarketData(dataPath);
    console.log(`📊 Loaded ${allCandles.length} candles`);
    
    // Test parameters from Phase 2 Optimization
    const FoR_THRESHOLD = 60;  // Optimal from phase 2
    const TARGET_PCT = 3;       // Optimal from phase 2
    const STOP_LOSS_PCT = 2.5;  // Optimal from phase 2
    const HOLDING_PERIOD = symbol === 'BTC/USDT' ? 30 : 8;  // From phase 2
    
    const trades: TradeResult[] = [];
    let activeTrade: {
      entryPrice: number;
      entryBar: number;
      forScore: number;
    } | null = null;
    
    console.log(`🎯 Testing: FoR > ${FoR_THRESHOLD}%, Target: ${TARGET_PCT}%, SL: ${STOP_LOSS_PCT}%`);
    console.log(`⏱️  Holding: ${HOLDING_PERIOD} bars\n`);
    
    console.log('Processing...');
    const startTime = Date.now();
    
    let maxForScore = 0;
    let maxForBar = 0;
    const forScores: number[] = [];
    
    // Calculate SMA50 for fair price
    let sma50: number[] = [];
    
    for (let bar = 50; bar < allCandles.length; bar++) {
      const ticks = allCandles.slice(bar - 49, bar + 1);
      const currentCandle = allCandles[bar];
      
      // Calculate SMA50 as fair price (more realistic than just close)
      const recentPrices = allCandles.slice(Math.max(0, bar - 49), bar + 1).map(c => c.close);
      const fairPrice = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
      
      // Feed FoR calculator
      this.forCalculator.processTick(
        currentCandle,
        fairPrice,
        currentCandle.close,
        0  // ATR not needed for basic test
      );
      
      // Calculate FoR every bar
      const forState = this.forCalculator.calculateFoR(
        currentCandle.close,
        fairPrice,
        0
      );
      
      const forScorePct = forState.forScore * 100;
      forScores.push(forScorePct);
      
      if (forScorePct > maxForScore) {
        maxForScore = forScorePct;
        maxForBar = bar;
      }
      
      // ENTRY: FoR crosses above threshold
      if (forScorePct > FoR_THRESHOLD && !activeTrade) {
        activeTrade = {
          entryPrice: currentCandle.close,
          entryBar: bar,
          forScore: forScorePct,
        };
      }
      
      // EXIT: Either target hit, stop loss hit, or holding period expired
      if (activeTrade) {
        const barsHeld = bar - activeTrade.entryBar;
        const priceMovePercent = (currentCandle.close - activeTrade.entryPrice) / activeTrade.entryPrice * 100;
        
        let shouldExit = false;
        let exitReason = '';
        let pnlPct = priceMovePercent;
        
        if (priceMovePercent >= TARGET_PCT) {
          shouldExit = true;
          exitReason = 'TARGET_HIT';
        } else if (priceMovePercent <= -STOP_LOSS_PCT) {
          shouldExit = true;
          exitReason = 'STOP_LOSS';
        } else if (barsHeld >= HOLDING_PERIOD) {
          shouldExit = true;
          exitReason = 'TIME_EXIT';
        }
        
        if (shouldExit) {
          trades.push({
            entryPrice: activeTrade.entryPrice,
            exitPrice: currentCandle.close,
            quantity: 1.0,
            entryBar: activeTrade.entryBar,
            exitBar: bar,
            pnlPct: priceMovePercent,
            pnlAbs: priceMovePercent,  // Simplified for 1 unit
            status: priceMovePercent > 0 ? 'WIN' : (priceMovePercent < 0 ? 'LOSS' : 'PARTIAL'),
            exitReason,
          });
          
          activeTrade = null;
        }
      }
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ Backtest complete in ${(elapsed / 1000).toFixed(2)}s`);
    
    // FoR Score Statistics
    const avgForScore = forScores.reduce((a, b) => a + b, 0) / forScores.length;
    const sortedScores = [...forScores].sort((a, b) => b - a);
    const percentile95 = sortedScores[Math.floor(sortedScores.length * 0.05)];
    const percentile90 = sortedScores[Math.floor(sortedScores.length * 0.10)];
    
    console.log('\n📈 FoR SCORE DISTRIBUTION:');
    console.log(`├─ Average: ${avgForScore.toFixed(1)}%`);
    console.log(`├─ Max: ${maxForScore.toFixed(1)}% (bar ${maxForBar})`);
    console.log(`├─ 90th percentile: ${percentile90.toFixed(1)}%`);
    console.log(`├─ 95th percentile: ${percentile95.toFixed(1)}%`);
    console.log(`├─ Threshold: ${FoR_THRESHOLD}%`);
    console.log(`└─ Times exceeded threshold: ${forScores.filter(s => s > FoR_THRESHOLD).length}`);
    
    // Metrics
    if (trades.length > 0) {
      const wins = trades.filter(t => t.status === 'WIN').length;
      const losses = trades.filter(t => t.status === 'LOSS').length;
      const winRate = (wins / trades.length) * 100;
      
      const avgWin = trades
        .filter(t => t.status === 'WIN')
        .reduce((sum, t) => sum + t.pnlPct, 0) / Math.max(1, wins);
      
      const avgLoss = trades
        .filter(t => t.status === 'LOSS')
        .reduce((sum, t) => sum + t.pnlPct, 0) / Math.max(1, losses);
      
      const totalReturn = trades.reduce((sum, t) => sum + t.pnlPct, 0);
      const profitFactor = wins > 0 && losses > 0
        ? (trades.filter(t => t.status === 'WIN').reduce((sum, t) => sum + t.pnlPct, 0)) /
          Math.abs(trades.filter(t => t.status === 'LOSS').reduce((sum, t) => sum + t.pnlPct, 0))
        : 0;
      
      console.log('\n📊 TRADING RESULTS:');
      console.log(`├─ Total Trades: ${trades.length}`);
      console.log(`├─ Wins: ${wins} (${winRate.toFixed(1)}%)`);
      console.log(`├─ Losses: ${losses}`);
      console.log(`├─ Avg Win: ${avgWin.toFixed(2)}%`);
      console.log(`├─ Avg Loss: ${avgLoss.toFixed(2)}%`);
      console.log(`├─ Profit Factor: ${profitFactor.toFixed(2)}x`);
      console.log(`├─ Total Return: ${totalReturn.toFixed(1)}%`);
      console.log(`└─ Annualized: ${(totalReturn * 365/allCandles.length).toFixed(1)}%`);
      
      // Expected from Phase 2
      if (symbol === 'BTC/USDT') {
        console.log('\n💡 Phase 2 Expected: 90.1% WR, 30 bar holding, 91 trades/year');
      } else {
        console.log('\n💡 Phase 2 Expected: 75.7% WR, 8 bar holding, 169 trades/year');
      }
    } else {
      console.log('\n⚠️  CRITICAL: No trades generated');
      console.log(`❌ FoR score NEVER exceeded ${FoR_THRESHOLD}% threshold`);
      console.log(`📊 Max FoR score observed: ${maxForScore.toFixed(1)}%`);
      console.log(`\nThis means the Phase 2 "optimal" parameters are NOT VALID on real data.`);
      console.log(`The small-cap simulator showing $1k→$12.9k is THEORETICAL only.`);
    }
  }
}

async function runBacktests() {
  const backtester = new SimpleForBacktester();
  
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
  
  for (const config of configs) {
    try {
      await backtester.run(config.symbol, config.dataPath);
    } catch (error) {
      console.error(`❌ Error: ${error}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ All backtests complete');
  console.log('='.repeat(60));
}

runBacktests().catch(console.error);
