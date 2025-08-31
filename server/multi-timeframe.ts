import { Signal, InsertSignal } from '@shared/schema';
// Use local MarketFrame interface for compatibility with trading-engine
import type { MarketFrame } from './trading-engine';
import { SignalEngine, TechnicalIndicators } from './trading-engine';
import { storage } from './storage';

export interface EMACross {
  timestamp: number;
  direction: 'GOLDEN' | 'DEATH'; // Golden cross (fast > slow), Death cross (fast < slow)
  fastPeriod: number;
  slowPeriod: number;
  price: number;
  strength: number; // How decisive the cross was
  barsAgo: number; // How many bars ago the cross occurred
}

export interface MomentumIndicators {
  rsi: number;
  rsiDivergence: 'BULLISH' | 'BEARISH' | 'NONE';
  macd: {
    macd: number;
    signal: number;
    histogram: number;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    divergence: 'BULLISH' | 'BEARISH' | 'NONE';
  };
  stochastic: {
    k: number;
    d: number;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    overbought: boolean;
    oversold: boolean;
  };
}

export interface VolumeAnalysis {
  avgVolume: number;
  currentVolume: number;
  volumeRatio: number; // current / average
  volumeTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
  volumeConfirmation: boolean; // Does volume confirm price action?
  onBalanceVolume: number;
  obvTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface MarketStructure {
  higherHighs: number;
  lowerLows: number;
  structureTrend: 'BULLISH' | 'BEARISH' | 'RANGING';
  keyLevels: {
    breakout: number | null;
    breakdown: number | null;
  };
  trendStrength: number;
}

export interface EnhancedTimeframeAnalysis {
  timeframe: string;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: number;
  support: number[];
  resistance: number[];
  signals: Signal[];
  
  // Enhanced EMA Analysis
  emaAnalysis: {
    ema5_13: EMACross | null;
    ema9_21: EMACross | null;
    ema12_26: EMACross | null;
    currentAlignment: 'BULLISH' | 'BEARISH' | 'MIXED' | 'NEUTRAL';
    alignmentStrength: number;
  };
  
  // Technical Indicators
  momentum: MomentumIndicators;
  volume: VolumeAnalysis;
  structure: MarketStructure;
  
  // Quality Score
  qualityScore: number; // 0-1, how reliable this timeframe analysis is
  lastUpdated: number;
}

export interface EnhancedMultiTimeframeSignal extends Signal {
  timeframeAnalysis: EnhancedTimeframeAnalysis[];
  overallTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confluenceScore: number;
  
  // Enhanced metrics
  momentumConfluence: number;
  volumeConfluence: number;
  structureConfluence: number;
  emaConfluence: number;
  
  // Risk metrics
  maxDrawdownRisk: number;
  probabilityOfSuccess: number;
  riskRewardRatio: number;
  
  // Market context
  marketPhase: 'TRENDING' | 'RANGING' | 'VOLATILE' | 'CONSOLIDATING';
  volatility: number;
  
  // Validation
  backtestMetrics?: {
    winRate: number;
    avgReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
}

export class EnhancedMultiTimeframeAnalyzer {
  private readonly timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
  private readonly signalEngine: SignalEngine;
  private readonly minDataPoints = {
    '1m': 200,
    '5m': 150,
    '15m': 100,
    '1h': 100,
    '4h': 80,
    '1d': 50
  };
  
  private readonly timeframeWeights = {
    '1m': 0.05,
    '5m': 0.08,
    '15m': 0.12,
    '1h': 0.20,
    '4h': 0.35,
    '1d': 0.20
  };
  
  constructor(signalEngine: SignalEngine) {
    this.signalEngine = signalEngine;
  }
  
  async analyzeMultiTimeframe(symbol: string): Promise<EnhancedMultiTimeframeSignal | null> {
    try {
      const analyses: EnhancedTimeframeAnalysis[] = [];
      
      // Analyze each timeframe in parallel for better performance
      const analysisPromises = this.timeframes.map(async (timeframe) => {
        try {
          const frames = await this.getFramesForTimeframe(symbol, timeframe);
          const minPoints = this.minDataPoints[timeframe as keyof typeof this.minDataPoints];
          
          if (frames.length < minPoints) {
            console.warn(`Insufficient data for ${symbol} ${timeframe}: ${frames.length}/${minPoints}`);
            return null;
          }
          
          return await this.analyzeTimeframe(frames, timeframe);
        } catch (error) {
          console.error(`Error analyzing timeframe ${timeframe} for ${symbol}:`, error);
          return null;
        }
      });
      
      const results = await Promise.all(analysisPromises);
      analyses.push(...results.filter((result): result is EnhancedTimeframeAnalysis => result !== null));
      
      if (analyses.length < 3) {
        console.warn(`Insufficient timeframe data for ${symbol}: only ${analyses.length} timeframes available`);
        return null;
      }
      
      // Generate enhanced confluence signal
      return await this.generateEnhancedConfluenceSignal(symbol, analyses);
    } catch (error) {
      console.error(`Error in multi-timeframe analysis for ${symbol}:`, error);
      return null;
    }
  }
  
  private async getFramesForTimeframe(symbol: string, timeframe: string): Promise<MarketFrame[]> {
    // In production, this would interface with your data provider
    // For now, simulating different timeframes by sampling intervals
    const allFrames = await storage.getMarketFrames(symbol, 1000);
    
    if (!allFrames || allFrames.length === 0) {
      throw new Error(`No market data available for ${symbol}`);
    }
    
    const intervalMap: Record<string, number> = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '1h': 60,
      '4h': 240,
      '1d': 1440
    };
    
    const interval = intervalMap[timeframe];
    if (!interval) {
      throw new Error(`Unsupported timeframe: ${timeframe}`);
    }
    
    // Sample frames at the specified interval
    const sampledFrames = allFrames
      .filter((_, index) => index % interval === 0)
      .slice(-500); // Keep last 500 data points
    
    // Ensure frames are sorted by timestamp
  return sampledFrames.map(f => ({
    symbol: typeof f.symbol === 'string' ? f.symbol : '',
    id: typeof f.id === 'string' ? f.id : '',
    timestamp: typeof f.timestamp === 'string' ? new Date(f.timestamp) : (f.timestamp instanceof Date ? f.timestamp : new Date()),
    price: (typeof f.price === 'object' && f.price !== null && typeof (f.price as any).open === 'number' && typeof (f.price as any).high === 'number' && typeof (f.price as any).low === 'number' && typeof (f.price as any).close === 'number')
      ? {
          open: Number((f.price as any).open ?? 0),
          high: Number((f.price as any).high ?? 0),
          low: Number((f.price as any).low ?? 0),
          close: Number((f.price as any).close ?? 0)
        }
      : { open: 0, high: 0, low: 0, close: 0 },
    volume: typeof f.volume === 'number' ? f.volume : 0,
    indicators: {
      rsi: Number((f.indicators as any)?.rsi ?? 0),
      macd: (f.indicators as any)?.macd ?? { macd: 0, signal: 0, histogram: 0 },
      bb: (f.indicators as any)?.bb ?? { upper: 0, middle: 0, lower: 0 },
      ema20: Number((f.indicators as any)?.ema20 ?? 0),
      ema50: Number((f.indicators as any)?.ema50 ?? 0),
      ema200: Number((f.indicators as any)?.ema200 ?? 0),
      multiEMA: (f.indicators as any)?.multiEMA ?? {},
      stoch_k: Number((f.indicators as any)?.stoch_k ?? 0),
      stoch_d: Number((f.indicators as any)?.stoch_d ?? 0),
      adx: Number((f.indicators as any)?.adx ?? 0),
      vwap: Number((f.indicators as any)?.vwap ?? 0),
      atr: Number((f.indicators as any)?.atr ?? 0),
      momentumShort: Number((f.indicators as any)?.momentumShort ?? 0),
      momentumLong: Number((f.indicators as any)?.momentumLong ?? 0),
      bbPos: Number((f.indicators as any)?.bbPos ?? 0),
      volumeRatio: Number((f.indicators as any)?.volumeRatio ?? 0),
      mom7d: Number((f.indicators as any)?.mom7d ?? 0),
      mom30d: Number((f.indicators as any)?.mom30d ?? 0),
      ichimoku_bullish: Boolean((f.indicators as any)?.ichimoku_bullish ?? false)
    },
    orderFlow: {
      bidVolume: Number((f.orderFlow as any)?.bidVolume ?? 0),
      askVolume: Number((f.orderFlow as any)?.askVolume ?? 0),
      netFlow: Number((f.orderFlow as any)?.netFlow ?? 0),
      largeOrders: Number((f.orderFlow as any)?.largeOrders ?? 0),
      smallOrders: Number((f.orderFlow as any)?.smallOrders ?? 0)
    },
    marketMicrostructure: {
      spread: Number((f.marketMicrostructure as any)?.spread ?? 0),
      depth: Number((f.marketMicrostructure as any)?.depth ?? 0),
      imbalance: Number((f.marketMicrostructure as any)?.imbalance ?? 0),
      toxicity: Number((f.marketMicrostructure as any)?.toxicity ?? 0)
    }
  })).sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  }
  
  private async analyzeTimeframe(frames: MarketFrame[], timeframe: string): Promise<EnhancedTimeframeAnalysis | null> {
    if (frames.length < 50) return null;
    
  const prices = frames.map(f => (f.price as { open: number; high: number; low: number; close: number }).close);
  const highs = frames.map(f => (f.price as { open: number; high: number; low: number; close: number }).high);
  const lows = frames.map(f => (f.price as { open: number; high: number; low: number; close: number }).low);
    const volumes = frames.map(f => f.volume || 0);
    
    try {
      // Enhanced EMA Analysis
      const emaAnalysis = this.analyzeEMACrosses(frames);
      
      // Momentum Analysis
      const momentum = this.analyzeMomentum(frames);
      
      // Volume Analysis
      const volume = this.analyzeVolume(frames);
      
      // Market Structure Analysis
      const structure = this.analyzeMarketStructure(frames);
      
      // Traditional trend analysis (enhanced)
      const trendAnalysis = this.analyzeTrend(frames);
      
      // Support/Resistance with enhanced algorithm
      const { support, resistance } = this.findEnhancedSupportResistance(frames);
      
      // Generate signals for this timeframe
      const signals: Signal[] = [];
      if (frames.length > 50) {
        const properlyTypedFrames: MarketFrame[] = frames.map(f => ({
          symbol: typeof f.symbol === 'string' ? f.symbol : '',
          id: typeof f.id === 'string' ? f.id : '',
          timestamp: f.timestamp instanceof Date ? f.timestamp : new Date(f.timestamp),
          price: ((f.price as { open?: number; high?: number; low?: number; close?: number }) && typeof (f.price as any).open === 'number' && typeof (f.price as any).high === 'number' && typeof (f.price as any).low === 'number' && typeof (f.price as any).close === 'number')
            ? {
                open: Number((f.price as any).open ?? 0),
                high: Number((f.price as any).high ?? 0),
                low: Number((f.price as any).low ?? 0),
                close: Number((f.price as any).close ?? 0)
              }
            : { open: 0, high: 0, low: 0, close: 0 },
          volume: typeof f.volume === 'number' ? f.volume : 0,
          indicators: {
            rsi: Number((f.indicators as any)?.rsi ?? 0),
            macd: (f.indicators as any)?.macd ?? { macd: 0, signal: 0, histogram: 0 },
            bb: (f.indicators as any)?.bb ?? { upper: 0, middle: 0, lower: 0 },
            ema20: Number((f.indicators as any)?.ema20 ?? 0),
            ema50: Number((f.indicators as any)?.ema50 ?? 0),
            ema200: Number((f.indicators as any)?.ema200 ?? 0),
            multiEMA: (f.indicators as any)?.multiEMA ?? {},
            stoch_k: Number((f.indicators as any)?.stoch_k ?? 0),
            stoch_d: Number((f.indicators as any)?.stoch_d ?? 0),
            adx: Number((f.indicators as any)?.adx ?? 0),
            vwap: Number((f.indicators as any)?.vwap ?? 0),
            atr: Number((f.indicators as any)?.atr ?? 0),
            momentumShort: Number((f.indicators as any)?.momentumShort ?? 0),
            momentumLong: Number((f.indicators as any)?.momentumLong ?? 0),
            bbPos: Number((f.indicators as any)?.bbPos ?? 0),
            volumeRatio: Number((f.indicators as any)?.volumeRatio ?? 0),
            mom7d: Number((f.indicators as any)?.mom7d ?? 0),
            mom30d: Number((f.indicators as any)?.mom30d ?? 0),
            ichimoku_bullish: Boolean((f.indicators as any)?.ichimoku_bullish ?? false)
          },
          orderFlow: {
            bidVolume: Number((f.orderFlow as any)?.bidVolume ?? 0),
            askVolume: Number((f.orderFlow as any)?.askVolume ?? 0),
            netFlow: Number((f.orderFlow as any)?.netFlow ?? 0),
            largeOrders: Number((f.orderFlow as any)?.largeOrders ?? 0),
            smallOrders: Number((f.orderFlow as any)?.smallOrders ?? 0)
          },
          marketMicrostructure: {
            spread: Number((f.marketMicrostructure as any)?.spread ?? 0),
            depth: Number((f.marketMicrostructure as any)?.depth ?? 0),
            imbalance: Number((f.marketMicrostructure as any)?.imbalance ?? 0),
            toxicity: Number((f.marketMicrostructure as any)?.toxicity ?? 0)
          }
        }));
        const signal = await this.signalEngine.generateSignal(properlyTypedFrames, properlyTypedFrames.length - 1);
        if (signal) signals.push(signal as Signal);
      }
      
      // Calculate quality score
      const qualityScore = this.calculateQualityScore({
        dataPoints: frames.length,
        volumeData: volumes.some(v => v > 0),
        emaConfidence: emaAnalysis.alignmentStrength,
        momentumReliability: this.calculateMomentumReliability(momentum),
        structureClarity: structure.trendStrength
      });
      
      return {
        timeframe,
        trend: trendAnalysis.trend,
        strength: trendAnalysis.strength,
        support,
        resistance,
        signals,
        emaAnalysis,
        momentum,
        volume,
        structure,
        qualityScore,
        lastUpdated: Date.now()
      };
    } catch (error) {
      console.error(`Error analyzing timeframe ${timeframe}:`, error);
      return null;
    }
  }
  
  private analyzeEMACrosses(frames: MarketFrame[]): EnhancedTimeframeAnalysis['emaAnalysis'] {
  const prices = frames.map(f => (f.price as { open: number; high: number; low: number; close: number }).close);
    
    // Calculate EMAs
    const ema5 = TechnicalIndicators.calculateEMA(prices, 5);
    const ema13 = TechnicalIndicators.calculateEMA(prices, 13);
    const ema9 = TechnicalIndicators.calculateEMA(prices, 9);
    const ema21 = TechnicalIndicators.calculateEMA(prices, 21);
    const ema12 = TechnicalIndicators.calculateEMA(prices, 12);
    const ema26 = TechnicalIndicators.calculateEMA(prices, 26);
    
    // Find recent crosses
    const ema5_13 = this.findEMACross(ema5, ema13, frames, 5, 13);
    const ema9_21 = this.findEMACross(ema9, ema21, frames, 9, 21);
    const ema12_26 = this.findEMACross(ema12, ema26, frames, 12, 26);
    
    // Determine current alignment
    const currentIdx = prices.length - 1;
    const currentAlignment = this.determineEMAAlignment(
      ema5[currentIdx], ema9[currentIdx], ema12[currentIdx],
      ema13[currentIdx], ema21[currentIdx], ema26[currentIdx]
    );
    
    // Calculate alignment strength
    const alignmentStrength = this.calculateAlignmentStrength([
      { fast: ema5[currentIdx], slow: ema13[currentIdx] },
      { fast: ema9[currentIdx], slow: ema21[currentIdx] },
      { fast: ema12[currentIdx], slow: ema26[currentIdx] }
    ]);
    
    return {
      ema5_13,
      ema9_21,
      ema12_26,
      currentAlignment,
      alignmentStrength
    };
  }
  
  private findEMACross(fastEMA: number[], slowEMA: number[], frames: MarketFrame[], fastPeriod: number, slowPeriod: number): EMACross | null {
    if (fastEMA.length < 2 || slowEMA.length < 2) return null;
    
    // Look for crosses in the last 20 bars
    const lookback = Math.min(20, fastEMA.length - 1);
    
    for (let i = fastEMA.length - 1; i >= fastEMA.length - lookback; i--) {
      if (i === 0) continue;
      
      const currentFast = fastEMA[i];
      const currentSlow = slowEMA[i];
      const prevFast = fastEMA[i - 1];
      const prevSlow = slowEMA[i - 1];
      
      // Check for golden cross (fast crosses above slow)
      if (prevFast <= prevSlow && currentFast > currentSlow) {
        let ts = frames[i].timestamp;
        let tsNum = typeof ts === 'string' ? new Date(ts).getTime() : (ts instanceof Date ? ts.getTime() : Number(ts));
        return {
          timestamp: tsNum,
          direction: 'GOLDEN',
          fastPeriod,
          slowPeriod,
          price: (frames[i].price as { open: number; high: number; low: number; close: number }).close,
          strength: Math.abs(currentFast - currentSlow) / currentSlow,
          barsAgo: fastEMA.length - 1 - i
        };
      }
      
      // Check for death cross (fast crosses below slow)
      if (prevFast >= prevSlow && currentFast < currentSlow) {
        let ts = frames[i].timestamp;
        let tsNum = typeof ts === 'string' ? new Date(ts).getTime() : (ts instanceof Date ? ts.getTime() : Number(ts));
        return {
          timestamp: tsNum,
          direction: 'DEATH',
          fastPeriod,
          slowPeriod,
          price: (frames[i].price as { open: number; high: number; low: number; close: number }).close,
          strength: Math.abs(currentSlow - currentFast) / currentSlow,
          barsAgo: fastEMA.length - 1 - i
        };
      }
    }
    
    return null;
  }
  
  private determineEMAAlignment(ema5: number, ema9: number, ema12: number, ema13: number, ema21: number, ema26: number): 'BULLISH' | 'BEARISH' | 'MIXED' | 'NEUTRAL' {
    const fastEMAs = [ema5, ema9, ema12];
    const slowEMAs = [ema13, ema21, ema26];
    
    let bullishCount = 0;
    let bearishCount = 0;
    
    // Check each fast vs slow pair
    fastEMAs.forEach(fast => {
      slowEMAs.forEach(slow => {
        if (fast > slow) bullishCount++;
        else if (fast < slow) bearishCount++;
      });
    });
    
    const total = bullishCount + bearishCount;
    if (total === 0) return 'NEUTRAL';
    
    const bullishRatio = bullishCount / total;
    
    if (bullishRatio >= 0.8) return 'BULLISH';
    if (bullishRatio <= 0.2) return 'BEARISH';
    if (bullishRatio >= 0.4 && bullishRatio <= 0.6) return 'NEUTRAL';
    return 'MIXED';
  }
  
  private calculateAlignmentStrength(pairs: Array<{ fast: number; slow: number }>): number {
    let totalSeparation = 0;
    let count = 0;
    
    pairs.forEach(({ fast, slow }) => {
      if (fast > 0 && slow > 0) {
        totalSeparation += Math.abs(fast - slow) / slow;
        count++;
      }
    });
    
    return count > 0 ? Math.min(1, totalSeparation / count * 10) : 0;
  }
  
  private analyzeMomentum(frames: MarketFrame[]): MomentumIndicators {
  const prices = frames.map(f => (f.price as { open: number; high: number; low: number; close: number }).close);
  const highs = frames.map(f => (f.price as { open: number; high: number; low: number; close: number }).high);
  const lows = frames.map(f => (f.price as { open: number; high: number; low: number; close: number }).low);
    
    // RSI Analysis
    const rsi = TechnicalIndicators.calculateRSI(prices, 14);
  const currentRSI = Array.isArray(rsi) ? rsi[rsi.length - 1] : rsi;
  const rsiDivergence = this.detectRSIDivergence(prices, Array.isArray(rsi) ? rsi : [rsi]);
    
    // MACD Analysis
    const macdData = TechnicalIndicators.calculateMACD(prices);
    const macdArr = Array.isArray(macdData) ? macdData : [macdData];
    const currentMACD = macdArr[macdArr.length - 1];
  const macdArrMapped = macdArr.map(m => ({ macd: m.macd, signal: m.signal, histogram: m.histogram }));
    const macdTrend = this.determineMACDTrend(macdArrMapped);
    const macdDivergence = this.detectMACDDivergence(prices, macdArrMapped);
    
    // Stochastic Analysis
    const stochData = TechnicalIndicators.calculateStochastic(highs, lows, prices, 14, 3);
  const currentStoch = Array.isArray(stochData) ? stochData[stochData.length - 1] : stochData;
  const stochTrend = this.determineStochasticTrend(Array.isArray(stochData) ? stochData : [stochData]);
    
    return {
      rsi: currentRSI,
      rsiDivergence,
      macd: {
        macd: currentMACD.macd,
        signal: currentMACD.signal,
        histogram: currentMACD.histogram,
        trend: macdTrend,
        divergence: macdDivergence
      },
      stochastic: {
        k: currentStoch.k,
        d: currentStoch.d,
        trend: stochTrend,
        overbought: currentStoch.k > 80,
        oversold: currentStoch.k < 20
      }
    };
  }
  
  private analyzeVolume(frames: MarketFrame[]): VolumeAnalysis {
    const volumes = frames.map(f => f.volume || 0);
  const prices = frames.map(f => (f.price as { open: number; high: number; low: number; close: number }).close);
    
    if (volumes.every(v => v === 0)) {
      // No volume data available
      return {
        avgVolume: 0,
        currentVolume: 0,
        volumeRatio: 1,
        volumeTrend: 'STABLE',
        volumeConfirmation: true, // Assume confirmation when no volume data
        onBalanceVolume: 0,
        obvTrend: 'NEUTRAL'
      };
    }
    
    const avgVolume = volumes.slice(-20).reduce((sum, v) => sum + v, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
    
    // Volume trend
    const recentAvg = volumes.slice(-5).reduce((sum, v) => sum + v, 0) / 5;
    const olderAvg = volumes.slice(-15, -5).reduce((sum, v) => sum + v, 0) / 10;
    const volumeTrend = recentAvg > olderAvg * 1.2 ? 'INCREASING' : 
                       recentAvg < olderAvg * 0.8 ? 'DECREASING' : 'STABLE';
    
    // On-Balance Volume
    const obv = this.calculateOBV(prices, volumes);
    const obvTrend = this.determineOBVTrend(obv);
    
    // Volume confirmation (simplified)
    const priceChange = prices[prices.length - 1] - prices[prices.length - 2];
    const volumeConfirmation = (priceChange > 0 && volumeRatio > 1.1) || 
                              (priceChange < 0 && volumeRatio > 1.1) ||
                              Math.abs(priceChange) < 0.001;
    
    return {
      avgVolume,
      currentVolume,
      volumeRatio,
      volumeTrend,
      volumeConfirmation,
      onBalanceVolume: obv[obv.length - 1],
      obvTrend
    };
  }
  
  private analyzeMarketStructure(frames: MarketFrame[]): MarketStructure {
  const highs = frames.map(f => (f.price as { open: number; high: number; low: number; close: number }).high);
  const lows = frames.map(f => (f.price as { open: number; high: number; low: number; close: number }).low);
    
    // Find pivot highs and lows
    const pivotHighs = this.findPivotPoints(highs, 'high');
    const pivotLows = this.findPivotPoints(lows, 'low');
    
    // Count higher highs and lower lows
    let higherHighs = 0;
    let lowerLows = 0;
    
    for (let i = 1; i < pivotHighs.length; i++) {
      if (pivotHighs[i].value > pivotHighs[i - 1].value) higherHighs++;
    }
    
    for (let i = 1; i < pivotLows.length; i++) {
      if (pivotLows[i].value < pivotLows[i - 1].value) lowerLows++;
    }
    
    // Determine structure trend
    let structureTrend: 'BULLISH' | 'BEARISH' | 'RANGING' = 'RANGING';
    if (higherHighs > lowerLows + 1) structureTrend = 'BULLISH';
    else if (lowerLows > higherHighs + 1) structureTrend = 'BEARISH';
    
    // Find potential breakout/breakdown levels
    const recentHigh = Math.max(...highs.slice(-20));
    const recentLow = Math.min(...lows.slice(-20));
    
    return {
      higherHighs,
      lowerLows,
      structureTrend,
      keyLevels: {
        breakout: recentHigh,
        breakdown: recentLow
      },
      trendStrength: Math.abs(higherHighs - lowerLows) / Math.max(higherHighs + lowerLows, 1)
    };
  }
  
  private analyzeTrend(frames: MarketFrame[]): { trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; strength: number } {
  const prices = frames.map(f => (f.price as { open: number; high: number; low: number; close: number }).close);
    
    // Multiple EMA trend confirmation
    const ema20 = TechnicalIndicators.calculateEMA(prices, 20);
    const ema50 = TechnicalIndicators.calculateEMA(prices, 50);
    const ema200 = TechnicalIndicators.calculateEMA(prices, Math.min(200, prices.length));
    
    const currentPrice = prices[prices.length - 1];
    const currentEma20 = ema20[ema20.length - 1];
    const currentEma50 = ema50[ema50.length - 1];
    const currentEma200 = ema200[ema200.length - 1];
    
    // Enhanced trend determination with slope analysis
    const ema20Slope = this.calculateSlope(ema20.slice(-10));
    const ema50Slope = this.calculateSlope(ema50.slice(-10));
    
    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let strength = 0;
    
    // Strong bullish conditions
    if (currentPrice > currentEma20 && 
        currentEma20 > currentEma50 && 
        currentEma50 > currentEma200 &&
        ema20Slope > 0 && ema50Slope > 0) {
      trend = 'BULLISH';
      strength = Math.min(1.0, (currentPrice - currentEma200) / currentEma200 * 10 + 
                              Math.abs(ema20Slope) + Math.abs(ema50Slope));
    }
    // Strong bearish conditions
    else if (currentPrice < currentEma20 && 
             currentEma20 < currentEma50 && 
             currentEma50 < currentEma200 &&
             ema20Slope < 0 && ema50Slope < 0) {
      trend = 'BEARISH';
      strength = Math.min(1.0, (currentEma200 - currentPrice) / currentEma200 * 10 + 
                              Math.abs(ema20Slope) + Math.abs(ema50Slope));
    }
    // Weak or mixed signals
    else {
      strength = 0.3;
    }
    
    return { trend, strength };
  }
  
  private findEnhancedSupportResistance(frames: MarketFrame[]): { support: number[]; resistance: number[] } {
  const highs = frames.map(f => (f.price as { open: number; high: number; low: number; close: number }).high);
  const lows = frames.map(f => (f.price as { open: number; high: number; low: number; close: number }).low);
    const volumes = frames.map(f => f.volume || 1);
    
    const support: Array<{ level: number; strength: number }> = [];
    const resistance: Array<{ level: number; strength: number }> = [];
    
    const lookback = 8; // Increased lookback for better pivot detection
    
    for (let i = lookback; i < frames.length - lookback; i++) {
      // Enhanced resistance detection with volume weighting
      let isResistance = true;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && highs[j] >= highs[i]) {
          isResistance = false;
          break;
        }
      }
      
      if (isResistance) {
        const volumeWeight = volumes[i] / Math.max(...volumes.slice(i - lookback, i + lookback + 1));
        const strength = volumeWeight * (1 + (frames.length - i) / frames.length); // Recent levels more important
        resistance.push({ level: highs[i], strength });
      }
      
      // Enhanced support detection with volume weighting
      let isSupport = true;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && lows[j] <= lows[i]) {
          isSupport = false;
          break;
        }
      }
      
      if (isSupport) {
        const volumeWeight = volumes[i] / Math.max(...volumes.slice(i - lookback, i + lookback + 1));
        const strength = volumeWeight * (1 + (frames.length - i) / frames.length);
        support.push({ level: lows[i], strength });
      }
    }
    
    // Sort by strength and take top levels
    support.sort((a, b) => b.strength - a.strength);
    resistance.sort((a, b) => b.strength - a.strength);
    
    return {
      support: support.slice(0, 5).map(s => s.level),
      resistance: resistance.slice(0, 5).map(r => r.level)
    };
  }
  
  private calculateQualityScore(factors: {
    dataPoints: number;
    volumeData: boolean;
    emaConfidence: number;
    momentumReliability: number;
    structureClarity: number;
  }): number {
    const dataQuality = Math.min(1, factors.dataPoints / 200); // Prefer more data
    const volumeBonus = factors.volumeData ? 0.1 : 0;
    
    return Math.min(1, 
      dataQuality * 0.3 +
      factors.emaConfidence * 0.25 +
      factors.momentumReliability * 0.25 +
      factors.structureClarity * 0.2 +
      volumeBonus
    );
  }
  
  private calculateMomentumReliability(momentum: MomentumIndicators): number {
    let reliability = 0.5; // Base reliability
    
    // RSI reliability
    if (momentum.rsi > 30 && momentum.rsi < 70) reliability += 0.1;
    if (momentum.rsiDivergence !== 'NONE') reliability += 0.1;
    
    // MACD reliability
    if (Math.abs(momentum.macd.histogram) > 0.1) reliability += 0.1;
    if (momentum.macd.divergence !== 'NONE') reliability += 0.1;
    
    // Stochastic reliability
    if (!momentum.stochastic.overbought && !momentum.stochastic.oversold) reliability += 0.1;
    
    return Math.min(1, reliability);
  }
  
  private async generateEnhancedConfluenceSignal(
    symbol: string, 
    analyses: EnhancedTimeframeAnalysis[]
  ): Promise<EnhancedMultiTimeframeSignal | null> {
    if (analyses.length === 0) return null;
    
    try {
      // Calculate weighted confluence scores
      const confluenceMetrics = this.calculateConfluenceMetrics(analyses);
      
      if (confluenceMetrics.overallConfluence < 0.5) {
        console.log(`Low confluence score for ${symbol}: ${confluenceMetrics.overallConfluence}`);
        return null;
      }
      
      // Determine overall market phase and trend
      const marketAnalysis = this.determineMarketPhase(analyses);
      
      // Find the best base signal
      const baseSignal = this.selectBestBaseSignal(analyses);
      if (!baseSignal) return null;
      
      // Calculate enhanced risk metrics
      const riskMetrics = this.calculateRiskMetrics(analyses, baseSignal.price);
      
      // Enhanced signal type determination
      const signalType = this.determineSignalType(confluenceMetrics, marketAnalysis);
      
      if (signalType === 'HOLD') return null; // Don't generate HOLD signals
      
      // Calculate enhanced stop loss and take profit
      const { enhancedStopLoss, enhancedTakeProfit } = this.calculateEnhancedLevels(
        baseSignal.price,
        signalType,
        analyses,
        marketAnalysis.volatility
      );
      
      // Generate comprehensive reasoning
      const reasoning = this.generateEnhancedReasoning(
        confluenceMetrics,
        marketAnalysis,
        analyses
      );
      
      return {
        ...baseSignal,
        type: signalType,
        strength: Math.min(1.0, baseSignal.strength * (1 + confluenceMetrics.overallConfluence)),
        confidence: Math.min(1.0, baseSignal.confidence * (1 + confluenceMetrics.overallConfluence * 0.3)),
        stopLoss: enhancedStopLoss,
        takeProfit: enhancedTakeProfit,
        reasoning,
        
        // Enhanced properties
        timeframeAnalysis: analyses,
        overallTrend: marketAnalysis.overallTrend,
        confluenceScore: confluenceMetrics.overallConfluence,
        momentumConfluence: confluenceMetrics.momentumConfluence,
        volumeConfluence: confluenceMetrics.volumeConfluence,
        structureConfluence: confluenceMetrics.structureConfluence,
        emaConfluence: confluenceMetrics.emaConfluence,
        
        // Risk metrics
        maxDrawdownRisk: riskMetrics.maxDrawdownRisk,
        probabilityOfSuccess: riskMetrics.probabilityOfSuccess,
        riskRewardRatio: riskMetrics.riskRewardRatio,
        
        // Market context
        marketPhase: marketAnalysis.marketPhase,
        volatility: marketAnalysis.volatility,
        
        // Future: backtesting integration point
        backtestMetrics: undefined
      };
    } catch (error) {
      console.error(`Error generating confluence signal for ${symbol}:`, error);
      return null;
    }
  }
  
  private calculateConfluenceMetrics(analyses: EnhancedTimeframeAnalysis[]): {
    overallConfluence: number;
    momentumConfluence: number;
    volumeConfluence: number;
    structureConfluence: number;
    emaConfluence: number;
  } {
    let weightedTrendScore = 0;
    let weightedMomentumScore = 0;
    let weightedVolumeScore = 0;
    let weightedStructureScore = 0;
    let weightedEmaScore = 0;
    let totalWeight = 0;
    
    for (const analysis of analyses) {
      const weight = this.timeframeWeights[analysis.timeframe as keyof typeof this.timeframeWeights] || 0.1;
      const qualityWeight = weight * analysis.qualityScore;
      
      totalWeight += qualityWeight;
      
      // Trend confluence
      const trendScore = analysis.trend === 'BULLISH' ? analysis.strength : 
                        analysis.trend === 'BEARISH' ? -analysis.strength : 0;
      weightedTrendScore += trendScore * qualityWeight;
      
      // Momentum confluence
      const momentumScore = this.calculateMomentumScore(analysis.momentum);
      weightedMomentumScore += momentumScore * qualityWeight;
      
      // Volume confluence
      const volumeScore = this.calculateVolumeScore(analysis.volume);
      weightedVolumeScore += volumeScore * qualityWeight;
      
      // Structure confluence
      const structureScore = this.calculateStructureScore(analysis.structure);
      weightedStructureScore += structureScore * qualityWeight;
      
      // EMA confluence
      const emaScore = this.calculateEMAScore(analysis.emaAnalysis);
      weightedEmaScore += emaScore * qualityWeight;
    }
    
    if (totalWeight === 0) {
      return {
        overallConfluence: 0,
        momentumConfluence: 0,
        volumeConfluence: 0,
        structureConfluence: 0,
        emaConfluence: 0
      };
    }
    
    const avgTrendScore = weightedTrendScore / totalWeight;
    const avgMomentumScore = weightedMomentumScore / totalWeight;
    const avgVolumeScore = weightedVolumeScore / totalWeight;
    const avgStructureScore = weightedStructureScore / totalWeight;
    const avgEmaScore = weightedEmaScore / totalWeight;
    
    // Overall confluence combines all factors
    const overallConfluence = Math.abs(
      avgTrendScore * 0.3 +
      avgMomentumScore * 0.2 +
      avgVolumeScore * 0.15 +
      avgStructureScore * 0.2 +
      avgEmaScore * 0.15
    );
    
    return {
      overallConfluence: Math.min(1, overallConfluence),
      momentumConfluence: Math.min(1, Math.abs(avgMomentumScore)),
      volumeConfluence: Math.min(1, Math.abs(avgVolumeScore)),
      structureConfluence: Math.min(1, Math.abs(avgStructureScore)),
      emaConfluence: Math.min(1, Math.abs(avgEmaScore))
    };
  }
  
  private calculateMomentumScore(momentum: MomentumIndicators): number {
    let score = 0;
    
    // RSI scoring
    if (momentum.rsi > 50) score += 0.3;
    else if (momentum.rsi < 50) score -= 0.3;
    
    if (momentum.rsiDivergence === 'BULLISH') score += 0.2;
    else if (momentum.rsiDivergence === 'BEARISH') score -= 0.2;
    
    // MACD scoring
    if (momentum.macd.trend === 'BULLISH') score += 0.3;
    else if (momentum.macd.trend === 'BEARISH') score -= 0.3;
    
    if (momentum.macd.divergence === 'BULLISH') score += 0.2;
    else if (momentum.macd.divergence === 'BEARISH') score -= 0.2;
    
    // Stochastic scoring
    if (momentum.stochastic.trend === 'BULLISH' && !momentum.stochastic.overbought) score += 0.2;
    else if (momentum.stochastic.trend === 'BEARISH' && !momentum.stochastic.oversold) score -= 0.2;
    
    return Math.max(-1, Math.min(1, score));
  }
  
  private calculateVolumeScore(volume: VolumeAnalysis): number {
    let score = 0;
    
    // Volume confirmation
    if (volume.volumeConfirmation) score += 0.3;
    
    // Volume trend
    if (volume.volumeTrend === 'INCREASING') score += 0.2;
    else if (volume.volumeTrend === 'DECREASING') score -= 0.1;
    
    // Volume ratio
    if (volume.volumeRatio > 1.5) score += 0.3;
    else if (volume.volumeRatio < 0.7) score -= 0.2;
    
    // OBV trend
    if (volume.obvTrend === 'BULLISH') score += 0.2;
    else if (volume.obvTrend === 'BEARISH') score -= 0.2;
    
    return Math.max(-1, Math.min(1, score));
  }
  
  private calculateStructureScore(structure: MarketStructure): number {
    let score = 0;
    
    // Structure trend
    if (structure.structureTrend === 'BULLISH') score += 0.5;
    else if (structure.structureTrend === 'BEARISH') score -= 0.5;
    
    // Trend strength
    score += structure.trendStrength * 0.3 * (structure.structureTrend === 'BULLISH' ? 1 : -1);
    
    // Higher highs vs lower lows
    const hhLlRatio = structure.higherHighs - structure.lowerLows;
    score += Math.max(-0.2, Math.min(0.2, hhLlRatio * 0.1));
    
    return Math.max(-1, Math.min(1, score));
  }
  
  private calculateEMAScore(emaAnalysis: EnhancedTimeframeAnalysis['emaAnalysis']): number {
    let score = 0;
    
    // Current alignment
    if (emaAnalysis.currentAlignment === 'BULLISH') score += 0.4;
    else if (emaAnalysis.currentAlignment === 'BEARISH') score -= 0.4;
    else if (emaAnalysis.currentAlignment === 'MIXED') score += 0.1;
    
    // Alignment strength
    score += emaAnalysis.alignmentStrength * 0.3 * (emaAnalysis.currentAlignment === 'BULLISH' ? 1 : -1);
    
    // Recent crosses
    const recentCrosses = [emaAnalysis.ema5_13, emaAnalysis.ema9_21, emaAnalysis.ema12_26].filter(cross => 
      cross && cross.barsAgo <= 5
    );
    
    for (const cross of recentCrosses) {
  if (cross && cross.direction === 'GOLDEN') score += 0.15;
  else if (cross && cross.direction === 'DEATH') score -= 0.15;
    }
    
    return Math.max(-1, Math.min(1, score));
  }
  
  private determineMarketPhase(analyses: EnhancedTimeframeAnalysis[]): {
    overallTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    marketPhase: 'TRENDING' | 'RANGING' | 'VOLATILE' | 'CONSOLIDATING';
    volatility: number;
  } {
    // Calculate trend agreement
    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;
    let totalVolatility = 0;
    let rangingCount = 0;
    
    for (const analysis of analyses) {
      const weight = this.timeframeWeights[analysis.timeframe as keyof typeof this.timeframeWeights] || 0.1;
      
      if (analysis.trend === 'BULLISH') bullishCount += weight;
      else if (analysis.trend === 'BEARISH') bearishCount += weight;
      else neutralCount += weight;
      
      // Volatility proxy from trend strength variations
      totalVolatility += analysis.strength;
      
      // Ranging detection
      if (analysis.structure.structureTrend === 'RANGING') rangingCount += weight;
    }
    
    const total = bullishCount + bearishCount + neutralCount;
    const avgVolatility = totalVolatility / analyses.length;
    
    // Determine overall trend
    let overallTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (bullishCount / total > 0.6) overallTrend = 'BULLISH';
    else if (bearishCount / total > 0.6) overallTrend = 'BEARISH';
    
    // Determine market phase
    let marketPhase: 'TRENDING' | 'RANGING' | 'VOLATILE' | 'CONSOLIDATING' = 'CONSOLIDATING';
    
    if (rangingCount > 0.5) {
      marketPhase = 'RANGING';
    } else if (avgVolatility > 0.7) {
      marketPhase = 'VOLATILE';
    } else if ((bullishCount > 0.6 || bearishCount > 0.6) && avgVolatility > 0.4) {
      marketPhase = 'TRENDING';
    }
    
    return {
      overallTrend,
      marketPhase,
      volatility: Math.min(1, avgVolatility)
    };
  }
  
  private selectBestBaseSignal(analyses: EnhancedTimeframeAnalysis[]): Signal | null {
    // Prioritize signals from higher timeframes with better quality scores
    const priorityTimeframes = ['1d', '4h', '1h', '15m', '5m', '1m'];
    
    for (const timeframe of priorityTimeframes) {
      const analysis = analyses.find(a => a.timeframe === timeframe);
      if (analysis && analysis.signals.length > 0 && analysis.qualityScore > 0.6) {
        return analysis.signals[0];
      }
    }
    
    // Fallback to any available signal with decent quality
    for (const analysis of analyses) {
      if (analysis.signals.length > 0 && analysis.qualityScore > 0.4) {
        return analysis.signals[0];
      }
    }
    
    return null;
  }
  
  private calculateRiskMetrics(analyses: EnhancedTimeframeAnalysis[], currentPrice: number): {
    maxDrawdownRisk: number;
    probabilityOfSuccess: number;
    riskRewardRatio: number;
  } {
    // Calculate risk based on volatility and structure analysis
    const avgVolatility = analyses.reduce((sum, a) => sum + a.strength, 0) / analyses.length;
    const structureRisk = analyses.filter(a => a.structure.structureTrend === 'RANGING').length / analyses.length;
    
    // Max drawdown risk estimation
    const maxDrawdownRisk = Math.min(0.2, avgVolatility * 0.3 + structureRisk * 0.1);
    
    // Probability of success based on confluence and quality
    const avgQuality = analyses.reduce((sum, a) => sum + a.qualityScore, 0) / analyses.length;
    const trendAlignment = analyses.filter(a => a.trend !== 'NEUTRAL').length / analyses.length;
    const probabilityOfSuccess = Math.min(0.95, 0.5 + avgQuality * 0.3 + trendAlignment * 0.15);
    
    // Risk-reward ratio estimation
    const supportResistanceSpread = this.calculateSRSpread(analyses, currentPrice);
    const riskRewardRatio = Math.max(1, Math.min(5, supportResistanceSpread / maxDrawdownRisk));
    
    return {
      maxDrawdownRisk,
      probabilityOfSuccess,
      riskRewardRatio
    };
  }
  
  private calculateSRSpread(analyses: EnhancedTimeframeAnalysis[], currentPrice: number): number {
    const allSupport = analyses.flatMap(a => a.support).filter(s => s < currentPrice);
    const allResistance = analyses.flatMap(a => a.resistance).filter(r => r > currentPrice);
    
    const nearestSupport = Math.max(...allSupport.filter(s => s > 0));
    const nearestResistance = Math.min(...allResistance.filter(r => r < Infinity));
    
    if (nearestSupport > 0 && nearestResistance < Infinity) {
      return (nearestResistance - nearestSupport) / currentPrice;
    }
    
    return 0.05; // Default spread
  }
  
  private determineSignalType(
    confluenceMetrics: ReturnType<typeof EnhancedMultiTimeframeAnalyzer.prototype.calculateConfluenceMetrics>,
    marketAnalysis: ReturnType<typeof EnhancedMultiTimeframeAnalyzer.prototype.determineMarketPhase>
  ): 'BUY' | 'SELL' | 'HOLD' {
    // Don't trade in highly volatile or ranging markets unless confluence is very strong
    if ((marketAnalysis.marketPhase === 'VOLATILE' || marketAnalysis.marketPhase === 'RANGING') && 
        confluenceMetrics.overallConfluence < 0.7) {
      return 'HOLD';
    }
    
    // Strong confluence required for signals
    if (confluenceMetrics.overallConfluence < 0.5) {
      return 'HOLD';
    }
    
    // Direction based on overall trend and confluence
    if (marketAnalysis.overallTrend === 'BULLISH' && 
        confluenceMetrics.emaConfluence > 0.4 && 
        confluenceMetrics.momentumConfluence > 0.3) {
      return 'BUY';
    }
    
    if (marketAnalysis.overallTrend === 'BEARISH' && 
        confluenceMetrics.emaConfluence < -0.4 && 
        confluenceMetrics.momentumConfluence < -0.3) {
      return 'SELL';
    }
    
    return 'HOLD';
  }
  
  private calculateEnhancedLevels(
    price: number, 
    signalType: string, 
    analyses: EnhancedTimeframeAnalysis[],
    volatility: number
  ): { enhancedStopLoss: number; enhancedTakeProfit: number } {
    // Collect all support and resistance levels with weights
    const weightedSupport: Array<{ level: number; weight: number }> = [];
    const weightedResistance: Array<{ level: number; weight: number }> = [];
    
    for (const analysis of analyses) {
      const weight = this.timeframeWeights[analysis.timeframe as keyof typeof this.timeframeWeights] || 0.1;
      
      analysis.support.forEach(level => {
        if (level > 0 && level < price * 0.99) {
          weightedSupport.push({ level, weight: weight * analysis.qualityScore });
        }
      });
      
      analysis.resistance.forEach(level => {
        if (level > price * 1.01) {
          weightedResistance.push({ level, weight: weight * analysis.qualityScore });
        }
      });
    }
    
    // Sort by weight and proximity to current price
    weightedSupport.sort((a, b) => (b.weight * (1 - Math.abs(a.level - price) / price)) - 
                                   (a.weight * (1 - Math.abs(b.level - price) / price)));
    weightedResistance.sort((a, b) => (b.weight * (1 - Math.abs(a.level - price) / price)) - 
                                      (a.weight * (1 - Math.abs(b.level - price) / price)));
    
    let enhancedStopLoss = price;
    let enhancedTakeProfit = price;
    
    // Dynamic stop loss and take profit based on volatility
    const volatilityMultiplier = 1 + volatility * 0.5;
    const baseStopDistance = price * 0.02 * volatilityMultiplier; // 2% base, adjusted for volatility
    const baseTakeDistance = price * 0.04 * volatilityMultiplier; // 4% base, adjusted for volatility
    
    if (signalType === 'BUY') {
      // Stop loss: nearest significant support or volatility-based
      if (weightedSupport.length > 0) {
        const supportLevel = weightedSupport[0].level;
        const supportDistance = price - supportLevel;
        enhancedStopLoss = supportDistance > baseStopDistance ? supportLevel : price - baseStopDistance;
      } else {
        enhancedStopLoss = price - baseStopDistance;
      }
      
      // Take profit: nearest significant resistance or risk-reward based
      if (weightedResistance.length > 0) {
        const resistanceLevel = weightedResistance[0].level;
        const minTakeProfit = price + (price - enhancedStopLoss) * 2; // 1:2 risk-reward minimum
        enhancedTakeProfit = Math.max(resistanceLevel, minTakeProfit);
      } else {
        enhancedTakeProfit = price + (price - enhancedStopLoss) * 3; // 1:3 risk-reward
      }
    } else if (signalType === 'SELL') {
      // Stop loss: nearest significant resistance or volatility-based
      if (weightedResistance.length > 0) {
        const resistanceLevel = weightedResistance[0].level;
        const resistanceDistance = resistanceLevel - price;
        enhancedStopLoss = resistanceDistance > baseStopDistance ? resistanceLevel : price + baseStopDistance;
      } else {
        enhancedStopLoss = price + baseStopDistance;
      }
      
      // Take profit: nearest significant support or risk-reward based
      if (weightedSupport.length > 0) {
        const supportLevel = weightedSupport[0].level;
        const minTakeProfit = price - (enhancedStopLoss - price) * 2; // 1:2 risk-reward minimum
        enhancedTakeProfit = Math.min(supportLevel, minTakeProfit);
      } else {
        enhancedTakeProfit = price - (enhancedStopLoss - price) * 3; // 1:3 risk-reward
      }
    }
    
    return { enhancedStopLoss, enhancedTakeProfit };
  }
  
  private generateEnhancedReasoning(
    confluenceMetrics: ReturnType<typeof EnhancedMultiTimeframeAnalyzer.prototype.calculateConfluenceMetrics>,
    marketAnalysis: ReturnType<typeof EnhancedMultiTimeframeAnalyzer.prototype.determineMarketPhase>,
    analyses: EnhancedTimeframeAnalysis[]
  ): string[] {
    const reasoning: string[] = [];
    
    // Overall confluence
    reasoning.push(`Multi-timeframe confluence: ${(confluenceMetrics.overallConfluence * 100).toFixed(1)}%`);
    reasoning.push(`Overall trend: ${marketAnalysis.overallTrend} (${marketAnalysis.marketPhase} market)`);
    
    // EMA confluence
    if (confluenceMetrics.emaConfluence > 0.4) {
      reasoning.push(`Strong bullish EMA alignment across timeframes (${(confluenceMetrics.emaConfluence * 100).toFixed(1)}%)`);
    } else if (confluenceMetrics.emaConfluence < -0.4) {
      reasoning.push(`Strong bearish EMA alignment across timeframes (${(Math.abs(confluenceMetrics.emaConfluence) * 100).toFixed(1)}%)`);
    }
    
    // Recent EMA crosses
    const recentCrosses = analyses.flatMap(a => [a.emaAnalysis.ema5_13, a.emaAnalysis.ema9_21, a.emaAnalysis.ema12_26])
      .filter((cross): cross is EMACross => cross !== null && cross.barsAgo <= 3);
    
    if (recentCrosses.length > 0) {
      const goldenCrosses = recentCrosses.filter(c => c.direction === 'GOLDEN').length;
      const deathCrosses = recentCrosses.filter(c => c.direction === 'DEATH').length;
      
      if (goldenCrosses > deathCrosses) {
        reasoning.push(`Recent bullish EMA crosses detected (${goldenCrosses} golden vs ${deathCrosses} death crosses)`);
      } else if (deathCrosses > goldenCrosses) {
        reasoning.push(`Recent bearish EMA crosses detected (${deathCrosses} death vs ${goldenCrosses} golden crosses)`);
      }
    }
    
    // Momentum confluence
    if (confluenceMetrics.momentumConfluence > 0.4) {
      reasoning.push(`Bullish momentum indicators aligned (${(confluenceMetrics.momentumConfluence * 100).toFixed(1)}%)`);
    } else if (confluenceMetrics.momentumConfluence < -0.4) {
      reasoning.push(`Bearish momentum indicators aligned (${(Math.abs(confluenceMetrics.momentumConfluence) * 100).toFixed(1)}%)`);
    }
    
    // Volume confirmation
    if (confluenceMetrics.volumeConfluence > 0.3) {
      reasoning.push(`Volume confirms price action (${(confluenceMetrics.volumeConfluence * 100).toFixed(1)}%)`);
    }
    
    // Structure analysis
    if (confluenceMetrics.structureConfluence > 0.4) {
      reasoning.push(`Bullish market structure across timeframes (${(confluenceMetrics.structureConfluence * 100).toFixed(1)}%)`);
    } else if (confluenceMetrics.structureConfluence < -0.4) {
      reasoning.push(`Bearish market structure across timeframes (${(Math.abs(confluenceMetrics.structureConfluence) * 100).toFixed(1)}%)`);
    }
    
    // Quality metrics
    const avgQuality = analyses.reduce((sum, a) => sum + a.qualityScore, 0) / analyses.length;
    reasoning.push(`Average analysis quality: ${(avgQuality * 100).toFixed(1)}%`);
    
    // Timeframe participation
    const alignedTimeframes = analyses.filter(a => a.trend === marketAnalysis.overallTrend).length;
    reasoning.push(`Timeframes aligned: ${alignedTimeframes}/${analyses.length}`);
    
    return reasoning;
  }
  
  // Utility methods
  private detectRSIDivergence(prices: number[], rsi: number[]): 'BULLISH' | 'BEARISH' | 'NONE' {
    if (prices.length < 20 || rsi.length < 20) return 'NONE';
    
    // Simplified divergence detection - look for price vs RSI direction differences
    const priceChange = prices[prices.length - 1] - prices[prices.length - 10];
    const rsiChange = rsi[rsi.length - 1] - rsi[rsi.length - 10];
    
    if (priceChange > 0 && rsiChange < -5) return 'BEARISH'; // Price up, RSI down
    if (priceChange < 0 && rsiChange > 5) return 'BULLISH';  // Price down, RSI up
    
    return 'NONE';
  }
  
  private determineMACDTrend(macdData: Array<{ macd: number; signal: number; histogram: number }>): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (macdData.length < 3) return 'NEUTRAL';
    
    const current = macdData[macdData.length - 1];
    const previous = macdData[macdData.length - 2];
    
    if (current.macd > current.signal && current.histogram > previous.histogram) return 'BULLISH';
    if (current.macd < current.signal && current.histogram < previous.histogram) return 'BEARISH';
    
    return 'NEUTRAL';
  }
  
  private detectMACDDivergence(prices: number[], macdData: Array<{ macd: number; signal: number; histogram: number }>): 'BULLISH' | 'BEARISH' | 'NONE' {
    if (prices.length < 20 || macdData.length < 20) return 'NONE';
    
    const priceChange = prices[prices.length - 1] - prices[prices.length - 10];
    const macdChange = macdData[macdData.length - 1].macd - macdData[macdData.length - 10].macd;
    
    if (priceChange > 0 && macdChange < -0.1) return 'BEARISH';
    if (priceChange < 0 && macdChange > 0.1) return 'BULLISH';
    
    return 'NONE';
  }
  
  private determineStochasticTrend(stochData: Array<{ k: number; d: number }>): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (stochData.length < 3) return 'NEUTRAL';
    
    const current = stochData[stochData.length - 1];
    const previous = stochData[stochData.length - 2];
    
    if (current.k > current.d && current.k > previous.k) return 'BULLISH';
    if (current.k < current.d && current.k < previous.k) return 'BEARISH';
    
    return 'NEUTRAL';
  }
  
  private calculateOBV(prices: number[], volumes: number[]): number[] {
    const obv: number[] = [0];
    
    for (let i = 1; i < prices.length; i++) {
      const volume = volumes[i] || 0;
      
      if (prices[i] > prices[i - 1]) {
        obv[i] = obv[i - 1] + volume;
      } else if (prices[i] < prices[i - 1]) {
        obv[i] = obv[i - 1] - volume;
      } else {
        obv[i] = obv[i - 1];
      }
    }
    
    return obv;
  }
  
  private determineOBVTrend(obv: number[]): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (obv.length < 10) return 'NEUTRAL';
    
    const recentOBV = obv.slice(-5).reduce((sum, v) => sum + v, 0) / 5;
    const olderOBV = obv.slice(-15, -5).reduce((sum, v) => sum + v, 0) / 10;
    
    if (recentOBV > olderOBV * 1.05) return 'BULLISH';
    if (recentOBV < olderOBV * 0.95) return 'BEARISH';
    
    return 'NEUTRAL';
  }
  
  private findPivotPoints(values: number[], type: 'high' | 'low'): Array<{ index: number; value: number }> {
    const pivots: Array<{ index: number; value: number }> = [];
    const lookback = 5;
    
    for (let i = lookback; i < values.length - lookback; i++) {
      let isPivot = true;
      
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i) {
          if (type === 'high' && values[j] >= values[i]) {
            isPivot = false;
            break;
          }
          if (type === 'low' && values[j] <= values[i]) {
            isPivot = false;
            break;
          }
        }
      }
      
      if (isPivot) {
        pivots.push({ index: i, value: values[i] });
      }
    }
    
    return pivots;
  }
  
  private calculateSlope(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, idx) => sum + val * idx, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }
  
  // Public getters for configuration
  getTimeframeWeights(): Record<string, number> {
    return { ...this.timeframeWeights };
  }
  
  getMinDataPoints(): Record<string, number> {
    return { ...this.minDataPoints };
  }
  
  getSupportedTimeframes(): string[] {
    return [...this.timeframes];
  }
  
  // Performance monitoring
  async getAnalysisPerformance(): Promise<{
    cacheHitRate: number;
    avgProcessingTime: number;
    errorRate: number;
  }> {
    // In production, this would return actual performance metrics
    return {
      cacheHitRate: 0.85,
      avgProcessingTime: 150, // milliseconds
      errorRate: 0.02
    };
  }
  
  // Health check method
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    lastUpdate: number;
  }> {
    const issues: string[] = [];
    
    try {
      // Test data connectivity
      const testFrames = await storage.getMarketFrames('TEST', 10);
      if (!testFrames || testFrames.length === 0) {
        issues.push('No market data available');
      }
      
      // Test signal engine
      if (!this.signalEngine) {
        issues.push('Signal engine not initialized');
      }
      
      // Check timeframe configuration
      if (this.timeframes.length === 0) {
        issues.push('No timeframes configured');
      }
      
    } catch (error) {
      issues.push(`Health check error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    const status = issues.length === 0 ? 'healthy' : 
                   issues.length <= 2 ? 'degraded' : 'unhealthy';
    
    return {
      status,
      issues,
      lastUpdate: Date.now()
    };
  }
  
  // Configuration validation
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate timeframes
    const validTimeframes = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w'];
    const invalidTimeframes = this.timeframes.filter(tf => !validTimeframes.includes(tf));
    if (invalidTimeframes.length > 0) {
      errors.push(`Invalid timeframes: ${invalidTimeframes.join(', ')}`);
    }
    
    // Validate weights sum to approximately 1
    const totalWeight = Object.values(this.timeframeWeights).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.1) {
      errors.push(`Timeframe weights should sum to ~1.0, current sum: ${totalWeight.toFixed(3)}`);
    }
    
    // Validate minimum data points
    const minDataValues = Object.values(this.minDataPoints);
    if (minDataValues.some(min => min < 20)) {
      errors.push('Minimum data points should be at least 20 for reliable analysis');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Extended Technical Indicators for enhanced analysis
export class ExtendedTechnicalIndicators extends TechnicalIndicators {
  // Override Bollinger Bands to match base class signature
  static calculateBollingerBands(
    prices: number[],
    period: number = 20,
    stdDev: number = 2
  ) {
    if (prices.length < period) {
      const price = prices[prices.length - 1] || 0;
      return { upper: price * 1.02, middle: price, lower: price * 0.98 };
    }
    const recentPrices = prices.slice(-period);
    const sma = recentPrices.reduce((sum, price) => sum + price, 0) / period;
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const std = Math.sqrt(variance);
    return {
      upper: sma + (std * stdDev),
      middle: sma,
      lower: sma - (std * stdDev)
    };
  }
  
  static calculateStochasticArray(
    highs: number[], 
    lows: number[], 
    closes: number[], 
    kPeriod: number = 14, 
    dPeriod: number = 3
  ): { k: number; d: number }[] {
    const result: { k: number; d: number }[] = [];
    const kValues: number[] = [];
    for (let i = kPeriod - 1; i < closes.length; i++) {
      const periodHighs = highs.slice(i - kPeriod + 1, i + 1);
      const periodLows = lows.slice(i - kPeriod + 1, i + 1);
      const highestHigh = Math.max(...periodHighs);
      const lowestLow = Math.min(...periodLows);
      const k = lowestLow === highestHigh ? 50 : ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100;
      kValues.push(k);
      if (kValues.length >= dPeriod) {
        const d = kValues.slice(-dPeriod).reduce((sum: number, val: number) => sum + val, 0) / dPeriod;
        result.push({ k, d });
      }
    }
    return result;
  }

  static calculateMACD(
    prices: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): { macd: number; signal: number; histogram: number } {
    if (prices.length < slowPeriod) return { macd: 0, signal: 0, histogram: 0 };
    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);
    const macdLine: number[] = [];
    for (let i = 0; i < Math.min(fastEMA.length, slowEMA.length); i++) {
      macdLine.push(fastEMA[i] - slowEMA[i]);
    }
    const signalLine = this.calculateEMA(macdLine, signalPeriod);
    const lastIdx = Math.min(macdLine.length, signalLine.length) - 1;
    return {
      macd: macdLine[lastIdx] ?? 0,
      signal: signalLine[lastIdx] ?? 0,
      histogram: (macdLine[lastIdx] ?? 0) - (signalLine[lastIdx] ?? 0)
    };
  }

  static calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length <= period) return 0;
    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }
    const rsi: number[] = [];
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < period; i++) {
      if (changes[i] >= 0) {
        avgGain += changes[i];
      } else {
        avgLoss += Math.abs(changes[i]);
      }
    }
    avgGain /= period;
    avgLoss /= period;
    for (let i = period; i < changes.length; i++) {
      const change = changes[i];
      if (change >= 0) {
        avgGain = (avgGain * (period - 1) + change) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
      }
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsiValue = 100 - (100 / (1 + rs));
      rsi.push(rsiValue);
    }
    return rsi.length > 0 ? rsi[rsi.length - 1] : 0;
  }
  
  static calculateATR(
    highs: number[], 
    lows: number[], 
    closes: number[], 
    period: number = 14
  ): number {
    if (highs.length < 2) return 0;
    const trueRanges: number[] = [];
    for (let i = 1; i < highs.length; i++) {
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    const atrArr = this.calculateEMA(trueRanges, period);
    return atrArr.length > 0 ? atrArr[atrArr.length - 1] : 0;
  }
  
  private static calculateSMA(prices: number[], period: number): number[] {
    const result: number[] = [];
    
    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const average = slice.reduce((sum, price) => sum + price, 0) / period;
      result.push(average);
    }
    
    return result;
  }
}

// Backtesting framework for production validation
export class BacktestEngine {
  private analyzer: EnhancedMultiTimeframeAnalyzer;
  constructor(analyzer: EnhancedMultiTimeframeAnalyzer) {
    this.analyzer = analyzer;
  }
  
  async runBacktest(
    symbol: string,
    startDate: number,
    endDate: number,
    initialCapital: number = 10000
  ): Promise<{
    totalReturn: number;
    winRate: number;
    maxDrawdown: number;
    sharpeRatio: number;
    totalTrades: number;
    profitableTrades: number;
    avgTradeReturn: number;
    trades: Array<{
      entry: { price: number; timestamp: number };
      exit: { price: number; timestamp: number };
      type: 'BUY' | 'SELL';
      pnl: number;
      returnPct: number;
    }>;
  }> {
    // This would be implemented with historical data
    // For now, return placeholder metrics
    console.log(`Backtesting ${symbol} from ${new Date(startDate)} to ${new Date(endDate)}`);
    
    return {
      totalReturn: 0.15, // 15% return
      winRate: 0.65,     // 65% win rate
      maxDrawdown: 0.08, // 8% max drawdown
      sharpeRatio: 1.8,  // Sharpe ratio
      totalTrades: 50,
      profitableTrades: 32,
      avgTradeReturn: 0.003, // 0.3% per trade
      trades: []
    };
  }
  
  async validateSignal(signal: EnhancedMultiTimeframeSignal): Promise<{
    historicalAccuracy: number;
    expectedReturn: number;
    riskAssessment: 'LOW' | 'MEDIUM' | 'HIGH';
  }> {
    // In production, this would validate against historical similar signals
    const confluenceScore = signal.confluenceScore;
    
    return {
      historicalAccuracy: Math.min(0.9, 0.5 + confluenceScore * 0.4),
      expectedReturn: confluenceScore * 0.05, // Expected 5% max return based on confluence
      riskAssessment: confluenceScore > 0.7 ? 'LOW' : 
                     confluenceScore > 0.5 ? 'MEDIUM' : 'HIGH'
    };
  }
}

// Production monitoring and alerting
export class AnalyzerMonitor {
  private analyzer: EnhancedMultiTimeframeAnalyzer;
  private performanceMetrics: Map<string, any> = new Map();
  
  constructor(analyzer: EnhancedMultiTimeframeAnalyzer) {
    this.analyzer = analyzer;
  }
  
  startMonitoring(intervalMs: number = 60000): void {
    setInterval(async () => {
      await this.collectMetrics();
      this.checkAlerts();
    }, intervalMs);
  }
  
  private async collectMetrics(): Promise<void> {
    const performance = await this.analyzer.getAnalysisPerformance();
    const health = await this.analyzer.healthCheck();
    
    this.performanceMetrics.set('performance', {
      ...performance,
      timestamp: Date.now()
    });
    
    this.performanceMetrics.set('health', {
      ...health,
      timestamp: Date.now()
    });
  }
  
  private checkAlerts(): void {
    const performance = this.performanceMetrics.get('performance');
    const health = this.performanceMetrics.get('health');
    
    if (performance?.errorRate > 0.05) {
      this.sendAlert('HIGH_ERROR_RATE', `Error rate: ${(performance.errorRate * 100).toFixed(2)}%`);
    }
    
    if (performance?.avgProcessingTime > 5000) {
      this.sendAlert('SLOW_PROCESSING', `Avg processing time: ${performance.avgProcessingTime}ms`);
    }
    
    if (health?.status === 'unhealthy') {
      this.sendAlert('UNHEALTHY_STATUS', `Issues: ${health.issues.join(', ')}`);
    }
  }
  
  private sendAlert(type: string, message: string): void {
    console.error(`[ALERT:${type}] ${message}`);
    // In production, this would integrate with alerting systems (PagerDuty, Slack, etc.)
  }
  
  getMetrics(): Record<string, any> {
    return Object.fromEntries(this.performanceMetrics);
  }
}