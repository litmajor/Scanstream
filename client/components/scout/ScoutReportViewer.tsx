/**
 * Scout Report Viewer Component
 * 
 * Main orchestrator component for Scout Reports with:
 * - Multiple view modes (executive, sources, opportunities, consensus, risk, full)
 * - Comprehensive filtering (type, confidence, risk/reward, etc)
 * - Real-time data fetching and caching
 * - Error handling and loading states
 * 
 * Usage: <ScoutReportViewer symbol="BTC/USDT" />
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ExecutiveSummarySection from './ExecutiveSummarySection';
import SourceAnalysisPanel from './SourceAnalysisPanel';
import OpportunitiesGrid from './OpportunitiesGrid';
import ConsensusDashboard from './ConsensusDashboard';
import RiskAssessmentPanel from './RiskAssessmentPanel';
import TradeDetailModal from './TradeDetailModal';
import { useScoutReportTrading } from '../../hooks/useScoutReportTrading';
import { formatPrice, formatPct, formatMetric } from '../../utils/formatting';
import type { ScoutReport, TradeOpportunity, TradeType } from '../../types';

interface ScoutReportViewerProps {
  symbol: string;
  onNavigate?: (path: string) => void;
  className?: string;
  autoRefreshInterval?: number; // milliseconds, 0 to disable
}

type ViewMode = 'executive' | 'sources' | 'opportunities' | 'consensus' | 'risk' | 'full';

interface Filters {
  type?: TradeType | 'ALL';
  minConfidence: number;
  minRiskReward: number;
  sortBy: 'riskReward' | 'confidence' | 'probability' | 'quality';
}

export const ScoutReportViewer: React.FC<ScoutReportViewerProps> = ({
  symbol,
  onNavigate,
  className,
  autoRefreshInterval = 300000, // 5 minutes
}) => {
  // Trading hook
  const { executeTrade, validateTrade } = useScoutReportTrading();

  // State
  const [report, setReport] = useState<ScoutReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('full');
  const [filters, setFilters] = useState<Filters>({
    minConfidence: 0,
    minRiskReward: 0,
    sortBy: 'riskReward',
  });
  const [selectedOpportunity, setSelectedOpportunity] = useState<TradeOpportunity | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [executionInProgress, setExecutionInProgress] = useState(false);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);
  const [lastExecutedOrderId, setLastExecutedOrderId] = useState<string | null>(null);

  // Fetch report
  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/scout/${symbol}`);
        if (!response.ok) throw new Error('Failed to fetch scout report');
        const data = await response.json();
        setReport(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();

    // Auto-refresh
    if (autoRefreshInterval > 0) {
      const interval = setInterval(fetchReport, autoRefreshInterval);
      return () => clearInterval(interval);
    }
  }, [symbol, autoRefreshInterval]);

  // Filter and sort opportunities
  const filteredOpportunities = useMemo(() => {
    if (!report?.opportunities) return [];

    let filtered = [...report.opportunities];

    // Filter by type
    if (filters.type && filters.type !== 'ALL') {
      filtered = filtered.filter((opp) => opp.type === filters.type);
    }

    // Filter by confidence
    filtered = filtered.filter((opp) => opp.confidence >= filters.minConfidence);

    // Filter by risk/reward
    filtered = filtered.filter((opp) => opp.riskRewardRatio >= filters.minRiskReward);

    // Sort
    switch (filters.sortBy) {
      case 'riskReward':
        filtered.sort((a, b) => b.riskRewardRatio - a.riskRewardRatio);
        break;
      case 'confidence':
        filtered.sort((a, b) => b.confidence - a.confidence);
        break;
      case 'probability':
        filtered.sort((a, b) => b.probability - a.probability);
        break;
      case 'quality':
        filtered.sort((a, b) => b.qualityScore - a.qualityScore);
        break;
    }

    return filtered;
  }, [report?.opportunities, filters]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Loading Scout Report for {symbol}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border-2 border-red-300 rounded-lg p-6 ${className}`}>
        <h3 className="text-lg font-bold text-red-900 mb-2">Error Loading Report</h3>
        <p className="text-red-800 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!report) {
    return (
      <div className={`bg-gray-50 border-2 border-gray-300 rounded-lg p-6 text-center ${className}`}>
        <p className="text-gray-600">No data available</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-6 border-2 border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{symbol}</h1>
            <p className="text-sm text-gray-600">Scout Report · Last updated {new Date(report.timestamp).toLocaleTimeString()}</p>
          </div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-2 bg-gray-100 p-2 rounded-lg flex-wrap">
        {(['executive', 'sources', 'opportunities', 'consensus', 'risk', 'full'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`
              px-4 py-2 rounded-lg font-semibold transition-colors capitalize
              ${
                viewMode === mode
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            {mode === 'executive'
              ? '📊 Executive'
              : mode === 'sources'
                ? '🔍 Sources'
                : mode === 'opportunities'
                  ? '🎯 Opportunities'
                  : mode === 'consensus'
                    ? '🤝 Consensus'
                    : mode === 'risk'
                      ? '⚠️ Risk'
                      : '📋 Full'}
          </button>
        ))}
      </div>

      {/* Filter Controls (for opportunities view) */}
      {viewMode === 'opportunities' && (
        <div className="bg-white rounded-lg p-4 border-2 border-gray-200 space-y-4">
          <h3 className="font-bold text-gray-800">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Type Filter */}
            <div>
              <label htmlFor="type-filter" className="text-sm font-medium text-gray-700 block mb-2">Trade Type</label>
              <select
                id="type-filter"
                value={filters.type || 'ALL'}
                onChange={(e) => setFilters({ ...filters, type: (e.target.value as any) || 'ALL' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="ALL">All Types</option>
                <option value="SCALP">Scalp</option>
                <option value="DAY">Day Trade</option>
                <option value="SWING">Swing</option>
              </select>
            </div>

            {/* Confidence Filter */}
            <div>
              <label htmlFor="confidence-filter" className="text-sm font-medium text-gray-700 block mb-2">
                Min Confidence: {Math.round(filters.minConfidence * 100)}%
              </label>
              <input
                id="confidence-filter"
                type="range"
                min="0"
                max="100"
                value={filters.minConfidence * 100}
                onChange={(e) => setFilters({ ...filters, minConfidence: parseInt(e.target.value) / 100 })}
                className="w-full"
              />
            </div>

            {/* Risk/Reward Filter */}
            <div>
              <label htmlFor="rr-filter" className="text-sm font-medium text-gray-700 block mb-2">
                Min R:R: {filters.minRiskReward.toFixed(1)}
              </label>
              <input
                id="rr-filter"
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={filters.minRiskReward}
                onChange={(e) => setFilters({ ...filters, minRiskReward: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Sort Filter */}
            <div>
              <label htmlFor="sort-filter" className="text-sm font-medium text-gray-700 block mb-2">Sort By</label>
              <select
                id="sort-filter"
                value={filters.sortBy}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="riskReward">Risk/Reward</option>
                <option value="confidence">Confidence</option>
                <option value="probability">Probability</option>
                <option value="quality">Quality</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Content by View Mode */}
      <div>
        {viewMode === 'executive' && report.executiveSummary && (
          <ExecutiveSummarySection summary={report.executiveSummary} alternatives={report.alternatives} />
        )}

        {viewMode === 'sources' && (
          <SourceAnalysisPanel
            ml={report.sourcesAnalysis?.ml}
            scanner={report.sourcesAnalysis?.scanner}
            agents={report.sourcesAnalysis?.agents}
            priceAction={report.sourcesAnalysis?.priceAction}
          />
        )}

        {viewMode === 'opportunities' && (
          <OpportunitiesGrid
            opportunities={filteredOpportunities}
            onSelectOpportunity={(opp) => {
              setSelectedOpportunity(opp);
              setShowDetailModal(true);
            }}
          />
        )}

        {viewMode === 'consensus' && report.consensus && (
          <ConsensusDashboard consensus={report.consensus} />
        )}

        {viewMode === 'risk' && report.riskAssessment && (
          <RiskAssessmentPanel
            riskAssessment={report.riskAssessment}
            currentPrice={report.sourcesAnalysis?.priceAction?.currentPrice}
          />
        )}

        {viewMode === 'full' && (
          <div className="space-y-6">
            {report.executiveSummary && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Executive Summary</h2>
                <ExecutiveSummarySection summary={report.executiveSummary} alternatives={report.alternatives} />
              </div>
            )}

            {report.opportunities.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Top Opportunities</h2>
                <OpportunitiesGrid
                  opportunities={report.opportunities.slice(0, 3)}
                  onSelectOpportunity={(opp) => {
                    setSelectedOpportunity(opp);
                    setShowDetailModal(true);
                  }}
                />
              </div>
            )}

            {report.consensus && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Consensus Analysis</h2>
                <ConsensusDashboard consensus={report.consensus} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Trade Detail Modal */}
      {selectedOpportunity && (
        <TradeDetailModal
          opportunity={selectedOpportunity}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedOpportunity(null);
            setExecutionMessage(null);
          }}
          onExecute={async (opp, strategy) => {
            // Validate trade first
            const validation = validateTrade(opp, opp.entryZone.low);
            if (!validation.valid) {
              setExecutionMessage(`⚠️ Trade validation failed:\n${validation.errors.join('\n')}`);
              return;
            }

            // Execute trade
            setExecutionInProgress(true);
            setExecutionMessage('📊 Preparing trade execution...');

            const result = await executeTrade(
              {
                symbol,
                opportunity: opp,
                entryStrategy: strategy as 'conservative' | 'optimal' | 'aggressive',
                entryPrice: opp.entryZone.low,
                stopLoss: opp.stopLoss.price,
                target: opp.targets[0]?.level || 0,
              },
              (msg) => setExecutionMessage(`📊 ${msg}`)
            );

            setExecutionInProgress(false);

            if (result.success) {
              setExecutionMessage(`✅ Trade executed!\nOrder ID: ${result.orderId}\nEntry: ${opp.entryZone.low.toFixed(2)}\nStop: ${opp.stopLoss.price.toFixed(2)}`);
              setLastExecutedOrderId(result.orderId || null);
              // keep modal open so user can view confirmation and optionally navigate to orders
            } else {
              setExecutionMessage(`❌ Execution failed: ${result.error || result.message}`);
              setLastExecutedOrderId(null);
            }
          }}
          executionMessage={executionMessage}
          executionInProgress={executionInProgress}
          lastOrderId={lastExecutedOrderId}
        />
      )}

      {/* Footer */}
      <div className="text-xs text-gray-600 text-center pt-4 border-t border-gray-300">
        Scout Report · {report.opportunities.length} opportunities · Generated in {report.generatedIn}ms
      </div>
    </div>
  );
};

export default ScoutReportViewer;
