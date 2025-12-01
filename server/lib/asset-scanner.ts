/**
 * Asset Scanner - Multi-asset signal generation across 50 tracked assets
 */

import { ALL_TRACKED_ASSETS, getTrackedCoinGeckoIds, getCoinGeckoId, ASSET_CATEGORIES } from '@shared/tracked-assets';

export interface AssetScannerResult {
  symbol: string;
  name: string;
  status: 'scanning' | 'analyzed' | 'error';
  scanTimestamp: number;
  signals?: Array<{
    type: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    patterns: string[];
  }>;
}

export class AssetScanner {
  /**
   * Get all tracked assets for scanning
   */
  static getTrackedAssets() {
    return ALL_TRACKED_ASSETS;
  }

  /**
   * Get CoinGecko IDs for batch API calls
   */
  static getCoinGeckoIds(): string {
    return getTrackedCoinGeckoIds();
  }

  /**
   * Initialize scan for all 50 assets
   */
  static async initializeAssetScan(): Promise<AssetScannerResult[]> {
    return ALL_TRACKED_ASSETS.map(asset => ({
      symbol: asset.symbol,
      name: asset.name,
      status: 'scanning' as const,
      scanTimestamp: Date.now()
    }));
  }

  /**
   * Get assets by category
   */
  static getAssetsByCategory(category: 'tier-1' | 'fundamental' | 'meme' | 'ai' | 'rwa') {
    return ALL_TRACKED_ASSETS.filter(a => a.category === category);
  }

  /**
   * Get asset count statistics
   */
  static getAssetCounts() {
    return ASSET_CATEGORIES;
  }

  /**
   * Get asset metadata
   */
  static getAssetMetadata(symbol: string) {
    return ALL_TRACKED_ASSETS.find(a => a.symbol.toUpperCase() === symbol.toUpperCase());
  }
}
