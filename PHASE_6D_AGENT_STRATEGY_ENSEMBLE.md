# 🎯 PHASE 6D: AGENT & STRATEGY ENSEMBLE

**Date**: December 19, 2025  
**Phase**: 6D - Ensemble Testing  
**Status**: 🚀 STARTING IMPLEMENTATION  
**Objective**: Support ensemble testing for agents and strategies  
**Time Estimate**: 16-20 hours

---

## 📋 PHASE 6D OVERVIEW

Build comprehensive ensemble testing system to combine multiple agents and strategies for superior trading signal generation.

### What is Ensemble Trading?
- **Agent Ensemble**: Combine signals from multiple agents (ML, Scanner, RL, RPG) using voting logic
- **Strategy Ensemble**: Combine signals from multiple strategies (Momentum, Mean Reversion, Breakout, etc.)
- **Voting Methods**: Majority, Weighted Average, Consensus, Unanimous
- **Benefits**: Reduced overfitting, more robust signals, better risk management

---

## 1️⃣ AGENT SELECTOR COMPONENT

### File: `client/src/components/AgentSelector.tsx`

```typescript
// Available agents in system
type AgentType = 'ml' | 'scanner' | 'rl' | 'rpg';

interface Agent {
  id: AgentType;
  name: string;
  description: string;
  successRate: number; // 0-1
  avgReturnPerTrade: number;
  winRate: number;
  enabled: boolean;
}

interface AgentSelectorProps {
  selectedAgents: AgentType[];
  onSelectionChange: (agents: AgentType[]) => void;
  votingMethod: 'majority' | 'weighted' | 'consensus' | 'unanimous';
  onVotingMethodChange: (method: string) => void;
  showStats?: boolean;
}

interface AgentStats {
  id: AgentType;
  successRate: number;
  performanceRank: number;
  lastTradeResult: 'win' | 'loss' | 'neutral';
}
```

### Component Features

#### 1. Available Agents Display
```typescript
// Show all available agents with stats
const agents: Agent[] = [
  {
    id: 'ml',
    name: 'ML Pipeline',
    description: 'Machine Learning model predicting price movements',
    successRate: 0.65,
    avgReturnPerTrade: 0.023,
    winRate: 0.58,
    enabled: true
  },
  {
    id: 'scanner',
    name: 'Pattern Scanner',
    description: 'Technical analysis and pattern recognition',
    successRate: 0.58,
    avgReturnPerTrade: 0.018,
    winRate: 0.52,
    enabled: true
  },
  {
    id: 'rl',
    name: 'RL Agent',
    description: 'Reinforcement learning model trained on market data',
    successRate: 0.62,
    avgReturnPerTrade: 0.021,
    winRate: 0.55,
    enabled: true
  },
  {
    id: 'rpg',
    name: 'RPG Agent',
    description: 'Random policy gradient with adaptive learning',
    successRate: 0.56,
    avgReturnPerTrade: 0.015,
    winRate: 0.50,
    enabled: false // Disabled by default
  }
];

// Display format:
// [✓] ML Pipeline - 65% success rate, +2.3% avg return/trade
//     Machine Learning model predicting price movements
//     Rank: #1 | Last Trade: Win
//
// [✓] Pattern Scanner - 58% success rate, +1.8% avg return/trade
//     Technical analysis and pattern recognition
//     Rank: #3 | Last Trade: Loss
//
// [ ] RL Agent - 62% success rate, +2.1% avg return/trade
//     Reinforcement learning model trained on market data
//     Rank: #2 | Last Trade: Win
//
// [ ] RPG Agent - 56% success rate, +1.5% avg return/trade
//     Random policy gradient with adaptive learning
//     Rank: #4 | Last Trade: Neutral (disabled)
```

#### 2. Selection Controls
```typescript
- Checkbox to select/deselect each agent
- Show selected count (e.g., "2 of 4 agents selected")
- "Select All" button
- "Select Best 2" button (auto-select highest success rate)
- "Recommended Ensemble" button (suggests best combination)
- Clear all with confirmation
```

#### 3. Selected Agents List
```typescript
// Show selected agents with order
Ensemble (2 agents):
  1. ML Pipeline (65% success)
  2. Pattern Scanner (58% success)

Total Success Rate (combined): 61.5%
Average Return/Trade: 2.05%
Consensus Win Rate: 55%
```

#### 4. Voting Method Selection
```typescript
// Radio buttons for voting methods
○ Majority Vote
  └─ Majority of agents must agree
  └─ Most robust for 3+ agents

○ Weighted Average
  └─ Weight by success rate
  └─ ML (65%) gets 40%, Scanner (58%) gets 35%, etc.

○ Consensus
  └─ All agents must agree
  └─ Most conservative, high confidence

○ Unanimous
  └─ All agents same signal
  └─ Only trades on strongest signals
```

#### 5. Visual Hierarchy
```typescript
// Design layout:
┌─────────────────────────────────────────┐
│ Agent Ensemble Selector                  │
├─────────────────────────────────────────┤
│                                          │
│  Available Agents (Select combination):  │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ [✓] ML Pipeline        65% ✓✓✓✓✓ │   │
│  │     Machine learning model        │   │
│  │     Rank: #1 | Win 65% | +2.3%   │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ [✓] Pattern Scanner    58% ✓✓✓✓✓ │   │
│  │     Technical analysis            │   │
│  │     Rank: #3 | Win 52% | +1.8%   │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ [ ] RL Agent           62% ✓✓✓✓✓  │   │
│  │     Reinforcement learning        │   │
│  │     Rank: #2 | Win 55% | +2.1%   │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ [ ] RPG Agent          56% ✓✓✓✓✓  │   │
│  │     Random policy gradient        │   │
│  │     Rank: #4 | Win 50% | +1.5%   │   │
│  └──────────────────────────────────┘   │
│                                          │
│  [Quick Select: Best 2] [Recommended]   │
│  [Select All] [Clear All]               │
│                                          │
│  ─────────────────────────────────────  │
│  Selected Ensemble (2 agents):           │
│  • ML Pipeline (65%) → Weight: 40%      │
│  • Pattern Scanner (58%) → Weight: 35%  │
│  ─────────────────────────────────────  │
│                                          │
│  Combined Metrics:                       │
│  • Success Rate: 61.5%                   │
│  • Avg Return/Trade: 2.05%               │
│  • Win Rate: 58.5%                       │
│                                          │
│  ─────────────────────────────────────  │
│  Voting Method:                          │
│  ◉ Majority Vote  ○ Weighted  ○ Consensus │
│  └─ At least 2 agents must agree        │
│                                          │
│  [✓ Valid Ensemble] [Test Ensemble]     │
└─────────────────────────────────────────┘
```

### Implementation

```typescript
export const AgentSelector: React.FC<AgentSelectorProps> = ({
  selectedAgents,
  onSelectionChange,
  votingMethod,
  onVotingMethodChange,
  showStats = true
}) => {
  const [agents, setAgents] = useState<Agent[]>(AVAILABLE_AGENTS);
  const [recommendations, setRecommendations] = useState<string>('');

  // Get agent stats
  const getAgentStats = (agentId: AgentType): AgentStats => {
    const agent = agents.find(a => a.id === agentId);
    return {
      id: agentId,
      successRate: agent?.successRate || 0,
      performanceRank: agents.sort((a, b) => b.successRate - a.successRate)
        .findIndex(a => a.id === agentId) + 1,
      lastTradeResult: 'win' // From historical data
    };
  };

  // Calculate ensemble metrics
  const calculateEnsembleMetrics = (selected: AgentType[]) => {
    const selectedAgentStats = selected.map(id => agents.find(a => a.id === id)!);
    const avgSuccessRate = selectedAgentStats.reduce((sum, a) => sum + a.successRate, 0) / selected.length;
    const avgReturn = selectedAgentStats.reduce((sum, a) => sum + a.avgReturnPerTrade, 0) / selected.length;
    const avgWinRate = selectedAgentStats.reduce((sum, a) => sum + a.winRate, 0) / selected.length;

    return {
      successRate: avgSuccessRate,
      avgReturn,
      winRate: avgWinRate,
      consensusMetric: Math.min(...selectedAgentStats.map(a => a.successRate))
    };
  };

  // Recommend ensemble
  const getRecommendation = () => {
    // Sort by success rate and recommend top 2-3
    const sorted = agents.sort((a, b) => b.successRate - a.successRate);
    const recommended = sorted.slice(0, 3).map(a => a.id);
    return recommended;
  };

  const handleToggleAgent = (agentId: AgentType) => {
    if (selectedAgents.includes(agentId)) {
      onSelectionChange(selectedAgents.filter(id => id !== agentId));
    } else {
      onSelectionChange([...selectedAgents, agentId]);
    }
  };

  const handleSelectBest = () => {
    const sorted = agents.sort((a, b) => b.successRate - a.successRate);
    onSelectionChange(sorted.slice(0, 2).map(a => a.id));
  };

  const handleRecommended = () => {
    onSelectionChange(getRecommendation());
  };

  return (
    <div className="space-y-4 p-4 bg-gray-900 rounded-lg border border-gray-800">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Zap className="w-5 h-5" />
        Agent Ensemble Selector
      </h3>

      {/* Agent Cards */}
      <div className="space-y-2">
        {agents.map(agent => {
          const isSelected = selectedAgents.includes(agent.id);
          const stats = getAgentStats(agent.id);
          const weights = calculateEnsembleMetrics(selectedAgents);

          return (
            <div
              key={agent.id}
              onClick={() => handleToggleAgent(agent.id)}
              className={`p-3 rounded border cursor-pointer transition ${
                isSelected
                  ? 'bg-blue-900 border-blue-500'
                  : 'bg-gray-800 border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-semibold text-white">{agent.name}</div>
                  <div className="text-sm text-gray-400">{agent.description}</div>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="text-green-400">✓ {(agent.successRate * 100).toFixed(1)}%</span>
                    <span className="text-yellow-400">+{(agent.avgReturnPerTrade * 100).toFixed(2)}%</span>
                    <span className="text-blue-400">#{stats.performanceRank} Rank</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSelectBest}
          className="flex-1 px-3 py-2 bg-green-900 hover:bg-green-800 text-green-100 rounded text-sm"
        >
          Best 2
        </button>
        <button
          onClick={handleRecommended}
          className="flex-1 px-3 py-2 bg-purple-900 hover:bg-purple-800 text-purple-100 rounded text-sm"
        >
          Recommended
        </button>
        <button
          onClick={() => onSelectionChange([])}
          className="flex-1 px-3 py-2 bg-red-900 hover:bg-red-800 text-red-100 rounded text-sm"
        >
          Clear
        </button>
      </div>

      {/* Selected Summary */}
      {selectedAgents.length > 0 && (
        <div className="bg-gray-800 p-3 rounded border border-gray-700">
          <div className="text-sm font-semibold text-white mb-2">
            Ensemble ({selectedAgents.length} agents):
          </div>
          {selectedAgents.map((id, i) => {
            const agent = agents.find(a => a.id === id)!;
            const weights = calculateEnsembleMetrics(selectedAgents);
            return (
              <div key={id} className="text-xs text-gray-300">
                {i + 1}. {agent.name} ({(agent.successRate * 100).toFixed(1)}%)
              </div>
            );
          })}
          <div className="mt-2 pt-2 border-t border-gray-700 text-xs space-y-1">
            <div className="text-green-400">Combined Success: {(calculateEnsembleMetrics(selectedAgents).successRate * 100).toFixed(1)}%</div>
            <div className="text-yellow-400">Avg Return/Trade: {(calculateEnsembleMetrics(selectedAgents).avgReturn * 100).toFixed(2)}%</div>
          </div>
        </div>
      )}

      {/* Voting Method */}
      <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-2">
        <div className="text-sm font-semibold text-white">Voting Method:</div>
        {['majority', 'weighted', 'consensus', 'unanimous'].map(method => (
          <label key={method} className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="radio"
              name="votingMethod"
              value={method}
              checked={votingMethod === method}
              onChange={(e) => onVotingMethodChange(e.target.value)}
              className="w-4 h-4"
            />
            <span className="capitalize">{method} Vote</span>
          </label>
        ))}
      </div>
    </div>
  );
};
```

---

## 2️⃣ STRATEGY SELECTOR COMPONENT

### File: `client/src/components/StrategySelector.tsx`

```typescript
type StrategyType = 'momentum' | 'meanReversion' | 'breakout' | 'scalping' | 'swing';

interface Strategy {
  id: StrategyType;
  name: string;
  description: string;
  type: 'trend' | 'mean-reversion' | 'breakout' | 'scalp';
  avgWinRate: number;
  avgSharpe: number;
  avgReturn: number;
  timeframeOptimal: string;
  enabled: boolean;
}

interface StrategySelectorProps {
  selectedStrategies: StrategyType[];
  onSelectionChange: (strategies: StrategyType[]) => void;
  votingMethod: 'majority' | 'weighted' | 'consensus' | 'unanimous';
  onVotingMethodChange: (method: string) => void;
  positionSizingMethod?: 'equal' | 'performance' | 'volatility';
  onPositionSizingChange?: (method: string) => void;
}
```

### Component Features

#### 1. Available Strategies Display
```typescript
// Show strategies with classification
const strategies: Strategy[] = [
  {
    id: 'momentum',
    name: 'Momentum Strategy',
    description: 'Buy on uptrends, sell on downtrends using moving averages',
    type: 'trend',
    avgWinRate: 0.58,
    avgSharpe: 1.8,
    avgReturn: 0.095,
    timeframeOptimal: '4h, 1d',
    enabled: true
  },
  {
    id: 'meanReversion',
    name: 'Mean Reversion',
    description: 'Buy oversold, sell overbought using Bollinger Bands',
    type: 'mean-reversion',
    avgWinRate: 0.62,
    avgSharpe: 2.1,
    avgReturn: 0.088,
    timeframeOptimal: '1h, 4h',
    enabled: true
  },
  {
    id: 'breakout',
    name: 'Breakout Strategy',
    description: 'Trade breakouts from support/resistance levels',
    type: 'breakout',
    avgWinRate: 0.52,
    avgSharpe: 1.5,
    avgReturn: 0.125,
    timeframeOptimal: '15m, 1h',
    enabled: true
  },
  {
    id: 'scalping',
    name: 'Scalping',
    description: 'Quick trades on small price movements',
    type: 'scalp',
    avgWinRate: 0.55,
    avgSharpe: 0.8,
    avgReturn: 0.015,
    timeframeOptimal: '5m, 15m',
    enabled: false
  },
  {
    id: 'swing',
    name: 'Swing Trading',
    description: 'Hold positions for multiple days',
    type: 'trend',
    avgWinRate: 0.60,
    avgSharpe: 1.6,
    avgReturn: 0.150,
    timeframeOptimal: '1d, 1w',
    enabled: true
  }
];

// Display format similar to AgentSelector
```

#### 2. Strategy Grouping
```typescript
// Group by type
Trend Following:
  ✓ Momentum Strategy (Win: 58%, Sharpe: 1.8)
  ✓ Swing Trading (Win: 60%, Sharpe: 1.6)

Mean Reversion:
  ✓ Mean Reversion (Win: 62%, Sharpe: 2.1)

Breakout:
  ✓ Breakout Strategy (Win: 52%, Sharpe: 1.5)
```

#### 3. Position Sizing for Ensemble
```typescript
// When multiple strategies selected:
Position Sizing Method:
  ◉ Equal Weight
    └─ Each strategy gets equal capital
    
  ○ Performance Weight
    └─ Allocate more to better performing
    
  ○ Volatility Weight
    └─ Allocate less to volatile strategies

// Example with Mean Reversion + Momentum
Equal Weight: 50% + 50%
Performance Weight: 55% (Mean Reversion) + 45% (Momentum)
Volatility Weight: 48% + 52%
```

#### 4. Time Frame Compatibility Check
```typescript
// Warn if strategies have conflicting timeframes
⚠️ Warning: Selected strategies optimized for different timeframes
  • Momentum: 4h, 1d
  • Scalping: 5m, 15m
  → Consider using different assets or adjusting parameters

Recommended: Use same timeframe across strategies for consistency
```

---

## 3️⃣ AGENT ENSEMBLE VOTING LOGIC

### File: `client/src/services/agentVotingService.ts`

```typescript
type VotingMethod = 'majority' | 'weighted' | 'consensus' | 'unanimous';

interface AgentSignal {
  agentId: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-1
  price: number;
  timestamp: number;
  reasoning?: string;
}

interface VotingResult {
  finalSignal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  votingDetails: {
    method: VotingMethod;
    agentVotes: AgentSignal[];
    voteCounts: { BUY: number; SELL: number; HOLD: number };
    consensus: boolean;
  };
}

// Voting implementations
export const agentVoting = {
  // Majority: Most votes win
  majority: (signals: AgentSignal[]): VotingResult => {
    const voteCounts = { BUY: 0, SELL: 0, HOLD: 0 };
    let totalConfidence = { BUY: 0, SELL: 0, HOLD: 0 };

    signals.forEach(signal => {
      voteCounts[signal.signal]++;
      totalConfidence[signal.signal] += signal.confidence;
    });

    const maxVotes = Math.max(voteCounts.BUY, voteCounts.SELL, voteCounts.HOLD);
    const winners = Object.entries(voteCounts)
      .filter(([_, count]) => count === maxVotes)
      .map(([signal]) => signal);

    // If tie, use confidence as tiebreaker
    let finalSignal: 'BUY' | 'SELL' | 'HOLD';
    if (winners.length > 1) {
      finalSignal = Object.entries(totalConfidence)
        .filter(([signal]) => winners.includes(signal))
        .sort(([, conf1], [, conf2]) => conf2 - conf1)[0][0] as any;
    } else {
      finalSignal = winners[0] as any;
    }

    return {
      finalSignal,
      confidence: totalConfidence[finalSignal] / signals.length,
      votingDetails: {
        method: 'majority',
        agentVotes: signals,
        voteCounts: voteCounts as any,
        consensus: winners.length === 1
      }
    };
  },

  // Weighted: Weight by agent success rate
  weighted: (signals: AgentSignal[], weights: Record<string, number>): VotingResult => {
    let weightedBUY = 0, weightedSELL = 0, weightedHOLD = 0;
    let totalWeight = 0;

    signals.forEach(signal => {
      const weight = weights[signal.agentId] || 0.25;
      const confidence = signal.confidence * weight;

      if (signal.signal === 'BUY') weightedBUY += confidence;
      else if (signal.signal === 'SELL') weightedSELL += confidence;
      else weightedHOLD += confidence;

      totalWeight += weight;
    });

    const normalizedBUY = weightedBUY / totalWeight;
    const normalizedSELL = weightedSELL / totalWeight;
    const normalizedHOLD = weightedHOLD / totalWeight;

    const maxWeight = Math.max(normalizedBUY, normalizedSELL, normalizedHOLD);
    const finalSignal =
      normalizedBUY === maxWeight ? 'BUY' :
      normalizedSELL === maxWeight ? 'SELL' : 'HOLD';

    return {
      finalSignal,
      confidence: maxWeight,
      votingDetails: {
        method: 'weighted',
        agentVotes: signals,
        voteCounts: {
          BUY: Math.round(normalizedBUY * signals.length),
          SELL: Math.round(normalizedSELL * signals.length),
          HOLD: Math.round(normalizedHOLD * signals.length)
        },
        consensus: normalizedBUY > 0.7 || normalizedSELL > 0.7 || normalizedHOLD > 0.7
      }
    };
  },

  // Consensus: All agents must agree
  consensus: (signals: AgentSignal[]): VotingResult => {
    const allBUY = signals.every(s => s.signal === 'BUY');
    const allSELL = signals.every(s => s.signal === 'SELL');
    const allHOLD = signals.every(s => s.signal === 'HOLD');

    const finalSignal = allBUY ? 'BUY' : allSELL ? 'SELL' : allHOLD ? 'HOLD' : 'HOLD';
    const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;

    return {
      finalSignal: allBUY || allSELL || allHOLD ? finalSignal : 'HOLD',
      confidence: (allBUY || allSELL || allHOLD) ? avgConfidence : 0,
      votingDetails: {
        method: 'consensus',
        agentVotes: signals,
        voteCounts: {
          BUY: signals.filter(s => s.signal === 'BUY').length,
          SELL: signals.filter(s => s.signal === 'SELL').length,
          HOLD: signals.filter(s => s.signal === 'HOLD').length
        },
        consensus: allBUY || allSELL || allHOLD
      }
    };
  },

  // Unanimous: All same signal (highest threshold)
  unanimous: (signals: AgentSignal[]): VotingResult => {
    const allSignals = signals.map(s => s.signal);
    const uniqueSignals = new Set(allSignals);

    if (uniqueSignals.size === 1) {
      const finalSignal = allSignals[0] as 'BUY' | 'SELL' | 'HOLD';
      const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;

      return {
        finalSignal,
        confidence: avgConfidence * 1.2, // Boost confidence for unanimous agreement
        votingDetails: {
          method: 'unanimous',
          agentVotes: signals,
          voteCounts: {
            BUY: signals.filter(s => s.signal === 'BUY').length,
            SELL: signals.filter(s => s.signal === 'SELL').length,
            HOLD: signals.filter(s => s.signal === 'HOLD').length
          },
          consensus: true
        }
      };
    } else {
      return {
        finalSignal: 'HOLD',
        confidence: 0,
        votingDetails: {
          method: 'unanimous',
          agentVotes: signals,
          voteCounts: {
            BUY: signals.filter(s => s.signal === 'BUY').length,
            SELL: signals.filter(s => s.signal === 'SELL').length,
            HOLD: signals.filter(s => s.signal === 'HOLD').length
          },
          consensus: false
        }
      };
    }
  }
};

// Helper function
export const runAgentVoting = (
  signals: AgentSignal[],
  method: VotingMethod,
  weights?: Record<string, number>
): VotingResult => {
  if (signals.length === 0) {
    throw new Error('No signals provided for voting');
  }

  if (method === 'majority') {
    return agentVoting.majority(signals);
  } else if (method === 'weighted') {
    if (!weights) {
      throw new Error('Weights required for weighted voting');
    }
    return agentVoting.weighted(signals, weights);
  } else if (method === 'consensus') {
    return agentVoting.consensus(signals);
  } else if (method === 'unanimous') {
    return agentVoting.unanimous(signals);
  } else {
    throw new Error(`Unknown voting method: ${method}`);
  }
};
```

---

## 4️⃣ STRATEGY ENSEMBLE VOTING LOGIC

### File: `client/src/services/strategyVotingService.ts`

```typescript
interface StrategySignal {
  strategyId: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-1
  expectedReturn: number; // Expected % return
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  reasoning?: string;
  timestamp: number;
}

interface StrategyVotingResult {
  finalSignal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  expectedReturn: number;
  positionSizeAllocation: Record<string, number>; // { strategyId: allocation % }
  details: {
    votingDetails: VotingResult;
    strategyVotes: StrategySignal[];
    riskAnalysis: {
      maxRisk: 'LOW' | 'MEDIUM' | 'HIGH';
      riskDistribution: Record<string, number>;
      overallRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    };
  };
}

// Position sizing for ensemble
export const strategyPositionSizing = {
  // Equal: Same allocation to all
  equal: (strategies: StrategySignal[], votingResult: VotingResult): Record<string, number> => {
    const allocation: Record<string, number> = {};
    const equalWeight = 1 / strategies.length;
    strategies.forEach(s => {
      allocation[s.strategyId] = equalWeight;
    });
    return allocation;
  },

  // Performance: Allocate more to better performing
  performance: (strategies: StrategySignal[], votingResult: VotingResult): Record<string, number> => {
    const allocation: Record<string, number> = {};
    const totalConfidence = strategies.reduce((sum, s) => sum + s.confidence, 0);

    strategies.forEach(s => {
      allocation[s.strategyId] = s.confidence / totalConfidence;
    });

    return allocation;
  },

  // Volatility: Allocate less to volatile/risky strategies
  volatility: (strategies: StrategySignal[], votingResult: VotingResult): Record<string, number> => {
    const allocation: Record<string, number> = {};
    
    // Risk scoring: HIGH = 3, MEDIUM = 2, LOW = 1
    const riskScores = strategies.map(s => {
      const score = s.riskLevel === 'HIGH' ? 3 : s.riskLevel === 'MEDIUM' ? 2 : 1;
      return 1 / score; // Inverse: lower risk = higher weight
    });

    const totalRiskScore = riskScores.reduce((a, b) => a + b, 0);

    strategies.forEach((s, i) => {
      allocation[s.strategyId] = riskScores[i] / totalRiskScore;
    });

    return allocation;
  }
};

// Voting for strategies (same methods as agents)
export const strategyVoting = {
  majority: (signals: StrategySignal[]): VotingResult => {
    // Same implementation as agent voting
  },
  weighted: (signals: StrategySignal[], weights: Record<string, number>): VotingResult => {
    // Same implementation as agent voting
  },
  consensus: (signals: StrategySignal[]): VotingResult => {
    // Same implementation as agent voting
  },
  unanimous: (signals: StrategySignal[]): VotingResult => {
    // Same implementation as agent voting
  }
};

// Calculate expected return from multiple strategies
export const calculateEnsembleExpectedReturn = (
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

// Calculate overall risk
export const calculateEnsembleRisk = (signals: StrategySignal[]): 'LOW' | 'MEDIUM' | 'HIGH' => {
  const riskScores = {
    'LOW': 1,
    'MEDIUM': 2,
    'HIGH': 3
  };

  const avgRisk = signals.reduce((sum, s) => sum + riskScores[s.riskLevel], 0) / signals.length;

  if (avgRisk <= 1.5) return 'LOW';
  if (avgRisk <= 2.5) return 'MEDIUM';
  return 'HIGH';
};

// Main voting function
export const runStrategyVoting = (
  signals: StrategySignal[],
  votingMethod: VotingMethod,
  positionSizingMethod: 'equal' | 'performance' | 'volatility' = 'equal',
  weights?: Record<string, number>
): StrategyVotingResult => {
  // Run voting
  const votingResult = strategyVoting[votingMethod](signals, weights);

  // Calculate position sizing
  const positionSizing = strategyPositionSizing[positionSizingMethod](signals, votingResult);

  // Calculate metrics
  const expectedReturn = calculateEnsembleExpectedReturn(signals, positionSizing);
  const overallRisk = calculateEnsembleRisk(signals);

  return {
    finalSignal: votingResult.finalSignal,
    confidence: votingResult.confidence,
    expectedReturn,
    positionSizeAllocation: positionSizing,
    details: {
      votingDetails: votingResult,
      strategyVotes: signals,
      riskAnalysis: {
        maxRisk: signals.reduce((max, s) => 
          s.riskLevel === 'HIGH' ? 'HIGH' : max === 'MEDIUM' ? 'MEDIUM' : max, 'LOW' as any),
        riskDistribution: {
          LOW: signals.filter(s => s.riskLevel === 'LOW').length,
          MEDIUM: signals.filter(s => s.riskLevel === 'MEDIUM').length,
          HIGH: signals.filter(s => s.riskLevel === 'HIGH').length
        },
        overallRisk
      }
    }
  };
};
```

---

## 5️⃣ PARAMETER TUNING UI

### File: `client/src/components/ParameterTuningPanel.tsx`

```typescript
interface TuningConfig {
  method: 'grid' | 'random' | 'bayesian';
  parameters: {
    name: string;
    type: 'number' | 'select';
    min?: number;
    max?: number;
    step?: number;
    values?: string[];
    current: number | string;
  }[];
  iterations?: number;
  populationSize?: number;
  trainingPeriod: { start: string; end: string };
  testingPeriod: { start: string; end: string };
}

interface TuningResult {
  parameters: Record<string, number | string>;
  metrics: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
  };
  rank: number;
  testedAt: number;
}
```

### Features

#### 1. Tuning Method Selection
```typescript
Method Selection:
  ◉ Grid Search
    └─ Test all combinations (exhaustive, slower)
    └─ Best for: Small parameter spaces
    └─ Iterations needed: Product of all ranges
    
  ○ Random Search
    └─ Random samples (faster, good enough)
    └─ Best for: Medium parameter spaces
    └─ Iterations: 100-1000
    
  ○ Bayesian Optimization
    └─ Smart sampling (fastest, efficient)
    └─ Best for: Large parameter spaces, many parameters
    └─ Iterations: 50-500
```

#### 2. Parameter Ranges
```typescript
// Examples for different strategies
Momentum Strategy:
  • Fast MA Period: [5, 10, 20, 30, 40]
  • Slow MA Period: [50, 100, 150, 200]
  • Take Profit %: [1%, 2%, 3%, 5%, 10%]
  • Stop Loss %: [0.5%, 1%, 2%, 3%]

Mean Reversion:
  • BB Period: [10, 14, 20, 30]
  • BB Std Dev: [1, 1.5, 2, 2.5, 3]
  • Overbought Threshold: [1.8, 1.9, 2.0, 2.1, 2.2]
  • Oversold Threshold: [-2.2, -2.1, -2.0, -1.9, -1.8]
```

#### 3. Progress Display
```typescript
Tuning Progress:
  [████████░░░░░░░░░░] 40% (40/100)
  
  Current Testing: Grid Search
  Iteration: 40 of 100
  Time Elapsed: 2m 15s
  Estimated Time Remaining: 3m 22s
  
  Best Result So Far:
    Return: 25.3%
    Sharpe: 1.8
    Max DD: -12.5%
    Win Rate: 58%
    Parameters:
      • Fast MA: 10
      • Slow MA: 50
      • TP: 5%
      • SL: 2%
  
  Pause | Cancel
```

#### 4. Results Visualization
```typescript
// Heatmap of parameter combinations and their returns
Grid Search Results Matrix:

             Fast MA: 5   10   20   30   40
Slow MA: 50    12%   15%  14%  13%  10%
         100   18%   22%  20%  19%  15%
         150   20%  [25%] 23%  21%  17%
         200   19%   24%  22%  20%  16%

Best: Fast MA=10, Slow MA=150 (25% return)

// Line chart of top parameters
Top 10 Parameter Sets (by Return):
  1. MA(10,150) - 25.3% ⭐
  2. MA(10,100) - 24.1%
  3. MA(10,200) - 23.8%
  4. MA(10,50)  - 22.4%
  5. MA(20,150) - 21.9%
  ...
```

#### 5. Best Parameters Export
```typescript
// Save best parameters as preset
Save Best Parameters as Preset:
  Name: "Momentum-Tuned-v1"
  Parameters:
    • Fast MA: 10
    • Slow MA: 150
    • Take Profit: 5%
    • Stop Loss: 2%
  Metrics:
    • Return: 25.3%
    • Sharpe: 1.8
    • Win Rate: 58%
    • Trades: 127
  
  [Save Preset] [Apply Now] [Compare]
```

### Implementation

```typescript
export const ParameterTuningPanel: React.FC<ParameterTuningPanelProps> = ({
  strategy,
  onTuningComplete,
}) => {
  const [tuningMethod, setTuningMethod] = useState<'grid' | 'random' | 'bayesian'>('grid');
  const [parameters, setParameters] = useState<TuningConfig['parameters']>([]);
  const [iterations, setIterations] = useState(100);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<TuningResult[]>([]);
  const [bestResult, setBestResult] = useState<TuningResult | null>(null);

  const runTuning = async () => {
    setIsRunning(true);
    setResults([]);
    setProgress(0);

    try {
      const response = await fetch('/api/backtest/tune-parameters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy,
          tuningMethod,
          parameters,
          iterations,
          trainingPeriod: tuningConfig.trainingPeriod,
          testingPeriod: tuningConfig.testingPeriod
        })
      });

      if (!response.ok) throw new Error('Tuning failed');

      // Stream progress
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        const lines = text.split('\n');

        lines.forEach(line => {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            setProgress(data.progress);
            if (data.result) {
              setResults(prev => [...prev, data.result]);
              if (!bestResult || data.result.metrics.totalReturn > bestResult.metrics.totalReturn) {
                setBestResult(data.result);
              }
            }
          }
        });
      }
    } finally {
      setIsRunning(false);
      onTuningComplete(bestResult);
    }
  };

  return (
    <div className="space-y-4 p-4 bg-gray-900 rounded-lg border border-gray-800">
      <h3 className="text-lg font-semibold text-white">Parameter Tuning</h3>

      {/* Method Selection */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-white">Tuning Method:</label>
        {(['grid', 'random', 'bayesian'] as const).map(method => (
          <label key={method} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              value={method}
              checked={tuningMethod === method}
              onChange={(e) => setTuningMethod(e.target.value as any)}
              disabled={isRunning}
            />
            <span className="capitalize">{method} Search</span>
          </label>
        ))}
      </div>

      {/* Parameter Ranges */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-white">Parameter Ranges:</label>
        {parameters.map((param, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-xs text-gray-400 w-20">{param.name}</span>
            {param.type === 'number' ? (
              <>
                <input
                  type="number"
                  value={param.min}
                  onChange={(e) => {
                    const updated = [...parameters];
                    updated[i].min = Number(e.target.value);
                    setParameters(updated);
                  }}
                  className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs"
                  placeholder="Min"
                  disabled={isRunning}
                />
                <input
                  type="number"
                  value={param.max}
                  onChange={(e) => {
                    const updated = [...parameters];
                    updated[i].max = Number(e.target.value);
                    setParameters(updated);
                  }}
                  className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs"
                  placeholder="Max"
                  disabled={isRunning}
                />
                <input
                  type="number"
                  value={param.step}
                  onChange={(e) => {
                    const updated = [...parameters];
                    updated[i].step = Number(e.target.value);
                    setParameters(updated);
                  }}
                  className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs"
                  placeholder="Step"
                  disabled={isRunning}
                />
              </>
            ) : (
              <select className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs" disabled={isRunning}>
                {param.values?.map(v => <option key={v}>{v}</option>)}
              </select>
            )}
          </div>
        ))}
      </div>

      {/* Iterations */}
      <div>
        <label className="text-sm font-semibold text-white">Iterations: {iterations}</label>
        <input
          type="range"
          min="10"
          max="1000"
          value={iterations}
          onChange={(e) => setIterations(Number(e.target.value))}
          className="w-full"
          disabled={isRunning}
        />
      </div>

      {/* Run Button */}
      <button
        onClick={runTuning}
        disabled={isRunning}
        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded"
      >
        {isRunning ? `Running (${progress}%)...` : 'Start Tuning'}
      </button>

      {/* Progress */}
      {isRunning && (
        <div className="space-y-2">
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${progress}%` }} />
          </div>
          {bestResult && (
            <div className="text-xs text-gray-300">
              Best: {(bestResult.metrics.totalReturn * 100).toFixed(2)}% return
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-gray-800 p-3 rounded border border-gray-700">
          <div className="text-sm font-semibold text-white mb-2">
            Top 5 Results:
          </div>
          {results.slice(0, 5).map((result, i) => (
            <div key={i} className="text-xs text-gray-300">
              {i + 1}. Return: {(result.metrics.totalReturn * 100).toFixed(2)}% | Sharpe: {result.metrics.sharpeRatio.toFixed(2)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## 📊 PHASE 6D COMPONENTS SUMMARY

| Component | Lines | Features |
|-----------|-------|----------|
| AgentSelector.tsx | 500+ | Agent selection, stats, ensemble metrics |
| StrategySelector.tsx | 450+ | Strategy selection, grouping, position sizing |
| agentVotingService.ts | 400+ | Majority, weighted, consensus, unanimous voting |
| strategyVotingService.ts | 450+ | Strategy voting, position sizing, risk analysis |
| ParameterTuningPanel.tsx | 400+ | Grid/random/bayesian search, progress tracking |
| backtest.tsx (additions) | 200+ | Component integration, ensemble workflow |
| **Total** | **2400+** | **Complete ensemble system** |

---

## 🚀 INTEGRATION WORKFLOW

### In backtest.tsx

```tsx
// New state
const [selectedAgents, setSelectedAgents] = useState<AgentType[]>(['ml', 'scanner']);
const [agentVotingMethod, setAgentVotingMethod] = useState('majority');
const [selectedStrategies, setSelectedStrategies] = useState<StrategyType[]>(['momentum']);
const [strategyVotingMethod, setStrategyVotingMethod] = useState('majority');
const [strategyPositionSizing, setStrategyPositionSizing] = useState('equal');
const [showEnsembleConfig, setShowEnsembleConfig] = useState(false);
const [ensembleResults, setEnsembleResults] = useState<BacktestResult[]>([]);

// Backtest with ensemble
const handleRunEnsembleBacktest = async () => {
  const response = await fetch('/api/backtest/ensemble/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agents: selectedAgents,
      agentVotingMethod,
      strategies: selectedStrategies,
      strategyVotingMethod,
      strategyPositionSizing,
      assets: selectedSymbols,
      startDate,
      endDate,
      initialCapital,
      advancedParams
    })
  });

  const results = await response.json();
  setEnsembleResults(results);
};

// In JSX
<Tabs defaultValue="single">
  <TabsTrigger value="single">Single Strategy</TabsTrigger>
  <TabsTrigger value="ensemble">Ensemble Testing</TabsTrigger>
</Tabs>

{activeTab === 'ensemble' && (
  <div className="space-y-4">
    <AgentSelector
      selectedAgents={selectedAgents}
      onSelectionChange={setSelectedAgents}
      votingMethod={agentVotingMethod}
      onVotingMethodChange={setAgentVotingMethod}
    />

    <StrategySelector
      selectedStrategies={selectedStrategies}
      onSelectionChange={setSelectedStrategies}
      votingMethod={strategyVotingMethod}
      onVotingMethodChange={setStrategyVotingMethod}
      positionSizingMethod={strategyPositionSizing}
      onPositionSizingChange={setStrategyPositionSizing}
    />

    <ParameterTuningPanel
      strategy={selectedStrategies[0]}
      onTuningComplete={(bestParams) => {
        // Apply best params
      }}
    />

    <button onClick={handleRunEnsembleBacktest}>
      Run Ensemble Backtest
    </button>

    {ensembleResults.map(result => (
      <EnsembleResultCard key={result.id} result={result} />
    ))}
  </div>
)}
```

---

## ✅ PHASE 6D SUCCESS CRITERIA

- [ ] AgentSelector component fully functional
- [ ] Select 1-4 agents with stats display
- [ ] Voting method selection (4 types)
- [ ] StrategySelector component functional
- [ ] Select 1-5 strategies with classifications
- [ ] Position sizing methods working (3 types)
- [ ] Agent ensemble voting implemented
- [ ] Strategy ensemble voting implemented
- [ ] Majority voting works correctly
- [ ] Weighted voting works with weights
- [ ] Consensus voting implemented
- [ ] Unanimous voting implemented
- [ ] Parameter tuning UI functional
- [ ] Grid search working
- [ ] Random search working
- [ ] Bayesian optimization working
- [ ] Progress tracking displayed
- [ ] Results visualization working
- [ ] Best parameters exportable
- [ ] Full integration in backtest.tsx
- [ ] Can test agent combinations
- [ ] Can test strategy combinations
- [ ] Voting logic correct
- [ ] No console errors

---

## 📁 FILES TO CREATE

1. **`client/src/components/AgentSelector.tsx`** (500+ lines)
2. **`client/src/components/StrategySelector.tsx`** (450+ lines)
3. **`client/src/services/agentVotingService.ts`** (400+ lines)
4. **`client/src/services/strategyVotingService.ts`** (450+ lines)
5. **`client/src/components/ParameterTuningPanel.tsx`** (400+ lines)
6. **Modify `client/src/pages/backtest.tsx`** (200+ lines)

---

## 🎯 ESTIMATED TIMELINE

| Task | Estimated Time |
|------|-----------------|
| AgentSelector Component | 1.5 hours |
| StrategySelector Component | 1.5 hours |
| Agent Voting Logic | 1.5 hours |
| Strategy Voting Logic | 1.5 hours |
| Parameter Tuning Panel | 1.5 hours |
| Integration & Testing | 2 hours |
| **TOTAL** | **~10 hours** |

---

## 🚀 READY TO START PHASE 6D

All prerequisites met:
- ✅ Phase 5 complete
- ✅ Phase 6A complete (multi-asset)
- ✅ Phase 6B complete (visualization)
- ✅ Phase 6C complete (comparison & export)

**Next**: Begin Phase 6D.1 - Build AgentSelector component

---

**Status**: 🚀 READY TO IMPLEMENT  
**Start Date**: December 19, 2025  
**Estimated Completion**: December 20-21, 2025  

