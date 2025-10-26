import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, Download, Settings } from 'lucide-react';
import PortfolioVisualizer from '../components/PortfolioVisualizer';

// Mock portfolio data - replace with real data from API
const mockPortfolioData = {
  equityCurve: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000),
    value: 10000 + Math.random() * 5000 + i * 100,
  })),
  metrics: {
    totalReturn: 15.2,
    annualizedReturn: 12.8,
    winRate: 68.5,
    avgWin: 245.30,
    avgLoss: -156.80,
    profitFactor: 1.85,
    totalTrades: 156,
    maxDrawdown: -8.2,
    averageDrawdown: -2.1,
    maxDrawdownDuration: 12,
    sharpeRatio: 1.42,
    sortinoRatio: 1.89,
    calmarRatio: 1.56,
    volatility: 18.5,
    kelly: 0.12,
    var95: -2.8,
    cvar95: -4.1,
    consecutiveWins: 8,
    consecutiveLosses: 3,
    largestWin: 1250.00,
    largestLoss: -890.50,
    avgTradeDuration: 4.2,
    monthlyReturns: {
      '2024-01': 2.1,
      '2024-02': -1.2,
      '2024-03': 3.8,
      '2024-04': 1.9,
      '2024-05': 2.7,
    },
    yearlyReturns: {
      '2023': 8.2,
      '2024': 15.2,
    },
  },
  trades: Array.from({ length: 50 }, (_, i) => ({
    id: `trade-${i + 1}`,
    symbol: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'][Math.floor(Math.random() * 3)],
    side: Math.random() > 0.5 ? 'buy' : 'sell',
    entryPrice: 45000 + Math.random() * 10000,
    exitPrice: 45000 + Math.random() * 10000,
    quantity: Math.random() * 10,
    pnl: (Math.random() - 0.3) * 1000,
    duration: Math.random() * 24,
    returnPct: (Math.random() - 0.3) * 20,
  })),
  drawdownPeriods: [
    {
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-01-20'),
      maxDrawdown: -5.2,
      duration: 5,
    },
    {
      startDate: new Date('2024-03-10'),
      endDate: new Date('2024-03-18'),
      maxDrawdown: -8.2,
      duration: 8,
    },
  ],
  monteCarloResults: {
    percentiles: {
      5: 8500,
      25: 12000,
      50: 15000,
      75: 18000,
      95: 22000,
    },
    probabilityOfProfit: 0.72,
    worstCase: 8500,
    bestCase: 22000,
  },
};

export default function PortfolioPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch portfolio data from API
  const { data: portfolioData, isLoading, error, refetch } = useQuery({
    queryKey: ['portfolio-data'],
    queryFn: async () => {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/portfolio-summary');
      // return response.json();
      return mockPortfolioData;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = () => {
    // TODO: Implement portfolio data export
    console.log('Exporting portfolio data...');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading portfolio data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-white mb-2">Error Loading Portfolio</h2>
          <p className="text-slate-400 mb-4">Failed to load portfolio data</p>
          <button
            onClick={() => refetch()}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg transition-all text-white font-semibold shadow-lg shadow-blue-500/20"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      {/* Header */}
      <div className="relative border-b border-slate-800/50 backdrop-blur-xl bg-slate-900/30">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Back Button */}
            <button
              onClick={() => window.history.back()}
              className="flex items-center text-slate-400 hover:text-white transition-all hover:translate-x-[-2px]"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="font-medium">Back</span>
            </button>

            {/* Page Title */}
            <div className="flex-1 text-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Portfolio Performance
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Track your trading performance</p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all text-slate-300 hover:text-white disabled:opacity-50"
                title="Refresh Data"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleExport}
                className="p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all text-slate-300 hover:text-white"
                title="Export Data"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                className="p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all text-slate-300 hover:text-white"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {portfolioData && (
          <PortfolioVisualizer data={portfolioData} />
        )}
      </div>
    </div>
  );
}
