/**
 * SIGNAL CONTINUITY VALIDATION
 * 
 * Tracks the transformation from discrete state machine → continuous physics engine
 * After each round of fixes, run this to verify the system is producing meaningful variance
 */

import fs from 'fs';
import path from 'path';

interface SignalRecord {
  timestamp: number;
  signalType: string;
  volatilityProb: number;
  confidence: number;
  pegCompression: number;
  pegGradient: number;
  trigger: number;
}

// Load signals
const signalPath = path.join(process.cwd(), 'data', 'alphaEdgeSignals.csv');
if (!fs.existsSync(signalPath)) {
  throw new Error(`Signals file not found: ${signalPath}`);
}

const rawCSV = fs.readFileSync(signalPath, 'utf-8');
const lines = rawCSV.split('\n').filter(l => l.trim());
const header = lines[0].split(',');
const signals: SignalRecord[] = lines.slice(1).map(line => {
  const vals = line.split(',');
  return {
    timestamp: parseInt(vals[0]),
    signalType: vals[1],
    volatilityProb: parseFloat(vals[2]),
    confidence: parseFloat(vals[3]),
    pegCompression: parseFloat(vals[4]),
    pegGradient: parseFloat(vals[5]),
    trigger: parseFloat(vals[6])
  };
});

console.log(`\n${'='.repeat(80)}`);
console.log('SIGNAL CONTINUITY VALIDATION REPORT');
console.log(`${'='.repeat(80)}\n`);

// ============================================================================
// TEST 1: Discrete State Detection
// ============================================================================
console.log(`📊 TEST 1: DISCRETE STATE DETECTION`);
console.log(`${'─'.repeat(80)}`);

const stateKey = (s: SignalRecord) => 
  `peg=${s.pegCompression.toFixed(1)}, trig=${s.trigger.toFixed(4)}, conf=${s.confidence.toFixed(1)}`;

const stateMap = new Map<string, number>();
signals.forEach(s => {
  const key = stateKey(s);
  stateMap.set(key, (stateMap.get(key) || 0) + 1);
});

const states = Array.from(stateMap.entries())
  .sort((a, b) => b[1] - a[1]);

console.log(`Found ${states.length} distinct states:\n`);
states.forEach(([key, count], idx) => {
  const pct = (100 * count / signals.length).toFixed(1);
  console.log(`  ${idx+1}. ${key} → ${count} signals (${pct}%)`);
});

console.log(`\n❌ ISSUE: ${states.length} discrete states means signal system is quantized.`);
console.log(`✅ GOAL: After fixes, should see continuous distributions with 100s or 1000s of unique values.\n`);

// ============================================================================
// TEST 2: Metric Distribution Analysis
// ============================================================================
console.log(`\n📊 TEST 2: METRIC DISTRIBUTION ANALYSIS`);
console.log(`${'─'.repeat(80)}`);

function analyzeDistribution(metric: string, values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const uniqueVals = new Set(values);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b) / values.length;
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  
  return { min, p25, p50, p75, max, mean, uniqueValues: uniqueVals.size };
}

// PEG Compression
console.log(`\n🔷 PEG Compression Distribution:`);
const pegDist = analyzeDistribution('pegCompression', signals.map(s => s.pegCompression));
console.log(`  Unique values: ${pegDist.uniqueValues}`);
console.log(`  Range: [${pegDist.min.toFixed(4)}, ${pegDist.max.toFixed(4)}]`);
console.log(`  Mean: ${pegDist.mean.toFixed(6)}, Median: ${pegDist.p50.toFixed(4)}`);
console.log(`  ❌ ISSUE: Only ${pegDist.uniqueValues} unique values (should be 100+)`);
console.log(`  ✅ GOAL: Continuous [0, 1] distribution with 100s of unique values`);

// TRIGGER  
console.log(`\n🔷 Trigger Distribution:`);
const trigDist = analyzeDistribution('trigger', signals.map(s => s.trigger));
console.log(`  Unique values: ${trigDist.uniqueValues}`);
console.log(`  Range: [${trigDist.min.toFixed(4)}, ${trigDist.max.toFixed(4)}]`);
console.log(`  Mean: ${trigDist.mean.toFixed(6)}, Median: ${trigDist.p50.toFixed(4)}`);
console.log(`  ❌ ISSUE: Only ${trigDist.uniqueValues} unique values (should be 50+)`);
console.log(`  ✅ GOAL: Meaningful variance across market conditions`);

// Confidence
console.log(`\n🔷 Confidence Distribution:`);
const confDist = analyzeDistribution('confidence', signals.map(s => s.confidence));
console.log(`  Unique values: ${confDist.uniqueValues}`);
console.log(`  Range: [${confDist.min.toFixed(4)}, ${confDist.max.toFixed(4)}]`);
console.log(`  Mean: ${confDist.mean.toFixed(6)}, Median: ${confDist.p50.toFixed(4)}`);
console.log(`  ❌ ISSUE: Only ${confDist.uniqueValues} unique values (should be 50+)`);
console.log(`  ✅ GOAL: Continuous 0.3-0.9 range correlating with actual quality`);

// Volatility Probability
console.log(`\n🔷 Volatility Probability Distribution:`);
const volprobDist = analyzeDistribution('volatilityProb', signals.map(s => s.volatilityProb));
console.log(`  Unique values: ${volprobDist.uniqueValues}`);
console.log(`  Range: [${volprobDist.min.toFixed(6)}, ${volprobDist.max.toFixed(6)}]`);
console.log(`  Mean: ${volprobDist.mean.toFixed(6)}, Max: ${volprobDist.max.toFixed(6)}`);
console.log(`  ❌ ISSUE: Max value ${volprobDist.max.toFixed(6)} (should reach 0.1+)`);
console.log(`  ✅ GOAL: 0.1-0.6 range indicating actual volatility likelihood`);

// ============================================================================
// TEST 3: Signal Directional Persistence
// ============================================================================
console.log(`\n\n📊 TEST 3: SIGNAL DIRECTIONAL PERSISTENCE`);
console.log(`${'─'.repeat(80)}`);

const activeSignals = signals.filter(s => s.signalType !== 'CONSOLIDATION');
let flips = 0;
let runs = 0;
let maxRunLength = 0;
let runLengths: number[] = [];

let currentDirection: string | null = null;
let currentRunLength = 0;

activeSignals.forEach((s, i) => {
  if (s.signalType !== 'CONSOLIDATION') {
    if (!currentDirection) {
      currentDirection = s.signalType;
      currentRunLength = 1;
    } else if (s.signalType === currentDirection) {
      currentRunLength++;
    } else {
      flips++;
      runLengths.push(currentRunLength);
      maxRunLength = Math.max(maxRunLength, currentRunLength);
      currentDirection = s.signalType;
      currentRunLength = 1;
    }
  }
});
if (currentRunLength > 0) {
  runLengths.push(currentRunLength);
  maxRunLength = Math.max(maxRunLength, currentRunLength);
  runs++;
} else {
  runs = runLengths.length;
}

const avgRunLength = activeSignals.length > 0 ? runLengths.reduce((a, b) => a + b, 0) / runLengths.length : 0;
const flipRate = (100 * flips / Math.max(1, activeSignals.length - 1)).toFixed(1);

console.log(`\nActive signals: ${activeSignals.length}`);
console.log(`Direction flips: ${flips}`);
console.log(`Flip rate: ${flipRate}% (signals that reverse direction within 1 candle)`);
console.log(`Average run length: ${avgRunLength.toFixed(1)} candles`);
console.log(`Max run length: ${maxRunLength} candles`);

if (parseFloat(flipRate) > 70) {
  console.log(`\n❌ ISSUE: ${flipRate}% flip rate = no directional conviction`);
  console.log(`  System is making one-shot calls, not building positions`);
} else {
  console.log(`\n✅ GOOD: Signals showing persistence across multiple candles`);
}

console.log(`\n✅ GOAL: Average run 4-8+ candles, flip rate <30%`);

// ============================================================================
// TEST 4: Signal Type Distribution by Confidence
// ============================================================================
console.log(`\n\n📊 TEST 4: SIGNAL TYPE BIAS BY CONFIDENCE`);
console.log(`${'─'.repeat(80)}`);

const confByType = new Map<string, Map<string, number>>();
signals.forEach(s => {
  if (!confByType.has(s.signalType)) {
    confByType.set(s.signalType, new Map());
  }
  const typeMap = confByType.get(s.signalType)!;
  const confKey = s.confidence.toFixed(1);
  typeMap.set(confKey, (typeMap.get(confKey) || 0) + 1);
});

Array.from(confByType.entries()).forEach(([type, confMap]) => {
  console.log(`\n${type}:`);
  Array.from(confMap.entries()).forEach(([conf, count]) => {
    const pct = (100 * count / signals.length).toFixed(1);
    console.log(`  conf=${conf}: ${count} (${pct}%)`);
  });
});

console.log(`\n❌ ISSUE: Confidence is correlated with directional bias`);
console.log(`  If conf is purely "quality", direction should be independent`);
console.log(`  ✅ GOAL: Same confidence range applied equally to LONG/SHORT`);

// ============================================================================
// TEST 5: Temporal Distribution
// ============================================================================
console.log(`\n\n📊 TEST 5: TEMPORAL DISTRIBUTION`);
console.log(`${'─'.repeat(80)}`);

const monthMap = new Map<string, number>();
signals.forEach(s => {
  const date = new Date(s.timestamp);
  const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
  monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + 1);
});

const months = Array.from(monthMap.entries()).sort();
let minCount = Infinity;
let maxCount = 0;

months.forEach(([month, count]) => {
  minCount = Math.min(minCount, count);
  maxCount = Math.max(maxCount, count);
  console.log(`  ${month}: ${count} signals`);
});

const range = maxCount / minCount;
console.log(`\nRange: ${range.toFixed(1)}× (${maxCount} max / ${minCount} min)`);

if (range > 3) {
  console.log(`❌ ISSUE: ${range.toFixed(1)}× variation across months (PEG clipping suspected)`);
  console.log(`  If compression is real, signals should scale with market structure`);
} else {
  console.log(`✅ GOOD: Fairly consistent monthly distribution`);
}

console.log(`\n✅ GOAL: <2× range indicating stable signal generation`);

// ============================================================================
// SUMMARY
// ============================================================================
console.log(`\n\n${'='.repeat(80)}`);
console.log('VALIDATION SUMMARY');
console.log(`${'='.repeat(80)}\n`);

const issues = [
  states.length > 20 ? null : `❌ System outputs only ${states.length} discrete states`,
  pegDist.uniqueValues <= 10 ? `❌ PEG has only ${pegDist.uniqueValues} unique values` : null,
  trigDist.uniqueValues <= 5 ? `❌ TRIGGER has only ${trigDist.uniqueValues} unique values` : null,
  volprobDist.max < 0.01 ? `❌ volatilityProb never exceeds ${volprobDist.max.toFixed(6)}` : null,
  parseFloat(flipRate) > 70 ? `❌ Signal flip rate ${flipRate}% (no conviction)` : null,
  range > 3 ? `❌ Monthly variation ${range.toFixed(1)}× (PEG clipping)` : null
].filter(Boolean);

if (issues.length === 0) {
  console.log('✅ ALL TESTS PASSED - System is generating meaningful continuous distributions\n');
} else {
  console.log(`Found ${issues.length} critical issues:\n`);
  issues.forEach(issue => console.log(`${issue}`));
  console.log(`\n${'⚠️  '.repeat(30)}`);
  console.log(`These issues indicate the physics engine is not yet producing real continuous data.`);
  console.log(`Key fixes needed:`);
  console.log(`  1. Verify FieldConstructor produces non-binary velocity distributions`);
  console.log(`  2. Check TriggerCalculator doesn't have hardcoded outputs`);
  console.log(`  3. Ensure confidence calculation varies continuously`);
  console.log(`  4. Validate volatilityProb reaches meaningful levels`);
}

console.log(`\n${'='.repeat(80)}\n`);
