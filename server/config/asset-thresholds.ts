/**
 * Per-Asset-Class Quality and Position Size Thresholds
 * Optimized for each category's risk/volatility profile
 */

export interface AssetClassThresholds {
  minQuality: number; // Minimum confidence score (0-100) to trade
  maxPosition: number; // Maximum position size (0-1 scale, e.g., 0.01 = 1%)
  description: string;
}

export const ASSET_CLASS_THRESHOLDS: Record<string, AssetClassThresholds> = {
  'tier-1': {
    minQuality: 65,
    maxPosition: 0.01, // 1% - most liquid, lowest variance
    description: 'Tier-1: Large cap, most established, high liquidity'
  },
  'fundamental': {
    minQuality: 70,
    maxPosition: 0.008, // 0.8% - strong fundamentals, moderate variance
    description: 'Fundamental: Strong fundamentals, growing ecosystems'
  },
  'meme': {
    minQuality: 75,
    maxPosition: 0.005, // 0.5% - high volatility, lower liquidity
    description: 'Meme: Community-driven, high variance, lower liquidity'
  },
  'ai': {
    minQuality: 70,
    maxPosition: 0.006, // 0.6% - emerging, moderate liquidity
    description: 'AI/ML: Artificial intelligence tokens, moderate liquidity'
  },
  'rwa': {
    minQuality: 70,
    maxPosition: 0.006, // 0.6% - emerging, moderate liquidity
    description: 'RWA: Real-world assets, emerging adoption'
  }
};

/**
 * Get thresholds for an asset category
 */
export function getAssetThresholds(category: string): AssetClassThresholds {
  return ASSET_CLASS_THRESHOLDS[category] || ASSET_CLASS_THRESHOLDS['fundamental'];
}

/**
 * Check if a signal quality meets the minimum threshold for its category
 */
export function meetsQualityThreshold(category: string, quality: number): boolean {
  const thresholds = getAssetThresholds(category);
  return quality >= thresholds.minQuality;
}

/**
 * Get max position size for a category
 */
export function getMaxPositionForCategory(category: string): number {
  return getAssetThresholds(category).maxPosition;
}
