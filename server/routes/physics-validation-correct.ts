/**
 * Physics Validation API
 * Runs CORRECT quantitative tests with proper statistical methodology
 * 
 * Endpoints:
 * - POST /api/physics/validate/peg - Run PEG validation tests
 * - POST /api/physics/validate/regime - Run regime classification tests
 * - POST /api/physics/validate/all - Run all tests
 */

import { Router, Request, Response } from 'express';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import { storage } from '../storage';
import {
  validatePEGVolatilityPrediction,
  validatePEGPriceMovementPrediction,
  validateRegimeDirectionPrediction,
  calculateVolatility,
  calculateRealizedVolatility
} from '../services/vfmd/correctPhysicsValidator';
import type { MarketTick } from '../services/vfmd/types';
import type { MarketFrame } from '@shared/schema';
import yahooFinance from 'yahoo-finance2';
import { ExchangeDataFeed } from '../trading-engine';

const router = Router();
const vfmdAgent = new VFMDPhysicsAgent('VFMD-Validator', 'balanced');

/**
 * Fetch historical data directly from Yahoo Finance
 * More reliable for long-term historical data
 */
async function fetchYahooFinanceData(symbol: string, days: number, interval: '1d' | '4h' | '1h' = '1d'): Promise<MarketFrame[]> {
  try {
    console.log(`[YahooFinance] Fetching ${days} days of ${interval} candles for ${symbol}...`);
    
    // Normalize symbol for yahoo finance (BTC/USDT -> BTC-USD for crypto)
    let yahooSymbol = symbol;
    if (symbol.includes('/')) {
      const [base, quote] = symbol.split('/');
      if (quote === 'USDT' || quote === 'USD') {
        yahooSymbol = `${base}-USD`;
      }
    }
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    console.log(`[YahooFinance] Fetching ${yahooSymbol} [${interval}] from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Use historical endpoint from yahoo-finance2 (works better than chart)
    const result = await yahooFinance.historical(yahooSymbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d' // Yahoo Finance only supports daily for free tier
    });
    
    if (!result || result.length === 0) {
      throw new Error(`No data returned from Yahoo Finance for ${yahooSymbol}`);
    }
    
    console.log(`[YahooFinance] ✅ Fetched ${result.length} candles for ${yahooSymbol}`);
    
    // Convert to MarketFrame format
    const frames: MarketFrame[] = result.map((candle: any, idx: number) => ({
      id: `yf-${yahooSymbol}-${idx}`,
      symbol: symbol,
      timestamp: new Date(candle.date instanceof Date ? candle.date : new Date(candle.date)),
      price: {
        open: candle.open || 0,
        high: candle.high || 0,
        low: candle.low || 0,
        close: candle.close || 0
      } as any,
      volume: candle.volume || 0,
      orderFlow: {
        bidVolume: (candle.volume || 0) * 0.5,
        askVolume: (candle.volume || 0) * 0.5
      } as any,
      indicators: undefined,
      marketMicrostructure: undefined
    }));
    
    return frames;
  } catch (error) {
    console.error('[YahooFinance] Error fetching data:', (error as any).message);
    throw error;
  }
}

// Initialize ExchangeDataFeed for historical data fetching
let exchangeDataFeed: any = null;

async function initializeExchangeDataFeed() {
  if (exchangeDataFeed) return exchangeDataFeed;
  try {
    exchangeDataFeed = await ExchangeDataFeed.create();
    console.log('[Physics Validation] ExchangeDataFeed initialized');
  } catch (error) {
    console.warn('[Physics Validation] Failed to initialize ExchangeDataFeed:', (error as any).message);
  }
  return exchangeDataFeed;
}

/**
 * POST /api/physics/validate/peg
 * Run correct PEG validation tests
 * 
 * Body:
 * {
 *   symbol: "BTC/USDT",
 *   days: 180,  // How many days of data to use
 *   pegThreshold: 2.0
 * }
 */
router.post('/validate/peg', async (req: Request, res: Response) => {
  try {
    const { symbol = 'BTC/USDT', days = 180, pegThreshold = 1.0, candles = '1h' } = req.body;

    console.log(`[Physics Validation] Starting PEG validation for ${symbol} (${days} days, threshold=${pegThreshold}, candles=${candles})`);

    // Try Yahoo Finance first (most reliable for historical data)
    let frames: MarketFrame[] = [];
    try {
      frames = await fetchYahooFinanceData(symbol, Math.max(days, 180), (candles as any) || '1d');
      console.log(`[Physics Validation] ✅ Using Yahoo Finance data (${frames.length} candles [${candles}])`);
    } catch (error) {
      console.warn(`[Physics Validation] Yahoo Finance failed:`, (error as any).message);
    }
    
    // Fallback to ExchangeDataFeed if Yahoo Finance fails
    if (!frames || frames.length === 0) {
      try {
        const dataFeed = await initializeExchangeDataFeed();
        if (dataFeed) {
          frames = await dataFeed.fetchMarketData(symbol, '1d', Math.max(days, 180));
          console.log(`[Physics Validation] ✅ Using ExchangeDataFeed (${frames.length} candles)`);
        }
      } catch (error) {
        console.warn(`[Physics Validation] ExchangeDataFeed failed:`, (error as any).message);
      }
    }
    
    // Final fallback to storage
    if (!frames || frames.length === 0) {
      frames = await storage.getMarketFrames(symbol, Math.max(days * 24, 1000));
      if (frames.length > 0) {
        console.log(`[Physics Validation] Fallback: using storage (${frames.length} candles)`);
      }
    }
    
    if (!frames || frames.length < 100) {
      return res.status(400).json({
        success: false,
        error: `Insufficient data: got ${frames?.length || 0} frames, need minimum 100. Ensure CCXT has API access or data is seeded in storage.`,
        symbol,
        daysRequested: days,
        troubleshooting: {
          hint1: 'For CCXT: Check exchange-config.json has valid API keys',
          hint2: 'For local testing: Create seed data via /api/backtest endpoint',
          hint3: 'For production: Run data ingestion pipeline to populate storage'
        }
      });
    }

    // Convert to ticks
    const ticks: MarketTick[] = frames.map((frame: MarketFrame) => ({
      timestamp: new Date(frame.timestamp).getTime(),
      open: (frame.price as any).open || 0,
      high: (frame.price as any).high || 0,
      low: (frame.price as any).low || 0,
      close: (frame.price as any).close || 0,
      volume: frame.volume || 0,
      bidVolume: (frame.orderFlow as any)?.bidVolume || 0,
      askVolume: (frame.orderFlow as any)?.askVolume || 0
    }));

    console.log(`[Physics Validation] Running validation on ${ticks.length} data points`);

    // Calculate PEG values for each point using FULL history (not sliding windows)
    // This gives the physics engine enough data to compute meaningful energy gradients
    const pegValues: number[] = [];
    for (let i = 0; i < ticks.length; i++) {
      // Use all ticks up to current point for better field construction
      const historicalTicks = ticks.slice(0, Math.min(i + 1, ticks.length));
      
      // Need at least 10 candles for meaningful PEG calculation
      if (historicalTicks.length < 10) {
        pegValues.push(0);
        continue;
      }

      const analysis = vfmdAgent.getAnalysisForUI(historicalTicks);
      
      if (analysis?.field_metrics?.peg_energy) {
        const peg = parseFloat(analysis.field_metrics.peg_energy);
        pegValues.push(peg);
        if (i % 30 === 0) {
          console.log(`  [${i}/${ticks.length}] PEG: ${peg.toFixed(4)}`);
        }
      } else {
        pegValues.push(0);
      }
    }

    // Run validation tests
    // FIX: Use lookAhead=20 for daily candles (was 10)
    // Daily candles have smoother dynamics, need longer window to see volatility changes
    const test1 = validatePEGVolatilityPrediction(ticks, pegValues, pegThreshold, 20);
    const test2 = validatePEGPriceMovementPrediction(ticks, pegValues, pegThreshold, 15, 0.015);

    const overallResult = {
      success: true,
      symbol,
      dataPoints: ticks.length,
      testPeriod: {
        days: Math.round(ticks.length / 24),
        startDate: new Date(ticks[0].timestamp).toISOString(),
        endDate: new Date(ticks[ticks.length - 1].timestamp).toISOString()
      },
      tests: {
        pegVolatilityPrediction: test1,
        pegPriceMovementPrediction: test2
      },
      summary: {
        pegStatus: (test1.status === 'PASS' && test2.status === 'PASS') ? 'PASS' : 'NEEDS_WORK',
        overallAccuracy: (test1.successRate + test2.successRate) / 2,
        recommendation: 
          test1.status === 'PASS' && test2.status === 'PASS'
            ? '✅ PEG energy is working correctly - use for early entry detection'
            : '❌ PEG needs refinement - do not use for trading decisions yet'
      },
      timestamp: new Date().toISOString()
    };

    res.json(overallResult);
  } catch (error) {
    console.error('[Physics Validation] PEG test error:', error);
    res.status(500).json({
      success: false,
      error: (error as any).message || 'PEG validation failed'
    });
  }
});

/**
 * POST /api/physics/validate/regime
 * Run correct regime classification tests
 * 
 * Body:
 * {
 *   symbol: "BTC/USDT",
 *   days: 180
 * }
 */
router.post('/validate/regime', async (req: Request, res: Response) => {
  try {
    const { symbol = 'BTC/USDT', days = 180, candles = '1d' } = req.body;

    console.log(`[Physics Validation] Starting regime validation for ${symbol} (${days} days, ${candles} candles)`);

    // Try Yahoo Finance first (most reliable for historical data)
    let frames: MarketFrame[] = [];
    try {
      frames = await fetchYahooFinanceData(symbol, Math.max(days, 180), (candles as any) || '1d');
      console.log(`[Physics Validation] ✅ Using Yahoo Finance data (${frames.length} candles [${candles}])`);
    } catch (error) {
      console.warn(`[Physics Validation] Yahoo Finance failed:`, (error as any).message);
    }
    
    // Fallback to ExchangeDataFeed if Yahoo Finance fails
    if (!frames || frames.length === 0) {
      try {
        const dataFeed = await initializeExchangeDataFeed();
        if (dataFeed) {
          frames = await dataFeed.fetchMarketData(symbol, '1d', Math.max(days, 180));
          console.log(`[Physics Validation] ✅ Using ExchangeDataFeed (${frames.length} candles)`);
        }
      } catch (error) {
        console.warn(`[Physics Validation] ExchangeDataFeed failed:`, (error as any).message);
      }
    }
    
    // Final fallback to storage
    if (!frames || frames.length === 0) {
      frames = await storage.getMarketFrames(symbol, Math.max(days * 24, 1000));
      if (frames.length > 0) {
        console.log(`[Physics Validation] Fallback: using storage (${frames.length} candles)`);
      }
    }
    
    if (!frames || frames.length < 100) {
      return res.status(400).json({
        success: false,
        error: `Insufficient data: got ${frames?.length || 0} frames, need minimum 100. Ensure CCXT has API access or data is seeded in storage.`,
        symbol,
        daysRequested: days,
        troubleshooting: {
          hint1: 'For CCXT: Check exchange-config.json has valid API keys',
          hint2: 'For local testing: Create seed data via /api/backtest endpoint',
          hint3: 'For production: Run data ingestion pipeline to populate storage'
        }
      });
    }

    // Convert to ticks
    const ticks: MarketTick[] = frames.map((frame: MarketFrame) => ({
      timestamp: new Date(frame.timestamp).getTime(),
      open: (frame.price as any).open || 0,
      high: (frame.price as any).high || 0,
      low: (frame.price as any).low || 0,
      close: (frame.price as any).close || 0,
      volume: frame.volume || 0,
      bidVolume: (frame.orderFlow as any)?.bidVolume || 0,
      askVolume: (frame.orderFlow as any)?.askVolume || 0
    }));

    // Generate regime labels using full history
    const regimeLabels: string[] = [];
    for (let i = 0; i < ticks.length; i++) {
      // Use all ticks up to current point for better regime classification
      const historicalTicks = ticks.slice(0, Math.min(i + 1, ticks.length));
      
      // Need at least 10 candles for meaningful regime classification
      if (historicalTicks.length < 10) {
        regimeLabels.push('UNKNOWN');
        continue;
      }

      const analysis = vfmdAgent.getAnalysisForUI(historicalTicks);
      
      if (analysis?.regime?.classification) {
        regimeLabels.push(analysis.regime.classification.toUpperCase());
      } else {
        regimeLabels.push('UNKNOWN');
      }
    }

    // Run validation test
    const regimeTest = validateRegimeDirectionPrediction(ticks, regimeLabels, 15, 0.02);

    const overallResult = {
      success: true,
      symbol,
      dataPoints: ticks.length,
      testPeriod: {
        days: Math.round(ticks.length / 24),
        startDate: new Date(ticks[0].timestamp).toISOString(),
        endDate: new Date(ticks[ticks.length - 1].timestamp).toISOString()
      },
      tests: {
        regimeDirectionPrediction: regimeTest
      },
      summary: {
        regimeStatus: regimeTest.status,
        accuracy: regimeTest.successRate,
        recommendation:
          regimeTest.status === 'PASS'
            ? '✅ Regime classification predicts future direction - use for position sizing'
            : '❌ Regime classification needs refinement - rebuild thresholds using ground truth'
      },
      timestamp: new Date().toISOString()
    };

    res.json(overallResult);
  } catch (error) {
    console.error('[Physics Validation] Regime test error:', error);
    res.status(500).json({
      success: false,
      error: (error as any).message || 'Regime validation failed'
    });
  }
});

/**
 * POST /api/physics/validate/all
 * Run all validation tests at once (directly, not via fetch)
 */
router.post('/validate/all', async (req: Request, res: Response) => {
  try {
    const { symbol = 'BTC/USDT', days = 180, pegThreshold = 1.0, candles = '1d' } = req.body;

    console.log(`[Physics Validation] Starting COMPLETE validation for ${symbol} (${days} days)`);

    // Fetch data once, reuse for all tests
    let frames: MarketFrame[] = [];
    try {
      frames = await fetchYahooFinanceData(symbol, Math.max(days, 180), (candles as any) || '1d');
      console.log(`[Physics Validation] ✅ Using Yahoo Finance data (${frames.length} candles)`);
    } catch (error) {
      console.warn(`[Physics Validation] Yahoo Finance failed:`, (error as any).message);
    }
    
    if (!frames || frames.length === 0) {
      try {
        const dataFeed = await initializeExchangeDataFeed();
        if (dataFeed) {
          frames = await dataFeed.fetchMarketData(symbol, '1h', Math.max(days, 180));
          console.log(`[Physics Validation] ✅ Using ExchangeDataFeed (${frames.length} candles)`);
        }
      } catch (error) {
        console.warn(`[Physics Validation] ExchangeDataFeed failed:`, (error as any).message);
      }
    }
    
    if (!frames || frames.length < 100) {
      return res.status(400).json({
        success: false,
        error: `Insufficient data for full validation: ${frames?.length || 0} frames`
      });
    }

    // Convert to ticks
    const ticks: MarketTick[] = frames.map((frame: MarketFrame) => ({
      timestamp: new Date(frame.timestamp).getTime(),
      open: (frame.price as any).open || 0,
      high: (frame.price as any).high || 0,
      low: (frame.price as any).low || 0,
      close: (frame.price as any).close || 0,
      volume: frame.volume || 0,
      bidVolume: (frame.orderFlow as any)?.bidVolume || 0,
      askVolume: (frame.orderFlow as any)?.askVolume || 0
    }));

    // Calculate metrics once for all tests
    const pegValues: number[] = [];
    const regimeLabels: string[] = [];

    for (let i = 0; i < ticks.length; i++) {
      const historicalTicks = ticks.slice(0, Math.min(i + 1, ticks.length));
      
      if (historicalTicks.length < 10) {
        pegValues.push(0);
        regimeLabels.push('UNKNOWN');
        continue;
      }

      const analysis = vfmdAgent.getAnalysisForUI(historicalTicks);
      
      pegValues.push(analysis?.field_metrics?.peg_energy ? parseFloat(analysis.field_metrics.peg_energy) : 0);
      regimeLabels.push(analysis?.regime?.classification || 'UNKNOWN');
    }

    // Run all tests
    const pegVolTest = validatePEGVolatilityPrediction(ticks, pegValues, pegThreshold, 20);
    const pegPriceTest = validatePEGPriceMovementPrediction(ticks, pegValues, pegThreshold, 15, 0.015);
    const regimeTest = validateRegimeDirectionPrediction(ticks, regimeLabels, 15, 0.02);

    const allTestsPass = pegVolTest.status === 'PASS' &&
                         pegPriceTest.status === 'PASS' &&
                         regimeTest.status === 'PASS';

    res.json({
      success: true,
      symbol,
      dataPoints: ticks.length,
      testPeriod: {
        days: Math.round(ticks.length / 24),
        startDate: new Date(ticks[0].timestamp).toISOString(),
        endDate: new Date(ticks[ticks.length - 1].timestamp).toISOString()
      },
      validationFramework: 'CORRECT (independent ground truth, proper statistical methodology)',
      tests: {
        pegVolatilityPrediction: pegVolTest,
        pegPriceMovementPrediction: pegPriceTest,
        regimeDirectionPrediction: regimeTest
      },
      summary: {
        regimeStatus: regimeTest.status,
        pegVolStatus: pegVolTest.status,
        pegPriceStatus: pegPriceTest.status,
        overallAccuracy: (regimeTest.successRate + pegVolTest.successRate + pegPriceTest.successRate) / 3,
        readyForTrading: allTestsPass
      },
      recommendations: {
        regime: regimeTest.status === 'PASS' 
          ? '✅ Use for position sizing and entry filtering'
          : '❌ Needs refinement',
        pegVolatility: pegVolTest.status === 'PASS'
          ? '✅ Use for early volatility detection'
          : '⚠️ Use with caution or rebuild',
        pegPrice: pegPriceTest.status === 'PASS'
          ? '✅ Use as primary entry signal'
          : '⚠️ Use as confirmation signal only'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Physics Validation] All tests error:', error);
    res.status(500).json({
      success: false,
      error: (error as any).message || 'Validation failed'
    });
  }
});

/**
 * POST /api/physics/validate/diagnostic
 * Debug endpoint to see actual PEG values and volatility calculations
 */
router.post('/validate/diagnostic', async (req: Request, res: Response) => {
  try {
    const { symbol = 'BTC/USDT', days = 10, pegThreshold = 1.0 } = req.body;
    
    console.log(`[Diagnostics] Fetching ${days} days of data for ${symbol}...`);
    
    const frames = await fetchYahooFinanceData(symbol, days, '1d');
    if (!frames || frames.length < 20) {
      return res.status(400).json({
        success: false,
        error: `Insufficient data: ${frames?.length || 0} frames`
      });
    }
    
    const ticks: MarketTick[] = frames.map((frame: MarketFrame) => ({
      timestamp: new Date(frame.timestamp).getTime(),
      open: (frame.price as any).open || 0,
      high: (frame.price as any).high || 0,
      low: (frame.price as any).low || 0,
      close: (frame.price as any).close || 0,
      volume: frame.volume || 0,
      bidVolume: (frame.orderFlow as any)?.bidVolume || 0,
      askVolume: (frame.orderFlow as any)?.askVolume || 0
    }));
    
    // Calculate PEG values
    const pegValues: number[] = [];
    for (let i = 0; i < ticks.length; i++) {
      const historicalTicks = ticks.slice(0, Math.min(i + 1, ticks.length));
      
      if (historicalTicks.length < 10) {
        pegValues.push(0);
        continue;
      }
      
      const analysis = vfmdAgent.getAnalysisForUI(historicalTicks);
      pegValues.push(analysis?.field_metrics?.peg_energy ? parseFloat(analysis.field_metrics.peg_energy) : 0);
    }
    
    // Calculate volatility diagnostics
    const baselineWindow = Math.min(Math.max(ticks.length / 3, 100), 180);
    const baselineVolatility = calculateRealizedVolatility(ticks.slice(0, baselineWindow));
    
    // Find volatility spikes
    const volatilityByDay: any[] = [];
    for (let i = 0; i < ticks.length - 5; i++) {
      const segment = ticks.slice(i, i + 5);
      const vol = calculateRealizedVolatility(segment);
      volatilityByDay.push({
        day: i,
        date: new Date(ticks[i].timestamp).toISOString().split('T')[0],
        volatility: vol.toFixed(6),
        isSpike: vol > baselineVolatility * 1.3,
        ratio: (vol / baselineVolatility).toFixed(2)
      });
    }
    
    res.json({
      success: true,
      dataPoints: ticks.length,
      diagnostics: {
        pegValues: pegValues.slice(-20), // Last 20
        pegStats: {
          min: Math.min(...pegValues),
          max: Math.max(...pegValues),
          avg: pegValues.reduce((a, b) => a + b) / pegValues.length,
          nonZeroCount: pegValues.filter(p => p > 0).length,
          zerCount: pegValues.filter(p => p === 0).length
        },
        volatilityStats: {
          baselineWindow,
          baselineVolatility: baselineVolatility.toFixed(6),
          spikeThreshold: (baselineVolatility * 1.3).toFixed(6),
          spikesDetected: volatilityByDay.filter(v => v.isSpike).length,
          totalDays: volatilityByDay.length
        },
        volatilityByDay: volatilityByDay.slice(-15) // Last 15 days
      }
    });
  } catch (error) {
    console.error('[Diagnostics] Error:', error);
    res.status(500).json({
      success: false,
      error: (error as any).message
    });
  }
});

export default router;
