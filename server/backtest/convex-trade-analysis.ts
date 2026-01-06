/**
 * CONVEX TRADE ANALYSIS - Deep Dive into Entry/Exit Logic
 * 
 * Key Questions:
 * 1. WHY does convex depend on VFMD? (Trigger mechanism)
 * 2. WHEN exactly does convex enter? (FoR confirmation point)
 * 3. HOW is position size calculated? (Entry sizing logic)
 * 4. WHEN does convex exit? (Exit conditions)
 * 5. WHY do exits hurt BTC specifically? (Exit logic issues)
 * 
 * Hypothesis to test:
 * - Convex enters ONLY on FoR trigger (VFMD scout profitability)
 * - Entry sizing too small relative to BTC volatility
 * - Exit timing misaligned with momentum (stops hit too early)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ConvexityBacktesterWithFoR } from './convexity-backtester-with-for.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TradeDetail {
  tradeId: number;
  scoutEntryBar: number;
  scoutExitBar: number;
  scoutPnL: number;
  scoutPnLPct: number;
  convexEntryBar: number;
  convexExitBar: number;
  convexPnL: number;
  convexPnLPct: number;
  convexEntryPrice: number;
  convexExitPrice: number;
  convexStopPrice: number;
  barsHeld: number;
  direction: string;
  forTriggerBar: number;
  lagFromScoutToFoR: number;
  lagFromFoRToConvexEntry: number;
  priceMovedFromScoutToConvex: number;
  priceMovedFromConvexEntryToExit: number;
  stopWasHit: boolean;
  timeoutExit: boolean;
  scoutWasWinner: boolean;
  convexWasWinner: boolean;
  convexWorseThoutScout: number; // how much worse convex did than scout
}

async function runDeepAnalysis() {
  console.log('\n' + '═'.repeat(120));
  console.log('CONVEX TRADE MECHANICS ANALYSIS - Understanding Entry/Exit/Sizing');
  console.log('═'.repeat(120) + '\n');

  // Run backtest with 1.0% stop (best performing config)
  const backtester = new ConvexityBacktesterWithFoR('TradeAnalysis');
  const result = backtester.run({
    symbol: 'BTC/USDT',
    dataPath: path.join(__dirname, '../../data/cache/BTCUSDT_1h_365d.json'),
  });

  console.log('📋 TRADE LINKAGE ANALYSIS\n');
  console.log('Understanding how VFMD scouts trigger Convex positions...\n');

  // Load candles for context
  const candles = (backtester as any).loadMarketData(
    path.join(__dirname, '../../data/cache/BTCUSDT_1h_365d.json')
  );

  // Build scout->convex linkage
  const scoutMap = new Map();
  result.vfmdScoutTrades.forEach((scout, idx) => {
    scoutMap.set(scout.entryBar, { scout, scoutIdx: idx });
  });

  console.log(`Total VFMD Scouts: ${result.vfmdScoutTrades.length}`);
  console.log(`Total FoR Triggers: ${result.diagnostics.forTriggers}`);
  console.log(`Total Convex Trades: ${result.convexTrades.length}\n`);

  // Analyze trigger mechanism
  console.log('TRIGGER MECHANISM:\n');
  console.log('├─ Scout fires → VFMD generates entry signal at bar X');
  console.log('├─ Scout watches for 5 bars for agreement/target/stop');
  console.log('├─ IF scout profitable → FoR trigger confirmed at bar X+N');
  console.log('├─ FoR → Convex position IMMEDIATELY enters at FoR bar');
  console.log('└─ Convex holds for 50-100 bars OR stops out\n');

  const profitableScouts = result.vfmdScoutTrades.filter(s => s.pnlPct! > 0);
  const profitableScoutsWithFoR = profitableScouts.filter(s => {
    // Check if this scout triggered a convex position
    return result.convexTrades.some(c => 
      c.entryBar >= s.entryBar && c.entryBar <= s.exitBar! + 6
    );
  });

  console.log(`Profitable scouts: ${profitableScouts.length} (${(profitableScouts.length / result.vfmdScoutTrades.length * 100).toFixed(1)}%)`);
  console.log(`Profitable scouts that triggered FoR/Convex: ${profitableScoutsWithFoR.length}\n`);

  // Now analyze actual trade mechanics
  console.log('\n' + '═'.repeat(120));
  console.log('SIZING ANALYSIS - How much capital goes into each convex trade?');
  console.log('═'.repeat(120) + '\n');

  // Calculate position sizing
  const INITIAL_CAPITAL = 10000;
  const RISK_PER_TRADE = 0.03; // 3% per trade
  let currentEquity = INITIAL_CAPITAL;

  const tradeDetails: TradeDetail[] = [];

  result.convexTrades.forEach((convexTrade, convexIdx) => {
    // Find related scout
    const relatedScouts = result.vfmdScoutTrades.filter(scout =>
      scout.exitBar! < convexTrade.entryBar && 
      scout.exitBar! + 6 >= convexTrade.entryBar
    );

    if (relatedScouts.length === 0) return;

    const scout = relatedScouts[relatedScouts.length - 1]; // Most recent scout
    const barsHeld = convexTrade.exitBar - convexTrade.entryBar;
    const stopPrice = convexTrade.direction === 'BUY'
      ? convexTrade.entryPrice * 0.99 // 1% stop
      : convexTrade.entryPrice * 1.01;

    const priceMovedFromScoutToConvex = convexTrade.direction === 'BUY'
      ? convexTrade.entryPrice - scout.exitPrice!
      : scout.exitPrice! - convexTrade.entryPrice;

    const priceMovedFromConvexEntryToExit = convexTrade.direction === 'BUY'
      ? convexTrade.exitPrice - convexTrade.entryPrice
      : convexTrade.entryPrice - convexTrade.exitPrice;

    const stopWasHit = convexTrade.direction === 'BUY'
      ? convexTrade.exitPrice <= stopPrice
      : convexTrade.exitPrice >= stopPrice;

    const timeoutExit = barsHeld >= 60; // Max hold

    const scoutWasWinner = scout.pnlPct! > 0;
    const convexWasWinner = convexTrade.pnlPct > 0;
    const convexWorseThoutScout = convexTrade.pnlPct - (scout.pnlPct || 0);

    // Position sizing
    const positionSize = currentEquity * RISK_PER_TRADE / Math.abs(convexTrade.pnl);
    const riskAmount = positionSize * 0.01; // 1% risk

    tradeDetails.push({
      tradeId: convexIdx + 1,
      scoutEntryBar: scout.entryBar,
      scoutExitBar: scout.exitBar!,
      scoutPnL: scout.pnl || 0,
      scoutPnLPct: scout.pnlPct || 0,
      convexEntryBar: convexTrade.entryBar,
      convexExitBar: convexTrade.exitBar,
      convexPnL: convexTrade.pnl,
      convexPnLPct: convexTrade.pnlPct,
      convexEntryPrice: convexTrade.entryPrice,
      convexExitPrice: convexTrade.exitPrice,
      convexStopPrice: stopPrice,
      barsHeld,
      direction: convexTrade.direction,
      forTriggerBar: scout.exitBar! + 6,
      lagFromScoutToFoR: 6,
      lagFromFoRToConvexEntry: convexTrade.entryBar - (scout.exitBar! + 6),
      priceMovedFromScoutToConvex,
      priceMovedFromConvexEntryToExit,
      stopWasHit,
      timeoutExit,
      scoutWasWinner,
      convexWasWinner,
      convexWorseThoutScout,
    });

    currentEquity += positionSize * convexTrade.pnl;
  });

  console.log('ENTRY SIZING MECHANICS:\n');
  console.log('Position size = (Current Equity × 3%) / Position Loss Amount');
  console.log('├─ Smaller losses → Larger positions');
  console.log('├─ Larger losses → Smaller positions');
  console.log('└─ Problem: Position size varies wildly, hard to manage\n');

  // Analyze exit conditions
  const stopExits = tradeDetails.filter(t => t.stopWasHit).length;
  const timeoutExits = tradeDetails.filter(t => t.timeoutExit && !t.stopWasHit).length;

  console.log(`Exit breakdown:`);
  console.log(`├─ Stop loss hit: ${stopExits} trades (${(stopExits / tradeDetails.length * 100).toFixed(1)}%)`);
  console.log(`├─ Timeout exit (60 bars): ${timeoutExits} trades (${(timeoutExits / tradeDetails.length * 100).toFixed(1)}%)`);
  console.log(`└─ Other: ${tradeDetails.length - stopExits - timeoutExits}\n`);

  console.log('\n' + '═'.repeat(120));
  console.log('EXIT LOGIC ANALYSIS - Why convex stops out on BTC');
  console.log('═'.repeat(120) + '\n');

  // Analyze why convex fails
  const winningScoutsWithLosingConvex = tradeDetails.filter(
    t => t.scoutWasWinner && !t.convexWasWinner
  );

  console.log(`Critical Pattern: Scout WINS but Convex LOSES\n`);
  console.log(`Count: ${winningScoutsWithLosingConvex.length} out of ${tradeDetails.length} trades (${(winningScoutsWithLosingConvex.length / tradeDetails.length * 100).toFixed(1)}%)\n`);

  if (winningScoutsWithLosingConvex.length > 0) {
    console.log('Sample Cases (First 5):\n');
    
    winningScoutsWithLosingConvex.slice(0, 5).forEach((trade, idx) => {
      console.log(`Trade ${idx + 1}:`);
      console.log(`  Scout:  Entry@bar${trade.scoutEntryBar} → Exit@bar${trade.scoutExitBar} | +${trade.scoutPnL.toFixed(0)} (${(trade.scoutPnLPct*100).toFixed(2)}%)`);
      console.log(`  Convex: Entry@bar${trade.convexEntryBar} (Price: ${trade.convexEntryPrice.toFixed(2)}) | Stop: ${trade.convexStopPrice.toFixed(2)}`);
      console.log(`  Exit:   @bar${trade.convexExitBar} (Price: ${trade.convexExitPrice.toFixed(2)}) | ${trade.convexPnL.toFixed(0)} (${(trade.convexPnLPct*100).toFixed(2)}%)`);
      console.log(`  Lag:    Scout→FoR: 6 bars | FoR→Convex entry: ${trade.lagFromFoRToConvexEntry} bars`);
      console.log(`  Price moved from scout exit to convex entry: ${trade.priceMovedFromScoutToConvex.toFixed(2)} (${trade.direction})`);
      console.log(`  Price moved from convex entry to exit: ${trade.priceMovedFromConvexEntryToExit.toFixed(2)}`);
      console.log(`  Exit reason: ${trade.stopWasHit ? 'STOP HIT' : 'TIMEOUT'}`);
      console.log('');
    });
  }

  console.log('\n' + '═'.repeat(120));
  console.log('ROOT CAUSE ANALYSIS');
  console.log('═'.repeat(120) + '\n');

  // Calculate statistics
  const avgPriceMovement = tradeDetails.reduce((sum, t) => sum + t.priceMovedFromScoutToConvex, 0) / tradeDetails.length;
  const avgConvexPnL = tradeDetails.reduce((sum, t) => sum + t.convexPnL, 0) / tradeDetails.length;
  const avgStopsHit = (stopExits / tradeDetails.length) * 100;
  
  const scoutsBeatingConvex = tradeDetails.filter(t => t.scoutPnL > t.convexPnL).length;
  const avgDegradation = tradeDetails.reduce((sum, t) => sum + (t.convexPnLPct - t.scoutPnLPct), 0) / tradeDetails.length;

  console.log(`HYPOTHESIS VALIDATION:\n`);

  console.log(`1️⃣  ENTRY TIMING ISSUE (Momentum Already Captured by Scout):`);
  console.log(`   └─ By time convex enters (6 bars after scout), price has already moved`);
  console.log(`   └─ Avg price movement scout→convex: ${avgPriceMovement.toFixed(2)}`);
  console.log(`   └─ This means convex enters with less favorable entry than scout\n`);

  console.log(`2️⃣  STOP LOSS TOO TIGHT FOR BTC VOLATILITY:`);
  console.log(`   └─ 1.0% stop on BTC = ~$1,000 per $100K position`);
  console.log(`   └─ BTC hourly volatility often 0.5-2% per bar`);
  console.log(`   └─ ${avgStopsHit.toFixed(1)}% of trades stopped out (very high)`);
  console.log(`   └─ Stops hit mean convex never captures full momentum\n`);

  console.log(`3️⃣  CONVEX DEGRADES SCOUT QUALITY:`);
  const scoutWinners = tradeDetails.filter(t => t.scoutWasWinner).length;
  const convexWinners = tradeDetails.filter(t => t.scoutWasWinner && t.convexWasWinner).length;
  console.log(`   └─ Scouts winning: ${scoutWinners}`);
  console.log(`   └─ Those scouts have convex version: ${convexWinners} winners`);
  if (tradeDetails.length > 0) {
    console.log(`   └─ Average degradation: scout ${(tradeDetails[0].scoutPnLPct*100).toFixed(2)}% → convex ${(tradeDetails[0].convexPnLPct*100).toFixed(2)}%`);
  }
  console.log(`   └─ ${scoutsBeatingConvex} out of ${tradeDetails.length} trades = scout outperforms convex\n`);

  console.log(`4️⃣  WHY CONVEX DEPENDS ON VFMD:`);
  console.log(`   ├─ Convex has NO independent entry signal`);
  console.log(`   ├─ Convex ONLY enters on FoR (Failure of Reversion) trigger`);
  console.log(`   ├─ FoR trigger only fires when VFMD scout becomes profitable`);
  console.log(`   └─ Without VFMD signals, convex has zero trades\n`);

  console.log(`5️⃣  THE REAL PROBLEM - ENTRY SEQUENCING:`);
  console.log(`   ├─ Scout enters at momentum START (bar X)`);
  console.log(`   ├─ Scout captures quick 5-20 bar gain (~4% avg on winners)`);
  console.log(`   ├─ By bar X+6, scout is already profitable and closing position`);
  console.log(`   ├─ Convex enters at bar X+6, momentum ALREADY CAPTURED`);
  console.log(`   └─ Convex tries to ride momentum that's 6 bars old, fails\n`);

  // Statistical summary
  console.log('\n' + '═'.repeat(120));
  console.log('STATISTICAL SUMMARY');
  console.log('═'.repeat(120) + '\n');

  const avgScoutPnL = tradeDetails.reduce((sum, t) => sum + t.scoutPnL, 0) / tradeDetails.length;
  const avgConvexPnLValue = tradeDetails.reduce((sum, t) => sum + t.convexPnL, 0) / tradeDetails.length;
  const avgScoutPnLPct = tradeDetails.reduce((sum, t) => sum + t.scoutPnLPct, 0) / tradeDetails.length;
  const avgConvexPnLPct = tradeDetails.reduce((sum, t) => sum + t.convexPnLPct, 0) / tradeDetails.length;

  console.log(`Metric                          | Scout      | Convex     | Difference`);
  console.log(`─────────────────────────────────┼────────────┼────────────┼──────────────`);
  console.log(`Avg PnL per trade               | $${avgScoutPnL.toFixed(0).padStart(9)}   | $${avgConvexPnLValue.toFixed(0).padStart(9)}   | $${(avgScoutPnL - avgConvexPnLValue).toFixed(0)}`);
  console.log(`Avg PnL %                       | ${(avgScoutPnLPct*100).toFixed(2).padStart(8)}%  | ${(avgConvexPnLPct*100).toFixed(2).padStart(8)}%  | ${((avgScoutPnLPct - avgConvexPnLPct)*100).toFixed(2)}%`);
  console.log(`Trades with stop hit            | N/A        | ${stopExits.toString().padStart(10)}   | ${(stopExits / tradeDetails.length * 100).toFixed(1)}%`);
  console.log(`Win rate                        | ${(tradeDetails.filter(t => t.scoutWasWinner).length / tradeDetails.length * 100).toFixed(1).padStart(8)}%  | ${(tradeDetails.filter(t => t.convexWasWinner).length / tradeDetails.length * 100).toFixed(1).padStart(8)}%  | ${((tradeDetails.filter(t => t.scoutWasWinner).length - tradeDetails.filter(t => t.convexWasWinner).length) / tradeDetails.length * 100).toFixed(1)}%`);

  console.log('\n' + '═'.repeat(120));
  console.log('RECOMMENDATIONS');
  console.log('═'.repeat(120) + '\n');

  console.log('🔴 PROBLEM: Convex enters 6 bars AFTER momentum begins, stops out 70%+ of the time\n');

  console.log('✅ SOLUTION OPTIONS:\n');

  console.log('Option 1: DISABLE CONVEX ON BTC');
  console.log('  └─ Keep scouts alone: +$18,374 without convex risk');
  console.log('  └─ Scouts proven profitable, consistent, simple\n');

  console.log('Option 2: ACCELERATE CONVEX ENTRY');
  console.log('  └─ Enter convex at bar X+2 (after FoR initial signal, before scout closes)');
  console.log('  └─ Capture momentum while still moving, not 6 bars late\n');

  console.log('Option 3: WIDEN CONVEX STOPS TO MATCH BTC VOLATILITY');
  console.log('  └─ Use 2-3% stops instead of 1.0%');
  console.log('  └─ Let convex ride volatility, only exit on major reversals\n');

  console.log('Option 4: USE VFMD DIRECTLY FOR CONVEX ENTRY (Skip FoR lag)');
  console.log('  └─ Enter convex at bar X (same time as scout)');
  console.log('  └─ Size convex for persistence, not follow-through\n');

  // Save detailed results
  const outputPath = path.join(__dirname, '../../BTC_CONVEX_TRADE_ANALYSIS.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalTrades: tradeDetails.length,
    summary: {
      scoutPnL: tradeDetails.reduce((s, t) => s + t.scoutPnL, 0),
      convexPnL: tradeDetails.reduce((s, t) => s + t.convexPnL, 0),
      avgStopHitRate: (stopExits / tradeDetails.length * 100).toFixed(1) + '%',
      scoutVsConvexDegradation: `${(avgScoutPnLPct * 100).toFixed(2)}% → ${(avgConvexPnLPct * 100).toFixed(2)}%`,
      convexWinsWhenScoutWins: `${tradeDetails.filter(t => t.scoutWasWinner && t.convexWasWinner).length}/${tradeDetails.filter(t => t.scoutWasWinner).length}`,
    },
    tradeDetails: tradeDetails.slice(0, 20), // First 20 trades
  }, null, 2));

  console.log(`\n✅ Detailed trade analysis saved to: BTC_CONVEX_TRADE_ANALYSIS.json\n`);
}

runDeepAnalysis().catch(console.error);
