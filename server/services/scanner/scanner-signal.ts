/**
 * Scanner Signal Schema with Risk Management Targets
 * 
 * Unifies MomentumScorer output with RiskManagement targets to provide
 * complete signal information including entry, exit, and position sizing.
 */

import type { MomentumScoreResult } from './momentum-scanner';
import type { StopLossTakeProfitResult } from './risk-management';

/**
 * Complete scanner signal with risk management targets
 */
export interface ScannerSignal extends MomentumScoreResult {
  // === RISK MANAGEMENT TARGETS ===
  targets?: ScannerSignalTargets;
  
  // === EXECUTION CONTEXT ===
  symbol: string;
  timestamp: number;
  timeframe: string; // e.g., '5m', '15m', '1h', '1d'
  source: string; // e.g., 'momentum', 'regime', 'composite'
  
  // === SIGNAL METADATA ===
  version: string; // Scanner version
  executionTimeMs: number; // Time to compute signal
}

/**
 * Risk management targets for the signal
 */
export interface ScannerSignalTargets {
  // === ENTRY ===
  entryPrice: number;
  entryPriceConfidence: number; // 0-1
  
  // === EXIT TARGETS ===
  stopLoss: number;
  takeProfit: number;
  
  // === LEVELS ===
  supportLevel: number | null;
  resistanceLevel: number | null;
  
  // === POSITION METRICS ===
  riskAmount: number;
  rewardAmount: number;
  riskRewardRatio: number;
  
  // === PERCENTAGES ===
  stopLossPct: number; // As percentage
  takeProfitPct: number; // As percentage
  
  // === POSITION SIZING ===
  recommendedPositionSize?: number; // Units
  recommendedPositionValue?: number; // USD/value
  recommendedRiskPercentage?: number; // Risk per trade
  
  // === MARGINS & LEVERAGE ===
  marginRequired?: number;
  maximumLeverage?: number;
  recommendedLeverage?: number;
  
  // === LIQUIDATION ===
  liquidationPrice?: number | null;
}

/**
 * Request to compute a scanner signal
 */
export interface ComputeScannerSignalRequest {
  symbol: string;
  timeframe: string;
  marketData: {
    open: number[];
    high: number[];
    low: number[];
    close: number[];
    volume?: number[];
    timestamp?: number[];
  };
  // Optional: Account context for position sizing
  accountBalance?: number;
  riskPerTradePct?: number;
  leverage?: number;
  feeRate?: number;
  
  // Optional: Technical parameters
  riskRewardRatio?: number;
  atr?: number;
  bbUpper?: number;
  bbLower?: number;
  supportLevel?: number;
  resistanceLevel?: number;
}

/**
 * Response with computed signal and targets
 */
export interface ComputeScannerSignalResponse {
  signal: ScannerSignal;
  success: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Batch signal computation request
 */
export interface BatchComputeScannerSignalRequest {
  signals: ComputeScannerSignalRequest[];
  options?: {
    stopOnError?: boolean;
    parallel?: boolean;
  };
}

/**
 * Batch signal computation response
 */
export interface BatchComputeScannerSignalResponse {
  results: ComputeScannerSignalResponse[];
  totalComputed: number;
  failedCount: number;
  executionTimeMs: number;
}

/**
 * Signal statistics for analysis
 */
export interface SignalStatistics {
  symbol: string;
  timeframe: string;
  periodStart: number;
  periodEnd: number;
  
  // Signal distribution
  totalSignals: number;
  buySignals: number;
  sellSignals: number;
  neutralSignals: number;
  
  // Quality metrics
  averageConfidence: number;
  averageSignalStrength: number;
  passedQualityGateCount: number;
  qualityGatePassRate: number;
  
  // Risk metrics
  averageRiskRewardRatio: number;
  averageRiskPercentage: number;
  averageStopLossPct: number;
  averageTakeProfitPct: number;
  
  // Performance (if traded)
  profitableSignals?: number;
  winRate?: number;
  averageProfit?: number;
  averageLoss?: number;
  profitFactor?: number;
}

/**
 * Signal event for real-time updates
 */
export interface SignalEvent {
  type: 'signal_generated' | 'signal_updated' | 'signal_executed' | 'signal_cancelled';
  signal: ScannerSignal;
  eventTime: number;
  metadata?: Record<string, any>;
}

/**
 * Alert configuration for signals
 */
export interface SignalAlertConfig {
  enabled: boolean;
  
  // Signal type filters
  includeSignals: string[]; // e.g., ['Strong Buy', 'Strong Sell']
  minConfidence?: number;
  minSignalStrength?: number;
  minRiskRewardRatio?: number;
  
  // Notification settings
  notificationChannels: ('email' | 'sms' | 'webhook' | 'in-app')[];
  webhookUrl?: string;
  
  // Cooldown to prevent alert spam
  cooldownMs?: number;
}

/**
 * Signal persisted in database
 */
export interface PersistedSignal {
  id: string;
  signal: ScannerSignal;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'executed' | 'expired' | 'cancelled';
  executedPrice?: number;
  executedAt?: number;
  notes?: string;
}
