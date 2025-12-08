
/**
 * Market Sage - Meta-Agent Strategy Discovery System
 * 
 * Discovers new trading strategies by:
 * - Pattern mining from successful agent behaviors
 * - Cross-agent pattern synthesis
 * - Evolutionary strategy generation
 * - Performance-based strategy validation
 */

import { TradingAgent } from './TradingAgent';

export interface DiscoveredPattern {
  id: string;
  name: string;
  description: string;
  triggers: {
    market_conditions: string[];
    indicator_patterns: string[];
    regime_requirements: string[];
  };
  expected_performance: {
    win_rate: number;
    profit_factor: number;
    sample_size: number;
  };
  discovered_from: string[];  // Agent names that exhibited this pattern
  confidence: number;
  first_seen: Date;
  validation_status: 'TESTING' | 'VALIDATED' | 'REJECTED';
}

export interface StrategyGene {
  entry_logic: string;
  exit_logic: string;
  risk_params: any;
  fitness_score: number;
}

export class MarketSage {
  private discoveredPatterns: Map<string, DiscoveredPattern> = new Map();
  private strategyGenePool: StrategyGene[] = [];
  private performanceHistory: Map<string, number[]> = new Map();
  
  private MIN_SAMPLE_SIZE = 20;
  private MIN_WIN_RATE = 0.55;
  private MIN_PROFIT_FACTOR = 1.3;

  /**
   * Analyze agent behaviors to discover new patterns
   */
  async discoverPatterns(agents: TradingAgent[]): Promise<DiscoveredPattern[]> {
    const newPatterns: DiscoveredPattern[] = [];

    // Group agents by performance tier
    const topPerformers = agents
      .filter(a => a.trades >= this.MIN_SAMPLE_SIZE)
      .filter(a => a.win_rate >= this.MIN_WIN_RATE)
      .sort((a, b) => b.profit_factor - a.profit_factor)
      .slice(0, 5);

    if (topPerformers.length === 0) return newPatterns;

    // Mine common patterns from top performers
    const patterns = this.mineCommonBehaviors(topPerformers);

    for (const pattern of patterns) {
      if (!this.discoveredPatterns.has(pattern.id)) {
        this.discoveredPatterns.set(pattern.id, pattern);
        newPatterns.push(pattern);
        console.log(`🔬 Market Sage discovered new pattern: ${pattern.name}`);
      }
    }

    return newPatterns;
  }

  private mineCommonBehaviors(agents: TradingAgent[]): DiscoveredPattern[] {
    const patterns: DiscoveredPattern[] = [];

    // Pattern 1: Shared timing windows
    const timingPattern = this.analyzeTimingPatterns(agents);
    if (timingPattern) patterns.push(timingPattern);

    // Pattern 2: Shared indicator combinations
    const indicatorPattern = this.analyzeIndicatorCombinations(agents);
    if (indicatorPattern) patterns.push(indicatorPattern);

    // Pattern 3: Shared exit strategies
    const exitPattern = this.analyzeExitStrategies(agents);
    if (exitPattern) patterns.push(exitPattern);

    return patterns;
  }

  private analyzeTimingPatterns(agents: TradingAgent[]): DiscoveredPattern | null {
    // Analyze when agents are most successful
    const successfulTrades = agents.flatMap(agent => 
      agent.recent_trades.filter(t => t.profit > 0)
    );

    if (successfulTrades.length < this.MIN_SAMPLE_SIZE) return null;

    // Calculate average holding time for winners
    const avgDuration = successfulTrades.reduce((sum, t) => sum + t.duration_hours, 0) / successfulTrades.length;
    const winRate = successfulTrades.length / agents.reduce((sum, a) => sum + a.trades, 0);

    return {
      id: `timing_${Date.now()}`,
      name: 'Optimal Holding Duration Pattern',
      description: `Exit trades after ${avgDuration.toFixed(1)} hours on average`,
      triggers: {
        market_conditions: ['ANY'],
        indicator_patterns: ['time_based_exit'],
        regime_requirements: ['ANY']
      },
      expected_performance: {
        win_rate: winRate,
        profit_factor: 1.5,
        sample_size: successfulTrades.length
      },
      discovered_from: agents.map(a => a.name),
      confidence: Math.min(winRate * 1.5, 0.95),
      first_seen: new Date(),
      validation_status: 'TESTING'
    };
  }

  private analyzeIndicatorCombinations(agents: TradingAgent[]): DiscoveredPattern | null {
    // Look for common skill upgrades among top performers
    const commonSkills = new Map<string, number>();

    agents.forEach(agent => {
      Object.entries(agent.skills).forEach(([skill, level]) => {
        if (level >= 7) {  // High-level skills only
          commonSkills.set(skill, (commonSkills.get(skill) || 0) + 1);
        }
      });
    });

    const mostCommonSkill = Array.from(commonSkills.entries())
      .sort((a, b) => b[1] - a[1])[0];

    if (!mostCommonSkill || mostCommonSkill[1] < agents.length * 0.6) return null;

    const avgWinRate = agents.reduce((sum, a) => sum + a.win_rate, 0) / agents.length;

    return {
      id: `skill_${mostCommonSkill[0]}_${Date.now()}`,
      name: `${mostCommonSkill[0]} Mastery Pattern`,
      description: `Focus on ${mostCommonSkill[0]} for better performance`,
      triggers: {
        market_conditions: ['ANY'],
        indicator_patterns: [mostCommonSkill[0]],
        regime_requirements: ['ANY']
      },
      expected_performance: {
        win_rate: avgWinRate,
        profit_factor: agents.reduce((sum, a) => sum + a.profit_factor, 0) / agents.length,
        sample_size: agents.reduce((sum, a) => sum + a.trades, 0)
      },
      discovered_from: agents.map(a => a.name),
      confidence: mostCommonSkill[1] / agents.length,
      first_seen: new Date(),
      validation_status: 'TESTING'
    };
  }

  private analyzeExitStrategies(agents: TradingAgent[]): DiscoveredPattern | null {
    // Analyze exit optimization abilities
    const exitMasters = agents.filter(a => a.skills.exit_optimization >= 7);
    
    if (exitMasters.length < 2) return null;

    const avgProfitFactor = exitMasters.reduce((sum, a) => sum + a.profit_factor, 0) / exitMasters.length;

    return {
      id: `exit_mastery_${Date.now()}`,
      name: 'Exit Optimization Pattern',
      description: 'Advanced exit timing increases profit factor',
      triggers: {
        market_conditions: ['ANY'],
        indicator_patterns: ['advanced_exits', 'trailing_stops'],
        regime_requirements: ['ANY']
      },
      expected_performance: {
        win_rate: exitMasters.reduce((sum, a) => sum + a.win_rate, 0) / exitMasters.length,
        profit_factor: avgProfitFactor,
        sample_size: exitMasters.reduce((sum, a) => sum + a.trades, 0)
      },
      discovered_from: exitMasters.map(a => a.name),
      confidence: 0.8,
      first_seen: new Date(),
      validation_status: 'TESTING'
    };
  }

  /**
   * Evolutionary strategy generation
   */
  evolveStrategies(generation: number): StrategyGene[] {
    if (this.strategyGenePool.length === 0) {
      // Initialize with random strategies
      return this.initializeGenePool();
    }

    // Select top performers
    const parents = this.strategyGenePool
      .sort((a, b) => b.fitness_score - a.fitness_score)
      .slice(0, 10);

    // Create offspring through crossover and mutation
    const offspring: StrategyGene[] = [];

    for (let i = 0; i < 20; i++) {
      const parent1 = parents[Math.floor(Math.random() * parents.length)];
      const parent2 = parents[Math.floor(Math.random() * parents.length)];

      const child = this.crossover(parent1, parent2);
      const mutated = this.mutate(child);
      offspring.push(mutated);
    }

    // Combine parents and offspring for next generation
    this.strategyGenePool = [...parents, ...offspring];

    console.log(`🧬 Market Sage evolved generation ${generation}: ${offspring.length} new strategies`);

    return offspring;
  }

  private initializeGenePool(): StrategyGene[] {
    const initialPool: StrategyGene[] = [];

    const entryTypes = ['BREAKOUT', 'REVERSAL', 'TREND', 'SUPPORT'];
    const exitTypes = ['TIME_BASED', 'PROFIT_TARGET', 'TRAILING_STOP', 'INDICATOR'];

    for (let i = 0; i < 50; i++) {
      initialPool.push({
        entry_logic: entryTypes[Math.floor(Math.random() * entryTypes.length)],
        exit_logic: exitTypes[Math.floor(Math.random() * exitTypes.length)],
        risk_params: {
          stop_loss: 0.02 + Math.random() * 0.03,
          take_profit: 0.04 + Math.random() * 0.06,
          position_size: 0.5 + Math.random() * 0.5
        },
        fitness_score: 0
      });
    }

    this.strategyGenePool = initialPool;
    return initialPool;
  }

  private crossover(parent1: StrategyGene, parent2: StrategyGene): StrategyGene {
    return {
      entry_logic: Math.random() > 0.5 ? parent1.entry_logic : parent2.entry_logic,
      exit_logic: Math.random() > 0.5 ? parent1.exit_logic : parent2.exit_logic,
      risk_params: {
        stop_loss: (parent1.risk_params.stop_loss + parent2.risk_params.stop_loss) / 2,
        take_profit: (parent1.risk_params.take_profit + parent2.risk_params.take_profit) / 2,
        position_size: (parent1.risk_params.position_size + parent2.risk_params.position_size) / 2
      },
      fitness_score: 0
    };
  }

  private mutate(gene: StrategyGene): StrategyGene {
    if (Math.random() < 0.1) {
      // 10% mutation rate
      gene.risk_params.stop_loss *= (0.9 + Math.random() * 0.2);
      gene.risk_params.take_profit *= (0.9 + Math.random() * 0.2);
      gene.risk_params.position_size *= (0.9 + Math.random() * 0.2);
    }
    return gene;
  }

  /**
   * Validate discovered patterns with backtesting
   */
  async validatePattern(patternId: string, backtestResults: any): Promise<void> {
    const pattern = this.discoveredPatterns.get(patternId);
    if (!pattern) return;

    const { win_rate, profit_factor } = backtestResults;

    if (win_rate >= this.MIN_WIN_RATE && profit_factor >= this.MIN_PROFIT_FACTOR) {
      pattern.validation_status = 'VALIDATED';
      console.log(`✅ Pattern "${pattern.name}" validated! WR: ${(win_rate * 100).toFixed(1)}%, PF: ${profit_factor.toFixed(2)}`);
    } else {
      pattern.validation_status = 'REJECTED';
      console.log(`❌ Pattern "${pattern.name}" rejected. WR: ${(win_rate * 100).toFixed(1)}%, PF: ${profit_factor.toFixed(2)}`);
    }

    this.discoveredPatterns.set(patternId, pattern);
  }

  getDiscoveredPatterns(): DiscoveredPattern[] {
    return Array.from(this.discoveredPatterns.values());
  }

  getValidatedPatterns(): DiscoveredPattern[] {
    return Array.from(this.discoveredPatterns.values())
      .filter(p => p.validation_status === 'VALIDATED');
  }
}
