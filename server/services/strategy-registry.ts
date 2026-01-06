/**
 * Strategy Service Registry
 * Provides centralized access to strategy services with feature flag checks
 * 
 * Caches service instances for reuse
 * Respects feature flags before instantiation
 */

import { isFeatureEnabled, FLAGS } from '../config/featureFlags';
import { TradeDurationPredictor, createTradeDurationPredictor } from './clustering/trade-duration-predictor';
import { PyramidStrategy, createPyramidStrategy } from './clustering/pyramid-strategy';

export interface StrategyServices {
  tradeDurationPredictor: TradeDurationPredictor | null;
  pyramidStrategy: PyramidStrategy | null;
}

// Cache service instances
let serviceCache: StrategyServices = {
  tradeDurationPredictor: null,
  pyramidStrategy: null,
};

/**
 * Get or create the TradeDurationPredictor service
 * Returns null if feature is disabled
 */
export function getTradeDurationPredictor(): TradeDurationPredictor | null {
  if (!isFeatureEnabled(FLAGS.TRADE_DURATION_PREDICTOR)) {
    return null;
  }

  if (!serviceCache.tradeDurationPredictor) {
    serviceCache.tradeDurationPredictor = createTradeDurationPredictor();
    console.log('[StrategyRegistry] TradeDurationPredictor initialized');
  }

  return serviceCache.tradeDurationPredictor;
}

/**
 * Get or create the PyramidStrategy service
 * Returns null if feature is disabled
 */
export function getPyramidStrategy(): PyramidStrategy | null {
  if (!isFeatureEnabled(FLAGS.PYRAMID_STRATEGY)) {
    return null;
  }

  if (!serviceCache.pyramidStrategy) {
    serviceCache.pyramidStrategy = createPyramidStrategy();
    console.log('[StrategyRegistry] PyramidStrategy initialized');
  }

  return serviceCache.pyramidStrategy;
}

/**
 * Check if a strategy service is available
 */
export function isStrategyAvailable(strategyName: 'trade-duration' | 'pyramid'): boolean {
  switch (strategyName) {
    case 'trade-duration':
      return isFeatureEnabled(FLAGS.TRADE_DURATION_PREDICTOR);
    case 'pyramid':
      return isFeatureEnabled(FLAGS.PYRAMID_STRATEGY);
    default:
      return false;
  }
}

/**
 * Get all enabled strategies info
 */
export function getEnabledStrategies(): Array<{
  name: string;
  flag: string;
  description: string;
}> {
  const enabled = [];

  if (isFeatureEnabled(FLAGS.TRADE_DURATION_PREDICTOR)) {
    enabled.push({
      name: 'Trade Duration Predictor',
      flag: FLAGS.TRADE_DURATION_PREDICTOR,
      description: 'Predict holding period based on cluster strength and trend characteristics',
    });
  }

  if (isFeatureEnabled(FLAGS.PYRAMID_STRATEGY)) {
    enabled.push({
      name: 'Pyramid Strategy',
      flag: FLAGS.PYRAMID_STRATEGY,
      description: 'Safely add to winning positions using cluster validation',
    });
  }

  return enabled;
}

/**
 * Clear service cache (useful for testing)
 */
export function clearServiceCache(): void {
  serviceCache = {
    tradeDurationPredictor: null,
    pyramidStrategy: null,
  };
  console.log('[StrategyRegistry] Service cache cleared');
}

/**
 * Reset services when feature flags change at runtime
 */
export function resetServicesOnFlagChange(): void {
  clearServiceCache();
}

export default {
  getTradeDurationPredictor,
  getPyramidStrategy,
  isStrategyAvailable,
  getEnabledStrategies,
  clearServiceCache,
  resetServicesOnFlagChange,
};
