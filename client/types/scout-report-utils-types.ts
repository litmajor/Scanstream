/**
 * TYPE DEFINITIONS FOR SCOUT REPORT UTILITIES
 * 
 * TypeScript interfaces for utility functions, filters, and formatters
 */

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface FilterOptions {
  type?: "SCALP" | "DAY" | "SWING" | "POSITION" | "ALL";
  minConfidence?: number;
  minRiskReward?: number;
  minProbability?: number;
  minQuality?: number;
  minAgreement?: number;
  source?: "ML" | "SCANNER" | "AGENTS" | "PRICE_ACTION" | "ALL";
  reliability?: "high" | "medium" | "low";
}

export type SortMetric = "riskReward" | "confidence" | "probability" | "quality" | "ev" | "duration";

// ============================================================================
// FORMATTED DISPLAY TYPES
// ============================================================================

export interface FormattedOpportunity {
  // Original data
  id: string;
  type: "SCALP" | "DAY" | "SWING" | "POSITION";
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number;
  probability: number;
  riskReward: number;
  entryZone: { min: number; max: number };
  targets: Array<{ price: number; label: string }>;
  stopLoss: number;

  // Formatted display values
  formattedConfidence: string; // "85.00"
  formattedRiskReward: string; // "1:2.35"
  formattedProbability: string; // "68.50"
  formattedQuality: string; // "82.00"
  formattedDuration: string; // "2.5h" or "45 min"
  formattedEntry: string; // "$150.25"
  formattedEV: string; // "1.23"
}

export interface FormattedConsensus {
  primaryDirection: "BULLISH" | "BEARISH" | "NEUTRAL";
  strength: number;
  sourceBreakdown: Record<string, number>;
  formattedAgreement: string; // "82.50"
  agreementPercent: number; // 82
}

// ============================================================================
// COLOR FORMAT TYPES
// ============================================================================

export interface DirectionDisplay {
  label: string;
  color: string;
  icon: string;
}

export interface TradeTypeDisplay {
  label: string;
  color: string;
  badge: string;
}

export interface ConvictionDisplay {
  label: string;
  color: string;
  level: number;
}

export interface SourceTypeDisplay {
  label: string;
  color: string;
  icon: string;
}

export interface ConfidenceDisplay {
  text: string;
  color: string;
  level: "low" | "medium" | "high";
}

export interface RiskScoreDisplay {
  text: string;
  color: string;
  level: "low" | "medium" | "high";
}

export interface ChangeDisplay {
  text: string;
  color: string;
  icon: string;
}

// ============================================================================
// CALCULATION RESULT TYPES
// ============================================================================

export interface QualityMetrics {
  confidence: number; // 0-1
  riskReward: number; // 1:X ratio
  probability: number; // 0-1
  conviction: boolean;
  quality: number; // 0-100
  expectedValue: number; // EV of trade
  reliability: "high" | "medium" | "low";
}

export interface SignalStrengthMetrics {
  agreement: number; // 0-1
  confidence: number; // 0-1
  strength: number; // 1-10
  urgency: "HIGH" | "MEDIUM" | "LOW";
}

export interface RiskMetrics {
  riskScore: number; // 1-10
  riskExposure: number; // 0-100%
  level: "low" | "medium" | "high";
  factors: string[];
}

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  severity?: "error" | "warning" | "info";
}

export interface OpportunityValidation extends ValidationResult {
  isHighQuality: boolean;
  hasGoodRiskReward: boolean;
  isHighProbability: boolean;
  isReliable: boolean;
}

export interface ReportValidation extends ValidationResult {
  hasStrongConsensus: boolean;
  hasSignificantDissent: boolean;
  contradictionScore: number; // 0-1, how much sources disagree
}

// ============================================================================
// FILTER PRESET TYPES
// ============================================================================

export interface FilterPreset {
  name: string;
  minConfidence: number;
  minRiskReward: number;
  minProbability: number;
  description: string;
}

// ============================================================================
// DISPLAY CONFIGURATION TYPES
// ============================================================================

export interface MetricDisplayConfig {
  decimalPlaces: number;
  confidenceFormat: "percent" | "decimal";
  probabilityFormat: "percent" | "decimal";
  priceFormat: "USD" | "RAW";
  riskRewardFormat: "ratio" | "multiplier";
  volumeFormat: "shorthand" | "full";
}

export interface SortOption {
  id: SortMetric;
  label: string;
  icon: string;
  description: string;
}

// ============================================================================
// ANALYSIS RESULT TYPES
// ============================================================================

export interface OpportunityAnalysis {
  opportunity: any; // TradeOpportunity
  quality: QualityMetrics;
  validation: OpportunityValidation;
  recommendations: string[];
  risks: string[];
}

export interface ReportAnalysis {
  agreement: number;
  strength: number;
  urgency: string;
  bestSetup: any; // TradeOpportunity | null
  topThree: any[]; // TradeOpportunity[]
  validation: ReportValidation;
}

// ============================================================================
// UTILITY HELPER TYPES
// ============================================================================

export interface FormatResult {
  value: string;
  color: string;
  icon?: string;
}

export interface PriceLevel {
  price: number;
  type: "SUPPORT" | "RESISTANCE";
  strength: "STRONG" | "MODERATE" | "WEAK";
  touches: number;
  distance: number; // % distance from current price
}

// ============================================================================
// EXPORT TYPES (for data export)
// ============================================================================

export interface ExportableOpportunity {
  id: string;
  symbol: string;
  type: string;
  direction: string;
  entry: string;
  targets: string[];
  stopLoss: string;
  confidence: string;
  probability: string;
  riskReward: string;
  quality: string;
  timestamp: string;
}

export interface ExportableReport {
  symbol: string;
  primaryDirection: string;
  agreement: string;
  confidence: string;
  strength: string;
  urgency: string;
  opportunities: ExportableOpportunity[];
  timestamp: string;
  exportFormat: "JSON" | "CSV" | "PDF";
}
