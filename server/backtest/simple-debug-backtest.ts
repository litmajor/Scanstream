/**
 * Simple Convexity Backtest - Debug version
 * Tests the core engine components in isolation
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ConvexityAgent } from '../services/rpg-agents/ConvexityAgent.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load BTC data
const btcPath = path.join(__dirname, '../data/cache/BTCUSDT_1h_365d.json');
const fileContent = fs.readFileSync(btcPath, 'utf-8');
const parsed = JSON.parse(fileContent);
const data = Array.isArray(parsed) ? parsed : parsed.data;

const candles = data.map((c: any) => ({
  timestamp: c.timestamp,
  open: c.open,
  high: c.high,
  low: c.low,
  close: c.close,
  volume: c.volume
}));

console.log(`📊 Loaded ${candles.length} BTC candles`);

const agent = new ConvexityAgent('DebugTest', 'balanced');
let trades = 0;
let signals = 0;
let deployments = 0;
let watchingBarCount = 0;

console.log('\n🚀 Running simplified backtest...\n');

for (let bar = 100; bar < Math.min(500, candles.length); bar++) {
  const ticks = candles.slice(0, bar + 1);
  const currentCandle = candles[bar];
  
  // Feed tick
  agent.processTick(ticks, 'laminar_trend' as any, currentCandle.close);
  
  // Get current state
  const diagnostics = agent.getDiagnostics();
  const state = diagnostics.status;
  
  // Track state changes
  if (state === 'WATCHING') {
    watchingBarCount++;
  }
  
  // Try to generate signal
  const signal = agent.generateSignal(ticks, 0.1);
  
  if (signal.action === 'BUY') {
    deployments++;
    console.log(`\n🎯 BUY signal at bar ${bar}: ${currentCandle.close.toFixed(2)}`);
    console.log(`   Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
    console.log(`   Stop: ${signal.stop?.toFixed(2)} | Target: ${signal.target?.toFixed(2)}`);
    console.log(`   State: ${state} | FoR: ${(diagnostics.forScore * 100).toFixed(0)}%`);
  }
  
  // Print status every 50 bars
  if (bar % 50 === 0) {
    console.log(`\n📊 Bar ${bar}: ${currentCandle.close.toFixed(2)} | State: ${state} | FoR: ${(diagnostics.forScore * 100).toFixed(0)}%`);
  }
}

console.log(`\n\n✅ Debug backtest complete`);
console.log(`   Total bars processed: 400`);
console.log(`   Bars in WATCHING state: ${watchingBarCount}`);
console.log(`   BUY deployments: ${deployments}`);
console.log(`\nNote: If deployments is 0, the FoR thresholds may be too strict or VFMD signals aren't firing properly.`);
