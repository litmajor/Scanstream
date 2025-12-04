
import { MarketFrame, Signal } from '@shared/schema';
import { spawn } from 'child_process';
import path from 'path';

export interface StrategyWeight {
  strategyId: string;
  baseWeight: number;
  regimeMultiplier: number;
  volatilityMultiplier: number;
  momentumAlignment: number;
  temporalDecay: number;
  finalWeight: number;
}

export interface MarketRegime {
  type: 'BULL_EARLY' | 'BULL_STRONG' | 'BULL_PARABOLIC' | 'BEAR_EARLY' | 'BEAR_STRONG' | 'BEAR_CAPITULATION' | 'NEUTRAL_ACCUM' | 'NEUTRAL_DIST' | 'NEUTRAL';
  volatility: 'low' | 'medium' | 'high';
  momentum: number; // -1 to 1
  trend: 'up' | 'down' | 'sideways';
}

export interface SynthesizedSignal extends Signal {
  contributingStrategies: Array<{
    strategyId: string;
    weight: number;
    rawSignal: any;
  }>;
  regimeContext: MarketRegime;
  confidenceBreakdown: {
    baseConfidence: number;
    regimeAdjustment: number;
    volatilityAdjustment: number;
    momentumAdjustment: number;
    finalConfidence: number;
  };
}

export class StrategyIntegrationEngine {
  private strategyWeights: Map<string, StrategyWeight> = new Map();
  
  constructor() {
    this.initializeStrategyWeights();
  }

  private initializeStrategyWeights() {
    // Base weights for each strategy
    const baseWeights = {
      'gradient_trend_filter': 0.25,
      'ut_bot': 0.20,
      'mean_reversion': 0.20,
      'volume_profile': 0.20,
      'market_structure': 0.15
    };

    for (const [strategyId, baseWeight] of Object.entries(baseWeights)) {
      this.strategyWeights.set(strategyId, {
        strategyId,
        baseWeight,
        regimeMultiplier: 1.0,
        volatilityMultiplier: 1.0,
        momentumAlignment: 1.0,
        temporalDecay: 1.0,
        finalWeight: baseWeight
      });
    }
  }

  /**
   * Detect current market regime from market data
   */
  detectMarketRegime(frames: MarketFrame[]): MarketRegime {
    if (frames.length < 30) {
      return {
        type: 'NEUTRAL',
        volatility: 'medium',
        momentum: 0,
        trend: 'sideways'
      };
    }

    const latest = frames[frames.length - 1];
    const prices = frames.slice(-30).map(f => (f.price as any).close);
    const volumes = frames.slice(-30).map(f => f.volume);
    
    // Calculate momentum
    const mom1d = (prices[prices.length - 1] - prices[prices.length - 2]) / prices[prices.length - 2];
    const mom7d = (prices[prices.length - 1] - prices[prices.length - 8]) / prices[prices.length - 8];
    const mom30d = (prices[prices.length - 1] - prices[0]) / prices[0];
    
    const avgMomentum = (mom1d + mom7d + mom30d) / 3;
    
    // Calculate volatility
    const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length);
    
    let volLevel: 'low' | 'medium' | 'high' = 'medium';
    if (volatility < 0.02) volLevel = 'low';
    else if (volatility > 0.05) volLevel = 'high';
    
    // Determine regime
    const rsi = (latest.indicators as any).rsi || 50;
    const macd = (latest.indicators as any).macd?.macd || 0;
    
    let regimeType: MarketRegime['type'] = 'NEUTRAL';
    
    if (mom7d > 0.04 && mom30d > 0.08 && rsi > 60) {
      regimeType = 'BULL_STRONG';
    } else if (mom7d > 0.08 && volatility > 0.06) {
      regimeType = 'BULL_PARABOLIC';
    } else if (mom7d > 0.02 && macd > 0) {
      regimeType = 'BULL_EARLY';
    } else if (mom7d < -0.04 && mom30d < -0.08 && rsi < 40) {
      regimeType = 'BEAR_STRONG';
    } else if (mom7d < -0.08 && volatility > 0.06) {
      regimeType = 'BEAR_CAPITULATION';
    } else if (mom7d < -0.02 && macd < 0) {
      regimeType = 'BEAR_EARLY';
    } else if (rsi < 35 && avgMomentum > 0) {
      regimeType = 'NEUTRAL_ACCUM';
    } else if (rsi > 65 && avgMomentum < 0) {
      regimeType = 'NEUTRAL_DIST';
    }
    
    const trend = avgMomentum > 0.02 ? 'up' : avgMomentum < -0.02 ? 'down' : 'sideways';
    
    return {
      type: regimeType,
      volatility: volLevel,
      momentum: avgMomentum,
      trend
    };
  }

  /**
   * Calculate regime-based multipliers for each strategy
   */
  calculateRegimeWeights(regime: MarketRegime): void {
    const regimeMultipliers: Record<string, Record<string, number>> = {
      'gradient_trend_filter': {
        'BULL_STRONG': 1.5,
        'BULL_EARLY': 1.3,
        'BULL_PARABOLIC': 0.8,
        'BEAR_STRONG': 1.5,
        'BEAR_EARLY': 1.3,
        'BEAR_CAPITULATION': 0.8,
        'NEUTRAL': 0.7,
        'NEUTRAL_ACCUM': 0.9,
        'NEUTRAL_DIST': 0.9
      },
      'ut_bot': {
        'BULL_STRONG': 1.4,
        'BULL_EARLY': 1.2,
        'BULL_PARABOLIC': 1.1,
        'BEAR_STRONG': 1.4,
        'BEAR_EARLY': 1.2,
        'BEAR_CAPITULATION': 1.1,
        'NEUTRAL': 0.6,
        'NEUTRAL_ACCUM': 0.8,
        'NEUTRAL_DIST': 0.8
      },
      'mean_reversion': {
        'BULL_PARABOLIC': 1.6,
        'BEAR_CAPITULATION': 1.6,
        'NEUTRAL': 1.4,
        'NEUTRAL_ACCUM': 1.3,
        'NEUTRAL_DIST': 1.3,
        'BULL_STRONG': 0.6,
        'BULL_EARLY': 0.8,
        'BEAR_STRONG': 0.6,
        'BEAR_EARLY': 0.8
      },
      'volume_profile': {
        'BULL_EARLY': 1.5,
        'BEAR_EARLY': 1.5,
        'NEUTRAL_ACCUM': 1.4,
        'NEUTRAL_DIST': 1.4,
        'BULL_STRONG': 1.2,
        'BEAR_STRONG': 1.2,
        'BULL_PARABOLIC': 1.0,
        'BEAR_CAPITULATION': 1.0,
        'NEUTRAL': 1.1
      },
      'market_structure': {
        'BULL_EARLY': 1.6,
        'BEAR_EARLY': 1.6,
        'BULL_STRONG': 1.3,
        'BEAR_STRONG': 1.3,
        'NEUTRAL_ACCUM': 1.2,
        'NEUTRAL_DIST': 1.2,
        'BULL_PARABOLIC': 0.9,
        'BEAR_CAPITULATION': 0.9,
        'NEUTRAL': 1.0
      }
    };

    for (const [strategyId, weight] of this.strategyWeights.entries()) {
      weight.regimeMultiplier = regimeMultipliers[strategyId]?.[regime.type] || 1.0;
    }
  }

  /**
   * Calculate volatility-adjusted multipliers
   */
  calculateVolatilityWeights(regime: MarketRegime): void {
    const volatilityMultipliers: Record<string, Record<string, number>> = {
      'gradient_trend_filter': { low: 0.9, medium: 1.0, high: 1.1 },
      'ut_bot': { low: 0.8, medium: 1.0, high: 1.3 },
      'mean_reversion': { low: 1.2, medium: 1.0, high: 0.7 },
      'volume_profile': { low: 0.9, medium: 1.0, high: 1.2 },
      'market_structure': { low: 1.0, medium: 1.0, high: 1.1 }
    };

    for (const [strategyId, weight] of this.strategyWeights.entries()) {
      weight.volatilityMultiplier = volatilityMultipliers[strategyId]?.[regime.volatility] || 1.0;
    }
  }

  /**
   * Calculate momentum alignment for each strategy
   */
  calculateMomentumAlignment(regime: MarketRegime, strategySignals: Map<string, any>): void {
    for (const [strategyId, weight] of this.strategyWeights.entries()) {
      const signal = strategySignals.get(strategyId);
      if (!signal) {
        weight.momentumAlignment = 0.5;
        continue;
      }

      let alignment = 1.0;
      const signalDirection = signal.signals?.[signal.signals.length - 1] || 'HOLD';
      
      // Bullish strategies in bullish regime
      if ((signalDirection === 'BUY' || signalDirection === 'UP') && regime.momentum > 0) {
        alignment = 1.0 + Math.abs(regime.momentum) * 2;
      }
      // Bearish strategies in bearish regime
      else if ((signalDirection === 'SELL' || signalDirection === 'DOWN') && regime.momentum < 0) {
        alignment = 1.0 + Math.abs(regime.momentum) * 2;
      }
      // Contrarian in extreme conditions
      else if (signalDirection === 'BUY' && regime.type === 'BEAR_CAPITULATION') {
        alignment = 1.3;
      } else if (signalDirection === 'SELL' && regime.type === 'BULL_PARABOLIC') {
        alignment = 1.3;
      }
      // Misaligned
      else {
        alignment = 0.6;
      }

      weight.momentumAlignment = Math.min(2.0, alignment);
    }
  }

  /**
   * Calculate temporal decay for signals
   */
  calculateTemporalDecay(signalAge: number): number {
    // Decay signals older than 5 periods
    const halfLife = 5;
    return Math.exp(-0.693 * signalAge / halfLife);
  }

  /**
   * Update final weights
   */
  updateFinalWeights(): void {
    let totalWeight = 0;
    
    for (const weight of this.strategyWeights.values()) {
      weight.finalWeight = 
        weight.baseWeight *
        weight.regimeMultiplier *
        weight.volatilityMultiplier *
        weight.momentumAlignment *
        weight.temporalDecay;
      totalWeight += weight.finalWeight;
    }

    // Normalize weights to sum to 1
    if (totalWeight > 0) {
      for (const weight of this.strategyWeights.values()) {
        weight.finalWeight /= totalWeight;
      }
    }
  }

  /**
   * Execute strategy with Python
   */
  private async executeStrategy(
    strategyId: string,
    symbol: string,
    timeframe: string,
    params: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(process.cwd(), 'strategies', 'executor.py');
      
      const args = [
        pythonScript,
        '--strategy', strategyId,
        '--symbol', symbol,
        '--timeframe', timeframe,
        '--params', JSON.stringify(params || {})
      ];
      
      // Use python from venv or fallback to python3
      const pythonPath = process.env.VIRTUAL_ENV 
        ? path.join(process.env.VIRTUAL_ENV, process.platform === 'win32' ? 'Scripts\\python.exe' : 'bin/python')
        : 'python3';
      
      const python = spawn(pythonPath, args);
      
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
          reject(new Error(`Strategy ${strategyId} failed: ${errorOutput}`));
        } else {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse strategy output: ${output}`));
          }
        }
      });
    });
  }

  /**
   * Synthesize signals from all strategies
   */
  async synthesizeSignals(
    symbol: string,
    timeframe: string,
    frames: MarketFrame[]
  ): Promise<SynthesizedSignal> {
    // Detect market regime
    const regime = this.detectMarketRegime(frames);
    
    // Calculate smart weights
    this.calculateRegimeWeights(regime);
    this.calculateVolatilityWeights(regime);
    
    // Execute all strategies in parallel
    const strategyPromises = Array.from(this.strategyWeights.keys()).map(async (strategyId) => {
      try {
        const result = await this.executeStrategy(strategyId, symbol, timeframe, {});
        return { strategyId, result };
      } catch (error) {
        console.error(`Strategy ${strategyId} failed:`, error);
        return { strategyId, result: null };
      }
    });
    
    const strategyResults = await Promise.all(strategyPromises);
    const strategySignals = new Map(
      strategyResults
        .filter(r => r.result?.success)
        .map(r => [r.strategyId, r.result])
    );
    
    // Calculate momentum alignment
    this.calculateMomentumAlignment(regime, strategySignals);
    
    // Update final weights
    this.updateFinalWeights();
    
    // Synthesize final signal
    let weightedSignalScore = 0;
    let weightedConfidence = 0;
    let weightedPrice = 0;
    const contributingStrategies: Array<any> = [];
    
    for (const [strategyId, signal] of strategySignals.entries()) {
      const weight = this.strategyWeights.get(strategyId)!;
      
      // Convert signal to numeric score (-1 to 1)
      let signalScore = 0;
      if (signal.signal === 'BUY' || signal.signal === 'UP') signalScore = 1;
      else if (signal.signal === 'SELL' || signal.signal === 'DOWN') signalScore = -1;
      
      weightedSignalScore += signalScore * weight.finalWeight;
      weightedConfidence += (signal.metadata?.confidence || 0.5) * weight.finalWeight;
      weightedPrice += signal.price * weight.finalWeight;
      
      contributingStrategies.push({
        strategyId,
        weight: weight.finalWeight,
        rawSignal: signal
      });
    }
    
    // Determine final signal type
    let signalType: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (weightedSignalScore > 0.3) signalType = 'BUY';
    else if (weightedSignalScore < -0.3) signalType = 'SELL';
    
    // Calculate confidence breakdown
    const baseConfidence = weightedConfidence;
    const regimeAdjustment = regime.type.includes('STRONG') ? 0.15 : 0;
    const volatilityAdjustment = regime.volatility === 'high' ? -0.1 : 0.05;
    const momentumAdjustment = Math.abs(regime.momentum) > 0.05 ? 0.1 : 0;
    const finalConfidence = Math.min(1.0, Math.max(0.1, 
      baseConfidence + regimeAdjustment + volatilityAdjustment + momentumAdjustment
    ));
    
    const latest = frames[frames.length - 1];
    const price = (latest.price as any).close;
    
    // Calculate risk levels
    const atr = (latest.indicators as any).atr || price * 0.02;
    const stopLoss = signalType === 'BUY' ? price - atr * 2 : price + atr * 2;
    const takeProfit = signalType === 'BUY' ? price + atr * 3 : price - atr * 3;
    
    return {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      symbol,
      type: signalType,
      strength: Math.abs(weightedSignalScore),
      confidence: finalConfidence,
      price,
      reasoning: [
        `Regime: ${regime.type}`,
        `Volatility: ${regime.volatility}`,
        `Momentum: ${regime.momentum.toFixed(4)}`,
        `Contributing strategies: ${contributingStrategies.length}`
      ],
      riskReward: Math.abs((takeProfit - price) / (price - stopLoss)),
      stopLoss,
      takeProfit,
      contributingStrategies,
      regimeContext: regime,
      confidenceBreakdown: {
        baseConfidence,
        regimeAdjustment,
        volatilityAdjustment,
        momentumAdjustment,
        finalConfidence
      },
      momentumLabel: null,
      regimeState: null,
      legacyLabel: null,
      signalStrengthScore: null
    };
  }

  /**
   * Get current strategy weights
   */
  getStrategyWeights(): StrategyWeight[] {
    return Array.from(this.strategyWeights.values());
  }
}
