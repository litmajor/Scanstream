#!/usr/bin/env node
/**
 * Paper Trading CLI
 * Simple runner for checking paper trading stats
 */

import { logPaperTrade, getStats, printStats, getTrades } from './paper-trading-api.js';

const args = process.argv.slice(2);
const command = args[0] || 'stats';
const asset = args[1] || 'BTC/USDT';

switch (command) {
  case 'stats':
    printStats(asset);
    break;

  case 'log':
    // Example: npx ts-node paper-trading-cli.ts log BTC/USDT 42000 42126 0.06 150 3 2.5 true
    if (args.length < 9) {
      console.log('Usage: paper-trading-cli log <asset> <entryPrice> <exitPrice> <quantity> <riskDollars> <targetPct> <stopLossPct> <won>');
      process.exit(1);
    }
    const trade = logPaperTrade({
      asset: args[1],
      entryPrice: parseFloat(args[2]),
      exitPrice: parseFloat(args[3]),
      quantity: parseFloat(args[4]),
      riskDollars: parseFloat(args[5]),
      targetPct: parseFloat(args[6]),
      stopLossPct: parseFloat(args[7]),
      won: args[8].toLowerCase() === 'true'
    });
    console.log('✅ Trade logged:', trade);
    printStats(args[1]);
    break;

  case 'list':
    const trades = getTrades(asset);
    console.log(`\n📋 All trades for ${asset}:\n`);
    console.log('Date       | Entry   | Exit    | Qty   | P&L      | W/L');
    console.log('-----------|---------|---------|-------|----------|----');
    for (const t of trades) {
      const date = t.timestamp.split('T')[0];
      const pnl = t.pnlDollars >= 0 ? `+$${t.pnlDollars.toFixed(0)}` : `-$${Math.abs(t.pnlDollars).toFixed(0)}`;
      console.log(`${date} | ${t.entryPrice.toFixed(0).padEnd(7)} | ${t.exitPrice.toFixed(0).padEnd(7)} | ${t.quantity.toFixed(3)} | ${pnl.padEnd(8)} | ${t.won ? 'WIN' : 'LOSS'}`);
    }
    break;

  default:
    console.log('Commands:');
    console.log('  stats [asset]  - Show statistics for an asset');
    console.log('  list [asset]   - List all trades for an asset');
    console.log('  log <asset> <entry> <exit> <qty> <risk> <target> <stopLoss> <won> - Log a new trade');
}
