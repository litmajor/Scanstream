
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, Download, Settings } from 'lucide-react';
import PortfolioVisualizer from '../components/PortfolioVisualizer';

interface PortfolioData {
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
}

export default function PortfolioPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch portfolio data from API
  const { data: portfolioData, isLoading, error, refetch } = useQuery<PortfolioData>({
    queryKey: ['portfolio-data'],
    queryFn: async () => {
      const response = await fetch('/api/portfolio/data');
      if (!response.ok) {
        throw new Error('Failed to fetch portfolio data');
      }
      const data = await response.json();
      
      // Transform dates from strings to Date objects
      return {
        ...data,
        equityCurve: data.equityCurve.map((point: any) => ({
          date: new Date(point.date),
          value: point.value
        })),
        drawdownPeriods: data.drawdownPeriods.map((period: any) => ({
          startDate: new Date(period.startDate),
          endDate: period.endDate ? new Date(period.endDate) : null,
          maxDrawdown: period.maxDrawdown,
          duration: period.duration
        }))
      };
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

  const handleExport = async () => {
    try {
      const response = await fetch('/api/portfolio/export');
      const data = await response.json();
      
      // Create download link
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `portfolio-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export portfolio data:', error);
    }
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
          <p className="text-slate-400 mb-4">{error instanceof Error ? error.message : 'Failed to load portfolio data'}</p>
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
