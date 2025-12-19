/**
 * PHASE 2: Storage Integration + World Tick Emission
 * 
 * Flow (CORRECT ORDER — non-negotiable):
 * 
 * SOURCE (CCXT / OANDA / MT5)
 *   ↓
 * ADAPTER (normalizes raw data)
 *   ↓
 * INGESTION BUFFER
 *   ↓
 * INTEGRITY & GAP CHECKS ← YOU ARE HERE
 *   ↓
 * CANDLE FINALITY LOGIC
 *   ↓
 * 📍 WORLD TICK EMISSION ← GATES HAPPEN HERE
 *   ↓
 * storage.createMarketFrame() (only validated candles reach here)
 *   ↓
 * RPG / AGENTS / STRATEGIES (subscribe to world.tick)
 * 
 * CRITICAL RULE:
 * No agent is allowed to react to raw adapter output.
 * Agents only react to World Ticks (validated, canonical facts).
 */

import { CandleIntegrityLayer, CandleIntegrityFactory } from './candle-integrity-layer';
import type { Candle, ValidatedCandle, WorldTick } from '../types/market-data';
import { storage } from '../../storage';
import { EventEmitter } from 'events';

export class IntegrityGate extends EventEmitter {
  /**
   * Process candles through integrity layer before storage
   * 
   * This is the critical gate between market data and trading logic.
   * 
   * Order is non-negotiable:
   * 1. Validate (check timestamps, continuity, OHLC, finality)
   * 2. Store (only valid candles reach storage)
   * 3. Emit World Tick (facts only, after validation)
   * 4. Agents react to World Ticks (never to raw data)
   */
  async storeValidatedCandles(
    symbol: string,
    timeframe: number,
    candles: Candle[]
  ): Promise<{
    stored: ValidatedCandle[];
    rejected: Candle[];
    gaps: any[];
    ticks: WorldTick[];
  }> {
    // Get or create integrity layer for this pair
    const layer = CandleIntegrityFactory.getOrCreate(symbol, timeframe);

    // Validate and normalize
    const report = layer.validateAndNormalize(candles);

    // Emit report for monitoring
    this.emit('integrity.report', report);

    // Store only valid candles and emit World Ticks
    const stored: ValidatedCandle[] = [];
    const ticks: WorldTick[] = [];
    
    for (const validCandle of report.valid) {
      try {
        // Convert Candle to MarketFrame format (compatible with storage)
        const marketFrame = {
          symbol,
          timeframe: timeframe,
          timestamp: new Date(validCandle.ts),
          open: validCandle.open,
          high: validCandle.high,
          low: validCandle.low,
          close: validCandle.close,
          volume: validCandle.volume,
          isFinal: validCandle.isFinal,
        };

        // ATOMIC OPERATION: Store THEN emit tick
        // INVARIANT: A world tick is emitted IFF storage succeeded
        try {
          // 1. Store to database/memory (MUST succeed first)
          await storage.createMarketFrame(marketFrame);
          stored.push(validCandle);

          // 2. 📍 EMIT WORLD TICK (facts only, after storage succeeds)
          // This is the atomic event that drives the RPG and all agents.
          // Agents ONLY react to world ticks, never to raw data.
          
          // CRITICAL SEMANTIC: worldTime = candle close time (market time, not wall-clock)
          // This ensures replay alignment, cross-timeframe consistency, and physics accuracy
          const worldTime = validCandle.ts + (timeframe * 1000);
          const emitTime = Date.now();

          const tick: WorldTick = {
            symbol,
            timeframe,
            worldTime,      // Canonical market time when candle closed
            emitTime,       // Wall-clock time when we emitted this tick
            candle: validCandle,
            isFinal: validCandle.isFinal,
            source: validCandle.source || 'validated',
          };

          ticks.push(tick);
          this.emit('world.tick', tick);

          // Log the fact with both times for diagnostics
          console.log(
            `[IntegrityGate] ✅ World Tick: ${symbol} ${timeframe}s ` +
            `close=${validCandle.close} final=${validCandle.isFinal} ` +
            `(world=${new Date(worldTime).toISOString()}, emit-lag=${emitTime - worldTime}ms)`
          );
        } catch (storageErr) {
          // CRITICAL: Storage failed — suppress tick emission
          // INVARIANT: Tick must not exist without storage
          console.error(
            `[IntegrityGate] Storage failed for ${symbol} — tick suppressed:`,
            storageErr
          );
          this.emit('storage.error', {
            symbol,
            candle: validCandle,
            error: storageErr,
            tickSuppressed: true,
          });
        }
      } catch (err) {
        // Outer catch: validation/conversion errors (should not happen)
        console.error(`[IntegrityGate] Processing error for ${symbol}:`, err);
      }
    }

    // Report gaps (PHASE 3: Visibility without healing)
    if (report.gaps.length > 0) {
      console.warn(
        `[IntegrityGate] 📊 Detected ${report.gaps.length} gaps for ${symbol}:${timeframe}`
      );
      
      // Emit aggregate event
      this.emit('gaps.detected', { symbol, timeframe, gaps: report.gaps });
      
      // PHASE 3: Emit individual gap events for agent monitoring
      // Agents can subscribe to 'gap.detected' to implement visibility-first logic
      for (const gap of report.gaps) {
        this.emit('gap.detected', {
          symbol,
          timeframe,
          gap,
          severity: gap.missingCandles > 10 ? 'high' : 'medium',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Report rejections
    if (report.rejected.length > 0) {
      console.warn(`[IntegrityGate] Rejected ${report.rejected.length} candles for ${symbol}:${timeframe}`);
      this.emit('candles.rejected', { symbol, timeframe, rejected: report.rejected });
    }

    return {
      stored,
      rejected: report.rejected.map(r => r.candle),
      gaps: report.gaps,
      ticks,
    };
  }

  /**
   * Batch process multiple symbol/timeframe pairs
   * 
   * Emits World Ticks for all validated candles
   */
  async storeBatch(pairs: Array<{
    symbol: string;
    timeframe: number;
    candles: Candle[];
  }>): Promise<Array<{
    symbol: string;
    timeframe: number;
    stored: ValidatedCandle[];
    rejected: Candle[];
    gaps: any[];
    ticks: WorldTick[];
  }>> {
    const results = [];

    for (const pair of pairs) {
      const result = await this.storeValidatedCandles(
        pair.symbol,
        pair.timeframe,
        pair.candles
      );

      results.push({
        symbol: pair.symbol,
        timeframe: pair.timeframe,
        ...result,
      });
    }

    return results;
  }

  /**
   * Get metrics for all symbol/timeframe pairs
   */
  getMetrics() {
    return CandleIntegrityFactory.getAllMetrics();
  }
}

// Global singleton
let globalIntegrityGate: IntegrityGate | null = null;

export function getIntegrityGate(): IntegrityGate {
  if (!globalIntegrityGate) {
    globalIntegrityGate = new IntegrityGate();

    // Listen for issues
    globalIntegrityGate.on('integrity.report', (report) => {
      if (report.rejected.length > 0 || report.continuity.hasGaps) {
        console.warn(
          `[Integrity] ${report.symbol} ${report.timeframe}s: ` +
          `${report.validCount}/${report.inputCount} valid, ` +
          `${report.gaps.length} gaps, ` +
          `${report.rejected.length} rejected`
        );
      }
    });

    globalIntegrityGate.on('gaps.detected', ({ symbol, timeframe, gaps }) => {
      for (const gap of gaps) {
        console.warn(
          `[Gap] ${symbol} ${timeframe}s: ` +
          `${gap.missingCandles} missing candles ` +
          `between ${new Date(gap.from).toISOString()} ` +
          `and ${new Date(gap.to).toISOString()}`
        );
      }
    });

    globalIntegrityGate.on('candles.rejected', ({ symbol, timeframe, rejected }) => {
      for (const r of rejected) {
        console.warn(
          `[Rejected] ${symbol} ${timeframe}s at ${new Date(r.candle.ts).toISOString()}: ` +
          `${r.reason}`
        );
      }
    });
  }

  return globalIntegrityGate;
}

export function initializeIntegrityGate(): IntegrityGate {
  return getIntegrityGate();
}
