/**
 * Complete Signal Generation Pipeline
 * 
 * Integrates all new components:
 * 1. Regime-Aware Signal Router (detects market conditions, reweights strategies)
 * 2. Unified Signal Aggregator (combines weighted strategies)
 * 3. Ensemble Predictor (ML model consensus)
 * 4. Dynamic Position Sizer (Kelly + RL + Trend-aware)
 * 
 * Entry point for all trading signals in the system
 */

import { UnifiedSignalAggregator, type UnifiedSignal } from '../services/unified-signal-aggregator';
import { RegimeAwareSignalRouter, type MarketRegime, type RegimeAdjustedWeights } from '../services/regime-aware-signal-router';
import { EnsemblePredictor, type EnsemblePrediction } from '../services/ensemble-predictor';
import { DynamicPositionSizer, type PositionSizingOutput } from '../services/dynamic-position-sizer';
import type { StrategyContribution } from '../services/unified-signal-aggregator';

export interface CompleteSignal {
  // Primary signal
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  strength: number;

  // Regime information
  regime: {
    type: MarketRegime['type'];
    strength: number;
    characteristics: string[];
  };

  // Unified aggregation
  unifiedSignal: UnifiedSignal;

  // Ensemble ML predictions
  ensembleModel: EnsemblePrediction;

  // Regime-adjusted weights
  strategyWeights: RegimeAdjustedWeights;

  // Position sizing
  positionSizing: PositionSizingOutput;
  regimeSizingAdjustment: number;
  finalPositionSize: number;
  finalPositionPercent: number;

  // Trading rules
  rules: {
    entryRule: string;
    exitRule: string;
    stoplossDistance: number;
    takeprofitDistance: number;
  };

  // Strategy contributions (full transparency)
  contributions: StrategyContribution[];
  agreementScore: number;

  // Risk assessment
  risk: {
    score: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    factors: string[];
  };

  // Metadata
  metadata: {
    timestamp: number;
    symbol: string;
    timeframe: string;
    priceLevel: number;
    accountBalance: number;
    debugTrace?: Record<string, any>;
  };
}

export class CompletePipelineSignalGenerator {
  /**
   * Generate complete signal through entire pipeline
   */
  static async generateSignal(
    symbol: string,
    currentPrice: number,
    timeframe: string,
    accountBalance: number,

    // Market data for regime detection
    volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME',
    trendStrength: number,
    rangeWidth: number,
    volatilityTrend: 'RISING' | 'STABLE' | 'FALLING',
    priceVsMA: number,
    recentSwings: number,

    // Gradient Direction data
    gradientValue: number,
    gradientStrength: number,
    trendShiftDetected: boolean,

    // UT Bot data
    atr: number,
    trailingStop: number,
    utBuyCount: number,
    utSellCount: number,
    utMomentum: number,

    // Market Structure data
    structureTrend: 'UPTREND' | 'DOWNTREND' | 'RANGING',
    structureBreak: boolean,

    // Flow Field data
    flowDominant: 'BULLISH' | 'BEARISH',
    flowForce: number,
    flowTurbulence: 'low' | 'medium' | 'high' | 'extreme',
    flowEnergyTrend: 'ACCELERATING' | 'STABLE' | 'DECELERATING',

    // ML/Ensemble data (chart data for predictions)
    chartData: any[],

    // Volume Metrics data (NEW!)
    currentVolume: number = 0,
    avgVolume: number = 0,
    volumeSMA20: number = 0,
    priceDirection: 'UP' | 'DOWN' | 'FLAT' = 'FLAT',
    volumeTrend: 'RISING' | 'FALLING' | 'STABLE' = 'STABLE'
  ): Promise<CompleteSignal> {
    try {
      // ========== STEP 1: Detect market regime ==========
      const regime = RegimeAwareSignalRouter.detectRegime(
        volatilityLevel,
        trendStrength,
        rangeWidth,
        volatilityTrend,
        priceVsMA,
        recentSwings
      );

      // ========== STEP 2: Generate ML ensemble predictions ==========
      let ensembleModel: EnsemblePrediction;
      try {
        const trendDirection =
          gradientValue > 0.1
            ? 'BULLISH'
            : gradientValue < -0.1
              ? 'BEARISH'
              : 'SIDEWAYS';

        ensembleModel = await EnsemblePredictor.generateEnsemblePrediction(
          chartData,
          trendDirection
        );
      } catch (e) {
        console.warn('[Pipeline] Ensemble prediction failed, using defaults:', e);
        // Fallback ensemble
        ensembleModel = {
          direction: { prediction: 'NEUTRAL', confidence: 0.5, votes: { UP: 0, DOWN: 0, NEUTRAL: 1 }, modelAgreement: 33 },
          price: { predicted: currentPrice, high: currentPrice, low: currentPrice, confidence: 0.5 },
          volatility: { predicted: volatilityLevel === 'LOW' ? 0.01 : 0.03, level: volatilityLevel, confidence: 0.5 },
          trendDirection: { direction: 'SIDEWAYS', alignment: 50, alignmentMultiplier: 1.0 },
          position: { sizeMultiplier: 1.0, riskReward: 1.5, confidence: 0.5 },
          risk: { score: 50, level: 'MEDIUM', factors: [] },
          ensembleScore: 0.5,
          recommendation: { action: 'HOLD', strength: 0, reason: 'Ensemble unavailable' },
          metadata: { timestamp: Date.now(), modelCount: 0, averageModelConfidence: 0.5, consensusLevel: 'weak' }
        };
      }

      // ========== STEP 3: Build strategy contributions ==========
      const contributions: StrategyContribution[] = [
        {
          name: 'Gradient Direction',
          weight: 0.35,
          trend: gradientValue > 0.1 ? 'BULLISH' : gradientValue < -0.1 ? 'BEARISH' : 'SIDEWAYS',
          strength: gradientStrength,
          confidence: 0.7,
          trendShiftMarker: trendShiftDetected,
          reason: `Gradient ${gradientValue.toFixed(2)} with ${gradientStrength.toFixed(0)}% strength${trendShiftDetected ? ' (TREND SHIFT)' : ''}`
        },
        {
          name: 'UT Bot Volatility',
          weight: 0.20,
          trend: trailingStop < currentPrice * 0.98 ? 'BULLISH' : 'BEARISH',
          volatility: (atr / currentPrice) * 100 / 100,
          momentum: utMomentum,
          confidence: 0.6,
          buySignals: utBuyCount,
          sellSignals: utSellCount,
          reason: `ATR ${atr.toFixed(4)}, ${utBuyCount} buy / ${utSellCount} sell`
        },
        {
          name: 'Market Structure',
          weight: 0.25,
          trend: structureTrend === 'UPTREND' ? 'BULLISH' : structureTrend === 'DOWNTREND' ? 'BEARISH' : 'SIDEWAYS',
          strength: 75,
          confidence: 0.8,
          reason: `${structureTrend}${structureBreak ? ' (STRUCTURE BREAK)' : ''}`
        },
        {
          name: 'Flow Field Energy',
          weight: 0.15,
          trend: flowDominant,
          confidence: Math.min(100, flowForce) / 100,
          volatility: flowTurbulence === 'extreme' ? 0.08 : flowTurbulence === 'high' ? 0.05 : 0.025,
          energyTrend: flowEnergyTrend,
          reason: `${flowDominant} force ${flowForce.toFixed(0)}/100, ${flowTurbulence} turbulence, energy ${flowEnergyTrend.toLowerCase()}`
        },
        {
          name: 'ML Predictions',
          weight: 0.05,
          trend: ensembleModel.direction.prediction === 'UP' ? 'BULLISH' : ensembleModel.direction.prediction === 'DOWN' ? 'BEARISH' : 'SIDEWAYS',
          confidence: ensembleModel.direction.confidence,
          volatility: Math.abs(ensembleModel.volatility.predicted),
          momentum: ensembleModel.direction.confidence > 0.65 ? (ensembleModel.direction.prediction === 'UP' ? 0.7 : -0.7) : 0.2,
          reason: `${ensembleModel.direction.prediction} with ${(ensembleModel.direction.confidence * 100).toFixed(0)}% confidence`
        },
        {
          name: 'Volume Metrics',
          weight: 0.10,
          trend: (() => {
            const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
            if (priceDirection === 'UP' && volumeRatio > 1.2 && volumeTrend === 'RISING') return 'BULLISH';
            if (priceDirection === 'DOWN' && volumeRatio > 1.2 && volumeTrend === 'RISING') return 'BEARISH';
            return 'SIDEWAYS';
          })(),
          confidence: (() => {
            const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
            if (volumeRatio > 1.2 && (volumeTrend === 'RISING' || volumeTrend === 'STABLE')) return 0.7;
            if (volumeRatio < 0.8 || volumeTrend === 'FALLING') return 0.3;
            return 0.5;
          })(),
          volatility: avgVolume > 0 ? Math.abs((currentVolume - avgVolume) / avgVolume) : 0,
          momentum: avgVolume > 0 ? (currentVolume - avgVolume) / avgVolume : 0,
          reason: `Volume ${(avgVolume > 0 ? currentVolume / avgVolume : 1).toFixed(1)}x average (${volumeTrend.toLowerCase()}), ${priceDirection} price`
        }
      ];

      // ========== STEP 4: Reweight contributions based on regime ==========
      const regimeWeights = RegimeAwareSignalRouter.getRegimeAdjustedWeights(regime);
      const reweightedContributions = RegimeAwareSignalRouter.reweightContributions(
        contributions,
        regime
      );

      // ========== STEP 5: Generate unified signal ==========
      const unifiedSignal = UnifiedSignalAggregator.aggregate(
        symbol,
        currentPrice,
        timeframe,
        reweightedContributions
      );

      // ========== STEP 6: Apply regime filtering ==========
      const minAgreement = RegimeAwareSignalRouter.getMinAgreementThreshold(regime);
      let finalDirection = unifiedSignal.direction;

      if (unifiedSignal.agreementScore < minAgreement * 100) {
        finalDirection = 'HOLD';
      }

      // ========== STEP 7: Calculate position sizing ==========
      const positionSizing = new DynamicPositionSizer().calculatePositionSize({
        symbol,
        confidence: unifiedSignal.confidence,
        signalType: finalDirection === 'BUY' ? 'BUY' : finalDirection === 'SELL' ? 'SELL' : 'BUY',
        accountBalance,
        currentPrice,
        atr,
        marketRegime: regime.type,
        primaryPattern: 'UNIFIED_SIGNAL',
        trendDirection: unifiedSignal.trend.direction,
        sma20: currentPrice,
        sma50: currentPrice
      });

      // ========== STEP 8: Apply regime sizing multiplier ==========
      const regimeSizingMult = RegimeAwareSignalRouter.getRegimeSizingMultiplier(regime);
      const finalPositionSize = positionSizing.positionSize * regimeSizingMult;
      const finalPositionPercent = positionSizing.positionPercent * regimeSizingMult;

      // ========== STEP 9: Get regime-specific rules ==========
      const rules = RegimeAwareSignalRouter.getRegimeRules(regime);

      // ========== STEP 10: Return complete signal ==========
      return {
        direction: finalDirection,
        confidence: unifiedSignal.confidence,
        strength: unifiedSignal.strength,

        regime: {
          type: regime.type,
          strength: regime.strength,
          characteristics: regime.characteristics
        },

        unifiedSignal,
        ensembleModel,
        strategyWeights: regimeWeights,

        positionSizing,
        regimeSizingAdjustment: regimeSizingMult,
        finalPositionSize,
        finalPositionPercent,

        rules: {
          entryRule: rules.entryRule,
          exitRule: rules.exitRule,
          stoplossDistance: currentPrice * (atr / currentPrice) * rules.stoplossMultiplier,
          takeprofitDistance: currentPrice * (atr / currentPrice) * rules.takeprofitMultiplier
        },

        contributions: reweightedContributions,
        agreementScore: unifiedSignal.agreementScore,

        risk: unifiedSignal.risk,

        metadata: {
          timestamp: Date.now(),
          symbol,
          timeframe,
          priceLevel: currentPrice,
          accountBalance,
          debugTrace: {
            regimeType: regime.type,
            regimeStrength: regime.strength,
            minAgreementRequired: minAgreement * 100,
            agreementScore: unifiedSignal.agreementScore,
            signalFiltered: unifiedSignal.agreementScore < minAgreement * 100,
            unifiedConfidence: unifiedSignal.confidence,
            ensembleScore: ensembleModel.ensembleScore,
            positionSizingBefore: positionSizing.positionPercent,
            positionSizingAfter: finalPositionPercent,
            regimeSizingMult
          }
        }
      };
    } catch (error) {
      console.error('[Pipeline] Signal generation failed:', error);
      throw error;
    }
  }

  /**
   * Get signal summary for logging/UI
   */
  static getSummary(signal: CompleteSignal): string {
    const regimeReason = signal.regime.characteristics.join('; ');
    const topContributor = signal.contributions.reduce((a, b) => (a.weight > b.weight ? a : b));

    return `
[SIGNAL] ${signal.direction} | Confidence: ${(signal.confidence * 100).toFixed(0)}% | Agreement: ${signal.agreementScore.toFixed(0)}%
[REGIME] ${signal.regime.type} (${signal.regime.strength.toFixed(0)}%) - ${regimeReason}
[TOP] ${topContributor.name} (${(topContributor.weight * 100).toFixed(0)}%) - ${topContributor.reason}
[POSITION] ${(signal.finalPositionPercent * 100).toFixed(2)}% (regime adjusted: ${signal.regimeSizingAdjustment.toFixed(1)}x)
[RISK] ${signal.risk.level} - ${signal.risk.factors.join(', ')}
[ENTRY] ${signal.rules.entryRule}
[EXIT] ${signal.rules.exitRule}
    `;
  }
}

export default CompletePipelineSignalGenerator;
