/**
 * Velocity Profile Panel (Phase 2)
 * 
 * UI component to visualize and configure velocity-based position sizing measurements
 * - Standard velocity-based sizing
 * - Adaptive velocity-based sizing
 * - High-frequency velocity-based sizing
 */

import React, { useState } from 'react';
import { TrendingUp, CheckCircle, AlertCircle, Zap, Settings, Download, Play, Activity } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';

interface VelocityMetrics {
  priceVelocity: number;
  volumeVelocity: number;
  momentumVelocity: number;
  acceleration: number;
  volatility: number;
  convictionScore: number;
}

interface VelocityImpact {
  metrics: {
    returnImprovement: number;
    sharpeImprovement: number;
    drawdownReduction: number;
    winRateImprovement: number;
  };
  avgMultiplier: number;
  velocityDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  timeInHighVelocity: number;
}

interface BaselineMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
}

interface VelocityProfileReport {
  baseline: BaselineMetrics;
  withVelocityProfile?: VelocityImpact;
  adaptiveVelocity?: VelocityImpact;
  highFrequencyVelocity?: VelocityImpact;
  combined?: VelocityImpact;
  velocityProfile?: {
    avgVelocity: number;
    volatilityProfile: {
      low: number;
      medium: number;
      high: number;
    };
  };
}

interface VelocityProfilePanelProps {
  onMeasure?: (config: any) => void;
  isLoading?: boolean;
  report?: VelocityProfileReport;
}

const VELOCITY_STRATEGIES = [
  {
    id: 'velocity',
    name: 'Standard Velocity',
    description: 'Basic velocity-based sizing (0.5x-2.0x)',
    expected: '+20-30%'
  },
  {
    id: 'adaptive',
    name: 'Adaptive Velocity',
    description: 'Adjusts for velocity trends and momentum',
    expected: '+22-32%'
  },
  {
    id: 'high-frequency',
    name: 'High-Frequency Velocity',
    description: 'Aggressive scaling for fast-moving markets',
    expected: '+18-28%'
  }
];

export default function VelocityProfilePanel({
  onMeasure,
  isLoading = false,
  report
}: VelocityProfilePanelProps) {
  const [selectedStrategies, setSelectedStrategies] = useState(['velocity', 'adaptive', 'high-frequency']);
  const [showResults, setShowResults] = useState(false);

  const handleStrategyToggle = (strategyId: string) => {
    const updated = selectedStrategies.includes(strategyId)
      ? selectedStrategies.filter(s => s !== strategyId)
      : [...selectedStrategies, strategyId];
    setSelectedStrategies(updated);
  };

  const handleMeasure = () => {
    onMeasure?.({
      strategies: {
        enableVelocityProfile: selectedStrategies.includes('velocity'),
        enableAdaptiveVelocity: selectedStrategies.includes('adaptive'),
        enableHighFrequency: selectedStrategies.includes('high-frequency')
      }
    });
    setShowResults(true);
  };

  const improvementColor = (value: number) => {
    if (value > 25) return 'text-green-600';
    if (value > 15) return 'text-emerald-600';
    if (value > 0) return 'text-teal-600';
    return 'text-orange-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-6 h-6 text-blue-500" />
        <div>
          <h2 className="text-2xl font-bold">Velocity Profile Measurement</h2>
          <p className="text-sm text-gray-500">Measure impact of velocity-based position sizing strategies</p>
        </div>
      </div>

      {/* Strategy Selection Panel */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Velocity Sizing Strategies
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {VELOCITY_STRATEGIES.map(strategy => (
            <label
              key={strategy.id}
              className="relative flex items-start p-4 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedStrategies.includes(strategy.id)}
                onChange={() => handleStrategyToggle(strategy.id)}
                className="mt-1 w-4 h-4 rounded"
              />
              <div className="ml-3 flex-1">
                <p className="font-medium text-gray-900">{strategy.name}</p>
                <p className="text-sm text-gray-500 mt-1">{strategy.description}</p>
                <p className="text-sm font-semibold text-blue-600 mt-2">Expected: {strategy.expected}</p>
              </div>
            </label>
          ))}
        </div>

        <p className="text-sm text-gray-600 mt-4">
          Selected: {selectedStrategies.length}/{VELOCITY_STRATEGIES.length} strategies
        </p>
      </div>

      {/* Velocity Profile Information */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h4 className="font-semibold text-blue-900 flex items-center gap-2 mb-3">
          <AlertCircle className="w-4 h-4" />
          How Velocity-Based Sizing Works
        </h4>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>• <strong>Price Velocity</strong>: Rate of price change from moving average</li>
          <li>• <strong>Volume Velocity</strong>: Rate of volume increase relative to average</li>
          <li>• <strong>Conviction Score</strong>: Normalized score (0-1) determining position size</li>
          <li>• <strong>Position Multiplier</strong>: Applied dynamically (0.5x to 2.0x) based on velocity</li>
          <li>• <strong>Adaptive Mode</strong>: Adjusts multiplier based on recent velocity trends</li>
          <li>• <strong>High-Frequency Mode</strong>: More aggressive scaling for fast-moving markets</li>
        </ul>
      </div>

      {/* Measure Button */}
      <button
        onClick={handleMeasure}
        disabled={isLoading || selectedStrategies.length === 0}
        className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold py-3 rounded-lg hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
      >
        <Play className="w-4 h-4" />
        {isLoading ? 'Measuring Velocity Profile...' : 'Run Velocity Profile Measurement'}
      </button>

      {/* Results Display */}
      {report && showResults && (
        <div className="space-y-6 mt-8">
          {/* Baseline Metrics */}
          <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg p-6 border border-gray-200">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-gray-600" />
              Baseline Performance (No Velocity Sizing)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                label="Return"
                value={`${report.baseline.totalReturn.toFixed(2)}%`}
                subtext={`${report.baseline.totalTrades} trades`}
              />
              <MetricCard
                label="Win Rate"
                value={`${(report.baseline.winRate * 100).toFixed(1)}%`}
              />
              <MetricCard
                label="Sharpe Ratio"
                value={report.baseline.sharpeRatio.toFixed(2)}
              />
              <MetricCard
                label="Max Drawdown"
                value={`${(report.baseline.maxDrawdown * 100).toFixed(1)}%`}
              />
            </div>
          </div>

          {/* Velocity Profile Analysis */}
          {report.velocityProfile && (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Asset Velocity Profile Analysis
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Average Conviction Score</p>
                  <div className="bg-gradient-to-r from-blue-100 to-cyan-100 rounded-lg p-4">
                    <p className="text-3xl font-bold text-blue-600">
                      {(report.velocityProfile.avgVelocity * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-600 mt-1">Higher = More consistent signal strength</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-2">Volatility Distribution</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Low Volatility</span>
                      <div className="w-32 bg-gray-200 rounded h-2">
                        <div
                          className="bg-green-500 h-2 rounded"
                          style={{ width: `${report.velocityProfile.volatilityProfile.low}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold">{report.velocityProfile.volatilityProfile.low.toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Medium Volatility</span>
                      <div className="w-32 bg-gray-200 rounded h-2">
                        <div
                          className="bg-yellow-500 h-2 rounded"
                          style={{ width: `${report.velocityProfile.volatilityProfile.medium}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold">{report.velocityProfile.volatilityProfile.medium.toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">High Volatility</span>
                      <div className="w-32 bg-gray-200 rounded h-2">
                        <div
                          className="bg-red-500 h-2 rounded"
                          style={{ width: `${report.velocityProfile.volatilityProfile.high}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold">{report.velocityProfile.volatilityProfile.high.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Strategy Results */}
          {report.withVelocityProfile && (
            <VelocityStrategyCard
              title="Standard Velocity-Based Sizing"
              description="Basic velocity-based position sizing with 0.5x-2.0x range"
              impact={report.withVelocityProfile}
            />
          )}

          {report.adaptiveVelocity && (
            <VelocityStrategyCard
              title="Adaptive Velocity-Based Sizing"
              description="Adjusts position size based on recent velocity trends and momentum"
              impact={report.adaptiveVelocity}
            />
          )}

          {report.highFrequencyVelocity && (
            <VelocityStrategyCard
              title="High-Frequency Velocity-Based Sizing"
              description="Aggressive scaling optimized for fast-moving market conditions"
              impact={report.highFrequencyVelocity}
            />
          )}

          {/* Combined Impact */}
          {report.combined && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border-2 border-green-300">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Combined Impact (Best Strategy Per Trade)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  label="Return Improvement"
                  value={`+${report.combined.metrics.returnImprovement.toFixed(1)}%`}
                  highlight={true}
                />
                <MetricCard
                  label="Sharpe Improvement"
                  value={`+${report.combined.metrics.sharpeImprovement.toFixed(1)}%`}
                  highlight={true}
                />
                <MetricCard
                  label="Drawdown Reduction"
                  value={`${report.combined.metrics.drawdownReduction.toFixed(1)}%`}
                  highlight={true}
                />
                <MetricCard
                  label="Win Rate Improvement"
                  value={`+${report.combined.metrics.winRateImprovement.toFixed(1)}%`}
                  highlight={true}
                />
              </div>
            </div>
          )}

          {/* Export Button */}
          <button className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
            <Download className="w-4 h-4" />
            Export Velocity Report
          </button>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  subtext?: string;
  highlight?: boolean;
}

function MetricCard({ label, value, subtext, highlight }: MetricCardProps) {
  return (
    <div className={`rounded-lg p-4 ${highlight ? 'bg-white border-2 border-green-300' : 'bg-white border border-gray-200'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-green-600' : 'text-gray-800'}`}>{value}</p>
      {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
    </div>
  );
}

interface VelocityStrategyCardProps {
  title: string;
  description: string;
  impact: VelocityImpact;
}

function VelocityStrategyCard({ title, description, impact }: VelocityStrategyCardProps) {
  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-4">{description}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <MetricCard
          label="Return Improvement"
          value={`+${impact.metrics.returnImprovement.toFixed(1)}%`}
        />
        <MetricCard
          label="Sharpe Improvement"
          value={`+${impact.metrics.sharpeImprovement.toFixed(1)}%`}
        />
        <MetricCard
          label="Drawdown Reduction"
          value={`${impact.metrics.drawdownReduction.toFixed(1)}%`}
        />
        <MetricCard
          label="Win Rate Improvement"
          value={`+${impact.metrics.winRateImprovement.toFixed(1)}%`}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded p-3">
          <p className="text-xs text-gray-600 mb-1">Average Multiplier</p>
          <p className="text-lg font-semibold text-blue-600">{impact.avgMultiplier.toFixed(2)}x</p>
          <p className="text-xs text-gray-500 mt-1">Position size adjustment</p>
        </div>

        <div className="bg-gray-50 rounded p-3">
          <p className="text-xs text-gray-600 mb-1">High Velocity Time</p>
          <p className="text-lg font-semibold text-cyan-600">{impact.timeInHighVelocity.toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-1">Trades with 1.25x-2.0x sizing</p>
        </div>
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded">
        <p className="text-xs text-gray-600 mb-2">Position Multiplier Distribution</p>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs">Conservative (0.5-0.75x)</span>
            <div className="w-32 bg-gray-200 rounded h-2">
              <div
                className="bg-blue-400 h-2 rounded"
                style={{ width: `${impact.velocityDistribution.low}%` }}
              ></div>
            </div>
            <span className="text-xs font-semibold">{impact.velocityDistribution.low.toFixed(0)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs">Neutral (0.75-1.25x)</span>
            <div className="w-32 bg-gray-200 rounded h-2">
              <div
                className="bg-green-400 h-2 rounded"
                style={{ width: `${impact.velocityDistribution.medium}%` }}
              ></div>
            </div>
            <span className="text-xs font-semibold">{impact.velocityDistribution.medium.toFixed(0)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs">Aggressive (1.25-2.0x)</span>
            <div className="w-32 bg-gray-200 rounded h-2">
              <div
                className="bg-cyan-400 h-2 rounded"
                style={{ width: `${impact.velocityDistribution.high}%` }}
              ></div>
            </div>
            <span className="text-xs font-semibold">{impact.velocityDistribution.high.toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
