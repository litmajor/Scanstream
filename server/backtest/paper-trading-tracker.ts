/**
 * PAPER TRADING TRACKER
 * Track live execution vs backtest expectations
 * Helps validate before scaling to real money
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PaperTrade {
  tradeId: number;
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
  executionTime: string; // Duration from entry to exit
  notes?: string;
}

interface DailyStats {
  date: string;
  tradesExecuted: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnL: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxEquity: number;
  minEquity: number;
}

interface PaperTradeSession {
  sessionId: string;
  startDate: string;
  startingCapital: number;
  currentEquity: number;
  peakEquity: number;
  trades: PaperTrade[];
  dailyStats: DailyStats[];
  backtestExpectations: {
    asset: string;
    expectedWinRate: number;
    expectedTradesPerMonth: number;
    expectedAvgWinPct: number;
  };
}

const dataDir = path.join(process.cwd(), 'data', 'paper-trading');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function createNewSession(
  asset: string,
  startingCapital: number,
  expectedWinRate: number,
  expectedTradesPerMonth: number,
  expectedAvgWinPct: number
): PaperTradeSession {
  return {
    sessionId: `${asset}-${Date.now()}`,
    startDate: new Date().toISOString(),
    startingCapital,
    currentEquity: startingCapital,
    peakEquity: startingCapital,
    trades: [],
    dailyStats: [],
    backtestExpectations: {
      asset,
      expectedWinRate,
      expectedTradesPerMonth,
      expectedAvgWinPct
    }
  };
}

function loadSession(sessionId: string): PaperTradeSession | null {
  const filePath = path.join(dataDir, `${sessionId}.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return null;
}

function saveSession(session: PaperTradeSession) {
  ensureDataDir();
  const safeSessionId = session.sessionId.replace(/\//g, '-');
  const filePath = path.join(dataDir, `${safeSessionId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
}

function addTrade(
  session: PaperTradeSession,
  trade: Omit<PaperTrade, 'tradeId'>
): PaperTradeSession {
  const newTrade: PaperTrade = {
    ...trade,
    tradeId: session.trades.length + 1
  };

  session.trades.push(newTrade);
  session.currentEquity += trade.pnlDollars;

  if (session.currentEquity > session.peakEquity) {
    session.peakEquity = session.currentEquity;
  }

  saveSession(session);
  return session;
}

function generateDailyStats(session: PaperTradeSession): DailyStats[] {
  const statsByDate = new Map<string, PaperTrade[]>();

  // Group trades by date
  for (const trade of session.trades) {
    const date = trade.timestamp.split('T')[0];
    if (!statsByDate.has(date)) {
      statsByDate.set(date, []);
    }
    statsByDate.get(date)!.push(trade);
  }

  const dailyStats: DailyStats[] = [];
  let equity = session.startingCapital;

  for (const [date, trades] of Array.from(statsByDate.entries()).sort()) {
    const wins = trades.filter(t => t.won).length;
    const losses = trades.filter(t => !t.won).length;
    const totalPnL = trades.reduce((sum, t) => sum + t.pnlDollars, 0);
    const avgWin = wins > 0 ? trades.filter(t => t.won).reduce((sum, t) => sum + t.pnlDollars, 0) / wins : 0;
    const avgLoss = losses > 0 ? trades.filter(t => !t.won).reduce((sum, t) => sum + t.pnlDollars, 0) / losses : 0;
    const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : (wins > 0 ? 999 : 0);

    equity += totalPnL;

    dailyStats.push({
      date,
      tradesExecuted: trades.length,
      wins,
      losses,
      winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
      totalPnL,
      avgWin,
      avgLoss,
      profitFactor,
      maxEquity: equity,
      minEquity: equity - Math.max(...trades.map(t => Math.abs(t.pnlDollars)))
    });
  }

  return dailyStats;
}

function generateReport(session: PaperTradeSession) {
  const dailyStats = generateDailyStats(session);
  const totalTrades = session.trades.length;
  const wins = session.trades.filter(t => t.won).length;
  const losses = totalTrades - wins;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

  const totalProfit = session.currentEquity - session.startingCapital;
  const returnPct = (totalProfit / session.startingCapital) * 100;
  const maxDD = ((session.peakEquity - session.currentEquity) / session.peakEquity) * 100;

  const avgWin = wins > 0 ? session.trades.filter(t => t.won).reduce((sum, t) => sum + t.pnlDollars, 0) / wins : 0;
  const avgLoss = losses > 0 ? session.trades.filter(t => !t.won).reduce((sum, t) => sum + t.pnlDollars, 0) / losses : 0;
  const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : (wins > 0 ? 999 : 0);

  const daysSinceStart = Math.ceil(
    (new Date().getTime() - new Date(session.startDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const tradesPerDay = daysSinceStart > 0 ? (totalTrades / daysSinceStart).toFixed(2) : '0';

  console.log('\n' + '='.repeat(80));
  console.log(`📊 PAPER TRADING REPORT - ${session.backtestExpectations.asset}`);
  console.log('='.repeat(80));

  console.log('\n📈 SESSION METRICS:');
  console.log(`  Session ID: ${session.sessionId}`);
  console.log(`  Start Date: ${session.startDate.split('T')[0]}`);
  console.log(`  Days Active: ${daysSinceStart}`);
  console.log(`  Trades Per Day: ${tradesPerDay}`);

  console.log('\n💰 ACCOUNT PERFORMANCE:');
  console.log(`  Starting Capital: $${session.startingCapital.toFixed(0)}`);
  console.log(`  Current Equity: $${session.currentEquity.toFixed(0)}`);
  console.log(`  Peak Equity: $${session.peakEquity.toFixed(0)}`);
  console.log(`  Total Profit: $${totalProfit.toFixed(0)}`);
  console.log(`  Return: ${returnPct.toFixed(1)}%`);
  console.log(`  Max Drawdown: ${maxDD.toFixed(1)}%`);

  console.log('\n🎯 TRADE STATISTICS:');
  console.log(`  Total Trades: ${totalTrades}`);
  console.log(`  Wins: ${wins}`);
  console.log(`  Losses: ${losses}`);
  console.log(`  Win Rate: ${winRate.toFixed(1)}%`);
  console.log(`  Avg Win: $${avgWin.toFixed(0)}`);
  console.log(`  Avg Loss: $${avgLoss.toFixed(0)}`);
  console.log(`  Profit Factor: ${profitFactor.toFixed(2)}x`);

  console.log('\n📊 BACKTEST vs LIVE COMPARISON:');
  console.log(`  Expected Win Rate: ${session.backtestExpectations.expectedWinRate.toFixed(1)}%`);
  console.log(`  Actual Win Rate: ${winRate.toFixed(1)}%`);
  const wrDiff = winRate - session.backtestExpectations.expectedWinRate;
  if (Math.abs(wrDiff) > 10) {
    console.log(`  ⚠️  Significant variance: ${wrDiff > 0 ? '+' : ''}${wrDiff.toFixed(1)}pp`);
  }

  console.log(`  Expected Trades/Month: ${session.backtestExpectations.expectedTradesPerMonth}`);
  const actualTradesPerMonth = (totalTrades / daysSinceStart) * 30;
  console.log(`  Actual Trades/Month: ${actualTradesPerMonth.toFixed(0)}`);

  console.log(`  Expected Avg Win: ${session.backtestExpectations.expectedAvgWinPct.toFixed(2)}%`);
  const actualAvgWinPct = avgWin > 0 ? (avgWin / session.startingCapital) * 100 : 0;
  console.log(`  Actual Avg Win: ${actualAvgWinPct.toFixed(2)}%`);

  console.log('\n📅 DAILY PERFORMANCE (Last 10 Days):');
  console.log('Date       | Trades | W/L | Win% | P&L    | Equity ');
  console.log('-----------|--------|-----|------|--------|----------');

  const last10Days = dailyStats.slice(-10);
  for (const day of last10Days) {
    const pnlStr = day.totalPnL >= 0 ? `+$${day.totalPnL.toFixed(0)}` : `-$${Math.abs(day.totalPnL).toFixed(0)}`;
    console.log(
      `${day.date} | ${day.tradesExecuted.toString().padEnd(6)} | ${day.wins}/${day.losses} | ${day.winRate.toFixed(0)}%  | ${pnlStr.padEnd(6)} | $${day.maxEquity.toFixed(0)}`
    );
  }

  console.log('\n🚦 READINESS FOR REAL MONEY:');
  const checks = {
    minTrades: totalTrades >= 50,
    minWinRate: winRate >= 75,
    minProfit: totalProfit > 0,
    consistencyCheck: dailyStats.slice(-10).filter(d => d.winRate >= 70).length >= 5
  };

  console.log(`  ✅ 50+ trades (${totalTrades >= 50 ? '✓' : '✗'}): ${totalTrades}`);
  console.log(`  ✅ 75%+ win rate (${winRate >= 75 ? '✓' : '✗'}): ${winRate.toFixed(1)}%`);
  console.log(`  ✅ Profitable (${totalProfit > 0 ? '✓' : '✗'}): $${totalProfit.toFixed(0)}`);
  console.log(`  ✅ Last 10 days consistent (${checks.consistencyCheck ? '✓' : '✗'}): ${dailyStats.slice(-10).filter(d => d.winRate >= 70).length}/10 days >70%`);

  if (checks.minTrades && checks.minWinRate && checks.minProfit && checks.consistencyCheck) {
    console.log('\n🟢 READY FOR REAL MONEY (at 1% risk per trade)');
  } else {
    console.log('\n🟡 CONTINUE PAPER TRADING until all checks pass');
  }

  console.log('\n' + '='.repeat(80));
}

// Demo: Create a sample session and add some trades
console.log('📋 PAPER TRADING TRACKER - SETUP GUIDE\n');

const sampleSession = createNewSession(
  'BTC/USDT',
  5000,
  90.1, // Expected win rate from backtest
  7,    // Expected ~91 trades/year = ~7-8 per month
  3.0   // Expected 3% avg win
);

console.log('✅ Created new paper trading session:');
console.log(`   Session ID: ${sampleSession.sessionId}`);
console.log(`   Asset: ${sampleSession.backtestExpectations.asset}`);
console.log(`   Starting Capital: $${sampleSession.startingCapital}`);
console.log(`   Expected Win Rate: ${sampleSession.backtestExpectations.expectedWinRate}%`);

// Add sample trades
const sampleTrades = [
  {
    timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days ago
    asset: 'BTC/USDT',
    entryPrice: 42000,
    exitPrice: 42126,
    quantity: 0.06,
    riskDollars: 150,
    targetPct: 3,
    stopLossPct: 2.5,
    pnlDollars: 180,
    pnlPct: 3.0,
    won: true,
    executionTime: '4.5 hours'
  },
  {
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    asset: 'BTC/USDT',
    entryPrice: 42150,
    exitPrice: 42010,
    quantity: 0.06,
    riskDollars: 150,
    targetPct: 3,
    stopLossPct: 2.5,
    pnlDollars: -150,
    pnlPct: -2.5,
    won: false,
    executionTime: '2.1 hours'
  },
  {
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    asset: 'BTC/USDT',
    entryPrice: 42050,
    exitPrice: 42285,
    quantity: 0.06,
    riskDollars: 150,
    targetPct: 3,
    stopLossPct: 2.5,
    pnlDollars: 188,
    pnlPct: 3.13,
    won: true,
    executionTime: '5.2 hours'
  },
  {
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    asset: 'BTC/USDT',
    entryPrice: 42300,
    exitPrice: 42420,
    quantity: 0.06,
    riskDollars: 150,
    targetPct: 3,
    stopLossPct: 2.5,
    pnlDollars: 186,
    pnlPct: 3.08,
    won: true,
    executionTime: '3.8 hours'
  },
  {
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    asset: 'BTC/USDT',
    entryPrice: 42400,
    exitPrice: 42550,
    quantity: 0.06,
    riskDollars: 150,
    targetPct: 3,
    stopLossPct: 2.5,
    pnlDollars: 192,
    pnlPct: 3.19,
    won: true,
    executionTime: '4.1 hours'
  },
  {
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    asset: 'BTC/USDT',
    entryPrice: 42600,
    exitPrice: 42450,
    quantity: 0.06,
    riskDollars: 150,
    targetPct: 3,
    stopLossPct: 2.5,
    pnlDollars: -150,
    pnlPct: -2.5,
    won: false,
    executionTime: '1.9 hours'
  },
  {
    timestamp: new Date().toISOString(),
    asset: 'BTC/USDT',
    entryPrice: 42500,
    exitPrice: 42728,
    quantity: 0.06,
    riskDollars: 150,
    targetPct: 3,
    stopLossPct: 2.5,
    pnlDollars: 195,
    pnlPct: 3.24,
    won: true,
    executionTime: '6.3 hours'
  }
];

console.log(`\n✅ Adding ${sampleTrades.length} sample trades...\n`);

let updatedSession = sampleSession;
for (const trade of sampleTrades) {
  updatedSession = addTrade(updatedSession, trade);
}

// Generate and display report
generateReport(updatedSession);

console.log('\n💡 HOW TO USE:');
console.log('');
console.log('1. CREATE NEW SESSION:');
console.log('   const session = createNewSession("BTC/USDT", 5000, 90.1, 7, 3.0);');
console.log('');
console.log('2. ADD TRADES AS YOU EXECUTE:');
console.log('   session = addTrade(session, { entryPrice, exitPrice, ... });');
console.log('');
console.log('3. MONITOR PERFORMANCE:');
console.log('   generateReport(session);');
console.log('');
console.log('4. LOAD EXISTING SESSION:');
console.log('   const session = loadSession("BTC/USDT-1234567890");');
console.log('');
console.log('✅ Sample session saved for reference\n');
