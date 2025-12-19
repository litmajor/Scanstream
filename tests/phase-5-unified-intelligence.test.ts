/**
 * PHASE 5: UNIFIED INTELLIGENCE FRAMEWORK TESTS
 * 
 * Validates all 6 position sizing methods:
 * 1. Confidence-Based (primary)
 * 2. Kelly Criterion
 * 3. Volatility-Adjusted
 * 4. Risk-to-Reward
 * 5. Equity Percentage
 * 6. Daily Risk Budget Enforcement + RL hooks
 * 
 * Tests the unified decision engine and orchestration
 */

import {
  UnifiedPositionSizingEngine,
  ConfidenceBasedSizer,
  KellyCriterionCalculator,
  VolatilityBasedSizer,
  SignalStrengthSizer,
  CorrelationBasedSizer,
  RiskToRewardSizer,
  EquityPercentageSizer,
  DailyRiskBudgetManager,
  type PositionSizingInput,
  type SignalSourceMetrics,
  type DailyRiskBudget,
  type PortfolioPosition
} from '../server/lib/adaptive-position-sizer';

// ============================================================================
// TEST SETUP
// ============================================================================

const createBaseInput = (): PositionSizingInput => ({
  symbol: 'BTC/USD',
  signalStrength: 0.75,
  signalAction: 'BUY',
  entryPrice: 45000,
  stopLoss: 44000,
  takeProfit: 46500,
  signalSource: 'ML',
  signalConfidence: 0.75,
  accountEquity: 100000,
  accountRiskPercentage: 1.0,
  maxDailyRiskPercent: 0.05,
  volatility: 1.2,
  volatilityRegime: 'normal',
  regime: 'TRENDING',
  existingPositions: [],
  correlationWithPortfolio: 0.2,
  sizingStrategy: 'ADAPTIVE',
  riskLevel: 'MODERATE'
});

const createSourceMetrics = (overrides?: Partial<SignalSourceMetrics>): SignalSourceMetrics => ({
  source: 'ML',
  totalTrades: 150,
  winRate: 0.62,
  avgWin: 180,
  avgLoss: 95,
  averageRiskRewardRatio: 1.89,
  confidenceLevel: 'high',
  lastUpdated: new Date(),
  ...overrides
});

// ============================================================================
// TEST SUITES
// ============================================================================

describe('PHASE 5: Unified Intelligence Framework', () => {

  // ========================================================================
  // 1. CONFIDENCE-BASED SIZER TESTS
  // ========================================================================

  describe('1. Confidence-Based Sizer (Primary Method)', () => {
    let sizer: ConfidenceBasedSizer;

    beforeEach(() => {
      sizer = new ConfidenceBasedSizer();
    });

    it('should calculate confidence-based size with ML source weight', () => {
      const result = sizer.calculateConfidenceSize(1000, 0.85, 'ML');
      expect(result.size).toBeCloseTo(850, 0);
      expect(result.sourceWeight).toBe(1.0);
    });

    it('should reduce size for SCANNER source (0.8x weight)', () => {
      const result = sizer.calculateConfidenceSize(1000, 0.85, 'SCANNER');
      expect(result.size).toBeCloseTo(680, 0);
      expect(result.sourceWeight).toBe(0.8);
    });

    it('should reduce size for GATEWAY source (0.6x weight)', () => {
      const result = sizer.calculateConfidenceSize(1000, 0.85, 'GATEWAY');
      expect(result.size).toBeCloseTo(510, 0);
      expect(result.sourceWeight).toBe(0.6);
    });

    it('should reduce size for AGENT source (0.5x weight)', () => {
      const result = sizer.calculateConfidenceSize(1000, 0.85, 'AGENT');
      expect(result.size).toBeCloseTo(425, 0);
      expect(result.sourceWeight).toBe(0.5);
    });

    it('should scale with confidence level', () => {
      const low = sizer.calculateConfidenceSize(1000, 0.5, 'ML');
      const medium = sizer.calculateConfidenceSize(1000, 0.75, 'ML');
      const high = sizer.calculateConfidenceSize(1000, 1.0, 'ML');

      expect(low.size).toBeLessThan(medium.size);
      expect(medium.size).toBeLessThan(high.size);
    });

    it('should cap confidence at 1.0 even if input exceeds', () => {
      const result = sizer.calculateConfidenceSize(1000, 1.5, 'ML');
      expect(result.size).toBeCloseTo(1000, 0);
    });
  });

  // ========================================================================
  // 2. KELLY CRITERION TESTS
  // ========================================================================

  describe('2. Kelly Criterion Calculator', () => {
    let kelly: KellyCriterionCalculator;

    beforeEach(() => {
      kelly = new KellyCriterionCalculator();
    });

    it('should calculate Kelly with typical win rate and payoff', () => {
      const result = kelly.calculateKellyFraction({
        winRate: 0.60,
        avgWin: 100,
        avgLoss: 50,
        riskRewardRatio: 2.0,
        tradeCount: 100
      });

      expect(result.kellyFraction).toBeGreaterThan(0);
      expect(result.kellyFraction).toBeLessThanOrEqual(0.25); // Capped at 25%
      expect(result.safeKellyFraction).toBeLessThan(result.kellyFraction);
      expect(result.fractionalKelly).toBeLessThan(result.kellyFraction);
    });

    it('should return 0 Kelly for break-even win rate (50%)', () => {
      const result = kelly.calculateKellyFraction({
        winRate: 0.50,
        avgWin: 100,
        avgLoss: 100,
        riskRewardRatio: 1.0
      });

      expect(result.kellyFraction).toBe(0);
    });

    it('should handle high win rate (70%)', () => {
      const result = kelly.calculateKellyFraction({
        winRate: 0.70,
        avgWin: 150,
        avgLoss: 100,
        riskRewardRatio: 1.5,
        tradeCount: 200
      });

      expect(result.kellyFraction).toBeGreaterThan(0);
      expect(result.confidenceLevel).toBe('high');
    });

    it('should cap confidence as low with insufficient trades (< 25)', () => {
      const result = kelly.calculateKellyFraction({
        winRate: 0.60,
        avgWin: 100,
        avgLoss: 50,
        riskRewardRatio: 2.0,
        tradeCount: 10
      });

      expect(result.confidenceLevel).toBe('low');
    });

    it('should set confidence as medium with 25-50 trades', () => {
      const result = kelly.calculateKellyFraction({
        winRate: 0.60,
        avgWin: 100,
        avgLoss: 50,
        riskRewardRatio: 2.0,
        tradeCount: 35
      });

      expect(result.confidenceLevel).toBe('medium');
    });

    it('should provide safeKelly as quarter-kelly (most conservative)', () => {
      const result = kelly.calculateKellyFraction({
        winRate: 0.62,
        avgWin: 180,
        avgLoss: 95,
        riskRewardRatio: 1.89,
        tradeCount: 150
      });

      expect(result.safeKellyFraction).toBeCloseTo(result.kellyFraction / 4, 4);
    });

    it('should provide fractionalKelly as half-kelly (moderate)', () => {
      const result = kelly.calculateKellyFraction({
        winRate: 0.62,
        avgWin: 180,
        avgLoss: 95,
        riskRewardRatio: 1.89
      });

      expect(result.fractionalKelly).toBeCloseTo(result.kellyFraction / 2, 4);
    });

    it('should handle invalid inputs gracefully', () => {
      const result = kelly.calculateKellyFraction({
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        riskRewardRatio: 0
      });

      expect(result.kellyFraction).toBe(0);
      expect(result.confidenceLevel).toBe('low');
    });
  });

  // ========================================================================
  // 3. VOLATILITY-BASED SIZER TESTS
  // ========================================================================

  describe('3. Volatility-Based Sizer', () => {
    let sizer: VolatilityBasedSizer;

    beforeEach(() => {
      sizer = new VolatilityBasedSizer();
    });

    it('should identify low volatility regime (< 0.5%)', () => {
      const result = sizer.calculateVolatilityAdjustment(0.3);
      expect(result.regime).toBe('low');
      expect(result.adjustment).toBe(1.3);
    });

    it('should identify normal volatility regime (1.0-1.5%)', () => {
      const result = sizer.calculateVolatilityAdjustment(1.2);
      expect(result.regime).toBe('normal');
      expect(result.adjustment).toBe(1.0);
    });

    it('should identify high volatility regime (1.5-2.0%)', () => {
      const result = sizer.calculateVolatilityAdjustment(1.8);
      expect(result.regime).toBe('high');
      expect(result.adjustment).toBeLessThan(1.0);
    });

    it('should identify extreme volatility regime (> 2.5%)', () => {
      const result = sizer.calculateVolatilityAdjustment(3.0);
      expect(result.regime).toBe('extreme');
      expect(result.adjustment).toBe(0.5);
    });

    it('should apply regime-based multipliers', () => {
      const trending = sizer.calculateRegimeAdjustment('TRENDING');
      const ranging = sizer.calculateRegimeAdjustment('RANGING');
      const volatile = sizer.calculateRegimeAdjustment('VOLATILE');

      expect(trending.adjustment).toBeGreaterThan(1.0);
      expect(ranging.adjustment).toBeLessThan(1.0);
      expect(volatile.adjustment).toBeLessThan(1.0);
    });

    it('should handle unknown regime gracefully', () => {
      const result = sizer.calculateRegimeAdjustment('UNKNOWN');
      expect(result.adjustment).toBe(1.0);
    });
  });

  // ========================================================================
  // 4. SIGNAL STRENGTH SIZER TESTS
  // ========================================================================

  describe('4. Signal Strength Sizer', () => {
    let sizer: SignalStrengthSizer;

    beforeEach(() => {
      sizer = new SignalStrengthSizer();
    });

    it('should reject signals below 0.3 threshold', () => {
      const result = sizer.calculateSignalAdjustment(0.25);
      expect(result.shouldTrade).toBe(false);
      expect(result.adjustment).toBe(0);
    });

    it('should allow signals at exactly 0.3 with 50% size', () => {
      const result = sizer.calculateSignalAdjustment(0.3);
      expect(result.shouldTrade).toBe(true);
      expect(result.adjustment).toBe(0.5);
    });

    it('should scale from 50% (0.3-0.5) to 75% (0.5-0.65)', () => {
      const weak = sizer.calculateSignalAdjustment(0.4);
      const moderate = sizer.calculateSignalAdjustment(0.6);

      expect(weak.adjustment).toBe(0.5);
      expect(moderate.adjustment).toBe(0.75);
    });

    it('should scale to 100% at 0.8 signal strength', () => {
      const result = sizer.calculateSignalAdjustment(0.8);
      expect(result.adjustment).toBe(1.0);
    });

    it('should boost to 115% for strong signals (0.8-0.9)', () => {
      const result = sizer.calculateSignalAdjustment(0.85);
      expect(result.adjustment).toBe(1.15);
    });

    it('should boost to 130% for very strong signals (>= 0.9)', () => {
      const result = sizer.calculateSignalAdjustment(0.95);
      expect(result.adjustment).toBe(1.3);
    });
  });

  // ========================================================================
  // 5. CORRELATION-BASED SIZER TESTS
  // ========================================================================

  describe('5. Correlation-Based Sizer', () => {
    let sizer: CorrelationBasedSizer;

    beforeEach(() => {
      sizer = new CorrelationBasedSizer();
    });

    it('should boost position for negative correlation (hedge)', () => {
      const strong = sizer.calculateCorrelationAdjustment(-0.6);
      expect(strong.adjustment).toBe(1.25);
      expect(strong.hedgeOrDiversify).toBe('hedge');
    });

    it('should slightly boost for mild negative correlation', () => {
      const mild = sizer.calculateCorrelationAdjustment(-0.3);
      expect(mild.adjustment).toBe(1.1);
      expect(mild.hedgeOrDiversify).toBe('hedge');
    });

    it('should keep base size for low correlation', () => {
      const low = sizer.calculateCorrelationAdjustment(0.15);
      expect(low.adjustment).toBe(1.0);
      expect(low.hedgeOrDiversify).toBe('neutral');
    });

    it('should reduce size for high correlation (diversify)', () => {
      const high = sizer.calculateCorrelationAdjustment(0.75);
      expect(high.adjustment).toBe(0.7);
      expect(high.hedgeOrDiversify).toBe('diversify');
    });

    it('should significantly reduce for very high correlation (> 0.8)', () => {
      const veryHigh = sizer.calculateCorrelationAdjustment(0.95);
      expect(veryHigh.adjustment).toBe(0.5);
      expect(veryHigh.hedgeOrDiversify).toBe('diversify');
    });

    it('should estimate correlation for same symbol as 0.95', () => {
      const existing: PortfolioPosition[] = [
        {
          symbol: 'BTC/USD',
          quantity: 1,
          entryPrice: 44000,
          currentPrice: 45000,
          unrealizedPnL: 1000,
          correlation: 0.95
        }
      ];

      const corr = sizer.estimatePortfolioCorrelation('BTC/USD', existing);
      expect(corr).toBe(0.95);
    });

    it('should estimate moderate correlation for same asset class', () => {
      const existing: PortfolioPosition[] = [
        { symbol: 'ETH/USD', quantity: 10, entryPrice: 2500, currentPrice: 2600, unrealizedPnL: 1000 },
        { symbol: 'BTC/USD', quantity: 0.5, entryPrice: 44000, currentPrice: 45000, unrealizedPnL: 500 }
      ];

      const corr = sizer.estimatePortfolioCorrelation('BTC/USD', existing);
      expect(corr).toBeGreaterThanOrEqual(0.4);
    });

    it('should estimate low correlation for different asset classes', () => {
      const existing: PortfolioPosition[] = [
        { symbol: 'EURUSD', quantity: 100000, entryPrice: 1.1, currentPrice: 1.105, unrealizedPnL: 500 }
      ];

      const corr = sizer.estimatePortfolioCorrelation('BTC/USD', existing);
      expect(corr).toBeLessThan(0.3);
    });

    it('should return 0 correlation for empty portfolio', () => {
      const corr = sizer.estimatePortfolioCorrelation('BTC/USD', []);
      expect(corr).toBe(0);
    });
  });

  // ========================================================================
  // 6. RISK-TO-REWARD & EQUITY PERCENTAGE TESTS
  // ========================================================================

  describe('6. Risk-to-Reward Sizer', () => {
    let sizer: RiskToRewardSizer;

    beforeEach(() => {
      sizer = new RiskToRewardSizer();
    });

    it('should calculate quantity based on risk distance', () => {
      const result = sizer.calculateRiskBasedSize(100, 45000, 44000);
      expect(result.quantity).toBeCloseTo(0.1, 2);
      expect(result.positionSize).toBeCloseTo(4500, 0);
    });

    it('should handle wide stop losses', () => {
      const result = sizer.calculateRiskBasedSize(100, 45000, 44000);
      expect(result.quantity).toBeLessThan(1);
    });

    it('should handle tight stop losses', () => {
      const result = sizer.calculateRiskBasedSize(100, 45000, 44900);
      expect(result.quantity).toBeGreaterThan(0.1);
    });

    it('should return 0 when stop loss equals entry', () => {
      const result = sizer.calculateRiskBasedSize(100, 45000, 45000);
      expect(result.quantity).toBe(0);
      expect(result.positionSize).toBe(0);
    });
  });

  describe('7. Equity Percentage Sizer', () => {
    let sizer: EquityPercentageSizer;

    beforeEach(() => {
      sizer = new EquityPercentageSizer();
    });

    it('should calculate risk amount as percentage of equity', () => {
      const result = sizer.calculateEquityPercentageSize(100000, 0.02);
      expect(result.riskAmount).toBe(2000);
    });

    it('should calculate max daily risk as 5% of equity', () => {
      const result = sizer.calculateEquityPercentageSize(100000, 0.02);
      expect(result.maxDailyRisk).toBe(5000);
    });

    it('should limit max open positions', () => {
      const result = sizer.calculateEquityPercentageSize(100000, 0.02);
      expect(result.maxPositions).toBeLessThanOrEqual(5);
    });
  });

  // ========================================================================
  // 8. DAILY RISK BUDGET MANAGER TESTS
  // ========================================================================

  describe('8. Daily Risk Budget Manager', () => {
    let manager: DailyRiskBudgetManager;

    beforeEach(() => {
      manager = new DailyRiskBudgetManager();
    });

    it('should initialize daily budget with 5% default', () => {
      const budget = manager.calculateDailyBudget(100000);
      expect(budget.maxDailyRiskAmount).toBe(5000);
      expect(budget.remainingRiskAmount).toBe(5000);
      expect(budget.isOpen).toBe(true);
    });

    it('should initialize with custom daily risk percent', () => {
      const budget = manager.calculateDailyBudget(100000, 0.10);
      expect(budget.maxDailyRiskAmount).toBe(10000);
    });

    it('should update budget after trade execution', () => {
      let budget = manager.calculateDailyBudget(100000);
      budget = manager.updateBudgetAfterTrade(budget, 1000);

      expect(budget.usedRiskAmount).toBe(1000);
      expect(budget.remainingRiskAmount).toBe(4000);
      expect(budget.tradesExecutedToday).toBe(1);
      expect(budget.isOpen).toBe(true);
    });

    it('should close budget when daily limit exceeded', () => {
      let budget = manager.calculateDailyBudget(100000);
      budget = manager.updateBudgetAfterTrade(budget, 5000);
      budget = manager.updateBudgetAfterTrade(budget, 1000);

      expect(budget.usedRiskAmount).toBe(6000);
      expect(budget.isOpen).toBe(false);
    });

    it('should report safe status when < 50% used', () => {
      let budget = manager.calculateDailyBudget(100000);
      budget = manager.updateBudgetAfterTrade(budget, 1000);

      const status = manager.getBudgetStatus(budget);
      expect(status.status).toBe('safe');
      expect(status.percentUsed).toBeCloseTo(20, 0);
    });

    it('should report caution at 50-80% used', () => {
      let budget = manager.calculateDailyBudget(100000);
      budget = manager.updateBudgetAfterTrade(budget, 3000);

      const status = manager.getBudgetStatus(budget);
      expect(status.status).toBe('caution');
    });

    it('should report exceeded when > 100% used', () => {
      let budget = manager.calculateDailyBudget(100000);
      budget = manager.updateBudgetAfterTrade(budget, 5500);

      const status = manager.getBudgetStatus(budget);
      expect(status.status).toBe('exceeded');
    });

    it('should calculate budget adjustment multiplier', () => {
      let budget = manager.calculateDailyBudget(100000);
      budget.isOpen = true;
      budget.remainingRiskAmount = 2500; // 50% remaining

      const adj = manager.calculateBudgetAdjustment(budget);
      expect(adj).toBe(1.0); // Full position allowed at 50% remaining
    });

    it('should reduce position when 50-20% remaining', () => {
      let budget = manager.calculateDailyBudget(100000);
      budget.isOpen = true;
      budget.usedRiskAmount = 3500;
      budget.remainingRiskAmount = 1500; // 30% remaining

      const adj = manager.calculateBudgetAdjustment(budget);
      expect(adj).toBeLessThan(1.0);
    });

    it('should allow no trades when budget exhausted', () => {
      let budget = manager.calculateDailyBudget(100000);
      budget.isOpen = false;

      const adj = manager.calculateBudgetAdjustment(budget);
      expect(adj).toBe(0);
    });
  });

  // ========================================================================
  // 9. UNIFIED ENGINE INTEGRATION TESTS
  // ========================================================================

  describe('9. Unified Decision Engine', () => {
    it('should combine all methods for final position size', () => {
      const input = createBaseInput();
      const output = engine.calculatePositionSize(input);

      expect(output.recommendedQuantity).toBeGreaterThan(0);
      expect(output.recommendedSize).toBeGreaterThan(0);
      expect(output.riskAmount).toBeGreaterThan(0);
    });

    it('should include method breakdown in output', () => {
      const input = createBaseInput();
      const output = engine.calculatePositionSize(input);

      expect(output.methodBreakdown).toBeDefined();
      expect(output.methodBreakdown.confidenceBasedSize).toBeGreaterThan(0);
      expect(output.methodBreakdown.volatilityAdjustedSize).toBeGreaterThan(0);
    });

    it('should apply Kelly criterion when historical data available', () => {
      const input = createBaseInput();
      input.historicalMetrics = {
        'ML': createSourceMetrics(),
        'SCANNER': createSourceMetrics({ source: 'SCANNER', totalTrades: 30 }),
        'GATEWAY': createSourceMetrics({ source: 'GATEWAY', totalTrades: 15 }),
        'AGENT': createSourceMetrics({ source: 'AGENT', totalTrades: 20 })
      };

      const output = engine.calculatePositionSize(input);
      expect(output.kellyFraction).toBeGreaterThan(0);
      expect(output.kellyFraction).toBeLessThanOrEqual(0.25);
    });

    it('should enforce daily risk budget', () => {
      const input = createBaseInput();
      const budget = new DailyRiskBudgetManager().calculateDailyBudget(100000, 0.05);
      input.dailyRiskBudget = budget;

      const output = engine.calculatePositionSize(input);
      expect(output.dailyBudgetImpact).toBeDefined();
      expect(output.dailyBudgetImpact?.dailyBudgetStatus).toBe('safe');
    });

    it('should reject trades when daily budget exhausted', () => {
      const input = createBaseInput();
      const budget = new DailyRiskBudgetManager().calculateDailyBudget(100000, 0.05);
      budget.isOpen = false;

      input.dailyRiskBudget = budget;
      const output = engine.calculatePositionSize(input);

      expect(output.recommendedQuantity).toBe(0);
    });

    it('should calculate confidence score combining multiple factors', () => {
      const input = createBaseInput();
      input.historicalMetrics = {
        'ML': createSourceMetrics(),
        'SCANNER': createSourceMetrics({ source: 'SCANNER', totalTrades: 30 }),
        'GATEWAY': createSourceMetrics({ source: 'GATEWAY', totalTrades: 15 }),
        'AGENT': createSourceMetrics({ source: 'AGENT', totalTrades: 20 })
      };

      const output = engine.calculatePositionSize(input);
      expect(output.dashboardMetrics?.confidenceScore).toBeGreaterThan(0);
      expect(output.dashboardMetrics?.confidenceScore).toBeLessThanOrEqual(1);
    });

    it('should rate recommendation as STRONG for high signal + high metrics', () => {
      const input = createBaseInput();
      input.signalStrength = 0.95;
      input.historicalMetrics = {
        'ML': createSourceMetrics({ winRate: 0.70 }),
        'SCANNER': createSourceMetrics({ source: 'SCANNER', totalTrades: 30 }),
        'GATEWAY': createSourceMetrics({ source: 'GATEWAY', totalTrades: 15 }),
        'AGENT': createSourceMetrics({ source: 'AGENT', totalTrades: 20 })
      };

      const output = engine.calculatePositionSize(input);
      expect(output.dashboardMetrics?.recommendationStrength).toBe('STRONG');
    });

    it('should rate recommendation as WEAK for low confidence', () => {
      const input = createBaseInput();
      input.signalStrength = 0.4;

      const output = engine.calculatePositionSize(input);
      expect(output.dashboardMetrics?.recommendationStrength).toBe('WEAK');
    });

    it('should REJECT trade when signal below 0.3', () => {
      const input = createBaseInput();
      input.signalStrength = 0.25;

      const output = engine.calculatePositionSize(input);
      expect(output.dashboardMetrics?.recommendationStrength).toBe('REJECT');
      expect(output.recommendedQuantity).toBe(0);
    });
  });

  // ========================================================================
  // 10. EDGE CASES & STRESS TESTS
  // ========================================================================

  describe('10. Edge Cases & Stress Tests', () => {
    it('should handle very small account ($1000)', () => {
      const input = createBaseInput();
      input.accountEquity = 1000;
      input.accountRiskPercentage = 2.0;

      const output = engine.calculatePositionSize(input);
      expect(output.riskAmount).toBeGreaterThan(0);
      expect(output.riskAmount).toBeLessThanOrEqual(20);
    });

    it('should handle very large account ($10M)', () => {
      const input = createBaseInput();
      input.accountEquity = 10000000;
      input.accountRiskPercentage = 0.75;

      const output = engine.calculatePositionSize(input);
      expect(output.recommendedQuantity).toBeGreaterThan(0);
      expect(Number.isFinite(output.recommendedQuantity)).toBe(true);
    });

    it('should handle very tight stops (0.1% away)', () => {
      const input = createBaseInput();
      input.stopLoss = 44955;
      input.entryPrice = 45000;

      const output = engine.calculatePositionSize(input);
      expect(output.recommendedQuantity).toBeGreaterThan(0);
    });

    it('should handle wide stops (5% away)', () => {
      const input = createBaseInput();
      input.stopLoss = 42750;
      input.entryPrice = 45000;

      const output = engine.calculatePositionSize(input);
      expect(output.recommendedQuantity).toBeGreaterThan(0);
    });

    it('should handle multiple correlated positions', () => {
      const input = createBaseInput();
      input.existingPositions = [
        {
          symbol: 'ETH/USD',
          quantity: 10,
          entryPrice: 2500,
          currentPrice: 2600,
          unrealizedPnL: 1000
        },
        {
          symbol: 'SOL/USD',
          quantity: 100,
          entryPrice: 150,
          currentPrice: 160,
          unrealizedPnL: 1000
        }
      ];

      const output = engine.calculatePositionSize(input);
      expect(output.sizing.correlationAdjustment).toBeLessThanOrEqual(1.0);
    });

    it('should handle portfolio with hedging instruments', () => {
      const input = createBaseInput();
      input.signalAction = 'BUY';
      input.existingPositions = [
        {
          symbol: 'VIX', // Inverse correlation hedge
          quantity: 100,
          entryPrice: 20,
          currentPrice: 21,
          unrealizedPnL: 100
        }
      ];

      const output = engine.calculatePositionSize(input);
      expect(output.sizing.correlationAdjustment).toBeGreaterThanOrEqual(1.0);
    });

    it('should handle extreme volatility gracefully', () => {
      const input = createBaseInput();
      input.volatility = 10.0; // Extreme: 10% ATR

      const output = engine.calculatePositionSize(input);
      expect(output.sizing.volatilityAdjustment).toBeLessThanOrEqual(0.5);
      expect(output.recommendedQuantity).toBeGreaterThan(0);
    });

    it('should provide comprehensive rationale for decision', () => {
      const input = createBaseInput();
      input.historicalMetrics = {
        'ML': createSourceMetrics()
      };

      const output = engine.calculatePositionSize(input);
      expect(output.rationale.length).toBeGreaterThan(0);
      expect(output.rationale[0]).toBeTruthy();
    });
  });

  // ========================================================================
  // 11. DASHBOARD METRICS & MONITORING TESTS
  // ========================================================================

  describe('11. Dashboard Metrics & Monitoring', () => {
    it('should track all methods applied', () => {
      const input = createBaseInput();
      const output = engine.calculatePositionSize(input);

      expect(output.dashboardMetrics?.methodsApplied).toContain('CONFIDENCE_BASED');
      expect(output.dashboardMetrics?.methodsApplied).toContain('VOLATILITY_BASED');
      expect(output.dashboardMetrics?.methodsApplied).toContain('RISK_TO_REWARD');
    });

    it('should calculate total adjustment multiplier', () => {
      const input = createBaseInput();
      const output = engine.calculatePositionSize(input);

      expect(output.dashboardMetrics?.totalAdjustmentMultiplier).toBeGreaterThan(0);
    });

    it('should provide source metrics for analysis', () => {
      const input = createBaseInput();
      input.historicalMetrics = {
        'ML': createSourceMetrics(),
        'SCANNER': createSourceMetrics({ source: 'SCANNER', totalTrades: 30 }),
        'GATEWAY': createSourceMetrics({ source: 'GATEWAY', totalTrades: 15 }),
        'AGENT': createSourceMetrics({ source: 'AGENT', totalTrades: 20 })
      };

      const output = engine.calculatePositionSize(input);
      expect(output.sourceMetrics).toBeDefined();
      expect(output.sourceMetrics?.source).toBe('ML');
      expect(output.sourceMetrics?.sourceWeight).toBe(1.0);
    });

    it('should track daily budget impact', () => {
      const input = createBaseInput();
      const budget = new DailyRiskBudgetManager().calculateDailyBudget(100000);
      input.dailyRiskBudget = budget;

      const output = engine.calculatePositionSize(input);
      expect(output.dailyBudgetImpact?.riskUsedByThisTrade).toBeGreaterThan(0);
      expect(output.dailyBudgetImpact?.remainingRiskToday).toBeGreaterThanOrEqual(0);
    });

    it('should provide detailed rationale for position sizing decision', () => {
      const input = createBaseInput();
      input.historicalMetrics = {
        'ML': createSourceMetrics(),
        'SCANNER': createSourceMetrics({ source: 'SCANNER', totalTrades: 30 }),
        'GATEWAY': createSourceMetrics({ source: 'GATEWAY', totalTrades: 15 }),
        'AGENT': createSourceMetrics({ source: 'AGENT', totalTrades: 20 })
      };

      const output = engine.calculatePositionSize(input);
      expect(output.rationale.length).toBeGreaterThan(3);
    });
  });

  // ========================================================================
  // 12. BACKWARD COMPATIBILITY TESTS
  // ========================================================================

  describe('12. Backward Compatibility', () => {
    it('should work with legacy input without new fields', () => {
      const input = createBaseInput();
      const { signalSource, historicalMetrics, dailyRiskBudget, ...legacyInput } = input;

      const output = engine.calculatePositionSize(legacyInput as PositionSizingInput);
      expect(output.recommendedQuantity).toBeGreaterThan(0);
    });

    it('should use defaults when optional fields missing', () => {
      const input = createBaseInput();
      const { volatilityRegime, ...partialInput } = input;

      const output = engine.calculatePositionSize(partialInput as PositionSizingInput);
      expect(output.recommendedQuantity).toBeGreaterThan(0);
    });

    it('should initialize daily budget if not provided', () => {
      const input = createBaseInput();
      const { dailyRiskBudget, ...noBudgetInput } = input;

      const output = engine.calculatePositionSize(noBudgetInput as PositionSizingInput);
      expect(output.dailyBudgetImpact).toBeUndefined(); // Only if budget provided
    });
  });

  // ========================================================================
  // 13. RL ADAPTIVE HOOKS (FUTURE INTEGRATION)
  // ========================================================================

  describe('13. RL Adaptive Hooks (Future)', () => {
    it('should support RL_ADAPTIVE sizing strategy in type system', () => {
      const input = createBaseInput();
      input.sizingStrategy = 'RL_ADAPTIVE';

      const output = engine.calculatePositionSize(input);
      expect(output.methodBreakdown.rlAdaptiveSize).toBeUndefined(); // Not yet implemented
    });

    it('should have rlAdaptiveSize field for future implementation', () => {
      const input = createBaseInput();
      const output = engine.calculatePositionSize(input);

      expect('rlAdaptiveSize' in output.methodBreakdown).toBe(true);
    });
  });
});
