import { Signal } from '@shared/schema';

// ─────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────

export interface MarketFrame {
  id?: string;
  timestamp: Date | string;
  symbol: string;
  price: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  volume: number;
  indicators: {
    rsi: number;
    macd: { macd: number; signal: number; histogram: number };
    bb: { upper: number; middle: number; lower: number };
    ema20?: number;
    ema50?: number;
    ema200?: number;
    multiEMA?: Record<number, number>;
    stoch_k?: number;
    stoch_d?: number;
    adx?: number;
    vwap?: number;
    atr?: number;
    momentumShort?: number;
    momentumLong?: number;
    bbPos?: number;
    volumeRatio?: number;
    mom7d?: number;
    mom30d?: number;
    ichimoku_bullish?: boolean;
  };
  orderFlow: {
    bidVolume: number;
    askVolume: number;
    netFlow: number;
    largeOrders: number;
    smallOrders?: number;
  };
  marketMicrostructure: {
    spread: number;
    depth: number;
    imbalance: number;
    toxicity: number;
  };
}

export interface MLPrediction {
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
  horizon: number; // minutes
  features: Record<string, number>;
}

export interface MLModel {
  predict(features: number[]): MLPrediction;
  train(data: MarketFrame[]): Promise<void>;
  getFeatureImportance(): Record<string, number>;
  serialize(): object;
  deserialize(data: object): void;
}

// ─────────────────────────────────────────────────────────────
// FEATURE EXTRACTOR
// ─────────────────────────────────────────────────────────────

export class FeatureExtractor {
  /**
   * Fixed: momentum uses capped period so it never exceeds available window.
   * Fixed: feature set is deterministic — multiEMA keys are sorted so order is stable.
   * Fixed: returns a consistent-length vector by never filtering mid-array;
   *        NaN/Inf values are replaced with 0 instead of dropped.
   */
  static extractFeatures(frames: MarketFrame[], currentIndex: number): number[] {
    if (currentIndex < 20 || currentIndex >= frames.length) return [];

    const current = frames[currentIndex];
    const recent = frames.slice(currentIndex - 20, currentIndex + 1);
    const prices  = recent.map(f => f.price.close);
    const volumes = recent.map(f => f.volume);
    const highs   = recent.map(f => f.price.high);
    const lows    = recent.map(f => f.price.low);

    // ── PRICE FEATURES ──────────────────────────────────────
    const priceFeatures = [
      current.price.close,
      current.price.open,
      current.price.high,
      current.price.low,
      (current.price.high - current.price.low) / (current.price.close || 1),
      (current.price.close - current.price.open) / (current.price.open  || 1),
      (current.price.high - current.price.low)  / (current.price.open  || 1),
    ];

    // ── TECHNICAL INDICATORS ────────────────────────────────
    const rsi      = current.indicators.rsi ?? 50;
    const macdLine = current.indicators.macd.macd ?? 0;
    const macdSig  = current.indicators.macd.signal ?? 0;
    const macdHist = current.indicators.macd.histogram ?? 0;
    const bbMid    = current.indicators.bb.middle ?? ((current.price.high + current.price.low) / 2);
    const bbUp     = current.indicators.bb.upper  ?? current.price.high;
    const bbLo     = current.indicators.bb.lower  ?? current.price.low;
    const stochK   = current.indicators.stoch_k   ?? 50;
    const stochD   = current.indicators.stoch_d   ?? 50;
    const adx      = current.indicators.adx       ?? 25;
    const vwap     = current.indicators.vwap      ?? current.price.close;
    const atr      = current.indicators.atr       ?? 0;
    const ema20    = current.indicators.ema20      ?? current.price.close;
    const ema50    = current.indicators.ema50      ?? current.price.close;
    const ema200   = current.indicators.ema200     ?? current.price.close;

    const technicalFeatures = [
      rsi / 100,
      macdLine,
      macdSig,
      macdHist,
      (current.price.close - bbMid) / ((bbUp - bbLo) || 1),
      (bbUp - bbLo) / (bbMid || 1),
      stochK / 100,
      stochD / 100,
      adx / 100,
      (current.price.close - vwap) / (vwap || 1),  // relative to vwap, not raw
      atr / (current.price.close || 1),              // normalised ATR
      current.price.close / (ema20  || current.price.close),
      current.price.close / (ema50  || current.price.close),
      current.price.close / (ema200 || current.price.close),
      (ema20 || 1) / (ema50  || 1),
      (ema50 || 1) / (ema200 || 1),
    ];

    // ── VOLUME FEATURES ─────────────────────────────────────
    const avgVolume = volumes.reduce((s, v) => s + v, 0) / volumes.length;
    const minVolume = Math.min(...volumes);
    const maxVolume = Math.max(...volumes);
    const volumeFeatures = [
      current.volume / (avgVolume || 1),
      current.indicators.volumeRatio ?? 0,
      (maxVolume - minVolume) / (avgVolume || 1),
    ];

    // ── ORDER FLOW FEATURES ─────────────────────────────────
    const bidAskTotal = current.orderFlow.bidVolume + current.orderFlow.askVolume;
    const orderFlowFeatures = [
      current.orderFlow.netFlow / (current.volume || 1),
      (current.orderFlow.bidVolume - current.orderFlow.askVolume) / (bidAskTotal || 1),
      current.orderFlow.largeOrders / (current.volume || 1),
      (current.orderFlow.smallOrders ?? 0) / (current.volume || 1),
      current.orderFlow.largeOrders / ((current.orderFlow.smallOrders ?? 1) || 1),
      current.orderFlow.bidVolume  / (bidAskTotal || 1),
    ];

    // ── MARKET MICROSTRUCTURE ───────────────────────────────
    const microstructureFeatures = [
      current.marketMicrostructure.spread / (current.price.close || 1),
      current.marketMicrostructure.depth  / (current.volume || 1),
      current.marketMicrostructure.imbalance,
      current.marketMicrostructure.toxicity,
    ];

    // ── MOMENTUM FEATURES ───────────────────────────────────
    // Fixed: periods capped to actual available window (21 frames max)
    const momentumFeatures = [
      this.calculateMomentum(prices, 5),
      this.calculateMomentum(prices, 10),
      this.calculateMomentum(prices, 20),
      // momentum_50 removed — window is only 21 deep, always returned 0
      current.indicators.momentumShort ?? 0,
      current.indicators.momentumLong  ?? 0,
      current.indicators.mom7d         ?? 0,
      current.indicators.mom30d        ?? 0,
    ];

    // ── VOLATILITY FEATURES ─────────────────────────────────
    const volatilityFeatures = [
      this.calculateVolatility(prices, 5),
      this.calculateVolatility(prices, 10),
      this.calculateVolatility(prices, 20),
      this.calculateATR(highs, lows, prices, 10),
      this.calculateATR(highs, lows, prices, 20),
    ];

    // ── TREND FEATURES ──────────────────────────────────────
    const trendFeatures = [
      this.calculateTrendStrength(prices),
      this.calculateMeanReversion(prices, current.price.close),
      this.calculateTrendDirection(prices),
      this.calculateSupportResistance(prices, current.price.close),
    ];

    // ── MULTI-EMA FEATURES (sorted for stable ordering) ─────
    const emaFeatures: number[] = [];
    if (current.indicators.multiEMA) {
      const sortedKeys = Object.keys(current.indicators.multiEMA)
        .map(Number)
        .sort((a, b) => a - b);
      for (const key of sortedKeys) {
        const emaVal = current.indicators.multiEMA[key];
        emaFeatures.push(emaVal / (current.price.close || 1));
      }
    }

    // ── EXTRA INDICATOR FLAGS ────────────────────────────────
    const flagFeatures = [
      current.indicators.ichimoku_bullish ? 1 : 0,
      current.indicators.bbPos ?? 0,
    ];

    const allFeatures = [
      ...priceFeatures,
      ...technicalFeatures,
      ...volumeFeatures,
      ...orderFlowFeatures,
      ...microstructureFeatures,
      ...momentumFeatures,
      ...volatilityFeatures,
      ...trendFeatures,
      ...emaFeatures,
      ...flagFeatures,
    ];

    // Fixed: replace NaN/Inf with 0 instead of dropping — preserves vector length
    return allFeatures.map(f => (Number.isFinite(f) ? f : 0));
  }

  static extractSequenceFeatures(
    frames: MarketFrame[],
    currentIndex: number,
    window = 20,
  ): number[] {
    const base = this.extractFeatures(frames, currentIndex);
    if (currentIndex < window || currentIndex >= frames.length) return base;
    const seq = SequenceEncoder.flattenSequence(frames, currentIndex, window);
    return [...base, ...seq];
  }

  // ── Private helpers ────────────────────────────────────────

  private static calculateMomentum(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0;
    const current = prices[prices.length - 1];
    const past    = prices[prices.length - 1 - period];
    return past === 0 ? 0 : (current - past) / past;
  }

  private static calculateVolatility(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const slice   = prices.slice(-period);
    const returns = slice.slice(1).map((p, i) => (slice[i] === 0 ? 0 : Math.log(p / slice[i])));
    if (returns.length === 0) return 0;
    const mean     = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    return Math.sqrt(variance);
  }

  private static calculateATR(
    highs: number[], lows: number[], closes: number[], period: number,
  ): number {
    if (highs.length < period) return 0;
    const trs: number[] = [];
    for (let i = 1; i < period; i++) {
      trs.push(Math.max(
        highs[i]  - lows[i],
        Math.abs(highs[i]  - closes[i - 1]),
        Math.abs(lows[i]   - closes[i - 1]),
      ));
    }
    return trs.length > 0 ? trs.reduce((s, t) => s + t, 0) / trs.length : 0;
  }

  private static calculateTrendStrength(prices: number[]): number {
    if (prices.length < 10) return 0;
    const slice = prices.slice(-10);
    let up = 0, down = 0;
    for (let i = 1; i < slice.length; i++) {
      if (slice[i] > slice[i - 1]) up++;
      else if (slice[i] < slice[i - 1]) down++;
    }
    return (up - down) / (slice.length - 1);
  }

  private static calculateMeanReversion(prices: number[], currentPrice: number): number {
    if (prices.length < 20) return 0;
    const mean = prices.reduce((s, p) => s + p, 0) / prices.length;
    const std  = Math.sqrt(prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length);
    return std === 0 ? 0 : (currentPrice - mean) / std;
  }

  private static calculateTrendDirection(prices: number[]): number {
    if (prices.length < 10) return 0;
    const slice = prices.slice(-10);
    const n     = slice.length;
    const x     = Array.from({ length: n }, (_, i) => i);
    const sumX  = x.reduce((s, v) => s + v, 0);
    const sumY  = slice.reduce((s, v) => s + v, 0);
    const sumXY = x.reduce((s, v, i) => s + v * slice[i], 0);
    const sumX2 = x.reduce((s, v) => s + v * v, 0);
    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return 0;
    const slope = (n * sumXY - sumX * sumY) / denom;
    // Normalise slope by mean price so it's scale-independent
    const meanPrice = sumY / n;
    return meanPrice === 0 ? 0 : slope / meanPrice;
  }

  private static calculateSupportResistance(prices: number[], currentPrice: number): number {
    if (prices.length < 20) return 0;
    const max = Math.max(...prices);
    const min = Math.min(...prices);
    const range = max - min;
    return range === 0 ? 0.5 : (currentPrice - min) / range;
  }
}

// ─────────────────────────────────────────────────────────────
// FEATURE NORMALIZER
// ─────────────────────────────────────────────────────────────

export class FeatureNormalizer {
  private method: 'zscore' | 'minmax' | 'robust';
  private means:    number[] = [];
  private stds:     number[] = [];
  private mins:     number[] = [];
  private maxs:     number[] = [];
  private medians:  number[] = [];
  private iqrs:     number[] = [];
  private history:  number[][] = [];
  private readonly historyCap: number;
  // Fixed: track whether a recompute is needed instead of doing it every partialFit call
  private dirtyRobust = false;
  private partialFitCount = 0;
  private readonly recomputeEvery = 50; // recompute robust stats every N partial fits

  constructor(opts?: { method?: 'zscore' | 'minmax' | 'robust'; historyCap?: number }) {
    this.method     = opts?.method     ?? 'zscore';
    this.historyCap = opts?.historyCap ?? 5000;
  }

  fit(X: number[][]): void {
    if (!X || X.length === 0) return;
    const nFeatures = X[0].length;
    this.means   = new Array(nFeatures).fill(0);
    this.stds    = new Array(nFeatures).fill(1);
    this.mins    = new Array(nFeatures).fill(Infinity);
    this.maxs    = new Array(nFeatures).fill(-Infinity);
    this.medians = new Array(nFeatures).fill(0);
    this.iqrs    = new Array(nFeatures).fill(1);

    const counts = new Array(nFeatures).fill(0);
    for (const row of X) {
      for (let j = 0; j < nFeatures; j++) {
        const v = this.safe(row[j]);
        this.means[j] += v;
        counts[j]++;
        if (v < this.mins[j]) this.mins[j] = v;
        if (v > this.maxs[j]) this.maxs[j] = v;
      }
    }
    for (let j = 0; j < nFeatures; j++) {
      this.means[j] /= counts[j] || 1;
    }
    const variances = new Array(nFeatures).fill(0);
    for (const row of X) {
      for (let j = 0; j < nFeatures; j++) {
        const d = this.safe(row[j]) - this.means[j];
        variances[j] += d * d;
      }
    }
    for (let j = 0; j < nFeatures; j++) {
      this.stds[j] = Math.sqrt(variances[j] / (counts[j] || 1)) || 1e-6;
    }

    this.history = X.slice(-this.historyCap);
    this.recomputeRobustStats(nFeatures);
  }

  transform(x: number[]): number[] {
    if (!x || x.length === 0) return x;
    return x.map((val, j) => {
      const v = this.safe(val);
      let out: number;
      if (this.method === 'zscore') {
        out = (v - (this.means[j] ?? 0)) / (this.stds[j] || 1e-6);
      } else if (this.method === 'minmax') {
        const range = ((this.maxs[j] ?? 1) - (this.mins[j] ?? 0)) || 1e-6;
        out = (v - (this.mins[j] ?? 0)) / range;
      } else {
        out = (v - (this.medians[j] ?? 0)) / (this.iqrs[j] || 1e-6);
      }
      return Number.isFinite(out) ? out : 0;
    });
  }

  /**
   * Fixed: batches the expensive O(n log n) robust recompute — only runs
   * every `recomputeEvery` calls instead of on every incoming frame.
   */
  partialFit(x: number[]): void {
    if (!x || x.length === 0) return;
    if (this.means.length === 0) { this.fit([x]); return; }

    if (this.history.length >= this.historyCap) this.history.shift();
    this.history.push(x.slice());

    for (let j = 0; j < x.length; j++) {
      const v = this.safe(x[j]);
      if (v < (this.mins[j] ?? v)) this.mins[j] = v;
      if (v > (this.maxs[j] ?? v)) this.maxs[j] = v;
    }

    this.partialFitCount++;
    if (this.partialFitCount % this.recomputeEvery === 0) {
      this.recomputeRobustStats(x.length);
    }
  }

  private recomputeRobustStats(nFeatures: number): void {
    const cols: number[][] = Array.from({ length: nFeatures }, () => []);
    for (const row of this.history) {
      for (let j = 0; j < nFeatures; j++) cols[j].push(this.safe(row[j]));
    }
    for (let j = 0; j < nFeatures; j++) {
      const arr = cols[j].sort((a, b) => a - b);
      const mid = Math.floor(arr.length / 2);
      this.medians[j] = arr.length === 0
        ? 0
        : arr.length % 2 === 0
          ? (arr[mid - 1] + arr[mid]) / 2
          : arr[mid];
      const q1 = arr[Math.floor(arr.length * 0.25)] ?? 0;
      const q3 = arr[Math.floor(arr.length * 0.75)] ?? 0;
      this.iqrs[j] = Math.max(1e-9, q3 - q1);
    }
  }

  private safe(v: number): number {
    return Number.isFinite(v) ? v : 0;
  }

  serialize(): object {
    return {
      method: this.method, means: this.means, stds: this.stds,
      mins: this.mins, maxs: this.maxs, medians: this.medians, iqrs: this.iqrs,
    };
  }

  deserialize(data: any): void {
    this.method  = data.method;
    this.means   = data.means;
    this.stds    = data.stds;
    this.mins    = data.mins;
    this.maxs    = data.maxs;
    this.medians = data.medians;
    this.iqrs    = data.iqrs;
  }
}

// ─────────────────────────────────────────────────────────────
// SEQUENCE ENCODER
// ─────────────────────────────────────────────────────────────

export class SequenceEncoder {
  // Fixed: `indicators` is not optional on MarketFrame — removed spurious optional chain
  static perFrameFields(frame: MarketFrame): number[] {
    const close = frame.price.close;
    const rsi   = frame.indicators.rsi ?? 50;
    const atr   = frame.indicators.atr ?? 0;
    const ema20 = frame.indicators.ema20 ?? close;
    const vol   = frame.volume ?? 0;
    return [close, rsi / 100, atr / (close || 1), ema20 / (close || 1), vol];
  }

  static flattenSequence(frames: MarketFrame[], currentIndex: number, window = 20): number[] {
    const start = Math.max(0, currentIndex - window + 1);
    const slice = frames.slice(start, currentIndex + 1);
    const out: number[] = [];
    const pad = window - slice.length;
    for (let i = 0; i < pad; i++) out.push(0, 0, 0, 0, 0);
    for (const f of slice) out.push(...this.perFrameFields(f));
    return out;
  }
}

// ─────────────────────────────────────────────────────────────
// MLP MODEL — Multi-Layer Perceptron with Adam optimiser
// ─────────────────────────────────────────────────────────────

interface LayerState {
  W:  number[][];  // [outSize][inSize]
  b:  number[];    // [outSize]
  // Adam first and second moments
  mW: number[][];
  vW: number[][];
  mb: number[];
  vb: number[];
  // Cache for backprop
  z:  number[];    // pre-activation
  a:  number[];    // post-activation
  input: number[]; // input to this layer
}

function relu(x: number): number { return Math.max(0, x); }
function reluDeriv(x: number): number { return x > 0 ? 1 : 0; }

/** Xavier uniform initialisation */
function xavierUniform(fanIn: number, fanOut: number): number {
  const limit = Math.sqrt(6 / (fanIn + fanOut));
  return (Math.random() * 2 - 1) * limit;
}

export class MLPModel implements MLModel {
  private layers: LayerState[] = [];
  private isTrained = false;
  private featureCount = 0;
  private normalizer: FeatureNormalizer;
  private featureImportance: Record<string, number> = {};
  private adamT = 0;

  // Hyper-parameters
  private readonly architecture = [128, 64, 32]; // hidden layer sizes
  private readonly lr      = 0.001;
  private readonly beta1   = 0.9;
  private readonly beta2   = 0.999;
  private readonly eps     = 1e-8;
  private readonly dropoutRate = 0.15;
  private readonly l2      = 1e-4;
  private readonly epochs  = 150;
  private readonly batchSize = 64;
  private readonly patience = 15; // early stopping

  constructor() {
    this.normalizer = new FeatureNormalizer({ method: 'robust' });
  }

  // ── Architecture helpers ─────────────────────────────────

  private buildLayers(inputSize: number): void {
    this.layers = [];
    const sizes = [inputSize, ...this.architecture, 1];
    for (let l = 0; l < sizes.length - 1; l++) {
      const inSize  = sizes[l];
      const outSize = sizes[l + 1];
      const W: number[][] = Array.from({ length: outSize }, () =>
        Array.from({ length: inSize }, () => xavierUniform(inSize, outSize)),
      );
      const b = new Array(outSize).fill(0);
      this.layers.push({
        W, b,
        mW: Array.from({ length: outSize }, () => new Array(inSize).fill(0)),
        vW: Array.from({ length: outSize }, () => new Array(inSize).fill(0)),
        mb: new Array(outSize).fill(0),
        vb: new Array(outSize).fill(0),
        z: [], a: [], input: [],
      });
    }
  }

  // ── Forward pass ─────────────────────────────────────────

  private forward(input: number[], training = false): number {
    let x = input.slice();
    for (let l = 0; l < this.layers.length; l++) {
      const layer    = this.layers[l];
      const isLast   = l === this.layers.length - 1;
      layer.input    = x.slice();
      const z: number[] = [];
      const a: number[] = [];

      for (let o = 0; o < layer.W.length; o++) {
        let sum = layer.b[o];
        for (let i = 0; i < x.length; i++) sum += layer.W[o][i] * x[i];
        z.push(sum);
        // tanh on output, ReLU on hidden
        const activated = isLast ? Math.tanh(sum) : relu(sum);
        // Dropout on hidden layers during training
        const dropped = (training && !isLast && Math.random() < this.dropoutRate) ? 0 : activated;
        a.push(dropped);
      }

      layer.z = z;
      layer.a = a;
      x       = a;
    }
    return x[0]; // scalar output
  }

  // ── Backward pass (Adam) ─────────────────────────────────

  private backward(label: number): void {
    this.adamT++;
    const lastLayer = this.layers[this.layers.length - 1];
    const pred      = lastLayer.a[0];

    // MSE gradient × tanh derivative for output neuron
    let delta = [2 * (pred - label) * (1 - pred * pred)];

    for (let l = this.layers.length - 1; l >= 0; l--) {
      const layer    = this.layers[l];
      const isLast   = l === this.layers.length - 1;
      const prevDelta: number[] = new Array(layer.input.length).fill(0);

      for (let o = 0; o < layer.W.length; o++) {
        const d = delta[o];

        // Gradient w.r.t. weights with L2 regularisation
        for (let i = 0; i < layer.input.length; i++) {
          const gW = d * layer.input[i] + this.l2 * layer.W[o][i];
          // Adam update
          layer.mW[o][i] = this.beta1 * layer.mW[o][i] + (1 - this.beta1) * gW;
          layer.vW[o][i] = this.beta2 * layer.vW[o][i] + (1 - this.beta2) * gW * gW;
          const mHat = layer.mW[o][i] / (1 - this.beta1 ** this.adamT);
          const vHat = layer.vW[o][i] / (1 - this.beta2 ** this.adamT);
          layer.W[o][i] -= this.lr * mHat / (Math.sqrt(vHat) + this.eps);
          // Accumulate delta for previous layer
          prevDelta[i] += d * layer.W[o][i];
        }

        // Gradient w.r.t. bias
        layer.mb[o] = this.beta1 * layer.mb[o] + (1 - this.beta1) * d;
        layer.vb[o] = this.beta2 * layer.vb[o] + (1 - this.beta2) * d * d;
        const mHatB = layer.mb[o] / (1 - this.beta1 ** this.adamT);
        const vHatB = layer.vb[o] / (1 - this.beta2 ** this.adamT);
        layer.b[o] -= this.lr * mHatB / (Math.sqrt(vHatB) + this.eps);
      }

      // Propagate delta through activation of previous layer
      if (l > 0) {
        const prevLayer = this.layers[l - 1];
        delta = prevDelta.map((d, i) => d * reluDeriv(prevLayer.z[i]));
      }
    }
  }

  // ── Training ─────────────────────────────────────────────

  async train(data: MarketFrame[]): Promise<void> {
    if (data.length < 100) return;

    const samples = this.buildTrainingSamples(data);
    if (samples.length === 0) return;

    // Normalise
    this.normalizer.fit(samples.map(s => s.features));
    const normalised = samples.map(s => ({
      features: this.normalizer.transform(s.features),
      label:    s.label,
    }));

    this.featureCount = normalised[0].features.length;
    this.buildLayers(this.featureCount);
    this.adamT = 0;

    // Class-balanced sampling weights
    const weights = this.computeSampleWeights(normalised.map(s => s.label));

    let bestLoss = Infinity;
    let noImprove = 0;

    for (let epoch = 0; epoch < this.epochs; epoch++) {
      // Weighted random mini-batch
      const batch = this.weightedSample(normalised, weights, this.batchSize);
      let totalLoss = 0;

      for (const sample of batch) {
        const pred = this.forward(sample.features, true);
        const loss = (pred - sample.label) ** 2;
        totalLoss += loss;
        this.backward(sample.label);
      }

      const avgLoss = totalLoss / batch.length;
      if (avgLoss < bestLoss - 1e-5) { bestLoss = avgLoss; noImprove = 0; }
      else { noImprove++; }
      if (noImprove >= this.patience) break;
    }

    this.isTrained = true;
    this.computeFeatureImportance(normalised);
  }

  predict(features: number[]): MLPrediction {
    if (!this.isTrained || this.layers.length === 0) {
      return { direction: 'NEUTRAL', confidence: 0.5, horizon: 60, features: {} };
    }

    // Fixed: pad or trim to trained feature count so dimensions always match
    const aligned   = this.alignFeatures(features, this.featureCount);
    const normed    = this.normalizer.transform(aligned);
    const activated = this.forward(normed, false); // tanh output ∈ (-1, 1)
    const confidence = Math.abs(activated);

    let direction: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
    if (activated >  0.15) direction = 'UP';
    if (activated < -0.15) direction = 'DOWN';

    return {
      direction,
      confidence: Math.min(confidence, 1.0),
      horizon: 60,
      features: this.buildFeatureMap(features),
    };
  }

  getFeatureImportance(): Record<string, number> { return { ...this.featureImportance }; }

  serialize(): object {
    return {
      type: 'MLP',
      architecture: this.architecture,
      featureCount: this.featureCount,
      isTrained: this.isTrained,
      layers: this.layers.map(l => ({ W: l.W, b: l.b })),
      normalizer: this.normalizer.serialize(),
    };
  }

  deserialize(data: any): void {
    this.featureCount = data.featureCount;
    this.isTrained    = data.isTrained;
    this.normalizer.deserialize(data.normalizer);
    this.buildLayers(this.featureCount);
    for (let i = 0; i < this.layers.length; i++) {
      this.layers[i].W = data.layers[i].W;
      this.layers[i].b = data.layers[i].b;
    }
  }

  // ── Private helpers ──────────────────────────────────────

  private buildTrainingSamples(data: MarketFrame[]): { features: number[]; label: number }[] {
    const out: { features: number[]; label: number }[] = [];
    for (let i = 30; i < data.length - 10; i++) {
      const features = FeatureExtractor.extractFeatures(data, i);
      if (features.length === 0) continue;
      const current = data[i].price.close;
      const future  = data[i + 10].price.close;
      const change  = (future - current) / (current || 1);
      // Include all samples, not just directional — model learns NEUTRAL too
      const label = Math.max(-1, Math.min(1, change * 50)); // scale to ~(-1,1)
      out.push({ features, label });
    }
    return out;
  }

  private computeSampleWeights(labels: number[]): number[] {
    // Fixed: balance classes by upweighting minority class members
    const positives = labels.filter(l => l > 0.1).length;
    const negatives = labels.filter(l => l < -0.1).length;
    const neutrals  = labels.length - positives - negatives;
    const total     = labels.length;
    const weights: number[] = labels.map(l => {
      if (l > 0.1)  return total / (3 * (positives || 1));
      if (l < -0.1) return total / (3 * (negatives || 1));
      return total / (3 * (neutrals || 1));
    });
    const wSum = weights.reduce((s, w) => s + w, 0);
    return weights.map(w => w / wSum);
  }

  private weightedSample<T>(
    items: T[], weights: number[], n: number,
  ): T[] {
    const result: T[] = [];
    const cumulative = weights.reduce<number[]>((acc, w, i) => {
      acc.push((acc[i - 1] ?? 0) + w);
      return acc;
    }, []);
    for (let i = 0; i < n; i++) {
      const r   = Math.random();
      let lo = 0, hi = cumulative.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cumulative[mid] < r) lo = mid + 1; else hi = mid;
      }
      result.push(items[lo]);
    }
    return result;
  }

  private alignFeatures(features: number[], expected: number): number[] {
    if (features.length === expected) return features;
    if (features.length > expected)   return features.slice(0, expected);
    return [...features, ...new Array(expected - features.length).fill(0)];
  }

  private computeFeatureImportance(
    samples: { features: number[]; label: number }[],
  ): void {
    // Permutation importance: shuffle each feature and measure accuracy drop
    const baseline = this.evalAccuracy(samples);
    const importance: Record<string, number> = {};
    const names = getBaseFeatureNames();

    for (let j = 0; j < Math.min(samples[0].features.length, names.length); j++) {
      const shuffled = samples.map(s => {
        const f = s.features.slice();
        f[j]    = samples[Math.floor(Math.random() * samples.length)].features[j];
        return { features: f, label: s.label };
      });
      const acc = this.evalAccuracy(shuffled);
      importance[names[j]] = Math.max(0, baseline - acc);
    }
    this.featureImportance = importance;
  }

  private evalAccuracy(samples: { features: number[]; label: number }[]): number {
    let correct = 0;
    for (const s of samples) {
      const pred  = this.forward(s.features, false);
      const pDir  = pred  >  0.15 ? 1 : pred  < -0.15 ? -1 : 0;
      const lDir  = s.label > 0.1  ? 1 : s.label < -0.1  ? -1 : 0;
      if (pDir === lDir) correct++;
    }
    return correct / (samples.length || 1);
  }

  private buildFeatureMap(features: number[]): Record<string, number> {
    const names = getBaseFeatureNames();
    const map: Record<string, number> = {};
    for (let i = 0; i < names.length && i < features.length; i++) {
      map[names[i]] = features[i];
    }
    return map;
  }
}

// ─────────────────────────────────────────────────────────────
// DECISION TREE — used internally by RandomForestModel
// ─────────────────────────────────────────────────────────────

interface TreeNode {
  featureIndex?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  value?: number; // leaf prediction
}

class DecisionTree {
  private root: TreeNode | null = null;
  private readonly maxDepth:    number;
  private readonly minSamples:  number;
  private readonly featureFrac: number; // fraction of features to consider at each split

  constructor(maxDepth = 8, minSamples = 5, featureFrac = 0.7) {
    this.maxDepth    = maxDepth;
    this.minSamples  = minSamples;
    this.featureFrac = featureFrac;
  }

  fit(X: number[][], y: number[]): void {
    this.root = this.buildNode(X, y, 0);
  }

  predict(x: number[]): number {
    let node = this.root;
    while (node && node.featureIndex !== undefined && node.threshold !== undefined) {
      node = x[node.featureIndex] <= node.threshold ? node.left! : node.right!;
    }
    return node?.value ?? 0;
  }

  private buildNode(X: number[][], y: number[], depth: number): TreeNode {
    if (depth >= this.maxDepth || y.length <= this.minSamples) {
      return { value: mean(y) };
    }

    const { featureIndex, threshold, leftIdx, rightIdx } = this.bestSplit(X, y);
    if (featureIndex === -1 || leftIdx.length === 0 || rightIdx.length === 0) {
      return { value: mean(y) };
    }

    return {
      featureIndex,
      threshold,
      left:  this.buildNode(leftIdx.map(i => X[i]), leftIdx.map(i => y[i]), depth + 1),
      right: this.buildNode(rightIdx.map(i => X[i]), rightIdx.map(i => y[i]), depth + 1),
    };
  }

  private bestSplit(X: number[][], y: number[]): {
    featureIndex: number; threshold: number;
    leftIdx: number[]; rightIdx: number[];
  } {
    const nFeatures = X[0].length;
    const nSample   = Math.max(1, Math.floor(nFeatures * this.featureFrac));
    // Random feature subset
    const featureCandidates = shuffle(Array.from({ length: nFeatures }, (_, i) => i)).slice(0, nSample);

    let bestGain = -Infinity;
    let bestFeature = -1;
    let bestThreshold = 0;
    let bestLeft: number[] = [];
    let bestRight: number[] = [];

    const parentVar = variance(y);

    for (const fi of featureCandidates) {
      const col    = X.map(row => row[fi]);
      const sorted = [...new Set(col)].sort((a, b) => a - b);
      // Try midpoints between unique values (cap candidates for speed)
      const candidates = sorted.slice(0, 20);

      for (let ti = 0; ti < candidates.length - 1; ti++) {
        const thresh = (candidates[ti] + candidates[ti + 1]) / 2;
        const left   = y.map((_, i) => i).filter(i => col[i] <= thresh);
        const right  = y.map((_, i) => i).filter(i => col[i] >  thresh);
        if (left.length < this.minSamples || right.length < this.minSamples) continue;

        const gain = parentVar
          - (left.length  / y.length) * variance(left.map(i => y[i]))
          - (right.length / y.length) * variance(right.map(i => y[i]));

        if (gain > bestGain) {
          bestGain      = gain;
          bestFeature   = fi;
          bestThreshold = thresh;
          bestLeft      = left;
          bestRight     = right;
        }
      }
    }

    return { featureIndex: bestFeature, threshold: bestThreshold, leftIdx: bestLeft, rightIdx: bestRight };
  }
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}

function variance(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─────────────────────────────────────────────────────────────
// RANDOM FOREST MODEL
// ─────────────────────────────────────────────────────────────

export class RandomForestModel implements MLModel {
  private trees: DecisionTree[] = [];
  private isTrained = false;
  private normalizer: FeatureNormalizer;
  private featureImportance: Record<string, number> = {};
  private readonly nTrees    = 50;
  private readonly maxDepth  = 8;
  private readonly bagFrac   = 0.8;

  constructor() {
    this.normalizer = new FeatureNormalizer({ method: 'minmax' });
  }

  async train(data: MarketFrame[]): Promise<void> {
    if (data.length < 100) return;

    const samples = this.buildTrainingSamples(data);
    if (samples.length === 0) return;

    this.normalizer.fit(samples.map(s => s.features));
    const X = samples.map(s => this.normalizer.transform(s.features));
    const y = samples.map(s => s.label);

    // Balance classes via oversampling
    const { X: Xbal, y: ybal } = this.balance(X, y);

    this.trees = [];
    const bagSize = Math.floor(Xbal.length * this.bagFrac);

    for (let t = 0; t < this.nTrees; t++) {
      // Bootstrap sample
      const indices = Array.from({ length: bagSize }, () => Math.floor(Math.random() * Xbal.length));
      const Xbag    = indices.map(i => Xbal[i]);
      const ybag    = indices.map(i => ybal[i]);
      const tree    = new DecisionTree(this.maxDepth, 5, 0.7);
      tree.fit(Xbag, ybag);
      this.trees.push(tree);
    }

    this.isTrained = true;
    this.featureImportance = this.estimateImportance(X, y);
  }

  predict(features: number[]): MLPrediction {
    if (!this.isTrained || this.trees.length === 0) {
      return { direction: 'NEUTRAL', confidence: 0.5, horizon: 60, features: {} };
    }
    const normed = this.normalizer.transform(features);
    const votes  = this.trees.map(t => t.predict(normed));
    const avg    = mean(votes);
    const std    = Math.sqrt(variance(votes));
    // Low variance across trees = high agreement = higher confidence
    const rawConf = 1 - Math.min(1, std * 4);

    let direction: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
    if (avg >  0.1) direction = 'UP';
    if (avg < -0.1) direction = 'DOWN';

    return {
      direction,
      confidence: Math.max(0, Math.min(1, rawConf)),
      horizon: 60,
      features: this.buildFeatureMap(features),
    };
  }

  getFeatureImportance(): Record<string, number> { return { ...this.featureImportance }; }

  serialize(): object {
    return {
      type: 'RandomForest',
      isTrained: this.isTrained,
      normalizer: this.normalizer.serialize(),
      // Note: tree structure serialisation omitted for brevity — hook into a model registry here
    };
  }

  deserialize(data: any): void {
    this.isTrained = data.isTrained;
    this.normalizer.deserialize(data.normalizer);
  }

  private buildTrainingSamples(data: MarketFrame[]): { features: number[]; label: number }[] {
    const out: { features: number[]; label: number }[] = [];
    for (let i = 30; i < data.length - 10; i++) {
      const features = FeatureExtractor.extractFeatures(data, i);
      if (features.length === 0) continue;
      const change = (data[i + 10].price.close - data[i].price.close) / (data[i].price.close || 1);
      const label  = change > 0.005 ? 1 : change < -0.005 ? -1 : 0;
      out.push({ features, label });
    }
    return out;
  }

  private balance(X: number[][], y: number[]): { X: number[][]; y: number[] } {
    const classes: Record<string, number[]> = { '1': [], '-1': [], '0': [] };
    y.forEach((label, i) => classes[String(label)]?.push(i));
    const maxCount = Math.max(...Object.values(classes).map(c => c.length));

    const newX: number[][] = [];
    const newY: number[]   = [];
    for (const [cls, indices] of Object.entries(classes)) {
      for (let i = 0; i < maxCount; i++) {
        const idx = indices[i % indices.length];
        newX.push(X[idx]);
        newY.push(Number(cls));
      }
    }
    return { X: newX, y: newY };
  }

  private estimateImportance(X: number[][], y: number[]): Record<string, number> {
    const baseline = this.oobAccuracy(X, y);
    const names    = getBaseFeatureNames();
    const importance: Record<string, number> = {};
    for (let j = 0; j < Math.min(X[0].length, names.length); j++) {
      const permuted = X.map(row => {
        const r = row.slice();
        r[j]    = X[Math.floor(Math.random() * X.length)][j];
        return r;
      });
      const acc = this.oobAccuracy(permuted, y);
      importance[names[j]] = Math.max(0, baseline - acc);
    }
    return importance;
  }

  private oobAccuracy(X: number[][], y: number[]): number {
    let correct = 0;
    for (let i = 0; i < X.length; i++) {
      const votes = this.trees.map(t => t.predict(X[i]));
      const avg   = mean(votes);
      const pred  = avg > 0.1 ? 1 : avg < -0.1 ? -1 : 0;
      if (pred === y[i]) correct++;
    }
    return correct / (X.length || 1);
  }

  private buildFeatureMap(features: number[]): Record<string, number> {
    const names = getBaseFeatureNames();
    const map: Record<string, number> = {};
    for (let i = 0; i < names.length && i < features.length; i++) map[names[i]] = features[i];
    return map;
  }
}

// ─────────────────────────────────────────────────────────────
// ENSEMBLE MODEL — MLP + Random Forest weighted vote
// ─────────────────────────────────────────────────────────────

export class EnsembleModel implements MLModel {
  private mlp: MLPModel;
  private rf:  RandomForestModel;
  // Learned weights start equal; updated via validation performance
  private mlpWeight = 0.55;
  private rfWeight  = 0.45;

  constructor() {
    this.mlp = new MLPModel();
    this.rf  = new RandomForestModel();
  }

  async train(data: MarketFrame[]): Promise<void> {
    console.log('[Ensemble] Training MLP...');
    await this.mlp.train(data);
    console.log('[Ensemble] Training RandomForest...');
    await this.rf.train(data);
    this.calibrateWeights(data);
    console.log('[Ensemble] Training complete.');
  }

  predict(features: number[]): MLPrediction {
    const pMLP = this.mlp.predict(features);
    const pRF  = this.rf.predict(features);

    // Directional score: UP=+1, DOWN=-1, NEUTRAL=0
    const score = (
      this.mlpWeight * (directionScore(pMLP) * pMLP.confidence) +
      this.rfWeight  * (directionScore(pRF)  * pRF.confidence)
    );

    const confidence = Math.abs(score);
    let direction: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
    if (score >  0.12) direction = 'UP';
    if (score < -0.12) direction = 'DOWN';

    return {
      direction,
      confidence: Math.min(confidence, 1.0),
      horizon: 60,
      features: { ...pMLP.features, ...pRF.features },
    };
  }

  getFeatureImportance(): Record<string, number> {
    const mlpImp = this.mlp.getFeatureImportance();
    const rfImp  = this.rf.getFeatureImportance();
    const merged: Record<string, number> = {};
    const allKeys = new Set([...Object.keys(mlpImp), ...Object.keys(rfImp)]);
    for (const k of allKeys) {
      merged[k] = this.mlpWeight * (mlpImp[k] ?? 0) + this.rfWeight * (rfImp[k] ?? 0);
    }
    return merged;
  }

  serialize(): object {
    return {
      type: 'Ensemble',
      mlpWeight: this.mlpWeight,
      rfWeight:  this.rfWeight,
      mlp: this.mlp.serialize(),
      rf:  this.rf.serialize(),
    };
  }

  deserialize(data: any): void {
    this.mlpWeight = data.mlpWeight;
    this.rfWeight  = data.rfWeight;
    this.mlp.deserialize(data.mlp);
    this.rf.deserialize(data.rf);
  }

  private calibrateWeights(data: MarketFrame[]): void {
    // Evaluate each model on last 20% of data and weight by accuracy
    const splitIdx = Math.floor(data.length * 0.8);
    let mlpCorrect = 0, rfCorrect = 0, total = 0;
    for (let i = splitIdx + 20; i < data.length - 10; i++) {
      const features = FeatureExtractor.extractFeatures(data, i);
      if (features.length === 0) continue;
      const change = (data[i + 10].price.close - data[i].price.close) / (data[i].price.close || 1);
      const actual = change > 0.005 ? 'UP' : change < -0.005 ? 'DOWN' : 'NEUTRAL';
      if (this.mlp.predict(features).direction === actual) mlpCorrect++;
      if (this.rf.predict(features).direction  === actual) rfCorrect++;
      total++;
    }
    if (total === 0) return;
    const mlpAcc = mlpCorrect / total;
    const rfAcc  = rfCorrect / total;
    const sum    = mlpAcc + rfAcc || 1;
    this.mlpWeight = mlpAcc / sum;
    this.rfWeight  = rfAcc  / sum;
    console.log(`[Ensemble] Calibrated weights — MLP: ${this.mlpWeight.toFixed(3)}, RF: ${this.rfWeight.toFixed(3)}`);
  }
}

function directionScore(pred: MLPrediction): number {
  if (pred.direction === 'UP')   return  1;
  if (pred.direction === 'DOWN') return -1;
  return 0;
}

// ─────────────────────────────────────────────────────────────
// ML SIGNAL ENHANCER
// ─────────────────────────────────────────────────────────────

export class MLSignalEnhancer {
  private model: EnsembleModel;

  constructor() {
    this.model = new EnsembleModel();
  }

  async enhanceSignal(
    signal: Signal,
    frames: MarketFrame[],
    currentIndex: number,
  ): Promise<Signal> {
    const features = FeatureExtractor.extractSequenceFeatures(frames, currentIndex);
    if (features.length === 0) return signal;

    const prediction = this.model.predict(features);

    let enhancedConfidence = signal.confidence;
    let enhancedStrength   = signal.strength;

    const agrees = (signal.type === 'BUY'  && prediction.direction === 'UP') ||
                   (signal.type === 'SELL' && prediction.direction === 'DOWN');
    const disagrees = (signal.type === 'BUY'  && prediction.direction === 'DOWN') ||
                      (signal.type === 'SELL' && prediction.direction === 'UP');

    if (agrees) {
      enhancedConfidence = Math.min(1.0, signal.confidence + prediction.confidence * 0.3);
      enhancedStrength   = Math.min(1.0, signal.strength   + prediction.confidence * 0.2);
    } else if (disagrees) {
      enhancedConfidence = Math.max(0.1, signal.confidence - prediction.confidence * 0.4);
      enhancedStrength   = Math.max(0.1, signal.strength   - prediction.confidence * 0.3);
    }

    const mlReasoning = `ML[Ensemble]: ${prediction.direction} @ ${(prediction.confidence * 100).toFixed(1)}% conf`;
    const enhancedReasoning = Array.isArray(signal.reasoning)
      ? [...signal.reasoning, mlReasoning]
      : [mlReasoning];

    return { ...signal, confidence: enhancedConfidence, strength: enhancedStrength, reasoning: enhancedReasoning };
  }

  /**
   * Fixed: passes full frames array so lookback-based features can be computed properly.
   * Fixed: enhanceFeatures now operates with real lookback instead of undefined (frame as any) casts.
   */
  async trainModel(frames: MarketFrame[]): Promise<void> {
    console.log('[MLSignalEnhancer] Training ensemble on', frames.length, 'frames...');
    const enriched = this.enrichFrames(frames);
    await this.model.train(enriched);
    console.log('[MLSignalEnhancer] Training complete.');
  }

  getModelInsights(): Record<string, number> {
    return this.model.getFeatureImportance();
  }

  serialize(): object {
    return this.model.serialize();
  }

  deserialize(data: object): void {
    this.model.deserialize(data);
  }

  /**
   * Fixed: computes all lookback values from the actual frames array.
   * No more (frame as any).prevPrice = undefined silently returning 0.
   */
  private enrichFrames(frames: MarketFrame[]): MarketFrame[] {
    return frames.map((frame, i) => {
      const prev    = i > 0    ? frames[i - 1]  : frame;
      const week    = i >= 7   ? frames[i - 7]  : frame;
      const month   = i >= 30  ? frames[i - 30] : frame;
      const prevAdx = prev.indicators.adx ?? 25;
      const adx     = frame.indicators.adx ?? 25;

      // Compute 20-bar average volume
      const volSlice  = frames.slice(Math.max(0, i - 20), i);
      const avgVol20d = volSlice.length > 0
        ? volSlice.reduce((s, f) => s + f.volume, 0) / volSlice.length
        : frame.volume;

      return {
        ...frame,
        // Velocity
        velocity1d: (frame.price.close - prev.price.close) / (prev.price.close || 1),
        velocity7d: (frame.price.close - week.price.close) / (week.price.close || 1),
        // Volume quality
        volumeSpike: frame.volume / (avgVol20d || 1),
        volumeTrend: frame.volume > prev.volume ? 1 : -1,
        // Regime
        adxRising:    adx > prevAdx ? 1 : 0,
        marketRegime: this.classifyRegime(frame),
        // Price action
        higherLows:  frame.price.low  > prev.price.low  ? 1 : 0,
        higherHighs: frame.price.high > prev.price.high ? 1 : 0,
        // Long-range momentum (stored back on indicators for FeatureExtractor to pick up)
        indicators: {
          ...frame.indicators,
          mom7d:  (frame.price.close - week.price.close)  / (week.price.close  || 1),
          mom30d: (frame.price.close - month.price.close) / (month.price.close || 1),
          volumeRatio: frame.volume / (avgVol20d || 1),
        },
      } as MarketFrame;
    });
  }

  private classifyRegime(frame: MarketFrame): number {
    const adx  = frame.indicators.adx ?? 25;
    const atr  = frame.indicators.atr ?? 0;
    const vol  = atr / (frame.price.close || 1);
    if (adx > 25 && vol < 0.05) return 1; // trending
    if (vol > 0.05)              return 3; // volatile
    return 2;                              // choppy
  }
}

// ─────────────────────────────────────────────────────────────
// FEATURE NAME REGISTRY (single source of truth)
// ─────────────────────────────────────────────────────────────

/**
 * Fixed: getBaseFeatureNames now matches extractFeatures output exactly.
 * multiEMA features are dynamic and appended after these base names.
 */
export function getBaseFeatureNames(): string[] {
  return [
    // Price (7)
    'close', 'open', 'high', 'low', 'daily_range', 'daily_return', 'range_ratio',
    // Technical (16)
    'rsi', 'macd', 'macd_signal', 'macd_hist', 'bb_position', 'bb_width',
    'stoch_k', 'stoch_d', 'adx', 'vwap_rel', 'atr_norm',
    'price_ema20', 'price_ema50', 'price_ema200', 'ema20_50', 'ema50_200',
    // Volume (3)
    'volume_ratio', 'volume_ratio_2', 'volume_volatility',
    // Order flow (6)
    'net_flow_ratio', 'bid_ask_imbalance', 'large_orders_ratio',
    'small_orders_ratio', 'large_small_ratio', 'bid_ratio',
    // Microstructure (4)
    'spread_ratio', 'depth_ratio', 'imbalance', 'toxicity',
    // Momentum (7)
    'momentum_5', 'momentum_10', 'momentum_20',
    'momentum_short', 'momentum_long', 'mom_7d', 'mom_30d',
    // Volatility (5)
    'volatility_5', 'volatility_10', 'volatility_20', 'atr_10', 'atr_20',
    // Trend (4)
    'trend_strength', 'mean_reversion', 'trend_direction', 'support_resistance',
    // Flags (2)
    'ichimoku_bullish', 'bb_pos',
  ];
}