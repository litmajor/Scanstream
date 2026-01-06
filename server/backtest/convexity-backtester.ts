/**
 * Convexity Agent Backtester
 * Runs ConvexityAgent against historical market data
 * Tracks all trades and computes performance metrics
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ConvexityAgent } from '../services/rpg-agents/ConvexityAgent.ts';
import { MetricsCalculator, type TradeResult, type BarReturn, type BacktestMetrics } from './metrics-calculator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MarketTick {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  atr?: number;  // Average True Range for volatility calculations
}

export interface BacktestConfig {
  symbol: string;
  dataPath: string;
  startBar?: number;
  endBar?: number;
  initialCapital?: number;
}

export interface BacktestResult {
  symbol: string;
  totalBars: number;
  trades: TradeResult[];
  metrics: BacktestMetrics;
  diagnostics: {
    vfmdSignals: number;
    convexDeployments: number;
    forTriggersPerDeployment: number;
  };
}

export class ConvexityBacktester {
  
  private convex: ConvexityAgent;
  
  private trades: TradeResult[] = [];
  private barReturns: BarReturn[] = [];
  private activeTrade: {
    entryPrice: number;
    entryBar: number;
    size: number;
    stopLoss: number;
  } | null = null;
  
  private diagnostics = {
    vfmdSignals: 0,
    convexDeployments: 0,
    forTriggersPerDeployment: 0,
  };
  
  // Position sizing
  private readonly INITIAL_CAPITAL = 10000; // $10,000 starting capital
  private readonly RISK_PER_TRADE = 0.02; // 2% risk per trade
  private currentEquity = this.INITIAL_CAPITAL; // Track equity curve
  private peakEquity = this.INITIAL_CAPITAL; // For drawdown calc
  
  constructor() {
    this.convex = new ConvexityAgent('ConvexBacktest', 'balanced');
  }
  
  /**
   * Load market data from JSON file
   */
  private loadMarketData(dataPath: string): MarketTick[] {
    const fileContent = fs.readFileSync(dataPath, 'utf-8');
    const parsed = JSON.parse(fileContent);
    
    // Handle both BTC format (nested .data) and ETH format (direct array)
    const data = Array.isArray(parsed) ? parsed : parsed.data;
    
    return data.map((candle: any) => ({
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }));
  }
  
  /**
   * Run backtest on historical data
   */
  async run(config: BacktestConfig): Promise<BacktestResult> {
    console.log('\n📊 Loading market data for ' + config.symbol + '...');
    const allCandles = this.loadMarketData(config.dataPath);
    
    const startBar = config.startBar ?? 0;
    const endBar = config.endBar ?? allCandles.length - 1;
    const candles = allCandles.slice(startBar, endBar + 1);
    
    console.log('✅ Loaded ' + candles.length + ' candles (' + config.symbol + ')');
    
    // Reset state
    this.trades = [];
    this.barReturns = [];
    this.activeTrade = null;
    this.currentEquity = this.INITIAL_CAPITAL;
    this.peakEquity = this.INITIAL_CAPITAL;
    this.diagnostics = {
      vfmdSignals: 0,
      convexDeployments: 0,
      forTriggersPerDeployment: 0,
    };
    
    // Calculate ATR for all candles (14-period simple ATR)
    const atrPeriod = 14;
    let trSum = 0;
    for (let i = 0; i < candles.length; i++) {
      let tr: number;
      if (i === 0) {
        tr = candles[i].high - candles[i].low;
      } else {
        tr = Math.max(
          candles[i].high - candles[i].low,
          Math.abs(candles[i].high - candles[i-1].close),
          Math.abs(candles[i].low - candles[i-1].close)
        );
      }
      
      if (i < atrPeriod) {
        trSum += tr;
        candles[i].atr = trSum / (i + 1);
      } else if (i === atrPeriod) {
        trSum += tr;
        candles[i].atr = trSum / atrPeriod;
      } else {
        candles[i].atr = (candles[i-1].atr! * (atrPeriod - 1) + tr) / atrPeriod;
      }
    }
    
    // Run simulation
    console.log('🚀 Running backtest...');
    const startTime = Date.now();
    
    // Debug: track state
    let lastState = 'DORMANT';
    let stateChanges = 0;
    
    // Suppress verbose logging for faster testing
    const originalLog = console.log;
    let debugLogging = false; // Set to true for detailed debugging
    const log = (msg: string) => { if (debugLogging) originalLog(msg); };
    
    for (let bar = 0; bar < candles.length; bar++) {
      const ticks = candles.slice(Math.max(0, bar - 49), bar + 1);
      const currentCandle = candles[bar];
      
      // Calculate simple trend: are last 3 candles all up or all down?
      let isStrongTrend = false;
      if (ticks.length >= 3) {
        const recentCandles = ticks.slice(-3);
        const upCount = recentCandles.filter((t, i) => i === 0 || t.close > recentCandles[i-1].close).length;
        isStrongTrend = upCount >= 2 || upCount <= 1; // Strong up or strong down
      }
      
      // Feed Convex with default regime
      try {
        this.convex.processTick(ticks, 'laminar_trend' as any, currentCandle.close);
        
        // Simulate VFMD signals with proper spacing and direction variation
        // Send every 25 bars (not 15) to avoid dedup clustering
        // Alternate BUY/SELL to break same-direction filtering
        if (bar > 50 && bar % 25 === 0) {
          const direction = (bar / 25) % 2 === 0 ? 'BUY' : 'SELL';
          const currentPrice = currentCandle.close;
          
          const mockVFMDSignal: any = {
            action: direction,
            entry: currentPrice,
            stop: direction === 'BUY' ? currentPrice * 0.96 : currentPrice * 1.04,  // 4% stop (wider for 5-bar window)
            target: direction === 'BUY' ? currentPrice * 1.08 : currentPrice * 0.92,  // 8% target
            size_multiplier: 0.5,
            confidence: 0.65,
            exit_reason: 'VFMD_SIGNAL',
          };
          
          // Call onVFMDSignalFired to set agent into WATCHING state
          this.convex.onVFMDSignalFired(mockVFMDSignal, 'laminar_trend' as any);
          this.diagnostics.vfmdSignals++;
          log(`VFMD signal at bar ${bar}: ${direction}`);
        }
        
        // Get Convex signal
        const signal = this.convex.generateSignal(ticks, 0.01);
        const diagnostics = this.convex.getDiagnostics();
        const currentState = diagnostics.status;
        
        if (currentState !== lastState) {
          stateChanges++;
          log(`State change at bar ${bar}: ${lastState} → ${currentState}`);
          lastState = currentState;
        }
        
        // Handle entry with Kelly-based position sizing
        if (signal.action === 'BUY' && !this.activeTrade) {
          const stopDistance = 0.02; // 2% stop loss (typical)
          const riskAmount = this.currentEquity * this.RISK_PER_TRADE;
          const positionSize = riskAmount / stopDistance; // Position size in notional
          const quantity = positionSize / currentCandle.close; // Convert to units
          
          this.activeTrade = {
            entryPrice: currentCandle.close,
            entryBar: bar,
            size: quantity,
            stopLoss: currentCandle.close * (1 - stopDistance),
          };
          this.diagnostics.convexDeployments++;
        }
        
        // Handle exit
        if (this.activeTrade) {
          const positionState = this.convex.getPositionState();
          
          if (positionState.isActive === false) {
            this.recordTrade(currentCandle.close, bar, 'SYSTEM_EXIT');
            this.activeTrade = null;
          }
        }
      } catch (e) {
        // Skip on error
      }
      
      // Track bar return
      const prevClose = bar > 0 ? candles[bar - 1].close : currentCandle.open;
      const dailyReturn = (currentCandle.close - prevClose) / prevClose;
      const cumulativeReturn = this.barReturns.length > 0
        ? this.barReturns[this.barReturns.length - 1].cumulativeReturn * (1 + dailyReturn)
        : (1 + dailyReturn);
      
      this.barReturns.push({
        bar,
        timestamp: currentCandle.timestamp,
        dailyReturn,
        cumulativeReturn,
      });
      
      // Track equity for drawdown calculation
      this.peakEquity = Math.max(this.peakEquity, this.currentEquity);
    }
    
    // Restore logging
    console.log = originalLog;
    
    // Log debug info
    console.log(`   State changes: ${stateChanges}`);
    console.log(`   VFMD signals created: ${this.diagnostics.vfmdSignals}`);
    
    // Close any open position at end of backtest
    if (this.activeTrade) {
      const lastCandle = candles[candles.length - 1];
      this.recordTrade(lastCandle.close, candles.length - 1, 'BACKTEST_END');
    }
    
    const elapsed = Date.now() - startTime;
    console.log('✅ Backtest complete in ' + (elapsed / 1000).toFixed(2) + 's');
    
    // Calculate metrics with corrected equity curve
    const metrics = MetricsCalculator.calculate(
      this.trades,
      this.barReturns,
      candles.length,
      this.INITIAL_CAPITAL
    );
    
    return {
      symbol: config.symbol,
      totalBars: candles.length,
      trades: this.trades,
      metrics,
      diagnostics: this.diagnostics,
    };
  }
  
  /**
   * Record a completed trade
   */
  private recordTrade(exitPrice: number, exitBar: number, exitReason: string): void {
    if (!this.activeTrade) return;
    
    const pnlPct = (exitPrice - this.activeTrade.entryPrice) / this.activeTrade.entryPrice;
    const pnlAbs = (exitPrice - this.activeTrade.entryPrice) * this.activeTrade.size;
    
    // Update equity curve
    this.currentEquity += pnlAbs;
    this.peakEquity = Math.max(this.peakEquity, this.currentEquity);
    
    this.trades.push({
      entryPrice: this.activeTrade.entryPrice,
      exitPrice,
      quantity: this.activeTrade.size,
      entryBar: this.activeTrade.entryBar,
      exitBar,
      pnlPct,
      pnlAbs,
      status: pnlPct > 0 ? 'WIN' : (pnlPct < 0 ? 'LOSS' : 'PARTIAL'),
      exitReason,
    });
  }
}

/**
 * Run full backtest suite on BTC and ETH
 */
export async function runBacktestSuite(): Promise<void> {
  const backtester = new ConvexityBacktester();
  
  const configs: BacktestConfig[] = [
    {
      symbol: 'BTC/USDT',
      dataPath: path.join(__dirname, '../../data/cache/BTCUSDT_1h_365d.json'),
    },
    {
      symbol: 'ETH/USDT',
      dataPath: path.join(__dirname, '../../data/cache/ETHUSDT_1h_365d.json'),
    },
  ];
  
  const results: BacktestResult[] = [];
  
  for (const config of configs) {
    try {
      console.log('\n' + '='.repeat(60));
      console.log('BACKTEST: ' + config.symbol);
      console.log('='.repeat(60));
      
      const result = await backtester.run(config);
      results.push(result);
      
      // Print metrics
      console.log(MetricsCalculator.formatMetrics(result.metrics));
      
      // Print diagnostics
      console.log('\n📋 DIAGNOSTICS');
      console.log('├─ VFMD Signals: ' + result.diagnostics.vfmdSignals);
      console.log('├─ Convex Deployments: ' + result.diagnostics.convexDeployments);
      console.log('└─ FoR Triggers/Deployment: ' + result.diagnostics.forTriggersPerDeployment.toFixed(2));
      
    } catch (error) {
      console.error('❌ Error running backtest for ' + config.symbol + ':', error);
    }
  }
  
  // Summary comparison
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY COMPARISON');
  console.log('='.repeat(60));
  
  if (results.length > 0) {
    console.log('\n📊 Metrics Summary:');
    console.log('\nSymbol       Win%     PF       Sharpe   MaxDD%   AnnRet%');
    console.log('-'.repeat(60));
    
    for (const result of results) {
      const m = result.metrics;
      const sym = result.symbol.padEnd(12);
      const win = m.winRate.toFixed(1).padEnd(8) + '%';
      const pf = m.profitFactor.toFixed(2).padEnd(8) + 'x';
      const sharpe = m.sharpeRatio.toFixed(2).padEnd(8);
      const dd = m.maxDrawdown.toFixed(1).padEnd(8) + '%';
      const ret = m.annualizedReturn.toFixed(1).padEnd(8) + '%';
      
      console.log(sym + win + pf + sharpe + dd + ret);
    }
  }
  
  console.log('\n✅ Backtest suite complete!');
}

// Run the backtest suite
runBacktestSuite().catch(console.error);
