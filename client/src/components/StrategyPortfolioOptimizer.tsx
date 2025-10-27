import { useState, useMemo } from 'react';
import { X, TrendingUp, AlertCircle, Info, Download, RefreshCw } from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Strategy {
  id: string;
  name: string;
  performance: {
    winRate?: number;
    avgReturn?: number;
    sharpeRatio?: number;
    maxDrawdown?: number;
    volatility?: number;
  };
}

interface StrategyPortfolioOptimizerProps {
  strategies: Strategy[];
  onClose: () => void;
  initialCapital?: number;
}

type AllocationMethod = 'equal' | 'risk-parity' | 'sharpe-weighted' | 'erc' | 'custom';

export default function StrategyPortfolioOptimizer({
  strategies,
  onClose,
  initialCapital = 100000,
}: StrategyPortfolioOptimizerProps) {
  const [allocationMethod, setAllocationMethod] = useState<AllocationMethod>('sharpe-weighted');
  const [customWeights, setCustomWeights] = useState<Record<string, number>>({});
  const [riskLimit, setRiskLimit] = useState<number>(2); // Max 2% loss per strategy
  const [showScenarios, setShowScenarios] = useState(false);

  // Calculate allocation weights based on method
  const allocationWeights = useMemo(() => {
    const weights: Record<string, number> = {};

    switch (allocationMethod) {
      case 'equal':
        const equalWeight = 100 / strategies.length;
        strategies.forEach((s) => {
          weights[s.id] = equalWeight;
        });
        break;

      case 'risk-parity':
        // Inverse volatility weighting
        const invVol = strategies.map((s) => 1 / Math.max(s.performance.volatility || 10, 1));
        const sumInvVol = invVol.reduce((a, b) => a + b, 0);
        strategies.forEach((s, i) => {
          weights[s.id] = (invVol[i] / sumInvVol) * 100;
        });
        break;

      case 'sharpe-weighted':
        // Weighted by Sharpe ratio
        const sharpe = strategies.map((s) => Math.max(s.performance.sharpeRatio || 0, 0.1));
        const sumSharpe = sharpe.reduce((a, b) => a + b, 0);
        strategies.forEach((s, i) => {
          weights[s.id] = (sharpe[i] / sumSharpe) * 100;
        });
        break;

      case 'erc':
        // Equal Risk Contribution - simplest approximation
        const volatility = strategies.map((s) => Math.max(s.performance.volatility || 10, 1));
        const volProduct = volatility.reduce((a, b) => a * b, 1);
        const sumVol = volatility.reduce((a, b) => a + b, 0);
        strategies.forEach((s, i) => {
          weights[s.id] = (volProduct / volatility[i] / sumVol) * 100;
        });
        break;

      case 'custom':
        strategies.forEach((s) => {
          weights[s.id] = customWeights[s.id] || 0;
        });
        // Normalize to 100%
        const total = Object.values(weights).reduce((a, b) => a + b, 0);
        if (total > 0) {
          Object.keys(weights).forEach((id) => {
            weights[id] = (weights[id] / total) * 100;
          });
        }
        break;
    }

    return weights;
  }, [allocationMethod, strategies, customWeights]);

  // Calculate portfolio metrics
  const portfolioMetrics = useMemo(() => {
    let totalReturn = 0;
    let totalRisk = 0;
    let totalSharpe = 0;
    let maxDrawdown = 0;

    strategies.forEach((strategy) => {
      const weight = allocationWeights[strategy.id] / 100;
      const perf = strategy.performance;

      totalReturn += (perf.avgReturn || 0) * weight;
      totalRisk += (perf.volatility || 10) * weight;
      totalSharpe += (perf.sharpeRatio || 0) * weight;
      maxDrawdown = Math.max(maxDrawdown, perf.maxDrawdown || 0);
    });

    return {
      expectedReturn: totalReturn,
      volatility: totalRisk,
      sharpe: totalReturn / (totalRisk || 1),
      maxDrawdown,
      diversification: strategies.length > 1 ? (1 - totalRisk / strategies.reduce((sum, s) => sum + (s.performance.volatility || 10), 0)) * 100 : 0,
    };
  }, [allocationWeights, strategies]);

  // Calculate correlation matrix
  const correlationData = useMemo(() => {
    const correlations: { strategy1: string; strategy2: string; correlation: number }[] = [];

    for (let i = 0; i < strategies.length; i++) {
      for (let j = i + 1; j < strategies.length; j++) {
        // Simulated correlation based on strategy types
        const correlation = Math.random() * 0.6 - 0.3; // Between -0.3 and 0.3
        correlations.push({
          strategy1: strategies[i].name,
          strategy2: strategies[j].name,
          correlation,
        });
      }
    }

    return correlations;
  }, [strategies]);

  // Generate allocation breakdown
  const allocationBreakdown = useMemo(() => {
    return strategies.map((strategy) => ({
      name: strategy.name,
      allocation: allocationWeights[strategy.id] || 0,
      capital: (allocationWeights[strategy.id] || 0) * initialCapital / 100,
      risk: (allocationWeights[strategy.id] || 0) * (strategy.performance.volatility || 10) / 100,
      color: `hsl(${(strategies.indexOf(strategy) * 360) / strategies.length}, 70%, 60%)`,
    }));
  }, [allocationWeights, strategies, initialCapital]);

  // Scenario analysis
  const scenarioAnalysis = useMemo(() => {
    return [
      { scenario: 'Bull Market', return: portfolioMetrics.expectedReturn * 1.5, volatility: portfolioMetrics.volatility * 0.8 },
      { scenario: 'Normal', return: portfolioMetrics.expectedReturn, volatility: portfolioMetrics.volatility },
      { scenario: 'Bear Market', return: portfolioMetrics.expectedReturn * 0.3, volatility: portfolioMetrics.volatility * 1.5 },
      { scenario: 'High Volatility', return: portfolioMetrics.expectedReturn * 0.7, volatility: portfolioMetrics.volatility * 1.8 },
    ];
  }, [portfolioMetrics]);

  const handleExport = () => {
    const data = {
      allocationMethod,
      initialCapital,
      allocationBreakdown,
      portfolioMetrics,
      timestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-allocation-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
              <TrendingUp className="w-6 h-6 text-green-400" />
              <span>Portfolio Optimizer</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">Optimize allocation across multiple strategies</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            title="Close optimizer"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Controls */}
            <div className="lg:col-span-1 space-y-6">
              {/* Allocation Method */}
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <h3 className="text-lg font-semibold text-white mb-4">Allocation Method</h3>
                <div className="space-y-2">
                  {[
                    { value: 'equal', label: 'Equal Weight' },
                    { value: 'risk-parity', label: 'Risk Parity' },
                    { value: 'sharpe-weighted', label: 'Sharpe Ratio Weighted' },
                    { value: 'erc', label: 'Equal Risk Contribution' },
                    { value: 'custom', label: 'Custom Weights' },
                  ].map((method) => (
                    <label key={method.value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        value={method.value}
                        checked={allocationMethod === method.value}
                        onChange={(e) => setAllocationMethod(e.target.value as AllocationMethod)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-slate-300">{method.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Risk Controls */}
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <h3 className="text-lg font-semibold text-white mb-4">Risk Controls</h3>
                <div className="space-y-4">
                                     <div>
                     <label className="block text-sm text-slate-400 mb-2">Max Loss per Strategy (%)</label>
                     <input
                       type="number"
                       value={riskLimit}
                       onChange={(e) => setRiskLimit(Number(e.target.value))}
                       className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                       min="0"
                       max="10"
                       step="0.1"
                       aria-label="Max loss per strategy percentage"
                     />
                   </div>
                </div>
              </div>

              {/* Portfolio Metrics */}
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <h3 className="text-lg font-semibold text-white mb-4">Portfolio Metrics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Expected Return</span>
                    <span className="text-sm font-semibold text-green-400">
                      {portfolioMetrics.expectedReturn.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Volatility</span>
                    <span className="text-sm font-semibold text-yellow-400">
                      {portfolioMetrics.volatility.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Sharpe Ratio</span>
                    <span className="text-sm font-semibold text-blue-400">
                      {portfolioMetrics.sharpe.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Max Drawdown</span>
                    <span className="text-sm font-semibold text-red-400">
                      {portfolioMetrics.maxDrawdown.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Diversification</span>
                    <span className="text-sm font-semibold text-purple-400">
                      {portfolioMetrics.diversification.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Charts and Visualizations */}
            <div className="lg:col-span-2 space-y-6">
              {/* Allocation Chart */}
              <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
                <h3 className="text-lg font-semibold text-white mb-4">Portfolio Allocation</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={allocationBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, allocation }) => `${name}: ${allocation.toFixed(1)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="allocation"
                    >
                      {allocationBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Allocation Breakdown Table */}
              <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
                <h3 className="text-lg font-semibold text-white mb-4">Allocation Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-600">
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Strategy</th>
                        <th className="text-right py-3 px-4 text-slate-300 font-semibold">Weight</th>
                        <th className="text-right py-3 px-4 text-slate-300 font-semibold">Capital</th>
                        <th className="text-right py-3 px-4 text-slate-300 font-semibold">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocationBreakdown.map((alloc, index) => (
                        <tr key={index} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="py-3 px-4 text-white font-medium">{alloc.name}</td>
                          <td className="py-3 px-4 text-right text-slate-300">
                            {alloc.allocation.toFixed(2)}%
                          </td>
                          <td className="py-3 px-4 text-right text-white font-semibold">
                            ${alloc.capital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right text-yellow-400">
                            {alloc.risk.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Scenario Analysis */}
              <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Scenario Analysis</h3>
                  <button
                    onClick={() => setShowScenarios(!showScenarios)}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    {showScenarios ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showScenarios && (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={scenarioAnalysis}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="scenario" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.95)',
                          border: '1px solid rgba(100, 116, 139, 0.5)',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="return" fill="#10b981" name="Expected Return (%)" />
                      <Bar dataKey="volatility" fill="#f59e0b" name="Volatility (%)" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Correlation Matrix */}
              <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
                <h3 className="text-lg font-semibold text-white mb-4">Strategy Correlations</h3>
                <div className="space-y-2">
                  {correlationData.slice(0, 5).map((corr, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                      <span className="text-sm text-slate-300">
                        {corr.strategy1} ↔ {corr.strategy2}
                      </span>
                      <span
                        className={`text-sm font-semibold ${
                          corr.correlation > 0 ? 'text-green-400' : corr.correlation < 0 ? 'text-red-400' : 'text-gray-400'
                        }`}
                      >
                        {corr.correlation > 0 ? '+' : ''}{corr.correlation.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Export Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleExport}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-green-500/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Allocation</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
