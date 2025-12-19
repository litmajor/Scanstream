/**
 * Agent Ensemble Voting Service
 * Implements multiple voting methods for combining agent signals
 */

type VotingMethod = 'majority' | 'weighted' | 'consensus' | 'unanimous';
type SignalType = 'BUY' | 'SELL' | 'HOLD';

export interface AgentSignal {
  agentId: string;
  signal: SignalType;
  confidence: number; // 0-1
  price: number;
  timestamp: number;
  reasoning?: string;
}

export interface VotingResult {
  finalSignal: SignalType;
  confidence: number;
  votingDetails: {
    method: VotingMethod;
    agentVotes: AgentSignal[];
    voteCounts: { BUY: number; SELL: number; HOLD: number };
    consensus: boolean;
    votes?: { signal: SignalType; agents: string[]; count: number }[];
  };
}

/**
 * Majority Voting
 * The signal with the most votes wins
 * Ties broken by confidence score
 */
export const majorityVoting = (signals: AgentSignal[]): VotingResult => {
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

  const votes: { BUY: string[]; SELL: string[]; HOLD: string[] } = {
    BUY: [],
    SELL: [],
    HOLD: []
  };

  signals.forEach(signal => {
    voteCounts[signal.signal]++;
    totalConfidence[signal.signal] += signal.confidence;
    votes[signal.signal].push(signal.agentId);
  });

  // Find maximum vote count
  const maxVotes = Math.max(voteCounts.BUY, voteCounts.SELL, voteCounts.HOLD);

  // Find all signals with max votes
  const winners: SignalType[] = [];
  if (voteCounts.BUY === maxVotes) winners.push('BUY');
  if (voteCounts.SELL === maxVotes) winners.push('SELL');
  if (voteCounts.HOLD === maxVotes) winners.push('HOLD');

  // If tie, use confidence as tiebreaker
  let finalSignal: SignalType;
  if (winners.length > 1) {
    finalSignal = winners.reduce((winner, signal) => {
      return totalConfidence[signal] > totalConfidence[winner] ? signal : winner;
    });
  } else {
    finalSignal = winners[0];
  }

  const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;
  const consensusThreshold = signals.length >= 3 ? 0.66 : 0.5; // 2/3 majority for 3+ agents
  const isConsensus = voteCounts[finalSignal] / signals.length >= consensusThreshold;

  return {
    finalSignal,
    confidence: (totalConfidence[finalSignal] / signals.length) * (voteCounts[finalSignal] / signals.length),
    votingDetails: {
      method: 'majority',
      agentVotes: signals,
      voteCounts,
      consensus: isConsensus,
      votes: [
        { signal: 'BUY', agents: votes.BUY, count: voteCounts.BUY },
        { signal: 'SELL', agents: votes.SELL, count: voteCounts.SELL },
        { signal: 'HOLD', agents: votes.HOLD, count: voteCounts.HOLD }
      ]
    }
  };
};

/**
 * Weighted Voting
 * Each agent's vote is weighted by their success rate
 */
export const weightedVoting = (
  signals: AgentSignal[],
  weights: Record<string, number>
): VotingResult => {
  if (signals.length === 0) {
    throw new Error('No signals provided for voting');
  }

  if (Object.keys(weights).length === 0) {
    throw new Error('Weights required for weighted voting');
  }

  let weightedBUY = 0;
  let weightedSELL = 0;
  let weightedHOLD = 0;
  let totalWeight = 0;

  const votes: { BUY: string[]; SELL: string[]; HOLD: string[] } = {
    BUY: [],
    SELL: [],
    HOLD: []
  };

  signals.forEach(signal => {
    const weight = weights[signal.agentId] || 1 / signals.length; // Default to equal if not provided
    const weightedConfidence = signal.confidence * weight;

    if (signal.signal === 'BUY') {
      weightedBUY += weightedConfidence;
      votes.BUY.push(signal.agentId);
    } else if (signal.signal === 'SELL') {
      weightedSELL += weightedConfidence;
      votes.SELL.push(signal.agentId);
    } else {
      weightedHOLD += weightedConfidence;
      votes.HOLD.push(signal.agentId);
    }

    totalWeight += weight;
  });

  // Normalize
  const normalizedBUY = weightedBUY / totalWeight;
  const normalizedSELL = weightedSELL / totalWeight;
  const normalizedHOLD = weightedHOLD / totalWeight;

  // Find maximum
  const maxWeight = Math.max(normalizedBUY, normalizedSELL, normalizedHOLD);

  let finalSignal: SignalType;
  if (maxWeight === normalizedBUY) {
    finalSignal = 'BUY';
  } else if (maxWeight === normalizedSELL) {
    finalSignal = 'SELL';
  } else {
    finalSignal = 'HOLD';
  }

  // Consensus if one signal has > 70% weighted confidence
  const isConsensus = maxWeight > 0.7;

  return {
    finalSignal,
    confidence: maxWeight,
    votingDetails: {
      method: 'weighted',
      agentVotes: signals,
      voteCounts: {
        BUY: votes.BUY.length,
        SELL: votes.SELL.length,
        HOLD: votes.HOLD.length
      },
      consensus: isConsensus,
      votes: [
        { signal: 'BUY', agents: votes.BUY, count: votes.BUY.length },
        { signal: 'SELL', agents: votes.SELL, count: votes.SELL.length },
        { signal: 'HOLD', agents: votes.HOLD, count: votes.HOLD.length }
      ]
    }
  };
};

/**
 * Consensus Voting
 * All agents must agree on the signal
 * Very conservative, only trades on strong agreement
 */
export const consensusVoting = (signals: AgentSignal[]): VotingResult => {
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
      agentVotes: signals,
      voteCounts: {
        BUY: signals.filter(s => s.signal === 'BUY').length,
        SELL: signals.filter(s => s.signal === 'SELL').length,
        HOLD: signals.filter(s => s.signal === 'HOLD').length
      },
      consensus: consensusAchieved,
      votes: [
        {
          signal: firstSignal,
          agents: signals.map(s => s.agentId),
          count: signals.length
        }
      ]
    }
  };
};

/**
 * Unanimous Voting
 * Strongest voting method - only trade when 100% confident ALL agents agree
 * Generates 20% confidence boost when unanimous
 */
export const unanimousVoting = (signals: AgentSignal[]): VotingResult => {
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
  const confidenceBoost = unanimousAchieved ? avgConfidence * 1.2 : 0; // 20% boost for unanimous

  return {
    finalSignal,
    confidence: Math.min(confidenceBoost, 1.0), // Cap at 1.0
    votingDetails: {
      method: 'unanimous',
      agentVotes: signals,
      voteCounts: {
        BUY: signals.filter(s => s.signal === 'BUY').length,
        SELL: signals.filter(s => s.signal === 'SELL').length,
        HOLD: signals.filter(s => s.signal === 'HOLD').length
      },
      consensus: unanimousAchieved,
      votes: [
        {
          signal: finalSignal,
          agents: signals.map(s => s.agentId),
          count: signals.length
        }
      ]
    }
  };
};

/**
 * Main voting function dispatcher
 */
export const runAgentVoting = (
  signals: AgentSignal[],
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
 * Helper: Calculate weights based on agent success rates
 */
export const calculateWeights = (
  signals: AgentSignal[],
  successRates: Record<string, number>
): Record<string, number> => {
  const weights: Record<string, number> = {};
  const totalSuccess = signals.reduce((sum, s) => sum + (successRates[s.agentId] || 0), 0);

  if (totalSuccess === 0) {
    // Equal weights if no success rates provided
    const equal = 1 / signals.length;
    signals.forEach(s => {
      weights[s.agentId] = equal;
    });
  } else {
    signals.forEach(s => {
      weights[s.agentId] = (successRates[s.agentId] || 0) / totalSuccess;
    });
  }

  return weights;
};

/**
 * Helper: Get voting summary
 */
export const getVotingSummary = (result: VotingResult): string => {
  const { finalSignal, confidence, votingDetails } = result;
  const { method, voteCounts, consensus } = votingDetails;

  const buy = voteCounts.BUY;
  const sell = voteCounts.SELL;
  const hold = voteCounts.HOLD;
  const total = buy + sell + hold;

  let summary = `Signal: ${finalSignal} | Confidence: ${(confidence * 100).toFixed(1)}% | Method: ${method}`;

  if (method === 'majority') {
    summary += ` | Votes: ${buy} BUY, ${sell} SELL, ${hold} HOLD | Consensus: ${consensus ? 'Yes' : 'No'}`;
  } else if (method === 'weighted') {
    summary += ` | Votes: ${buy} BUY, ${sell} SELL, ${hold} HOLD | Consensus: ${consensus ? 'Yes' : 'No'}`;
  } else if (method === 'consensus') {
    summary += ` | All Agree: ${consensus ? 'Yes' : 'No'}`;
  } else if (method === 'unanimous') {
    summary += ` | Unanimous: ${consensus ? 'Yes' : 'No'}`;
  }

  return summary;
};

/**
 * Helper: Check if voting result is tradeable
 */
export const isTradeable = (result: VotingResult, minimumConfidence: number = 0.5): boolean => {
  return result.finalSignal !== 'HOLD' && result.confidence >= minimumConfidence;
};

/**
 * Helper: Get confidence level description
 */
export const getConfidenceLevel = (confidence: number): string => {
  if (confidence >= 0.9) return 'Very High';
  if (confidence >= 0.7) return 'High';
  if (confidence >= 0.5) return 'Medium';
  if (confidence >= 0.3) return 'Low';
  return 'Very Low';
};
