/**
 * Convexity Agent Backtester with Real VFMD Signals
 * 
 * Uses actual VFMD signal generation instead of synthetic signals
 * Feeds real VFMD scout data → ConvexityAgent → FoR deployment
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ConvexityAgent } from '../services/rpg-agents/ConvexityAgent.ts';
import { MetricsCalculator, type TradeResult, type BarReturn, type BacktestMetrics } from './metrics-calculator.ts';
import { VFMDBacktestValidator } from '../services/vfmd/vfmd-backtest-validator.ts';
import { FieldConstructor } from '../services/vfmd/fieldConstructor.ts';
import { PhysicsCalculator } from '../services/vfmd/physicsCalculator.ts';
import { RegimeClassifier } from '../services/vfmd/regimeClassifier.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MarketTick {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  atr?: number;
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

export class ConvexityBacktesterWithVFMD {
  private convex: ConvexityAgent;
  private trades: TradeResult[] = [];
  private barReturns: BarReturn[] = [];
  private activeTrade: any = null;
  private currentEquity: number = 10000;
  private peakEquity: number = 10000;
  private readonly INITIAL_CAPITAL: number = 10000;
  private readonly RISK_PER_TRADE: number = 0.02;  // 2% risk per trade
  private diagnostics = {
    vfmdSignals: 0,
    convexDeployments: 0,
    forTriggersPerDeployment: 0,
  };
  
  // VFMD signal generation
  private fieldConstructor: FieldConstructor;
  private vfmdValidator: VFMDBacktestValidator;

  constructor(name: string = 'ConvexBacktest') {
    this.convex = new ConvexityAgent(name);
    this.fieldConstructor = new FieldConstructor(50, 100);
    this.vfmdValidator = new VFMDBacktestValidator();
  }

  /**
   * Load historical market data from JSON file
   */
  private loadMarketData(dataPath: string): MarketTick[] {
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const parsed = JSON.parse(rawData);
    
    let candles = parsed.data || parsed;
    if (!Array.isArray(candles)) {
      candles = Object.values(candles);
    }

    return candles.map((c: any) => ({
      timestamp: c.timestamp || c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume || 0,
    }));
  }

  /**
   * Generate REAL VFMD signals from market data
   */
  private generateVFMDSignals(ticks: MarketTick[], startBar: number = 100): Array<{
    barIndex: number;
    price: number;
    regime: any;
    confidence: number;
    target: number;
    stop: number;
  }> {
    const signals = [];
    const prices = ticks.map(t => t.close);

    // Generate signals every 50 bars (scanning interval)
    for (let i = startBar; i < ticks.length - 50; i += 20) {
      try {
        const windowTicks = ticks.slice(Math.max(0, i - 100), i);
        const windowPrices = windowTicks.map(t => t.close);

        if (windowPrices.length < 50) continue;

        // Compute VFMD metrics
        const field = this.fieldConstructor.constructField(windowPrices);
        const metrics = PhysicsCalculator.computeAllMetrics(field);
        const regime = RegimeClassifier.classify(metrics);
        const confidence = RegimeClassifier.getRegimeConfidence(metrics);

        // Only generate signals with decent confidence
        if (confidence < 0.4) continue;

        // Calculate realistic stops/targets based on regime
        const currentPrice = ticks[i].close;
        const atr = this.calculateATR(ticks.slice(Math.max(0, i - 14), i + 1), 14);
        
        const config = RegimeClassifier.getRegimeConfig(regime);
        
        // Determine direction: VFMD generates REVERSAL signals (opposite to trend)
        // BUY when price is down (reversal), SELL when price is up (reversal)
        const priceTrend = windowPrices[windowPrices.length - 1] > windowPrices[Math.max(0, windowPrices.length - 20)]
          ? 'UP'
          : 'DOWN';

        // REVERSAL LOGIC: Opposite of trend
        if (priceTrend === 'DOWN') {
          // Price going down → BUY reversal signal
          signals.push({
            barIndex: i,
            price: currentPrice,
            regime,
            confidence,
            direction: 'BUY',
            target: currentPrice * (1 + atr * 2),  // Buy low, target higher
            stop: currentPrice * (1 - atr * 0.7),  // Stop if goes lower
          });
        } else if (priceTrend === 'UP') {
          // Price going up → SELL reversal signal
          signals.push({
            barIndex: i,
            price: currentPrice,
            regime,
            confidence,
            direction: 'SELL',
            target: currentPrice * (1 - atr * 2),  // Sell high, target lower
            stop: currentPrice * (1 + atr * 0.7),  // Stop if goes higher
          });
        }
      } catch (e) {
        // Skip bars where metrics calculation fails
      }
    }

    return signals;
  }

  /**
   * Calculate ATR
   */
  private calculateATR(ticks: MarketTick[], period: number = 14): number {
    if (ticks.length < period) return 0;

    let trSum = 0;
    let count = 0;
    
    for (let i = Math.max(1, ticks.length - period); i < ticks.length; i++) {
      const curr = ticks[i];
      const prev = ticks[i - 1];
      const tr = Math.max(
        curr.high - curr.low,
        Math.abs(curr.high - prev.close),
        Math.abs(curr.low - prev.close)
      );
      trSum += tr;
      count++;
    }

    return count > 0 ? trSum / count : 0;
  }

  /**
   * Record trade result
   */
  private recordTrade(entryPrice: number, entryBar: number, exitPrice: number, exitBar: number): void {
    const pnl = exitPrice - entryPrice;
    const pnlPct = pnl / entryPrice;
    
    const positionSize = this.currentEquity * this.RISK_PER_TRADE / Math.abs(pnl);
    const tradeProfit = positionSize * pnl;
    
    this.currentEquity += tradeProfit;
    if (this.currentEquity > this.peakEquity) {
      this.peakEquity = this.currentEquity;
    }

    const trade: TradeResult = {
      entryBar,
      exitBar,
      entryPrice,
      exitPrice,
      pnlPct,
      pnl: tradeProfit,
      won: pnlPct > 0,
      holdingBars: exitBar - entryBar,
    };

    this.trades.push(trade);
    this.diagnostics.convexDeployments++;
  }

  /**
   * Run backtest with real VFMD signals
   */
  run(config: BacktestConfig): BacktestResult {
    // Load data
    const allCandles = this.loadMarketData(config.dataPath);
    const startBar = config.startBar ?? 0;
    const endBar = config.endBar ?? allCandles.length - 1;
    const candles = allCandles.slice(startBar, endBar + 1);

    console.log(`✅ Loaded ${candles.length} candles (${config.symbol})`);

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

    // Calculate ATR for all candles
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

    // Generate VFMD signals
    console.log('🚀 Generating VFMD signals from market data...');
    const vfmdSignals = this.generateVFMDSignals(candles, 100);
    console.log(`📊 Generated ${vfmdSignals.length} VFMD signals`);
    this.diagnostics.vfmdSignals = vfmdSignals.length;

    // Run backtest
    console.log('🚀 Running backtest with real VFMD signals...');
    const startTime = Date.now();

    let lastState = 'DORMANT';
    let stateChanges = 0;
    let nextSignalIndex = 0;

    for (let bar = 100; bar < candles.length; bar++) {
      const ticks = candles.slice(Math.max(0, bar - 49), bar + 1);
      const currentCandle = candles[bar];

      // Feed Convex with current tick and regime
      try {
        this.convex.processTick(ticks, 'laminar_trend' as any, currentCandle.close, bar);

        // Check if we have a VFMD signal at this bar
        if (nextSignalIndex < vfmdSignals.length) {
          const signal = vfmdSignals[nextSignalIndex];
          
          if (signal.barIndex === bar) {
            // Send VFMD signal to Convex
            const mockVFMDSignal: any = {
              action: currentCandle.close > candles[Math.max(0, bar - 5)].close ? 'BUY' : 'SELL',
              entry: signal.price,
              stop: signal.stop,
              target: signal.target,
              size_multiplier: 0.5,
              confidence: signal.confidence,
              exit_reason: 'VFMD_SIGNAL',
            };

            this.convex.onVFMDSignalFired(mockVFMDSignal, signal.regime);
            nextSignalIndex++;
          }
        }

        // Get Convex signal (may trigger on FoR)
        const signal = this.convex.generateSignal(ticks, 0.01);
        const diagnostics = this.convex.getDiagnostics();
        const currentState = diagnostics.status;

        if (currentState !== lastState) {
          stateChanges++;
          lastState = currentState;
        }

        // Handle entry - DEPLOYED state (scout survived 5 bars + FoR approved)
        if (diagnostics.status === 'DEPLOYED' && !this.activeTrade && nextSignalIndex > 0) {
          const signal = vfmdSignals[nextSignalIndex - 1];  // Use most recent signal
          const riskAmount = this.currentEquity * this.RISK_PER_TRADE;
          const stopDistance = Math.abs(currentCandle.close - signal.stop) / currentCandle.close;
          const positionSize = riskAmount / stopDistance;
          const quantity = positionSize / currentCandle.close;

          this.activeTrade = {
            entryPrice: currentCandle.close,
            entryBar: bar,
            direction: signal.direction,
            size: quantity,
            stopLoss: signal.stop,      // Use signal's calculated stop
            target: signal.target,       // Use signal's calculated target
            watchingSince: bar,
          };
        }

        // Handle exit with proper target checking
        if (this.activeTrade) {
          let shouldExit = false;
          let exitPrice = currentCandle.close;
          
          // Check stop loss
          if (this.activeTrade.direction === 'BUY' && currentCandle.close <= this.activeTrade.stopLoss) {
            shouldExit = true;
          } else if (this.activeTrade.direction === 'SELL' && currentCandle.close >= this.activeTrade.stopLoss) {
            shouldExit = true;
          }
          
          // Check target hit
          if (this.activeTrade.direction === 'BUY' && currentCandle.close >= this.activeTrade.target) {
            shouldExit = true;
            exitPrice = this.activeTrade.target;
          } else if (this.activeTrade.direction === 'SELL' && currentCandle.close <= this.activeTrade.target) {
            shouldExit = true;
            exitPrice = this.activeTrade.target;
          }
          
          // Timeout: exit if 50 bars passed
          if (bar - this.activeTrade.entryBar > 50) {
            shouldExit = true;
          }

          if (shouldExit) {
            this.recordTrade(
              this.activeTrade.entryPrice,
              this.activeTrade.entryBar,
              exitPrice,
              bar
            );
            this.activeTrade = null;
          }
        }

        this.barReturns.push({
          bar,
          returnPct: (currentCandle.close - candles[bar - 1].close) / candles[bar - 1].close,
        });
      } catch (e) {
        console.error(`Error at bar ${bar}:`, e);
      }
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`✅ Backtest complete in ${(elapsedMs / 1000).toFixed(2)}s`);
    console.log(`   State changes: ${stateChanges}`);
    console.log(`   VFMD signals created: ${this.diagnostics.vfmdSignals}`);

    // Get final diagnostics from agent
    const finalDiagnostics = this.convex.getDiagnostics();

    // Calculate metrics
    const metrics = MetricsCalculator.calculate(
      this.trades,
      this.barReturns,
      this.INITIAL_CAPITAL,
      config.symbol
    );

    return {
      symbol: config.symbol,
      totalBars: candles.length,
      trades: this.trades,
      metrics,
      diagnostics: this.diagnostics,
      scoutDiagnostics: finalDiagnostics.scouts  // Add scout lifecycle tracking
    };
  }
}

// Main execution
async function main() {
  const backtester = new ConvexityBacktesterWithVFMD('ConvexBacktest-VFMD');

  // BTC backtest
  const btcResult = backtester.run({
    symbol: 'BTC/USDT',
    dataPath: path.join(__dirname, '../../data/cache/BTCUSDT_1h_365d.json'),
  });

  console.log('\n' + '═'.repeat(60));
  console.log('BTC/USDT RESULTS');
  console.log('═'.repeat(60));
  console.log(JSON.stringify(btcResult.metrics, null, 2));
  
  console.log('\n📊 BTC Scout Diagnostics:');
  console.log(JSON.stringify(btcResult.scoutDiagnostics, null, 2));

  // ETH backtest
  const ethBacktester = new ConvexityBacktesterWithVFMD('ConvexBacktest-VFMD-ETH');
  const ethResult = ethBacktester.run({
    symbol: 'ETH/USDT',
    dataPath: path.join(__dirname, '../../data/cache/ETHUSDT_1h_365d.json'),
  });

  console.log('\n' + '═'.repeat(60));
  console.log('ETH/USDT RESULTS');
  console.log('═'.repeat(60));
  console.log(JSON.stringify(ethResult.metrics, null, 2));
  
  console.log('\n📊 ETH Scout Diagnostics:');
  console.log(JSON.stringify(ethResult.scoutDiagnostics, null, 2));

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('SUMMARY COMPARISON');
  console.log('═'.repeat(60));
  console.log(`\n📊 Metrics Summary:\n`);
  console.log(`Symbol       Win%     PF       Sharpe   MaxDD%   AnnRet%`);
  console.log(`------------------------------------------------------------`);
  console.log(
    `BTC/USDT    ${(btcResult.metrics.winRate * 100).toFixed(1)}%`.padEnd(12) +
    `${btcResult.metrics.profitFactor.toFixed(2)}x`.padEnd(9) +
    `${btcResult.metrics.sharpeRatio.toFixed(2)}`.padEnd(9) +
    `${(btcResult.metrics.maxDrawdown * 100).toFixed(1)}%`.padEnd(9) +
    `${(btcResult.metrics.annualizedReturn * 100).toFixed(1)}%`
  );
  console.log(
    `ETH/USDT    ${(ethResult.metrics.winRate * 100).toFixed(1)}%`.padEnd(12) +
    `${ethResult.metrics.profitFactor.toFixed(2)}x`.padEnd(9) +
    `${ethResult.metrics.sharpeRatio.toFixed(2)}`.padEnd(9) +
    `${(ethResult.metrics.maxDrawdown * 100).toFixed(1)}%`.padEnd(9) +
    `${(ethResult.metrics.annualizedReturn * 100).toFixed(1)}%`
  );

  console.log('\n✅ Backtest suite complete!');
}

main().catch(console.error);
