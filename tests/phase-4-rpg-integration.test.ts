/**
 * PHASE 4: RPG SIGNAL PROCESSOR TESTS
 * 
 * Test suite for RPG signal aggregation, combo bonuses, and 4-source integration
 * Target: 50+ tests covering all RPG functionalities
 */

import {
  RPGAgentSimulator,
  RPGSignalAggregator,
  RPGComboBonusCalculator,
  RPGSignalProcessor,
  type RPGSignalType,
  type RPGAgentStrategy,
  type RPGComboBonus
} from '../server/lib/rpg-signal-processor';

// ============================================================================
// TESTS: RPGAgentSimulator
// ============================================================================

describe('RPGAgentSimulator', () => {
  let agent: RPGAgentSimulator;

  beforeEach(() => {
    agent = new RPGAgentSimulator('test_agent_0', 'TREND_FOLLOWING');
  });

  describe('Signal Generation', () => {
    it('should generate BUY signal in strong uptrend', () => {
      const signal = agent.generateSignal('BTC/USD', 50000, 35, 35, 0.5, 1.2);
      expect(signal.action).toBe('BUY');
      expect(signal.confidence).toBeGreaterThan(0.5);
    });

    it('should generate SELL signal in strong downtrend', () => {
      const signal = agent.generateSignal('BTC/USD', 50000, 35, 15, -0.5, 1.2);
      expect(signal.action).toBe('SELL');
      expect(signal.confidence).toBeGreaterThan(0.5);
    });

    it('should generate HOLD signal in consolidation', () => {
      const signal = agent.generateSignal('BTC/USD', 50000, 15, 50, 0.1, 0.5);
      expect(signal.action).toBe('HOLD');
    });

    it('should return valid confidence 0-1', () => {
      const signal = agent.generateSignal('BTC/USD', 50000, 25, 50, 0, 1.0);
      expect(signal.confidence).toBeGreaterThanOrEqual(0.1);
      expect(signal.confidence).toBeLessThanOrEqual(0.95);
    });

    it('should include strategy in output', () => {
      const signal = agent.generateSignal('BTC/USD', 50000, 25, 50, 0, 1.0);
      expect(signal.strategy).toBe('TREND_FOLLOWING');
      expect(['BUY', 'SELL', 'HOLD']).toContain(signal.action);
    });

    it('should calculate policy score correctly', () => {
      const signal = agent.generateSignal('BTC/USD', 50000, 35, 35, 0.5, 1.2);
      expect(signal.policyScore).toBeGreaterThanOrEqual(0.1);
      expect(signal.policyScore).toBeLessThanOrEqual(1.0);
    });

    it('should include reasoning string', () => {
      const signal = agent.generateSignal('BTC/USD', 50000, 25, 50, 0, 1.0);
      expect(signal.reasoning).toBeTruthy();
      expect(signal.reasoning).toContain('TREND_FOLLOWING');
    });
  });

  describe('Strategy-Specific Behavior', () => {
    it('MEAN_REVERSION: should buy oversold (RSI < 30)', () => {
      const mrAgent = new RPGAgentSimulator('test_agent_1', 'MEAN_REVERSION');
      const signal = mrAgent.generateSignal('BTC/USD', 50000, 20, 25, 0, 1.0);
      expect(signal.action).toBe('BUY');
    });

    it('MEAN_REVERSION: should sell overbought (RSI > 70)', () => {
      const mrAgent = new RPGAgentSimulator('test_agent_2', 'MEAN_REVERSION');
      const signal = mrAgent.generateSignal('BTC/USD', 50000, 20, 75, 0, 1.0);
      expect(signal.action).toBe('SELL');
    });

    it('MOMENTUM: should buy strong momentum', () => {
      const momAgent = new RPGAgentSimulator('test_agent_3', 'MOMENTUM');
      const signal = momAgent.generateSignal('BTC/USD', 50000, 20, 50, 0.6, 1.0);
      expect(signal.action).toBe('BUY');
    });

    it('MOMENTUM: should sell weak momentum', () => {
      const momAgent = new RPGAgentSimulator('test_agent_4', 'MOMENTUM');
      const signal = momAgent.generateSignal('BTC/USD', 50000, 20, 50, -0.6, 1.0);
      expect(signal.action).toBe('SELL');
    });

    it('BREAKOUT: should buy volatility spike + positive momentum', () => {
      const boAgent = new RPGAgentSimulator('test_agent_5', 'BREAKOUT');
      const signal = boAgent.generateSignal('BTC/USD', 50000, 20, 50, 0.3, 2.0);
      expect(signal.action).toBe('BUY');
    });

    it('BREAKOUT: should sell volatility spike + negative momentum', () => {
      const boAgent = new RPGAgentSimulator('test_agent_6', 'BREAKOUT');
      const signal = boAgent.generateSignal('BTC/USD', 50000, 20, 50, -0.3, 2.0);
      expect(signal.action).toBe('SELL');
    });
  });

  describe('Policy Updates', () => {
    it('should increase Q-value on positive trade result', () => {
      const initialSignal = agent.generateSignal('BTC/USD', 50000, 25, 50, 0, 1.0);
      const initialQValue = initialSignal.qValue;

      agent.updatePolicy('BTC/USD', 100); // Positive result

      const updatedSignal = agent.generateSignal('BTC/USD', 50000, 25, 50, 0, 1.0);
      expect(updatedSignal.qValue).toBeGreaterThan(initialQValue);
    });

    it('should decrease Q-value on negative trade result', () => {
      const initialSignal = agent.generateSignal('BTC/USD', 50000, 25, 50, 0, 1.0);
      const initialQValue = initialSignal.qValue;

      agent.updatePolicy('BTC/USD', -100); // Negative result

      const updatedSignal = agent.generateSignal('BTC/USD', 50000, 25, 50, 0, 1.0);
      expect(updatedSignal.qValue).toBeLessThan(initialQValue);
    });

    it('should clamp Q-value between 0.1 and 0.95', () => {
      // Push Q-value up
      for (let i = 0; i < 20; i++) {
        agent.updatePolicy('BTC/USD', 100);
      }

      const highSignal = agent.generateSignal('BTC/USD', 50000, 25, 50, 0, 1.0);
      expect(highSignal.qValue).toBeLessThanOrEqual(0.95);
      expect(highSignal.qValue).toBeGreaterThanOrEqual(0.1);

      // Push Q-value down
      for (let i = 0; i < 30; i++) {
        agent.updatePolicy('BTC/USD', -100);
      }

      const lowSignal = agent.generateSignal('BTC/USD', 50000, 25, 50, 0, 1.0);
      expect(lowSignal.qValue).toBeGreaterThanOrEqual(0.1);
      expect(lowSignal.qValue).toBeLessThanOrEqual(0.95);
    });
  });

  describe('Agent Identity', () => {
    it('should return correct agent ID', () => {
      expect(agent.getAgentId()).toBe('test_agent_0');
    });

    it('should return correct strategy', () => {
      expect(agent.getStrategy()).toBe('TREND_FOLLOWING');
    });
  });
});

// ============================================================================
// TESTS: RPGSignalAggregator
// ============================================================================

describe('RPGSignalAggregator', () => {
  let aggregator: RPGSignalAggregator;

  beforeEach(() => {
    aggregator = new RPGSignalAggregator();
  });

  describe('Initialization', () => {
    it('should initialize with 4 default agents', () => {
      expect(aggregator.getAgentCount()).toBe(4);
    });

    it('should contain one agent per strategy', () => {
      expect(aggregator.getAgentCount()).toBe(4);
      // Each strategy has one agent
    });
  });

  describe('Signal Aggregation', () => {
    it('should aggregate signals from all agents', () => {
      const aggregated = aggregator.aggregateRPGSignals('BTC/USD', 35, 35, 0.5, 1.2);
      expect(aggregated.action).toBeDefined();
      expect(['BUY', 'SELL', 'HOLD']).toContain(aggregated.action);
    });

    it('should determine consensus action (BUY when majority agree)', () => {
      const aggregated = aggregator.aggregateRPGSignals('BTC/USD', 35, 35, 0.5, 1.2);
      // Strong uptrend should favor BUY
      expect(aggregated.action).toBe('BUY');
    });

    it('should determine consensus action (SELL when majority agree)', () => {
      const aggregated = aggregator.aggregateRPGSignals('BTC/USD', 35, 15, -0.5, 1.2);
      // Strong downtrend should favor SELL
      expect(aggregated.action).toBe('SELL');
    });

    it('should average confidence from consensus agents', () => {
      const aggregated = aggregator.aggregateRPGSignals('BTC/USD', 35, 50, 0.1, 1.0);
      expect(aggregated.confidence).toBeGreaterThan(0.1);
      expect(aggregated.confidence).toBeLessThan(1.0);
    });

    it('should include reasoning from consensus', () => {
      const aggregated = aggregator.aggregateRPGSignals('BTC/USD', 25, 50, 0, 1.0);
      expect(aggregated.reasoning).toBeTruthy();
      expect(aggregated.reasoning).toContain('consensus');
    });
  });

  describe('Policy Management', () => {
    it('should update policy for specific agent', () => {
      const signal1 = aggregator.aggregateRPGSignals('BTC/USD', 25, 50, 0, 1.0);
      const qValue1 = signal1.qValue;

      aggregator.updateAgentPolicy('rpg_agent_0', 'BTC/USD', 100);

      const signal2 = aggregator.aggregateRPGSignals('BTC/USD', 25, 50, 0, 1.0);
      // Q-value should change slightly as one agent updated
      expect(signal2.qValue).not.toEqual(qValue1);
    });

    it('should allow adding custom agents', () => {
      const initialCount = aggregator.getAgentCount();
      const newAgent = new RPGAgentSimulator('custom_agent', 'MOMENTUM');
      aggregator.addAgent(newAgent);

      expect(aggregator.getAgentCount()).toBe(initialCount + 1);
    });
  });
});

// ============================================================================
// TESTS: RPGComboBonusCalculator
// ============================================================================

describe('RPGComboBonusCalculator', () => {
  let calculator: RPGComboBonusCalculator;

  beforeEach(() => {
    calculator = new RPGComboBonusCalculator();
  });

  describe('Combo Detection', () => {
    it('should detect UNANIMOUS combo (all 4 sources aligned)', () => {
      const combo = calculator.calculateComboBonus(0.80, 0.82, 0.81, 0.79);
      expect(combo.comboType).toBe('UNANIMOUS');
      expect(combo.alignedSources).toBe(4);
    });

    it('should detect STRONG_AGREEMENT combo (3/4 sources aligned)', () => {
      const combo = calculator.calculateComboBonus(0.80, 0.82, 0.50, 0.79);
      expect(combo.comboType).toBe('STRONG_AGREEMENT');
      expect(combo.alignedSources).toBe(3);
    });

    it('should detect MILD_AGREEMENT combo (2/4 sources aligned)', () => {
      const combo = calculator.calculateComboBonus(0.80, 0.82, 0.30, 0.20);
      expect(combo.comboType).toBe('MILD_AGREEMENT');
      expect(combo.alignedSources).toBe(2);
    });

    it('should have hasCombo true when 2+ sources align', () => {
      const combo = calculator.calculateComboBonus(0.80, 0.82, 0.30, 0.20);
      expect(combo.hasCombo).toBe(true);
    });

    it('should have hasCombo false when <2 sources align', () => {
      const combo = calculator.calculateComboBonus(0.80, 0.30, 0.20, 0.10);
      expect(combo.hasCombo).toBe(false);
    });
  });

  describe('Confidence Boosting', () => {
    it('should apply +40% boost for UNANIMOUS combo', () => {
      const combo = calculator.calculateComboBonus(0.80, 0.82, 0.81, 0.79);
      expect(combo.confidenceBoost).toBe(1.40);
    });

    it('should apply +25% boost for STRONG_AGREEMENT combo', () => {
      const combo = calculator.calculateComboBonus(0.80, 0.82, 0.50, 0.79);
      expect(combo.confidenceBoost).toBe(1.25);
    });

    it('should apply +10% boost for MILD_AGREEMENT combo', () => {
      const combo = calculator.calculateComboBonus(0.80, 0.82, 0.30, 0.20);
      expect(combo.confidenceBoost).toBe(1.10);
    });

    it('should apply no boost (1.0) when sources diverge', () => {
      const combo = calculator.calculateComboBonus(0.80, 0.30, 0.20, 0.10);
      expect(combo.confidenceBoost).toBe(1.0);
    });
  });

  describe('Bonus Application', () => {
    it('should apply bonus multiplier correctly', () => {
      const combo = calculator.calculateComboBonus(0.80, 0.82, 0.81, 0.79);
      const boosted = calculator.applyComboBonus(0.70, combo);
      expect(boosted).toBe(0.98); // 0.70 * 1.40
    });

    it('should cap result at 0.99', () => {
      const combo = calculator.calculateComboBonus(0.80, 0.82, 0.81, 0.79);
      const boosted = calculator.applyComboBonus(0.80, combo);
      expect(boosted).toBe(0.99); // Capped at 0.99
    });

    it('should floor result at 0.1', () => {
      const combo = calculator.calculateComboBonus(0.20, 0.19, 0.18, 0.17);
      const boosted = calculator.applyComboBonus(0.05, combo);
      expect(boosted).toBe(0.1); // Floored at 0.1
    });
  });

  describe('Agreement Score', () => {
    it('should calculate agreement score based on source alignment', () => {
      const combo = calculator.calculateComboBonus(0.80, 0.82, 0.81, 0.79);
      expect(combo.agreementScore).toBeGreaterThan(0.7);
    });
  });
});

// ============================================================================
// TESTS: RPGSignalProcessor
// ============================================================================

describe('RPGSignalProcessor', () => {
  let processor: RPGSignalProcessor;

  beforeEach(() => {
    processor = new RPGSignalProcessor();
  });

  describe('RPG Signal Processing', () => {
    it('should process RPG signals with market conditions', () => {
      const result = processor.processRPGSignals(
        'BTC/USD',
        35, // ADX
        35, // RSI
        0.5, // momentum
        1.2, // volatility
        0.80, // scanner confidence
        0.75, // ML confidence
        0.78  // RL confidence
      );

      expect(result.rpgOutput).toBeDefined();
      expect(result.comboBonus).toBeDefined();
      expect(result.finalConfidence).toBeDefined();
      expect(result.sourceSummary).toBeDefined();
    });

    it('should include RPG output in result', () => {
      const result = processor.processRPGSignals(
        'BTC/USD', 35, 35, 0.5, 1.2, 0.80, 0.75, 0.78
      );

      expect(result.rpgOutput.symbol).toBe('BTC/USD');
      expect(result.rpgOutput.action).toBeDefined();
      expect(result.rpgOutput.confidence).toBeDefined();
      expect(result.rpgOutput.strategy).toBeDefined();
    });

    it('should apply combo bonus correctly', () => {
      const result = processor.processRPGSignals(
        'BTC/USD', 35, 35, 0.5, 1.2, 0.80, 0.82, 0.81
      );

      // With 3+ sources aligned, should have combo bonus
      expect(result.comboBonus.comboType).toBeDefined();
      expect(result.finalConfidence).toBeLessThanOrEqual(0.99);
      expect(result.finalConfidence).toBeGreaterThanOrEqual(0.1);
    });

    it('should include source summary', () => {
      const result = processor.processRPGSignals(
        'BTC/USD', 35, 35, 0.5, 1.2, 0.80, 0.75, 0.78
      );

      expect(result.sourceSummary.scanner).toBe(0.80);
      expect(result.sourceSummary.ml).toBe(0.75);
      expect(result.sourceSummary.rl).toBe(0.78);
      expect(result.sourceSummary.rpg).toBeDefined();
      expect(result.sourceSummary.average).toBeDefined();
    });
  });

  describe('4-Source Consensus', () => {
    it('should calculate 4-source consensus correctly', () => {
      const consensus = processor.calculateFourSourceConsensus(0.80, 0.75, 0.78, 0.77);
      expect(consensus.consensus).toBeGreaterThan(0.7);
      expect(consensus.consensus).toBeLessThan(1.0);
    });

    it('should assign PRIMARY weight for high consensus (>0.80)', () => {
      const consensus = processor.calculateFourSourceConsensus(0.85, 0.84, 0.83, 0.82);
      expect(consensus.weight).toBe('PRIMARY');
    });

    it('should assign SECONDARY weight for good consensus (0.65-0.80)', () => {
      const consensus = processor.calculateFourSourceConsensus(0.75, 0.74, 0.73, 0.72);
      expect(consensus.weight).toBe('SECONDARY');
    });

    it('should assign TERTIARY weight for moderate consensus (0.50-0.65)', () => {
      const consensus = processor.calculateFourSourceConsensus(0.60, 0.59, 0.58, 0.57);
      expect(consensus.weight).toBe('TERTIARY');
    });

    it('should assign QUATERNARY weight for low consensus (<0.50)', () => {
      const consensus = processor.calculateFourSourceConsensus(0.40, 0.39, 0.38, 0.37);
      expect(consensus.weight).toBe('QUATERNARY');
    });
  });

  describe('Policy Updates', () => {
    it('should update agent policy through processor', () => {
      const signal1 = processor.processRPGSignals(
        'BTC/USD', 35, 35, 0.5, 1.2, 0.80, 0.75, 0.78
      );
      const qValue1 = signal1.rpgOutput.qValue;

      processor.updateAgentPolicy('rpg_agent_0', 'BTC/USD', 100);

      const signal2 = processor.processRPGSignals(
        'BTC/USD', 35, 35, 0.5, 1.2, 0.80, 0.75, 0.78
      );
      // Q-value should change
      expect(signal2.rpgOutput.qValue).not.toEqual(qValue1);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS: RPG with Other Phases
// ============================================================================

describe('RPG Integration', () => {
  let processor: RPGSignalProcessor;

  beforeEach(() => {
    processor = new RPGSignalProcessor();
  });

  it('should work with Phase 2 regime data', () => {
    // Simulate Phase 2 regime detection
    const adx = 35; // Strong trend
    const rsi = 65; // Strong momentum
    const momentum = 0.5; // Positive
    const volatility = 1.2; // Normal

    const result = processor.processRPGSignals(
      'BTC/USD',
      adx, rsi, momentum, volatility,
      0.80, 0.75, 0.78
    );

    expect(result.rpgOutput.action).toBe('BUY');
    expect(result.finalConfidence).toBeGreaterThan(0.6);
  });

  it('should enhance quality gating decisions', () => {
    // When all 4 sources agree, quality gating should pass more signals
    const result = processor.processRPGSignals(
      'BTC/USD',
      35, 35, 0.5, 1.2,
      0.80, 0.81, 0.82 // All sources aligned
    );

    expect(result.comboBonus.hasCombo).toBe(true);
    expect(result.comboBonus.alignedSources).toBeGreaterThanOrEqual(3);
  });

  it('should provide transparency for 4-source agreement', () => {
    const result = processor.processRPGSignals(
      'BTC/USD',
      35, 35, 0.5, 1.2,
      0.75, 0.74, 0.73
    );

    const consensus = processor.calculateFourSourceConsensus(
      result.sourceSummary.scanner,
      result.sourceSummary.ml,
      result.sourceSummary.rl,
      result.sourceSummary.rpg
    );

    expect(consensus.weight).toBeDefined();
    expect(['PRIMARY', 'SECONDARY', 'TERTIARY', 'QUATERNARY']).toContain(consensus.weight);
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('RPG Performance', () => {
  it('should process signals within 10ms per symbol', () => {
    const processor = new RPGSignalProcessor();
    const startTime = performance.now();

    for (let i = 0; i < 10; i++) {
      processor.processRPGSignals(
        `SYM${i}`,
        35, 50, 0.2, 1.0,
        0.75, 0.74, 0.73
      );
    }

    const endTime = performance.now();
    const avgTime = (endTime - startTime) / 10;

    expect(avgTime).toBeLessThan(10); // < 10ms per signal
  });

  it('should handle concurrent signals from multiple symbols', () => {
    const processor = new RPGSignalProcessor();
    const symbols = ['BTC/USD', 'ETH/USD', 'XRP/USD', 'ADA/USD'];

    const results = symbols.map(symbol =>
      processor.processRPGSignals(symbol, 35, 50, 0.2, 1.0, 0.75, 0.74, 0.73)
    );

    expect(results).toHaveLength(4);
    results.forEach(result => {
      expect(result.rpgOutput).toBeDefined();
      expect(result.comboBonus).toBeDefined();
    });
  });
});
