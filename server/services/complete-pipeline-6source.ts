/**
 * Complete Pipeline Signal Generator (6-7 Source Unified Framework)
 * 
 * Orchestrates all signal sources:
 * 1. Gradient Direction (40% trending)
 * 2. UT Bot Volatility (volatility management)
 * 3. Market Structure (swing analysis)
 * 4. Flow Field Energy (energy/pressure)
 * 5. ML Predictions (neural network consensus)
 * 6. Pattern Detection (technical patterns + confluence)
 * 7. Volume Metrics (volume as independent signal source)
 * 
 * Merges all with regime-aware weighting
 */

import type { StrategyContribution } from './unified-signal-aggregator';
import { UnifiedSignalAggregator } from './unified-signal-aggregator';
import { RegimeAwareSignalRouter } from './regime-aware-signal-router';
import type { UnifiedSignalFramework } from './unified-framework-6source';
import { UnifiedFramework } from './unified-framework-6source';
import { PatternDetectionEngine } from './pattern-detection-contribution';
import { VolumeMetricsEngine } from './volume-metrics-contribution';

export interface MarketData {
  // Price
  currentPrice: number;
  prevPrice: number;
  highestPrice: number;
  lowestPrice: number;
  
  // Volume
  currentVolume: number;
  avgVolume: number;
  prevVolume: number;
  
  // Technical indicators
  rsi: number;
  macd: number;
  macdSignal: number;
  ema20: number;
  ema50: number;
  sma200: number;
  atr: number;
  volatility: number; // Current volatility level
  bollingerBands: { upper: number; lower: number; basis: number };
  
  // Market structure
  support: number;
  resistance: number;
  supplyZone: number;
  demandZone: number;
  
  // Regime indicators
  adx: number; // Trend strength 0-100
  volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  volatilityTrend: 'RISING' | 'STABLE' | 'FALLING';
  priceVsMA: number; // -1 to +1
  recentSwings: number;
  rangeWidth: number;
}

export interface CompleteSignalResult {
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  regime: string;
  sourceCount: number;
  primarySources: string[];
  
  // Full framework
  framework: UnifiedSignalFramework;
  
  // Structured reasoning
  reasoning: string;
  timestamp: string;
}

export class CompletePipelineSignalGenerator {
  /**
   * MAIN ORCHESTRATOR: Generate unified signal from 6-7 sources
   * 
   * ===== STEP 1: DETECT MARKET REGIME =====
   * ===== STEP 2: GATHER CONTRIBUTIONS FROM 6 SOURCES =====
   * ===== STEP 3: APPLY REGIME-AWARE WEIGHTING =====
   * ===== STEP 4: MERGE WITH VOLUME + PATTERN CONFIRMATION =====
   * ===== STEP 5: RETURN UNIFIED SIGNAL =====
   */
  static generateSignal(marketData: MarketData): CompleteSignalResult {
    // ===== STEP 1: DETECT MARKET REGIME =====
    const regime = RegimeAwareSignalRouter.detectRegime(
      marketData.volatilityLevel,
      marketData.adx,
      marketData.rangeWidth,
      marketData.volatilityTrend,
      marketData.priceVsMA,
      marketData.recentSwings
    );

    // ===== STEP 2: GATHER CONTRIBUTIONS (6 sources) =====
    const contributions: StrategyContribution[] = [];

    // SOURCE 1: Gradient Direction
    const gradientContribution = this.getGradientContribution(
      marketData.currentPrice,
      marketData.ema20,
      marketData.ema50,
      marketData.adx
    );
    contributions.push(gradientContribution);

    // SOURCE 2: UT Bot Volatility
    const utBotContribution = this.getUTBotContribution(
      marketData.volatility,
      marketData.atr,
      marketData.volatilityLevel,
      marketData.volatilityTrend
    );
    contributions.push(utBotContribution);

    // SOURCE 3: Market Structure
    const structureContribution = this.getStructureContribution(
      marketData.currentPrice,
      marketData.support,
      marketData.resistance,
      marketData.supplyZone,
      marketData.demandZone,
      marketData.highestPrice,
      marketData.lowestPrice
    );
    contributions.push(structureContribution);

    // SOURCE 4: Flow Field Energy
    const flowFieldContribution = this.getFlowFieldContribution(
      marketData.volatility,
      marketData.volatilityTrend,
      marketData.macd,
      marketData.macdSignal,
      marketData.adx
    );
    contributions.push(flowFieldContribution);

    // SOURCE 5: ML Predictions
    const mlContribution = this.getMLPredictionsContribution(
      marketData.rsi,
      marketData.macd,
      marketData.volatility,
      marketData.currentPrice,
      marketData.sma200
    );
    contributions.push(mlContribution);

    // SOURCE 6: Pattern Detection
    const patternResult = PatternDetectionEngine.detectPatterns(
      marketData.currentPrice,
      marketData.prevPrice,
      marketData.support,
      marketData.resistance,
      marketData.currentVolume,
      marketData.prevVolume,
      marketData.rsi,
      marketData.macd,
      marketData.ema20,
      marketData.ema50,
      marketData.sma200,
      marketData.bollingerBands,
      marketData.atr,
      marketData.volatility
    );
    const patternContribution = PatternDetectionEngine.toStrategyContribution(
      patternResult,
      0.20 // Base weight (will be adjusted by regime)
    );
    contributions.push(patternContribution);

    // SOURCE 7: Volume Metrics (added as confirmation)
    const movePercent = ((marketData.currentPrice - marketData.prevPrice) / marketData.prevPrice) * 100;
    const trend =
      marketData.currentPrice > marketData.ema50
        ? 'BULLISH'
        : marketData.currentPrice < marketData.ema50
          ? 'BEARISH'
          : 'NEUTRAL';

    const volumeResult = VolumeMetricsEngine.analyzeVolume(
      marketData.currentVolume,
      marketData.avgVolume,
      marketData.prevVolume,
      movePercent,
      trend as 'BULLISH' | 'BEARISH' | 'NEUTRAL',
      marketData.highestPrice,
      marketData.lowestPrice,
      marketData.currentPrice
    );
    const volumeContribution = VolumeMetricsEngine.toStrategyContribution(volumeResult, 0.12);
    contributions.push(volumeContribution);

    // ===== STEP 3: APPLY REGIME-AWARE WEIGHTING =====
    const weights = RegimeAwareSignalRouter.getRegimeAdjustedWeights(regime);
    
    // Map contributions to regime weights
    const weightedContributions = contributions.map(contrib => {
      let weight = 0.15; // Default

      if (contrib.name.includes('Gradient')) {
        weight = weights.gradientDirection;
      } else if (contrib.name.includes('UT Bot')) {
        weight = weights.utBotVolatility;
      } else if (contrib.name.includes('Structure')) {
        weight = weights.marketStructure;
      } else if (contrib.name.includes('Flow')) {
        weight = weights.flowFieldEnergy;
      } else if (contrib.name.includes('ML')) {
        weight = weights.mlPredictions;
      } else if (contrib.name.includes('Pattern')) {
        weight = weights.patternDetection;
      } else if (contrib.name.includes('Volume')) {
        weight = weights.volumeMetrics;
      }

      return { ...contrib, weight };
    });

    // ===== STEP 4: AGGREGATE ALL CONTRIBUTIONS =====
    const aggregatedSignal = UnifiedSignalAggregator.aggregateSignals(weightedContributions);

    // ===== STEP 5: MERGE INTO UNIFIED FRAMEWORK WITH VOLUME + PATTERN BOOSTING =====
    const volumeRatio = marketData.avgVolume > 0 ? marketData.currentVolume / marketData.avgVolume : 1.0;

    const unifiedFramework = UnifiedFramework.mergeAllSources(
      gradientContribution,
      utBotContribution,
      structureContribution,
      flowFieldContribution,
      mlContribution,
      patternContribution,
      regime.type,
      volumeRatio,
      patternResult
    );

    // ===== BUILD RESULT =====
    const reasoning = `
[${regime.type} - ${regime.strength}/100] ${aggregatedSignal.trend} @ ${(aggregatedSignal.confidence * 100).toFixed(0)}%
Sources: ${contributions.length} integrated
Patterns: ${patternResult.confluenceCount} confluent
Volume: ${(volumeRatio * 100).toFixed(0)}% of average (${VolumeMetricsEngine.getConfidenceLabel(volumeRatio)})
Risk: ${unifiedFramework.riskLevel} (${unifiedFramework.riskScore.toFixed(0)}/100)
${regime.characteristics.join(' | ')}
`.trim();

    return {
      direction: aggregatedSignal.trend,
      confidence: aggregatedSignal.confidence,
      regime: regime.type,
      sourceCount: contributions.length,
      primarySources: contributions
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
        .slice(0, 3)
        .map(c => `${c.name} (${((c.confidence || 0) * 100).toFixed(0)}%)`),
      framework: unifiedFramework,
      reasoning,
      timestamp: new Date().toISOString()
    };
  }

  // ========== INDIVIDUAL CONTRIBUTION GENERATORS ==========

  private static getGradientContribution(
    currentPrice: number,
    ema20: number,
    ema50: number,
    adx: number
  ): StrategyContribution {
    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let confidence = 0;

    if (currentPrice > ema20 && ema20 > ema50) {
      trend = 'BULLISH';
      confidence = Math.min(0.95, 0.6 + (adx / 100) * 0.3);
    } else if (currentPrice < ema20 && ema20 < ema50) {
      trend = 'BEARISH';
      confidence = Math.min(0.95, 0.6 + (adx / 100) * 0.3);
    } else {
      trend = 'NEUTRAL';
      confidence = 0.5;
    }

    return {
      name: 'GradientDirection',
      trend,
      confidence,
      strength: adx,
      reason: `Price vs EMA20/50: ${currentPrice > ema20 ? 'above' : 'below'} | ADX: ${adx.toFixed(0)}`,
      timestamp: new Date().toISOString()
    };
  }

  private static getUTBotContribution(
    volatility: number,
    atr: number,
    volatilityLevel: string,
    volatilityTrend: string
  ): StrategyContribution {
    // UT Bot is better in ranging markets (low trend)
    let confidence = 0;
    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';

    if (volatilityLevel === 'LOW' || volatilityLevel === 'MEDIUM') {
      confidence = 0.65;
      trend = volatilityTrend === 'RISING' ? 'BEARISH' : 'BULLISH'; // Anticipate reversal
    } else if (volatilityLevel === 'HIGH') {
      confidence = 0.55;
      trend = 'NEUTRAL';
    } else {
      confidence = 0.35;
      trend = 'NEUTRAL';
    }

    return {
      name: 'UTBotVolatility',
      trend,
      confidence,
      strength: Math.min(100, (volatility / atr) * 50),
      reason: `Volatility: ${volatilityLevel} | ATR-based trailing stops active`,
      timestamp: new Date().toISOString()
    };
  }

  private static getStructureContribution(
    currentPrice: number,
    support: number,
    resistance: number,
    supplyZone: number,
    demandZone: number,
    highestPrice: number,
    lowestPrice: number
  ): StrategyContribution {
    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let confidence = 0.6;

    const distanceToSupport = Math.abs(currentPrice - support);
    const distanceToResistance = Math.abs(currentPrice - resistance);

    if (currentPrice > demandZone && distanceToResistance > distanceToSupport) {
      trend = 'BULLISH';
      confidence = 0.75;
    } else if (currentPrice < supplyZone && distanceToSupport > distanceToResistance) {
      trend = 'BEARISH';
      confidence = 0.75;
    } else if (currentPrice > support && currentPrice < resistance) {
      trend = 'NEUTRAL';
      confidence = 0.5;
    }

    const range = highestPrice - lowestPrice;
    const pricePosition = range > 0 ? (currentPrice - lowestPrice) / range : 0.5;
    const strength = pricePosition > 0.7 ? 75 : pricePosition < 0.3 ? 75 : 50;

    return {
      name: 'MarketStructure',
      trend,
      confidence,
      strength,
      reason: `Price: ${currentPrice.toFixed(2)} | Support: ${support.toFixed(2)} | Resistance: ${resistance.toFixed(2)}`,
      timestamp: new Date().toISOString()
    };
  }

  private static getFlowFieldContribution(
    volatility: number,
    volatilityTrend: string,
    macd: number,
    macdSignal: number,
    adx: number
  ): StrategyContribution {
    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let confidence = 0.6;
    let energyTrend: 'ACCELERATING' | 'DECELERATING' = 'DECELERATING';

    if (macd > macdSignal && volatilityTrend === 'RISING') {
      trend = 'BULLISH';
      confidence = 0.75;
      energyTrend = 'ACCELERATING';
    } else if (macd < macdSignal && volatilityTrend === 'RISING') {
      trend = 'BEARISH';
      confidence = 0.75;
      energyTrend = 'ACCELERATING';
    } else if (volatilityTrend === 'FALLING') {
      confidence = 0.5;
      energyTrend = 'DECELERATING';
    }

    return {
      name: 'FlowFieldEnergy',
      trend,
      confidence,
      strength: Math.min(100, adx),
      energyTrend,
      reason: `Flow energy ${energyTrend} | MACD: ${macd > macdSignal ? 'bullish' : 'bearish'} crossover`,
      timestamp: new Date().toISOString()
    };
  }

  private static getMLPredictionsContribution(
    rsi: number,
    macd: number,
    volatility: number,
    currentPrice: number,
    sma200: number
  ): StrategyContribution {
    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let confidence = 0.5;

    // ML heuristics (simplified)
    if (rsi < 30 && macd > 0) {
      trend = 'BULLISH';
      confidence = 0.75;
    } else if (rsi > 70 && macd < 0) {
      trend = 'BEARISH';
      confidence = 0.75;
    } else if (currentPrice > sma200 && rsi > 50) {
      trend = 'BULLISH';
      confidence = 0.65;
    } else if (currentPrice < sma200 && rsi < 50) {
      trend = 'BEARISH';
      confidence = 0.65;
    }

    return {
      name: 'MLPredictions',
      trend,
      confidence,
      strength: 50 + (rsi > 50 ? rsi - 50 : 50 - rsi),
      reason: `RSI: ${rsi.toFixed(0)} | MACD: ${macd > 0 ? 'bullish' : 'bearish'}`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get summary for display
   */
  static getSummary(result: CompleteSignalResult): string {
    return `
╔════════════════════════════════════════════════════════════════╗
║ COMPLETE 6-7 SOURCE UNIFIED SIGNAL GENERATOR                  ║
╠════════════════════════════════════════════════════════════════╣
║ SIGNAL:       ${result.direction.padEnd(49)} ║
║ CONFIDENCE:   ${(result.confidence * 100).toFixed(0)}%${' '.repeat(52)} ║
║ REGIME:       ${result.regime.padEnd(49)} ║
║ SOURCES:      ${result.sourceCount} integrated${' '.repeat(42)} ║
╠════════════════════════════════════════════════════════════════╣
║ TOP 3 CONTRIBUTORS:                                            ║
║  • ${result.primarySources[0]?.padEnd(59)}║
║  • ${result.primarySources[1]?.padEnd(59)}║
║  • ${result.primarySources[2]?.padEnd(59)}║
╚════════════════════════════════════════════════════════════════╝
`.trim();
  }
}

export default CompletePipelineSignalGenerator;
