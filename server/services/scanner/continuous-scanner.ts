import EventEmitter from 'events';
import MomentumScanner from './momentum-scanner';
import type { MomentumScoreResult } from './momentum-scanner';

// Minimal MarketFrame shape used by scanner logic. If a canonical type exists
// elsewhere (eg. server/services/gateway types), replace this import later.
export interface MarketFrame {
  timestamp: number; // unix ms
  price: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  volume?: number;
  indicators?: Record<string, any>;
}

export interface ContinuousScannerOptions {
  pollIntervalMs?: number;
  lookbackCandles?: number;
  persistIntervalMs?: number;
}

/**
 * ContinuousMultiTimeframeScanner
 * - orchestrates periodic fetches of market frames (via a gateway/aggregator)
 * - computes indicators and momentum scores (plugs into MomentumScanner)
 * - emits results and optionally persists to storage
 *
 * This is a lightweight, framework-level skeleton intended to host the
 * port of python's ContinuousMultiTimeframeScanner logic. Core data-fetching
 * should be provided by a caller via the `fetchFrames` callback so we keep
 * concerns separated (gateway vs scanner).
 */
export class ContinuousMultiTimeframeScanner extends EventEmitter {
  private running = false;
  private timer?: NodeJS.Timeout;
  private readonly opts: Required<ContinuousScannerOptions>;

  constructor(private symbols: string[], private timeframes: string[], opts?: ContinuousScannerOptions) {
    super();
    this.opts = {
      pollIntervalMs: 30_000,
      lookbackCandles: 200,
      persistIntervalMs: 5 * 60_000,
      ...(opts ?? {})
    };
  }

  /**
   * Start continuous scanning loop.
   * `fetchFrames` must return a map symbol->timeframe->MarketFrame[] for requested lookback.
   */
  start(fetchFrames: (symbols: string[], timeframes: string[], lookback: number) => Promise<Record<string, Record<string, MarketFrame[]>>>) {
    if (this.running) return;
    this.running = true;
    const loop = async () => {
      try {
        const data = await fetchFrames(this.symbols, this.timeframes, this.opts.lookbackCandles);
        // Emit a raw snapshot for consumers (momentum scorer, persistence, UI)
        this.emit('snapshot', { timestamp: Date.now(), data });

        // Process per-symbol/timeframe analysis using MomentumScanner
        const processed: Record<string, Record<string, { score: number; reason?: string; indicators?: Record<string, any>; framesCount: number }>> = {};
        for (const symbol of Object.keys(data)) {
          processed[symbol] = {};
          const tfMap = data[symbol] ?? {};
          for (const timeframe of Object.keys(tfMap)) {
            try {
              const frames = tfMap[timeframe] ?? [];
              let result: MomentumScoreResult = { score: 0, reason: 'NO_DATA', indicators: {} };
              if (frames.length > 0) {
                result = MomentumScanner.computeScore(frames);
              }
              processed[symbol][timeframe] = {
                score: result.score,
                reason: result.reason,
                indicators: result.indicators,
                framesCount: frames.length
              };
            } catch (innerErr) {
              // Keep loop robust: record the error per timeframe
              processed[symbol][timeframe] = { score: 0, reason: `ERROR:${String(innerErr)}`, indicators: {}, framesCount: 0 };
            }
          }
        }

        this.emit('processed', { timestamp: Date.now(), data: processed });
      } catch (err) {
        this.emit('error', err);
      } finally {
        if (this.running) this.timer = setTimeout(loop, this.opts.pollIntervalMs);
      }
    };

    // Kick off immediately
    void loop();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }
}

export default ContinuousMultiTimeframeScanner;
