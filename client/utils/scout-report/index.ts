/**
 * SCOUT REPORT UTILITIES & CONSTANTS INDEX
 * 
 * Central export file for all utilities, constants, and types
 * Enables clean imports throughout the application
 * 
 * Usage:
 * import {
 *   formatToDP,
 *   filterOpportunities,
 *   CONFIDENCE_THRESHOLDS,
 *   type FilterOptions
 * } from '@/utils/scout-report'
 */

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

export {
  formatToDP,
  formatMetric,
  formatPercent,
  formatPercentFromDecimal,
  formatPrice,
  formatRiskReward,
  formatRatio,
  formatDirection,
  formatTradeType,
  formatConviction,
  formatSourceType,
  formatDuration,
  formatTimeToTarget,
  formatLargeNumber,
  formatChange,
  formatConfidenceWithColor,
  formatProbabilityWithColor,
  formatRiskScore
} from "../formatting";

// ============================================================================
// SCOUT REPORT UTILITIES
// ============================================================================

// Filtering Functions
export {
  filterOpportunitiesByType,
  filterOpportunitiesByConfidence,
  filterOpportunitiesByRiskReward,
  filterOpportunitiesByProbability,
  filterOpportunitiesByQuality,
  filterOpportunities
} from "../scout-report-utils";

// Sorting Functions
export {
  sortByRiskReward,
  sortByConfidence,
  sortByProbability,
  sortByQuality,
  sortByExpectedValue,
  sortByDuration,
  sortOpportunities
} from "../scout-report-utils";

// Calculation Functions
export {
  calculateExpectedValue,
  calculateOpportunityQuality,
  calculateAgreement,
  calculateAverageConfidence,
  calculateSignalStrength,
  calculateUrgency,
  calculateRiskExposure
} from "../scout-report-utils";

// Formatting Helpers
export {
  formatOpportunityForDisplay,
  formatOpportunitiesForDisplay,
  formatConsensusForDisplay
} from "../scout-report-utils";

// Analysis Helpers
export {
  findBestOpportunity,
  findHighestConfidenceOpportunity,
  findBestRiskRewardOpportunity,
  getOpportunitiesByReliability,
  getOpportunitiesByType,
  getTopOpportunities
} from "../scout-report-utils";

// Validation Helpers
export {
  isHighQualityOpportunity,
  hasGoodRiskReward,
  isHighProbability,
  hasStrongConsensus,
  hasSignificantDissent
} from "../scout-report-utils";

// ============================================================================
// CONSTANTS
// ============================================================================

export {
  // Thresholds
  CONFIDENCE_THRESHOLDS,
  AGREEMENT_THRESHOLDS,
  PROBABILITY_THRESHOLDS,
  RISK_REWARD_THRESHOLDS,
  QUALITY_THRESHOLDS,

  // Risk Configuration
  RISK_SCORE_LEVELS,
  RISK_ASSESSMENT_DEFAULTS,

  // Trade Types
  TRADE_TYPE_DURATIONS,
  TRADE_TYPE_CONFIG,

  // Colors
  DIRECTION_COLORS,
  SOURCE_COLORS,
  CONVICTION_COLORS,
  CONFIDENCE_COLOR_RANGES,

  // Urgency & Alerts
  URGENCY_CONFIG,
  ALERT_THRESHOLDS,

  // Performance
  CACHE_CONFIG,

  // API & Limits
  API_LIMITS,
  FILTER_PRESETS,

  // Display
  METRIC_CONFIG,
  SORT_OPTIONS,

  // Analysis
  SUPPORT_RESISTANCE_CONFIG,
  DIVERGENCE_TYPES,
  EXECUTION_STRATEGIES
} from "../../constants/scout-report-constants";

// ============================================================================
// TYPES
// ============================================================================

export type {
  FilterOptions,
  SortMetric,
  FormattedOpportunity,
  FormattedConsensus,
  DirectionDisplay,
  TradeTypeDisplay,
  ConvictionDisplay,
  SourceTypeDisplay,
  ConfidenceDisplay,
  RiskScoreDisplay,
  ChangeDisplay,
  QualityMetrics,
  SignalStrengthMetrics,
  RiskMetrics,
  ValidationResult,
  OpportunityValidation,
  ReportValidation,
  FilterPreset,
  MetricDisplayConfig,
  SortOption,
  OpportunityAnalysis,
  ReportAnalysis,
  FormatResult,
  PriceLevel,
  ExportableOpportunity,
  ExportableReport
} from "../../types/scout-report-utils-types";

// ============================================================================
// RE-EXPORT SCOUT REPORT TYPES
// ============================================================================

export type {
  ScoutReport,
  ExecutiveSummary,
  MLSourceAnalysis,
  ScannerSourceAnalysis,
  AgentSourceAnalysis,
  PriceActionAnalysis,
  TradeOpportunity,
  AlternativeView,
  RiskAssessment
} from "../../types/scout-report-types";
