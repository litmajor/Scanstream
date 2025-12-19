import React, { useState, useMemo } from 'react';
import { Zap, Check, X, TrendingUp, Award, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';

type AgentType = 'ml' | 'scanner' | 'rl' | 'rpg';
type VotingMethod = 'majority' | 'weighted' | 'consensus' | 'unanimous';

interface Agent {
  id: AgentType;
  name: string;
  description: string;
  successRate: number;
  avgReturnPerTrade: number;
  winRate: number;
  enabled: boolean;
  lastTradeResult?: 'win' | 'loss' | 'neutral';
}

interface AgentSelectorProps {
  selectedAgents: AgentType[];
  onSelectionChange: (agents: AgentType[]) => void;
  votingMethod: VotingMethod;
  onVotingMethodChange: (method: VotingMethod) => void;
  showStats?: boolean;
}

const AVAILABLE_AGENTS: Agent[] = [
  {
    id: 'ml',
    name: 'ML Pipeline',
    description: 'Machine Learning model predicting price movements',
    successRate: 0.65,
    avgReturnPerTrade: 0.023,
    winRate: 0.58,
    enabled: true,
    lastTradeResult: 'win'
  },
  {
    id: 'scanner',
    name: 'Pattern Scanner',
    description: 'Technical analysis and pattern recognition',
    successRate: 0.58,
    avgReturnPerTrade: 0.018,
    winRate: 0.52,
    enabled: true,
    lastTradeResult: 'loss'
  },
  {
    id: 'rl',
    name: 'RL Agent',
    description: 'Reinforcement learning model trained on market data',
    successRate: 0.62,
    avgReturnPerTrade: 0.021,
    winRate: 0.55,
    enabled: true,
    lastTradeResult: 'win'
  },
  {
    id: 'rpg',
    name: 'RPG Agent',
    description: 'Random policy gradient with adaptive learning',
    successRate: 0.56,
    avgReturnPerTrade: 0.015,
    winRate: 0.50,
    enabled: false,
    lastTradeResult: 'neutral'
  }
];

export const AgentSelector: React.FC<AgentSelectorProps> = ({
  selectedAgents,
  onSelectionChange,
  votingMethod,
  onVotingMethodChange,
  showStats = true
}) => {
  const [expandedAgent, setExpandedAgent] = useState<AgentType | null>(null);
  const [agents] = useState<Agent[]>(AVAILABLE_AGENTS);

  // Get agent stats and ranking
  const getAgentStats = (agentId: AgentType) => {
    const agent = agents.find(a => a.id === agentId)!;
    const ranking = agents
      .sort((a, b) => b.successRate - a.successRate)
      .findIndex(a => a.id === agentId) + 1;
    return { agent, ranking };
  };

  // Calculate ensemble metrics
  const ensembleMetrics = useMemo(() => {
    if (selectedAgents.length === 0) {
      return {
        avgSuccessRate: 0,
        avgReturn: 0,
        avgWinRate: 0,
        combinedConfidence: 0
      };
    }

    const selectedAgentList = selectedAgents.map(id => agents.find(a => a.id === id)!);
    const avgSuccessRate = selectedAgentList.reduce((sum, a) => sum + a.successRate, 0) / selectedAgents.length;
    const avgReturn = selectedAgentList.reduce((sum, a) => sum + a.avgReturnPerTrade, 0) / selectedAgents.length;
    const avgWinRate = selectedAgentList.reduce((sum, a) => sum + a.winRate, 0) / selectedAgents.length;
    const minSuccessRate = Math.min(...selectedAgentList.map(a => a.successRate));

    return {
      avgSuccessRate,
      avgReturn,
      avgWinRate,
      combinedConfidence: minSuccessRate // For consensus
    };
  }, [selectedAgents, agents]);

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
    const sorted = agents.sort((a, b) => b.successRate - a.successRate);
    onSelectionChange(sorted.slice(0, 3).map(a => a.id));
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  // Get weights for weighted voting
  const getWeights = () => {
    if (selectedAgents.length === 0) return {};
    
    const selectedAgentList = selectedAgents.map(id => agents.find(a => a.id === id)!);
    const totalSuccess = selectedAgentList.reduce((sum, a) => sum + a.successRate, 0);
    
    const weights: Record<string, number> = {};
    selectedAgentList.forEach(agent => {
      weights[agent.id] = agent.successRate / totalSuccess;
    });
    
    return weights;
  };

  const weights = getWeights();

  return (
    <div className="space-y-4 p-4 bg-gray-900 rounded-lg border border-gray-800">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-yellow-500" />
        <h3 className="text-lg font-semibold text-white">Agent Ensemble Selector</h3>
        {selectedAgents.length > 0 && (
          <span className="ml-auto text-sm text-gray-400">
            {selectedAgents.length} of {agents.length} selected
          </span>
        )}
      </div>

      {/* Available Agents */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-300">Available Agents:</label>
        
        {agents.map(agent => {
          const isSelected = selectedAgents.includes(agent.id);
          const { ranking } = getAgentStats(agent.id);
          const weight = weights[agent.id];
          const isExpanded = expandedAgent === agent.id;

          return (
            <div
              key={agent.id}
              className={`rounded border cursor-pointer transition ${
                isSelected
                  ? 'bg-blue-900 border-blue-500'
                  : 'bg-gray-800 border-gray-700 hover:border-gray-600'
              }`}
            >
              {/* Main Card */}
              <div
                onClick={() => handleToggleAgent(agent.id)}
                className="p-3 flex items-start gap-3"
              >
                {/* Checkbox */}
                <div className="flex-shrink-0 mt-1">
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      isSelected
                        ? 'bg-blue-500 border-blue-400'
                        : 'border-gray-600'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-white">{agent.name}</div>
                      <div className="text-xs text-gray-400 mt-1">{agent.description}</div>
                    </div>
                    
                    {/* Expand Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedAgent(isExpanded ? null : agent.id);
                      }}
                      className="text-gray-400 hover:text-gray-300 ml-2"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Stats Row */}
                  <div className="flex gap-4 mt-2 flex-wrap">
                    <div className="flex items-center gap-1 text-xs">
                      <TrendingUp className="w-3 h-3 text-green-400" />
                      <span className="text-green-400">{(agent.successRate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <BarChart3 className="w-3 h-3 text-yellow-400" />
                      <span className="text-yellow-400">+{(agent.avgReturnPerTrade * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <Award className="w-3 h-3 text-blue-400" />
                      <span className="text-blue-400">#{ranking}</span>
                    </div>
                    {agent.enabled ? (
                      <div className="text-xs text-green-400">● Active</div>
                    ) : (
                      <div className="text-xs text-red-400">● Disabled</div>
                    )}
                  </div>

                  {/* Selected Indicator */}
                  {isSelected && weight && (
                    <div className="mt-2 pt-2 border-t border-blue-700">
                      <div className="text-xs text-blue-300">
                        Weight (Weighted Voting): {(weight * 100).toFixed(1)}%
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-gray-700 p-3 bg-gray-850 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-gray-400">Win Rate</div>
                      <div className="text-green-400 font-semibold">{(agent.winRate * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Rank</div>
                      <div className="text-blue-400 font-semibold">#{ranking}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Avg Return/Trade</div>
                    <div className="text-yellow-400 font-semibold">
                      {(agent.avgReturnPerTrade * 100).toFixed(3)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Last Trade</div>
                    <div className={`font-semibold capitalize ${
                      agent.lastTradeResult === 'win' ? 'text-green-400' :
                      agent.lastTradeResult === 'loss' ? 'text-red-400' :
                      'text-gray-400'
                    }`}>
                      {agent.lastTradeResult || 'N/A'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2 pt-2">
        <button
          onClick={handleSelectBest}
          className="px-3 py-2 bg-green-900 hover:bg-green-800 text-green-100 rounded text-sm font-medium transition"
          title="Select best 2 agents by success rate"
        >
          Best 2
        </button>
        <button
          onClick={handleRecommended}
          className="px-3 py-2 bg-purple-900 hover:bg-purple-800 text-purple-100 rounded text-sm font-medium transition"
          title="Select recommended 3 agents"
        >
          Recommended
        </button>
        <button
          onClick={handleClearAll}
          disabled={selectedAgents.length === 0}
          className="px-3 py-2 bg-red-900 hover:bg-red-800 disabled:bg-gray-700 text-red-100 rounded text-sm font-medium transition"
        >
          Clear
        </button>
      </div>

      {/* Selected Ensemble Summary */}
      {selectedAgents.length > 0 && showStats && (
        <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-3">
          <div className="text-sm font-semibold text-white border-b border-gray-700 pb-2">
            Ensemble ({selectedAgents.length} agents)
          </div>

          {/* Selected Agents List */}
          <div className="space-y-1">
            {selectedAgents.map((id, i) => {
              const agent = agents.find(a => a.id === id)!;
              const weight = weights[id];
              return (
                <div key={id} className="text-xs text-gray-300 flex justify-between">
                  <span>{i + 1}. {agent.name} ({(agent.successRate * 100).toFixed(1)}%)</span>
                  {weight && (
                    <span className="text-gray-500">
                      Weight: {(weight * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Combined Metrics */}
          <div className="bg-gray-900 p-2 rounded border border-gray-800 space-y-1">
            <div className="text-xs">
              <div className="text-gray-400">Combined Success Rate:</div>
              <div className="text-green-400 font-semibold">
                {(ensembleMetrics.avgSuccessRate * 100).toFixed(1)}%
              </div>
            </div>
            <div className="text-xs">
              <div className="text-gray-400">Avg Return/Trade:</div>
              <div className="text-yellow-400 font-semibold">
                +{(ensembleMetrics.avgReturn * 100).toFixed(3)}%
              </div>
            </div>
            <div className="text-xs">
              <div className="text-gray-400">Consensus Confidence:</div>
              <div className="text-blue-400 font-semibold">
                {(ensembleMetrics.combinedConfidence * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voting Method Selection */}
      <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-2">
        <div className="text-sm font-semibold text-white">Voting Method:</div>
        
        {[
          {
            id: 'majority',
            label: 'Majority Vote',
            description: 'Most agents must agree'
          },
          {
            id: 'weighted',
            label: 'Weighted Average',
            description: 'Weight by success rate'
          },
          {
            id: 'consensus',
            label: 'Consensus',
            description: 'All agents must agree'
          },
          {
            id: 'unanimous',
            label: 'Unanimous',
            description: 'Only on perfect alignment'
          }
        ].map(method => (
          <label
            key={method.id}
            className="flex items-start gap-2 text-sm text-gray-300 cursor-pointer p-2 rounded hover:bg-gray-700 transition"
          >
            <input
              type="radio"
              name="votingMethod"
              value={method.id}
              checked={votingMethod === method.id}
              onChange={(e) => onVotingMethodChange(e.target.value as VotingMethod)}
              className="w-4 h-4 mt-0.5"
            />
            <div className="flex-1">
              <div className="font-medium">{method.label}</div>
              <div className="text-xs text-gray-500">{method.description}</div>
            </div>
          </label>
        ))}
      </div>

      {/* Validation */}
      {selectedAgents.length > 0 && (
        <div className="bg-green-900 border border-green-700 p-2 rounded text-xs text-green-200 flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>Valid ensemble configured. Ready to backtest.</span>
        </div>
      )}

      {selectedAgents.length === 0 && (
        <div className="bg-yellow-900 border border-yellow-700 p-2 rounded text-xs text-yellow-200 flex items-center gap-2">
          <X className="w-4 h-4" />
          <span>Select at least 1 agent to create ensemble</span>
        </div>
      )}
    </div>
  );
};

export default AgentSelector;
