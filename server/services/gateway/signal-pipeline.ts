
import { ExchangeAggregator } from './exchange-aggregator';
import { SignalEngine } from '../../trading-engine';
import { EnhancedMultiTimeframeAnalyzer } from '../../multi-timeframe';
import type { Signal } from '@shared/schema';

/**
 * Signal Pipeline
 * Unified flow: Gateway -> CCXT -> Indicators -> Signals
 * Ensures consistent data flow for all signal generation
 */
export class SignalPipeline {
  private aggregator: ExchangeAggregator;
  private signalEngine: SignalEngine;
  private multiTimeframeAnalyzer: EnhancedMultiTimeframeAnalyzer | null = null;

  constructor(
    aggregator: ExchangeAggregator,
    signalEngine: SignalEngine,
    multiTimeframeAnalyzer?: EnhancedMultiTimeframeAnalyzer
  ) {
    this.aggregator = aggregator;
    this.signalEngine = signalEngine;
    this.multiTimeframeAnalyzer = multiTimeframeAnalyzer || null;
  }

  /**
   * Generate signal for a symbol using Gateway data flow
   */
  async generateSignal(
    symbol: string,
    timeframe: string = '1m',
    limit: number = 100
  ): Promise<Signal | null> {
    try {
      // Step 1: Get market frames through Gateway (with caching & fallback)
      const frames = await this.aggregator.getMarketFrames(symbol, timeframe, limit);

      if (!frames || frames.length < 20) {
        console.warn(`[Pipeline] Insufficient data for ${symbol}: ${frames?.length || 0} frames`);
        return null;
      }

      // Step 2: Generate signal using indicator calculations
      const signal = await this.signalEngine.generateSignal(frames, frames.length - 1);

      if (!signal) {
        return null;
      }

      // Step 3: Enrich with price confidence from aggregator
      const priceData = await this.aggregator.getAggregatedPrice(symbol);

      return {
        ...signal,
        id: signal.id || require('crypto').randomUUID(),
        timestamp: signal.timestamp || new Date(),
        reasoning: [
          ...signal.reasoning,
          `Price confidence: ${priceData.confidence.toFixed(1)}% (${priceData.sources.length} sources)`,
          `Price deviation: ${priceData.deviation.toFixed(2)}%`
        ],
        confidence: signal.confidence * (priceData.confidence / 100)
      };
    } catch (error: any) {
      console.error(`[Pipeline] Error generating signal for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Generate multi-timeframe signal using Gateway
   */
  async generateMultiTimeframeSignal(symbol: string) {
    if (!this.multiTimeframeAnalyzer) {
      throw new Error('MultiTimeframeAnalyzer not available');
    }

    try {
      // Gateway will handle caching and fallback across timeframes
      const signal = await this.multiTimeframeAnalyzer.analyzeMultiTimeframe(symbol);
      return signal;
    } catch (error: any) {
      console.error(`[Pipeline] Multi-timeframe error for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Batch generate signals for multiple symbols
   */
  async generateBatchSignals(
    symbols: string[],
    timeframe: string = '1m'
  ): Promise<Array<{ symbol: string; signal: Signal | null; error?: string }>> {
    const results = await Promise.allSettled(
      symbols.map(symbol => this.generateSignal(symbol, timeframe))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return { symbol: symbols[index], signal: result.value };
      } else {
        return { 
          symbol: symbols[index], 
          signal: null, 
          error: result.reason.message 
        };
      }
    });
  }

  /**
   * Get live price feed for monitoring
   */
  async getLivePriceFeed(symbols: string[]): Promise<Map<string, any>> {
    const priceMap = new Map();

    const results = await Promise.allSettled(
      symbols.map(symbol => this.aggregator.getAggregatedPrice(symbol))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        priceMap.set(symbols[index], result.value);
      }
    });

    return priceMap;
  }
}
