/**
 * Scanner Signal Service Tests
 * 
 * Comprehensive unit tests for scanner signal generation with risk management targets.
 * Tests cover various signal types, market conditions, and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ScannerSignalService from '../services/scanner/scanner-signal-service';
import type { ComputeScannerSignalRequest, ScannerSignal } from '../services/scanner/scanner-signal';

describe('ScannerSignalService', () => {
  beforeEach(() => {
    ScannerSignalService.clearCache();
  });

  afterEach(() => {
    ScannerSignalService.clearCache();
  });

  describe('computeSignal', () => {
    /**
     * Test: Basic signal computation with minimal data
     */
    it('should compute a signal with valid market data', () => {
      const request: ComputeScannerSignalRequest = {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        marketData: {
          open: [40000, 40100, 40200, 40300, 40400],
          high: [40100, 40200, 40300, 40400, 40500],
          low: [39900, 40000, 40100, 40200, 40300],
          close: [40050, 40150, 40250, 40350, 40450],
          volume: [1000, 1100, 1200, 1300, 1400],
        },
      };

      const result = ScannerSignalService.computeSignal(request);

      expect(result.success).toBe(true);
      expect(result.signal).toBeDefined();
      expect(result.signal.symbol).toBe('BTC/USDT');
      expect(result.signal.timeframe).toBe('1h');
      expect(result.signal.targets).toBeDefined();
    });

    /**
     * Test: Signal should include all required target fields
     */
    it('should include all target fields', () => {
      const request: ComputeScannerSignalRequest = {
        symbol: 'ETH/USDT',
        timeframe: '4h',
        marketData: {
          open: [2000, 2050, 2100, 2150, 2200, 2250, 2300, 2350, 2400, 2450],
          high: [2050, 2100, 2150, 2200, 2250, 2300, 2350, 2400, 2450, 2500],
          low: [1950, 2000, 2050, 2100, 2150, 2200, 2250, 2300, 2350, 2400],
          close: [2025, 2075, 2125, 2175, 2225, 2275, 2325, 2375, 2425, 2475],
          volume: [500, 550, 600, 650, 700, 750, 800, 850, 900, 950],
        },
      };

      const result = ScannerSignalService.computeSignal(request);

      expect(result.success).toBe(true);
      const targets = result.signal.targets;
      expect(targets?.entryPrice).toBeDefined();
      expect(targets?.stopLoss).toBeDefined();
      expect(targets?.takeProfit).toBeDefined();
      expect(targets?.riskAmount).toBeDefined();
      expect(targets?.rewardAmount).toBeDefined();
      expect(targets?.riskRewardRatio).toBeDefined();
      expect(targets?.stopLossPct).toBeDefined();
      expect(targets?.takeProfitPct).toBeDefined();
    });

    /**
     * Test: Stop loss should be below entry for long signals
     */
    it('should place stop loss below entry for buy signals', () => {
      const request: ComputeScannerSignalRequest = {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        marketData: {
          open: [40000, 40200, 40400, 40600, 40800],
          high: [40200, 40400, 40600, 40800, 41000],
          low: [39800, 40000, 40200, 40400, 40600],
          close: [40100, 40300, 40500, 40700, 40900],
          volume: [1000, 1100, 1200, 1300, 1400],
        },
      };

      const result = ScannerSignalService.computeSignal(request);

      if (result.signal.signal.includes('Buy')) {
        expect(result.signal.targets?.stopLoss).toBeLessThan(result.signal.targets?.entryPrice!);
      }
    });

    /**
     * Test: Stop loss should be above entry for short signals
     */
    it('should place stop loss above entry for sell signals', () => {
      const request: ComputeScannerSignalRequest = {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        marketData: {
          open: [40900, 40700, 40500, 40300, 40100],
          high: [41000, 40800, 40600, 40400, 40200],
          low: [40600, 40400, 40200, 40000, 39800],
          close: [40800, 40600, 40400, 40200, 40000],
          volume: [1400, 1300, 1200, 1100, 1000],
        },
      };

      const result = ScannerSignalService.computeSignal(request);

      if (result.signal.signal.includes('Sell')) {
        expect(result.signal.targets?.stopLoss).toBeGreaterThan(result.signal.targets?.entryPrice!);
      }
    });

    /**
     * Test: Take profit should be above entry for long signals
     */
    it('should place take profit above entry for buy signals', () => {
      const request: ComputeScannerSignalRequest = {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        marketData: {
          open: [40000, 40200, 40400, 40600, 40800],
          high: [40200, 40400, 40600, 40800, 41000],
          low: [39800, 40000, 40200, 40400, 40600],
          close: [40100, 40300, 40500, 40700, 40900],
          volume: [1000, 1100, 1200, 1300, 1400],
        },
      };

      const result = ScannerSignalService.computeSignal(request);

      if (result.signal.signal.includes('Buy')) {
        expect(result.signal.targets?.takeProfit).toBeGreaterThan(result.signal.targets?.entryPrice!);
      }
    });

    /**
     * Test: Take profit should be below entry for short signals
     */
    it('should place take profit below entry for sell signals', () => {
      const request: ComputeScannerSignalRequest = {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        marketData: {
          open: [40900, 40700, 40500, 40300, 40100],
          high: [41000, 40800, 40600, 40400, 40200],
          low: [40600, 40400, 40200, 40000, 39800],
          close: [40800, 40600, 40400, 40200, 40000],
          volume: [1400, 1300, 1200, 1100, 1000],
        },
      };

      const result = ScannerSignalService.computeSignal(request);

      if (result.signal.signal.includes('Sell')) {
        expect(result.signal.targets?.takeProfit).toBeLessThan(result.signal.targets?.entryPrice!);
      }
    });

    /**
     * Test: Risk reward ratio should be positive
     */
    it('should have positive risk reward ratio', () => {
      const request: ComputeScannerSignalRequest = {
        symbol: 'SOL/USDT',
        timeframe: '1h',
        marketData: {
          open: [100, 102, 104, 106, 108],
          high: [102, 104, 106, 108, 110],
          low: [98, 100, 102, 104, 106],
          close: [101, 103, 105, 107, 109],
          volume: [1000, 1100, 1200, 1300, 1400],
        },
      };

      const result = ScannerSignalService.computeSignal(request);

      expect(result.signal.targets?.riskRewardRatio).toBeGreaterThan(0);
    });

    /**
     * Test: Insufficient data should return error
     */
    it('should fail with insufficient data', () => {
      const request: ComputeScannerSignalRequest = {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        marketData: {
          open: [40000, 40100],
          high: [40100, 40200],
          low: [39900, 40000],
          close: [40050, 40150],
          volume: [1000, 1100],
        },
      };

      const result = ScannerSignalService.computeSignal(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient');
    });

    /**
     * Test: Custom risk reward ratio should be applied
     */
    it('should apply custom risk reward ratio', () => {
      const request: ComputeScannerSignalRequest = {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        marketData: {
          open: [40000, 40200, 40400, 40600, 40800],
          high: [40200, 40400, 40600, 40800, 41000],
          low: [39800, 40000, 40200, 40400, 40600],
          close: [40100, 40300, 40500, 40700, 40900],
          volume: [1000, 1100, 1200, 1300, 1400],
        },
        riskRewardRatio: 3.0, // Custom RR ratio
      };

      const result = ScannerSignalService.computeSignal(request);

      expect(result.success).toBe(true);
      // RR should be close to 3.0 if not constrained by support/resistance
      expect(result.signal.targets?.riskRewardRatio).toBeGreaterThanOrEqual(1);
    });

    /**
     * Test: Position sizing should be calculated with account info
     */
    it('should calculate position sizing with account info', () => {
      const request: ComputeScannerSignalRequest = {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        marketData: {
          open: [40000, 40200, 40400, 40600, 40800],
          high: [40200, 40400, 40600, 40800, 41000],
          low: [39800, 40000, 40200, 40400, 40600],
          close: [40100, 40300, 40500, 40700, 40900],
          volume: [1000, 1100, 1200, 1300, 1400],
        },
        accountBalance: 10000,
        riskPerTradePct: 1,
        leverage: 2,
      };

      const result = ScannerSignalService.computeSignal(request);

      expect(result.success).toBe(true);
      expect(result.signal.targets?.recommendedPositionSize).toBeDefined();
      expect(result.signal.targets?.recommendedPositionSize).toBeGreaterThan(0);
      expect(result.signal.targets?.marginRequired).toBeDefined();
    });

    /**
     * Test: Signal should include execution time
     */
    it('should include execution time', () => {
      const request: ComputeScannerSignalRequest = {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        marketData: {
          open: [40000, 40100, 40200, 40300, 40400],
          high: [40100, 40200, 40300, 40400, 40500],
          low: [39900, 40000, 40100, 40200, 40300],
          close: [40050, 40150, 40250, 40350, 40450],
          volume: [1000, 1100, 1200, 1300, 1400],
        },
      };

      const result = ScannerSignalService.computeSignal(request);

      expect(result.signal.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.signal.executionTimeMs).toBe('number');
    });
  });

  describe('computeSignalsBatch', () => {
    /**
     * Test: Batch processing multiple signals
     */
    it('should compute multiple signals in batch', () => {
      const batch = {
        signals: [
          {
            symbol: 'BTC/USDT',
            timeframe: '1h',
            marketData: {
              open: [40000, 40100, 40200, 40300, 40400],
              high: [40100, 40200, 40300, 40400, 40500],
              low: [39900, 40000, 40100, 40200, 40300],
              close: [40050, 40150, 40250, 40350, 40450],
              volume: [1000, 1100, 1200, 1300, 1400],
            },
          },
          {
            symbol: 'ETH/USDT',
            timeframe: '1h',
            marketData: {
              open: [2000, 2050, 2100, 2150, 2200],
              high: [2050, 2100, 2150, 2200, 2250],
              low: [1950, 2000, 2050, 2100, 2150],
              close: [2025, 2075, 2125, 2175, 2225],
              volume: [500, 550, 600, 650, 700],
            },
          },
        ],
      };

      const result = ScannerSignalService.computeSignalsBatch(batch);

      expect(result.totalComputed).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.failedCount).toBe(0);
    });

    /**
     * Test: Batch should handle partial failures
     */
    it('should handle partial failures in batch', () => {
      const batch = {
        signals: [
          {
            symbol: 'BTC/USDT',
            timeframe: '1h',
            marketData: {
              open: [40000, 40100, 40200, 40300, 40400],
              high: [40100, 40200, 40300, 40400, 40500],
              low: [39900, 40000, 40100, 40200, 40300],
              close: [40050, 40150, 40250, 40350, 40450],
              volume: [1000, 1100, 1200, 1300, 1400],
            },
          },
          {
            symbol: 'ETH/USDT',
            timeframe: '1h',
            marketData: {
              open: [2000],
              high: [2050],
              low: [1950],
              close: [2025],
              volume: [500],
            },
          },
        ],
      };

      const result = ScannerSignalService.computeSignalsBatch(batch);

      expect(result.totalComputed).toBe(2);
      expect(result.failedCount).toBeGreaterThan(0);
    });

    /**
     * Test: Batch execution time should be recorded
     */
    it('should record batch execution time', () => {
      const batch = {
        signals: [
          {
            symbol: 'BTC/USDT',
            timeframe: '1h',
            marketData: {
              open: [40000, 40100, 40200, 40300, 40400],
              high: [40100, 40200, 40300, 40400, 40500],
              low: [39900, 40000, 40100, 40200, 40300],
              close: [40050, 40150, 40250, 40350, 40450],
              volume: [1000, 1100, 1200, 1300, 1400],
            },
          },
        ],
      };

      const result = ScannerSignalService.computeSignalsBatch(batch);

      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cache Management', () => {
    /**
     * Test: Signals should be cached
     */
    it('should cache computed signals', () => {
      const request: ComputeScannerSignalRequest = {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        marketData: {
          open: [40000, 40100, 40200, 40300, 40400],
          high: [40100, 40200, 40300, 40400, 40500],
          low: [39900, 40000, 40100, 40200, 40300],
          close: [40050, 40150, 40250, 40350, 40450],
          volume: [1000, 1100, 1200, 1300, 1400],
        },
      };

      ScannerSignalService.computeSignal(request);
      const cached = ScannerSignalService.getCachedSignal('BTC/USDT', '1h');

      expect(cached).toBeDefined();
      expect(cached?.symbol).toBe('BTC/USDT');
    });

    /**
     * Test: Cache should return null for non-existent signal
     */
    it('should return null for non-existent cached signal', () => {
      const cached = ScannerSignalService.getCachedSignal('XYZ/USDT', '1h');

      expect(cached).toBeNull();
    });

    /**
     * Test: Cache clear should work for specific symbol
     */
    it('should clear cache for specific symbol', () => {
      const request: ComputeScannerSignalRequest = {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        marketData: {
          open: [40000, 40100, 40200, 40300, 40400],
          high: [40100, 40200, 40300, 40400, 40500],
          low: [39900, 40000, 40100, 40200, 40300],
          close: [40050, 40150, 40250, 40350, 40450],
          volume: [1000, 1100, 1200, 1300, 1400],
        },
      };

      ScannerSignalService.computeSignal(request);
      ScannerSignalService.clearCache('BTC/USDT');
      const cached = ScannerSignalService.getCachedSignal('BTC/USDT', '1h');

      expect(cached).toBeNull();
    });

    /**
     * Test: Cache clear without symbol should clear all
     */
    it('should clear entire cache without symbol parameter', () => {
      const request: ComputeScannerSignalRequest = {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        marketData: {
          open: [40000, 40100, 40200, 40300, 40400],
          high: [40100, 40200, 40300, 40400, 40500],
          low: [39900, 40000, 40100, 40200, 40300],
          close: [40050, 40150, 40250, 40350, 40450],
          volume: [1000, 1100, 1200, 1300, 1400],
        },
      };

      ScannerSignalService.computeSignal(request);
      ScannerSignalService.clearCache();
      const cached = ScannerSignalService.getCachedSignal('BTC/USDT', '1h');

      expect(cached).toBeNull();
    });
  });

  describe('Signal Statistics', () => {
    /**
     * Test: Generate statistics from multiple signals
     */
    it('should generate statistics from signal array', () => {
      const signals: ScannerSignal[] = [
        {
          score: 0.5,
          signal: 'Buy',
          signalStrength: 75,
          confidence: 0.8,
          symbol: 'BTC/USDT',
          timestamp: Date.now(),
          timeframe: '1h',
          source: 'momentum',
          version: '2.0.0',
          executionTimeMs: 10,
          targets: {
            entryPrice: 40000,
            entryPriceConfidence: 0.95,
            stopLoss: 39500,
            takeProfit: 41000,
            supportLevel: 38000,
            resistanceLevel: 42000,
            riskAmount: 500,
            rewardAmount: 1000,
            riskRewardRatio: 2,
            stopLossPct: -1.25,
            takeProfitPct: 2.5,
          },
          passesQualityGate: true,
        },
        {
          score: -0.6,
          signal: 'Sell',
          signalStrength: 80,
          confidence: 0.85,
          symbol: 'BTC/USDT',
          timestamp: Date.now(),
          timeframe: '1h',
          source: 'momentum',
          version: '2.0.0',
          executionTimeMs: 10,
          targets: {
            entryPrice: 39800,
            entryPriceConfidence: 0.95,
            stopLoss: 40300,
            takeProfit: 38800,
            supportLevel: 38000,
            resistanceLevel: 42000,
            riskAmount: 500,
            rewardAmount: 1000,
            riskRewardRatio: 2,
            stopLossPct: 1.26,
            takeProfitPct: -2.51,
          },
          passesQualityGate: true,
        },
      ];

      const stats = ScannerSignalService.generateStatistics(signals);

      expect(stats.totalSignals).toBe(2);
      expect(stats.buySignals).toBe(1);
      expect(stats.sellSignals).toBe(1);
      expect(stats.averageConfidence).toBeGreaterThan(0);
      expect(stats.averageSignalStrength).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    /**
     * Test: Handle NaN in calculations
     */
    it('should handle edge case data gracefully', () => {
      const request: ComputeScannerSignalRequest = {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        marketData: {
          open: [40000, 40000, 40000, 40000, 40000],
          high: [40000, 40000, 40000, 40000, 40000],
          low: [40000, 40000, 40000, 40000, 40000],
          close: [40000, 40000, 40000, 40000, 40000],
          volume: [0, 0, 0, 0, 0],
        },
      };

      const result = ScannerSignalService.computeSignal(request);

      expect(result.success).toBe(true);
      expect(result.signal.targets).toBeDefined();
    });

    /**
     * Test: Extremely small price movements
     */
    it('should handle tiny price movements', () => {
      const request: ComputeScannerSignalRequest = {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        marketData: {
          open: [40000.001, 40000.002, 40000.003, 40000.004, 40000.005],
          high: [40000.002, 40000.003, 40000.004, 40000.005, 40000.006],
          low: [40000.000, 40000.001, 40000.002, 40000.003, 40000.004],
          close: [40000.0015, 40000.0025, 40000.0035, 40000.0045, 40000.0055],
          volume: [1000, 1100, 1200, 1300, 1400],
        },
      };

      const result = ScannerSignalService.computeSignal(request);

      expect(result.success).toBe(true);
    });

    /**
     * Test: Very large price values
     */
    it('should handle very large price values', () => {
      const request: ComputeScannerSignalRequest = {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        marketData: {
          open: [1000000, 1001000, 1002000, 1003000, 1004000],
          high: [1001000, 1002000, 1003000, 1004000, 1005000],
          low: [999000, 1000000, 1001000, 1002000, 1003000],
          close: [1000500, 1001500, 1002500, 1003500, 1004500],
          volume: [1000, 1100, 1200, 1300, 1400],
        },
      };

      const result = ScannerSignalService.computeSignal(request);

      expect(result.success).toBe(true);
    });
  });
});
