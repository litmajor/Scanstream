/**
 * Trade Detail Modal Component
 * 
 * Detailed view for a single opportunity with:
 * - Complete trade information
 * - Entry strategies (conservative/optimal/aggressive)
 * - Scale-out plans
 * - Alternative scenarios
 * - Execute trade button (if enabled)
 * 
 * Used in: ScoutReportViewer (via OpportunitiesGrid click)
 */

import React, { useState, useEffect } from 'react';
import DirectionBadge from './DirectionBadge';
import ConfidenceBar from './ConfidenceBar';
import RiskRewardLabel from './RiskRewardLabel';
import SourceIcon from './SourceIcon';
import { formatPrice, formatMetric, formatCurrency, formatPct } from '../../utils/formatting';
import type { TradeOpportunity } from '../../types/scout-report-types';

interface TradeDetailModalProps {
  opportunity: TradeOpportunity;
  onClose: () => void;
  onExecute?: (opportunity: TradeOpportunity, strategy: string) => void;
  isOpen: boolean;
  executionMessage?: string | null;
  executionInProgress?: boolean;
  lastOrderId?: string | null;
}

type EntryStrategy = 'conservative' | 'optimal' | 'aggressive';

export const TradeDetailModal: React.FC<TradeDetailModalProps> = ({
  opportunity,
  onClose,
  onExecute,
  isOpen,
  executionMessage,
  executionInProgress,
  lastOrderId,
}) => {
  const [selectedStrategy, setSelectedStrategy] = useState<EntryStrategy>('optimal');
  const [orderDetails, setOrderDetails] = useState<any | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchOrder = async (id: string) => {
      try {
        setOrderLoading(true);
        const resp = await fetch(`/api/orders/${encodeURIComponent(id)}`);
        if (!resp.ok) throw new Error('Failed to fetch order');
        const body = await resp.json();
        if (!mounted) return;
        // API may return { success, data } wrapper
        const data = body?.data || body;
        setOrderDetails(data);
      } catch (err) {
        setOrderDetails(null);
      } finally {
        if (mounted) setOrderLoading(false);
      }
    };

    if (lastOrderId) {
      fetchOrder(lastOrderId);
    } else {
      setOrderDetails(null);
    }

    return () => { mounted = false };
  }, [lastOrderId]);

  if (!isOpen) return null;

  const strategyDetails = {
    conservative: {
      name: 'Conservative',
      description: 'Enter at top of range for better risk/reward',
      entry: opportunity.entryPrice.max,
      confidence: 'Lower entry confidence',
      bestFor: 'Risk-averse traders',
      color: 'blue',
    },
    optimal: {
      name: 'Optimal',
      description: 'Enter at midpoint of suggested range',
      entry: (opportunity.entryPrice.min + opportunity.entryPrice.max) / 2,
      confidence: 'Balanced entry',
      bestFor: 'Most traders',
      color: 'green',
    },
    aggressive: {
      name: 'Aggressive',
      description: 'Enter at bottom of range for better targets',
      entry: opportunity.entryPrice.min,
      confidence: 'Higher entry confidence needed',
      bestFor: 'Confident traders',
      color: 'orange',
    },
  };

  const strategy = strategyDetails[selectedStrategy];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200 p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <DirectionBadge direction={opportunity.direction} size="lg" />
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{opportunity.type} Opportunity</h2>
              <p className="text-sm text-gray-600">ID: {opportunity.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-2xl font-bold text-gray-500 hover:text-gray-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <div className="text-xs text-blue-600 font-medium mb-1">Confidence</div>
              <div className="text-xl font-bold text-blue-800">{Math.round(opportunity.confidence * 100)}%</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
              <div className="text-xs text-purple-600 font-medium mb-1">Quality</div>
              <div className="text-xl font-bold text-purple-800">{opportunity.qualityScore.toFixed(1)}/10</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <div className="text-xs text-green-600 font-medium mb-1">Probability</div>
              <div className="text-xl font-bold text-green-800">{Math.round(opportunity.probability * 100)}%</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
              <div className="text-xs text-orange-600 font-medium mb-1">Risk/Reward</div>
              <div className="text-lg font-bold text-orange-800">1:{(opportunity.riskRewardRatio).toFixed(2)}</div>
            </div>
          </div>

          {/* Entry Zone */}
          <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
            <h3 className="font-bold text-gray-800 mb-3">Entry Zone</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Min Entry</p>
                <p className="text-2xl font-bold text-gray-800">{opportunity.entryPrice.min.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Max Entry</p>
                <p className="text-2xl font-bold text-gray-800">{opportunity.entryPrice.max.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Entry Strategies */}
          <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
            <h3 className="font-bold text-gray-800 mb-4">Entry Strategy</h3>
            <div className="space-y-3 mb-4">
              {(['conservative', 'optimal', 'aggressive'] as EntryStrategy[]).map((strat) => (
                <button
                  key={strat}
                  onClick={() => setSelectedStrategy(strat)}
                  className={`
                    w-full text-left p-4 rounded-lg border-2 transition-all
                    ${
                      selectedStrategy === strat
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-800">{strategyDetails[strat].name}</p>
                      <p className="text-sm text-gray-600">{strategyDetails[strat].description}</p>
                    </div>
                    <p className="font-bold text-lg text-gray-800">{strategyDetails[strat].entry.toFixed(2)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Strategy Details */}
          <div
            className={`
              rounded-lg p-4 border-2
              ${
                strategy.color === 'blue'
                  ? 'bg-blue-50 border-blue-300'
                  : strategy.color === 'green'
                    ? 'bg-green-50 border-green-300'
                    : 'bg-orange-50 border-orange-300'
              }
            `}
          >
            <p className="text-sm text-gray-700 mb-2">
              <strong>{strategy.name} Strategy:</strong> {strategy.confidence}
            </p>
            <p className="text-sm text-gray-700">
              <strong>Best For:</strong> {strategy.bestFor}
            </p>
          </div>

          {/* Targets */}
          <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
            <h3 className="font-bold text-gray-800 mb-3">Targets</h3>
            <div className="space-y-2">
              {opportunity.targets.map((target: number, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-green-50 rounded border border-green-300">
                  <span className="font-semibold text-gray-800">Target {idx + 1}</span>
                  <span className="text-lg font-bold text-green-600">{target.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stop Loss */}
          <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
            <h3 className="font-bold text-gray-800 mb-3">Stop Loss</h3>
            <div className="bg-red-50 rounded p-3 border border-red-300">
              <span className="text-xs text-red-600 mb-1 block">Recommended SL</span>
              <span className="text-2xl font-bold text-red-800">{opportunity.stopLoss.toFixed(2)}</span>
            </div>
          </div>

          {/* Sources */}
          <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
            <h3 className="font-bold text-gray-800 mb-3">Supporting Sources</h3>
            <div className="flex gap-3 flex-wrap">
              {opportunity.sources?.map((source: any, idx: number) => (
                <SourceIcon key={idx} source={source} size="md" showLabel />
              ))}
            </div>
          </div>

          {/* Description */}
          {opportunity.description && (
            <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
              <h4 className="font-bold text-blue-900 mb-2">Analysis</h4>
              <p className="text-blue-800 text-sm">{opportunity.description}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="sticky bottom-0 bg-gray-50 border-t-2 border-gray-200 p-4 -mx-6 -mb-6 mt-6">
            {/* Execution status */}
            {executionInProgress && (
              <div className="flex items-center gap-3 mb-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600" />
                <div className="text-sm text-gray-700">{executionMessage || 'Executing trade...'}</div>
              </div>
            )}

            {executionMessage && !executionInProgress && (
              <div className="mb-3 p-3 bg-gray-100 rounded text-sm text-gray-800 whitespace-pre-wrap">{executionMessage}</div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-lg hover:bg-gray-400 transition"
              >
                Close
              </button>

              {/* Share button */}
              <button
                onClick={async () => {
                  const shareUrl = window.location.href;
                  const shareText = `Scout Report Opportunity: ${opportunity.type} ${opportunity.direction} - ${Math.round(opportunity.confidence * 100)}% confidence`;
                  if (navigator.share) {
                    try {
                      await navigator.share({ title: `Scout Opportunity - ${opportunity.symbol}`, text: shareText, url: shareUrl });
                    } catch (e) {
                      // ignore
                    }
                  } else {
                    await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
                    alert('Opportunity details copied to clipboard');
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
              >
                Share
              </button>

              {onExecute && (
                <button
                  onClick={() => onExecute(opportunity, selectedStrategy)}
                  className="px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition"
                >
                  Execute Trade →
                </button>
              )}
            </div>

            {/* View confirmation */}
              {lastOrderId && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-slate-600">Order ID</div>
                    <div className="text-sm font-mono text-slate-800">{lastOrderId}</div>
                  </div>

                  {/* Order details fetched live */}
                  {orderLoading && <div className="text-sm text-slate-600">Loading order details...</div>}
                  {orderDetails && (
                    <div className="bg-white p-3 rounded border mt-2 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-slate-500">Status</div>
                        <div className="font-medium">{orderDetails.status || 'N/A'}</div>

                        <div className="text-slate-500">Price</div>
                        <div className="font-medium">{orderDetails.price?.toFixed ? orderDetails.price.toFixed(2) : orderDetails.price || 'N/A'}</div>

                        <div className="text-slate-500">Filled Qty</div>
                        <div className="font-medium">{orderDetails.filledQty ?? orderDetails.filledQuantity ?? 'N/A'}</div>

                        <div className="text-slate-500">Executed At</div>
                        <div className="font-medium">{orderDetails.executedAt ? new Date(orderDetails.executedAt).toLocaleString() : 'N/A'}</div>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 text-right">
                    <a href={`/orders/${encodeURIComponent(lastOrderId)}`} className="text-sm text-blue-600 hover:underline mr-4">Open Order Page</a>
                    <a href={`/trading-terminal?orderId=${encodeURIComponent(lastOrderId)}`} className="text-sm text-slate-500 hover:underline">Open in Trading Terminal</a>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradeDetailModal;
