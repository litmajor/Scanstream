import { Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { Request, Response } from 'express'; // Ensure Request and Response are imported

const router = Router();

// Strategy metadata
interface StrategyMetadata {
  id: string;
  name: string;
  description: string;
  type: string;
  features: string[];
  parameters: {
    [key: string]: {
      type: string;
      default: any;
      description: string;
      min?: number;
      max?: number;
    };
  };
  performance: {
    winRate?: number;
    avgReturn?: number;
    sharpeRatio?: number;
    maxDrawdown?: number;
  };
  isActive: boolean;
  lastUpdated: string;
}

// Strategy definitions
const STRATEGIES: StrategyMetadata[] = [
  {
    id: 'gradient_trend_filter',
    name: 'Gradient Trend Filter',
    description: 'Advanced trend-following strategy using gradient analysis for precise trend identification',
    type: 'Trend Following',
    features: [
      'Multi-timeframe gradient analysis',
      'Adaptive trend strength calculation',
      'Dynamic support/resistance levels',
      'Volatility-adjusted entries'
    ],
    parameters: {
      fast_period: { type: 'number', default: 10, description: 'Fast EMA period', min: 5, max: 50 },
      slow_period: { type: 'number', default: 50, description: 'Slow EMA period', min: 20, max: 200 },
      threshold: { type: 'number', default: 0.002, description: 'Trend threshold', min: 0.001, max: 0.01 }
    },
    performance: {
      winRate: 68,
      avgReturn: 4.2,
      sharpeRatio: 1.8,
      maxDrawdown: -12.5
    },
    isActive: true,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'ut_bot',
    name: 'UT Bot Strategy',
    description: 'ATR-based trailing stop system for capturing trends with dynamic risk management',
    type: 'Trend Following',
    features: [
      'Multiple ATR calculation methods',
      'Position tracking with P&L',
      'Dynamic trailing stops',
      'Configurable stop loss behavior'
    ],
    parameters: {
      sensitivity: { type: 'number', default: 1.0, description: 'ATR multiplier', min: 0.5, max: 3.0 },
      atr_period: { type: 'number', default: 10, description: 'ATR period', min: 5, max: 30 },
      atr_method: { type: 'string', default: 'RMA', description: 'ATR method (RMA/SMA/EMA/WMA)' }
    },
    performance: {
      winRate: 62,
      avgReturn: 3.8,
      sharpeRatio: 1.6,
      maxDrawdown: -15.2
    },
    isActive: true,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'mean_reversion',
    name: 'Mean Reversion Engine',
    description: 'Multi-indicator reversal system combining Bollinger Bands, Z-Score, and RSI',
    type: 'Mean Reversion',
    features: [
      'Bollinger Bands for volatility levels',
      'Z-Score for statistical extremes',
      'RSI momentum confirmation',
      'Market regime detection'
    ],
    parameters: {
      bb_period: { type: 'number', default: 20, description: 'Bollinger Bands period', min: 10, max: 50 },
      bb_std: { type: 'number', default: 2.0, description: 'Standard deviation multiplier', min: 1.5, max: 3.0 },
      rsi_period: { type: 'number', default: 14, description: 'RSI period', min: 7, max: 28 },
      oversold: { type: 'number', default: 30, description: 'RSI oversold level', min: 20, max: 40 },
      overbought: { type: 'number', default: 70, description: 'RSI overbought level', min: 60, max: 80 }
    },
    performance: {
      winRate: 72,
      avgReturn: 2.9,
      sharpeRatio: 1.4,
      maxDrawdown: -9.8
    },
    isActive: true,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'volume_profile',
    name: 'Volume Profile Engine',
    description: 'Order flow and volume profile analysis for high-probability trade zones',
    type: 'Volume Analysis',
    features: [
      'Point of Control (POC) identification',
      'Cumulative Volume Delta (CVD)',
      'Order flow imbalance detection',
      'Value area analysis'
    ],
    parameters: {
      profile_bins: { type: 'number', default: 24, description: 'Volume profile bins', min: 10, max: 50 },
      cvd_period: { type: 'number', default: 20, description: 'CVD lookback period', min: 10, max: 50 },
      imbalance_threshold: { type: 'number', default: 1.5, description: 'Order flow imbalance threshold', min: 1.2, max: 3.0 }
    },
    performance: {
      winRate: 65,
      avgReturn: 3.5,
      sharpeRatio: 1.5,
      maxDrawdown: -11.3
    },
    isActive: true,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'market_structure',
    name: 'Market Structure Engine',
    description: 'Price action analysis using market structure breaks, higher highs, and lower lows',
    type: 'Price Action',
    features: [
      'Structure break detection',
      'Higher high/lower low identification',
      'Trend reversal signals',
      'Continuation pattern recognition'
    ],
    parameters: {
      swing_period: { type: 'number', default: 20, description: 'Swing point lookback', min: 10, max: 50 },
      break_threshold: { type: 'number', default: 0.001, description: 'Structure break threshold', min: 0.0005, max: 0.005 },
      confirmation_bars: { type: 'number', default: 3, description: 'Confirmation bars required', min: 1, max: 10 }
    },
    performance: {
      winRate: 70,
      avgReturn: 4.0,
      sharpeRatio: 1.7,
      maxDrawdown: -10.5
    },
    isActive: true,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'enhanced_bounce',
    name: 'Enhanced Bounce Strategy',
    description: 'Multi-timeframe support/resistance bounce detection with Bayesian confidence scoring',
    type: 'Support/Resistance',
    features: [
      'Multi-timeframe zone detection (7 timeframes)',
      'Volume-weighted support/resistance identification',
      'Fractal pivot analysis (TradingView inspired)',
      'Bayesian confidence scoring',
      'Zone confluence detection',
      'Quality validation gates'
    ],
    parameters: {
      risk_profile: { type: 'string', default: 'moderate', description: 'Risk profile (conservative/moderate/aggressive)' },
      min_zone_confluence: { type: 'number', default: 0.5, description: 'Minimum zone confluence score', min: 0.3, max: 0.9 },
      volume_percentile: { type: 'number', default: 85, description: 'Volume percentile threshold', min: 70, max: 95 },
      min_bounce_confidence: { type: 'number', default: 0.70, description: 'Minimum bounce confidence', min: 0.5, max: 0.95 }
    },
    performance: {
      winRate: 72,
      avgReturn: 3.2,
      sharpeRatio: 1.9,
      maxDrawdown: -8.3
    },
    isActive: true,
    lastUpdated: new Date().toISOString()
  }
];

// GET /api/strategies - List all strategies
router.get('/', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      strategies: STRATEGIES,
      total: STRATEGIES.length
    });
  } catch (error) {
    console.error('Error fetching strategies:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch strategies' });
  }
});

// GET /api/strategies/signals - Get all strategy signals (for UnifiedSignalDisplay)
router.get('/signals', async (req: Request, res: Response) => {
  try {
    const signals = await storage.getSignals({ limit: 50 });

    // Filter for strategy-generated signals and format for frontend
    const strategySignals = signals
      .filter(s => s.source === 'strategy' || s.strategyId)
      .map(s => ({
        symbol: s.symbol,
        exchange: 'strategy',
        signal: s.type,
        strength: s.strength,
        confidence: s.confidence,
        price: s.price,
        change: 0, // Calculate from recent price movement
        change24h: 0,
        timestamp: new Date(s.timestamp).getTime(),
        source: 'strategy',
        strategyName: s.strategyId || 'Unknown Strategy',
        stopLoss: s.stopLoss,
        takeProfit: s.takeProfit,
        reasoning: s.reasoning,
        indicators: {}
      }));

    res.json({
      success: true,
      signals: strategySignals
    });
  } catch (error) {
    console.error('Error fetching strategy signals:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch strategy signals' });
  }
});

// GET /api/strategies/:id - Get strategy details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const strategy = STRATEGIES.find(s => s.id === id);

    if (!strategy) {
      return res.status(404).json({ success: false, error: 'Strategy not found' });
    }

    res.json({ success: true, strategy });
  } catch (error) {
    console.error('Error fetching strategy:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch strategy' });
  }
});

// POST /api/strategies/enhanced-bounce/execute - Execute enhanced bounce strategy
router.post('/enhanced-bounce/execute', async (req: Request, res: Response) => {
  try {
    const { symbol, timeframe, riskProfile } = req.body;

    if (!symbol || !timeframe) {
      return res.status(400).json({ success: false, error: 'symbol and timeframe are required' });
    }

    // Execute enhanced bounce strategy via Python
    const result = await executeStrategy('enhanced_bounce', symbol, timeframe, {
      risk_profile: riskProfile || 'moderate'
    });

    // Store signal if generated
    if (result.success && result.signal && result.signal !== 'HOLD') {
      const signalData = {
        symbol,
        type: result.signal === 'BUY' ? 'BUY' : 'SELL',
        strength: result.metadata?.bounce_strength || 75,
        confidence: result.metadata?.bounce_confidence || 70,
        price: result.price,
        reasoning: [
          `Enhanced Bounce Strategy generated ${result.signal} signal`,
          `Zone Confluence: ${result.metadata?.zone_confluence || 0}`,
          `Bounce Detected: ${result.metadata?.bounce_detected || false}`,
          `Quality Reasons: ${(result.metadata?.quality_reasons || []).join(', ')}`,
          `Timeframe: ${timeframe}`
        ],
        riskReward: 2.5,
        stopLoss: result.price * (result.signal === 'BUY' ? 0.97 : 1.03),
        takeProfit: result.price * (result.signal === 'BUY' ? 1.05 : 0.95),
        source: 'strategy',
        strategyId: 'Enhanced Bounce'
      };

      await storage.createSignal(signalData);
      console.log(`[Enhanced Bounce] Signal created: ${result.signal} ${symbol} @ ${result.price}`);
    }

    res.json({
      success: true,
      result: {
        strategyId: 'enhanced_bounce',
        strategyName: 'Enhanced Bounce Strategy',
        symbol,
        timeframe,
        ...result
      }
    });
  } catch (error) {
    console.error('Error executing enhanced bounce strategy:', error);
    res.status(500).json({ success: false, error: 'Failed to execute enhanced bounce strategy' });
  }
});

// POST /api/strategies/:id/execute - Execute strategy and create signal
router.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { symbol, timeframe, parameters } = req.body;

    const strategy = STRATEGIES.find(s => s.id === id);
    if (!strategy) {
      return res.status(404).json({ success: false, error: 'Strategy not found' });
    }

    // Execute strategy via Python
    const result = await executeStrategy(id, symbol, timeframe, parameters);

    // If strategy generated a signal, store it in the database
    if (result.success && result.signal && result.signal !== 'HOLD') {
      const signalData = {
        symbol,
        type: result.signal === 'BUY' || result.signal === 'LONG' ? 'BUY' : 'SELL',
        strength: result.metadata?.strength || 75,
        confidence: result.metadata?.confidence || 70,
        price: result.price,
        reasoning: [
          `${strategy.name} generated ${result.signal} signal`,
          `Timeframe: ${timeframe}`,
          ...Object.entries(result.metadata || {}).map(([k, v]) => `${k}: ${v}`)
        ],
        riskReward: 2.5,
        stopLoss: result.metadata?.trailing_stop || (result.signal === 'BUY' ? result.price * 0.98 : result.price * 1.02),
        takeProfit: result.signal === 'BUY' ? result.price * 1.05 : result.price * 0.95,
        source: 'strategy',
        strategyId: strategy.name
      };

      await storage.createSignal(signalData);
      console.log(`[Strategy ${strategy.name}] Signal created: ${result.signal} ${symbol} @ ${result.price}`);
    }

    res.json({
      success: true,
      result: {
        strategyId: id,
        strategyName: strategy.name,
        symbol,
        timeframe,
        ...result
      }
    });
  } catch (error) {
    console.error('Error executing strategy:', error);
    res.status(500).json({ success: false, error: 'Failed to execute strategy' });
  }
});

// POST /api/strategies/bounce/backtest - Backtest enhanced bounce strategy
router.post('/bounce/backtest', async (req: Request, res: Response) => {
  try {
    const { symbol, timeframe, startDate, endDate, riskProfile } = req.body;

    if (!symbol || !timeframe || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'symbol, timeframe, startDate, and endDate are required' });
    }

    // Run backtest via Python executor
    const result = await backtestStrategy('enhanced_bounce', symbol, timeframe, startDate, endDate, {
      risk_profile: riskProfile || 'moderate'
    });

    res.json({
      success: true,
      backtest: {
        strategyId: 'enhanced_bounce',
        strategyName: 'Enhanced Bounce Strategy',
        symbol,
        timeframe,
        ...result
      }
    });
  } catch (error) {
    console.error('Error backtesting enhanced bounce strategy:', error);
    res.status(500).json({ success: false, error: 'Failed to backtest enhanced bounce strategy' });
  }
});

// POST /api/strategies/consensus - Get consensus trade from all strategies
router.post('/consensus', async (req: Request, res: Response) => {
  try {
    const { symbol, timeframes, equity } = req.body;

    // Execute consensus analysis via strategy_coop.py
    const result = await executeConsensus(symbol, timeframes || ['D1', 'H4', 'H1'], equity || 10000);

    res.json({
      success: true,
      consensus: result
    });
  } catch (error) {
    console.error('Error generating consensus:', error);
    res.status(500).json({ success: false, error: 'Failed to generate consensus' });
  }
});

// POST /api/strategies/:id/backtest - Backtest strategy
router.post('/:id/backtest', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { symbol, timeframe, startDate, endDate, parameters } = req.body;

    const strategy = STRATEGIES.find(s => s.id === id);
    if (!strategy) {
      return res.status(404).json({ success: false, error: 'Strategy not found' });
    }

    // Run backtest via Python
    const result = await backtestStrategy(id, symbol, timeframe, startDate, endDate, parameters);

    res.json({
      success: true,
      backtest: {
        strategyId: id,
        strategyName: strategy.name,
        symbol,
        timeframe,
        ...result
      }
    });
  } catch (error) {
    console.error('Error backtesting strategy:', error);
    res.status(500).json({ success: false, error: 'Failed to backtest strategy' });
  }
});

// Helper: Execute strategy via Python
async function executeStrategy(
  strategyId: string,
  symbol: string,
  timeframe: string,
  parameters: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(process.cwd(), 'strategies', 'executor.py');

    const args = [
      pythonScript,
      '--strategy', strategyId,
      '--symbol', symbol,
      '--timeframe', timeframe,
      '--params', JSON.stringify(parameters || {})
    ];

    const python = spawn('python', args);

    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed: ${errorOutput}`));
      } else {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse Python output: ${output}`));
        }
      }
    });
  });
}

// Helper: Execute consensus via strategy_coop.py
async function executeConsensus(
  symbol: string,
  timeframes: string[],
  equity: number
): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(process.cwd(), 'strategies', 'consensus_executor.py');

    const args = [
      pythonScript,
      '--symbol', symbol,
      '--timeframes', JSON.stringify(timeframes),
      '--equity', equity.toString()
    ];

    const python = spawn('python', args);

    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Consensus script failed: ${errorOutput}`));
      } else {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse consensus output: ${output}`));
        }
      }
    });
  });
}

// Helper: Backtest strategy
async function backtestStrategy(
  strategyId: string,
  symbol: string,
  timeframe: string,
  startDate: string,
  endDate: string,
  parameters: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(process.cwd(), 'strategies', 'backtest_executor.py');

    const args = [
      pythonScript,
      '--strategy', strategyId,
      '--symbol', symbol,
      '--timeframe', timeframe,
      '--start', startDate,
      '--end', endDate,
      '--params', JSON.stringify(parameters || {})
    ];

    const python = spawn('python', args);

    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Backtest script failed: ${errorOutput}`));
      } else {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse backtest output: ${output}`));
        }
      }
    });
  });
}

// POST /api/strategies/execute-all - Execute all active strategies
router.post('/execute-all', async (req: Request, res: Response) => {
  try {
    const { symbols, timeframe } = req.body;
    const symbolsToScan = symbols || ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
    const tf = timeframe || '1h';

    const activeStrategies = STRATEGIES.filter(s => s.isActive);
    const results = [];

    for (const strategy of activeStrategies) {
      for (const symbol of symbolsToScan) {
        try {
          const result = await executeStrategy(strategy.id, symbol, tf, {});

          // Store signals in database
          if (result.success && result.signal && result.signal !== 'HOLD') {
            const signalData = {
              symbol,
              type: result.signal === 'BUY' || result.signal === 'LONG' ? 'BUY' : 'SELL',
              strength: result.metadata?.strength || 75,
              confidence: result.metadata?.confidence || 70,
              price: result.price,
              reasoning: [
                `${strategy.name} generated ${result.signal} signal`,
                `Timeframe: ${tf}`,
                ...Object.entries(result.metadata || {}).map(([k, v]) => `${k}: ${v}`)
              ],
              riskReward: 2.5,
              stopLoss: result.metadata?.trailing_stop || (result.signal === 'BUY' ? result.price * 0.98 : result.price * 1.02),
              takeProfit: result.signal === 'BUY' ? result.price * 1.05 : result.price * 0.95,
              source: 'strategy',
              strategyId: strategy.name
            };

            await storage.createSignal(signalData);
          }

          results.push({
            strategy: strategy.name,
            symbol,
            signal: result.signal,
            success: result.success
          });
        } catch (error) {
          console.error(`Error executing ${strategy.name} on ${symbol}:`, error);
        }
      }
    }

    res.json({
      success: true,
      results,
      totalSignals: results.filter(r => r.signal !== 'HOLD').length
    });
  } catch (error) {
    console.error('Error executing strategies:', error);
    res.status(500).json({ success: false, error: 'Failed to execute strategies' });
  }
});

/**
 * POST /api/strategies/backtest/run
 * Run a backtest for a strategy
 */
router.post('/backtest/run', async (req: Request, res: Response) => {
  try {
    const { strategyId, symbol, timeframe, startDate, endDate, initialCapital } = req.body;

    if (!strategyId || !symbol || !timeframe || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Fetch historical market data
    const { ExchangeDataFeed } = await import('../trading-engine');
    const dataFeed = await ExchangeDataFeed.create();

    // Calculate how many candles we need based on date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const limit = Math.min(1000, Math.max(100, daysDiff * 24)); // Rough estimate

    const marketFrames = await dataFeed.fetchMarketData(symbol, timeframe, limit);

    // Filter frames to date range
    const filteredFrames = marketFrames.filter(frame => {
      const frameDate = new Date(frame.timestamp);
      return frameDate >= start && frameDate <= end;
    });

    if (filteredFrames.length === 0) {
      return res.status(400).json({ error: 'No market data available for the specified date range' });
    }

    // Get strategy
    const strategy = await storage.getStrategy(strategyId);
    if (!strategy) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    // Run backtest using the backtest runner
    const { runBacktest } = await import('../backtest-runner');
    const { SignalEngine } = await import('../trading-engine');
    const config = (await import('../../config/trading-config.json', { with: { type: 'json' } })).default;

    const signalEngine = new SignalEngine(config);
    const signals = [];

    // Generate signals from market frames
    for (let i = 0; i < filteredFrames.length; i++) {
      const signal = await signalEngine.generateSignal(filteredFrames, i);
      if (signal) {
        signals.push({
          ...signal,
          timestamp: filteredFrames[i].timestamp,
        });
      }
    }

    // Run backtest with generated signals
    const result = await runBacktest({
      initialCapital: initialCapital || 10000,
      signals,
      marketFrames: filteredFrames,
    });

    // Calculate metrics
    const metrics = result.metrics;
    const totalReturn = ((result.portfolio.getBalance() - initialCapital) / initialCapital) * 100;

    // Store backtest result
    const backtestResult = await storage.createBacktestResult({
      strategyId,
      startDate: start,
      endDate: end,
      initialCapital: initialCapital || 10000,
      finalCapital: result.portfolio.getBalance(),
      performance: {
        totalReturn,
        ...metrics,
      },
      equityCurve: result.portfolio.getEquityCurve?.() || [],
      monthlyReturns: [],
      metrics: {
        totalReturn,
        totalTrades: metrics.totalTrades,
        winRate: metrics.winRate,
        sharpeRatio: metrics.sharpeRatio,
        maxDrawdown: metrics.maxDrawdown,
        profitFactor: metrics.profitFactor,
      },
      trades: result.trades.map(trade => ({
        symbol: trade.symbol,
        side: trade.side,
        entryTime: trade.entryTime,
        exitTime: trade.exitTime,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        quantity: trade.quantity,
        pnl: trade.pnl,
      })),
    });

    res.json({
      success: true,
      backtest: {
        ...backtestResult,
        name: strategy.name,
        symbol,
        timeframe,
      },
    });
  } catch (error: any) {
    console.error('Failed to run backtest:', error);
    res.status(500).json({ error: error.message || 'Failed to run backtest' });
  }
});

/**
 * GET /api/strategies/backtest/results
 * Get all backtest results
 */
router.get('/backtest/results', async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.query;
    const results = await storage.getBacktestResults(strategyId as string | undefined);

    // Get strategies to add names
    const strategies = await storage.getStrategies();

    // Enrich results with strategy names
    const enrichedResults = results.map(result => {
      const strategy = strategies.find(s => s.id === result.strategyId);
      return {
        ...result,
        name: strategy?.name || 'Unknown Strategy',
      };
    });

    res.json({ results: enrichedResults });
  } catch (error: any) {
    console.error('Failed to fetch backtest results:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/strategies/backtest/:id
 * Delete a backtest result
 */
router.delete('/backtest/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await storage.deleteBacktestResult(id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete backtest:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;