/**
 * Multi-Exchange Parallel Scanner Service
 * 
 * Scans multiple exchanges in parallel and aggregates results:
 * - Parallel scanning (50+ symbols across exchanges)
 * - Per-exchange top assets ranking
 * - Cross-exchange signal analysis
 * - Arbitrage opportunity detection
 * - Result persistence to database
 */

import { MomentumScanner } from './momentum-scanner';
import type { MarketFrame } from './continuous-scanner';
import { ExchangeAggregator } from '../gateway/exchange-aggregator';
import { CacheManager } from '../gateway/cache-manager';
import SignalClassifier from './signal-classifier';
import ArmSignalClassifier from './signal-classifier-arm';
import type { SignalStateContext, ArmEnhancedSignalResult } from './signal-classifier-arm';
import { getRegimeService } from '../regime-service';
import type { RegimeContext as ArmRegimeContext } from '../../arm-evaluator';
import { QualityGating } from './quality-gating';

export interface ScanResult {
  symbol: string;
  exchange: string;
  timestamp: number;
  
  // Signal data
  signal: string;
  signalStrength: number;
  confidence: number;
  armSignal?: string;
  armConfidence?: number;
  
  // Market data
  price: number;
  volume?: number;
  change24h?: number;
  
  // Technical analysis
  regime: string;
  regimeConfidence?: number;
  
  // Market state
  marketState?: string;
  armState?: string;
  
  // Scoring
  compositeScore?: number;
  stateAlignment?: number;

  // === SCANNER SOURCE (LIVE PATTERNS) ===
  // Multi-pattern classifications for consensus engine
  scannerSource?: {
    patterns: string[]; // Multiple patterns detected (e.g., ['BREAKOUT', 'MA_CROSSOVER'])
    primaryPattern: string | null;
    overallConfidence: number; // 0-1
    overallStrength: number; // 0-100
    reasoning: string[];
    patternCount: number;
    technicalScore: number; // 0-100
    volumeRatio: number;
  };

  // === QUALITY GATING ===
  passesQualityGate?: boolean; // Signal meets quality threshold
  qualityGateReason?: string; // Why it passed/failed quality gate
}

export interface ExchangeScanResults {
  exchange: string;
  timestamp: number;
  totalScanned: number;
  successCount: number;
  errorCount: number;
  results: ScanResult[];
  topAssets: ScanResult[];
  avgConfidence: number;
  signalDistribution: {
    strongBuy: number;
    buy: number;
    neutral: number;
    sell: number;
    strongSell: number;
  };
}

export interface MultiExchangeScanResults {
  timestamp: number;
  exchanges: Map<string, ExchangeScanResults>;
  allResults: ScanResult[];
  crossExchangeSignals: CrossExchangeSignal[];
  topAssets: ScanResult[];
}

export interface CrossExchangeSignal {
  symbol: string;
  type: 'CONSENSUS' | 'DIVERGENCE' | 'ARBITRAGE' | 'ACCUMULATION' | 'DISTRIBUTION';
  confidence: number;
  exchanges: string[];
  description: string;
  signals: Map<string, string>;
  avgScore: number;
}

/**
 * Multi-Exchange Scanner
 */
export class MultiExchangeScanner {
  private aggregator: ExchangeAggregator;
  private cache: CacheManager;
  private readonly exchanges = ['binance', 'coinbase', 'kucoinfutures', 'okx', 'bybit'];

  constructor(aggregator: ExchangeAggregator, cache: CacheManager) {
    this.aggregator = aggregator;
    this.cache = cache;
  }

  /**
   * Scan multiple exchanges in parallel
   */
  async scanExchanges(
    symbols: string[],
    exchanges?: string[],
    options?: {
      timeframe?: string;
      limit?: number;
      minVolume?: number;
      topN?: number;
    }
  ): Promise<MultiExchangeScanResults> {
    const timeframe = options?.timeframe || '1h';
    const limit = options?.limit || 100;
    const minVolume = options?.minVolume || 100000;
    const topN = options?.topN || 10;

    const exchangesToScan = exchanges || this.exchanges;
    const timestamp = Date.now();

    // === STEP 1: Parallel exchange scans ===
    const exchangeScanPromises = exchangesToScan.map(exchange =>
      this.scanExchange(symbols, exchange, timeframe, limit, minVolume)
        .then(results => ({ exchange, results }))
        .catch(error => {
          console.error(`[MultiExchangeScanner] Failed to scan ${exchange}:`, error);
          return { exchange, results: { results: [] } };
        })
    );

    const exchangeResults = await Promise.all(exchangeScanPromises);

    // === STEP 2: Aggregate results ===
    const aggregatedResults = new Map<string, ExchangeScanResults>();
    const allResults: ScanResult[] = [];

    for (const { exchange, results } of exchangeResults) {
      aggregatedResults.set(exchange, this.buildExchangeResult(exchange, results, timestamp));
      allResults.push(...results);
    }

    // === STEP 3: Detect cross-exchange signals ===
    const crossExchangeSignals = this.detectCrossExchangeSignals(aggregatedResults, allResults);

    // === STEP 4: Rank top assets ===
    const topAssets = allResults
      .sort((a, b) => (b.compositeScore || b.signalStrength) - (a.compositeScore || a.signalStrength))
      .slice(0, topN);

    return {
      timestamp,
      exchanges: aggregatedResults,
      allResults,
      crossExchangeSignals,
      topAssets
    };
  }

  /**
   * Scan single exchange
   */
  private async scanExchange(
    symbols: string[],
    exchange: string,
    timeframe: string,
    limit: number,
    minVolume: number
  ): Promise<ScanResult[]> {
    const results: ScanResult[] = [];

    for (const symbol of symbols) {
      try {
        // Get OHLCV data
        const frames = await this.getOHLCVData(symbol, exchange, timeframe, limit);

        if (!frames || frames.length === 0) {
          continue;
        }

        // Get volume data
        const volumes = frames.map(f => f.volume || 0);
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;

        if (avgVolume < minVolume) {
          continue;
        }

        // Compute momentum score (includes regime detection)
        const momentumResult = MomentumScanner.computeScore(frames);

        // === LIVE SCANNER SOURCE: Multi-pattern classification ===
        const patternClassification = MomentumScanner.classifyPatterns(frames);

        // Try to fetch centralized regime context (best-effort)
        const regimeSvc = getRegimeService();
        let armRegime: ArmRegimeContext | undefined;
        try {
          const tfMinutes = this.timeframeToMinutes(timeframe);
          const svcCtx = await regimeSvc.computeRegime(symbol, tfMinutes as any);
          if (svcCtx) {
            armRegime = {
              regime: (svcCtx.type as any) ,
              volatility: svcCtx.volatility === 'low' ? 0.2 : svcCtx.volatility === 'high' ? 0.8 : 0.5,
              trendStrength: typeof svcCtx.momentum === 'number' ? svcCtx.momentum : 0,
              regimeConfidence: svcCtx.confidence ?? (svcCtx.score ? Math.min(1, (svcCtx.score as number) / 100) : 0.5)
            } as ArmRegimeContext;
          }
        } catch (err) {
          // best-effort: ignore regime failures
        }

        // Get base signal classification (pass external regime when available)
        const baseSignal = SignalClassifier.classifyMomentumSignal(
          this.calculateMomentum(frames, 1),
          this.calculateMomentum(frames, 7),
          this.calculateRSI(frames),
          this.calculateMACD(frames),
          {},
          {},
          undefined,
          undefined,
          armRegime
        );

        // Prepare ARM context (needs all technical indicators)
        const armContext = this.buildSignalContext(frames, momentumResult);

        // Enhance with ARM classification
        const armResult = ArmSignalClassifier.classifyWithArm(armContext, baseSignal);

        // Build result
        const result: ScanResult = {
          symbol,
          exchange,
          timestamp: Date.now(),
          signal: armResult.signal,
          signalStrength: armResult.strength,
          confidence: armResult.confidence,
          armSignal: armResult.armSignal,
          armConfidence: armResult.armConfidence,
          price: frames[frames.length - 1].price.close,
          volume: avgVolume,
          change24h: this.calculateChange24h(frames),
          regime: momentumResult.regime || 'UNKNOWN',
          regimeConfidence: momentumResult.regimeConfidence,
          marketState: armResult.marketState,
          armState: armResult.armState,
          compositeScore: armResult.compositeScore,
          stateAlignment: armResult.stateAlignment,
          // === SCANNER SOURCE for consensus ===
          scannerSource: {
            patterns: patternClassification.patterns,
            primaryPattern: patternClassification.primaryPattern,
            overallConfidence: patternClassification.overallConfidence,
            overallStrength: patternClassification.overallStrength,
            reasoning: patternClassification.reasoning,
            patternCount: patternClassification.patterns.length,
            technicalScore: patternClassification.sourceContext?.technicalScore ?? 0,
            volumeRatio: patternClassification.sourceContext?.volumeRatio ?? 0
          }
        };

        // === QUALITY GATING: Check if signal passes quality threshold ===
        const gateResult = QualityGating.passesQualityGate(result.confidence, result.signalStrength, symbol);
        result.passesQualityGate = gateResult.passesGate;
        result.qualityGateReason = gateResult.rejectionReason || gateResult.reason;

        // Only include if passes quality gate
        if (gateResult.passesGate) {
          results.push(result);
        } else {
          console.debug(`[MultiExchangeScanner] Filtered ${symbol}: ${gateResult.rejectionReason}`);
        }
      } catch (error) {
        console.error(`[MultiExchangeScanner] Error scanning ${symbol} on ${exchange}:`, error);
      }
    }

    return results;
  }

  /**
   * Build exchange-level results with aggregation
   */
  private buildExchangeResult(
    exchange: string,
    results: ScanResult[],
    timestamp: number
  ): ExchangeScanResults {
    const signalCounts = {
      strongBuy: 0,
      buy: 0,
      neutral: 0,
      sell: 0,
      strongSell: 0
    };

    let totalConfidence = 0;

    for (const result of results) {
      totalConfidence += result.confidence;

      if (result.signal.includes('Strong Buy')) signalCounts.strongBuy++;
      else if (result.signal.includes('Buy')) signalCounts.buy++;
      else if (result.signal === 'Neutral') signalCounts.neutral++;
      else if (result.signal.includes('Sell') && !result.signal.includes('Strong')) signalCounts.sell++;
      else if (result.signal.includes('Strong Sell')) signalCounts.strongSell++;
    }

    const topAssets = results
      .sort((a, b) => (b.compositeScore || b.signalStrength) - (a.compositeScore || a.signalStrength))
      .slice(0, 10);

    return {
      exchange,
      timestamp,
      totalScanned: results.length,
      successCount: results.length,
      errorCount: 0,
      results,
      topAssets,
      avgConfidence: results.length > 0 ? totalConfidence / results.length : 0,
      signalDistribution: signalCounts
    };
  }

  /**
   * Detect specialized cross-exchange signals
   */
  private detectCrossExchangeSignals(
    exchangeResults: Map<string, ExchangeScanResults>,
    allResults: ScanResult[]
  ): CrossExchangeSignal[] {
    const signals: CrossExchangeSignal[] = [];
    const symbolGroups = new Map<string, ScanResult[]>();

    // Group results by symbol
    for (const result of allResults) {
      if (!symbolGroups.has(result.symbol)) {
        symbolGroups.set(result.symbol, []);
      }
      symbolGroups.get(result.symbol)!.push(result);
    }

    // Analyze each symbol across exchanges
    for (const [symbol, symbolResults] of symbolGroups) {
      if (symbolResults.length < 2) continue; // Need at least 2 exchanges

      const signals_map = new Map<string, string>();
      const exchanges: string[] = [];
      let totalScore = 0;

      for (const result of symbolResults) {
        signals_map.set(result.exchange, result.signal);
        exchanges.push(result.exchange);
        totalScore += result.compositeScore || result.signalStrength;
      }

      const avgScore = totalScore / symbolResults.length;

      // === Detect CONSENSUS ===
      const firstSignal = symbolResults[0].signal;
      if (symbolResults.every(r => r.signal === firstSignal)) {
        signals.push({
          symbol,
          type: 'CONSENSUS',
          confidence: Math.min(...symbolResults.map(r => r.confidence)),
          exchanges,
          description: `All ${exchanges.length} exchanges align on ${firstSignal}`,
          signals: signals_map,
          avgScore
        });
      }

      // === Detect DIVERGENCE ===
      const uniqueSignals = new Set(symbolResults.map(r => r.signal));
      if (uniqueSignals.size >= 2) {
        const bullish = symbolResults.filter(r => r.signal.includes('Buy')).length;
        const bearish = symbolResults.filter(r => r.signal.includes('Sell')).length;

        if (bullish > 0 && bearish > 0) {
          signals.push({
            symbol,
            type: 'DIVERGENCE',
            confidence: 1 - Math.abs(bullish - bearish) / exchanges.length,
            exchanges,
            description: `Disagreement: ${bullish} bullish, ${bearish} bearish on ${symbol}`,
            signals: signals_map,
            avgScore
          });
        }
      }

      // === Detect ACCUMULATION/DISTRIBUTION ===
      const volumeRatios = symbolResults.map(r => r.volume || 0);
      const avgVolume = volumeRatios.reduce((a, b) => a + b, 0) / volumeRatios.length;
      const maxVolume = Math.max(...volumeRatios);

      if (maxVolume > avgVolume * 1.5) {
        const highVolumeExchanges = symbolResults
          .filter(r => (r.volume || 0) > avgVolume * 1.5)
          .map(r => r.exchange);

        if (symbolResults.filter(r => r.signal.includes('Buy')).length > exchanges.length / 2) {
          signals.push({
            symbol,
            type: 'ACCUMULATION',
            confidence: Math.min(...symbolResults.map(r => r.confidence)),
            exchanges: highVolumeExchanges,
            description: `Accumulation detected: high volume with bullish bias on ${highVolumeExchanges.join(',')}`,
            signals: signals_map,
            avgScore
          });
        } else {
          signals.push({
            symbol,
            type: 'DISTRIBUTION',
            confidence: Math.min(...symbolResults.map(r => r.confidence)),
            exchanges: highVolumeExchanges,
            description: `Distribution detected: high volume with bearish bias on ${highVolumeExchanges.join(',')}`,
            signals: signals_map,
            avgScore
          });
        }
      }
    }

    return signals;
  }

  /**
   * Helper: Get OHLCV data from aggregator
   */
  private async getOHLCVData(
    symbol: string,
    exchange: string,
    timeframe: string,
    limit: number
  ): Promise<MarketFrame[]> {
    const cacheKey = `ohlcv:${symbol}:${exchange}:${timeframe}`;
    const cached = this.cache.get<MarketFrame[]>(cacheKey);
    if (cached) return cached;

    try {
      const frames = await this.aggregator.getOHLCV(symbol, timeframe, limit, exchange);
      if (frames && frames.length > 0) {
        this.cache.set(cacheKey, frames, 180000); // 3-min cache
      }
      return frames || [];
    } catch (error) {
      console.error(`Error fetching OHLCV for ${symbol} from ${exchange}:`, error);
      return [];
    }
  }

  /**
   * Build ARM signal context from frames
   */
  private buildSignalContext(frames: MarketFrame[], momentumResult: any): SignalStateContext {
    const closes = frames.map(f => f.price.close);
    const highs = frames.map(f => f.price.high);
    const lows = frames.map(f => f.price.low);
    const volumes = frames.map(f => f.volume || 0);

    return {
      momentum1d: this.calculateMomentum(frames, 1),
      momentum7d: this.calculateMomentum(frames, 7),
      momentum30d: this.calculateMomentum(frames, 30),
      rsi: this.calculateRSI(frames),
      rsiSlope: this.calculateSlope(this.getRSIArray(frames), 5),
      macd: this.calculateMACD(frames),
      macdHistogram: this.calculateMACDHistogram(frames),
      macdHistSlope: 0, // Would need historical MACD
      atr: this.calculateATR(frames),
      atrSlope: 0, // Would need historical ATR
      atrPercentile: 50, // Simplified
      volume: volumes[volumes.length - 1],
      volumeSlope: this.calculateSlope(volumes.slice(-20), 5),
      volumeRatio: volumes[volumes.length - 1] / (volumes.reduce((a, b) => a + b, 0) / volumes.length),
      regime: momentumResult.regime || 'RANGING',
      trendStrength: 0.5, // Simplified
      volatilityClass: this.classifyVolatility(frames),
      ichimokuBullish: true // Simplified
    };
  }

  // === Technical Indicator Helpers ===

  private calculateMomentum(frames: MarketFrame[], periods: number): number {
    const closes = frames.map(f => f.price.close);
    if (closes.length <= periods) return 0;
    return (closes[closes.length - 1] - closes[Math.max(0, closes.length - periods - 1)]) /
           closes[Math.max(0, closes.length - periods - 1)];
  }

  private calculateRSI(frames: MarketFrame[]): number {
    const closes = frames.map(f => f.price.close);
    if (closes.length < 14) return 50;

    let gains = 0, losses = 0;
    for (let i = 1; i < 14; i++) {
      const diff = closes[closes.length - 14 + i] - closes[closes.length - 15 + i];
      if (diff > 0) gains += diff;
      else losses += -diff;
    }

    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private getRSIArray(frames: MarketFrame[]): number[] {
    // Simplified: return array of recent RSI values
    return [this.calculateRSI(frames)];
  }

  private calculateMACD(frames: MarketFrame[]): number {
    const closes = frames.map(f => f.price.close);
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    return ema12 - ema26;
  }

  private calculateMACDHistogram(frames: MarketFrame[]): number {
    // Simplified
    return this.calculateMACD(frames) * 0.1;
  }

  private calculateEMA(values: number[], period: number): number {
    if (values.length === 0) return 0;
    let ema = values[0];
    const multiplier = 2 / (period + 1);

    for (let i = 1; i < values.length; i++) {
      ema = values[i] * multiplier + ema * (1 - multiplier);
    }

    return ema;
  }

  private calculateATR(frames: MarketFrame[]): number {
    const trueRanges = frames.slice(-14).map((f, i) => {
      if (i === 0) return f.price.high - f.price.low;
      const prev = frames[frames.length - 15 + i];
      return Math.max(
        f.price.high - f.price.low,
        Math.abs(f.price.high - prev.price.close),
        Math.abs(f.price.low - prev.price.close)
      );
    });

    return trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
  }

  private calculateSlope(values: number[], periods: number): number {
    if (values.length < 2) return 0;
    const recent = values.slice(-periods);
    return recent[recent.length - 1] - recent[0];
  }

  private calculateChange24h(frames: MarketFrame[]): number {
    if (frames.length < 24) return 0;
    const price24hAgo = frames[Math.max(0, frames.length - 24)].price.close;
    const currentPrice = frames[frames.length - 1].price.close;
    return (currentPrice - price24hAgo) / price24hAgo;
  }

  // Helper: convert timeframe string (e.g. '1m','5m','1h','4h','1d') to minutes
  private timeframeToMinutes(timeframe: string): number {
    if (!timeframe) return 60;
    const tf = timeframe.toLowerCase().trim();
    if (tf.endsWith('m')) return Number(tf.slice(0, -1)) || 1;
    if (tf.endsWith('h')) return (Number(tf.slice(0, -1)) || 1) * 60;
    if (tf.endsWith('d')) return (Number(tf.slice(0, -1)) || 1) * 60 * 24;
    return 60; // default 1h
  }

  private classifyVolatility(frames: MarketFrame[]): 'LOW' | 'MEDIUM' | 'HIGH' {
    const closes = frames.map(f => f.price.close);
    const returns = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i]);
    const volatility = Math.sqrt(returns.reduce((a, r) => a + r * r, 0) / returns.length);

    if (volatility > 0.05) return 'HIGH';
    if (volatility > 0.02) return 'MEDIUM';
    return 'LOW';
  }
}

export default MultiExchangeScanner;
