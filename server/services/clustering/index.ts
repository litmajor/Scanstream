/**
 * Clustering Services Index
 * 
 * Exports all clustering-based signal enhancement services
 */

export type {
  ClusterMetrics,
  OHLCV
} from './clustering-calculator';

export {
  ClusteringCalculator,
  createClusteringCalculator,
  calculateClusterMetrics
} from './clustering-calculator';

export {
  ClusterAccessor,
  initializeClusterAccessor,
  getClusterAccessor,
  getClusterMetrics,
  isTrendingSymbol,
  getClusterStrength
} from './cluster-accessor';

export type {
  ClusterEnhancedEntry,
  ClusterValidationConfig
} from './cluster-validator';

export {
  ClusterValidator,
  createClusterValidator,
  quickValidateEntry
} from './cluster-validator';

export type {
  PositionSizingInput,
  PositionSizingResult,
  PositionSizingConfig
} from './position-sizer';

export {
  PositionSizer,
  createPositionSizer,
  quickCalculateSize
} from './position-sizer';

export type {
  ClusterBreakdown,
  ClusterSnapshot,
  ReversalDetectorConfig
} from './reversal-detector';

export {
  ReversalDetector,
  createReversalDetector,
  quickDetectBreakdown
} from './reversal-detector';

export type {
  OptimalStop,
  StopLossInput,
  StopLossConfig
} from './stop-loss-optimizer';

export {
  StopLossOptimizer,
  createStopLossOptimizer,
  quickCalculateStop
} from './stop-loss-optimizer';

export type {
  PyramidDecision,
  PyramidInput,
  PyramidConfig
} from './pyramid-strategy';

export {
  PyramidStrategy,
  createPyramidStrategy,
  quickDecidePyramid
} from './pyramid-strategy';

export type {
  RiskLimitConfig,
  ClusterRiskMetrics,
  AdjustedRiskLimits
} from './risk-limits-optimizer';

export {
  RiskLimitsOptimizer,
  createRiskLimitsOptimizer,
  calculateQuickRiskLimits
} from './risk-limits-optimizer';

export type {
  ExitStrategy,
  ExitUrgency,
  ExitStrategyConfig,
  ExitConditions,
  ExitStrategyRecommendation
} from './exit-strategy-selector';

export {
  ExitStrategySelector,
  createExitStrategySelector,
  selectQuickExitStrategy
} from './exit-strategy-selector';

export type {
  EntryTimingConfig,
  ConfirmationHistory,
  DelayedEntryDecision
} from './entry-timing-optimizer';

export {
  EntryTimingOptimizer,
  createEntryTimingOptimizer,
  evaluateQuickEntryTiming
} from './entry-timing-optimizer';

export type {
  DurationPredictionConfig,
  ClusterCharacteristics,
  TradeDurationPrediction,
  ManagementStrategy
} from './trade-duration-predictor';

export {
  TradeDurationPredictor,
  createTradeDurationPredictor,
  predictQuickDuration
} from './trade-duration-predictor';

export type {
  ClusterEnhancedAgentSignal
} from './agent-integration';

export {
  ClusteringSignalProcessor,
  getClusteringProcessor,
  applyClusteringToSignal,
  passesClusteringQuality,
  getSizingMultiplier
} from './agent-integration';
