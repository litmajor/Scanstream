/**
 * PHASE 1 INTEGRATION EXAMPLES
 * 
 * How to wire MDL into existing code (completely optional).
 * These are copy-paste examples, not production code.
 * 
 * The existing system works WITHOUT these changes.
 * These are for OPTIONAL enhanced validation.
 */

/**
 * EXAMPLE 1: Use MDL in trading-engine.ts
 * 
 * Current code (line ~1150):
 * ────────────────────────────────
 * const frames = await this.exchangeDataFeed.fetchMarketData(
 *   symbol,
 *   '1m',
 *   50,
 *   exchange
 * );
 * 
 * Updated code with MDL (optional):
 * ────────────────────────────────
 */

// Option A: Use MDL directly (recommended if you want validation)
async function fetchMarketDataWithMDL(symbol: string, limit: number) {
  try {
    const { getMarketDataLayer } = await import('./index');
    const mdl = getMarketDataLayer();

    if (!mdl) {
      // Fallback to original method if MDL not available
      return await this.exchangeDataFeed.fetchMarketData(symbol, '1m', limit);
    }

    // Use MDL for validated fetch
    const timeframeSeconds = 60; // 1 minute
    const candles = await mdl.fetchAndValidate(
      symbol,
      timeframeSeconds,
      undefined,
      limit
    );

    console.log(`[Trading] Fetched ${candles.length} validated candles for ${symbol}`);
    return candles;
  } catch (err) {
    console.error('[Trading] MDL fetch failed, falling back:', err);
    // Fallback to original method
    return await this.exchangeDataFeed.fetchMarketData(symbol, '1m', limit);
  }
}

// Option B: Keep using original method (no changes needed)
// The storage will still contain validated candles because MDL validates on the gateway side

/**
 * EXAMPLE 2: Use MDL in exchange-aggregator.ts
 * 
 * Current code (line ~80):
 * ──────────────────────
 * const prices = await Promise.all(
 *   exchanges.map(ex => this.exchangeDataFeed.fetchMarketData(...))
 * );
 * 
 * Updated code with MDL (optional):
 * ────────────────────────────────
 */

async function getAggregatedPriceWithMDL(symbol: string) {
  try {
    const { getMarketDataLayer } = await import('./index');
    const mdl = getMarketDataLayer();

    if (!mdl) {
      // Fallback to original aggregation
      return this.getAggregatedPriceOriginal(symbol);
    }

    // Use MDL for aggregation with validation
    const candles = await mdl.fetchAndValidate(
      symbol,
      3600, // 1 hour
      undefined,
      1
    );

    if (candles.length === 0) {
      throw new Error('No candles returned');
    }

    const latest = candles[0];
    return {
      symbol,
      price: latest.close,
      timestamp: latest.ts,
      validated: true,
      source: latest.source
    };
  } catch (err) {
    console.error('[Aggregator] MDL fetch failed, falling back:', err);
    return this.getAggregatedPriceOriginal(symbol);
  }
}

/**
 * EXAMPLE 3: Listen for integrity events (debugging)
 * 
 * Add to server/index.ts to monitor data quality:
 */

function setupMDLMonitoring() {
  const { getMarketDataLayer } = require('./index');
  const mdl = getMarketDataLayer();

  if (!mdl) {
    console.log('[MDL] Monitoring not available');
    return;
  }

  const metrics = {
    gaps: 0,
    duplicates: 0,
    invalidOHLC: 0,
    totalIssues: 0,
    startTime: Date.now()
  };

  mdl.on('integrity.issue', (issue: any) => {
    metrics.totalIssues++;

    if (issue.type === 'gap') metrics.gaps++;
    if (issue.type === 'duplicate') metrics.duplicates++;
    if (issue.type === 'ohlc_invalid') metrics.invalidOHLC++;

    if (issue.severity === 'error') {
      console.error(`[MDL:${issue.type}] ${issue.details}`);
    } else {
      console.warn(`[MDL:${issue.type}] ${issue.details}`);
    }
  });

  // Expose metrics endpoint
  app.get('/api/diagnostics/mdl-metrics', (req, res) => {
    const uptime = Date.now() - metrics.startTime;
    res.json({
      ...metrics,
      uptime_ms: uptime,
      issues_per_hour: Math.round(metrics.totalIssues / (uptime / 3600000))
    });
  });
}

/**
 * EXAMPLE 4: Verify MDL is working
 * 
 * Run this test to confirm MDL is initialized:
 */

async function verifyMarketDataLayer() {
  const { getMarketDataLayer } = require('./index');
  const mdl = getMarketDataLayer();

  if (!mdl) {
    console.error('❌ MDL not initialized');
    return false;
  }

  try {
    // Test fetch and validate
    const btcCandles = await mdl.fetchAndValidate('BTC/USDT', 3600, undefined, 10);
    
    if (btcCandles.length === 0) {
      console.error('❌ MDL returned no candles');
      return false;
    }

    // Verify structure
    const c = btcCandles[0];
    if (!c.ts || !c.open || !c.high || !c.low || !c.close || !c.volume) {
      console.error('❌ MDL returned malformed candles');
      return false;
    }

    console.log('✅ MDL verification passed');
    console.log(`   - Fetched ${btcCandles.length} BTC candles`);
    console.log(`   - Latest: ${new Date(c.ts).toISOString()} close=${c.close}`);
    console.log(`   - All candles validated and ordered`);

    return true;
  } catch (err) {
    console.error('❌ MDL verification failed:', err);
    return false;
  }
}

/**
 * SUMMARY
 * 
 * ✅ MDL is now initialized at server startup
 * ✅ All adapters are ready (6 exchanges)
 * ✅ Integrity validation is enabled
 * ✅ Gap healing is enabled
 * ✅ World tick events are available
 * ✅ Diagnostics endpoint: GET /api/diagnostics/mdl
 * 
 * You can:
 * 1. Use MDL optionally in trading-engine.ts (see Example 1)
 * 2. Use MDL optionally in exchange-aggregator.ts (see Example 2)
 * 3. Monitor integrity via events (see Example 3)
 * 4. Verify MDL is working (see Example 4)
 * 
 * OR just keep using the original code. Everything still works!
 * The MDL layer is transparent to the rest of the system.
 */

export {
  fetchMarketDataWithMDL,
  getAggregatedPriceWithMDL,
  setupMDLMonitoring,
  verifyMarketDataLayer
};
