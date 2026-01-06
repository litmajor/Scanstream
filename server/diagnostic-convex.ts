/**
 * Diagnostic script to test ConvexityAgent signal generation
 */

import { ConvexityAgent } from './services/rpg-agents/ConvexityAgent.ts';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load sample data
const btcPath = path.join(__dirname, 'data/cache/BTCUSDT_1h_365d.json');
const fileContent = fs.readFileSync(btcPath, 'utf-8');
const parsed = JSON.parse(fileContent);
const data = Array.isArray(parsed) ? parsed : parsed.data;

const ticks = data.slice(0, 100).map((c: any) => ({
  timestamp: c.timestamp,
  open: c.open,
  high: c.high,
  low: c.low,
  close: c.close,
  volume: c.volume
}));

// Create agent
const agent = new ConvexityAgent('TestAgent', 'balanced');

console.log('🧪 Testing ConvexityAgent Signal Generation\n');

// Process first 50 bars
for (let i = 0; i < 50; i++) {
  const currentTicks = ticks.slice(0, i + 1);
  const currentPrice = currentTicks[currentTicks.length - 1].close;
  
  // Feed tick
  try {
    agent.processTick(currentTicks, 'laminar_trend' as any, currentPrice);
  } catch (e) {
    console.error(`Error at bar ${i}:`, (e as Error).message);
  }
  
  // Check state
  const diagnostics = agent.getDiagnostics();
  if (i === 20 || i === 40 || i === 49) {
    console.log(`\n📊 Bar ${i}: ${currentPrice.toFixed(2)}`);
    console.log(`  Status: ${diagnostics.status}`);
    console.log(`  FoR Score: ${(diagnostics.forScore * 100).toFixed(0)}%`);
    console.log(`  Reason: ${diagnostics.forReason}`);
  }
}

// Now try to generate a signal
console.log('\n\n🔍 Testing generateSignal()');
const testSignal = agent.generateSignal(ticks.slice(0, 50), 0.1);
console.log(`Signal: ${testSignal.action}`);
console.log(`Reason: ${testSignal.reason}`);
console.log(`\nDiagnostics:`, agent.getDiagnostics());
