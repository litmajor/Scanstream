/**
 * Analyze AlphaEdge signals
 */
import * as fs from 'fs';

const content = fs.readFileSync('./data/alphaEdgeSignals.csv', 'utf-8');
const lines = content.split('\n').filter(l => l.trim());
const header = lines[0].split(',').map(h => h.trim());

interface Signal {
  timestamp: string;
  signalType: string;
  volatilityProb: number;
  confidence: number;
  pegCompression: number;
  pegGradient: number;
  trigger: number;
}

const records: Signal[] = [];

for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(',').map(p => p.trim());
  if (parts.length < 7) continue;
  
  records.push({
    timestamp: parts[0],
    signalType: parts[1],
    volatilityProb: parseFloat(parts[2]),
    confidence: parseFloat(parts[3]),
    pegCompression: parseFloat(parts[4]),
    pegGradient: parseFloat(parts[5]),
    trigger: parseFloat(parts[6])
  });
}

console.log(`Total signals: ${records.length}`);
console.log('');

// Count signal types
const signalCounts: Record<string, number> = {};
const volatilityProbs: number[] = [];
const compressionPEGs: number[] = [];
const triggerScores: number[] = [];

for (const record of records) {
  const type = record.signalType;
  signalCounts[type] = (signalCounts[type] || 0) + 1;
  
  volatilityProbs.push(record.volatilityProb);
  compressionPEGs.push(record.pegCompression);
  triggerScores.push(record.trigger);
}

console.log('Signal Distribution:');
for (const [type, count] of Object.entries(signalCounts)) {
  const pct = ((count / records.length) * 100).toFixed(1);
  console.log(`  ${type}: ${count} (${pct}%)`);
}
console.log('');

// Compute statistics
function stats(arr: number[]) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  return { min, p25, p50, p75, max, mean };
}

console.log('Volatility Probability:');
const volStats = stats(volatilityProbs);
console.log(`  min=${volStats.min.toFixed(6)}, p25=${volStats.p25.toFixed(6)}, p50=${volStats.p50.toFixed(6)}, p75=${volStats.p75.toFixed(6)}, max=${volStats.max.toFixed(6)}, mean=${volStats.mean.toFixed(6)}`);
console.log('');

console.log('Compression PEG:');
const pegStats = stats(compressionPEGs);
console.log(`  min=${pegStats.min.toFixed(6)}, p25=${pegStats.p25.toFixed(6)}, p50=${pegStats.p50.toFixed(6)}, p75=${pegStats.p75.toFixed(6)}, max=${pegStats.max.toFixed(6)}, mean=${pegStats.mean.toFixed(6)}`);
console.log('');

console.log('Trigger Score:');
const trigStats = stats(triggerScores);
console.log(`  min=${trigStats.min.toFixed(6)}, p25=${trigStats.p25.toFixed(6)}, p50=${trigStats.p50.toFixed(6)}, p75=${trigStats.p75.toFixed(6)}, max=${trigStats.max.toFixed(6)}, mean=${trigStats.mean.toFixed(6)}`);
console.log('');

// Find strong signals (compression PEG > 0.5 and trigger > 0.5)
const strongSignals = records.filter(r => r.pegCompression > 0.5 && r.trigger > 0.5);
console.log(`Strong signals (compression>0.5 && trigger>0.5): ${strongSignals.length}`);
console.log('Sample strong LONG signals:');
const strongLongs = strongSignals.filter(r => r.signalType === 'LONG').slice(0, 5);
for (const sig of strongLongs) {
  console.log(`  ts=${sig.timestamp}, compression=${sig.pegCompression.toFixed(4)}, trigger=${sig.trigger.toFixed(4)}, confidence=${sig.confidence.toFixed(4)}`);
}
console.log('');

// Find LONG signals
const longSignals = records.filter(r => r.signalType === 'LONG');
console.log(`LONG signals: ${longSignals.length} (${((longSignals.length/records.length)*100).toFixed(1)}%)`);

// Find SHORT signals
const shortSignals = records.filter(r => r.signalType === 'SHORT');
console.log(`SHORT signals: ${shortSignals.length} (${((shortSignals.length/records.length)*100).toFixed(1)}%)`);
console.log('');

console.log('✅ Analysis complete. Signals ready for backtest integration.');
