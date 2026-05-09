/**
 * Strategy Ensemble Voting Service
 * Implements voting and position sizing for multiple strategies
 */

import type { VotingResult } from './agentVotingService';

type VotingMethod = 'majority' | 'weighted' | 'consensus' | 'unanimous';
type SignalType = 'BUY' | 'SELL' | 'HOLD';
type PositionSizingMethod = 'equal' | 'performance' | 'volatility';
type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface StrategySignal {
  strategyId: string;
  signal: SignalType;
  confidence: number; // 0-1
  expectedReturn: number; // Expected % return
  riskLevel: RiskLevel;
  reasoning?: string;
  timestamp: number;
}

export interface StrategyVotingResult {
  finalSignal: SignalType;
  confidence: number;
  expectedReturn: number;
  positionSizeAllocation: Record<string, number>; // { strategyId: allocation % }
  details: {
    votingDetails: VotingResult;
    strategyVotes: StrategySignal[];
    riskAnalysis: {
      maxRisk: RiskLevel;
      riskDistribution: Record<RiskLevel, number>;
      overallRisk: RiskLevel;
    };
  };
}

/**
 * Position Sizing Methods
 */

/**
 * Equal Position Sizing
 * All strategies get equal capital allocation
 */
export const equalPositionSizing = (signals: StrategySignal[]): Record<string, number> => {
  const allocation: Record<string, number> = {};
  const equalWeight = 1 / signals.length;

  signals.forEach(s => {
    allocation[s.strategyId] = equalWeight;
  });

  return allocation;
};

/**
 * Performance-Based Position Sizing
 * Allocate more capital to strategies with higher Sharpe ratio (confidence)
 * Useful when strategies have proven different risk-adjusted returns
 */
export const performancePositionSizing = (signals: StrategySignal[]): Record<string, number> => {
  const allocation: Record<string, number> = {};
  const totalConfidence = signals.reduce((sum, s) => sum + s.confidence, 0);

  if (totalConfidence === 0) {
    return equalPositionSizing(signals);
  }

  signals.forEach(s => {
    allocation[s.strategyId] = s.confidence / totalConfidence;
  });

  return allocation;
};

/**
 * Volatility-Adjusted Position Sizing
 * Allocate less capital to riskier strategies
 * Risk scores: LOW=1, MEDIUM=2, HIGH=3
 * Allocation = 1/risk (inverted relationship)
 */
export const volatilityPositionSizing = (signals: StrategySignal[]): Record<string, number> => {
  const allocation: Record<string, number> = {};

  const riskScores: Record<RiskLevel, number> = {
    'LOW': 1,
    'MEDIUM': 2,
    'HIGH': 3
  };

  // Calculate inverse risk weights
  const riskWeights = signals.map(s => 1 / riskScores[s.riskLevel]);
  const totalRiskWeight = riskWeights.reduce((a, b) => a + b, 0);

  signals.forEach((s, i) => {
    allocation[s.strategyId] = riskWeights[i] / totalRiskWeight;
  });

  return allocation;
};

/**
 * Get position sizing based on method
 */
export const getPositionSizing = (
  signals: StrategySignal[],
  method: PositionSizingMethod
): Record<string, number> => {
  switch (method) {
    case 'equal':
      return equalPositionSizing(signals);
    case 'performance':
      return performancePositionSizing(signals);
    case 'volatility':
      return volatilityPositionSizing(signals);
    default:
      return equalPositionSizing(signals);
  }
};

/**
 * Calculate expected return from multiple strategies
 */
export const calculateExpectedReturn = (
  signals: StrategySignal[],
  positionSizing: Record<string, number>
): number => {
  let totalReturn = 0;

  signals.forEach(signal => {
    const allocation = positionSizing[signal.strategyId] || 0;
    totalReturn += signal.expectedReturn * allocation;
  });

  return totalReturn;
};

/**
 * Calculate overall portfolio risk
 */
export const calculateOverallRisk = (signals: StrategySignal[]): RiskLevel => {
  const riskScores: Record<RiskLevel, number> = {
    'LOW': 1,
    'MEDIUM': 2,
    'HIGH': 3
  };

  const avgRisk = signals.reduce((sum, s) => sum + riskScores[s.riskLevel], 0) / signals.length;

  if (avgRisk <= 1.5) return 'LOW';
  if (avgRisk <= 2.5) return 'MEDIUM';
  return 'HIGH';
};

/**
 * Analyze risk distribution
 */
export const analyzeRiskDistribution = (
  signals: StrategySignal[]
): Record<RiskLevel, number> => {
  return {
    'LOW': signals.filter(s => s.riskLevel === 'LOW').length,
    'MEDIUM': signals.filter(s => s.riskLevel === 'MEDIUM').length,
    'HIGH': signals.filter(s => s.riskLevel === 'HIGH').length
  };
};

/**
 * Voting implementations using agent voting logic
 */

const majorityVoting = (signals: StrategySignal[]): VotingResult => {
  if (signals.length === 0) {
    throw new Error('No signals provided for voting');
  }

  const voteCounts: { BUY: number; SELL: number; HOLD: number } = {
    BUY: 0,
    SELL: 0,
    HOLD: 0
  };

  const totalConfidence: { BUY: number; SELL: number; HOLD: number } = {
    BUY: 0,
    SELL: 0,
    HOLD: 0
  };

  signals.forEach(signal => {
    voteCounts[signal.signal]++;
    totalConfidence[signal.signal] += signal.confidence;
  });

  const maxVotes = Math.max(voteCounts.BUY, voteCounts.SELL, voteCounts.HOLD);
  const winners: SignalType[] = [];

  if (voteCounts.BUY === maxVotes) winners.push('BUY');
  if (voteCounts.SELL === maxVotes) winners.push('SELL');
  if (voteCounts.HOLD === maxVotes) winners.push('HOLD');

  let finalSignal: SignalType;
  if (winners.length > 1) {
    finalSignal = winners.reduce((winner, signal) => {
      return totalConfidence[signal] > totalConfidence[winner] ? signal : winner;
    });
  } else {
    finalSignal = winners[0];
  }

  const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;
  const consensusThreshold = signals.length >= 3 ? 0.66 : 0.5;
  const isConsensus = voteCounts[finalSignal] / signals.length >= consensusThreshold;

  return {
    finalSignal,
    confidence: (totalConfidence[finalSignal] / signals.length) * (voteCounts[finalSignal] / signals.length),
    votingDetails: {
      method: 'majority',
      agentVotes: signals as any,
      voteCounts,
      consensus: isConsensus
    }
  };
};

const weightedVoting = (
  signals: StrategySignal[],
  weights: Record<string, number>
): VotingResult => {
  if (signals.length === 0) {
    throw new Error('No signals provided for voting');
  }

  let weightedBUY = 0;
  let weightedSELL = 0;
  let weightedHOLD = 0;
  let totalWeight = 0;

  signals.forEach(signal => {
    const weight = weights[signal.strategyId] || 1 / signals.length;
    const weightedConfidence = signal.confidence * weight;

    if (signal.signal === 'BUY') weightedBUY += weightedConfidence;
    else if (signal.signal === 'SELL') weightedSELL += weightedConfidence;
    else weightedHOLD += weightedConfidence;

    totalWeight += weight;
  });

  const normalizedBUY = weightedBUY / totalWeight;
  const normalizedSELL = weightedSELL / totalWeight;
  const normalizedHOLD = weightedHOLD / totalWeight;

  const maxWeight = Math.max(normalizedBUY, normalizedSELL, normalizedHOLD);

  let finalSignal: SignalType;
  if (maxWeight === normalizedBUY) finalSignal = 'BUY';
  else if (maxWeight === normalizedSELL) finalSignal = 'SELL';
  else finalSignal = 'HOLD';

  const isConsensus = maxWeight > 0.7;

  return {
    finalSignal,
    confidence: maxWeight,
    votingDetails: {
      method: 'weighted',
      agentVotes: signals as any,
      voteCounts: {
        BUY: signals.filter(s => s.signal === 'BUY').length,
        SELL: signals.filter(s => s.signal === 'SELL').length,
        HOLD: signals.filter(s => s.signal === 'HOLD').length
      },
      consensus: isConsensus
    }
  };
};

const consensusVoting = (signals: StrategySignal[]): VotingResult => {
  if (signals.length === 0) {
    throw new Error('No signals provided for voting');
  }

  const firstSignal = signals[0].signal;
  const allAgree = signals.every(s => s.signal === firstSignal);

  let finalSignal: SignalType = 'HOLD';
  let consensusAchieved = false;

  if (allAgree) {
    finalSignal = firstSignal;
    consensusAchieved = true;
  }

  const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;

  return {
    finalSignal,
    confidence: consensusAchieved ? avgConfidence : 0,
    votingDetails: {
      method: 'consensus',
      agentVotes: signals as any,
      voteCounts: {
        BUY: signals.filter(s => s.signal === 'BUY').length,
        SELL: signals.filter(s => s.signal === 'SELL').length,
        HOLD: signals.filter(s => s.signal === 'HOLD').length
      },
      consensus: consensusAchieved
    }
  };
};

const unanimousVoting = (signals: StrategySignal[]): VotingResult => {
  if (signals.length === 0) {
    throw new Error('No signals provided for voting');
  }

  const uniqueSignals = new Set(signals.map(s => s.signal));

  let finalSignal: SignalType = 'HOLD';
  let unanimousAchieved = false;

  if (uniqueSignals.size === 1) {
    finalSignal = signals[0].signal;
    unanimousAchieved = true;
  }

  const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;
  const confidenceBoost = unanimousAchieved ? avgConfidence * 1.2 : 0;

  return {
    finalSignal,
    confidence: Math.min(confidenceBoost, 1.0),
    votingDetails: {
      method: 'unanimous',
      agentVotes: signals as any,
      voteCounts: {
        BUY: signals.filter(s => s.signal === 'BUY').length,
        SELL: signals.filter(s => s.signal === 'SELL').length,
        HOLD: signals.filter(s => s.signal === 'HOLD').length
      },
      consensus: unanimousAchieved
    }
  };
};

/**
 * Main strategy voting dispatcher
 */
const runStrategyVoting = (
  signals: StrategySignal[],
  method: VotingMethod,
  weights?: Record<string, number>
): VotingResult => {
  if (signals.length === 0) {
    throw new Error('No signals provided for voting');
  }

  switch (method) {
    case 'majority':
      return majorityVoting(signals);
    case 'weighted':
      if (!weights) {
        throw new Error('Weights required for weighted voting');
      }
      return weightedVoting(signals, weights);
    case 'consensus':
      return consensusVoting(signals);
    case 'unanimous':
      return unanimousVoting(signals);
    default:
      throw new Error(`Unknown voting method: ${method}`);
  }
};

/**
 * Main function to run strategy ensemble voting
 */
export const runStrategyEnsemble = (
  signals: StrategySignal[],
  votingMethod: VotingMethod,
  positionSizingMethod: PositionSizingMethod = 'equal',
  weights?: Record<string, number>
): StrategyVotingResult => {
  if (signals.length === 0) {
    throw new Error('No strategy signals provided');
  }

  // Run voting
  const votingResult = runStrategyVoting(signals, votingMethod, weights);

  // Calculate position sizing
  const positionSizing = getPositionSizing(signals, positionSizingMethod);

  // Calculate expected return
  const expectedReturn = calculateExpectedReturn(signals, positionSizing);

  // Analyze risk
  const maxRisk = signals
    .map(s => s.riskLevel)
    .reduce((max, current) => {
      const levels: Record<RiskLevel, number> = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3 };
      return levels[current] > levels[max] ? current : max;
    });

  const overallRisk = calculateOverallRisk(signals);
  const riskDistribution = analyzeRiskDistribution(signals);

  return {
    finalSignal: votingResult.finalSignal,
    confidence: votingResult.confidence,
    expectedReturn,
    positionSizeAllocation: positionSizing,
    details: {
      votingDetails: votingResult,
      strategyVotes: signals,
      riskAnalysis: {
        maxRisk,
        riskDistribution,
        overallRisk
      }
    }
  };
};

/**
 * Helper: Calculate weights based on strategy performance
 */
export const calculateStrategyWeights = (
  signals: StrategySignal[],
  performanceScores?: Record<string, number>
): Record<string, number> => {
  const weights: Record<string, number> = {};

  if (!performanceScores) {
    // Use confidence as weight
    const totalConfidence = signals.reduce((sum, s) => sum + s.confidence, 0);
    signals.forEach(s => {
      weights[s.strategyId] = s.confidence / totalConfidence;
    });
  } else {
    const totalScore = signals.reduce((sum, s) => sum + (performanceScores[s.strategyId] || 0), 0);
    signals.forEach(s => {
      weights[s.strategyId] = (performanceScores[s.strategyId] || 0) / totalScore;
    });
  }

  return weights;
};

/**
 * Helper: Get voting summary
 */
export const getStrategyVotingSummary = (result: StrategyVotingResult): string => {
  const { finalSignal, confidence, expectedReturn, details } = result;
  const { votingDetails, riskAnalysis } = details;

  return `Signal: ${finalSignal} | Confidence: ${(confidence * 100).toFixed(1)}% | ` +
    `Expected Return: ${(expectedReturn * 100).toFixed(2)}% | ` +
    `Risk: ${riskAnalysis.overallRisk}`;
};

/**
 * Helper: Get position sizing summary
 */
export const getPositionSizingSummary = (
  positionSizes: Record<string, number>
): string => {
  return Object.entries(positionSizes)
    .map(([id, size]) => `${id}: ${(size * 100).toFixed(1)}%`)
    .join(' | ');
};
