/**
 * PAPER TRADING API
 * Integration point for ConvexityAgent to log trades
 * 
 * Usage in ConvexityAgent:
 *   import { logPaperTrade } from './paper-trading-api.ts';
 *   
 *   logPaperTrade({
 *     asset: 'BTC/USDT',
 *     entryPrice: 42000,
 *     exitPrice: 42130,
 *     quantity: 0.06,
 *     riskDollars: 150,
 *     targetPct: 3,
 *     stopLossPct: 2.5,
 *     won: true
 *   });
 */

import * as fs from 'fs';
import * as path from 'path';

interface PaperTradeLog {
  timestamp: string;
  asset: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  riskDollars: number;
  targetPct: number;
  stopLossPct: number;
  pnlDollars: number;
  pnlPct: number;
  won: boolean;
  executionTime?: string;
  notes?: string;
}

interface TradeStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnL: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

const logsDir = path.join(process.cwd(), 'data', 'paper-trading-logs');

function ensureLogsDir() {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

function getLogFilePath(asset: string): string {
  const safeAsset = asset.replace(/\//g, '-');
  return path.join(logsDir, `${safeAsset}.jsonl`);
}

/**
 * Log a single paper trade
 */
export function logPaperTrade(trade: Omit<PaperTradeLog, 'timestamp' | 'pnlDollars' | 'pnlPct'>) {
  ensureLogsDir();

  // Calculate PnL
  const pnlDollars = trade.exitPrice > trade.entryPrice
    ? (trade.exitPrice - trade.entryPrice) * trade.quantity
    : (trade.exitPrice - trade.entryPrice) * trade.quantity;
  
  const pnlPct = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100;

  const log: PaperTradeLog = {
    timestamp: new Date().toISOString(),
    ...trade,
    pnlDollars,
    pnlPct
  };

  const filePath = getLogFilePath(trade.asset);
  fs.appendFileSync(filePath, JSON.stringify(log) + '\n');

  return log;
}

/**
 * Get all trades for an asset
 */
export function getTrades(asset: string): PaperTradeLog[] {
  ensureLogsDir();
  const filePath = getLogFilePath(asset);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line) as PaperTradeLog);
}

/**
 * Get stats for an asset
 */
export function getStats(asset: string): TradeStats {
  const trades = getTrades(asset);

  if (trades.length === 0) {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalPnL: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0
    };
  }

  const wins = trades.filter(t => t.won).length;
  const losses = trades.filter(t => !t.won).length;
  const winRate = (wins / trades.length) * 100;

  const totalPnL = trades.reduce((sum, t) => sum + t.pnlDollars, 0);
  const avgWin = wins > 0 ? trades.filter(t => t.won).reduce((sum, t) => sum + t.pnlDollars, 0) / wins : 0;
  const avgLoss = losses > 0 ? trades.filter(t => !t.won).reduce((sum, t) => sum + t.pnlDollars, 0) / losses : 0;
  const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : (wins > 0 ? 999 : 0);

  // Calculate Sharpe ratio (simple: returns per trade / std dev)
  const returns = trades.map(t => t.pnlPct);
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0; // Annualized

  // Calculate max drawdown
  let maxDD = 0;
  let runningMax = 0;
  let equity = 0;
  for (const trade of trades) {
    equity += trade.pnlDollars;
    runningMax = Math.max(runningMax, equity);
    const dd = (equity - runningMax) / runningMax;
    maxDD = Math.min(maxDD, dd);
  }

  return {
    totalTrades: trades.length,
    wins,
    losses,
    winRate,
    totalPnL,
    avgWin,
    avgLoss,
    profitFactor,
    sharpeRatio,
    maxDrawdown: maxDD * 100
  };
}

/**
 * Print stats summary
 */
export function printStats(asset: string) {
  const stats = getStats(asset);
  const trades = getTrades(asset);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 PAPER TRADING STATS - ${asset}`);
  console.log('='.repeat(60));

  console.log(`\n📈 Trade Summary:`);
  console.log(`  Total Trades: ${stats.totalTrades}`);
  console.log(`  Wins: ${stats.wins}`);
  console.log(`  Losses: ${stats.losses}`);
  console.log(`  Win Rate: ${stats.winRate.toFixed(1)}%`);

  console.log(`\n💰 Performance:`);
  console.log(`  Total P&L: $${stats.totalPnL.toFixed(0)}`);
  console.log(`  Avg Win: $${stats.avgWin.toFixed(0)}`);
  console.log(`  Avg Loss: $${stats.avgLoss.toFixed(0)}`);
  console.log(`  Profit Factor: ${stats.profitFactor.toFixed(2)}x`);

  console.log(`\n📉 Risk Metrics:`);
  console.log(`  Sharpe Ratio: ${stats.sharpeRatio.toFixed(2)}`);
  console.log(`  Max Drawdown: ${stats.maxDrawdown.toFixed(1)}%`);

  if (stats.totalTrades >= 50 && stats.winRate >= 75) {
    console.log(`\n🟢 READY FOR REAL MONEY (1% risk per trade)`);
  } else if (stats.totalTrades >= 20 && stats.winRate >= 70) {
    console.log(`\n🟡 CONTINUE PAPER TRADING (almost there!)`);
  } else {
    console.log(`\n🔴 CONTINUE PAPER TRADING (need more data)`);
  }

  console.log(`\n📅 Recent Trades (Last 5):`);
  const recentTrades = trades.slice(-5).reverse();
  console.log('Date       | Time  | Entry   | Exit    | P&L     | W/L');
  console.log('-----------|-------|---------|---------|---------|----');
  for (const trade of recentTrades) {
    const date = trade.timestamp.split('T')[0];
    const time = trade.timestamp.split('T')[1]?.split('.')[0] || '';
    const pnl = trade.pnlDollars >= 0 ? `+$${trade.pnlDollars.toFixed(0)}` : `-$${Math.abs(trade.pnlDollars).toFixed(0)}`;
    console.log(`${date} | ${time} | ${trade.entryPrice.toFixed(0)} | ${trade.exitPrice.toFixed(0)} | ${pnl.padEnd(7)} | ${trade.won ? 'WIN' : 'LOSS'}`);
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * Clear all logs for an asset
 */
export function clearLogs(asset: string) {
  const filePath = getLogFilePath(asset);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`✅ Cleared logs for ${asset}`);
  }
}

// Demo
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🧪 PAPER TRADING API - DEMO\n');

  // Add some sample trades
  console.log('Adding sample trades...\n');

  const sampleTrades = [
    {
      asset: 'BTC/USDT',
      entryPrice: 42000,
      exitPrice: 42126,
      quantity: 0.06,
      riskDollars: 150,
      targetPct: 3,
      stopLossPct: 2.5,
      won: true
    },
    {
      asset: 'BTC/USDT',
      entryPrice: 42150,
      exitPrice: 42010,
      quantity: 0.06,
      riskDollars: 150,
      targetPct: 3,
      stopLossPct: 2.5,
      won: false
    },
    {
      asset: 'BTC/USDT',
      entryPrice: 42050,
      exitPrice: 42285,
      quantity: 0.06,
      riskDollars: 150,
      targetPct: 3,
      stopLossPct: 2.5,
      won: true
    },
    {
      asset: 'BTC/USDT',
      entryPrice: 42300,
      exitPrice: 42420,
      quantity: 0.06,
      riskDollars: 150,
      targetPct: 3,
      stopLossPct: 2.5,
      won: true
    },
    {
      asset: 'BTC/USDT',
      entryPrice: 42400,
      exitPrice: 42550,
      quantity: 0.06,
      riskDollars: 150,
      targetPct: 3,
      stopLossPct: 2.5,
      won: true
    }
  ];

  for (const trade of sampleTrades) {
    logPaperTrade(trade);
  }

  printStats('BTC/USDT');

  console.log('\n💡 INTEGRATION EXAMPLE:\n');
  console.log(`import { logPaperTrade, printStats } from './paper-trading-api.ts';\n`);
  console.log(`// After executing a trade in ConvexityAgent:\n`);
  console.log(`logPaperTrade({\n`);
  console.log(`  asset: 'BTC/USDT',\n`);
  console.log(`  entryPrice: 42000,\n`);
  console.log(`  exitPrice: 42126,\n`);
  console.log(`  quantity: 0.06,\n`);
  console.log(`  riskDollars: 150,\n`);
  console.log(`  targetPct: 3,\n`);
  console.log(`  stopLossPct: 2.5,\n`);
  console.log(`  won: true\n`);
  console.log(`});\n`);
  console.log(`// Check progress anytime:\n`);
  console.log(`printStats('BTC/USDT');\n`);
}
