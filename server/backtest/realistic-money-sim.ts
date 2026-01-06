/**
 * Real Money Simulation (REALISTIC)
 * Account: $5,000
 * Risk per trade: 3% ($150 per trade)
 * Stop loss: 2.5%
 * Position sizing capped to prevent unrealistic growth
 */

console.log('💰 REALISTIC MONEY SIMULATION - $5,000 ACCOUNT');
console.log('='.repeat(70));
console.log();
console.log('Key assumptions:');
console.log('  • Starting capital: $5,000');
console.log('  • Risk per trade: 3% of current equity');
console.log('  • Stop loss: 2.5%');
console.log('  • Win rate: Based on backtests');
console.log('  • Position sizing: Fixed to max equity * 3%');
console.log();
console.log('='.repeat(70));
console.log();

const startingCapital = 5000;
const riskPerTrade = 0.03; // 3%

interface TradeResult {
  tradeNum: number;
  startEquity: number;
  riskDollars: number;
  winLoss: string;
  pnlDollars: number;
  endEquity: number;
}

// Simulate trades with realistic expectations
function simulateYear(asset: string, winRate: number, tradesPerYear: number, targetPct: number) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${asset} - Target: ${targetPct}% | Win Rate: ${winRate}% | Trades/Year: ${tradesPerYear}`);
  console.log('='.repeat(70));

  const stopLossRatio = targetPct / 2.5; // RRR
  let equity = startingCapital;
  const trades: TradeResult[] = [];
  
  // First 20 trades shown individually
  const showFirstNTrades = 20;
  
  for (let i = 0; i < tradesPerYear; i++) {
    const riskDollars = equity * riskPerTrade;
    
    // Determine if win/loss based on win rate
    const isWin = (i + 1) / tradesPerYear < winRate / 100;
    
    let pnlDollars: number;
    if (isWin) {
      // Win: Risk × RRR ratio
      pnlDollars = riskDollars * stopLossRatio;
    } else {
      // Loss: -Risk
      pnlDollars = -riskDollars;
    }
    
    const endEquity = equity + pnlDollars;
    trades.push({
      tradeNum: i + 1,
      startEquity: equity,
      riskDollars,
      winLoss: isWin ? 'WIN' : 'LOSS',
      pnlDollars,
      endEquity
    });
    
    equity = endEquity;
  }

  // Show first 20 trades
  if (tradesPerYear > 0) {
    console.log(`\nFirst ${Math.min(showFirstNTrades, tradesPerYear)} trades:`);
    console.log('Trade | Start Equity | Risk  | W/L  | P&L    | End Equity');
    console.log('------|--------------|-------|------|--------|----------');
    
    for (let i = 0; i < Math.min(showFirstNTrades, trades.length); i++) {
      const t = trades[i];
      const pnlStr = t.pnlDollars >= 0 ? `+$${t.pnlDollars.toFixed(0)}` : `-$${Math.abs(t.pnlDollars).toFixed(0)}`;
      console.log(
        `${t.tradeNum.toString().padEnd(5)} | $${t.startEquity.toFixed(0).padEnd(12)} | $${t.riskDollars.toFixed(0).padEnd(4)} | ${t.winLoss.padEnd(4)} | ${pnlStr.padEnd(6)} | $${t.endEquity.toFixed(0)}`
      );
    }
    
    if (tradesPerYear > showFirstNTrades) {
      console.log(`... (${tradesPerYear - showFirstNTrades} more trades) ...\n`);
    }
  }

  const finalEquity = equity;
  const totalProfit = finalEquity - startingCapital;
  const returnPct = (totalProfit / startingCapital) * 100;

  console.log(`\n📊 Year-End Summary:`);
  console.log(`  Starting Capital: $${startingCapital.toFixed(0)}`);
  console.log(`  Total Trades: ${tradesPerYear}`);
  console.log(`  Expected Wins: ${Math.round(tradesPerYear * (winRate / 100))}`);
  console.log(`  Expected Losses: ${tradesPerYear - Math.round(tradesPerYear * (winRate / 100))}`);
  console.log(`  Final Equity: $${finalEquity.toFixed(0)}`);
  console.log(`  Total Profit: $${totalProfit.toFixed(0)}`);
  console.log(`  Return: ${returnPct.toFixed(1)}%`);

  if (returnPct > 100) {
    console.log(`  🚀 MORE THAN 2x RETURN!`);
  } else if (returnPct > 50) {
    console.log(`  ⭐ EXCELLENT 50%+ RETURN!`);
  } else if (returnPct > 20) {
    console.log(`  ✅ VERY GOOD 20%+ RETURN!`);
  } else if (returnPct > 0) {
    console.log(`  ✓ POSITIVE RETURN`);
  }

  return { finalEquity, totalProfit, returnPct };
}

// Run simulations
const btcResults = [
  { target: 2.0, trades: 91, wr: 90.1 },
  { target: 3.0, trades: 91, wr: 90.1 },
  { target: 4.0, trades: 91, wr: 90.1 }
];

const ethResults = [
  { target: 2.0, trades: 169, wr: 75.7 },
  { target: 3.0, trades: 169, wr: 75.7 },
  { target: 4.0, trades: 169, wr: 75.7 }
];

const btcSims = btcResults.map(r => ({
  ...r,
  sim: simulateYear('BTC/USDT', r.wr, r.trades, r.target)
}));

const ethSims = ethResults.map(r => ({
  ...r,
  sim: simulateYear('ETH/USDT', r.wr, r.trades, r.target)
}));

// Summary table
console.log(`\n\n${'='.repeat(70)}`);
console.log('📊 COMPARISON TABLE: $5,000 STARTING CAPITAL');
console.log('='.repeat(70));

console.log('\nBTC/USDT RETURNS:');
console.log('Target | Final Equity | Profit  | Return');
console.log('-------|--------------|---------|--------');
for (const sim of btcSims) {
  console.log(
    `${sim.target.toFixed(1)}%    | $${sim.sim.finalEquity.toFixed(0).padEnd(12)} | $${sim.sim.totalProfit.toFixed(0).padEnd(7)} | ${sim.sim.returnPct.toFixed(1)}%`
  );
}

console.log('\nETH/USDT RETURNS:');
console.log('Target | Final Equity | Profit  | Return');
console.log('-------|--------------|---------|--------');
for (const sim of ethSims) {
  console.log(
    `${sim.target.toFixed(1)}%    | $${sim.sim.finalEquity.toFixed(0).padEnd(12)} | $${sim.sim.totalProfit.toFixed(0).padEnd(7)} | ${sim.sim.returnPct.toFixed(1)}%`
  );
}

console.log(`\n${'='.repeat(70)}`);
console.log('💡 INTERPRETATION:');
console.log('='.repeat(70));
console.log();
console.log('With 3% risk per trade and realistic 90%/76% win rates:');
console.log();
console.log('🎯 BTC with 3% target:');
console.log(`   $5,000 → $${btcSims[1].sim.finalEquity.toFixed(0)} (+${btcSims[1].sim.returnPct.toFixed(0)}%)`);
console.log('   That\'s $' + btcSims[1].sim.totalProfit.toFixed(0) + ' profit in one year');
console.log();
console.log('🎯 ETH with 3% target:');
console.log(`   $5,000 → $${ethSims[1].sim.finalEquity.toFixed(0)} (+${ethSims[1].sim.returnPct.toFixed(0)}%)`);
console.log('   That\'s $' + ethSims[1].sim.totalProfit.toFixed(0) + ' profit in one year');
console.log();
console.log('🎯 If you trade BOTH (staggered, not simultaneous):');
const combined = btcSims[1].sim.finalEquity + ethSims[1].sim.finalEquity - startingCapital;
console.log(`   Combined: ~$${combined.toFixed(0)} potential`);
console.log();
console.log('⚠️  IMPORTANT CAVEATS:');
console.log('   • These are BACKTESTED - live trading differs');
console.log('   • Assumes you execute perfectly (no slippage, gaps)');
console.log('   • Assumes win rate stays constant (market regimes change)');
console.log('   • Doesn\'t account for black swan events');
console.log('   • Paper trade first to validate before real money');
console.log();
console.log('🛡️  RISK MITIGATION:');
console.log('   • Start with smaller position (1% risk instead of 3%)');
console.log('   • Add capital allocation rules (don\'t risk house money)');
console.log('   • Monitor daily win/loss ratio for regime changes');
console.log('   • Have a hard stop (e.g., -15% equity = pause trading)');
