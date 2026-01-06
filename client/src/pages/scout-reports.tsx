/**
 * Scout Reports Hub Page
 * 
 * Central page for browsing and accessing Scout Reports for different symbols.
 * Shows available symbols with badges for high-confidence and new signals.
 */

import React, { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Search, TrendingUp, AlertCircle, Zap, ArrowRight, Plus } from 'lucide-react';

interface ScoutReportMeta {
  symbol: string;
  confidence: number;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  opportunities: number;
  riskScore: number;
  lastUpdated: number;
  isNew?: boolean;
  isHighConfidence?: boolean;
}

export default function ScoutReportsPage() {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'confidence' | 'opportunities' | 'updated' | 'name'>('confidence');

  // Fetch available scout reports
  const { data: reports = [], isLoading, error } = useQuery({
    queryKey: ['scout-reports-list'],
    queryFn: async () => {
      const response = await fetch('/api/scout/list');
      if (!response.ok) throw new Error('Failed to fetch scout reports');
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Filter and sort reports
  const filteredReports = useMemo(() => {
    // Ensure reports is an array
    const reportsArray = Array.isArray(reports) ? reports : [];

    let filtered = reportsArray.filter((report: ScoutReportMeta) =>
      report.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Mark new reports and high-confidence ones
    const now = Date.now();
    filtered = filtered.map((report: ScoutReportMeta) => ({
      ...report,
      isNew: (now - report.lastUpdated) < 3600000, // Less than 1 hour
      isHighConfidence: report.confidence > 0.75,
    }));

    // Sort
    switch (sortBy) {
      case 'confidence':
        return filtered.sort((a: any, b: any) => b.confidence - a.confidence);
      case 'opportunities':
        return filtered.sort((a: any, b: any) => b.opportunities - a.opportunities);
      case 'updated':
        return filtered.sort((a: any, b: any) => b.lastUpdated - a.lastUpdated);
      case 'name':
        return filtered.sort((a: any, b: any) => a.symbol.localeCompare(b.symbol));
      default:
        return filtered;
    }
  }, [reports, searchTerm, sortBy]);

  const directionColor = (direction: string) => {
    switch (direction) {
      case 'BULLISH':
        return 'text-emerald-400 bg-emerald-400/10';
      case 'BEARISH':
        return 'text-red-400 bg-red-400/10';
      case 'NEUTRAL':
        return 'text-amber-400 bg-amber-400/10';
      default:
        return 'text-slate-400 bg-slate-400/10';
    }
  };

  const directionIcon = (direction: string) => {
    switch (direction) {
      case 'BULLISH':
        return '📈';
      case 'BEARISH':
        return '📉';
      case 'NEUTRAL':
        return '➡️';
      default:
        return '❓';
    }
  };

  const highConfidenceBadge = (confidence: number) => {
    if (confidence > 0.85) return '⭐⭐⭐';
    if (confidence > 0.75) return '⭐⭐';
    if (confidence > 0.6) return '⭐';
    return '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 py-8">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Scout Reports Hub</h1>
              <p className="text-slate-400">
                Browse detailed market intelligence and trading opportunities
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-400">{filteredReports.length}</div>
              <div className="text-sm text-slate-400">Reports Available</div>
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search symbols..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Sort */}
            <select
              title="Sort Scout Reports"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="confidence">Sort by Confidence</option>
              <option value="opportunities">Sort by Opportunities</option>
              <option value="updated">Sort by Updated</option>
              <option value="name">Sort by Symbol</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin mb-4">
              <Zap className="w-12 h-12 text-blue-500" />
            </div>
            <p className="text-slate-300">Loading Scout Reports...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-red-300 font-semibold mb-1">Failed to Load Reports</h3>
                <p className="text-red-200 text-sm">
                  {error instanceof Error ? error.message : 'An error occurred while loading Scout Reports'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredReports.length === 0 && (
          <div className="text-center py-12">
            <Zap className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-300 text-lg mb-2">No Scout Reports Available</p>
            <p className="text-slate-500 text-sm mb-6">
              {searchTerm ? 'Try adjusting your search filters' : 'Scout Reports will appear as signals are generated'}
            </p>
          </div>
        )}

        {/* Reports Grid */}
        {!isLoading && filteredReports.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReports.map((report: any) => (
              <div
                key={report.symbol}
                onClick={() => navigate(`/scout-report/${report.symbol}`)}
                className="group cursor-pointer bg-slate-800/50 border border-slate-700/50 rounded-lg p-5 hover:border-blue-500/50 hover:bg-slate-800/80 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10"
              >
                {/* Badges */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex gap-2">
                    {report.isNew && (
                      <span className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs font-semibold rounded">
                        🆕 NEW
                      </span>
                    )}
                    {report.isHighConfidence && (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs font-semibold rounded">
                        ✓ HIGH
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 group-hover:text-blue-400 transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>

                {/* Symbol */}
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-white mb-1">{report.symbol}</h3>
                  <p className="text-slate-400 text-sm">
                    Updated {new Date(report.lastUpdated).toLocaleTimeString()}
                  </p>
                </div>

                {/* Direction & Confidence */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* Direction */}
                  <div className={`p-3 rounded-lg ${directionColor(report.direction)}`}>
                    <div className="text-2xl mb-1">{directionIcon(report.direction)}</div>
                    <div className="text-xs font-semibold uppercase">{report.direction}</div>
                  </div>

                  {/* Confidence */}
                  <div className="p-3 rounded-lg bg-blue-500/10 text-blue-300">
                    <div className="text-2xl font-bold mb-1">
                      {(report.confidence * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs font-semibold uppercase">Confidence</div>
                  </div>
                </div>

                {/* Confidence Stars */}
                {highConfidenceBadge(report.confidence) && (
                  <div className="mb-3 text-lg">{highConfidenceBadge(report.confidence)}</div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="px-2 py-2 bg-slate-700/30 rounded text-center">
                    <div className="text-lg font-bold text-emerald-400">{report.opportunities}</div>
                    <div className="text-xs text-slate-400">Opportunities</div>
                  </div>
                  <div className="px-2 py-2 bg-slate-700/30 rounded text-center">
                    <div className="text-lg font-bold text-orange-400">{report.riskScore.toFixed(0)}</div>
                    <div className="text-xs text-slate-400">Risk Score</div>
                  </div>
                </div>

                {/* View Button */}
                <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors duration-200">
                  View Report →
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer Stats */}
        {!isLoading && reports.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="px-6 py-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
              <p className="text-slate-400 text-sm mb-1">Total Reports</p>
              <p className="text-3xl font-bold text-blue-400">{reports.length}</p>
            </div>
            <div className="px-6 py-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
              <p className="text-slate-400 text-sm mb-1">High Confidence ({'>'}75%)</p>
              <p className="text-3xl font-bold text-emerald-400">
                {reports.filter((r: any) => r.confidence > 0.75).length}
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
              <p className="text-slate-400 text-sm mb-1">Bullish Signals</p>
              <p className="text-3xl font-bold text-emerald-400">
                {reports.filter((r: any) => r.direction === 'BULLISH').length}
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
              <p className="text-slate-400 text-sm mb-1">Total Opportunities</p>
              <p className="text-3xl font-bold text-amber-400">
                {reports.reduce((sum: number, r: any) => sum + r.opportunities, 0)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
