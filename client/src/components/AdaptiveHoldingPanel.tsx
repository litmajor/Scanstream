/**
 * PHASE 3: ADAPTIVE HOLDING PANEL
 * 
 * UI component for configuring and visualizing adaptive holding period analysis
 * Allows users to measure impact of regime-aware and flow-based holding strategies
 */

import React, { useState } from 'react';
import { TrendingUp, Clock, Users, Zap, CheckCircle2, AlertCircle, BarChart3, PieChart } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart as RechartsPI, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AdaptiveHoldingPanelProps {
  onMeasure?: (config: any) => void;
  isLoading?: boolean;
  report?: any;
}

const HOLDING_STRATEGIES = [
  {
    id: 'adaptive',
    name: 'Adaptive Holding',
    description: 'Uses market regime, institutional flow, and microstructure',
    expected: '+15-25%',
    icon: '🎯',
    color: 'bg-blue-600',
  },
  {
    id: 'flow-based',
    name: 'Flow-Based Holding',
    description: 'Focused on institutional order flow analysis',
    expected: '+12-20%',
    icon: '💰',
    color: 'bg-emerald-600',
  },
  {
    id: 'microstructure',
    name: 'Microstructure-Based',
    description: 'Uses bid-ask spread and order book depth',
    expected: '+10-18%',
    icon: '📊',
    color: 'bg-violet-600',
  },
];

const MARKET_REGIMES = [
  { name: 'Trending', description: 'Uptrend or strong directional move', holdingDays: 14 },
  { name: 'Ranging', description: 'Consolidation/sideways price action', holdingDays: 3 },
  { name: 'Volatile', description: 'High uncertainty, whipsaw conditions', holdingDays: 2 },
];

interface MetricCardProps {
  label: string;
  value: string | number;
  improvement?: number;
  unit?: string;
  color?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, improvement, unit = '', color = 'text-blue-600' }) => (
  <div className="bg-white border border-gray-200 rounded-lg p-4 flex-1 min-w-[160px]">
    <div className="text-xs font-semibold text-gray-500 mb-1">{label}</div>
    <div className={`text-xl font-bold ${color} mb-1`}>
      {value}
      {unit}
    </div>
    {improvement !== undefined && (
      <div className={`text-xs font-semibold ${improvement > 0 ? 'text-green-600' : 'text-red-600'}`}>
        {improvement > 0 ? '+' : ''}{improvement}%
      </div>
    )}
  </div>
);

interface HoldingStrategyCardProps {
  strategy: (typeof HOLDING_STRATEGIES)[0];
  selected: boolean;
  onChange: (id: string) => void;
}

const HoldingStrategyCard: React.FC<HoldingStrategyCardProps> = ({ strategy, selected, onChange }) => (
  <div
    onClick={() => onChange(strategy.id)}
    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
      selected
        ? `border-blue-500 ${strategy.color} bg-opacity-10`
        : 'border-gray-200 hover:border-blue-300'
    }`}
  >
    <div className="flex items-start justify-between mb-2">
      <div className="text-2xl">{strategy.icon}</div>
      {selected && <CheckCircle2 size={20} className="text-blue-600" />}
    </div>
    <h3 className="font-semibold text-sm mb-1">{strategy.name}</h3>
    <p className="text-xs text-gray-600 mb-2">{strategy.description}</p>
    <div className="text-sm font-bold text-green-600">{strategy.expected}</div>
  </div>
);

export const AdaptiveHoldingPanel: React.FC<AdaptiveHoldingPanelProps> = ({ onMeasure, isLoading, report }) => {
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>(['adaptive', 'flow-based']);
  const [showResults, setShowResults] = useState(false);

  const toggleStrategy = (strategyId: string) => {
    setSelectedStrategies((prev) =>
      prev.includes(strategyId) ? prev.filter((s) => s !== strategyId) : [...prev, strategyId]
    );
  };

  const handleMeasure = async () => {
    if (onMeasure) {
      await onMeasure({
        enableAdaptive: selectedStrategies.includes('adaptive'),
        enableFlowBased: selectedStrategies.includes('flow-based'),
        enableMicrostructure: selectedStrategies.includes('microstructure'),
      });
      setShowResults(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-emerald-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">📅 Adaptive Holding Period Analysis</h2>
            <p className="text-gray-700">
              Measure impact of adaptive holding periods based on market regime, institutional flow, and microstructure
            </p>
          </div>
          <div className="bg-blue-600 text-white rounded-lg px-4 py-2 font-semibold">Phase 3</div>
        </div>
      </div>

      {/* Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3 mb-3">
          <div className="text-2xl">💡</div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">How Adaptive Holding Works</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>
                <strong>Market Regime</strong>: Trending markets get longer holds (14+ days), ranging markets get quick exits (3 days)
              </li>
              <li>
                <strong>Institutional Flow</strong>: Strong buying (&gt;75%) extends holding, weak flow (&lt;35%) triggers exits
              </li>
              <li>
                <strong>Microstructure</strong>: Tight bid-ask spreads and good depth indicate healthy markets for longer holds
              </li>
              <li>
                <strong>Expected Improvement</strong>: Combined approach shows +15-25% return improvement with reduced drawdown
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Strategy Selection */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Zap size={18} />
          Select Holding Strategies to Measure
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {HOLDING_STRATEGIES.map((strategy) => (
            <HoldingStrategyCard
              key={strategy.id}
              strategy={strategy}
              selected={selectedStrategies.includes(strategy.id)}
              onChange={toggleStrategy}
            />
          ))}
        </div>
        <div className="text-sm text-gray-600">
          Selected: {selectedStrategies.length > 0 ? selectedStrategies.join(', ') : 'None'} ({selectedStrategies.length}/3)
        </div>
      </div>

      {/* Market Regime Reference */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <TrendingUp size={18} />
          Holding Period by Market Regime
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {MARKET_REGIMES.map((regime) => (
            <div key={regime.name} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="font-semibold text-gray-900">{regime.name}</div>
              <div className="text-sm text-gray-600 mb-2">{regime.description}</div>
              <div className="flex items-center gap-2 text-blue-600 font-semibold">
                <Clock size={16} />
                {regime.holdingDays} days
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={handleMeasure}
        disabled={isLoading || selectedStrategies.length === 0}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            Running Adaptive Holding Measurement...
          </>
        ) : (
          <>
            <Clock size={20} />
            Run Adaptive Holding Period Measurement
          </>
        )}
      </button>

      {/* Results Section */}
      {showResults && report && (
        <div className="space-y-6 mt-8 pt-6 border-t-2">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle2 size={24} className="text-green-600" />
            Adaptive Holding Analysis Results
          </h3>

          {/* Baseline Metrics */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 size={18} />
              Baseline Performance
            </h4>
            <div className="flex flex-wrap gap-3">
              <MetricCard label="Total Return" value={`${report.baseline?.totalReturn?.toFixed(1) || 0}%`} />
              <MetricCard label="Sharpe Ratio" value={`${report.baseline?.sharpeRatio?.toFixed(2) || 0}`} />
              <MetricCard label="Max Drawdown" value={`${(report.baseline?.maxDrawdown * 100)?.toFixed(1) || 0}%`} />
              <MetricCard label="Win Rate" value={`${(report.baseline?.winRate * 100)?.toFixed(1) || 0}%`} />
            </div>
          </div>

          {/* Adaptive Holding Results */}
          {report.adaptiveHolding && (
            <div className="space-y-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-600" />
                Adaptive Holding Results
              </h4>
              <div className="flex flex-wrap gap-3">
                <MetricCard
                  label="Return Improvement"
                  value={`${report.adaptiveHolding.returnImprovement?.toFixed(1) || 0}%`}
                  color="text-green-600"
                />
                <MetricCard
                  label="Sharpe Improvement"
                  value={`${report.adaptiveHolding.sharpeImprovement?.toFixed(2) || 0}`}
                  color="text-green-600"
                />
                <MetricCard
                  label="Drawdown Reduction"
                  value={`${report.adaptiveHolding.drawdownReduction?.toFixed(1) || 0}%`}
                  color="text-green-600"
                />
                <MetricCard
                  label="Win Rate"
                  value={`${(report.adaptiveHolding.winRate * 100)?.toFixed(1) || 0}%`}
                  color="text-green-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-500 mb-1">Avg Holding Days</div>
                  <div className="text-lg font-bold text-blue-600">{report.adaptiveHolding.avgHoldingDays?.toFixed(1) || 0}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-500 mb-1">Institutional Flow</div>
                  <div className="text-lg font-bold text-blue-600">{report.adaptiveHolding.avgInstitutionalFlow?.toFixed(0) || 0}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Flow-Based Results */}
          {report.flowBasedHolding && (
            <div className="space-y-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users size={18} className="text-emerald-600" />
                Flow-Based Holding Results
              </h4>
              <div className="flex flex-wrap gap-3">
                <MetricCard
                  label="Return Improvement"
                  value={`${report.flowBasedHolding.returnImprovement?.toFixed(1) || 0}%`}
                  color="text-green-600"
                />
                <MetricCard
                  label="Sharpe Improvement"
                  value={`${report.flowBasedHolding.sharpeImprovement?.toFixed(2) || 0}`}
                  color="text-green-600"
                />
              </div>
            </div>
          )}

          {/* Holding Period Distribution */}
          {report.holdingProfile && (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <Clock size={18} />
                Holding Period Distribution
              </h4>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      { name: '1-2 days', value: report.holdingProfile.regime1DayCount },
                      { name: '3 days', value: report.holdingProfile.regime3DayCount },
                      { name: '5-9 days', value: report.holdingProfile.regime7DayCount },
                      { name: '10-16 days', value: report.holdingProfile.regime14DayCount },
                      { name: '17-21 days', value: report.holdingProfile.regime21DayCount },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Volatility Profile */}
          {report.holdingProfile?.volatilityProfile && (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <PieChart size={18} />
                Market Volatility Profile
              </h4>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsPI>
                    <Pie
                      data={[
                        { name: 'Low Vol', value: report.holdingProfile.volatilityProfile.low },
                        { name: 'Medium Vol', value: report.holdingProfile.volatilityProfile.medium },
                        { name: 'High Vol', value: report.holdingProfile.volatilityProfile.high },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#3b82f6" />
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip />
                  </RechartsPI>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Combined Results */}
          {report.combined && (
            <div className="space-y-3 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-green-600" />
                Combined Best Strategy Results
              </h4>
              <div className="flex flex-wrap gap-3">
                <MetricCard
                  label="Best Return"
                  value={`${report.combined.totalReturn?.toFixed(1) || 0}%`}
                  color="text-green-700 font-bold"
                />
                <MetricCard
                  label="Total Improvement"
                  value={`${report.combined.returnImprovement?.toFixed(1) || 0}%`}
                  color="text-green-700 font-bold"
                />
                <MetricCard
                  label="New Sharpe"
                  value={`${report.combined.sharpeRatio?.toFixed(2) || 0}`}
                  color="text-green-700 font-bold"
                />
                <MetricCard
                  label="Max Drawdown"
                  value={`${(report.combined.maxDrawdown * 100)?.toFixed(1) || 0}%`}
                  color="text-green-700 font-bold"
                />
              </div>
            </div>
          )}

          {/* Risk Metrics */}
          {report.riskMetrics && (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <AlertCircle size={18} />
                Risk Metrics
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-500 mb-1">Avg Drawdown Recovery</div>
                  <div className="text-lg font-bold text-blue-600">
                    {(report.riskMetrics.avgDrawdownRecovery * 100)?.toFixed(1) || 0}%
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-500 mb-1">Largest Drawdown</div>
                  <div className="text-lg font-bold text-red-600">
                    {(report.riskMetrics.largestDrawdown * 100)?.toFixed(1) || 0}%
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-500 mb-1">Drawdown Duration</div>
                  <div className="text-lg font-bold text-orange-600">{report.riskMetrics.drawdownDuration?.toFixed(0) || 0} days</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Data Message */}
      {!report && !isLoading && (
        <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-lg">
          <Clock size={32} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600">Select strategies and click "Run Adaptive Holding Period Measurement" to see results</p>
        </div>
      )}
    </div>
  );
};

export default AdaptiveHoldingPanel;
