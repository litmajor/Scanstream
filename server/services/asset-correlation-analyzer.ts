/**
 * Asset Correlation Analyzer
 * Detects aligned signals in correlated assets and boosts confidence
 * Example: BTC breakout (90%) + SOL breakout (65%) → boost SOL to 75%+ due to correlation
 */

import { ALL_TRACKED_ASSETS, getAssetsByCategory } from '@shared/tracked-assets';

interface AssetCorrelation {
  symbol: string;
  correlatedAssets: Array<{
    symbol: string;
    correlation: number; // 0-1, Pearson correlation
    category: string;
  }>;
}

interface CorrelationBoostResult {
  boostedConfidence: number; // Original confidence adjusted by correlation
  correlationBoost: number; // How much confidence was boosted (0-0.15)
  alignedAssets: string[]; // Which correlated assets are aligned
  alignmentPercentage: number; // Percentage of correlated assets showing same direction
  recommendation: 'BOOST' | 'NEUTRAL' | 'REDUCE';
}

export class AssetCorrelationAnalyzer {
  private correlationMatrix: Map<string, number> = new Map();
  private recentSignals: Map<string, { direction: 'BUY' | 'SELL' | 'HOLD'; timestamp: number; confidence: number }> = new Map();
  private readonly SIGNAL_WINDOW = 30 * 60 * 1000; // 30 minutes
  private readonly CORRELATION_THRESHOLD = 0.7;
  private readonly ALIGNMENT_THRESHOLD = 0.7; // 70% of correlated assets must align

  constructor() {
    this.initializeCorrelations();
  }

  /**
   * Initialize asset correlations based on category and known relationships
   */
  private initializeCorrelations(): void {
    // Assets in the same category are typically correlated
    // Tier-1 assets are highly correlated with each other
    // Layer-2 solutions (ARB, OP) are correlated with ETH
    // Meme coins move together
    // AI tokens are correlated with each other

    const tier1 = getAssetsByCategory('tier-1').map(a => a.symbol);
    const fundamental = getAssetsByCategory('fundamental').map(a => a.symbol);
    const meme = getAssetsByCategory('meme').map(a => a.symbol);
    const ai = getAssetsByCategory('ai').map(a => a.symbol);
    const rwa = getAssetsByCategory('rwa').map(a => a.symbol);

    // Tier-1 correlation matrix
    tier1.forEach(s1 => {
      tier1.forEach(s2 => {
        if (s1 !== s2) {
          const key = `${s1}-${s2}`;
          // BTC-ETH highest correlation (0.9), others decrease with distance
          if ((s1 === 'BTC' && s2 === 'ETH') || (s1 === 'ETH' && s2 === 'BTC')) {
            this.correlationMatrix.set(key, 0.92);
          } else if (s1 === 'BTC' && ['SOL', 'AVAx', 'DOT'].includes(s2)) {
            this.correlationMatrix.set(key, 0.82);
          } else {
            this.correlationMatrix.set(key, 0.75);
          }
        }
      });
    });

    // Layer-2 solutions correlated with ETH
    ['ARB', 'OP'].forEach(l2 => {
      this.correlationMatrix.set(`${l2}-ETH`, 0.88);
      this.correlationMatrix.set(`ETH-${l2}`, 0.88);
    });

    // Meme coins highly correlated
    meme.forEach(m1 => {
      meme.forEach(m2 => {
        if (m1 !== m2) {
          this.correlationMatrix.set(`${m1}-${m2}`, 0.85);
        }
      });
    });

    // AI tokens correlated
    ai.forEach(a1 => {
      ai.forEach(a2 => {
        if (a1 !== a2) {
          this.correlationMatrix.set(`${a1}-${a2}`, 0.78);
        }
      });
    });

    // DeFi tokens (AAVE, UNI, SNX, LDO) correlated
    const defiTokens = ['AAVE', 'UNI', 'SNX', 'LDO'];
    defiTokens.forEach(d1 => {
      defiTokens.forEach(d2 => {
        if (d1 !== d2) {
          this.correlationMatrix.set(`${d1}-${d2}`, 0.80);
        }
      });
    });
  }

  /**
   * Track a signal for correlation analysis
   */
  trackSignal(symbol: string, direction: 'BUY' | 'SELL' | 'HOLD', confidence: number): void {
    this.recentSignals.set(symbol, {
      direction,
      timestamp: Date.now(),
      confidence
    });

    // Clean old signals outside the time window
    const now = Date.now();
    for (const [sym, signal] of this.recentSignals.entries()) {
      if (now - signal.timestamp > this.SIGNAL_WINDOW) {
        this.recentSignals.delete(sym);
      }
    }
  }

  /**
   * Get correlation boost for a signal
   * Checks if correlated assets show aligned signals and boosts confidence accordingly
   */
  async getCorrelationBoost(symbol: string, direction: 'BUY' | 'SELL' | 'HOLD', originalConfidence: number): Promise<CorrelationBoostResult> {
    // Find correlated assets
    const correlatedAssets = this.findCorrelatedAssets(symbol);
    
    if (correlatedAssets.length === 0) {
      return {
        boostedConfidence: originalConfidence,
        correlationBoost: 0,
        alignedAssets: [],
        alignmentPercentage: 0,
        recommendation: 'NEUTRAL'
      };
    }

    // Check which correlated assets have recent aligned signals
    const alignedAssets: string[] = [];
    correlatedAssets.forEach(asset => {
      const recentSignal = this.recentSignals.get(asset);
      if (recentSignal && recentSignal.direction === direction) {
        alignedAssets.push(asset);
      }
    });

    const alignmentPercentage = alignedAssets.length / correlatedAssets.length;

    // Determine if we should boost
    if (alignmentPercentage >= this.ALIGNMENT_THRESHOLD) {
      // Calculate boost: 10-15% increase based on alignment strength
      const boostStrength = 0.10 + (alignmentPercentage - this.ALIGNMENT_THRESHOLD) * 0.15;
      const boostAmount = Math.min(0.15, boostStrength);
      const boostedConfidence = Math.min(1.0, originalConfidence + boostAmount);

      return {
        boostedConfidence,
        correlationBoost: boostAmount,
        alignedAssets,
        alignmentPercentage,
        recommendation: 'BOOST'
      };
    } else if (alignmentPercentage > 0.3) {
      // Mild alignment - slight boost
      const boostAmount = 0.03;
      return {
        boostedConfidence: Math.min(1.0, originalConfidence + boostAmount),
        correlationBoost: boostAmount,
        alignedAssets,
        alignmentPercentage,
        recommendation: 'BOOST'
      };
    } else if (alignmentPercentage === 0 && correlatedAssets.length > 0) {
      // No alignment - slight reduction for contrarian signal
      const reductionAmount = 0.05;
      return {
        boostedConfidence: Math.max(0.3, originalConfidence - reductionAmount),
        correlationBoost: -reductionAmount,
        alignedAssets: [],
        alignmentPercentage: 0,
        recommendation: 'REDUCE'
      };
    }

    return {
      boostedConfidence: originalConfidence,
      correlationBoost: 0,
      alignedAssets,
      alignmentPercentage,
      recommendation: 'NEUTRAL'
    };
  }

  /**
   * Find correlated assets for a given symbol
   */
  private findCorrelatedAssets(symbol: string): string[] {
    const all = ALL_TRACKED_ASSETS.map(a => a.symbol);
    const correlatedAssets: string[] = [];

    all.forEach(otherSymbol => {
      if (otherSymbol === symbol) return;
      
      const key = `${symbol}-${otherSymbol}`;
      const correlation = this.correlationMatrix.get(key) || 0;
      
      if (correlation >= this.CORRELATION_THRESHOLD) {
        correlatedAssets.push(otherSymbol);
      }
    });

    return correlatedAssets;
  }

  /**
   * Get correlation report for debugging
   */
  getCorrelationReport(symbol: string): {
    symbol: string;
    correlatedAssets: Array<{ symbol: string; correlation: number }>;
    recentSignals: Array<{ symbol: string; direction: string; age: number }>;
  } {
    const correlatedAssets: Array<{ symbol: string; correlation: number }> = [];
    const all = ALL_TRACKED_ASSETS.map(a => a.symbol);

    all.forEach(otherSymbol => {
      if (otherSymbol === symbol) return;
      const key = `${symbol}-${otherSymbol}`;
      const correlation = this.correlationMatrix.get(key) || 0;
      if (correlation >= this.CORRELATION_THRESHOLD) {
        correlatedAssets.push({
          symbol: otherSymbol,
          correlation: Math.round(correlation * 100) / 100
        });
      }
    });

    const now = Date.now();
    const recentSignals = Array.from(this.recentSignals.entries())
      .filter(([sym]) => sym !== symbol)
      .map(([sym, signal]) => ({
        symbol: sym,
        direction: signal.direction,
        age: now - signal.timestamp
      }))
      .slice(0, 10);

    return {
      symbol,
      correlatedAssets: correlatedAssets.sort((a, b) => b.correlation - a.correlation),
      recentSignals
    };
  }
}

// Export singleton
export const assetCorrelationAnalyzer = new AssetCorrelationAnalyzer();
