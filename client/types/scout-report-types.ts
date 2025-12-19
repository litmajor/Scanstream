/**
 * Scout Report Type Definitions (Client)
 * 
 * Complete type system for Scout Reports:
 * - Unified multi-source signal aggregation
 * - Consensus and alternative view tracking
 * - Trade opportunity classification (scalp/day/swing)
 * - Risk assessment and metrics
 */

// Direction & Confidence Types
export type Direction = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type TradeType = 'SCALP' | 'DAY' | 'SWING' | 'POSITION';
export type SourceType = 'ML' | 'SCANNER' | 'AGENTS' | 'PRICE_ACTION';
export type SignalQuality = 'strong' | 'moderate' | 'weak';

// Individual Source Analyses
export interface TimeframeSignal {
  timeframe: string;
  direction: Direction;
  confidence: number;
  strength: number;
  indicators: {
    [key: string]: {
      value: number;
      impact: number;
      name: string;
    };
  };
  predictedMove: number;
  timestamp: number;
}

export interface MLSourceAnalysis {
  source: 'ML';
  timestamp: number;
  consensus: {
    direction: Direction;
    confidence: number;
    strength: number;
  };
  timeframes: TimeframeSignal[];
  timeframesAligned: number;
  alignmentPercent: number;
  metrics: {
    volatilityLevel: 'low' | 'medium' | 'high' | 'extreme';
    regimeDuration: string;
    trendStrength: number;
    momentumScore: number;
  };
  topIndicators: Array<{
    name: string;
    impact: number;
    value: number;
    interpretation: string;
  }>;
  positionSizingRecommendation: {
    method: 'confidence-based' | 'volatility-adjusted' | 'kelly';
    multiplier: number;
    reasoning: string;
  };
}

export interface ScannerPatternMatch {
  name: string;
  confidence: number;
  confluenceScore: number;
  foundAt: number;
  duration: string;
}

export interface ScannerSourceAnalysis {
  source: 'SCANNER';
  timestamp: number;
  primaryPattern: ScannerPatternMatch;
  secondaryPatterns: ScannerPatternMatch[];
  levels: {
    support: Array<{
      price: number;
      strength: number;
      type: 'major' | 'minor';
    }>;
    resistance: Array<{
      price: number;
      strength: number;
      type: 'major' | 'minor';
    }>;
  };
  volumeAnalysis: {
    trend: 'increasing' | 'decreasing' | 'stable';
    avgVolume: number;
    currentVolume: number;
    volumePercent: number;
    conclusion: string;
  };
  signal: {
    direction: Direction;
    confidence: number;
    quality: SignalQuality;
  };
  tradeApproach: {
    entryStrategy: 'aggressive' | 'optimal' | 'conservative';
    targets: number[];
    stopLossStrategy: 'support-based' | 'atr-based' | 'percentage';
  };
}

export interface AgentSignal {
  agentId: string;
  agentName: string;
  direction: Direction;
  confidence: number;
  reasoning: string;
  trackRecord: {
    totalSignals: number;
    winRate: number;
    avgRiskReward: number;
    lastUpdateTime: number;
  };
  timestamp: number;
}

export interface AgentSourceAnalysis {
  source: 'AGENTS';
  timestamp: number;
  agentSignals: AgentSignal[];
  consensus: {
    direction: Direction;
    confidence: number;
    countBullish: number;
    countBearish: number;
    countNeutral: number;
  };
  dissentingSignals: AgentSignal[];
  dissentRate: number;
  topPerformers: Array<{
    agentId: string;
    agentName: string;
    winRate: number;
    recentProfitFactor: number;
  }>;
}

export interface PriceActionAnalysis {
  source: 'PRICE_ACTION';
  timestamp: number;
  currentPrice: number;
  recentHigh: number;
  recentLow: number;
  pricePosition: number;
  momentum: {
    direction: Direction;
    score: number;
    trend: 'accelerating' | 'stable' | 'decelerating';
  };
  volume: {
    trend: 'increasing' | 'decreasing' | 'stable';
    avgVolume: number;
    currentVolume: number;
    conclusion: string;
  };
  recentAction: {
    candles: Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
    pattern: string;
  };
}

// Consensus & Alternatives
export interface ConsensusData {
  direction: Direction;
  confidence: number;
  strength: number;
  sourceAgreement: {
    source: SourceType;
    direction: Direction;
    confidence: number;
    agrees: boolean;
  }[];
  agreementPercent: number;
  agreementCount: number;
  totalSources: number;
  bullishSources?: number;
  bearishSources?: number;
  neutralSources?: number;
  conviction: 'strong' | 'moderate' | 'weak' | 'conflicted';
  convictionReasoning: string;
  confidenceTrend: {
    previous1h: number;
    previous4h: number;
    direction: 'increasing' | 'decreasing' | 'stable';
  };
}

export interface AlternativeView {
  title: string;
  direction: Direction;
  probability: number;
  triggerCondition: string;
  targetPrice: number;
  implications: string;
  sourcesSupporting: SourceType[];
}

// Trade Opportunities
export interface TradeOpportunity {
  id: string;
  symbol: string;
  type: TradeType;
  direction: Direction;
  entryZone: {
    low: number;
    high: number;
    optimal: number;
    reasoning: string;
  };
  targets: Array<{
    level: number;
    profitPercent: number;
    percentOfPosition: number;
    reasoning: string;
  }>;
  stopLoss: {
    price: number;
    lossPercent: number;
    riskUSD: number;
    method: 'atr-based' | 'support-based' | 'percentage';
  };
  riskRewardRatio: number;
  expectedValue: number;
  probability: number;
  confidence: number;
  qualityScore: number;
  supportingSources: {
    source: SourceType;
    contribution: number;
    reasoning: string;
  }[];
  estimatedDuration: string;
  timeframesAnalyzed: string[];
  entryStrategy: {
    conservative: {
      price: number;
      waitCondition: string;
    };
    optimal: {
      price: number;
      description: string;
    };
    aggressive: {
      price: number;
      riskOfMissing: string;
    };
  };
  scaleOut: Array<{
    percentOfPosition: number;
    priceLevel: number;
    description: string;
  }>;
  recommendedSize: {
    method: string;
    multiplier: number;
    maxUSD: number;
    reasoning: string;
  };
  identifiedAt: number;
  expiresAt: number;
}

// Risk Assessment
export interface RiskFactor {
  name: string;
  level: 'low' | 'medium' | 'high';
  description: string;
  impact: number;
}

export interface RiskAssessment {
  overallRiskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  factors: RiskFactor[];
  marketConditions: {
    trend: 'strong' | 'moderate' | 'weak';
    volatility: 'low' | 'medium' | 'high' | 'extreme';
    liquidityLevel: 'excellent' | 'good' | 'fair' | 'poor';
    regimeStability: 'stable' | 'transitioning' | 'unstable';
  };
  constraints: {
    maxPositionPercent: number;
    dailyRiskLimitPercent: number;
    recommendedStopPercent: number;
  };
  warnings: string[];
  criticalIssues: string[];
}

// Full Scout Report
export interface ExecutiveSummary {
  symbol: string;
  timestamp: number;
  reportId: string;
  direction: Direction;
  confidence: number;
  strength: number;
  status: string;
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  metrics: {
    sourceConsensus: number;
    timeframeConsensus: number;
    overallQuality: number;
  };
  nextAction: string;
}

export interface ScoutReport {
  reportId: string;
  symbol: string;
  timestamp: number;
  version: string;
  executiveSummary: ExecutiveSummary;
  sourcesAnalysis: {
    ml?: MLSourceAnalysis;
    scanner?: ScannerSourceAnalysis;
    agents?: AgentSourceAnalysis;
    priceAction?: PriceActionAnalysis;
  };
  consensus: ConsensusData;
  alternatives: AlternativeView[];
  opportunities: TradeOpportunity[];
  riskAssessment: RiskAssessment;
  insights: {
    bestTimeframe: string;
    sourceReliability: {
      source: SourceType;
      recentAccuracy: number;
      trackRecord: number;
    }[];
    patternFrequency: string;
    historicalWinRate: number;
  };
  generatedIn: number;
  cacheStatus: 'fresh' | 'cached' | 'stale';
  nextUpdateIn: number;
}

export interface ScoutReportRequest {
  symbol: string;
  timeframe?: string;
  includeHistorical?: boolean;
  filterByConfidence?: number;
  filterByType?: TradeType;
}

export interface BatchScoutReportRequest {
  symbols: string[];
  filters?: {
    minConfidence?: number;
    tradeType?: TradeType;
    minRiskReward?: number;
    maxRiskLevel?: 'low' | 'medium' | 'high';
  };
  ranking?: 'confidence' | 'riskReward' | 'expectedValue' | 'quality';
  limit?: number;
}

export interface ScoutReportComparison {
  symbol1: string;
  symbol2: string;
  timestamp: number;
  comparison: {
    metric: string;
    value1: any;
    value2: any;
    difference: any;
    winner: string;
  }[];
  recommendation: string;
}

export interface ScoutReportStatistics {
  totalReportsGenerated: number;
  reportsBySymbol: Record<string, number>;
  opportunitiesByType: Record<TradeType, number>;
  averageConfidence: number;
  averageRiskRewardRatio: number;
  sourceReliance: Record<SourceType, number>;
  topOpportunities: TradeOpportunity[];
  averageGenerationTime: number;
}

export interface OpportunitiesSummary {
  symbol: string;
  totalOpportunities: number;
  byType: {
    SCALP: number;
    DAY: number;
    SWING: number;
    POSITION?: number;
  };
  byQuality: {
    strong: number;
    moderate: number;
    weak: number;
  };
  averageRiskReward: number;
  bestOpportunity: TradeOpportunity | null;
}
