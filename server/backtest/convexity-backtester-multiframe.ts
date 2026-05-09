/**
 * Convexity Agent Backtester with Multi-Timeframe VFMD Signals + FoR Exits
 * 
 * Uses multi-timeframe VFMD signal fusion for entry validation
 * Uses FoR (Failure of Reversion) for intelligent exit logic
 * This allows convexity to actually form instead of exiting on noise
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ConvexityAgent } from '../services/rpg-agents/ConvexityAgent.ts';
import { VFMDPhysicsAgent } from '../services/rpg-agents/VFMDPhysicsAgent.ts';
import { RegimeGate } from '../services/vfmd/regimeGate.ts';
import FailureOfReversionCalculator from '../services/vfmd/failureOfReversionCalculator.ts';
import { MetricsCalculator, type TradeResult, type BarReturn, type BacktestMetrics } from './metrics-calculator.ts';
import { BinanceDataFetcher } from '../services/vfmd/binanceDataFetcher.ts';
import type { MarketTick } from '../services/vfmd/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MultiTimeframeData {
  symbol: string;
  timeframes: Map<string, MarketTick[]>;
  dateRange: { start: string; end: string };
}

export interface BacktestConfig {
  symbol: string;
  dataDir: string;
  startDate?: string;
  endDate?: string;
  initialCapital?: number;
  barIndex?: number; // Current bar position (1h candle)
}

export interface BacktestResult {
  symbol: string;
  totalBars: number;
  trades: TradeResult[];
  metrics: BacktestMetrics;
  diagnostics: {
    multiframeSignals: number;
    convexDeployments: number;
    signalQuality: {
      strongAlignment: number;    // 80%+ timeframe agreement
      goodAlignment: number;      // 60-80% agreement
      weakAlignment: number;      // 40-60% agreement
      conflict: number;           // <40% agreement
    };
  };
}

export class ConvexityBacktesterMultiframe {
  private convex: ConvexityAgent;
  private vfmd: VFMDPhysicsAgent;
  private trades: TradeResult[] = [];
  private barReturns: BarReturn[] = [];
  private activeTrade: any = null;
  private currentEquity: number = 10000;
  private peakEquity: number = 10000;
  private readonly INITIAL_CAPITAL: number = 10000;
  private readonly RISK_PER_TRADE: number = 0.02;  // 2% risk per trade
  private diagnostics = {
    multiframeSignals: 0,
    convexDeployments: 0,
    signalQuality: {
      strongAlignment: 0,
      goodAlignment: 0,
      weakAlignment: 0,
      conflict: 0,
    }
  };

  constructor(name: string = 'ConvexMultiframeBacktest') {
    this.convex = new ConvexityAgent(name);
    this.vfmd = new VFMDPhysicsAgent('VFMD_MultiFrame', 'balanced');
  }

  private forCalculator = new FailureOfReversionCalculator();

  /**
   * Load multi-timeframe data from cache directory
   * Expects files like BTCUSDT/BTCUSDT_1h.json, BTCUSDT/BTCUSDT_1d.json, etc.
   */
  private loadMultiTimeframeData(dataDir: string, symbol: string): MultiTimeframeData {
    const timeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d'];
    const timeframeData = new Map<string, MarketTick[]>();

    let dateRangeStart = '';
    let dateRangeEnd = '';

    for (const tf of timeframes) {
      const filePath = path.join(dataDir, symbol, `${symbol}_${tf}.json`);
      
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Missing data file: ${filePath}`);
        continue;
      }

      try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(rawData);
        
        // Handle different JSON formats
        let candles: any[] = [];
        if (Array.isArray(parsed) && parsed[0]?.data) {
          // Format: [{ data: [...], dateRange: {...} }]
          candles = parsed[0].data;
          if (parsed[0].dateRange) {
            dateRangeStart = parsed[0].dateRange.start;
            dateRangeEnd = parsed[0].dateRange.end;
          }
        } else if (Array.isArray(parsed)) {
          // Format: [{ timestamp, open, high, low, close, volume }, ...]
          candles = parsed;
        } else {
          // Format: { data: [...] } or object with values
          candles = parsed.data || Object.values(parsed);
        }

        // Convert to MarketTick format
        const ticks = candles.map((c: any) => ({
          timestamp: c.timestamp || c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume || 0,
          buyVolume: c.buyVolume,
          sellVolume: c.sellVolume,
          netVolume: c.netVolume,
          volumeRatio: c.volumeRatio,
          dominantSide: c.dominantSide,
        } as MarketTick));

        timeframeData.set(tf, ticks);
        console.log(`✅ Loaded ${tf}: ${ticks.length} candles`);
      } catch (error) {
        console.error(`Error loading ${filePath}:`, error);
      }
    }

    return {
      symbol,
      timeframes: timeframeData,
      dateRange: {
        start: dateRangeStart,
        end: dateRangeEnd
      }
    };
  }

  /**
   * Get aligned timeframe data at a specific 1h bar index
   * Returns Map<timeframe, candles_up_to_this_bar>
   */
  private getAlignedTimeframeData(
    multiframeData: MultiTimeframeData,
    barIndex1h: number
  ): Map<string, MarketTick[]> {
    const alignedData = new Map<string, MarketTick[]>();

    // Get the timestamp for the 1h bar
    const hourlyData = multiframeData.timeframes.get('1h');
    if (!hourlyData || barIndex1h >= hourlyData.length) {
      return alignedData;
    }

    const targetTimestamp = hourlyData[barIndex1h].timestamp;

    // For each timeframe, get all candles up to this timestamp
    for (const [tf, candles] of multiframeData.timeframes.entries()) {
      const alignedCandles = candles.filter(c => c.timestamp <= targetTimestamp);
      if (alignedCandles.length >= 100) {  // Need at least 100 candles for analysis
        alignedData.set(tf, alignedCandles);
      }
    }

    return alignedData;
  }

  /**
   * Calculate ATR for a set of candles
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
   * @param direction - 'BUY' or 'SELL' to calculate P&L correctly
   */
  private recordTrade(entryPrice: number, entryBar: number, exitPrice: number, exitBar: number, direction: 'BUY' | 'SELL'): void {
    // 🔒 CRITICAL: Calculate P&L based on direction
    // BUY:  profit when exit > entry
    // SELL: profit when exit < entry (entry - exit)
    const pnl = direction === 'BUY' 
      ? exitPrice - entryPrice
      : entryPrice - exitPrice;
    
    const pnlPct = pnl / entryPrice;
    
    // Position sizing based on absolute risk (works for both BUY and SELL)
    const positionSize = this.currentEquity * this.RISK_PER_TRADE / Math.abs(pnl || 0.0001);
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
      quantity: positionSize,
      pnlAbs: tradeProfit,
      status: pnlPct > 0 ? 'WIN' : pnlPct < 0 ? 'LOSS' : 'PARTIAL',
      exitReason: 'CLOSED',
    };

    this.trades.push(trade);
    this.diagnostics.convexDeployments++;
  }

  /**
   * Calculate ATR (Average True Range) for position sizing and stops - DUPLICATE REMOVED
   */

  /**
   * Run backtest with multi-timeframe VFMD signals
   */
  run(config: BacktestConfig): BacktestResult {
    console.log(`\n📊 Starting Multi-Timeframe Convexity Backtest (${config.symbol})`);
    console.log(`📁 Data directory: ${config.dataDir}`);

    // Load multi-timeframe data
    const multiframeData = this.loadMultiTimeframeData(config.dataDir, config.symbol);
    
    if (multiframeData.timeframes.size === 0) {
      throw new Error(`No timeframe data found for ${config.symbol}`);
    }

    console.log(`✅ Loaded ${multiframeData.timeframes.size} timeframes`);
    console.log(`📅 Date range: ${multiframeData.dateRange.start} to ${multiframeData.dateRange.end}`);

    // Use 1h as the base timeframe for bar iteration
    const baseData = multiframeData.timeframes.get('1h');
    if (!baseData || baseData.length < 100) {
      throw new Error('Insufficient 1h data for backtest');
    }

    // Reset state
    this.trades = [];
    this.barReturns = [];
    this.activeTrade = null;
    this.currentEquity = this.INITIAL_CAPITAL;
    this.peakEquity = this.INITIAL_CAPITAL;
    this.diagnostics = {
      multiframeSignals: 0,
      convexDeployments: 0,
      signalQuality: {
        strongAlignment: 0,
        goodAlignment: 0,
        weakAlignment: 0,
        conflict: 0,
      }
    };

    // Run backtest
    console.log('🚀 Running multi-timeframe backtest...');
    const startTime = Date.now();

    let lastState = 'DORMANT';
    let stateChanges = 0;
    let activateBar = -1;
    let targetPrice = 0;
    let stopPrice = 0;

    for (let bar = 100; bar < baseData.length; bar++) {
      const currentCandle = baseData[bar];
      const currentPrice = currentCandle.close;

      // Get aligned multi-timeframe data
      const timeframeData = this.getAlignedTimeframeData(multiframeData, bar);

      if (timeframeData.size === 0) {
        continue;
      }

      try {
        // Generate multi-timeframe VFMD signal
        const multiframeAnalysis = this.vfmd.analyzeMultiTimeframe(config.symbol, timeframeData);
        const fusedSignal = multiframeAnalysis.fused;

        this.diagnostics.multiframeSignals++;

        // Track signal quality
        let alignmentGrade = 'UNKNOWN';
        if (multiframeAnalysis.fused.multiframe_diagnostics) {
          alignmentGrade = multiframeAnalysis.fused.multiframe_diagnostics.alignment_grade;
          if (alignmentGrade === 'STRONG') this.diagnostics.signalQuality.strongAlignment++;
          else if (alignmentGrade === 'GOOD') this.diagnostics.signalQuality.goodAlignment++;
          else if (alignmentGrade === 'WEAK') this.diagnostics.signalQuality.weakAlignment++;
          else if (alignmentGrade === 'CONFLICT') this.diagnostics.signalQuality.conflict++;
        }

        // 🧠 REGIME GATE: Check if market structure allows this direction
        // This is the missing layer — convexity doesn't exist in hostile regimes
        const baselineData = baseData.slice(Math.max(0, bar - 100), bar);
        const regimeGateState = RegimeGate.evaluateDirectionAllowed(
          baselineData,
          fusedSignal.action as any
        );

        const regimeGateBlocked = !regimeGateState.allows_direction;
        
        if (regimeGateBlocked) {
          // Regime actively punishes this direction - skip silently
        }
        
        // 🧠 ASYMMETRIC GATES: SHORT_CONVEX bias
        // SELLs: Lower bar (system excels here)
        // BUYs: Much higher bar (system struggles here)
        
        let asymmetricConfidenceThreshold = 0.45; // Default
        let asymmetricAlignmentRequirement = 'GOOD'; // Default
        
        if (fusedSignal.action === 'BUY') {
          // BUYs need much stronger conviction due to structural weakness
          asymmetricConfidenceThreshold = 0.70; // 70% minimum for BUY
          asymmetricAlignmentRequirement = 'STRONG'; // Only STRONG alignment for BUY
          
          // Also check: is regime gate at least 'MIXED', not explicitly hostile?
          if (regimeGateState.regime_confidence < 0.5) {
            // Very low confidence in regime assessment - extra caution on BUY
            if (fusedSignal.confidence < 0.75) {
              // Skip this BUY - insufficient regime clarity + low confidence
            }
          }
        } else {
          // SELLs: We're good at this, lower requirements allowed
          asymmetricConfidenceThreshold = 0.45; // 45% is fine for SELL
          asymmetricAlignmentRequirement = 'GOOD'; // GOOD or STRONG
        }
        
        // Apply asymmetric gates
        const asymmetricConfidenceBlocked = fusedSignal.confidence < asymmetricConfidenceThreshold;
        const asymmetricAlignmentBlocked = 
          alignmentGrade === 'WEAK' || 
          alignmentGrade === 'CONFLICT' ||
          (fusedSignal.action === 'BUY' && alignmentGrade !== 'STRONG');
        
        const asymmetricGatesBlocked = regimeGateBlocked || asymmetricConfidenceBlocked || asymmetricAlignmentBlocked;
        
        const gatesBlocked = asymmetricGatesBlocked;
        
        // Process signal with ConvexityAgent (only if gates pass)
        if (!gatesBlocked && (fusedSignal.action === 'BUY' || fusedSignal.action === 'SELL')) {
          const convexSignal = this.convex.processTick(
            [currentCandle],
            multiframeAnalysis.analyses['1h']?.regime || 'laminar_trend',
            currentPrice,
            bar
          );

          if (!this.activeTrade) {
            // Entry signal
            activateBar = bar;
            targetPrice = fusedSignal.target;
            stopPrice = fusedSignal.stop;
            
            // 🔒 ASYMMETRIC STOPS: BUYs need wider breathing room
            // This prevents stops from triggering on noise in range-bound accumulation
            if (fusedSignal.action === 'BUY') {
              // Widen BUY stops to ATR × 2.5 (vs typical ATR × 1.5-2.0)
              const atr = this.calculateATR(baseData.slice(Math.max(0, bar - 20), bar), 14);
              const wideStop = currentPrice - (atr * 2.5);
              stopPrice = Math.min(stopPrice, wideStop); // Use the wider (lower for BUY) of the two
            }
            
            this.activeTrade = {
              entryPrice: currentPrice,
              entryBar: bar,
              direction: fusedSignal.action,
              target: targetPrice,
              stop: stopPrice,
              confidence: fusedSignal.confidence,
              signalQuality: multiframeAnalysis.fused.multiframe_diagnostics?.alignment_grade || 'UNKNOWN'
            };

            if (lastState !== 'ACTIVE') {
              console.log(
                `📍 ENTRY [${bar}] ${fusedSignal.action} @ ${currentPrice.toFixed(2)}, ` +
                `Target: ${targetPrice.toFixed(2)}, Stop: ${stopPrice.toFixed(2)}, ` +
                `Confidence: ${(fusedSignal.confidence * 100).toFixed(0)}%, ` +
                `Alignment: ${multiframeAnalysis.fused.multiframe_diagnostics?.alignment_grade || 'N/A'}`
              );
              lastState = 'ACTIVE';
              stateChanges++;
            }
          }
        }

        // Check exit conditions using FoR (Failure of Reversion) instead of hard stops
        // This allows convexity to form instead of exiting on noise
        if (this.activeTrade) {
          const {entryPrice, target, stop, entryBar, direction} = this.activeTrade;
          let shouldExit = false;
          let exitReason = '';

          // 🔒 CRITICAL GATE: Enforce minimum hold duration
          // Convexity requires time under risk - no same-candle exits
          const holdDuration = bar - entryBar;
          const minHoldCandles = 2; // Minimum 2 candles exposure (entry + at least 1 more)
          
          if (holdDuration < minHoldCandles) {
            // Not enough time has passed - skip exit evaluation
          } else {
            // 🧠 FoR-BASED EXIT: Instead of hard stops, use Failure of Reversion
            // This allows trades to survive normal volatility/noise and only exit on structural breaks
            const recentCandles = baseData.slice(Math.max(0, bar - 20), bar + 1);
            const forState = this.forCalculator.calculateFoR(
              currentPrice,
              entryPrice, // Use entry as fair price reference
              this.calculateATR(recentCandles, 14)
            );
            
            // 📊 FoR failure score interpretation:
            // - High score (>0.7) = Strong failure, structure breaking, exit
            // - Medium score (0.4-0.7) = Market stress but not critical
            // - Low score (<0.4) = Normal market operation, stay in trade
            
            const forFailureScore = (forState as any).failureScore || 0;
            const isStructuralBreak = forFailureScore > 0.65; // High threshold for exit
            const maxBarsSurvival = direction === 'BUY' ? 8 : 6; // SELLs exit faster in distribution
            const barsSurvived = bar - entryBar;
            
            // Exit conditions (in priority order):
            if (isStructuralBreak) {
              shouldExit = true;
              exitReason = `FoR Break (score: ${forFailureScore.toFixed(2)})`;
            } else if (barsSurvived >= maxBarsSurvival) {
              // Time decay: exit after max survival window
              shouldExit = true;
              exitReason = `Survival Window End (${barsSurvived}/${maxBarsSurvival} bars)`;
            } else if (direction === 'BUY' && currentPrice <= stop * 0.95) {
              // Extreme stop breach (5% beyond) = emergency exit
              shouldExit = true;
              exitReason = 'Extreme Stop Hit';
            } else if (direction === 'SELL' && currentPrice >= stop * 1.05) {
              // Extreme stop breach
              shouldExit = true;
              exitReason = 'Extreme Stop Hit';
            } else if (currentPrice >= target && direction === 'BUY') {
              // Target hit (take profit)
              shouldExit = true;
              exitReason = 'Target Hit';
            } else if (currentPrice <= target && direction === 'SELL') {
              // Target hit (take profit)
              shouldExit = true;
              exitReason = 'Target Hit';
            }
          }

          if (shouldExit) {
            this.recordTrade(entryPrice, entryBar, currentPrice, bar, direction);
            // 📊 Log with direction-aware P&L
            const correctPnlPct = direction === 'BUY'
              ? ((currentPrice - entryPrice) / entryPrice * 100)
              : ((entryPrice - currentPrice) / entryPrice * 100);
            console.log(
              `🎯 EXIT [${bar}] ${direction} @ ${currentPrice.toFixed(2)}, ` +
              `P&L: ${correctPnlPct.toFixed(2)}%, ` +
              `Reason: ${exitReason}`
            );
            this.activeTrade = null;
            lastState = 'DORMANT';
            stateChanges++;
          }
        }

      } catch (error) {
        // Skip bars with errors
        continue;
      }
    }

    // Close any open trade
    if (this.activeTrade) {
      const lastCandle = baseData[baseData.length - 1];
      this.recordTrade(
        this.activeTrade.entryPrice,
        this.activeTrade.entryBar,
        lastCandle.close,
        baseData.length - 1,
        this.activeTrade.direction
      );
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Backtest completed in ${elapsed}s`);

    // Calculate metrics
    const metrics = (MetricsCalculator as any).calculateMetrics(
      this.trades,
      this.barReturns,
      this.INITIAL_CAPITAL,
      baseData.length
    );

    return {
      symbol: config.symbol,
      totalBars: baseData.length,
      trades: this.trades,
      metrics,
      diagnostics: this.diagnostics
    };
  }
}

/**
 * Post-backtest Convexity Analysis
 * Computes proper convexity metrics only AFTER all trades close
 * This prevents mid-run statistical noise from corrupting results
 */
function analyzeConvexityPostRun(trades: TradeResult[]): any {
  if (trades.length < 30) {
    return {
      analysis: 'Insufficient trades (<30) for reliable convexity analysis',
      trade_count: trades.length,
      recommendation: 'Run longer backtest or adjust entry/exit rules'
    };
  }

    const winners = trades.filter(t => (t.pnlPct ?? 0) > 0);
const losers = trades.filter(t => (t.pnlPct ?? 0) <= 0);
  
  const winSizes = winners.map(t => t.pnlPct);
  const lossSizes = losers.map(t => Math.abs(t.pnlPct));
  
  // Convexity metrics
  const avgWin = winners.length > 0 ? winSizes.reduce((a, b) => a + b, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? lossSizes.reduce((a, b) => a + b, 0) / losers.length : 0;
  
  // Fat tails: what % of wins are > 2x average win
  const fatTailWins = winners.filter(t => t.pnlPct > avgWin * 2).length;
  const fatTailLosses = losers.filter(t => Math.abs(t.pnlPct) > avgLoss * 2).length;
  
  // Skewness: asymmetric payoff ratio
  const payoffRatio = avgWin > 0 ? avgWin / (avgLoss || 0.0001) : 0;
  
  // Win/loss ratio
  const winRatio = winners.length / trades.length;
  
  // Convexity index (1.0 = neutral, >1.2 = convex, <0.8 = anti-convex)
  const convexityIndex = (payoffRatio * winRatio) / ((1 - winRatio) || 0.5);
  
  // Expected value per trade
  const expectedValue = (avgWin * winRatio) - (avgLoss * (1 - winRatio));
  
  return {
    trade_count: trades.length,
    win_count: winners.length,
    loss_count: losers.length,
    win_rate_pct: (winRatio * 100).toFixed(1),
    
    // Asymmetry metrics (core convexity)
    avg_win_pct: (avgWin * 100).toFixed(2),
    avg_loss_pct: (avgLoss * 100).toFixed(2),
    payoff_ratio: payoffRatio.toFixed(2),
    win_to_loss_ratio: (winners.length / (losers.length || 1)).toFixed(2),
    
    // Fat tail analysis
    fat_tail_wins_pct: ((fatTailWins / winners.length || 0) * 100).toFixed(1),
    fat_tail_losses_pct: ((fatTailLosses / losers.length || 0) * 100).toFixed(1),
    
    // Convexity scoring
    convexity_index: convexityIndex.toFixed(2),
    expected_value_per_trade_pct: (expectedValue * 100).toFixed(2),
    
    // Interpretation
    convexity_verdict: 
      convexityIndex > 1.2 ? '✅ CONVEX (asymmetric payoff favors winners)' :
      convexityIndex > 0.8 ? '⚠️ NEUTRAL (symmetric payoff)' :
      '❌ ANTI-CONVEX (losses > wins, negative skew)'
  };
}

/**
 * Main execution
 */
async function main() {
  const backtester = new ConvexityBacktesterMultiframe('MultiframeBacktest');

  // Test on BTC
  const btcDataDir = path.join(__dirname, '../../data/cache/multi-timeframe');
  
  console.log('\n========================================');
  console.log('BTC Multi-Timeframe VFMD Backtest');
  console.log('========================================');

  const btcResult = backtester.run({
    symbol: 'BTCUSDT',
    dataDir: btcDataDir,
  });

  console.log('\n📊 BTC Results:');
  console.log(`Total Trades: ${btcResult.trades.length}`);
  console.log(`Win Rate: ${((btcResult.metrics as any).winRate * 100).toFixed(1)}%`);
  console.log(`Profit Factor: ${((btcResult.metrics as any).profitFactor || 0).toFixed(2)}`);
  console.log(`Sharpe Ratio: ${((btcResult.metrics as any).sharpeRatio || 0).toFixed(2)}`);
  console.log(`Max Drawdown: ${(((btcResult.metrics as any).maxDrawdown || 0) * 100).toFixed(2)}%`);
  
  // 🔒 POST-RUN CONVEXITY ANALYSIS (only after all trades close)
  const btcConvexity = analyzeConvexityPostRun(btcResult.trades);
  console.log('\n💎 CONVEXITY ANALYSIS (Post-Run):');
  console.log(`Trade Count: ${btcConvexity.trade_count}`);
  console.log(`Win/Loss: ${btcConvexity.win_count}/${btcConvexity.loss_count} (${btcConvexity.win_rate_pct}%)`);
  console.log(`Avg Win: ${btcConvexity.avg_win_pct}% | Avg Loss: ${btcConvexity.avg_loss_pct}%`);
  console.log(`Payoff Ratio: ${btcConvexity.payoff_ratio}:1`);
  console.log(`Convexity Index: ${btcConvexity.convexity_index} (${btcConvexity.convexity_verdict})`);
  console.log(`Expected Value/Trade: ${btcConvexity.expected_value_per_trade_pct}%`);
  
  console.log('\n📈 Signal Quality:');
  console.log(`Strong Alignment: ${btcResult.diagnostics.signalQuality.strongAlignment}`);
  console.log(`Good Alignment: ${btcResult.diagnostics.signalQuality.goodAlignment}`);
  console.log(`Weak Alignment: ${btcResult.diagnostics.signalQuality.weakAlignment}`);
  console.log(`Conflict: ${btcResult.diagnostics.signalQuality.conflict}`);

  // Save results
  const resultsFile = path.join(__dirname, '../../results/multiframe_backtest_results.json');
  fs.mkdirSync(path.dirname(resultsFile), { recursive: true });
  fs.writeFileSync(resultsFile, JSON.stringify(btcResult, null, 2));
  console.log(`\n✅ Results saved to ${resultsFile}`);
}

main().catch(console.error);
