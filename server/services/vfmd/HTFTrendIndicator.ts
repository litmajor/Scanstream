// ─────────────────────────────────────────────
// HTFTrendIndicator.ts
// Replaces sin(dominantAngle) as the directional model
// Produces a bias score [-1, +1] from 4H structure
// ─────────────────────────────────────────────

export type TrendBias = "BULLISH" | "BEARISH" | "NEUTRAL";

export interface HTFBar {
  timestamp: number;
  open:      number;
  high:      number;
  low:       number;
  close:     number;
  volume?:   number;
}

export interface HTFTrendState {
  bias:             TrendBias;
  /** Continuous score [-1, +1]. >0.3 = usable long, <-0.3 = usable short */
  score:            number;
  /** EMA alignment: price above/below both EMAs */
  ema_aligned:      boolean;
  /** Higher highs + higher lows structure on 4H */
  structure_bullish: boolean | null; // null = insufficient data
  /** ADX — trend strength. <20 = weak, >25 = confirmed trend */
  adx:              number;
  /** ATR-normalized slope of fast EMA */
  ema_slope_norm:   number;
  confidence:       "HIGH" | "MEDIUM" | "LOW";
  computed_at:      number;
}

export interface HTFTrendConfig {
  /** Fast EMA period (default: 21) */
  ema_fast:   number;
  /** Slow EMA period (default: 55) */
  ema_slow:   number;
  /** ADX period (default: 14) */
  adx_period: number;
  /**
   * Minimum score magnitude to emit a non-NEUTRAL bias.
   * Below this → NEUTRAL → no trade.
   */
  neutral_threshold: number; // default: 0.25
  /**
   * Structure lookback: how many 4H bars to check for HH/HL or LH/LL
   */
  structure_lookback: number; // default: 10
}

export const DEFAULT_HTF_CONFIG: HTFTrendConfig = {
  ema_fast:           21,
  ema_slow:           55,
  adx_period:         14,
  neutral_threshold:  0.25,
  structure_lookback: 10,
};

// ── Implementation ───────────────────────────────────────────────────────────

export class HTFTrendIndicator {
  compute(bars: HTFBar[], config: HTFTrendConfig = DEFAULT_HTF_CONFIG): HTFTrendState {
    const closes = bars.map(b => b.close);
    const highs  = bars.map(b => b.high);
    const lows   = bars.map(b => b.low);
    const n      = bars.length;

    const required = Math.max(config.ema_slow, config.adx_period * 2) + config.structure_lookback;
    if (n < required) {
      return this._insufficient(bars[n - 1]?.timestamp ?? Date.now());
    }

    // ── 1. EMA alignment ─────────────────────────────────────────────────────
    const ema_fast_val = this._ema(closes, config.ema_fast);
    const ema_slow_val = this._ema(closes, config.ema_slow);
    const last_close   = closes[n - 1];

    const above_both   = last_close > ema_fast_val && last_close > ema_slow_val;
    const below_both   = last_close < ema_fast_val && last_close < ema_slow_val;
    const ema_aligned  = above_both || below_both;
    const ema_bull     = above_both && ema_fast_val > ema_slow_val;
    const ema_bear     = below_both && ema_fast_val < ema_slow_val;

    // ── 2. EMA slope (ATR-normalized) ────────────────────────────────────────
    const ema_fast_prev  = this._ema(closes.slice(0, -1), config.ema_fast);
    const atr_val        = this._atr(closes, highs, lows, 14);
    const ema_slope_norm = atr_val > 0 ? (ema_fast_val - ema_fast_prev) / atr_val : 0;

    // ── 3. Market structure (HH/HL vs LH/LL) ─────────────────────────────────
    const lb_highs = highs.slice(-config.structure_lookback);
    const lb_lows  = lows.slice(-config.structure_lookback);
    const structure_bullish = this._detectStructure(lb_highs, lb_lows);

    // ── 4. ADX trend strength ────────────────────────────────────────────────
    const adx = this._adx(highs, lows, closes, config.adx_period);

    // ── 5. Composite score ───────────────────────────────────────────────────
    // Each component contributes proportionally
    // EMA alignment:  40%
    // Structure:      30%
    // Slope:          20%
    // ADX modifier:   10% (amplifies or dampens the score)

    const ema_component = ema_bull ? 0.4 : ema_bear ? -0.4 : 0;
    const str_component = structure_bullish === true  ?  0.3
                        : structure_bullish === false ? -0.3
                        : 0;
    const slope_component = Math.max(-0.2, Math.min(0.2, ema_slope_norm * 0.2));
    const adx_modifier    = adx > 25 ? 1.1 : adx > 20 ? 1.0 : 0.7; // weak trend discounts score

    const raw_score = (ema_component + str_component + slope_component) * adx_modifier;
    const score     = Math.max(-1, Math.min(1, raw_score));

    // ── 6. Bias + Confidence ─────────────────────────────────────────────────
    let bias: TrendBias;
    if (Math.abs(score) < config.neutral_threshold) {
      bias = "NEUTRAL";
    } else {
      bias = score > 0 ? "BULLISH" : "BEARISH";
    }

    const all_agree   = ema_aligned && structure_bullish !== null && adx > 25;
    const most_agree  = (ema_aligned || structure_bullish !== null) && adx > 20;
    const confidence  = all_agree ? "HIGH" : most_agree ? "MEDIUM" : "LOW";

    return {
      bias,
      score,
      ema_aligned,
      structure_bullish,
      adx,
      ema_slope_norm,
      confidence,
      computed_at: bars[n - 1].timestamp,
    };
  }

  /**
   * Gate function — use this in VFMDPhysicsAgent before any entry.
   * Returns true if the HTF bias permits a trade in the given direction.
   */
  allowsEntry(
    state:     HTFTrendState,
    direction: "LONG" | "SHORT",
    config:    HTFTrendConfig = DEFAULT_HTF_CONFIG
  ): boolean {
    if (state.bias === "NEUTRAL") return false;
    if (state.confidence === "LOW") return false;
    if (direction === "LONG"  && state.bias !== "BULLISH") return false;
    if (direction === "SHORT" && state.bias !== "BEARISH") return false;
    return true;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _ema(values: number[], period: number): number {
    if (values.length < period) {
      return values.reduce((a, b) => a + b, 0) / values.length;
    }
    const k = 2 / (period + 1);
    let ema  = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k);
    }
    return ema;
  }

  private _atr(closes: number[], highs: number[], lows: number[], period: number): number {
    const tr: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      tr.push(Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i]  - closes[i - 1])
      ));
    }
    if (tr.length < period) return tr.reduce((a, b) => a + b, 0) / tr.length;
    let rma = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < tr.length; i++) {
      rma = (rma * (period - 1) + tr[i]) / period;
    }
    return rma;
  }

  private _adx(
    highs:  number[],
    lows:   number[],
    closes: number[],
    period: number
  ): number {
    const dmPlus:  number[] = [];
    const dmMinus: number[] = [];
    const tr:      number[] = [];

    for (let i = 1; i < closes.length; i++) {
      const upMove   = highs[i]  - highs[i - 1];
      const downMove = lows[i - 1] - lows[i];
      dmPlus.push(upMove > downMove && upMove > 0 ? upMove : 0);
      dmMinus.push(downMove > upMove && downMove > 0 ? downMove : 0);
      tr.push(Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i]  - closes[i - 1])
      ));
    }

    if (tr.length < period) return 0;

    // Wilder smoothing
    const smooth = (arr: number[]): number[] => {
      const out = [arr.slice(0, period).reduce((a, b) => a + b, 0)];
      for (let i = period; i < arr.length; i++) {
        out.push(out[out.length - 1] - out[out.length - 1] / period + arr[i]);
      }
      return out;
    };

    const sTR    = smooth(tr);
    const sDMP   = smooth(dmPlus);
    const sDMM   = smooth(dmMinus);
    const dx: number[] = [];

    for (let i = 0; i < sTR.length; i++) {
      if (sTR[i] === 0) continue;
      const diP = (sDMP[i] / sTR[i]) * 100;
      const diM = (sDMM[i] / sTR[i]) * 100;
      const sum  = diP + diM;
      dx.push(sum > 0 ? Math.abs(diP - diM) / sum * 100 : 0);
    }

    if (dx.length < period) return 0;
    let adx = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < dx.length; i++) {
      adx = (adx * (period - 1) + dx[i]) / period;
    }
    return adx;
  }

  /**
   * Detects Higher Highs + Higher Lows (bullish) or Lower Highs + Lower Lows (bearish).
   * Returns true = bullish structure, false = bearish, null = mixed/unclear.
   */
  private _detectStructure(highs: number[], lows: number[]): boolean | null {
    const n = highs.length;
    if (n < 4) return null;

    // Find swing highs and lows (simplified: compare every 2 bars)
    const swingHighs: number[] = [];
    const swingLows:  number[] = [];

    for (let i = 1; i < n - 1; i++) {
      if (highs[i] > highs[i - 1] && highs[i] > highs[i + 1]) swingHighs.push(highs[i]);
      if (lows[i]  < lows[i - 1]  && lows[i]  < lows[i + 1])  swingLows.push(lows[i]);
    }

    if (swingHighs.length < 2 || swingLows.length < 2) return null;

    const hhCount = swingHighs.slice(1).filter((h, i) => h > swingHighs[i]).length;
    const hlCount = swingLows.slice(1).filter((l, i) => l > swingLows[i]).length;
    const lhCount = swingHighs.slice(1).filter((h, i) => h < swingHighs[i]).length;
    const llCount = swingLows.slice(1).filter((l, i) => l < swingLows[i]).length;

    const bullScore = hhCount + hlCount;
    const bearScore = lhCount + llCount;

    if (bullScore > bearScore + 1) return true;
    if (bearScore > bullScore + 1) return false;
    return null;
  }

  private _insufficient(ts: number): HTFTrendState {
    return {
      bias:              "NEUTRAL",
      score:             0,
      ema_aligned:       false,
      structure_bullish: null,
      adx:               0,
      ema_slope_norm:    0,
      confidence:        "LOW",
      computed_at:       ts,
    };
  }
}