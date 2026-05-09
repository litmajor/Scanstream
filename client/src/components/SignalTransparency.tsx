/**
 * PHASE 5: SIGNAL TRANSPARENCY DASHBOARD
 * 
 * Real-time visualization of signal sources and confidence breakdown
 * Shows: Scanner, ML, RL, RPG scores with reasoning
 * Updates via WebSocket for live signals
 */

import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export interface SignalSourceBreakdown {
  scanner: {
    score: number;          // 0-100
    momentum: number;       // RSI, MACD component
    pattern: number;        // Pattern strength
    volume: number;         // Order flow
    reasoning: string;
  };
  ml: {
    score: number;          // 0-100
    confidence: number;     // Model confidence interval
    prediction1h: number;   // 1h price prediction
    prediction4h: number;   // 4h price prediction
    reasoning: string;
  };
  rl: {
    score: number;          // 0-100
    positionSize: number;   // Kelly fraction
    regime: string;         // Current market regime
    riskAdjusted: number;   // Risk-adjusted score
    reasoning: string;
  };
  rpg: {
    score: number;          // 0-100
    agentVotes: number;     // Number of agents voting
    consensus: number;      // Agreement level (0-100)
    topAgent: string;       // Leading agent
    reasoning: string;
  };
}

export interface SignalTransparencyProps {
  signal: {
    symbol: string;
    type: 'BUY' | 'SELL' | 'HOLD';
    overallConfidence: number;
    sourceBreakdown: SignalSourceBreakdown;
    qualityScore: number;     // 0-100 from quality gating
    recommendation: 'STRONG' | 'MODERATE' | 'WEAK' | 'REJECT';
    timestamp: string;
    reasoning: string[];
  };
}

const SignalTransparency: React.FC<SignalTransparencyProps> = ({ signal }) => {
  const [selectedSource, setSelectedSource] = useState<'scanner' | 'ml' | 'rl' | 'rpg'>('scanner');
  const [showDetails, setShowDetails] = useState(false);

  // Data for pie chart (source distribution)
  const sourceDistribution = [
    { name: 'Scanner', value: signal.sourceBreakdown.scanner.score, fill: '#8884d8' },
    { name: 'ML', value: signal.sourceBreakdown.ml.score, fill: '#82ca9d' },
    { name: 'RL', value: signal.sourceBreakdown.rl.score, fill: '#ffc658' },
    { name: 'RPG', value: signal.sourceBreakdown.rpg.score, fill: '#ff7c7c' }
  ];

  // Data for bar chart (source component breakdown for selected source)
  const getComponentData = () => {
    switch (selectedSource) {
      case 'scanner':
        return [
          { name: 'Momentum', value: signal.sourceBreakdown.scanner.momentum },
          { name: 'Pattern', value: signal.sourceBreakdown.scanner.pattern },
          { name: 'Volume', value: signal.sourceBreakdown.scanner.volume }
        ];
      case 'ml':
        return [
          { name: 'Confidence', value: signal.sourceBreakdown.ml.confidence },
          { name: '1h Pred', value: Math.abs(signal.sourceBreakdown.ml.prediction1h) * 100 },
          { name: '4h Pred', value: Math.abs(signal.sourceBreakdown.ml.prediction4h) * 100 }
        ];
      case 'rl':
        return [
          { name: 'Position', value: Math.min(signal.sourceBreakdown.rl.positionSize * 100, 100) },
          { name: 'Risk-Adj', value: signal.sourceBreakdown.rl.riskAdjusted },
          { name: 'Regime Match', value: signal.sourceBreakdown.rl.score }
        ];
      case 'rpg':
        return [
          { name: 'Agent Votes', value: (signal.sourceBreakdown.rpg.agentVotes / 5) * 100 },
          { name: 'Consensus', value: signal.sourceBreakdown.rpg.consensus },
          { name: 'Overall', value: signal.sourceBreakdown.rpg.score }
        ];
      default:
        return [];
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 65) return 'text-yellow-600';
    if (confidence >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getRecommendationBgColor = (rec: string) => {
    switch (rec) {
      case 'STRONG':
        return 'bg-green-100 border-green-400';
      case 'MODERATE':
        return 'bg-yellow-100 border-yellow-400';
      case 'WEAK':
        return 'bg-orange-100 border-orange-400';
      case 'REJECT':
        return 'bg-red-100 border-red-400';
      default:
        return 'bg-gray-100 border-gray-400';
    }
  };

  return (
    <div className="w-full bg-white rounded-lg shadow-lg p-6 space-y-6">
      {/* HEADER: Signal Overview */}
      <div className="border-b pb-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h2 className="text-2xl font-bold">{signal.symbol}</h2>
            <p className="text-sm text-gray-500">{new Date(signal.timestamp).toLocaleString()}</p>
          </div>
          <div className={`px-4 py-2 rounded-lg border-2 ${getRecommendationBgColor(signal.recommendation)}`}>
            <p className="font-bold">{signal.recommendation}</p>
            <p className="text-sm">{signal.type}</p>
          </div>
        </div>

        {/* Confidence Score */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between mb-2">
              <span className="font-semibold">Overall Confidence</span>
              <span className={`font-bold text-lg ${getConfidenceColor(signal.overallConfidence)}`}>
                {signal.overallConfidence.toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  signal.overallConfidence >= 80
                    ? 'bg-green-500'
                    : signal.overallConfidence >= 65
                    ? 'bg-yellow-500'
                    : signal.overallConfidence >= 50
                    ? 'bg-orange-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${signal.overallConfidence}%` }}
              />
            </div>
          </div>

          {/* Quality Score Badge */}
          <div className="text-center">
            <p className="text-xs text-gray-600 mb-1">Quality Score</p>
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <p className="font-bold text-blue-600">{signal.qualityScore.toFixed(0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* SOURCE DISTRIBUTION PIE CHART */}
      <div className="space-y-3">
        <h3 className="font-bold text-lg">Source Distribution</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={sourceDistribution}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }: any) => `${name}: ${(value || 0).toFixed(0)}`}
              outerRadius={60}
              fill="#8884d8"
              dataKey="value"
            >
              {sourceDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `${(value as number).toFixed(0)}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* SOURCE SCORES BREAKDOWN */}
      <div className="grid grid-cols-2 gap-4">
        {/* Scanner Source */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              Scanner
            </h4>
            <span className={`text-xl font-bold ${getConfidenceColor(signal.sourceBreakdown.scanner.score)}`}>
              {signal.sourceBreakdown.scanner.score.toFixed(0)}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-700">Momentum</span>
              <span className="font-semibold">{signal.sourceBreakdown.scanner.momentum.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Pattern</span>
              <span className="font-semibold">{signal.sourceBreakdown.scanner.pattern.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Volume</span>
              <span className="font-semibold">{signal.sourceBreakdown.scanner.volume.toFixed(0)}</span>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-3 italic">{signal.sourceBreakdown.scanner.reasoning}</p>
        </div>

        {/* ML Source */}
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              ML
            </h4>
            <span className={`text-xl font-bold ${getConfidenceColor(signal.sourceBreakdown.ml.score)}`}>
              {signal.sourceBreakdown.ml.score.toFixed(0)}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-700">Confidence</span>
              <span className="font-semibold">{signal.sourceBreakdown.ml.confidence.toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">1h Prediction</span>
              <span className={`font-semibold ${signal.sourceBreakdown.ml.prediction1h > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(signal.sourceBreakdown.ml.prediction1h * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">4h Prediction</span>
              <span className={`font-semibold ${signal.sourceBreakdown.ml.prediction4h > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(signal.sourceBreakdown.ml.prediction4h * 100).toFixed(1)}%
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-3 italic">{signal.sourceBreakdown.ml.reasoning}</p>
        </div>

        {/* RL Source */}
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
              RL
            </h4>
            <span className={`text-xl font-bold ${getConfidenceColor(signal.sourceBreakdown.rl.score)}`}>
              {signal.sourceBreakdown.rl.score.toFixed(0)}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-700">Position Size</span>
              <span className="font-semibold">{(signal.sourceBreakdown.rl.positionSize * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Regime</span>
              <span className="font-semibold text-xs bg-blue-100 px-2 py-1 rounded">{signal.sourceBreakdown.rl.regime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Risk-Adjusted</span>
              <span className="font-semibold">{signal.sourceBreakdown.rl.riskAdjusted.toFixed(0)}</span>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-3 italic">{signal.sourceBreakdown.rl.reasoning}</p>
        </div>

        {/* RPG Source */}
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              RPG
            </h4>
            <span className={`text-xl font-bold ${getConfidenceColor(signal.sourceBreakdown.rpg.score)}`}>
              {signal.sourceBreakdown.rpg.score.toFixed(0)}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-700">Agent Votes</span>
              <span className="font-semibold">{signal.sourceBreakdown.rpg.agentVotes}/5</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Consensus</span>
              <span className="font-semibold">{signal.sourceBreakdown.rpg.consensus.toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Top Agent</span>
              <span className="font-semibold text-xs bg-red-100 px-2 py-1 rounded">{signal.sourceBreakdown.rpg.topAgent}</span>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-3 italic">{signal.sourceBreakdown.rpg.reasoning}</p>
        </div>
      </div>

      {/* DETAILED REASONING */}
      <div className="bg-gray-50 rounded-lg p-4">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex justify-between items-center font-bold text-left"
        >
          <span>Detailed Reasoning</span>
          <span>{showDetails ? '▼' : '▶'}</span>
        </button>
        {showDetails && (
          <div className="mt-4 space-y-2">
            {signal.reasoning.map((reason, idx) => (
              <div key={idx} className="flex gap-2 text-sm">
                <span className="text-blue-500 font-bold">{idx + 1}.</span>
                <span className="text-gray-700">{reason}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SignalTransparency;
