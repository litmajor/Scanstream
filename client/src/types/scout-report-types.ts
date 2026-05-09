export interface TradeOpportunity {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL' | 'HOLD';
  entry: number;
  entryPrice: { min: number; max: number };
  stop: number;
  target: number;
  strength: number;
  confidence: number;
  pattern: string;
  timeframe: string;
  createdAt: Date;
  riskRewardRatio: number;
  sources: string[];
  qualityScore: number;
  probability: number; // 0-1, probability of success
}

export type SourceType = 'technical' | 'macro' | 'sentiment' | 'flow' | 'fundamental';

export interface SourceDetail {
  name: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  strength: number;
  confidence: number;
  color?: string;
}

export interface ConsensusData {
  direction: 'BUY' | 'SELL' | 'HOLD';
  agreement: number; // 0-1, percentage consensus
  bullishSources?: number;
  bearishSources?: number;
  neutralSources?: number;
  sourceDetails?: SourceDetail[];
  dissentingSources?: string[];
  confidenceTrend: {
    previous1h: number;
    previous4h: number;
    direction: 'increasing' | 'decreasing' | 'stable';
  };
  timestamp: Date;
  // Additional server fields
  confidence?: number;
  strength?: number;
  sourceAgreement?: Array<{
    source: string;
    direction: string;
    confidence: number;
    agrees: boolean;
  }>;
  agreementPercent?: number;
  agreementCount?: number;
  totalSources?: number;
  conviction?: 'strong' | 'moderate' | 'weak' | 'conflicted';
  convictionReasoning?: string;
}

export interface ScoutReport {
  timestamp: Date;
  opportunities: TradeOpportunity[];
  consensus: ConsensusData;
  sentiment: 'bullish' | 'bearish' | 'neutral';
}
