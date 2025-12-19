/**
 * Scout Report Page
 * 
 * Dedicated page for viewing Scout Reports for a specific symbol.
 * Provides full-screen space for ScoutReportViewer with navigation, controls, and export options.
 */

import React, { useState, useCallback } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, RefreshCw, Share2, Settings } from 'lucide-react';
import ScoutReportViewer from '../../components/scout/ScoutReportViewer';

interface ScoutReportPageProps {}

export default function ScoutReportPage({}: ScoutReportPageProps) {
  const { symbol = '' } = useParams<{ symbol?: string }>();
  const [, navigate] = useLocation();
  const [viewMode, setViewMode] = useState<'executive' | 'opportunities' | 'consensus' | 'risk' | 'sources' | 'details'>('executive');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds default

  // Fetch scout report data
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['scout-report', symbol],
    queryFn: async () => {
      const response = await fetch(`/api/scout/report/${symbol}`);
      if (!response.ok) throw new Error('Failed to fetch scout report');
      return response.json();
    },
    enabled: !!symbol,
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 10000,
  });

  // Handle manual refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Handle export
  const handleExport = useCallback(() => {
    if (!data) return;

    const exportData = {
      symbol,
      timestamp: new Date().toISOString(),
      report: data,
      exportedBy: 'Scout Report Viewer',
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scout-report-${symbol}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [data, symbol]);

  // Handle share
  const handleShare = useCallback(() => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: `Scout Report: ${symbol}`,
        text: `Scout report for ${symbol}`,
        url,
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(url);
      alert('Report URL copied to clipboard!');
    }
  }, [symbol]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <RefreshCw className="w-12 h-12 text-blue-500" />
          </div>
          <p className="text-slate-300 text-lg">Loading Scout Report for {symbol}...</p>
          <p className="text-slate-500 text-sm mt-2">This may take a moment</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-2">Report Not Found</h1>
          <p className="text-slate-400 mb-6">
            Could not load Scout Report for <span className="font-semibold text-blue-400">{symbol}</span>
          </p>
          <p className="text-slate-500 text-sm mb-8">
            {error instanceof Error ? error.message : 'No trained model available for this symbol'}
          </p>
          <button
            onClick={() => navigate('/scout-reports')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-slate-900/80 border-b border-slate-700/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="px-6 py-4">
          {/* Top Navigation Bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/scout-reports')}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-200"
                title="Go back"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">Scout Report</h1>
                <p className="text-slate-400 text-sm">
                  <span className="font-semibold text-blue-400">{symbol}</span>
                  {' • '}
                  <span>Last updated {new Date(data.timestamp).toLocaleTimeString()}</span>
                </p>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center gap-2">
              {/* Auto-refresh toggle */}
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <input
                  type="checkbox"
                  id="autoRefresh"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4 cursor-pointer"
                />
                <label htmlFor="autoRefresh" className="text-sm text-slate-300 cursor-pointer">
                  Auto-refresh
                </label>
              </div>

              {/* Manual refresh */}
              <button
                onClick={handleRefresh}
                disabled={isFetching}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-200 disabled:opacity-50"
                title="Refresh report"
              >
                <RefreshCw className={`w-6 h-6 ${isFetching ? 'animate-spin' : ''}`} />
              </button>

              {/* Export */}
              <button
                onClick={handleExport}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-200"
                title="Export as JSON"
              >
                <Download className="w-6 h-6" />
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-200"
                title="Share report"
              >
                <Share2 className="w-6 h-6" />
              </button>

              {/* Settings (view mode selector) */}
              <select
                title="Select view mode"
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as any)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-sm hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <option value="executive">Executive Summary</option>
                <option value="opportunities">Opportunities</option>
                <option value="consensus">Consensus</option>
                <option value="risk">Risk Assessment</option>
                <option value="sources">Sources</option>
                <option value="details">Trade Details</option>
              </select>
            </div>
          </div>

          {/* Report Stats Summary */}
          {data && (
            <div className="grid grid-cols-6 gap-3">
              <div className="px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <p className="text-xs text-slate-500 mb-1">Opportunities</p>
                <p className="text-lg font-bold text-blue-400">
                  {data.opportunities?.length || 0}
                </p>
              </div>
              <div className="px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <p className="text-xs text-slate-500 mb-1">Avg Confidence</p>
                <p className="text-lg font-bold text-emerald-400">
                  {data.consensus?.averageConfidence
                    ? `${(data.consensus.averageConfidence * 100).toFixed(0)}%`
                    : 'N/A'}
                </p>
              </div>
              <div className="px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <p className="text-xs text-slate-500 mb-1">Consensus</p>
                <p className="text-lg font-bold text-purple-400">
                  {data.consensus?.direction || 'N/A'}
                </p>
              </div>
              <div className="px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <p className="text-xs text-slate-500 mb-1">Best Risk/Reward</p>
                <p className="text-lg font-bold text-yellow-400">
                  {data.opportunities?.[0]?.riskReward
                    ? `${data.opportunities[0].riskReward.toFixed(2)}:1`
                    : 'N/A'}
                </p>
              </div>
              <div className="px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <p className="text-xs text-slate-500 mb-1">Sources</p>
                <p className="text-lg font-bold text-cyan-400">
                  {data.sources?.length || 0}
                </p>
              </div>
              <div className="px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <p className="text-xs text-slate-500 mb-1">Signal Strength</p>
                <p className="text-lg font-bold text-orange-400">
                  {data.signalStrength ? `${data.signalStrength}/10` : 'N/A'}
                </p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <ScoutReportViewer 
            symbol={symbol}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/50 border-t border-slate-700/50 px-6 py-3 text-xs text-slate-500">
        <div className="flex items-center justify-between">
          <div>
            Scout Report for <span className="text-slate-300 font-semibold">{symbol}</span>
          </div>
          <div className="text-right">
            {autoRefresh && (
              <span>Auto-refreshing every {(refreshInterval / 1000).toFixed(0)}s</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
