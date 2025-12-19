/**
 * Capability Measurement Panel
 * 
 * UI component to visualize and configure Phase 1 capability measurements
 * - Cluster Validation
 * - Position Sizing
 * - Voting Methods
 * 
 * Integrated with agent/strategy selection
 */

import React, { useState } from 'react';
import { BarChart3, CheckCircle, AlertCircle, TrendingUp, Zap, Settings, Download, Play } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';

interface CapabilityMetrics {
  returnImprovement: number;
  sharpeImprovement: number;
  drawdownReduction: number;
  winRateImprovement: number;
  tradesAffected?: number;
}

interface VotingMethodMetrics {
  method: string;
  return: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  improvement: number;
}

interface CapabilityMeasurementReport {
  baseline: {
    return: number;
    winRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
    trades: number;
  };
  clusterValidation?: {
    metrics: CapabilityMetrics;
    skipped: number;
  };
  positionSizing?: {
    metrics: CapabilityMetrics;
    avgMultiplier: number;
  };
  votingComparison?: {
    methods: VotingMethodMetrics[];
    best: string;
  };
  combined?: {
    metrics: CapabilityMetrics;
  };
}

interface CapabilityMeasurementPanelProps {
  selectedAgents?: string[];
  selectedStrategies?: string[];
  onAgentChange?: (agents: string[]) => void;
  onStrategyChange?: (strategies: string[]) => void;
  onMeasure?: (config: any) => void;
  isLoading?: boolean;
  report?: CapabilityMeasurementReport;
}

const AVAILABLE_AGENTS = [
  { id: 'ml', name: 'ML Pipeline', enabled: true },
  { id: 'scanner', name: 'Pattern Scanner', enabled: true },
  { id: 'rl', name: 'RL Agent', enabled: true },
  { id: 'rpg', name: 'RPG Agent', enabled: true }
];

const AVAILABLE_STRATEGIES = [
  { id: 'momentum', name: 'Momentum', enabled: true },
  { id: 'mean-reversion', name: 'Mean Reversion', enabled: true },
  { id: 'breakout', name: 'Breakout', enabled: true },
  { id: 'grid', name: 'Grid Trading', enabled: true },
  { id: 'channel', name: 'Channel Trading', enabled: true }
];

export default function CapabilityMeasurementPanel({
  selectedAgents = ['ml', 'scanner', 'rl'],
  selectedStrategies = ['momentum', 'mean-reversion'],
  onAgentChange,
  onStrategyChange,
  onMeasure,
  isLoading = false,
  report
}: CapabilityMeasurementPanelProps) {
  const [localAgents, setLocalAgents] = useState(selectedAgents);
  const [localStrategies, setLocalStrategies] = useState(selectedStrategies);
  const [enableCluster, setEnableCluster] = useState(true);
  const [enableSizing, setEnableSizing] = useState(true);
  const [enableVoting, setEnableVoting] = useState(true);
  const [showResults, setShowResults] = useState(false);

  const handleAgentToggle = (agentId: string) => {
    const updated = localAgents.includes(agentId)
      ? localAgents.filter(a => a !== agentId)
      : [...localAgents, agentId];
    setLocalAgents(updated);
    onAgentChange?.(updated);
  };

  const handleStrategyToggle = (strategyId: string) => {
    const updated = localStrategies.includes(strategyId)
      ? localStrategies.filter(s => s !== strategyId)
      : [...localStrategies, strategyId];
    setLocalStrategies(updated);
    onStrategyChange?.(updated);
  };

  const handleMeasure = () => {
    onMeasure?.({
      agents: localAgents,
      strategies: localStrategies,
      capabilities: {
        enableClusterValidation: enableCluster,
        enablePositionSizing: enableSizing,
        enableVotingComparison: enableVoting
      }
    });
    setShowResults(true);
  };

  const improvementColor = (value: number) => {
    if (value > 30) return 'text-green-600';
    if (value > 15) return 'text-emerald-600';
    if (value > 0) return 'text-teal-600';
    return 'text-orange-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Zap className="w-6 h-6 text-amber-500" />
        <div>
          <h2 className="text-2xl font-bold">Capability Measurement</h2>
          <p className="text-sm text-gray-500">Measure impact of cluster validation, position sizing, and voting methods</p>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agents Selection */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Agents to Test
          </h3>
          <div className="space-y-2">
            {AVAILABLE_AGENTS.map(agent => (
              <label key={agent.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localAgents.includes(agent.id)}
                  onChange={() => handleAgentToggle(agent.id)}
                  className="rounded w-4 h-4"
                />
                <span className="text-sm">{agent.name}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Selected: {localAgents.length}/{AVAILABLE_AGENTS.length} agents
          </p>
        </div>

        {/* Strategies Selection */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Strategies to Test
          </h3>
          <div className="space-y-2">
            {AVAILABLE_STRATEGIES.map(strategy => (
              <label key={strategy.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localStrategies.includes(strategy.id)}
                  onChange={() => handleStrategyToggle(strategy.id)}
                  className="rounded w-4 h-4"
                />
                <span className="text-sm">{strategy.name}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Selected: {localStrategies.length}/{AVAILABLE_STRATEGIES.length} strategies
          </p>
        </div>

        {/* Capabilities Selection */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Capabilities to Measure
          </h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableCluster}
                onChange={(e) => setEnableCluster(e.target.checked)}
                className="rounded w-4 h-4"
              />
              <span className="text-sm">Cluster Validation</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableSizing}
                onChange={(e) => setEnableSizing(e.target.checked)}
                className="rounded w-4 h-4"
              />
              <span className="text-sm">Position Sizing</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableVoting}
                onChange={(e) => setEnableVoting(e.target.checked)}
                className="rounded w-4 h-4"
              />
              <span className="text-sm">Voting Methods</span>
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {[enableCluster, enableSizing, enableVoting].filter(Boolean).length}/3 enabled
          </p>
        </div>
      </div>

      {/* Measure Button */}
      <button
        onClick={handleMeasure}
        disabled={isLoading || localAgents.length === 0 || localStrategies.length === 0}
        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold py-3 rounded-lg hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Play className="w-4 h-4" />
        {isLoading ? 'Measuring Impact...' : 'Run Capability Measurement'}
      </button>

      {/* Results Display */}
      {report && showResults && (
        <div className="space-y-6 mt-8">
          {/* Baseline Metrics */}
          <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg p-6 border border-gray-200">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-gray-600" />
              Baseline Performance (No Enhancements)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                label="Return"
                value={`${report.baseline.return.toFixed(2)}%`}
                subtext={`${report.baseline.trades} trades`}
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

          {/* Cluster Validation Results */}
          {report.clusterValidation && (
            <CapabilityResultCard
              title="Cluster Validation Impact"
              description="Filters signals by cluster quality, improving entry accuracy"
              metrics={report.clusterValidation.metrics}
              extraInfo={`${report.clusterValidation.skipped} trades skipped (low quality)`}
            />
          )}

          {/* Position Sizing Results */}
          {report.positionSizing && (
            <CapabilityResultCard
              title="Position Sizing Impact"
              description="Dynamic position sizes based on cluster conviction (0.5x-2.0x)"
              metrics={report.positionSizing.metrics}
              extraInfo={`Average multiplier: ${report.positionSizing.avgMultiplier.toFixed(2)}x`}
            />
          )}

          {/* Voting Comparison Results */}
          {report.votingComparison && (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Voting Method Comparison
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2">Method</th>
                      <th className="text-right py-2 px-2">Return</th>
                      <th className="text-right py-2 px-2">Win Rate</th>
                      <th className="text-right py-2 px-2">Sharpe</th>
                      <th className="text-right py-2 px-2">Improvement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.votingComparison.methods.map(method => (
                      <tr
                        key={method.method}
                        className={`border-b border-gray-100 ${
                          method.method === report.votingComparison.best ? 'bg-green-50' : ''
                        }`}
                      >
                        <td className="py-2 px-2 font-medium">{method.method}</td>
                        <td className="text-right py-2 px-2">{method.return.toFixed(2)}%</td>
                        <td className="text-right py-2 px-2">{(method.winRate * 100).toFixed(1)}%</td>
                        <td className="text-right py-2 px-2">{method.sharpeRatio.toFixed(2)}</td>
                        <td className={`text-right py-2 px-2 font-semibold ${improvementColor(method.improvement)}`}>
                          +{method.improvement.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Combined Impact */}
          {report.combined && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border-2 border-green-300">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Combined Impact (All Capabilities Enabled)
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
            Export Report
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

interface CapabilityResultCardProps {
  title: string;
  description: string;
  metrics: CapabilityMetrics;
  extraInfo?: string;
}

function CapabilityResultCard({ title, description, metrics, extraInfo }: CapabilityResultCardProps) {
  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <MetricCard
          label="Return Improvement"
          value={`+${metrics.returnImprovement.toFixed(1)}%`}
        />
        <MetricCard
          label="Sharpe Improvement"
          value={`+${metrics.sharpeImprovement.toFixed(1)}%`}
        />
        <MetricCard
          label="Drawdown Reduction"
          value={`${metrics.drawdownReduction.toFixed(1)}%`}
        />
        <MetricCard
          label="Win Rate Improvement"
          value={`+${metrics.winRateImprovement.toFixed(1)}%`}
        />
      </div>

      {extraInfo && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded p-2 border-l-4 border-blue-500">
          {extraInfo}
        </p>
      )}
    </div>
  );
}
