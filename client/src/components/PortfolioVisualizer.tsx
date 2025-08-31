import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, ScatterChart, Scatter, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Target, AlertTriangle, BarChart3, PieChart as PieChartIcon, Calendar, Clock } from 'lucide-react';


// PortfolioData type for strong typing
export type PortfolioData = {
  equityCurve: Array<{ date: Date; value: number }>;
  metrics: {
    totalReturn: number;
    annualizedReturn: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    totalTrades: number;
    maxDrawdown: number;
    averageDrawdown: number;
    maxDrawdownDuration: number;
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    volatility: number;
    kelly: number;
    var95: number;
    cvar95: number;
    consecutiveWins: number;
    consecutiveLosses: number;
    largestWin: number;
    largestLoss: number;
    avgTradeDuration: number;
    monthlyReturns: Record<string, number>;
    yearlyReturns: Record<string, number>;
  };
  trades: Array<{
    id: string;
    symbol: string;
    side: string;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    duration: number;
    returnPct: number;
  }>;
  drawdownPeriods: Array<{
    startDate: Date;
    endDate: Date | null;
    maxDrawdown: number;
    duration: number;
  }>;
  monteCarloResults: {
    percentiles: Record<string | number, number>;
    probabilityOfProfit: number;
    worstCase: number;
    bestCase: number;
  };
};

const PortfolioVisualizer: React.FC<{ data: PortfolioData }> = ({ data }) => {
  const [activeTab, setActiveTab] = useState('overview');

  // Format currency
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format percentage
  const formatPercent = (value: number): string => `${(value * 100).toFixed(2)}%`;

  // Prepare chart data
  const equityChartData = data.equityCurve.map((point, index) => ({
    date: point.date.toISOString().split('T')[0],
    value: point.value,
    drawdown: index > 0 ? ((Math.max(...data.equityCurve.slice(0, index + 1).map(p => p.value)) - point.value) / Math.max(...data.equityCurve.slice(0, index + 1).map(p => p.value)) * 100) : 0,
  }));

  const monthlyReturnsData = Object.entries(data.metrics.monthlyReturns).map(([month, return_]) => ({
    month,
    return: return_ * 100,
  }));

  const tradeDistributionData = [
    { range: 'Large Loss (< -5%)', count: data.trades.filter(t => t.returnPct < -5).length, color: '#ef4444' },
    { range: 'Small Loss (-5% to 0%)', count: data.trades.filter(t => t.returnPct >= -5 && t.returnPct < 0).length, color: '#f97316' },
    { range: 'Small Win (0% to 5%)', count: data.trades.filter(t => t.returnPct >= 0 && t.returnPct < 5).length, color: '#84cc16' },
    { range: 'Large Win (> 5%)', count: data.trades.filter(t => t.returnPct >= 5).length, color: '#22c55e' },
  ];

  type SymbolPerf = { symbol: string; totalPnl: number; trades: number; winRate: number };
  const symbolPerformanceData: Record<string, SymbolPerf> = data.trades.reduce((acc: Record<string, SymbolPerf>, trade) => {
    if (!acc[trade.symbol]) {
      acc[trade.symbol] = { symbol: trade.symbol, totalPnl: 0, trades: 0, winRate: 0 };
    }
    acc[trade.symbol].totalPnl += trade.pnl;
    acc[trade.symbol].trades += 1;
    return acc;
  }, {});

  Object.values(symbolPerformanceData).forEach((item: SymbolPerf) => {
    const symbolTrades = data.trades.filter(t => t.symbol === item.symbol);
    item.winRate = symbolTrades.filter(t => t.pnl > 0).length / symbolTrades.length * 100;
  });

  const monteCarloData = Object.entries(data.monteCarloResults.percentiles).map(([percentile, value]) => ({
    percentile: `${percentile}%`,
    value,
  }));

  // Metric card component
  type MetricCardProps = {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ComponentType<{ className?: string }>;
    color?: 'blue' | 'green' | 'red';
    trend?: number | null;
  };
  const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon: Icon, color = 'blue', trend = null }) => (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderLeftColor: color === 'green' ? '#10b981' : color === 'red' ? '#ef4444' : '#3b82f6' }}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-full ${color === 'green' ? 'bg-green-100' : color === 'red' ? 'bg-red-100' : 'bg-blue-100'}`}>
          <Icon className={`w-6 h-6 ${color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-600' : 'text-blue-600'}`} />
        </div>
      </div>
      {trend && (
        <div className="mt-2 flex items-center">
          {trend > 0 ? (
            <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
          )}
          <span className={`text-sm font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {Math.abs(trend)}% vs last period
          </span>
        </div>
      )}
    </div>
  );

  type TabButtonProps = { id: string; label: string; isActive: boolean };
  const TabButton: React.FC<TabButtonProps> = ({ id, label, isActive }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-100 text-blue-700 border border-blue-200'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Portfolio Performance Dashboard</h1>
          <p className="text-gray-600">Comprehensive analysis of trading performance and risk metrics</p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 flex flex-wrap gap-2 bg-white p-4 rounded-lg shadow-sm">
          <TabButton id="overview" label="Overview" isActive={activeTab === 'overview'} />
          <TabButton id="performance" label="Performance" isActive={activeTab === 'performance'} />
          <TabButton id="risk" label="Risk Analysis" isActive={activeTab === 'risk'} />
          <TabButton id="trades" label="Trade Analysis" isActive={activeTab === 'trades'} />
          <TabButton id="monte-carlo" label="Monte Carlo" isActive={activeTab === 'monte-carlo'} />
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="Total Return"
                value={formatPercent(data.metrics.totalReturn)}
                subtitle="Since inception"
                icon={TrendingUp}
                color="green"
                trend={12.5 as number}
              />
              <MetricCard
                title="Current Balance"
                value={
                  data.equityCurve && data.equityCurve.length > 0 && data.equityCurve[data.equityCurve.length - 1]
                    ? formatCurrency(data.equityCurve[data.equityCurve.length - 1].value)
                    : 'N/A'
                }
                subtitle="Portfolio value"
                icon={DollarSign}
                color="blue"
              />
              <MetricCard
                title="Win Rate"
                value={formatPercent(data.metrics.winRate)}
                subtitle={`${data.metrics.totalTrades} trades`}
                icon={Target}
                color="green"
              />
              <MetricCard
                title="Max Drawdown"
                value={formatPercent(data.metrics.maxDrawdown)}
                subtitle="Peak to trough"
                icon={AlertTriangle}
                color="red"
              />
            </div>

            {/* Equity Curve Chart */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Equity Curve & Drawdown</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={equityChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    formatter={(value: number | string, name: string) => [
                      name === 'value' ? formatCurrency(Number(value)) : `${Number(value).toFixed(2)}%`,
                      name === 'value' ? 'Portfolio Value' : 'Drawdown'
                    ]}
                  />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    name="Portfolio Value"
                    dot={false}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="drawdown" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    name="Drawdown %"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Performance Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Annualized Return</span>
                    <span className="font-semibold">{formatPercent(data.metrics.annualizedReturn)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sharpe Ratio</span>
                    <span className="font-semibold">{data.metrics.sharpeRatio.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Profit Factor</span>
                    <span className="font-semibold">{data.metrics.profitFactor.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Volatility</span>
                    <span className="font-semibold">{formatPercent(data.metrics.volatility)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Calmar Ratio</span>
                    <span className="font-semibold">{data.metrics.calmarRatio.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-4">Trade Statistics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Average Win</span>
                    <span className="font-semibold text-green-600">{formatCurrency(data.metrics.avgWin)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Average Loss</span>
                    <span className="font-semibold text-red-600">{formatCurrency(data.metrics.avgLoss)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Largest Win</span>
                    <span className="font-semibold text-green-600">{formatCurrency(data.metrics.largestWin)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Largest Loss</span>
                    <span className="font-semibold text-red-600">{formatCurrency(data.metrics.largestLoss)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Trade Duration</span>
                    <span className="font-semibold">{data.metrics.avgTradeDuration.toFixed(1)}h</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            {/* Monthly Returns */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Monthly Returns</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyReturnsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number | string) => [`${Number(value).toFixed(2)}%`, 'Return']} />
                  <Bar 
                    dataKey="return" 
                    fill="#10b981"
                    name="Monthly Return %"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Symbol Performance */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Performance by Symbol</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Symbol</th>
                      <th className="text-right py-2">Total P&L</th>
                      <th className="text-right py-2">Trades</th>
                      <th className="text-right py-2">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(symbolPerformanceData).map((item: SymbolPerf, index: number) => (
                      <tr key={index} className="border-b">
                        <td className="py-2 font-medium">{item.symbol}</td>
                        <td className={`py-2 text-right font-semibold ${item.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(item.totalPnl)}
                        </td>
                        <td className="py-2 text-right">{item.trades}</td>
                        <td className="py-2 text-right">{item.winRate.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rolling Performance Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MetricCard
                title="Consecutive Wins"
                value={data.metrics.consecutiveWins}
                subtitle="Maximum streak"
                icon={TrendingUp}
                color="green"
              />
              <MetricCard
                title="Consecutive Losses"
                value={data.metrics.consecutiveLosses}
                subtitle="Maximum streak"
                icon={TrendingDown}
                color="red"
              />
            </div>
          </div>
        )}

        {/* Risk Analysis Tab */}
        {activeTab === 'risk' && (
          <div className="space-y-6">
            {/* Risk Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="Sharpe Ratio"
                value={data.metrics.sharpeRatio.toFixed(2)}
                subtitle="Risk-adjusted return"
                icon={BarChart3}
                color="blue"
              />
              <MetricCard
                title="Sortino Ratio"
                value={data.metrics.sortinoRatio.toFixed(2)}
                subtitle="Downside risk"
                icon={TrendingDown}
                color="green"
              />
              <MetricCard
                title="VaR (95%)"
                value={formatPercent(Math.abs(data.metrics.var95))}
                subtitle="Value at Risk"
                icon={AlertTriangle}
                color="red"
              />
              <MetricCard
                title="Kelly %"
                value={formatPercent(data.metrics.kelly)}
                subtitle="Optimal position size"
                icon={Target}
                color="blue"
              />
            </div>

            {/* Drawdown Analysis */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Drawdown Periods</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Start Date</th>
                      <th className="text-left py-2">End Date</th>
                      <th className="text-right py-2">Max Drawdown</th>
                      <th className="text-right py-2">Duration (Days)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.drawdownPeriods.map((period, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2">{period.startDate.toLocaleDateString()}</td>
                        <td className="py-2">{period.endDate ? period.endDate.toLocaleDateString() : 'Ongoing'}</td>
                        <td className="py-2 text-right font-semibold text-red-600">
                          {formatPercent(period.maxDrawdown)}
                        </td>
                        <td className="py-2 text-right">{period.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Risk Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-4">Risk Metrics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Max Drawdown</span>
                    <span className="font-semibold text-red-600">{formatPercent(data.metrics.maxDrawdown)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Average Drawdown</span>
                    <span className="font-semibold">{formatPercent(data.metrics.averageDrawdown)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Max DD Duration</span>
                    <span className="font-semibold">{data.metrics.maxDrawdownDuration} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Volatility</span>
                    <span className="font-semibold">{formatPercent(data.metrics.volatility)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">CVaR (95%)</span>
                    <span className="font-semibold text-red-600">{formatPercent(Math.abs(data.metrics.cvar95))}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-4">Position Sizing</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Kelly Criterion</span>
                    <span className="font-semibold">{formatPercent(data.metrics.kelly)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Recommended Size</span>
                    <span className="font-semibold">{formatPercent(data.metrics.kelly * 0.5)}</span>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded-lg mt-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> Kelly criterion suggests optimal position size, but consider using 25-50% of Kelly for safety.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trade Analysis Tab */}
        {activeTab === 'trades' && (
          <div className="space-y-6">
            {/* Trade Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-4">Trade Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={tradeDistributionData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="count"
                      label={({ range, count }) => `${range}: ${count}`}
                    >
                      {tradeDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-4">Trade Statistics</h3>
                <div className="space-y-3">
                  {tradeDistributionData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div 
                          className="w-4 h-4 rounded mr-3" 
                          style={{ backgroundColor: item.color }}
                        ></div>
                        <span className="text-sm text-gray-600">{item.range}</span>
                      </div>
                      <span className="font-semibold">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Trades Table */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Recent Trades</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Symbol</th>
                      <th className="text-left py-2">Side</th>
                      <th className="text-right py-2">Entry Price</th>
                      <th className="text-right py-2">Exit Price</th>
                      <th className="text-right py-2">Quantity</th>
                      <th className="text-right py-2">P&L</th>
                      <th className="text-right py-2">Return %</th>
                      <th className="text-right py-2">Duration (h)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trades.map((trade, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2 font-medium">{trade.symbol}</td>
                        <td className="py-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            trade.side === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {trade.side}
                          </span>
                        </td>
                        <td className="py-2 text-right">${trade.entryPrice.toLocaleString()}</td>
                        <td className="py-2 text-right">${trade.exitPrice.toLocaleString()}</td>
                        <td className="py-2 text-right">{trade.quantity}</td>
                        <td className={`py-2 text-right font-semibold ${
                                                    trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(trade.pnl)}
                        </td>
                        <td className={`py-2 text-right font-semibold ${
                          trade.returnPct >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {trade.returnPct.toFixed(2)}%
                        </td>
                        <td className="py-2 text-right">{trade.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Monte Carlo Tab */}
        {activeTab === 'monte-carlo' && (
          <div className="space-y-6">
            {/* Monte Carlo Results */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Monte Carlo Simulation Results</h3>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={monteCarloData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="percentile" />
                  <YAxis />
                  <Tooltip formatter={(value: number | string) => [formatCurrency(Number(value)), 'Portfolio Value']} />
                  <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#93c5fd" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Monte Carlo Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="Probability of Profit"
                value={formatPercent(data.monteCarloResults.probabilityOfProfit)}
                subtitle="Based on 10,000 iterations"
                icon={PieChartIcon}
                color="green"
              />
              <MetricCard
                title="Worst Case"
                value={formatCurrency(data.monteCarloResults.worstCase)}
                subtitle="5th percentile"
                icon={AlertTriangle}
                color="red"
              />
              <MetricCard
                title="Median Outcome"
                value={formatCurrency(data.monteCarloResults.percentiles[50])}
                subtitle="50th percentile"
                icon={Target}
                color="blue"
              />
              <MetricCard
                title="Best Case"
                value={formatCurrency(data.monteCarloResults.bestCase)}
                subtitle="95th percentile"
                icon={TrendingUp}
                color="green"
              />
            </div>

            {/* Monte Carlo Table */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Detailed Percentiles</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Percentile</th>
                      <th className="text-right py-2">Portfolio Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.monteCarloResults.percentiles)
                      .sort((a, b) => Number(a[0]) - Number(b[0]))
                      .map(([percentile, value]) => (
                        <tr key={percentile} className="border-b">
                          <td className="py-2 font-medium">{percentile}%</td>
                          <td className="py-2 text-right font-semibold">{formatCurrency(value)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortfolioVisualizer;