import React from 'react';
import { TrendingUp, TrendingDown, Activity, Droplets, Grid3x3, Shield } from 'lucide-react';

interface OrderFlow {
  bidVolume?: number;
  askVolume?: number;
  netFlow?: number;
  largeOrders?: number;
  smallOrders?: number;
}

interface MarketMicrostructure {
  spread?: number;
  depth?: number;
  imbalance?: number;
  toxicity?: number;
}

interface FlowMetricsPanelProps {
  orderFlow?: OrderFlow;
  microstructure?: MarketMicrostructure;
  symbol: string;
}

export const FlowMetricsPanel: React.FC<FlowMetricsPanelProps> = ({ 
  orderFlow, 
  microstructure, 
  symbol 
}) => {
  // Calculate derived metrics
  const bidAskRatio = orderFlow?.bidVolume && orderFlow?.askVolume
    ? (orderFlow.bidVolume / (orderFlow.bidVolume + orderFlow.askVolume)) * 100
    : null;
  
  const netFlowRatio = orderFlow?.netFlow && orderFlow?.bidVolume && orderFlow?.askVolume
    ? ((orderFlow.askVolume > 0 ? (orderFlow.netFlow / orderFlow.askVolume) * 100 : 0) + 
       (orderFlow.bidVolume > 0 ? (orderFlow.netFlow / orderFlow.bidVolume) * 100 : 0)) / 2
    : null;

  const largeOrderRatio = orderFlow?.largeOrders && orderFlow?.smallOrders
    ? orderFlow.largeOrders / (orderFlow.smallOrders || 1)
    : null;

  const spreadBps = microstructure?.spread ? microstructure.spread * 10000 : null;

  if (!orderFlow && !microstructure) {
    return null;
  }

  return (
    <div className="mt-3 p-3 bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/50 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-slate-300">Flow Metrics</span>
        </div>
        <div className="flex items-center space-x-1 text-xs text-slate-500">
          <Grid3x3 className="w-3 h-3" />
          <span>Real-time</span>
        </div>
      </div>

      {/* Order Flow Metrics */}
      {orderFlow && (
        <div className="space-y-2 mb-3">
          <div className="grid grid-cols-2 gap-2">
            {/* Bid/Ask Ratio */}
            {bidAskRatio !== null && (
              <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-700/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">Bid/Ask Ratio</span>
                  <TrendingUp className={`w-3 h-3 ${bidAskRatio > 50 ? 'text-green-400' : 'text-red-400'}`} />
                </div>
                <p className="text-sm font-bold text-white">{bidAskRatio.toFixed(1)}%</p>
              </div>
            )}

            {/* Net Flow */}
            {orderFlow.netFlow !== undefined && (
              <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-700/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">Net Flow</span>
                  <Droplets className={`w-3 h-3 ${orderFlow.netFlow >= 0 ? 'text-green-400' : 'text-red-400'}`} />
                </div>
                <p className={`text-sm font-bold ${orderFlow.netFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {orderFlow.netFlow >= 0 ? '+' : ''}{orderFlow.netFlow.toFixed(2)}
                </p>
              </div>
            )}

            {/* Large Orders */}
            {orderFlow.largeOrders !== undefined && (
              <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-700/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">Large Orders</span>
                  <Activity className="w-3 h-3 text-purple-400" />
                </div>
                <p className="text-sm font-bold text-white">{orderFlow.largeOrders.toFixed(0)}</p>
              </div>
            )}

            {/* Large/Small Ratio */}
            {largeOrderRatio !== null && (
              <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-700/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">L/S Ratio</span>
                  <Shield className={`w-3 h-3 ${largeOrderRatio > 0.5 ? 'text-blue-400' : 'text-yellow-400'}`} />
                </div>
                <p className="text-sm font-bold text-white">{largeOrderRatio.toFixed(2)}x</p>
              </div>
            )}
          </div>

          {/* Flow Imbalance Indicator */}
          {netFlowRatio !== null && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">Flow Imbalance</span>
                <span className={`text-xs font-semibold ${
                  Math.abs(netFlowRatio) > 30 ? 'text-red-400' : 
                  Math.abs(netFlowRatio) > 15 ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {Math.abs(netFlowRatio) > 30 ? 'High' : 
                   Math.abs(netFlowRatio) > 15 ? 'Moderate' : 'Low'}
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${netFlowRatio >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(Math.abs(netFlowRatio), 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Market Microstructure */}
      {microstructure && (
        <div className="pt-3 border-t border-slate-700/30">
          <div className="flex items-center space-x-1 mb-2">
            <Shield className="w-3 h-3 text-purple-400" />
            <span className="text-xs font-semibold text-slate-300">Market Microstructure</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {/* Spread */}
            {microstructure.spread !== undefined && spreadBps !== null && (
              <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-700/30">
                <span className="text-xs text-slate-400">Spread</span>
                <p className="text-sm font-bold text-white">{spreadBps.toFixed(2)} bps</p>
              </div>
            )}

            {/* Depth */}
            {microstructure.depth !== undefined && (
              <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-700/30">
                <span className="text-xs text-slate-400">Depth</span>
                <p className="text-sm font-bold text-white">{microstructure.depth.toFixed(0)}</p>
              </div>
            )}

            {/* Imbalance */}
            {microstructure.imbalance !== undefined && (
              <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-700/30">
                <span className="text-xs text-slate-400">Imbalance</span>
                <p className={`text-sm font-bold ${Math.abs(microstructure.imbalance) > 0.5 ? 'text-red-400' : 'text-yellow-400'}`}>
                  {microstructure.imbalance.toFixed(2)}
                </p>
              </div>
            )}

            {/* Toxicity */}
            {microstructure.toxicity !== undefined && (
              <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-700/30">
                <span className="text-xs text-slate-400">Toxicity</span>
                <p className={`text-sm font-bold ${
                  microstructure.toxicity > 0.7 ? 'text-red-400' : 
                  microstructure.toxicity > 0.4 ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {microstructure.toxicity.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Stats Summary */}
      {(bidAskRatio !== null || netFlowRatio !== null) && (
        <div className="mt-3 p-2 bg-blue-500/10 rounded border border-blue-500/20">
          <div className="flex items-center space-x-2">
            <Activity className="w-3 h-3 text-blue-400" />
            <div className="flex-1">
              <p className="text-xs text-slate-300 font-medium">
                {bidAskRatio !== null && bidAskRatio > 60 && 'Strong buy pressure'}
                {bidAskRatio !== null && bidAskRatio < 40 && 'Strong sell pressure'}
                {bidAskRatio !== null && bidAskRatio >= 40 && bidAskRatio <= 60 && 'Balanced flow'}
                {bidAskRatio === null && netFlowRatio !== null && netFlowRatio > 15 && 'Strong buying flow'}
                {bidAskRatio === null && netFlowRatio !== null && netFlowRatio < -15 && 'Strong selling flow'}
                {bidAskRatio === null && netFlowRatio !== null && Math.abs(netFlowRatio) <= 15 && 'Neutral flow'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowMetricsPanel;
