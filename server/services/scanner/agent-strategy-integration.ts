/**
 * Agent Strategy Integration
 * 
 * Wires strategies into specific agents:
 * - TrendRider → Trend-following strategies
 * - MomentumHunter → Momentum strategies
 * - VolatilityTrader → Volatility strategies
 * - VolumeAnalyzer → Volume strategies
 * - PrecisionScalper → Combination/high-precision strategies
 * - SwingTrader → Advanced strategies
 * - MultiStrategy → All strategies
 */

import {
  routeStrategiesForAgent,
  detectMarketCondition,
  recommendAgentForMarket,
  MarketCondition,
  AgentSpecialty,
  STRATEGY_REGISTRY,
  AGENT_STRATEGIES
} from './strategy-router';
import { StrategyInput, StrategySignal } from './strategy-engine';

export interface AgentDecision {
  agent: AgentSpecialty;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reason: string;
  marketCondition: MarketCondition;
  primaryStrategy: string;
  strategySignals: Array<{
    name: string;
    signal: 'BUY' | 'SELL' | 'NEUTRAL';
    confidence: number;
  }>;
  riskAssessment: {
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    reasoning: string;
  };
}

/**
 * TrendRider Agent
 * Specializes in trend-following strategies
 */
export class TrendRiderAgent {
  static analyze(input: StrategyInput): AgentDecision {
    const { signals, marketCondition } = routeStrategiesForAgent('TrendRider', input);

    if (signals.size === 0) {
      return {
        agent: 'TrendRider',
        action: 'HOLD',
        confidence: 0,
        reason: 'No trend signals available',
        marketCondition,
        primaryStrategy: 'none',
        strategySignals: [],
        riskAssessment: {
          level: 'HIGH',
          reasoning: 'Market conditions do not favor trend trading'
        }
      };
    }

    // Get highest confidence signal
    let maxConfidence = 0;
    let primaryStrategy = '';
    let buyCount = 0;
    let sellCount = 0;
    let primarySignal: StrategySignal | null = null;

    for (const [name, sig] of signals.entries()) {
      if (sig.confidence > maxConfidence) {
        maxConfidence = sig.confidence;
        primaryStrategy = name;
        primarySignal = sig;
      }
      if (sig.signal === 'BUY') buyCount++;
      if (sig.signal === 'SELL') sellCount++;
    }

    // Determine action
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (buyCount > sellCount && maxConfidence > 50) {
      action = 'BUY';
    } else if (sellCount > buyCount && maxConfidence > 50) {
      action = 'SELL';
    }

    // Risk assessment
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (marketCondition === MarketCondition.STRONG_UPTREND || marketCondition === MarketCondition.STRONG_DOWNTREND) {
      riskLevel = 'LOW'; // Low risk in strong trends
    } else if (marketCondition === MarketCondition.RANGING) {
      riskLevel = 'HIGH'; // High risk when ranging
    }

    return {
      agent: 'TrendRider',
      action,
      confidence: maxConfidence,
      reason: primarySignal?.reason || 'Multiple trend strategies aligned',
      marketCondition,
      primaryStrategy,
      strategySignals: Array.from(signals.entries()).map(([name, sig]) => ({
        name,
        signal: sig.signal,
        confidence: sig.confidence
      })),
      riskAssessment: {
        level: riskLevel,
        reasoning: `Trend strength (${marketCondition}) ${riskLevel === 'LOW' ? 'favorable' : 'unfavorable'} for trend trading`
      }
    };
  }
}

/**
 * MomentumHunter Agent
 * Specializes in momentum strategies for mean reversion
 */
export class MomentumHunterAgent {
  static analyze(input: StrategyInput): AgentDecision {
    const { signals, marketCondition } = routeStrategiesForAgent('MomentumHunter', input);

    if (signals.size === 0) {
      return {
        agent: 'MomentumHunter',
        action: 'HOLD',
        confidence: 0,
        reason: 'No momentum signals available',
        marketCondition,
        primaryStrategy: 'none',
        strategySignals: [],
        riskAssessment: {
          level: 'HIGH',
          reasoning: 'Market not suitable for momentum trading'
        }
      };
    }

    let maxConfidence = 0;
    let primaryStrategy = '';
    let buyCount = 0;
    let sellCount = 0;
    let primarySignal: StrategySignal | null = null;

    for (const [name, sig] of signals.entries()) {
      if (sig.confidence > maxConfidence) {
        maxConfidence = sig.confidence;
        primaryStrategy = name;
        primarySignal = sig;
      }
      if (sig.signal === 'BUY') buyCount++;
      if (sig.signal === 'SELL') sellCount++;
    }

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (buyCount > sellCount && maxConfidence > 50) {
      action = 'BUY';
    } else if (sellCount > buyCount && maxConfidence > 50) {
      action = 'SELL';
    }

    // Momentum traders prefer ranging markets
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (marketCondition === MarketCondition.RANGING) {
      riskLevel = 'LOW'; // Low risk in ranges
    } else if (marketCondition === MarketCondition.STRONG_UPTREND || marketCondition === MarketCondition.STRONG_DOWNTREND) {
      riskLevel = 'HIGH'; // High risk in strong trends
    }

    return {
      agent: 'MomentumHunter',
      action,
      confidence: maxConfidence,
      reason: primarySignal?.reason || 'Momentum signals detected',
      marketCondition,
      primaryStrategy,
      strategySignals: Array.from(signals.entries()).map(([name, sig]) => ({
        name,
        signal: sig.signal,
        confidence: sig.confidence
      })),
      riskAssessment: {
        level: riskLevel,
        reasoning: `Ranging market (${marketCondition}) ${riskLevel === 'LOW' ? 'ideal' : 'challenging'} for momentum trading`
      }
    };
  }
}

/**
 * VolatilityTrader Agent
 * Specializes in volatility-based strategies
 */
export class VolatilityTraderAgent {
  static analyze(input: StrategyInput): AgentDecision {
    const { signals, marketCondition } = routeStrategiesForAgent('VolatilityTrader', input);

    if (signals.size === 0) {
      return {
        agent: 'VolatilityTrader',
        action: 'HOLD',
        confidence: 0,
        reason: 'No volatility signals',
        marketCondition,
        primaryStrategy: 'none',
        strategySignals: [],
        riskAssessment: {
          level: 'HIGH',
          reasoning: 'Insufficient volatility for volatility trading'
        }
      };
    }

    let maxConfidence = 0;
    let primaryStrategy = '';
    let buyCount = 0;
    let sellCount = 0;
    let primarySignal: StrategySignal | null = null;

    for (const [name, sig] of signals.entries()) {
      if (sig.confidence > maxConfidence) {
        maxConfidence = sig.confidence;
        primaryStrategy = name;
        primarySignal = sig;
      }
      if (sig.signal === 'BUY') buyCount++;
      if (sig.signal === 'SELL') sellCount++;
    }

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (buyCount > sellCount && maxConfidence > 50) {
      action = 'BUY';
    } else if (sellCount > buyCount && maxConfidence > 50) {
      action = 'SELL';
    }

    // Volatility traders prefer volatile markets
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (marketCondition === MarketCondition.VOLATILE) {
      riskLevel = 'LOW'; // Low risk with high volatility
    } else if (marketCondition === MarketCondition.LOW_VOLATILITY) {
      riskLevel = 'HIGH'; // High risk with low volatility
    }

    return {
      agent: 'VolatilityTrader',
      action,
      confidence: maxConfidence,
      reason: primarySignal?.reason || 'Volatility signal detected',
      marketCondition,
      primaryStrategy,
      strategySignals: Array.from(signals.entries()).map(([name, sig]) => ({
        name,
        signal: sig.signal,
        confidence: sig.confidence
      })),
      riskAssessment: {
        level: riskLevel,
        reasoning: `Market volatility (${marketCondition}) ${riskLevel === 'LOW' ? 'favorable' : 'unfavorable'}`
      }
    };
  }
}

/**
 * VolumeAnalyzer Agent
 * Specializes in volume-based strategies
 */
export class VolumeAnalyzerAgent {
  static analyze(input: StrategyInput): AgentDecision {
    const { signals, marketCondition } = routeStrategiesForAgent('VolumeAnalyzer', input);

    if (signals.size === 0) {
      return {
        agent: 'VolumeAnalyzer',
        action: 'HOLD',
        confidence: 0,
        reason: 'No volume signals detected',
        marketCondition,
        primaryStrategy: 'none',
        strategySignals: [],
        riskAssessment: {
          level: 'HIGH',
          reasoning: 'Insufficient volume data'
        }
      };
    }

    let maxConfidence = 0;
    let primaryStrategy = '';
    let buyCount = 0;
    let sellCount = 0;
    let primarySignal: StrategySignal | null = null;

    for (const [name, sig] of signals.entries()) {
      if (sig.confidence > maxConfidence) {
        maxConfidence = sig.confidence;
        primaryStrategy = name;
        primarySignal = sig;
      }
      if (sig.signal === 'BUY') buyCount++;
      if (sig.signal === 'SELL') sellCount++;
    }

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (buyCount > sellCount && maxConfidence > 50) {
      action = 'BUY';
    } else if (sellCount > buyCount && maxConfidence > 50) {
      action = 'SELL';
    }

    // Volume analysis works in any market condition
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (maxConfidence > 70) {
      riskLevel = 'LOW'; // High confidence = low risk
    } else if (maxConfidence < 40) {
      riskLevel = 'HIGH';
    }

    return {
      agent: 'VolumeAnalyzer',
      action,
      confidence: maxConfidence,
      reason: primarySignal?.reason || 'Volume analysis confirmed signal',
      marketCondition,
      primaryStrategy,
      strategySignals: Array.from(signals.entries()).map(([name, sig]) => ({
        name,
        signal: sig.signal,
        confidence: sig.confidence
      })),
      riskAssessment: {
        level: riskLevel,
        reasoning: `Volume confirmation at ${maxConfidence.toFixed(0)}% confidence`
      }
    };
  }
}

/**
 * PrecisionScalper Agent
 * High-precision, high-confidence signals only
 */
export class PrecisionScalperAgent {
  static analyze(input: StrategyInput): AgentDecision {
    const { signals, marketCondition } = routeStrategiesForAgent('PrecisionScalper', input);

    // Filter for high-confidence signals only
    const highConfidence = new Map<string, StrategySignal>();
    for (const [name, sig] of signals.entries()) {
      if (sig.confidence >= 60) {
        highConfidence.set(name, sig);
      }
    }

    if (highConfidence.size === 0) {
      return {
        agent: 'PrecisionScalper',
        action: 'HOLD',
        confidence: 0,
        reason: 'No high-confidence signals (requires >= 60%)',
        marketCondition,
        primaryStrategy: 'none',
        strategySignals: [],
        riskAssessment: {
          level: 'HIGH',
          reasoning: 'Insufficient precision for scalping'
        }
      };
    }

    let maxConfidence = 0;
    let primaryStrategy = '';
    let buyCount = 0;
    let sellCount = 0;
    let primarySignal: StrategySignal | null = null;

    for (const [name, sig] of highConfidence.entries()) {
      if (sig.confidence > maxConfidence) {
        maxConfidence = sig.confidence;
        primaryStrategy = name;
        primarySignal = sig;
      }
      if (sig.signal === 'BUY') buyCount++;
      if (sig.signal === 'SELL') sellCount++;
    }

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (buyCount > sellCount) {
      action = 'BUY';
    } else if (sellCount > buyCount) {
      action = 'SELL';
    }

    // Scalpers want high confidence and stable conditions
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (maxConfidence < 70 || marketCondition === MarketCondition.VOLATILE) {
      riskLevel = 'MEDIUM';
    }

    return {
      agent: 'PrecisionScalper',
      action,
      confidence: maxConfidence,
      reason: `High-precision signal: ${primarySignal?.reason}`,
      marketCondition,
      primaryStrategy,
      strategySignals: Array.from(highConfidence.entries()).map(([name, sig]) => ({
        name,
        signal: sig.signal,
        confidence: sig.confidence
      })),
      riskAssessment: {
        level: riskLevel,
        reasoning: `Scalping signal at ${maxConfidence.toFixed(0)}% precision`
      }
    };
  }
}

/**
 * SwingTrader Agent
 * Advanced multi-strategy approach
 */
export class SwingTraderAgent {
  static analyze(input: StrategyInput): AgentDecision {
    const { signals, marketCondition } = routeStrategiesForAgent('SwingTrader', input);

    if (signals.size === 0) {
      return {
        agent: 'SwingTrader',
        action: 'HOLD',
        confidence: 0,
        reason: 'No swing trade setup available',
        marketCondition,
        primaryStrategy: 'none',
        strategySignals: [],
        riskAssessment: {
          level: 'HIGH',
          reasoning: 'Market conditions unfavorable'
        }
      };
    }

    let maxConfidence = 0;
    let primaryStrategy = '';
    let buyCount = 0;
    let sellCount = 0;
    let primarySignal: StrategySignal | null = null;

    for (const [name, sig] of signals.entries()) {
      if (sig.confidence > maxConfidence) {
        maxConfidence = sig.confidence;
        primaryStrategy = name;
        primarySignal = sig;
      }
      if (sig.signal === 'BUY') buyCount++;
      if (sig.signal === 'SELL') sellCount++;
    }

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (buyCount > sellCount && maxConfidence > 55) {
      action = 'BUY';
    } else if (sellCount > buyCount && maxConfidence > 55) {
      action = 'SELL';
    }

    // Swing traders need strong setup and confirmation
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (maxConfidence > 70 && (buyCount + sellCount) >= 3) {
      riskLevel = 'LOW'; // Multiple confirmations = low risk
    } else if (maxConfidence < 55) {
      riskLevel = 'HIGH';
    }

    return {
      agent: 'SwingTrader',
      action,
      confidence: maxConfidence,
      reason: primarySignal?.reason || 'Swing trade setup confirmed',
      marketCondition,
      primaryStrategy,
      strategySignals: Array.from(signals.entries()).map(([name, sig]) => ({
        name,
        signal: sig.signal,
        confidence: sig.confidence
      })),
      riskAssessment: {
        level: riskLevel,
        reasoning: `${signals.size} indicators confirm, confidence ${maxConfidence.toFixed(0)}%`
      }
    };
  }
}

/**
 * Agent Router - route to appropriate agent
 */
export function routeToAgent(
  symbol: string,
  input: StrategyInput,
  preferredAgent?: AgentSpecialty
): AgentDecision {
  const marketCondition = detectMarketCondition(input);
  const recommendedAgents = recommendAgentForMarket(marketCondition);

  const agent = preferredAgent && recommendedAgents.includes(preferredAgent)
    ? preferredAgent
    : recommendedAgents[0];

  const agentMap: Record<AgentSpecialty, (input: StrategyInput) => AgentDecision> = {
    'TrendRider': TrendRiderAgent.analyze,
    'MomentumHunter': MomentumHunterAgent.analyze,
    'VolatilityTrader': VolatilityTraderAgent.analyze,
    'VolumeAnalyzer': VolumeAnalyzerAgent.analyze,
    'PrecisionScalper': PrecisionScalperAgent.analyze,
    'SwingTrader': SwingTraderAgent.analyze,
    'MultiStrategy': (inp: StrategyInput) => {
      // Run all agent types and find consensus
      const decisions = [
        TrendRiderAgent.analyze(inp),
        MomentumHunterAgent.analyze(inp),
        VolatilityTraderAgent.analyze(inp),
        VolumeAnalyzerAgent.analyze(inp),
        PrecisionScalperAgent.analyze(inp),
        SwingTraderAgent.analyze(inp)
      ];

      // Get consensus
      const buys = decisions.filter(d => d.action === 'BUY').length;
      const sells = decisions.filter(d => d.action === 'SELL').length;

      let consensusAction: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      if (buys > sells) consensusAction = 'BUY';
      if (sells > buys) consensusAction = 'SELL';

      const avgConfidence = decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length;

      return {
        agent: 'MultiStrategy',
        action: consensusAction,
        confidence: avgConfidence,
        reason: `${buys} agents recommend BUY, ${sells} recommend SELL, ${6 - buys - sells} HOLD`,
        marketCondition,
        primaryStrategy: 'consensus',
        strategySignals: [],
        riskAssessment: {
          level: avgConfidence > 70 ? 'LOW' : avgConfidence > 50 ? 'MEDIUM' : 'HIGH',
          reasoning: 'Multi-agent consensus'
        }
      };
    }
  };

  return agentMap[agent](input);
}

/**
 * Get agent recommendation based on market condition
 */
export function recommendAgentForMarketCondition(
  marketCondition: MarketCondition
): AgentSpecialty {
  const recommendations: Record<MarketCondition, AgentSpecialty> = {
    [MarketCondition.STRONG_UPTREND]: 'TrendRider',
    [MarketCondition.UPTREND]: 'TrendRider',
    [MarketCondition.RANGING]: 'MomentumHunter',
    [MarketCondition.DOWNTREND]: 'TrendRider',
    [MarketCondition.STRONG_DOWNTREND]: 'TrendRider',
    [MarketCondition.VOLATILE]: 'VolatilityTrader',
    [MarketCondition.LOW_VOLATILITY]: 'PrecisionScalper'
  };

  return recommendations[marketCondition] || 'MultiStrategy';
}

// Re-exports for convenience
export { detectMarketCondition, recommendAgentForMarket, MarketCondition, AgentSpecialty };
