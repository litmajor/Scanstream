import React, { useState, useMemo } from 'react';
import { TrendingUp, Award, TrendingDown, ChevronDown, ChevronUp, Check, X } from 'lucide-react';

type StrategyType = 'momentum' | 'meanReversion' | 'breakout' | 'scalping' | 'swing';
type VotingMethod = 'majority' | 'weighted' | 'consensus' | 'unanimous';
type PositionSizingMethod = 'equal' | 'performance' | 'volatility';

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
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface StrategySelectorProps {
  selectedStrategies: StrategyType[];
  onSelectionChange: (strategies: StrategyType[]) => void;
  votingMethod: VotingMethod;
  onVotingMethodChange: (method: VotingMethod) => void;
  positionSizingMethod?: PositionSizingMethod;
  onPositionSizingChange?: (method: PositionSizingMethod) => void;
  showStats?: boolean;
}

const AVAILABLE_STRATEGIES: Strategy[] = [
  {
    id: 'momentum',
    name: 'Momentum Strategy',
    description: 'Buy on uptrends, sell on downtrends using moving averages',
    type: 'trend',
    avgWinRate: 0.58,
    avgSharpe: 1.8,
    avgReturn: 0.095,
    timeframeOptimal: '4h, 1d',
    enabled: true,
    riskLevel: 'MEDIUM'
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
    enabled: true,
    riskLevel: 'MEDIUM'
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
    enabled: true,
    riskLevel: 'HIGH'
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
    enabled: false,
    riskLevel: 'HIGH'
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
    enabled: true,
    riskLevel: 'LOW'
  }
];

const STRATEGY_COLORS: Record<Strategy['type'], string> = {
  'trend': 'bg-blue-900 border-blue-700',
  'mean-reversion': 'bg-purple-900 border-purple-700',
  'breakout': 'bg-orange-900 border-orange-700',
  'scalp': 'bg-red-900 border-red-700'
};

const STRATEGY_LABELS: Record<Strategy['type'], string> = {
  'trend': 'Trend Following',
  'mean-reversion': 'Mean Reversion',
  'breakout': 'Breakout',
  'scalp': 'Scalping'
};

export const StrategySelector: React.FC<StrategySelectorProps> = ({
  selectedStrategies,
  onSelectionChange,
  votingMethod,
  onVotingMethodChange,
  positionSizingMethod = 'equal',
  onPositionSizingChange,
  showStats = true
}) => {
  const [expandedStrategy, setExpandedStrategy] = useState<StrategyType | null>(null);
  const [strategies] = useState<Strategy[]>(AVAILABLE_STRATEGIES);

  // Group strategies by type
  const strategiesByType = useMemo(() => {
    const grouped: Record<Strategy['type'], Strategy[]> = {
      'trend': [],
      'mean-reversion': [],
      'breakout': [],
      'scalp': []
    };

    strategies.forEach(s => {
      grouped[s.type].push(s);
    });

    return grouped;
  }, [strategies]);

  // Get strategy stats and ranking
  const getStrategyStats = (strategyId: StrategyType) => {
    const strategy = strategies.find(s => s.id === strategyId)!;
    const ranking = strategies
      .sort((a, b) => b.avgSharpe - a.avgSharpe)
      .findIndex(s => s.id === strategyId) + 1;
    return { strategy, ranking };
  };

  // Calculate ensemble metrics
  const ensembleMetrics = useMemo(() => {
    if (selectedStrategies.length === 0) {
      return {
        avgWinRate: 0,
        avgSharpe: 0,
        avgReturn: 0,
        avgRiskLevel: 'MEDIUM' as const,
        allocation: {}
      };
    }

    const selectedStrategyList = selectedStrategies
      .map(id => strategies.find(s => s.id === id)!)
      .sort((a, b) => b.avgSharpe - a.avgSharpe);

    const avgWinRate = selectedStrategyList.reduce((sum, s) => sum + s.avgWinRate, 0) / selectedStrategies.length;
    const avgSharpe = selectedStrategyList.reduce((sum, s) => sum + s.avgSharpe, 0) / selectedStrategies.length;
    const avgReturn = selectedStrategyList.reduce((sum, s) => sum + s.avgReturn, 0) / selectedStrategies.length;

    // Position allocation
    const allocation: Record<StrategyType, number> = {} as any;
    if (positionSizingMethod === 'equal') {
      const equal = 1 / selectedStrategies.length;
      selectedStrategies.forEach(id => {
        allocation[id] = equal;
      });
    } else if (positionSizingMethod === 'performance') {
      const totalSharpe = selectedStrategyList.reduce((sum, s) => sum + s.avgSharpe, 0);
      selectedStrategyList.forEach(s => {
        allocation[s.id] = s.avgSharpe / totalSharpe;
      });
    } else if (positionSizingMethod === 'volatility') {
      const riskWeights: Record<string, number> = {
        'LOW': 1,
        'MEDIUM': 0.7,
        'HIGH': 0.4
      };
      const totalRiskScore = selectedStrategyList.reduce((sum, s) => sum + (riskWeights[s.riskLevel] || 1), 0);
      selectedStrategyList.forEach(s => {
        allocation[s.id] = (riskWeights[s.riskLevel] || 1) / totalRiskScore;
      });
    }

    // Determine avg risk level
    const riskScores = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3 };
    const avgRiskScore = selectedStrategyList.reduce((sum, s) => sum + riskScores[s.riskLevel], 0) / selectedStrategies.length;
    const avgRiskLevel = avgRiskScore <= 1.5 ? 'LOW' : avgRiskScore <= 2.5 ? 'MEDIUM' : 'HIGH';

    return {
      avgWinRate,
      avgSharpe,
      avgReturn,
      avgRiskLevel,
      allocation
    };
  }, [selectedStrategies, strategies, positionSizingMethod]);

  const handleToggleStrategy = (strategyId: StrategyType) => {
    if (selectedStrategies.includes(strategyId)) {
      onSelectionChange(selectedStrategies.filter(id => id !== strategyId));
    } else {
      onSelectionChange([...selectedStrategies, strategyId]);
    }
  };

  const handleSelectBest = () => {
    const sorted = strategies.sort((a, b) => b.avgSharpe - a.avgSharpe);
    onSelectionChange(sorted.slice(0, 2).map(s => s.id) as StrategyType[]);
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  // Check timeframe compatibility
  const timeframeWarning = useMemo(() => {
    if (selectedStrategies.length <= 1) return null;

    const selectedStrategyList = selectedStrategies.map(id => strategies.find(s => s.id === id)!);
    const timeframes = selectedStrategyList.map(s => s.timeframeOptimal.split(', '));
    const allTimeframes = new Set(timeframes.flat());

    if (allTimeframes.size > 2) {
      return `Selected strategies are optimized for different timeframes. Consider using same timeframe for consistency.`;
    }

    return null;
  }, [selectedStrategies, strategies]);

  return (
    <div className="space-y-4 p-4 bg-gray-900 rounded-lg border border-gray-800">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-semibold text-white">Strategy Ensemble Selector</h3>
        {selectedStrategies.length > 0 && (
          <span className="ml-auto text-sm text-gray-400">
            {selectedStrategies.length} of {strategies.length} selected
          </span>
        )}
      </div>

      {/* Strategies by Type */}
      <div className="space-y-3">
        {Object.entries(strategiesByType).map(([type, typeStrategies]) => {
          if (typeStrategies.length === 0) return null;

          return (
            <div key={type} className="space-y-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {STRATEGY_LABELS[type as Strategy['type']]}
              </div>

              {typeStrategies.map(strategy => {
                const isSelected = selectedStrategies.includes(strategy.id);
                const { ranking } = getStrategyStats(strategy.id);
                const allocation = (ensembleMetrics?.allocation as any)?.[strategy.id] || 0;
                const isExpanded = expandedStrategy === strategy.id;

                return (
                  <div
                    key={strategy.id}
                    className={`rounded border cursor-pointer transition ${
                      isSelected
                        ? 'bg-blue-900 border-blue-500'
                        : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    {/* Main Card */}
                    <div
                      onClick={() => handleToggleStrategy(strategy.id)}
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
                            <div className="font-semibold text-white">{strategy.name}</div>
                            <div className="text-xs text-gray-400 mt-1">{strategy.description}</div>
                          </div>

                          {/* Expand Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedStrategy(isExpanded ? null : strategy.id);
                            }}
                            className="text-gray-400 hover:text-gray-300 ml-2 flex-shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        {/* Stats Row */}
                        <div className="flex gap-4 mt-2 flex-wrap text-xs">
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-green-400" />
                            <span className="text-green-400">Win: {(strategy.avgWinRate * 100).toFixed(1)}%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Award className="w-3 h-3 text-yellow-400" />
                            <span className="text-yellow-400">Sharpe: {strategy.avgSharpe.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingDown className="w-3 h-3 text-blue-400" />
                            <span className="text-blue-400">Return: {(strategy.avgReturn * 100).toFixed(2)}%</span>
                          </div>
                          <div className={`text-xs px-2 py-0.5 rounded ${
                            strategy.riskLevel === 'LOW' ? 'bg-green-900 text-green-300' :
                            strategy.riskLevel === 'MEDIUM' ? 'bg-yellow-900 text-yellow-300' :
                            'bg-red-900 text-red-300'
                          }`}>
                            {strategy.riskLevel}
                          </div>
                        </div>

                        {/* Selected Indicator */}
                        {isSelected && allocation && (
                          <div className="mt-2 pt-2 border-t border-blue-700">
                            <div className="text-xs text-blue-300">
                              Position Size: {(allocation * 100).toFixed(1)}%
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
                            <div className="text-gray-400">Optimal Timeframe</div>
                            <div className="text-gray-300 font-semibold">{strategy.timeframeOptimal}</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Rank (by Sharpe)</div>
                            <div className="text-blue-400 font-semibold">#{ranking}</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400">Risk Level</div>
                          <div className={`font-semibold ${
                            strategy.riskLevel === 'LOW' ? 'text-green-400' :
                            strategy.riskLevel === 'MEDIUM' ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {strategy.riskLevel}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400">Status</div>
                          <div className={strategy.enabled ? 'text-green-400' : 'text-red-400'}>
                            {strategy.enabled ? '✓ Active' : '✗ Disabled'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <button
          onClick={handleSelectBest}
          className="px-3 py-2 bg-green-900 hover:bg-green-800 text-green-100 rounded text-sm font-medium transition"
          title="Select best 2 strategies by Sharpe ratio"
        >
          Best 2 (Sharpe)
        </button>
        <button
          onClick={handleClearAll}
          disabled={selectedStrategies.length === 0}
          className="px-3 py-2 bg-red-900 hover:bg-red-800 disabled:bg-gray-700 text-red-100 rounded text-sm font-medium transition"
        >
          Clear
        </button>
      </div>

      {/* Timeframe Warning */}
      {timeframeWarning && (
        <div className="bg-yellow-900 border border-yellow-700 p-2 rounded text-xs text-yellow-200">
          ⚠️ {timeframeWarning}
        </div>
      )}

      {/* Selected Ensemble Summary */}
      {selectedStrategies.length > 0 && showStats && (
        <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-3">
          <div className="text-sm font-semibold text-white border-b border-gray-700 pb-2">
            Ensemble ({selectedStrategies.length} strategies)
          </div>

          {/* Selected Strategies List */}
          <div className="space-y-1">
            {selectedStrategies.map((id, i) => {
              const strategy = strategies.find(s => s.id === id)!;
              const allocation = (ensembleMetrics?.allocation as any)?.[id] || 0;
              return (
                <div key={id} className="text-xs text-gray-300 flex justify-between">
                  <span>{i + 1}. {strategy.name}</span>
                  {allocation && (
                    <span className="text-gray-500">
                      {(allocation * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Combined Metrics */}
          <div className="bg-gray-900 p-2 rounded border border-gray-800 space-y-1">
            <div className="text-xs">
              <div className="text-gray-400">Avg Win Rate:</div>
              <div className="text-green-400 font-semibold">
                {(ensembleMetrics.avgWinRate * 100).toFixed(1)}%
              </div>
            </div>
            <div className="text-xs">
              <div className="text-gray-400">Avg Sharpe Ratio:</div>
              <div className="text-yellow-400 font-semibold">
                {ensembleMetrics.avgSharpe.toFixed(2)}
              </div>
            </div>
            <div className="text-xs">
              <div className="text-gray-400">Avg Return:</div>
              <div className="text-blue-400 font-semibold">
                {(ensembleMetrics.avgReturn * 100).toFixed(2)}%
              </div>
            </div>
            <div className="text-xs">
              <div className="text-gray-400">Overall Risk:</div>
              <div className={`font-semibold ${
                ensembleMetrics.avgRiskLevel === 'LOW' ? 'text-green-400' :
                ensembleMetrics.avgRiskLevel === 'MEDIUM' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {ensembleMetrics.avgRiskLevel}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Position Sizing Method */}
      {selectedStrategies.length > 1 && (
        <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-2">
          <div className="text-sm font-semibold text-white">Position Sizing Method:</div>

          {[
            {
              id: 'equal',
              label: 'Equal Weight',
              description: 'Same allocation to all strategies'
            },
            {
              id: 'performance',
              label: 'Performance Weight',
              description: 'Allocate more to higher Sharpe strategies'
            },
            {
              id: 'volatility',
              label: 'Volatility Weight',
              description: 'Less capital to riskier strategies'
            }
          ].map(method => (
            <label
              key={method.id}
              className="flex items-start gap-2 text-sm text-gray-300 cursor-pointer p-2 rounded hover:bg-gray-700 transition"
            >
              <input
                type="radio"
                name="positionSizingMethod"
                value={method.id}
                checked={positionSizingMethod === method.id}
                onChange={(e) => onPositionSizingChange?.(e.target.value as PositionSizingMethod)}
                className="w-4 h-4 mt-0.5"
              />
              <div className="flex-1">
                <div className="font-medium">{method.label}</div>
                <div className="text-xs text-gray-500">{method.description}</div>
              </div>
            </label>
          ))}
        </div>
      )}

      {/* Voting Method Selection */}
      <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-2">
        <div className="text-sm font-semibold text-white">Voting Method:</div>

        {[
          {
            id: 'majority',
            label: 'Majority Vote',
            description: 'Most strategies must agree'
          },
          {
            id: 'weighted',
            label: 'Weighted Average',
            description: 'Weight by Sharpe ratio'
          },
          {
            id: 'consensus',
            label: 'Consensus',
            description: 'All strategies must agree'
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
      {selectedStrategies.length > 0 && (
        <div className="bg-green-900 border border-green-700 p-2 rounded text-xs text-green-200 flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>Valid ensemble configured. Ready to backtest.</span>
        </div>
      )}

      {selectedStrategies.length === 0 && (
        <div className="bg-yellow-900 border border-yellow-700 p-2 rounded text-xs text-yellow-200 flex items-center gap-2">
          <X className="w-4 h-4" />
          <span>Select at least 1 strategy to create ensemble</span>
        </div>
      )}
    </div>
  );
};

export default StrategySelector;
