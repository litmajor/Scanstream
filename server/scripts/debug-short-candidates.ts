import fs from 'fs';
import path from 'path';
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

const candlesCachePath = path.join(process.cwd(), 'data', 'cache', 'BTCUSDT_1h_365d.json');
const candles = loadCandles(candlesCachePath);

const windowSize = 100;
const angleStats = { positive: 0, negative: 0, zero: 0 };
const shortCandidates = [];

// Scan all candles to find low compression/trigger combinations by angle
const negativeAngleMetrics = [];

for (let i = windowSize; i < candles.length; i++) {
  const slice = candles.slice(i - windowSize, i);
  const field = candlesToVectorField(slice);
  const metrics = PhysicsCalculator.computeAllMetrics(field);
  const triggerState = TriggerCalculator.computeTrigger(metrics);
  
  const angle = metrics.dominantAngle;
  const compressionPEG = TriggerCalculator.computeCompressionPEG(field);
  
  if (angle > 0) angleStats.positive++;
  else if (angle < 0) angleStats.negative++;
  else angleStats.zero++;
  
  // Collect negative angle samples to understand their compression/trigger
  if (angle < 0) {
    negativeAngleMetrics.push({
      candle: i,
      angle,
      compression: compressionPEG,
      trigger: triggerState.trigger,
      peg: metrics.peg
    });
  }
}

console.log(`\n📊 Overall angle distribution (all ${candles.length - windowSize} signal candles):`);
console.log(`  Positive: ${angleStats.positive} (${(100 * angleStats.positive / (candles.length - windowSize)).toFixed(1)}%)`);
console.log(`  Negative: ${angleStats.negative} (${(100 * angleStats.negative / (candles.length - windowSize)).toFixed(1)}%)`);

// Show distribution of negative angle candles
const negWithHighCompression = negativeAngleMetrics.filter(m => m.compression > 0.3);
const negWithHighTrigger = negativeAngleMetrics.filter(m => m.trigger > 0.5);
const negWithBoth = negativeAngleMetrics.filter(m => m.compression > 0.3 && m.trigger > 0.5);

console.log(`\n📍 Negative angle candles (${negativeAngleMetrics.length} total):`);
console.log(`  With compression > 0.3: ${negWithHighCompression.length}`);
console.log(`  With trigger > 0.5: ${negWithHighTrigger.length}`);
console.log(`  With BOTH compression > 0.3 AND trigger > 0.5: ${negWithBoth.length}`);

if (negWithBoth.length > 0) {
  console.log(`\n✅ Found ${negWithBoth.length} SHORT signal candidates!`);
  console.log(`Sample SHORT candidates (first 5):`);
  negWithBoth.slice(0, 5).forEach(m => {
    console.log(`  candle ${m.candle}: angle=${m.angle.toFixed(4)}, compression=${m.compression.toFixed(4)}, trigger=${m.trigger.toFixed(4)}`);
  });
} else {
  console.log(`\n❌ No negative angle candles with BOTH compression > 0.3 AND trigger > 0.5`);
  console.log(`This suggests the triggers only fire on positive-angle (uptrend) windows.`);
}

// Show the top 10 compression/trigger combos among negative angles
console.log(`\n🔍 Top 10 negative-angle candles by compression × trigger:`);
negativeAngleMetrics
  .sort((a, b) => (b.compression * b.trigger) - (a.compression * a.trigger))
  .slice(0, 10)
  .forEach(m => {
    const score = (m.compression * m.trigger).toFixed(4);
    console.log(`  candle ${m.candle}: angle=${m.angle.toFixed(4)}, comp=${m.compression.toFixed(4)}, trig=${m.trigger.toFixed(4)}, score=${score}`);
  });
