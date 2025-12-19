/**
 * PHASE 5: REGIME & WEIGHTS DISPLAY
 * 
 * Shows current market regime, weight distribution across signal sources
 * Displays regime transitions, confidence levels, historical regime changes
 * Real-time updates via WebSocket
 */

import React, { useState, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertCircle, TrendingUp, Gauge } from 'lucide-react';

export interface RegimeWeights {
  scanner: number;    // 0-1
  ml: number;        // 0-1
  rl: number;        // 0-1
  rpg: number;       // 0-1
}

export interface RegimeTransition {
  timestamp: string;
  fromRegime: string;
  toRegime: string;
  confidence: number;
}

export interface RegimeDisplayProps {
  currentRegime: string;
  regimeConfidence: number;          // 0-100
  weights: RegimeWeights;
  regimeHistory?: RegimeTransition[];
  volatilityLevel?: number;           // 0-100 (market volatility)
  trendStrength?: number;             // 0-100 (trend strength)
  activeSignalCount?: number;
}

const RegimeDisplay: React.FC<RegimeDisplayProps> = ({
  currentRegime,
  regimeConfidence,
  weights,
  regimeHistory = [],
  volatilityLevel = 50,
  trendStrength = 50,
  activeSignalCount = 0
}) => {
  const [showRegimeHistory, setShowRegimeHistory] = useState(false);

  // Format weights for display
  const weightData = useMemo(
    () => [
      { name: 'Scanner', value: parseFloat((weights.scanner * 100).toFixed(1)), color: '#3b82f6' },
      { name: 'ML', value: parseFloat((weights.ml * 100).toFixed(1)), color: '#8b5cf6' },
      { name: 'RL', value: parseFloat((weights.rl * 100).toFixed(1)), color: '#ec4899' },
      { name: 'RPG', value: parseFloat((weights.rpg * 100).toFixed(1)), color: '#f59e0b' }
    ],
    [weights]
  );

  // Historical data for transitions
  const transitionData = useMemo(
    () =>
      regimeHistory
        .slice(-20)
        .map((t, idx) => ({
          time: new Date(t.timestamp).toLocaleTimeString(),
          regime: t.toRegime,
          confidence: t.confidence
        })),
    [regimeHistory]
  );

  // Get regime info
  const getRegimeInfo = (regime: string) => {
    const regimeMap: {
      [key: string]: {
        emoji: string;
        description: string;
        color: string;
        bgColor: string;
        characteristics: string[];
      };
    } = {
      TRENDING_UP: {
        emoji: '📈',
        description: 'Strong Uptrend',
        color: 'text-green-600',
        bgColor: 'bg-green-100 border-green-300',
        characteristics: ['Long entries preferred', 'Follow breakouts', 'Support holds well']
      },
      TRENDING_DOWN: {
        emoji: '📉',
        description: 'Strong Downtrend',
        color: 'text-red-600',
        bgColor: 'bg-red-100 border-red-300',
        characteristics: ['Short entries preferred', 'Follow breakdowns', 'Resistance strong']
      },
      RANGE_BOUND: {
        emoji: '➡️',
        description: 'Range-Bound Market',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100 border-yellow-300',
        characteristics: ['Mean reversion works', 'Trade support/resistance', 'Avoid breakouts']
      },
      VOLATILE: {
        emoji: '⚡',
        description: 'High Volatility',
        color: 'text-orange-600',
        bgColor: 'bg-orange-100 border-orange-300',
        characteristics: ['Wider stops needed', 'Expect gaps', 'Position size reduced']
      },
      CHOPPY: {
        emoji: '🌀',
        description: 'Choppy/Indecisive',
        color: 'text-gray-600',
        bgColor: 'bg-gray-100 border-gray-300',
        characteristics: ['No clear direction', 'Avoid trading', 'Wait for clarity']
      }
    };

    return (
      regimeMap[regime] || {
        emoji: '❓',
        description: 'Unknown',
        color: 'text-gray-600',
        bgColor: 'bg-gray-100 border-gray-300',
        characteristics: []
      }
    );
  };

  const regimeInfo = getRegimeInfo(currentRegime);

  // Get regime recommendation
  const getRecommendation = (): string => {
    if (regimeConfidence < 50) {
      return 'Low confidence in current regime - use caution with new entries';
    }

    switch (currentRegime) {
      case 'TRENDING_UP':
        return 'Bias long positions, use pullbacks for entries, protect with trailing stops';
      case 'TRENDING_DOWN':
        return 'Bias short positions, use bounces for entries, protect with trailing stops';
      case 'RANGE_BOUND':
        return 'Fade extremes, buy support/sell resistance, use tighter stops';
      case 'VOLATILE':
        return 'Reduce position sizes by 25-50%, increase stop distances, focus on quality setups only';
      case 'CHOPPY':
        return 'Stay in cash or reduce trading activity significantly until clarity emerges';
      default:
        return 'Monitor regime for clarity before trading';
    }
  };

  // Get dominant source
  const dominantSource = weightData.reduce((prev, current) =>
    current.value > prev.value ? current : prev
  );

  return (
    <div className="w-full bg-white rounded-lg shadow-lg p-6 space-y-6">
      {/* HEADER */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-2">
          <Gauge size={24} className="text-blue-600" />
          Market Regime & Signal Weights
        </h2>
        <p className="text-sm text-gray-600">Current market conditions and adaptive signal source weighting</p>
      </div>

      {/* CURRENT REGIME BANNER */}
      <div className={`rounded-lg border-2 p-6 ${regimeInfo.bgColor}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{regimeInfo.emoji}</span>
            <div>
              <h3 className={`text-3xl font-bold ${regimeInfo.color}`}>{regimeInfo.description}</h3>
              <p className="text-sm text-gray-700 mt-1">{currentRegime}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-600 mb-1">Regime Confidence</p>
            <div className="flex items-center gap-2">
              <div className="w-40 h-2 bg-gray-300 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    regimeConfidence >= 80
                      ? 'bg-green-500'
                      : regimeConfidence >= 60
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${regimeConfidence}%` }}
                ></div>
              </div>
              <span className="font-bold text-lg">{regimeConfidence.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* CHARACTERISTICS */}
        <div className="mt-4 pt-4 border-t border-current border-opacity-20">
          <p className="text-xs font-bold text-gray-700 mb-2">Market Characteristics:</p>
          <div className="flex flex-wrap gap-2">
            {regimeInfo.characteristics.map((char, idx) => (
              <span key={idx} className="px-3 py-1 bg-white bg-opacity-60 rounded-full text-xs font-semibold">
                {char}
              </span>
            ))}
          </div>
        </div>

        {/* RECOMMENDATION */}
        <div className="mt-4 pt-4 border-t border-current border-opacity-20 bg-white bg-opacity-40 rounded p-3">
          <p className="text-xs font-bold text-gray-700 mb-1">💡 Trading Recommendation:</p>
          <p className="text-sm font-semibold">{getRecommendation()}</p>
        </div>
      </div>

      {/* KEY METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <p className="text-xs text-blue-700 mb-1">Volatility Level</p>
          <p className="text-2xl font-bold text-blue-600">{volatilityLevel.toFixed(0)}%</p>
          <div className="w-full h-2 bg-blue-200 rounded-full mt-2">
            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${volatilityLevel}%` }}></div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
          <p className="text-xs text-purple-700 mb-1">Trend Strength</p>
          <p className="text-2xl font-bold text-purple-600">{trendStrength.toFixed(0)}%</p>
          <div className="w-full h-2 bg-purple-200 rounded-full mt-2">
            <div className="h-full bg-purple-600 rounded-full" style={{ width: `${trendStrength}%` }}></div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <p className="text-xs text-green-700 mb-1">Active Signals</p>
          <p className="text-2xl font-bold text-green-600">{activeSignalCount}</p>
          <p className="text-xs text-green-600 mt-2">Currently monitored</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-200">
          <p className="text-xs text-amber-700 mb-1">Dominant Source</p>
          <p className="text-xl font-bold text-amber-600">{dominantSource.name}</p>
          <p className="text-sm text-amber-600 mt-1">{dominantSource.value.toFixed(1)}% weight</p>
        </div>
      </div>

      {/* WEIGHTS DISPLAY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
        {/* Weight Bar Chart */}
        <div className="bg-white rounded p-4 border border-gray-200">
          <p className="font-bold text-sm mb-4">Signal Source Weights</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weightData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={{ value: 'Weight %', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {weightData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weight Pie Chart */}
        <div className="bg-white rounded p-4 border border-gray-200">
          <p className="font-bold text-sm mb-4">Weight Distribution</p>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={weightData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name} ${value.toFixed(1)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {weightData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* DETAILED WEIGHTS */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <p className="font-bold mb-4">Detailed Weight Breakdown</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {weightData.map((source) => (
            <div key={source.name} className="bg-white rounded p-4 border-2" style={{ borderColor: source.color }}>
              <p className="text-xs text-gray-600 mb-2">{source.name}</p>
              <p className="text-3xl font-bold" style={{ color: source.color }}>
                {source.value.toFixed(1)}%
              </p>
              <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${source.value}%`,
                    backgroundColor: source.color
                  }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {source.value > 30 ? '🔥 Heavy' : source.value > 20 ? '⚡ Moderate' : '💡 Light'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* REGIME TRANSITIONS HISTORY */}
      {regimeHistory.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <button
            onClick={() => setShowRegimeHistory(!showRegimeHistory)}
            className="flex items-center justify-between w-full mb-4 cursor-pointer hover:bg-white p-3 rounded transition"
          >
            <p className="font-bold flex items-center gap-2">
              <TrendingUp size={18} />
              Regime Transition History
            </p>
            <span className="text-xl">{showRegimeHistory ? '▼' : '▶'}</span>
          </button>

          {showRegimeHistory && (
            <div className="space-y-3">
              {/* Timeline Chart */}
              {transitionData.length > 1 && (
                <div className="bg-white rounded p-4 mb-4">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={transitionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" angle={-45} textAnchor="end" height={80} />
                      <YAxis domain={[0, 100]} label={{ value: 'Confidence %', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="confidence"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Detailed List */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {regimeHistory
                  .slice()
                  .reverse()
                  .slice(0, 10)
                  .map((transition, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white p-3 rounded border border-gray-200">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-sm font-mono text-gray-500">
                          {new Date(transition.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-lg">{getRegimeInfo(transition.fromRegime).emoji}</span>
                        <span className="text-gray-600">→</span>
                        <span className="text-lg">{getRegimeInfo(transition.toRegime).emoji}</span>
                        <span className="text-sm font-semibold">{transition.toRegime}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${transition.confidence}%` }}
                          ></div>
                        </div>
                        <span className="font-bold text-sm text-gray-700 w-12 text-right">
                          {transition.confidence.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* INFO BOXES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* How It Works */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="font-bold text-blue-900 mb-2 flex items-center gap-2">
            <AlertCircle size={18} />
            How Regime Detection Works
          </p>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✓ Analyzes price action, volatility, and trend strength</li>
            <li>✓ Identifies 5 market conditions automatically</li>
            <li>✓ Adjusts signal source weights in real-time</li>
            <li>✓ Signals confidence level of regime classification</li>
          </ul>
        </div>

        {/* Trading Implications */}
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <p className="font-bold text-green-900 mb-2 flex items-center gap-2">
            <TrendingUp size={18} />
            Trading Implications
          </p>
          <ul className="text-sm text-green-800 space-y-1">
            <li>✓ Position sizing adapts to regime conditions</li>
            <li>✓ Stop losses widened in volatile regimes</li>
            <li>✓ Entry criteria adjusted per regime type</li>
            <li>✓ Risk management automatically calibrated</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RegimeDisplay;
