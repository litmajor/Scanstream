/**
 * Scout Report Service
 * 
 * Orchestrates generation of comprehensive Scout Reports by:
 * - Analyzing all signal sources (ML, Scanner, Agents, Price Action)
 * - Calculating consensus across sources and timeframes
 * - Identifying alternative scenarios and dissenting views
 * - Classifying trade opportunities (Scalp/Day/Swing)
 * - Assembling complete reports with risk assessment
 * 
 * Integration Points:
 * - MLMultiTimeframeService: ML signals by timeframe
 * - ScannerSignalService: Technical pattern detection
 * - GatewayService: Agent signals and price data
 * - PriceDataService: Current price and OHLCV data
 * 
 * Output: Complete ScoutReport for each symbol analyzed
 */

import { Logger } from './logger';
import { MultiTimeframeMLService, MultiTimeframePrediction } from './multi-timeframe-ml-service';
import { ScannerSignalService } from './scanner/scanner-signal-service';
// PriceDataService module may not exist in this repo; declare a minimal interface
// and accept any implementation matching these methods.
interface IPriceDataService {
  getCurrentPrice(symbol: string): Promise<{ price: number }>;
  getRecentCandles(symbol: string, timeframe: string, limit: number): Promise<any[]>;
}
import { TradeClassifier, type TradeClassification, type ClassificationFactors } from './trade-classifier';
import { UnifiedSignalAggregator, type StrategyContribution } from './unified-signal-aggregator';
import MarketRegimeDetector from './ml-regime-detector';

import type {
  ScoutReport,
  ExecutiveSummary,
  MLSourceAnalysis,
  ScannerSourceAnalysis,
  AgentSourceAnalysis,
  PriceActionAnalysis,
  ConsensuData,
  AlternativeView,
  TradeOpportunity,
  RiskAssessment,
  RiskFactor,
  Direction,
  TradeType,
  SourceType,
  OpportunitiesSummary,
  ScoutReportRequest,
} from '../types/scout-report-types';

const logger = new Logger('ScoutReportService');

/**
 * Main Scout Report Service
 * Generates comprehensive reports combining all signal sources
 */
export class ScoutReportService {
  private mlService: MultiTimeframeMLService;
  private scannerService: ScannerSignalService;
  private priceService: IPriceDataService;
  private tradeClassifier: TradeClassifier;
  private reportCache: Map<string, { report: ScoutReport; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    mlService: MultiTimeframeMLService,
    scannerService: ScannerSignalService,
    priceService: IPriceDataService,
    tradeClassifier?: TradeClassifier
  ) {
    this.mlService = mlService;
    this.scannerService = scannerService;
    this.priceService = priceService;
    this.tradeClassifier = tradeClassifier || new TradeClassifier();
  }

  /**
   * Main method: Generate complete scout report for a symbol
   */
  async generateScoutReport(symbol: string, request?: ScoutReportRequest): Promise<ScoutReport> {
    const startTime = performance.now();
    const reportId = `SR-${symbol}-${Date.now()}`;

    try {
      logger.info(`Generating scout report for ${symbol}`, { reportId });

      // Check cache first
      const cached = this.getFromCache(symbol);
      if (cached && !request?.includeHistorical) {
        logger.info(`Using cached scout report for ${symbol}`, { age: Date.now() - cached.timestamp });
        return cached;
      }

      // Analyze all sources in parallel
      const [mlAnalysis, scannerAnalysis, agentAnalysis, priceAnalysis] = await Promise.all([
        this.analyzeMLS(symbol),
        this.analyzeScanner(symbol),
        this.analyzeAgents(symbol),
        this.analyzePriceAction(symbol),
      ]);

      // Calculate consensus from all sources
      const consensus = this.calculateConsensus(
        mlAnalysis,
        scannerAnalysis,
        agentAnalysis,
        priceAnalysis
      );

      // Identify alternative scenarios
      const alternatives = this.identifyAlternatives(
        mlAnalysis,
        scannerAnalysis,
        agentAnalysis,
        priceAnalysis,
        consensus
      );

      // Classify and create trade opportunities
      const opportunities = this.classifyOpportunities(
        symbol,
        mlAnalysis,
        scannerAnalysis,
        consensus,
        priceAnalysis?.currentPrice || 0
      );

      // Assess overall risk
      const riskAssessment = this.assessRisk(
        symbol,
        consensus,
        opportunities,
        mlAnalysis?.metrics.volatilityLevel
      );

      // Build executive summary
      const executiveSummary = this.buildExecutiveSummary(
        symbol,
        consensus,
        opportunities,
        riskAssessment
      );

      // Assemble complete report
      const report = this.buildReport(
        reportId,
        symbol,
        executiveSummary,
        mlAnalysis,
        scannerAnalysis,
        agentAnalysis,
        priceAnalysis,
        consensus,
        alternatives,
        opportunities,
        riskAssessment,
        performance.now() - startTime
      );

      // Cache the report
      this.setCache(symbol, report);

      logger.info(`Scout report generated successfully for ${symbol}`, {
        reportId,
        opportunities: opportunities.length,
        generatedIn: `${(performance.now() - startTime).toFixed(0)}ms`,
      });

      return report;
    } catch (error) {
      logger.error(`Failed to generate scout report for ${symbol}`, {
        error: error instanceof Error ? error.message : String(error),
        reportId,
      });
      throw error;
    }
  }

  /**
   * Analyze ML signals across all timeframes
   */
  private async analyzeMLS(symbol: string): Promise<MLSourceAnalysis | null> {
    try {
      const mlPrediction = await this.mlService.getPredictions(symbol);

      if (!mlPrediction) {
        logger.warn(`No ML predictions available for ${symbol}`);
        return null;
      }

      // Extract consensus from multi-timeframe predictions
      const timeframes = mlPrediction.predictions;
      const timeframeSignals = Object.entries(timeframes)
        .filter(([_, pred]) => pred !== null)
        .map(([tf, pred]: [string, any]) => ({
          timeframe: tf,
          direction: this.mapMLDirection((pred as any)?.direction) as Direction,
          confidence: (pred as any)?.confidence ?? 0,
          strength: Math.round(((pred as any)?.confidence ?? 0) * 100),
          indicators: this.extractTopIndicators(((pred as any)?.indicators) || {}),
          predictedMove: (pred as any)?.predictedMove || 0,
          timestamp: (pred as any)?.timestamp || Date.now(),
        }));

      // Count agreement
      const consensusDirection = this.determineConsensus(
        timeframeSignals.map((s) => s.direction)
      );
      const alignedCount = timeframeSignals.filter(
        (s) => s.direction === consensusDirection
      ).length;

      return {
        source: 'ML',
        timestamp: Date.now(),
        consensus: {
          direction: consensusDirection,
          confidence:
            timeframeSignals.length > 0
              ? timeframeSignals.reduce((sum, s) => sum + s.confidence, 0) /
                timeframeSignals.length
              : 0.5,
          strength: Math.round(
            (timeframeSignals.length > 0
              ? timeframeSignals.reduce((sum, s) => sum + s.strength, 0) /
                timeframeSignals.length
              : 0) * 0.8
          ),
        },
        timeframes: timeframeSignals,
        timeframesAligned: alignedCount,
        alignmentPercent: timeframeSignals.length > 0 ? alignedCount / timeframeSignals.length : 0,
        metrics: {
          volatilityLevel: mlPrediction.aggregatedMetrics?.maxVolatility || 'medium',
          regimeDuration: mlPrediction.aggregatedMetrics?.shortestRegimeDuration || 'unknown',
          trendStrength: Math.round(mlPrediction.aggregatedMetrics?.profitTargetWeighted || 50),
          momentumScore:
            (mlPrediction.aggregatedMetrics?.velocityConfidenceAvg || 0.5) * 100 - 50,
        },
        topIndicators: this.extractTopIndicatorsList(timeframeSignals),
        positionSizingRecommendation: {
          method: 'confidence-based',
          multiplier: Math.min(2.0, Math.max(0.5, mlPrediction.consensus.confidence * 2)),
          reasoning: `Based on ${mlPrediction.consensus.confidence.toFixed(2)} ML consensus confidence`,
        },
      };
    } catch (error) {
      logger.error(`ML analysis failed for ${symbol}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Analyze scanner signals and technical patterns
   */
  private async analyzeScanner(symbol: string): Promise<ScannerSourceAnalysis | null> {
    try {
      // ScannerSignalService exposes static helpers; use cached signal lookup
      const scannerSignal = ScannerSignalService.getCachedSignal(symbol, '1h');

      if (!scannerSignal) {
        logger.warn(`No scanner signals available for ${symbol}`);
        return null;
      }

      // Map scanner signal (MomentumScoreResult + targets) into ScannerSourceAnalysis
      const targets = (scannerSignal as any).targets as any | undefined;

      return {
        source: 'SCANNER',
        timestamp: Date.now(),
        primaryPattern: {
          // Momentum scanner provides a human-readable signal label
          name: (scannerSignal as any).signal || 'Unknown',
          confidence: (scannerSignal as any).confidence || 0.5,
          confluenceScore: Math.round(((scannerSignal as any).confidence || 0.5) * 100),
          foundAt: scannerSignal.timestamp || Date.now(),
          duration: this.estimateDuration(scannerSignal.timestamp),
        },
        secondaryPatterns: [],
        levels: {
          support: [
            { price: targets?.stopLoss ?? targets?.supportLevel ?? 0, strength: 0.9, type: 'major' },
            ...(targets?.supportLevel ? ([{ price: targets.supportLevel, strength: 0.6, type: 'minor' }] as any) : []),
          ],
          resistance: [
            { price: targets?.takeProfit ?? targets?.resistanceLevel ?? 0, strength: 0.8, type: 'major' },
            ...(targets?.resistanceLevel ? ([{ price: targets.resistanceLevel, strength: 0.5, type: 'minor' }] as any) : []),
          ],
        },
        volumeAnalysis: {
          trend: 'stable',
          avgVolume: (scannerSignal as any).indicators?.volume || 0,
          currentVolume: (scannerSignal as any).indicators?.volume || 0,
          volumePercent: 100,
          conclusion: 'Volume data not fully available',
        },
        signal: {
          direction: this.mapDirection((scannerSignal as any).signal),
          confidence: (scannerSignal as any).confidence || 0.5,
          quality: this.assessQuality((scannerSignal as any).confidence || 0.5),
        },
        tradeApproach: {
          entryStrategy: 'optimal',
          targets: [targets?.takeProfit ?? 0],
          stopLossStrategy: 'support-based',
        },
      };
    } catch (error) {
      logger.error(`Scanner analysis failed for ${symbol}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Analyze agent signals (RPG agents, gateway signals)
   */
  private async analyzeAgents(symbol: string): Promise<AgentSourceAnalysis | null> {
    try {
      // Placeholder: Fetch from gateway/agent service
      // This would integrate with the gateway and RPG agent systems
      const agentSignals = await this.fetchAgentSignals(symbol);

      if (!agentSignals || agentSignals.length === 0) {
        logger.warn(`No agent signals available for ${symbol}`);
        return null;
      }

      const bullishCount = agentSignals.filter((s) => s.direction === 'BULLISH').length;
      const bearishCount = agentSignals.filter((s) => s.direction === 'BEARISH').length;
      const neutralCount = agentSignals.length - bullishCount - bearishCount;

      const consensusDir = bullishCount > bearishCount ? 'BULLISH' : 'BEARISH';
      const consensusConf =
        agentSignals.reduce((sum, s) => sum + (s.trackRecord?.winRate || 0.5), 0) /
        agentSignals.length;

      return {
        source: 'AGENTS',
        timestamp: Date.now(),
        agentSignals,
        consensus: {
          direction: consensusDir,
          confidence: consensusConf,
          countBullish: bullishCount,
          countBearish: bearishCount,
          countNeutral: neutralCount,
        },
        dissentingSignals: agentSignals.filter((s) => s.direction !== consensusDir),
        dissentRate: agentSignals.filter((s) => s.direction !== consensusDir).length / agentSignals.length,
        topPerformers: agentSignals
          .sort((a, b) => (b.trackRecord?.winRate || 0) - (a.trackRecord?.winRate || 0))
          .slice(0, 3)
          .map((a) => ({
            agentId: a.agentId,
            agentName: a.agentName,
            winRate: a.trackRecord?.winRate || 0,
            recentProfitFactor: 1.5, // Placeholder
          })),
      };
    } catch (error) {
      logger.error(`Agent analysis failed for ${symbol}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Analyze current price action
   */
  private async analyzePriceAction(symbol: string): Promise<PriceActionAnalysis | null> {
    try {
      const priceData = await this.priceService.getCurrentPrice(symbol);
      const ohlcData = await this.priceService.getRecentCandles(symbol, '1h', 24);

      if (!priceData || !ohlcData) {
        logger.warn(`No price data available for ${symbol}`);
        return null;
      }

      const recentHigh = Math.max(...ohlcData.map((c: any) => c.high));
      const recentLow = Math.min(...ohlcData.map((c: any) => c.low));
      const pricePosition = (priceData.price - recentLow) / (recentHigh - recentLow);

      // Simple momentum calculation
      const momentumScore = this.calculateMomentum(ohlcData);

      return {
        source: 'PRICE_ACTION',
        timestamp: Date.now(),
        currentPrice: priceData.price,
        recentHigh,
        recentLow,
        pricePosition: Math.min(1, Math.max(0, pricePosition)),
        momentum: {
          direction: momentumScore > 10 ? 'BULLISH' : momentumScore < -10 ? 'BEARISH' : 'NEUTRAL',
          score: momentumScore,
          trend: momentumScore > 0 ? 'accelerating' : 'decelerating',
        },
        volume: {
          trend: 'stable',
          avgVolume: ohlcData.reduce((sum: number, c: any) => sum + (c.volume || 0), 0) / ohlcData.length,
          currentVolume: ohlcData[ohlcData.length - 1]?.volume || 0,
          conclusion: 'Volume trending stable',
        },
        recentAction: {
          candles: ohlcData.map((c: any) => ({
            time: c.timestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          })),
          pattern: 'unknown',
        },
      };
    } catch (error) {
      logger.error(`Price action analysis failed for ${symbol}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Calculate consensus direction from all sources
   */
  private calculateConsensus(
    mlAnalysis: MLSourceAnalysis | null,
    scannerAnalysis: ScannerSourceAnalysis | null,
    agentAnalysis: AgentSourceAnalysis | null,
    priceAnalysis: PriceActionAnalysis | null
  ): ConsensuData {
    const sourceAgreements: any[] = [];
    const directions: Direction[] = [];
    const confidences: number[] = [];

    // Collect all source directions and confidences
    if (mlAnalysis) {
      sourceAgreements.push({
        source: 'ML',
        direction: mlAnalysis.consensus.direction,
        confidence: mlAnalysis.consensus.confidence,
      });
      directions.push(mlAnalysis.consensus.direction);
      confidences.push(mlAnalysis.consensus.confidence);
    }

    if (scannerAnalysis) {
      sourceAgreements.push({
        source: 'SCANNER',
        direction: scannerAnalysis.signal.direction,
        confidence: scannerAnalysis.signal.confidence,
      });
      directions.push(scannerAnalysis.signal.direction);
      confidences.push(scannerAnalysis.signal.confidence);
    }

    if (agentAnalysis) {
      sourceAgreements.push({
        source: 'AGENTS',
        direction: agentAnalysis.consensus.direction,
        confidence: agentAnalysis.consensus.confidence,
      });
      directions.push(agentAnalysis.consensus.direction);
      confidences.push(agentAnalysis.consensus.confidence);
    }

    if (priceAnalysis) {
      sourceAgreements.push({
        source: 'PRICE_ACTION',
        direction: priceAnalysis.momentum.direction,
        confidence: Math.abs(priceAnalysis.momentum.score) / 100,
      });
      directions.push(priceAnalysis.momentum.direction);
      confidences.push(Math.abs(priceAnalysis.momentum.score) / 100);
    }

    // Determine consensus direction
    const consensusDirection = this.determineConsensus(directions);
    const agreeCount = sourceAgreements.filter((s) => s.direction === consensusDirection).length;
    const avgConfidence = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0.5;

    return {
      direction: consensusDirection,
      confidence: avgConfidence,
      strength: Math.round(avgConfidence * 100),
      sourceAgreement: sourceAgreements.map((s) => ({
        ...s,
        agrees: s.direction === consensusDirection,
      })),
      agreementPercent: sourceAgreements.length > 0 ? agreeCount / sourceAgreements.length : 0,
      agreementCount: agreeCount,
      totalSources: sourceAgreements.length,
      conviction: this.determineConviction(
        agreeCount,
        sourceAgreements.length,
        avgConfidence
      ),
      convictionReasoning: `${agreeCount}/${sourceAgreements.length} sources agree with ${consensusDirection}`,
      confidenceTrend: {
        previous1h: avgConfidence,
        previous4h: avgConfidence,
        direction: 'stable',
      },
      agreement: sourceAgreements.length > 0 ? agreeCount / sourceAgreements.length : 0,
      timestamp: Date.now(),
    };
  }

  /**
   * Identify alternative scenarios
   */
  private identifyAlternatives(
    mlAnalysis: MLSourceAnalysis | null,
    scannerAnalysis: ScannerSourceAnalysis | null,
    agentAnalysis: AgentSourceAnalysis | null,
    priceAnalysis: PriceActionAnalysis | null,
    consensus: ConsensuData
  ): AlternativeView[] {
    const alternatives: AlternativeView[] = [];

    // Alternative 1: Opposite direction if low agreement
    if (consensus.agreementPercent < 0.7 && consensus.agreementCount > 0) {
      const oppositeDir = consensus.direction === 'BULLISH' ? 'BEARISH' : 'BULLISH';
      const oppositeCount = consensus.totalSources - consensus.agreementCount;

      alternatives.push({
        title: `${oppositeDir} Reversal Scenario`,
        direction: oppositeDir,
        probability: (oppositeCount / consensus.totalSources) * 0.7,
        triggerCondition: `If price breaks below support or ${
          agentAnalysis?.dissentingSignals.length || 0
        } agents prove correct`,
        targetPrice: scannerAnalysis?.levels.support[0]?.price || 0,
        implications: 'Strong reversal would indicate trend change',
        sourcesSupporting: consensus.sourceAgreement
          .filter((s) => s.direction === oppositeDir)
          .map((s) => s.source as SourceType),
      });
    }

    // Alternative 2: NEUTRAL if high divergence
    if (consensus.agreementPercent < 0.5) {
      alternatives.push({
        title: 'Range-bound Consolidation',
        direction: 'NEUTRAL',
        probability: 0.3,
        triggerCondition: 'If price fails to break above resistance and below support',
        targetPrice: (scannerAnalysis?.levels.support[0]?.price || 0 +
          (scannerAnalysis?.levels.resistance[0]?.price || 0)) /
          2,
        implications: 'Market consolidating before next breakout',
        sourcesSupporting: [],
      });
    }

    return alternatives;
  }

  /**
   * Classify and create trade opportunities using TradeClassifier
   * Integrates with existing trade classification logic + velocity profiles
   */
  private classifyOpportunities(
    symbol: string,
    mlAnalysis: MLSourceAnalysis | null,
    scannerAnalysis: ScannerSourceAnalysis | null,
    consensus: ConsensuData,
    currentPrice: number
  ): TradeOpportunity[] {
    const opportunities: TradeOpportunity[] = [];

    // Determine trade types based on sources
    const tradeTypes = this.determineTradeTypes(mlAnalysis, scannerAnalysis);

    for (const tradeType of tradeTypes) {
      // Use TradeClassifier for enhanced classification with velocity profiles & regime awareness
      const classificationFactors: ClassificationFactors = {
        volatilityRatio: mlAnalysis?.metrics.volatilityLevel === 'high' ? 1.8 : 
                        mlAnalysis?.metrics.volatilityLevel === 'extreme' ? 2.5 : 1.0,
        adx: mlAnalysis?.metrics.trendStrength || 50,
        volumeRatio: 1.2, // Placeholder
        patternType: scannerAnalysis?.primaryPattern.name || 'UNKNOWN',
        assetCategory: 'fundamental', // Placeholder
        marketRegime: 'TRENDING',
        mlPredictedHoldingPeriodCandles: this.estimateHoldingCandles(tradeType),
        mlHoldingPeriodConfidence: consensus.confidence,
      };

      const tradeClassification = this.tradeClassifier.classifyTrade(
        classificationFactors,
        currentPrice
      );

      // Build opportunity with classification enhancements
      const opportunity: TradeOpportunity = {
        id: `OPP-${symbol}-${tradeType}-${Date.now()}`,
        symbol,
        type: tradeType,
        direction: consensus.direction,
        entryZone: {
          low: currentPrice * 0.995,
          high: currentPrice * 1.005,
          optimal: currentPrice,
          reasoning: 'Current price with minimal slippage',
        },
        targets: this.calculateTargetsFromClassification(
          tradeClassification,
          currentPrice,
          consensus.direction,
          scannerAnalysis
        ),
        stopLoss: {
          price:
            scannerAnalysis?.levels.support[0]?.price ||
            (consensus.direction === 'BULLISH'
              ? currentPrice * (1 - tradeClassification.stopLossPercent)
              : currentPrice * (1 + tradeClassification.stopLossPercent)),
          lossPercent: tradeClassification.stopLossPercent * 100,
          riskUSD: tradeClassification.stopLossDollar || 20,
          method: 'support-based',
        },
        riskRewardRatio: this.calculateRiskRewardFromClassification(tradeClassification, currentPrice),
        expectedValue: this.calculateExpectedValue(
          consensus.confidence,
          scannerAnalysis?.levels.resistance[0]?.price || currentPrice * 1.02,
          currentPrice
        ),
        probability: consensus.confidence,
        confidence: consensus.confidence * tradeClassification.confidence,
        qualityScore: Math.round(
          consensus.strength * (consensus.agreementPercent * 0.5 + 0.5) * tradeClassification.confidence
        ),
        supportingSources: consensus.sourceAgreement
          .filter((s) => s.agrees)
          .map((s) => ({
            source: s.source,
            contribution: s.confidence,
            reasoning: `${s.source} confirms ${consensus.direction}`,
          })),
        timeframesAnalyzed: mlAnalysis?.timeframes.map((t) => t.timeframe) || ['1h'],
        estimatedDuration: `${tradeClassification.holdingPeriodHours}h (${tradeType})`,
        entryStrategy: {
          conservative: {
            price: currentPrice * (consensus.direction === 'BULLISH' ? 0.999 : 1.001),
            waitCondition: 'Wait for confirmation candle',
          },
          optimal: {
            price: currentPrice,
            description: `Entry based on ${tradeType} classification`,
          },
          aggressive: {
            price: currentPrice * (consensus.direction === 'BULLISH' ? 1.001 : 0.999),
            riskOfMissing: `May miss quick ${tradeType} move`,
          },
        },
        scaleOut: this.buildScaleOutPlan(
          tradeClassification,
          currentPrice,
          consensus.direction,
          scannerAnalysis
        ),
        recommendedSize: {
          method: 'percentage',
          multiplier: tradeClassification.confidence,
          maxUSD: 1000,
          reasoning: `Based on ${(consensus.confidence * 100).toFixed(0)}% confidence & ${tradeType} classification`,
        },
        identifiedAt: Date.now(),
        expiresAt: Date.now() + tradeClassification.holdingPeriodHours * 60 * 60 * 1000,
      };

      opportunities.push(opportunity);
    }

    // Sort by quality
    opportunities.sort((a, b) => b.qualityScore - a.qualityScore);

    return opportunities;
  }

  /**
   * Calculate targets using trade classification data
   */
  private calculateTargetsFromClassification(
    classification: TradeClassification,
    currentPrice: number,
    direction: Direction,
    scannerAnalysis: ScannerSourceAnalysis | null
  ): any[] {
    return [
      {
        level:
          direction === 'BULLISH'
            ? currentPrice * (1 + classification.profitTargetPercent * 0.5)
            : currentPrice * (1 - classification.profitTargetPercent * 0.5),
        profitPercent: (classification.profitTargetPercent * 50).toFixed(2),
        percentOfPosition: 0.25,
        reasoning: `Quick target (50% of ${classification.type} target)`,
      },
      {
        level:
          classification.profitTargetDollar ||
          (direction === 'BULLISH'
            ? currentPrice * (1 + classification.profitTargetPercent)
            : currentPrice * (1 - classification.profitTargetPercent)),
        profitPercent: (classification.profitTargetPercent * 100).toFixed(2),
        percentOfPosition: 0.75,
        reasoning: `Main target (${classification.type} optimized from velocity profiles)`,
      },
    ];
  }

  /**
   * Calculate risk/reward using classification data
   */
  private calculateRiskRewardFromClassification(
    classification: TradeClassification,
    currentPrice: number
  ): number {
    const sl = currentPrice * (1 - classification.stopLossPercent);
    const tp = currentPrice * (1 + classification.profitTargetPercent);

    const risk = Math.abs(currentPrice - sl);
    const reward = Math.abs(tp - currentPrice);

    return risk > 0 ? reward / risk : 0;
  }

  /**
   * Build scale-out plan from classification
   */
  private buildScaleOutPlan(
    classification: TradeClassification,
    currentPrice: number,
    direction: Direction,
    scannerAnalysis: ScannerSourceAnalysis | null
  ): any[] {
    const pyramidLevels = classification.pyramidStrategy === 'pyramid-5' ? 5 : 
                         classification.pyramidStrategy === 'pyramid-3' ? 3 : 1;

    if (pyramidLevels === 1) {
      return [
        {
          percentOfPosition: 1.0,
          priceLevel: currentPrice * (direction === 'BULLISH' ? 
            1 + classification.profitTargetPercent : 
            1 - classification.profitTargetPercent),
          description: 'All-at-once exit at target',
        },
      ];
    }

    const scaleOuts = [];
    const increment = 1 / pyramidLevels;
    const targetPrice = currentPrice * (direction === 'BULLISH' ? 
      1 + classification.profitTargetPercent : 
      1 - classification.profitTargetPercent);

    for (let i = 1; i <= pyramidLevels; i++) {
      scaleOuts.push({
        percentOfPosition: increment,
        priceLevel: currentPrice + ((targetPrice - currentPrice) * (i / pyramidLevels)),
        description: `Scale ${i}/${pyramidLevels}`,
      });
    }

    return scaleOuts;
  }

  /**
   * Estimate holding period in candles for trade type
   */
  private estimateHoldingCandles(tradeType: TradeType): number {
    const estimates: Record<TradeType, number> = {
      SCALP: 5,
      DAY: 50,
      SWING: 240,
    };
    return estimates[tradeType];
  }

  /**
   * Assess overall risk
   */
  private assessRisk(
    symbol: string,
    consensus: ConsensuData,
    opportunities: TradeOpportunity[],
    volatilityLevel?: string
  ): RiskAssessment {
    const riskFactors: RiskFactor[] = [];

    // Add volatility as risk factor
    const volLevel = volatilityLevel || 'medium';
    const volRiskMap: Record<string, 'low' | 'medium' | 'high'> = {
      low: 'low',
      medium: 'medium',
      high: 'high',
      extreme: 'high',
    };

    riskFactors.push({
      name: 'Volatility',
      level: volRiskMap[volLevel],
      description: `Current volatility is ${volLevel}`,
      impact: volLevel === 'extreme' ? 0.8 : volLevel === 'high' ? 0.6 : 0.3,
    });

    // Add agreement risk
    if (consensus.agreementPercent < 0.6) {
      riskFactors.push({
        name: 'Low Source Agreement',
        level: 'medium',
        description: `Only ${Math.round(consensus.agreementPercent * 100)}% of sources agree`,
        impact: 1 - consensus.agreementPercent,
      });
    }

    const totalRiskScore = riskFactors.reduce((sum, f) => sum + f.impact * 100, 0) / riskFactors.length;

    return {
      overallRiskScore: Math.min(100, totalRiskScore),
      riskLevel: totalRiskScore > 70 ? 'extreme' : totalRiskScore > 50 ? 'high' : 'medium',
      factors: riskFactors,
      marketConditions: {
        trend: consensus.strength > 70 ? 'strong' : consensus.strength > 40 ? 'moderate' : 'weak',
        volatility: (volLevel as any) || 'medium',
        liquidityLevel: 'good', // Placeholder
        regimeStability: 'stable', // Placeholder
      },
      constraints: {
        maxPositionPercent: 2,
        dailyRiskLimitPercent: 5,
        recommendedStopPercent: 2,
      },
      warnings: riskFactors
        .filter((f) => f.level === 'high' || f.level === 'medium')
        .map((f) => f.description),
      criticalIssues:
        riskFactors.filter((f) => f.level === 'high').map((f) => f.description) ||
        [],
    };
  }

  /**
   * Build executive summary
   */
  private buildExecutiveSummary(
    symbol: string,
    consensus: ConsensuData,
    opportunities: TradeOpportunity[],
    riskAssessment: RiskAssessment
  ): ExecutiveSummary {
    const topOpp = opportunities[0];
    const rec =
      consensus.strength > 80
        ? consensus.direction === 'BULLISH'
          ? 'STRONG_BUY'
          : 'STRONG_SELL'
        : consensus.strength > 60
          ? consensus.direction === 'BULLISH'
            ? 'BUY'
            : 'SELL'
          : 'HOLD';

    return {
      symbol,
      timestamp: Date.now(),
      reportId: `SR-${symbol}-${Date.now()}`,
      direction: consensus.direction,
      confidence: consensus.confidence,
      strength: consensus.strength,
      status: `${consensus.direction} with ${Math.round(consensus.confidence * 100)}% confidence (${consensus.agreementCount}/${consensus.totalSources} sources aligned)`,
      recommendation: rec,
      metrics: {
        sourceConsensus: consensus.agreementPercent,
        timeframeConsensus: 0.75, // Placeholder
        overallQuality: opportunities.length > 0 ? topOpp.qualityScore : 0,
      },
      nextAction: topOpp
        ? `Enter ${topOpp.type} at ${topOpp.entryZone.optimal.toFixed(2)}, target ${topOpp.targets[0]?.level.toFixed(2) || 'TBD'}`
        : 'No immediate opportunities',
    };
  }

  /**
   * Assemble complete report
   */
  private buildReport(
    reportId: string,
    symbol: string,
    executiveSummary: ExecutiveSummary,
    mlAnalysis: MLSourceAnalysis | null,
    scannerAnalysis: ScannerSourceAnalysis | null,
    agentAnalysis: AgentSourceAnalysis | null,
    priceAnalysis: PriceActionAnalysis | null,
    consensus: ConsensuData,
    alternatives: AlternativeView[],
    opportunities: TradeOpportunity[],
    riskAssessment: RiskAssessment,
    generatedIn: number
  ): ScoutReport {
    return {
      reportId,
      symbol,
      timestamp: Date.now(),
      version: '1.0.0',
      executiveSummary,
      sourcesAnalysis: {
        ml: mlAnalysis || undefined,
        scanner: scannerAnalysis || undefined,
        agents: agentAnalysis || undefined,
        priceAction: priceAnalysis || undefined,
      },
      consensus,
      alternatives,
      opportunities,
      riskAssessment,
      insights: {
        bestTimeframe: mlAnalysis?.timeframes[0]?.timeframe || '1h',
        sourceReliability: [
          ...(mlAnalysis
            ? [
                {
                  source: 'ML' as SourceType,
                  recentAccuracy: 0.72,
                  trackRecord: 0.68,
                },
              ]
            : []),
          ...(scannerAnalysis
            ? [
                {
                  source: 'SCANNER' as SourceType,
                  recentAccuracy: 0.65,
                  trackRecord: 0.60,
                },
              ]
            : []),
        ],
        patternFrequency: 'Moderate',
        historicalWinRate: consensus.confidence,
      },
      generatedIn,
      cacheStatus: 'fresh',
      nextUpdateIn: 5 * 60 * 1000,
    };
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  /**
   * Rank opportunities by expected value
   */
  rankByExpectedValue(opportunities: TradeOpportunity[]): TradeOpportunity[] {
    return [...opportunities].sort((a, b) => (b.expectedValue || 0) - (a.expectedValue || 0));
  }

  /**
   * Fetch agent signals from gateway/agent services
   */
  private async fetchAgentSignals(symbol: string): Promise<any[]> {
    // Placeholder: Would fetch from gateway and RPG agent systems
    return [];
  }

  /**
   * Determine consensus direction from multiple directions
   */
  private determineConsensus(directions: Direction[]): Direction {
    const bullish = directions.filter((d) => d === 'BULLISH').length;
    const bearish = directions.filter((d) => d === 'BEARISH').length;

    if (bullish > bearish) return 'BULLISH';
    if (bearish > bullish) return 'BEARISH';
    return 'NEUTRAL';
  }

  /**
   * Determine conviction level
   */
  private determineConviction(
    agreeCount: number,
    totalSources: number,
    confidence: number
  ): 'strong' | 'moderate' | 'weak' | 'conflicted' {
    const agreement = agreeCount / totalSources;

    if (agreement > 0.75 && confidence > 0.7) return 'strong';
    if (agreement > 0.5 && confidence > 0.5) return 'moderate';
    if (agreement < 0.5) return 'conflicted';
    return 'weak';
  }

  /**
   * Map ML direction to standard Direction type
   */
  private mapMLDirection(dir: string): Direction {
    return dir === 'BULLISH' || dir === 'LONG' ? 'BULLISH' : dir === 'BEARISH' || dir === 'SHORT' ? 'BEARISH' : 'NEUTRAL';
  }

  /**
   * Map generic direction
   */
  private mapDirection(dir: string): Direction {
    return dir === 'LONG' || dir === 'BULLISH' ? 'BULLISH' : dir === 'SHORT' || dir === 'BEARISH' ? 'BEARISH' : 'NEUTRAL';
  }

  /**
   * Extract top indicators from ML output
   */
  private extractTopIndicators(indicators: Record<string, any>): Record<string, any> {
    return Object.entries(indicators)
      .slice(0, 5)
      .reduce(
        (acc, [key, val]) => ({
          ...acc,
          [key]: {
            value: val?.value || 0,
            impact: val?.impact || 0.5,
            name: key,
          },
        }),
        {}
      );
  }

  /**
   * Extract top indicators list
   */
  private extractTopIndicatorsList(timeframeSignals: any[]): any[] {
    const allIndicators: any[] = [];
    timeframeSignals.forEach((ts) => {
      Object.values(ts.indicators).forEach((ind: any) => {
        allIndicators.push(ind);
      });
    });
    return allIndicators.slice(0, 5);
  }

  /**
   * Estimate pattern duration
   */
  private estimateDuration(timestamp: number): string {
    const age = Date.now() - timestamp;
    const minutes = Math.floor(age / 60000);

    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  }

  /**
   * Assess signal quality
   */
  private assessQuality(confidence: number): 'strong' | 'moderate' | 'weak' {
    return confidence > 0.7 ? 'strong' : confidence > 0.4 ? 'moderate' : 'weak';
  }

  /**
   * Determine trade types
   */
  private determineTradeTypes(
    mlAnalysis: MLSourceAnalysis | null,
    scannerAnalysis: ScannerSourceAnalysis | null
  ): TradeType[] {
    const types: TradeType[] = [];

    // ML with short timeframes → scalp
    if (mlAnalysis?.timeframes.some((tf) => ['1m', '5m'].includes(tf.timeframe))) {
      types.push('SCALP');
    }

    // ML with medium timeframes → day
    if (mlAnalysis?.timeframes.some((tf) => ['15m', '1h'].includes(tf.timeframe))) {
      types.push('DAY');
    }

    // ML with long timeframes or scanner → swing
    if (mlAnalysis?.timeframes.some((tf) => ['4h', '1d'].includes(tf.timeframe)) || scannerAnalysis) {
      types.push('SWING');
    }

    return types.length > 0 ? types : ['DAY'];
  }

  /**
   * Calculate targets
   */
  private calculateTargets(
    tradeType: TradeType,
    currentPrice: number,
    direction: Direction,
    scannerAnalysis: ScannerSourceAnalysis | null
  ): any[] {
    const multipliers = {
      SCALP: [1.005, 1.01],
      DAY: [1.015, 1.03],
      SWING: [1.03, 1.06],
    };

    const mults = multipliers[tradeType];
    const resistancPrice = scannerAnalysis?.levels.resistance[0]?.price;

    return [
      {
        level: direction === 'BULLISH' ? currentPrice * mults[0] : currentPrice / mults[0],
        profitPercent: ((mults[0] - 1) * 100).toFixed(2),
        percentOfPosition: 0.25,
        reasoning: `Quick profit target for ${tradeType}`,
      },
      {
        level: resistancPrice || (direction === 'BULLISH' ? currentPrice * mults[1] : currentPrice / mults[1]),
        profitPercent: ((mults[1] - 1) * 100).toFixed(2),
        percentOfPosition: 0.75,
        reasoning: 'Main target',
      },
    ];
  }

  /**
   * Calculate risk/reward ratio
   */
  private calculateRiskReward(currentPrice: number, scannerAnalysis: ScannerSourceAnalysis | null): number {
    const sl = scannerAnalysis?.levels.support[0]?.price || currentPrice * 0.98;
    const tp = scannerAnalysis?.levels.resistance[0]?.price || currentPrice * 1.02;

    const risk = Math.abs(currentPrice - sl);
    const reward = Math.abs(tp - currentPrice);

    return reward / risk;
  }

  /**
   * Calculate expected value
   */
  private calculateExpectedValue(
    confidence: number,
    targetPrice: number,
    currentPrice: number
  ): number {
    const profit = (targetPrice - currentPrice) / currentPrice;
    const loss = 0.02; // 2% stop loss

    return confidence * profit - (1 - confidence) * loss;
  }

  /**
   * Calculate momentum
   */
  private calculateMomentum(candles: any[]): number {
    if (candles.length < 2) return 0;

    const recent = candles[candles.length - 1].close;
    const previous = candles[0].close;

    return ((recent - previous) / previous) * 100;
  }

  /**
   * Estimate trade type name
   */
  private estimateTradeType(type: TradeType): string {
    const estimates: Record<TradeType, string> = {
      SCALP: '5-15 min',
      DAY: '1-4 hours',
      SWING: '4 hours - 3 days',
    };
    return estimates[type];
  }

  /**
   * Cache management
   */
  private getFromCache(symbol: string): ScoutReport | null {
    const cached = this.reportCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.report;
    }
    return null;
  }

  private setCache(symbol: string, report: ScoutReport): void {
    this.reportCache.set(symbol, {
      report,
      timestamp: Date.now(),
    });
  }

  /**
   * Map internal direction values (BULLISH/BEARISH/NEUTRAL) to client format (BUY/SELL/HOLD)
   */
  public mapDirectionToClient(direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL'): 'BUY' | 'SELL' | 'HOLD' {
    switch (direction) {
      case 'BULLISH':
        return 'BUY';
      case 'BEARISH':
        return 'SELL';
      case 'NEUTRAL':
        return 'HOLD';
    }
  }
}
