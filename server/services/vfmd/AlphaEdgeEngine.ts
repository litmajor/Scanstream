// alphaEdgeEngine.ts
import fs from 'fs';
import path from 'path';
import TriggerCalculator from './triggerCalculator';
import { PhysicsCalculator } from './physicsCalculator';
import { FieldConstructor } from './fieldConstructor';
import type { VectorField, PhysicsMetrics } from './types';

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface AlphaSignal {
  timestamp: number;
  signalType: 'LONG' | 'SHORT' | 'CONSOLIDATION';
  volatilityProb: number;
  confidence: number;
  pegCompression: number;
  pegGradient: number;
  trigger: number;
  components: any;
}

/**
 * Loads cached candle data
 */
function loadCandles(filePath: string): Candle[] {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : (data.data || data.ticks || []);
}

/**
 * Converts candles into a vector field using FieldConstructor
 */
function candlesToVectorField(candles: Candle[]): VectorField {
  const fieldConstructor = new FieldConstructor(50, 100);
  const prices = candles.map(c => c.close);
  return fieldConstructor.constructField(prices);
} 
 
/**
 * Compute AlphaEdge signal for a vector field
 */
function computeAlphaEdge(field: VectorField, timestamp: number, context?: any): AlphaSignal {
  // Physics metrics
  const metrics: PhysicsMetrics = PhysicsCalculator.computeAllMetrics(field);

  // TRIGGER
  const triggerState = TriggerCalculator.computeTrigger(metrics, context);

  // Volatility probability
  const volProb = TriggerCalculator.getVolatilityProbability(
    metrics.peg,
    triggerState.trigger
  );

  // Compression PEG - now using shared computation from TriggerCalculator
  const compressionPEG = TriggerCalculator.computeCompressionPEG(field, 10);
  const gradientPEG = metrics.peg; // gradient-based from physics calculator

  // Determine signal type
  // Gate logic: only apply directional signals when trigger shows constraint failure
  // Removed compressionPEG threshold to reduce temporal/seasonal filtering
  // Volatility is better measured by (PEG × TRIGGER), not gate thresholds alone
  let signalType: AlphaSignal['signalType'] = 'CONSOLIDATION';
  
  // Lower trigger threshold to catch more constraint failures
  // Only require evidence of one major stress point, not multiple
  if (triggerState.trigger > 0.25) {
    // Use dominantAngle to determine direction
    // atan2(fy, fx) returns angle in [-π, π]
    // Positive angle = uptrend (LONG)
    // Negative angle = downtrend (SHORT)
    signalType = metrics.dominantAngle > 0 ? 'LONG' : 'SHORT';
  }

  // Confidence: independent metric combining multiple quality indicators
  // Should reflect signal reliability, NOT directional bias
  // Decouple from gate logic by using coherence + trigger confident + field organization
  // NOT compressed: use consistency metrics instead
  const fieldCoherence = metrics.coherenceScore; // How aligned is the field [0, 1]
  const triggerConfidence = triggerState.confidence; // [0.15-0.68]
  const organizationQuality = Math.max(0, Math.min(1, metrics.divergenceScore)); // Low div = organized
  
  // Confidence formula: blend independent quality metrics
  // Not affected by compressionPEG gate threshold
  const confidence = Math.min(1, 
    triggerConfidence * 0.6 +     // Trigger reliability
    fieldCoherence * 0.3 +         // Field alignment
    organizationQuality * 0.1      // Field organization
  );

  return {
    timestamp,
    signalType,
    volatilityProb: volProb,
    confidence,
    pegCompression: compressionPEG,
    pegGradient: gradientPEG,
    trigger: triggerState.trigger,
    components: triggerState.components
  };
}

/**
 * Run AlphaEdge engine over candle data
 */
export function runAlphaEdge(candleCachePath: string): AlphaSignal[] {
  console.log(`📖 Loading candles from ${candleCachePath}...`);
  const candles = loadCandles(candleCachePath);
  console.log(`✅ Loaded ${candles.length} candles`);

  const signals: AlphaSignal[] = [];

  // Sliding temporal window
  const windowSize = 100; // Match FieldConstructor temporal window
  console.log(`🔄 Processing with ${windowSize}-candle window...`);
  
  for (let i = windowSize; i < candles.length; i++) {
    const slice = candles.slice(i - windowSize, i);
    const field = candlesToVectorField(slice);
    const signal = computeAlphaEdge(field, candles[i].timestamp);
    signals.push(signal);
    
    if (i % 500 === 0) {
      console.log(`  ✓ Processed ${i} candles...`);
    }
  }

  return signals;
}

/**
 * Save signals to CSV for analysis
 */
export function saveSignalsCSV(signals: AlphaSignal[], outputPath: string) {
  const header = [
    'timestamp',
    'signalType',
    'volatilityProb',
    'confidence',
    'pegCompression',
    'pegGradient',
    'trigger'
  ].join(',');

  const rows = signals.map(s => [
    s.timestamp,
    s.signalType,
    s.volatilityProb.toFixed(4),
    s.confidence.toFixed(4),
    s.pegCompression.toFixed(4),
    s.pegGradient.toFixed(4),
    s.trigger.toFixed(4)
  ].join(','));

  fs.writeFileSync(outputPath, [header, ...rows].join('\n'), 'utf-8');
  console.log(`✅ Saved AlphaEdge signals to ${outputPath}`);
}

/**
 * Example usage
 */
// Run the engine
const candlePath = path.resolve('./data/cache/BTCUSDT_1h_365d.json');
const signals = runAlphaEdge(candlePath);
saveSignalsCSV(signals, path.resolve('./data/alphaEdgeSignals.csv'));
console.log(`🚀 AlphaEdge completed: ${signals.length} signals generated`);