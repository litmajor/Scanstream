/**
 * Simple Backtest Runner
 * Direct execution without complex dependencies
 * Focuses on core metrics: Win rate, Profit factor, Sharpe, Max drawdown
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Trade {
  entryPrice: number;
  exitPrice: number;
  entryBar: number;
  exitBar: number;
  pnlPct: number;
  pnlAbs: number;
  status: 'WIN' | 'LOSS';
}

interface Metrics {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  annualizedReturn: number;
}

/**
 * Load market data
 */
function loadData(filePath: string): Candle[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(content);
  const data = Array.isArray(parsed) ? parsed : parsed.data;
  
  return data.map((c: any) => ({
    timestamp: c.timestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));
}

/**
 * Simple moving average
 */
function sma(data: number[], period: number): number[] {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

/**
 * ATR (Average True Range)
 */
function atr(candles: Candle[], period: number = 14): number[] {
  const tr: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const prev = i > 0 ? candles[i - 1] : null;
    
    const high = c.high;
    const low = c.low;
    const prevClose = prev ? prev.close : c.close;
    
    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);
    
    tr.push(Math.max(tr1, tr2, tr3));
  }
  
  return sma(tr, period);
}

/**
 * Simple backtest: long-only on ADX + momentum
 */
function runBacktest(candles: Candle[]): { trades: Trade[]; metrics: Metrics } {
  const trades: Trade[] = [];
  
  // Calculate indicators
  const closes = candles.map(c => c.close);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const atrValues = atr(candles, 14);
  
  let inTrade = false;
  let entryPrice = 0;
  let entryBar = 0;
  let entryAtr = 0;
  
  for (let bar = 50; bar < candles.length; bar++) {
    const c = candles[bar];
    const prevC = candles[bar - 1];
    
    // Simple entry: close > sma20 > sma50 and ATR above average
    const crossedAbove = prevC.close <= sma20[bar - 1] && c.close > sma20[bar];
    const aboveSma50 = sma20[bar] > sma50[bar];
    const volAtHighs = atrValues[bar] > (atrValues[bar - 5] || atrValues[bar]) * 0.8;
    
    if (!inTrade && crossedAbove && aboveSma50 && volAtHighs) {
      inTrade = true;
      entryPrice = c.close;
      entryBar = bar;
      entryAtr = atrValues[bar];
    }
    
    // Exit: price < SMA20 or 15% move or 30 bars
    if (inTrade) {
      const movePercent = (c.close - entryPrice) / entryPrice;
      const barsHeld = bar - entryBar;
      
      const exitOnBreak = c.close < sma20[bar];
      const exitOnTarget = movePercent > 0.15;
      const exitOnStop = movePercent < -0.025;
      const exitOnTime = barsHeld > 30;
      
      if (exitOnBreak || exitOnTarget || exitOnStop || exitOnTime) {
        const pnlPct = (c.close - entryPrice) / entryPrice;
        trades.push({
          entryPrice,
          exitPrice: c.close,
          entryBar,
          exitBar: bar,
          pnlPct,
          pnlAbs: pnlPct,
          status: pnlPct > 0 ? 'WIN' : 'LOSS',
        });
        inTrade = false;
      }
    }
  }
  
  // Close any open trade at end
  if (inTrade) {
    const lastCandle = candles[candles.length - 1];
    const pnlPct = (lastCandle.close - entryPrice) / entryPrice;
    trades.push({
      entryPrice,
      exitPrice: lastCandle.close,
      entryBar,
      exitBar: candles.length - 1,
      pnlPct,
      pnlAbs: pnlPct,
      status: pnlPct > 0 ? 'WIN' : 'LOSS',
    });
  }
  
  // Calculate metrics
  const wins = trades.filter(t => t.pnlPct > 0).length;
  const losses = trades.filter(t => t.pnlPct < 0).length;
  const winRate = trades.length > 0 ? wins / trades.length : 0;
  
  const grossProfit = trades
    .filter(t => t.pnlPct > 0)
    .reduce((sum, t) => sum + t.pnlPct, 0);
  const grossLoss = trades
    .filter(t => t.pnlPct < 0)
    .reduce((sum, t) => sum + Math.abs(t.pnlPct), 0);
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);
  
  // Max drawdown
  let maxDrawdown = 0;
  let peak = 1;
  let cumulativeReturn = 1;
  for (const trade of trades) {
    cumulativeReturn *= (1 + trade.pnlPct);
    if (cumulativeReturn > peak) {
      peak = cumulativeReturn;
    }
    const dd = (peak - cumulativeReturn) / peak;
    maxDrawdown = Math.max(maxDrawdown, dd);
  }
  
  // Sharpe (simple approximation)
  const returns = trades.map(t => t.pnlPct);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b) / returns.length : 0;
  const variance = returns.length > 1
    ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2)) / (returns.length - 1)
    : 0;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
  
  // Annualized return
  const totalReturn = cumulativeReturn - 1;
  const yearsElapsed = candles.length / 8760;
  const annualizedReturn = yearsElapsed > 0 ? Math.pow(1 + totalReturn, 1 / yearsElapsed) - 1 : 0;
  
  return {
    trades,
    metrics: {
      totalTrades: trades.length,
      winRate: winRate * 100,
      profitFactor,
      maxDrawdown: maxDrawdown * 100,
      sharpeRatio,
      annualizedReturn: annualizedReturn * 100,
    },
  };
}

/**
 * Format and display results
 */
function displayResults(symbol: string, result: ReturnType<typeof runBacktest>): void {
  const m = result.metrics;
  console.log(`\n${'='.repeat(65)}`);
  console.log(`${symbol} - BACKTEST RESULTS`);
  console.log(`${'='.repeat(65)}`);
  console.log(`
📊 Trade Statistics
├─ Total Trades: ${m.totalTrades}
├─ Win Rate: ${m.winRate.toFixed(2)}%
└─ Profit Factor: ${m.profitFactor.toFixed(2)}x

💰 Performance
├─ Annualized Return: ${m.annualizedReturn.toFixed(2)}%
├─ Max Drawdown: ${m.maxDrawdown.toFixed(2)}%
├─ Sharpe Ratio: ${m.sharpeRatio.toFixed(2)}
└─ Recent Trades: ${result.trades.slice(-5).map(t => `${t.pnlPct > 0 ? '✅' : '❌'} ${(t.pnlPct * 100).toFixed(1)}%`).join(', ')}
  `);
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log(`\n🚀 CONVEXITY BACKTEST SUITE\n`);
  
  const dataDir = path.join(__dirname, '../../data/cache');
  
  // BTC Backtest
  console.log(`📖 Loading BTC data...`);
  const btcData = loadData(path.join(dataDir, 'BTCUSDT_1h_365d.json'));
  console.log(`✅ Loaded ${btcData.length} BTC candles`);
  
  console.log(`🔄 Running BTC backtest...`);
  const btcResult = runBacktest(btcData);
  displayResults('BTC/USDT', btcResult);
  
  // ETH Backtest
  console.log(`\n📖 Loading ETH data...`);
  const ethData = loadData(path.join(dataDir, 'ETHUSDT_1h_365d.json'));
  console.log(`✅ Loaded ${ethData.length} ETH candles`);
  
  console.log(`🔄 Running ETH backtest...`);
  const ethResult = runBacktest(ethData);
  displayResults('ETH/USDT', ethResult);
  
  // Summary
  console.log('\n' + '='.repeat(65));
  console.log('SUMMARY');
  console.log('='.repeat(65));
  console.log('\nSymbol       Trades   Win%     PF       Sharpe   AnnRet%');
  console.log('-'.repeat(65));
  
  const btcSym = 'BTC/USDT'.padEnd(12);
  const btcTrades = btcResult.metrics.totalTrades.toString().padEnd(8);
  const btcWin = btcResult.metrics.winRate.toFixed(1).padEnd(8) + '%';
  const btcPf = btcResult.metrics.profitFactor.toFixed(2).padEnd(8) + 'x';
  const btcSharpe = btcResult.metrics.sharpeRatio.toFixed(2).padEnd(8);
  const btcRet = btcResult.metrics.annualizedReturn.toFixed(1) + '%';
  console.log(btcSym + btcTrades + btcWin + btcPf + btcSharpe + btcRet);
  
  const ethSym = 'ETH/USDT'.padEnd(12);
  const ethTrades = ethResult.metrics.totalTrades.toString().padEnd(8);
  const ethWin = ethResult.metrics.winRate.toFixed(1).padEnd(8) + '%';
  const ethPf = ethResult.metrics.profitFactor.toFixed(2).padEnd(8) + 'x';
  const ethSharpe = ethResult.metrics.sharpeRatio.toFixed(2).padEnd(8);
  const ethRet = ethResult.metrics.annualizedReturn.toFixed(1) + '%';
  console.log(ethSym + ethTrades + ethWin + ethPf + ethSharpe + ethRet);
  
  console.log('\n✅ Backtest complete!');
}

main().catch(console.error);
