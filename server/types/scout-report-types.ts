/**
 * Scout Report Type Definitions
 * 
 * Complete type system for Scout Reports:
 * - Unified multi-source signal aggregation
 * - Consensus and alternative view tracking
 * - Trade opportunity classification (scalp/day/swing)
 * - Risk assessment and metrics
 * 
 * Used by: ScoutReportService, API endpoints, frontend components
 */

// ============================================================================
// DIRECTION & CONFIDENCE TYPES
// ============================================================================

export type Direction = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type TradeType = 'SCALP' | 'DAY' | 'SWING';
export type SourceType = 'ML' | 'SCANNER' | 'AGENTS' | 'PRICE_ACTION';
export type SignalQuality = 'strong' | 'moderate' | 'weak';

// ============================================================================
// INDIVIDUAL SOURCE ANALYSES
// ============================================================================

export interface TimeframeSignal {
  timeframe: string; // '1m', '5m', '15m', '1h', '4h', '1d'
  direction: Direction;
  confidence: number; // 0-1
  strength: number; // 0-100
  indicators: {
    [key: string]: {
      value: number;
      impact: number; // 0-1, how much this indicator influences the signal
      name: string;
    };
  };
  predictedMove: number; // Expected % move
  timestamp: number;
}

export interface MLSourceAnalysis {
  source: 'ML';
  timestamp: number;
  
  // Overall consensus across all timeframes
  consensus: {
    direction: Direction;
    confidence: number; // 0-1, weighted average across timeframes
    strength: number; // 0-100
  };

  // Per-timeframe breakdown
  timeframes: TimeframeSignal[];

  // Timeframe agreement
  timeframesAligned: number; // Count of timeframes agreeing with consensus
  alignmentPercent: number; // % of timeframes aligned

  // Key metrics
  metrics: {
    volatilityLevel: 'low' | 'medium' | 'high' | 'extreme';
    regimeDuration: string; // How long current regime has lasted
    trendStrength: number; // 0-100 ADX-like measure
    momentumScore: number; // -100 to +100
  };

  // Top contributing indicators
  topIndicators: Array<{
    name: string;
    impact: number; // 0-1
    value: number;
    interpretation: string;
  }>;

  // Position sizing recommendation from ML
  positionSizingRecommendation: {
    method: 'confidence-based' | 'volatility-adjusted' | 'kelly';
    multiplier: number; // 0.5-2.0
    reasoning: string;
  };
}

export interface ScannerPatternMatch {
  name: string; // e.g., 'Bull Flag', 'Breakout', 'Reversal'
  confidence: number; // 0-1
  confluenceScore: number; // 0-100, how many technical levels align
  foundAt: number; // Timestamp
  duration: string; // How long pattern has been forming
}

export interface ScannerSourceAnalysis {
  source: 'SCANNER';
  timestamp: number;

  // Primary detected pattern
  primaryPattern: ScannerPatternMatch;

  // Secondary patterns (alternative setups)
  secondaryPatterns: ScannerPatternMatch[];

  // Technical levels
  levels: {
    support: Array<{
      price: number;
      strength: number; // 0-1 based on touches
      type: 'major' | 'minor';
    }>;
    resistance: Array<{
      price: number;
      strength: number;
      type: 'major' | 'minor';
    }>;
  };

  // Volume analysis
  volumeAnalysis: {
    trend: 'increasing' | 'decreasing' | 'stable';
    avgVolume: number;
    currentVolume: number;
    volumePercent: number; // Current vs avg
    conclusion: string;
  };

  // Overall scanner signal
  signal: {
    direction: Direction;
    confidence: number; // 0-1
    quality: SignalQuality;
  };

  // Recommended trade approach
  tradeApproach: {
    entryStrategy: 'aggressive' | 'optimal' | 'conservative';
    targets: number[]; // Multiple target prices
    stopLossStrategy: 'support-based' | 'atr-based' | 'percentage';
  };
}

export interface AgentSignal {
  agentId: string;
  agentName: string;
  direction: Direction;
  confidence: number; // 0-1
  reasoning: string;
  trackRecord: {
    totalSignals: number;
    winRate: number; // 0-1
    avgRiskReward: number;
    lastUpdateTime: number;
  };
  timestamp: number;
}

export interface AgentSourceAnalysis {
  source: 'AGENTS';
  timestamp: number;

  // Individual agent signals
  agentSignals: AgentSignal[];

  // Overall consensus from agents
  consensus: {
    direction: Direction;
    confidence: number; // 0-1, weighted by track record
    countBullish: number;
    countBearish: number;
    countNeutral: number;
  };

  // Dissenting views
  dissentingSignals: AgentSignal[];
  dissentRate: number; // % of agents disagreeing with consensus

  // Top performing agents
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
  recentHigh: number; // Last 24h
  recentLow: number;
  pricePosition: number; // 0-1, where price is between high/low

  // Momentum
  momentum: {
    direction: Direction;
    score: number; // -100 to +100
    trend: 'accelerating' | 'stable' | 'decelerating';
  };

  // Volume trend
  volume: {
    trend: 'increasing' | 'decreasing' | 'stable';
    avgVolume: number;
    currentVolume: number;
    conclusion: string;
  };

  // Recent price action
  recentAction: {
    candles: Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
    pattern: string; // e.g., 'doji', 'hammer', 'engulfing'
  };
}

// ============================================================================
// CONSENSUS & ALTERNATIVES
// ============================================================================

export interface ConsensuData {
  direction: Direction;
  confidence: number; // 0-1, combined confidence from all sources
  strength: number; // 0-100, how strong is the consensus

  // Source agreement breakdown
  sourceAgreement: {
    source: SourceType;
    direction: Direction;
    confidence: number;
    agrees: boolean; // Does it agree with consensus?
  }[];

  // Agreement metrics
  agreementPercent: number; // % of sources agreeing
  agreementCount: number; // # of sources agreeing
  totalSources: number;

  // Conviction level
  conviction: 'strong' | 'moderate' | 'weak' | 'conflicted';
  convictionReasoning: string;

  // Historical confidence trend
  confidenceTrend: {
    previous1h: number;
    previous4h: number;
    direction: 'increasing' | 'decreasing' | 'stable';
  };
}

export interface AlternativeView {
  title: string;
  direction: Direction;
  probability: number; // 0-1
  triggerCondition: string; // When would this scenario occur
  targetPrice: number;
  implications: string;
  sourcesSupporting: SourceType[];
}

// ============================================================================
// TRADE OPPORTUNITIES
// ============================================================================

export interface TradeOpportunity {
  id: string;
  symbol: string;
  type: TradeType;
  
  // Trade direction & entry
  direction: Direction;
  entryZone: {
    low: number;
    high: number;
    optimal: number;
    reasoning: string;
  };

  // Risk & Reward
  targets: Array<{
    level: number;
    profitPercent: number;
    percentOfPosition: number; // % of position to take profit here
    reasoning: string;
  }>;

  stopLoss: {
    price: number;
    lossPercent: number;
    riskUSD: number; // For $1000 max position
    method: 'atr-based' | 'support-based' | 'percentage';
  };

  riskRewardRatio: number; // Reward:Risk ratio
  expectedValue: number; // EV calculation: (probWin × profitUSD) - (probLoss × lossUSD)

  // Probability & Confidence
  probability: number; // 0-1, historical probability of this type of setup
  confidence: number; // 0-1, confidence in THIS specific opportunity
  qualityScore: number; // 0-100, overall quality of setup

  // Supporting factors
  supportingSources: {
    source: SourceType;
    contribution: number; // 0-1
    reasoning: string;
  }[];

  // Trade parameters
  estimatedDuration: string; // e.g., "5-15 min" for scalp, "1-4h" for day
  timeframesAnalyzed: string[];
  
  // Entry strategy
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

  // Scale-out plan
  scaleOut: Array<{
    percentOfPosition: number;
    priceLevel: number;
    description: string;
  }>;

  // Position sizing recommendation
  recommendedSize: {
    method: string;
    multiplier: number; // 0.5-2.0
    maxUSD: number;
    reasoning: string;
  };

  // Timestamp
  identifiedAt: number;
  expiresAt: number; // When this opportunity no longer applies
}

// ============================================================================
// RISK ASSESSMENT
// ============================================================================

export interface RiskFactor {
  name: string;
  level: 'low' | 'medium' | 'high';
  description: string;
  impact: number; // 0-1, how much this impacts overall risk
}

export interface RiskAssessment {
  overallRiskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';

  // Risk factors
  factors: RiskFactor[];

  // Market conditions
  marketConditions: {
    trend: 'strong' | 'moderate' | 'weak';
    volatility: 'low' | 'medium' | 'high' | 'extreme';
    liquidityLevel: 'excellent' | 'good' | 'fair' | 'poor';
    regimeStability: 'stable' | 'transitioning' | 'unstable';
  };

  // Position sizing constraints
  constraints: {
    maxPositionPercent: number; // % of account
    dailyRiskLimitPercent: number; // % of daily budget
    recommendedStopPercent: number; // SL as % from entry
  };

  // Warnings
  warnings: string[];
  criticalIssues: string[];
}

// ============================================================================
// FULL SCOUT REPORT
// ============================================================================

export interface ExecutiveSummary {
  symbol: string;
  timestamp: number;
  reportId: string;

  // Primary direction
  direction: Direction;
  confidence: number; // 0-1
  strength: number; // 0-100

  // Concise status
  status: string; // One line summary
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';

  // Key metrics
  metrics: {
    sourceConsensus: number; // % of sources agreeing
    timeframeConsensus: number; // % of timeframes aligned
    overallQuality: number; // 0-100
  };

  // Next action
  nextAction: string;
}

export interface ScoutReport {
  // Metadata
  reportId: string;
  symbol: string;
  timestamp: number;
  version: string;

  // Executive Summary
  executiveSummary: ExecutiveSummary;

  // Individual source analyses
  sourcesAnalysis: {
    ml?: MLSourceAnalysis;
    scanner?: ScannerSourceAnalysis;
    agents?: AgentSourceAnalysis;
    priceAction?: PriceActionAnalysis;
  };

  // Consolidated views
  consensus: ConsensuData;
  alternatives: AlternativeView[];

  // Identified opportunities
  opportunities: TradeOpportunity[];

  // Risk assessment
  riskAssessment: RiskAssessment;

  // Performance insights
  insights: {
    bestTimeframe: string;
    sourceReliability: {
      source: SourceType;
      recentAccuracy: number; // 0-1
      trackRecord: number; // 0-1
    }[];
    patternFrequency: string; // How common is this pattern
    historicalWinRate: number; // 0-1
  };

  // Metadata for tracking
  generatedIn: number; // milliseconds
  cacheStatus: 'fresh' | 'cached' | 'stale';
  nextUpdateIn: number; // milliseconds until next update
}

// ============================================================================
// BATCH & REQUEST TYPES
// ============================================================================

export interface ScoutReportRequest {
  symbol: string;
  timeframe?: string; // Default: all timeframes
  includeHistorical?: boolean; // Include past reports
  filterByConfidence?: number; // Minimum confidence 0-1
  filterByType?: TradeType; // SCALP | DAY | SWING
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
    winner: string; // Which is better
  }[];

  recommendation: string; // Which setup to trade
}

// ============================================================================
// STATISTICS & TRACKING
// ============================================================================

export interface ScoutReportStatistics {
  totalReportsGenerated: number;
  reportsBySymbol: Record<string, number>;
  opportunitiesByType: Record<TradeType, number>;
  averageConfidence: number;
  averageRiskRewardRatio: number;
  sourceReliance: Record<SourceType, number>;
  topOpportunities: TradeOpportunity[];
  averageGenerationTime: number; // milliseconds
}

export interface OpportunitiesSummary {
  symbol: string;
  totalOpportunities: number;
  byType: {
    SCALP: number;
    DAY: number;
    SWING: number;
  };
  byQuality: {
    strong: number;
    moderate: number;
    weak: number;
  };
  averageRiskReward: number;
  bestOpportunity: TradeOpportunity | null;
}
