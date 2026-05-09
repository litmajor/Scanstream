import fs from 'fs';
import path from 'path';
import { runAlphaEdge } from '../services/vfmd/AlphaEdgeEngine';
import { FieldConstructor } from '../services/vfmd/fieldConstructor';
import { PhysicsCalculator } from '../services/vfmd/physicsCalculator';
import TriggerCalculator from '../services/vfmd/triggerCalculator';
import type { VectorField } from '../services/vfmd/types';

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function loadCandles(filePath: string): Candle[] {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : (data.data || data.ticks || []);
}

function candlesToVectorField(candles: Candle[]): VectorField {
  const fieldConstructor = new FieldConstructor(50, 100);
  const prices = candles.map(c => c.close);
  return fieldConstructor.constructField(prices);
}

// Debug: inspect angles for strong signals
const candlesCachePath = path.join(process.cwd(), 'data', 'cache', 'BTCUSDT_1h_365d.json');
const candles = loadCandles(candlesCachePath);
console.log(`📖 Loaded ${candles.length} candles`);

// Test first 20 strong signals
const windowSize = 100;
let strongSignalCount = 0;
const angles: number[] = [];

for (let i = windowSize; i < Math.min(windowSize + 500, candles.length); i++) {
  const slice = candles.slice(i - windowSize, i);
  const field = candlesToVectorField(slice);
  const metrics = PhysicsCalculator.computeAllMetrics(field);
  const triggerState = TriggerCalculator.computeTrigger(metrics);
  
  const compressionPEG = TriggerCalculator.computeCompressionPEG(field);
  
  if (compressionPEG > 0.25 && triggerState.trigger > 0.25) {
    strongSignalCount++;
    const angle = metrics.dominantAngle;
    angles.push(angle);
    
    console.log(`
Strong signal ${strongSignalCount} @ candle ${i}:
  angle: ${angle.toFixed(4)} (${angle > 0 ? 'LONG' : 'SHORT'})
  compression: ${compressionPEG.toFixed(4)}
  trigger: ${triggerState.trigger.toFixed(4)}
  peg: ${metrics.peg.toFixed(4)}
    `);
    
    if (strongSignalCount >= 20) break;
  }
}

console.log(`\n📊 Angle distribution for strong signals:`);
const positive = angles.filter(a => a > 0).length;
const negative = angles.filter(a => a < 0).length;
console.log(`  Positive (LONG): ${positive} (${(100 * positive / angles.length).toFixed(1)}%)`);
console.log(`  Negative (SHORT): ${negative} (${(100 * negative / angles.length).toFixed(1)}%)`);
console.log(`  Angles: [${angles.map(a => a.toFixed(4)).join(', ')}]`);
