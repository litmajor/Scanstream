/**
 * PHASE 2 INTEGRATION GUIDE
 * 
 * How to wire the Candle Integrity Layer into existing code.
 * 
 * ✅ Zero behavior changes
 * ✅ All agents continue working
 * ✅ Just adds critical validation before storage
 */

/**
 * INTEGRATION POINT 1: Trading Engine (server/trading-engine.ts)
 * 
 * Current code (line ~1185):
 * ──────────────────────────
 * const frames = await this.exchangeDataFeed.fetchMarketData(symbol, '1m', limit);
 * await storage.createMarketFrame(frame);
 * 
 * Updated code with Phase 2 (optional but recommended):
 * ──────────────────────────────────────────────────
 */

import { getIntegrityGate } from '../services/market-data/integrity-gate';

async function fetchAndStoreWithIntegrity(symbol: string, limit: number) {
  // Fetch from CCXT (unchanged)
  const frames = await this.exchangeDataFeed.fetchMarketData(symbol, '1m', limit);

  // NEW: Process through Integrity Gate before storage
  const gate = getIntegrityGate();
  
  // Convert frames to Candle format if needed
  const candles = frames.map(f => ({
    ts: f.timestamp || Date.now(),
    open: f.open,
    high: f.high,
    low: f.low,
    close: f.close,
    volume: f.volume,
    isFinal: true,
  }));

  // Process through integrity layer
  const result = await gate.storeValidatedCandles(
    symbol,
    60, // 1 minute in seconds
    candles
  );

  console.log(
    `[Trading] Stored ${result.stored.length} valid candles ` +
    `(rejected: ${result.rejected.length}, gaps: ${result.gaps.length})`
  );

  return result.stored;
}

/**
 * INTEGRATION POINT 2: Exchange Aggregator (server/services/gateway/exchange-aggregator.ts)
 * 
 * Current code (line ~240):
 * ─────────────────────────
 * const frames = await aggregator.getMarketFrames(symbol, timeframe, limit);
 * // frames go to client, but also could go to storage
 * 
 * Updated code with Phase 2 (optional):
 * ──────────────────────────────────────
 */

async function getFramesWithIntegrity(symbol: string, timeframe: string, limit: number) {
  // Get raw frames (unchanged)
  const rawFrames = await aggregator.getMarketFrames(symbol, timeframe, limit);

  // NEW: Process through Integrity Gate
  const gate = getIntegrityGate();
  
  const timeframeSeconds = this.parseTimeframe(timeframe); // "1h" -> 3600
  
  const candles = rawFrames.map(f => ({
    ts: f.timestamp || Date.now(),
    open: f.open,
    high: f.high,
    low: f.low,
    close: f.close,
    volume: f.volume,
    isFinal: f.isFinal || true,
  }));

  const result = await gate.storeValidatedCandles(
    symbol,
    timeframeSeconds,
    candles
  );

  // Return validated candles
  return result.stored;
}

/**
 * INTEGRATION POINT 3: CCXT Scanner (server/services/gateway/ccxt-scanner.ts)
 * 
 * Current code (line ~130):
 * ────────────────────────
 * const frames = await this.aggregator.getMarketFrames(symbol, timeframe, limit);
 * // frames are analyzed but not stored
 * 
 * Updated code with Phase 2 (optional):
 * ──────────────────────────────────────
 */

async function scanWithValidation(symbol: string, timeframe: string, limit: number) {
  // Get frames
  const frames = await this.aggregator.getMarketFrames(symbol, timeframe, limit);

  // NEW: Ensure they're integrity-checked before analysis
  const gate = getIntegrityGate();
  
  const timeframeSeconds = this.parseTimeframe(timeframe);
  
  const result = await gate.storeValidatedCandles(
    symbol,
    timeframeSeconds,
    frames
  );

  // Use validated candles for analysis
  const validFrames = result.stored;

  console.log(`[Scanner] ${symbol}: using ${validFrames.length} validated candles for analysis`);

  // Continue with normal scanning logic
  return analyzeFrames(validFrames);
}

/**
 * INTEGRATION POINT 4: Gateway Routes (server/routes/gateway.ts)
 * 
 * Current code (line ~430):
 * ─────────────────────────
 * router.get('/dataframe/:symbol', async (req, res) => {
 *   const frames = await aggregator.getMarketFrames(...);
 *   res.json({ dataframe: frames[frames.length - 1] });
 * });
 * 
 * Updated code with Phase 2 (optional):
 * ──────────────────────────────────────
 */

router.get('/dataframe-validated/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1h', limit = '100' } = req.query;

    // Get frames
    const frames = await aggregator.getMarketFrames(symbol, timeframe, parseInt(limit as string));

    // NEW: Validate through integrity layer
    const { getIntegrityGate } = await import('../../services/market-data/integrity-gate');
    const gate = getIntegrityGate();
    
    const timeframeSeconds = parseTimeframe(timeframe);
    const result = await gate.storeValidatedCandles(
      symbol,
      timeframeSeconds,
      frames
    );

    // Return validated dataframe with integrity report
    const latest = result.stored[result.stored.length - 1];

    res.json({
      symbol,
      timeframe,
      cached: false,
      valid: true,
      dataframe: latest,
      integrity: {
        validated: true,
        totalInput: frames.length,
        validCount: result.stored.length,
        rejectedCount: result.rejected.length,
        gapCount: result.gaps.length,
      }
    });
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

/**
 * INTEGRATION POINT 5: Storage Wrapper (NEW)
 * 
 * Create a wrapper around storage.createMarketFrame() that auto-validates:
 */

import { storage } from '../storage';

export async function createValidatedMarketFrame(
  symbol: string,
  timeframe: number,
  candle: any
) {
  // Get integrity layer
  const { getIntegrityGate } = await import('./integrity-gate');
  const gate = getIntegrityGate();

  // Validate single candle
  const result = await gate.storeValidatedCandles(
    symbol,
    timeframe,
    [candle]
  );

  // Return stored candle (or undefined if rejected)
  return result.stored[0];
}

/**
 * SUMMARY: Where Phase 2 Fits
 * 
 * Before Phase 2:
 * CCXT → ExchangeAggregator → storage.createMarketFrame()
 *        (no validation)
 * 
 * After Phase 2:
 * CCXT → ExchangeAggregator → CandleIntegrityLayer
 *                            ├─ Timestamp alignment
 *                            ├─ Continuity check
 *                            ├─ Deduplication
 *                            └─ Finality enforcement
 *                            ↓
 *                     storage.createMarketFrame()
 *                     (only valid candles)
 * 
 * Benefits:
 * ✅ ML agents see clean data
 * ✅ RL agents learn from valid states
 * ✅ Physics agents work with aligned candles
 * ✅ RPG Oracle patterns are real, not noise
 * ✅ Fewer false signals
 * ✅ More consistent backtesting
 * 
 * How to enable:
 * 1. Import getIntegrityGate in your route/service
 * 2. Call gate.storeValidatedCandles() instead of storage.createMarketFrame()
 * 3. Check the result for rejected candles and gaps
 * 4. Optional: listen to gate events for monitoring
 * 
 * Diagnostics:
 * GET /api/diagnostics/integrity
 * 
 * Shows:
 * - Validity rates per symbol/timeframe
 * - Gap statistics
 * - Rejection reasons
 * - Finality breakdown
 */

export {
  fetchAndStoreWithIntegrity,
  getFramesWithIntegrity,
  scanWithValidation,
  createValidatedMarketFrame,
};
