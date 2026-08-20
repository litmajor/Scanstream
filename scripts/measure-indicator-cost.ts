import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { IndicatorCache } from '../server/services/scanner/indicator-cache';
import { IndicatorConfigManager } from '../server/services/scanner/indicator-config';
import OptimizedMomentumScanner from '../server/services/scanner/momentum-scanner-optimized';
import * as indicators from '../server/services/scanner/indicators';

const SAMPLE_COUNT = 40;
const WARMUP_COUNT = 5;
const FIXTURE_LENGTH = 256;

const frames = Array.from({ length: FIXTURE_LENGTH }, (_, index) => {
  const close = 100 + index * 0.07 + Math.sin(index / 9) * 2;
  return {
    timestamp: 1_700_000_000_000 + index * 60_000,
    price: {
      open: close - 0.3,
      high: close + 1.1 + Math.cos(index / 7) * 0.2,
      low: close - 1.2 - Math.sin(index / 11) * 0.2,
      close,
    },
    volume: 1_000 + (index % 17) * 23,
  };
});

const closes = frames.map((frame) => frame.price.close);
const highs = frames.map((frame) => frame.price.high);
const lows = frames.map((frame) => frame.price.low);
const volumes = frames.map((frame) => frame.volume);

const computations: Record<string, () => unknown> = {
  sma: () => indicators.sma(closes, 20),
  ema: () => indicators.ema(closes, 20),
  macd: () => indicators.macd(closes),
  rsi: () => indicators.rsi(closes),
  slope: () => indicators.slope(closes),
  vwap: () => indicators.vwap(closes, volumes),
  atr: () => indicators.atr(highs, lows, closes),
  bollingerBands: () => indicators.bollingerBands(closes),
  adx: () => indicators.adx(highs, lows, closes),
  stochastic: () => indicators.stochastic(highs, lows, closes),
  cci: () => indicators.cci(highs, lows, closes),
  williamsR: () => indicators.williamsR(highs, lows, closes),
  obv: () => indicators.obv(closes, volumes),
  mfi: () => indicators.mfi(highs, lows, closes, volumes),
  cmf: () => indicators.cmf(highs, lows, closes, volumes),
  aroon: () => indicators.aroon(highs, lows),
  tsi: () => indicators.tsi(closes),
  elderRay: () => indicators.elderRay(highs, lows, closes),
  keltnerChannels: () => indicators.keltnerChannels(highs, lows, closes),
  parabolicSAR: () => indicators.parabolicSAR(highs, lows, closes),
  fibLevels: () => indicators.fibLevels(highs, lows, closes),
  vwma: () => indicators.vwma(closes, volumes, 20),
};

function containsFiniteNumber(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.some(containsFiniteNumber);
  if (value !== null && typeof value === 'object') {
    return Object.values(value).some(containsFiniteNumber);
  }
  return false;
}

for (const [name, compute] of Object.entries(computations)) {
  const result = compute();
  if (!containsFiniteNumber(result)) {
    throw new Error(`${name} produced no finite numeric output for the fixed fixture`);
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

for (const compute of Object.values(computations)) {
  for (let i = 0; i < WARMUP_COUNT; i += 1) compute();
}

const timings = Object.entries(computations).map(([name, compute]) => {
  const samples: number[] = [];
  for (let i = 0; i < SAMPLE_COUNT; i += 1) {
    const start = performance.now();
    compute();
    samples.push(performance.now() - start);
  }
  return { name, medianMs: median(samples) };
});

const totalMs = timings.reduce((sum, timing) => sum + timing.medianMs, 0);
const scanner = new OptimizedMomentumScanner(
  new IndicatorConfigManager('aggressive'),
  new IndicatorCache(),
);
const scannerResult = scanner.computeScore('FIXTURE/USDT', '1m', frames);
if (!scannerResult.diagnostics) {
  throw new Error('scanner path did not return diagnostics for the fixed fixture');
}

console.log(JSON.stringify({
  fixture: {
    length: FIXTURE_LENGTH,
    symbol: 'FIXTURE/USDT',
    timeframe: '1m',
    timestampBase: 1_700_000_000_000,
    generator: 'deterministic trend plus sinusoidal variation',
  },
  scannerPath: {
    computedIndicators: scannerResult.diagnostics.computedIndicators,
    deferredIndicators: scannerResult.diagnostics.deferredIndicators,
    totalComputationMs: scannerResult.diagnostics.computationTimeMs,
  },
  samples: SAMPLE_COUNT,
  indicators: timings.map((timing) => ({
    ...timing,
    relativePercent: totalMs === 0 ? 0 : (timing.medianMs / totalMs) * 100,
  })),
  summedMedianMs: totalMs,
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  cpu: os.cpus()[0]?.model ?? 'unknown',
}, null, 2));
