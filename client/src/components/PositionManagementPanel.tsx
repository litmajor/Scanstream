import { useMemo, useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  X,
  Eye,
  EyeOff,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Clock,
  CheckCircle
} from 'lucide-react';

export interface Position {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  entry_price: number;
  current_price: number;
  size: number;
  entry_time: string;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
  status: 'open' | 'closing' | 'closed';
}

export interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  order_type: 'market' | 'limit';
  price: number;
  size: number;
  filled: number;
  status: 'pending' | 'partial' | 'filled' | 'cancelled';
  created_at: string;
  stop_loss?: number;
  take_profit?: number;
}

export interface Trade {
  id: string;
  symbol: string;
  entry_price: number;
  exit_price: number;
  size: number;
  side: 'buy' | 'sell';
  entry_time: string;
  exit_time: string;
  realized_pnl: number;
  realized_pnl_percent: number;
  duration: string;
}

interface PositionManagementPanelProps {
  positions?: Position[];
  orders?: Order[];
  trades?: Trade[];
  onClosePosition?: (positionId: string) => void;
  onCancelOrder?: (orderId: string) => void;
}

export default function PositionManagementPanel({
  positions = [],
  orders = [],
  trades = [],
  onClosePosition,
  onCancelOrder,
}: PositionManagementPanelProps) {
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history'>('positions');
  const [showDetails, setShowDetails] = useState<string | null>(null);

  // Calculate portfolio metrics
  const metrics = useMemo(() => {
    const totalUnrealizedPnL = positions.reduce((sum, p) => sum + p.unrealized_pnl, 0);
    const totalRealizedPnL = trades.reduce((sum, t) => sum + t.realized_pnl, 0);
    const totalPnL = totalUnrealizedPnL + totalRealizedPnL;
    
    const totalPositionValue = positions.reduce(
      (sum, p) => sum + (p.current_price * p.size),
      0
    );

    const winningPositions = positions.filter(p => p.unrealized_pnl > 0).length;
    const losingPositions = positions.filter(p => p.unrealized_pnl < 0).length;
    const totalOpenPositions = positions.filter(p => p.status === 'open').length;

    const winningTrades = trades.filter(t => t.realized_pnl > 0).length;
    const totalTrades = trades.length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    return {
      totalUnrealizedPnL,
      totalRealizedPnL,
      totalPnL,
      totalPositionValue,
      winningPositions,
      losingPositions,
      totalOpenPositions,
      winRate,
    };
  }, [positions, trades]);

  return (
    <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 rounded-lg border border-slate-700/50 p-4 space-y-4">
      {/* Header with Summary Metrics */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          <span>Position Management</span>
        </h3>

        {/* Quick Metrics */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-900/50 rounded p-2 border border-slate-700/30">
            <div className="text-xs text-slate-400">Total P&L</div>
            <div className={`text-sm font-bold ${metrics.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${metrics.totalPnL.toFixed(2)}
            </div>
          </div>
          <div className="bg-slate-900/50 rounded p-2 border border-slate-700/30">
            <div className="text-xs text-slate-400">Open Positions</div>
            <div className="text-sm font-bold text-white">{metrics.totalOpenPositions}</div>
          </div>
          <div className="bg-slate-900/50 rounded p-2 border border-slate-700/30">
            <div className="text-xs text-slate-400">Win Rate</div>
            <div className="text-sm font-bold text-white">{metrics.winRate.toFixed(1)}%</div>
          </div>
          <div className="bg-slate-900/50 rounded p-2 border border-slate-700/30">
            <div className="text-xs text-slate-400">Position Value</div>
            <div className="text-sm font-bold text-white">${metrics.totalPositionValue.toFixed(0)}</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-700/50">
        <button
          onClick={() => setActiveTab('positions')}
          className={`flex-1 py-2 px-3 text-xs font-medium transition-colors border-b-2 ${
            activeTab === 'positions'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          Open Positions ({positions.filter(p => p.status === 'open').length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex-1 py-2 px-3 text-xs font-medium transition-colors border-b-2 ${
            activeTab === 'orders'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          Active Orders ({orders.filter(o => o.status !== 'filled').length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 px-3 text-xs font-medium transition-colors border-b-2 ${
            activeTab === 'history'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          Trade History ({trades.length})
        </button>
      </div>

      {/* Content Area */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {/* Open Positions */}
        {activeTab === 'positions' && (
          <div className="space-y-2">
            {positions.filter(p => p.status === 'open').length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <div className="text-sm">No open positions</div>
              </div>
            ) : (
              positions
                .filter(p => p.status === 'open')
                .map((position) => (
                  <div key={position.id} className="bg-slate-900/30 rounded border border-slate-700/30 p-2">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-bold text-white">{position.symbol}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            position.side === 'buy'
                              ? 'bg-green-600/30 text-green-400'
                              : 'bg-red-600/30 text-red-400'
                          }`}>
                            {position.side.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          {position.size} @ ${position.entry_price.toFixed(8)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${
                          position.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          ${position.unrealized_pnl.toFixed(2)}
                        </div>
                        <div className={`text-xs ${
                          position.unrealized_pnl_percent >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {position.unrealized_pnl_percent >= 0 ? '+' : ''}{position.unrealized_pnl_percent.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    {/* Expandable Details */}
                    <button
                      onClick={() => setShowDetails(showDetails === position.id ? null : position.id)}
                      className="w-full text-xs text-blue-400 hover:text-blue-300 mb-2 flex items-center justify-between"
                    >
                      <span>{showDetails === position.id ? 'Hide' : 'Show'} Details</span>
                      {showDetails === position.id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>

                    {showDetails === position.id && (
                      <div className="bg-slate-800/30 rounded p-2 mb-2 space-y-1 text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>Current Price:</span>
                          <span className="text-white">${position.current_price.toFixed(8)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Position Value:</span>
                          <span className="text-white">${(position.current_price * position.size).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Entry Time:</span>
                          <span className="text-white">{new Date(position.entry_time).toLocaleString()}</span>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <button
                      onClick={() => onClosePosition?.(position.id)}
                      className="w-full py-1 px-2 rounded text-xs font-medium bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-colors"
                    >
                      Close Position
                    </button>
                  </div>
                ))
            )}
          </div>
        )}

        {/* Active Orders */}
        {activeTab === 'orders' && (
          <div className="space-y-2">
            {orders.filter(o => o.status !== 'filled').length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <div className="text-sm">No active orders</div>
              </div>
            ) : (
              orders
                .filter(o => o.status !== 'filled' && o.status !== 'cancelled')
                .map((order) => (
                  <div key={order.id} className="bg-slate-900/30 rounded border border-slate-700/30 p-2">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-bold text-white">{order.symbol}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            order.side === 'buy'
                              ? 'bg-green-600/30 text-green-400'
                              : 'bg-red-600/30 text-red-400'
                          }`}>
                            {order.side.toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-500">
                            {order.order_type === 'limit' ? `@ ${order.price.toFixed(8)}` : 'MARKET'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          {order.filled}/{order.size} filled
                        </div>
                      </div>
                      <div>
                        <div className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          order.status === 'pending'
                            ? 'bg-yellow-600/30 text-yellow-400'
                            : 'bg-blue-600/30 text-blue-400'
                        }`}>
                          {order.status.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-700/30 rounded h-1.5 mb-2 overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all ${
                          order.filled / order.size < 0.25 ? 'w-1/4' :
                          order.filled / order.size < 0.5 ? 'w-1/2' :
                          order.filled / order.size < 0.75 ? 'w-3/4' :
                          'w-full'
                        }`}
                      />
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => onCancelOrder?.(order.id)}
                      className="w-full py-1 px-2 rounded text-xs font-medium bg-slate-700/30 hover:bg-slate-700/50 text-slate-400 transition-colors"
                    >
                      Cancel Order
                    </button>
                  </div>
                ))
            )}
          </div>
        )}

        {/* Trade History */}
        {activeTab === 'history' && (
          <div className="space-y-2">
            {trades.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <div className="text-sm">No trade history</div>
              </div>
            ) : (
              trades.map((trade) => (
                <div key={trade.id} className="bg-slate-900/30 rounded border border-slate-700/30 p-2">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-bold text-white">{trade.symbol}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          trade.side === 'buy'
                            ? 'bg-green-600/30 text-green-400'
                            : 'bg-red-600/30 text-red-400'
                        }`}>
                          {trade.side.toUpperCase()}
                        </span>
                        <CheckCircle className="w-3 h-3 text-slate-500" />
                      </div>
                      <div className="text-xs text-slate-400">
                        {trade.size} units • {trade.duration}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${
                        trade.realized_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        ${trade.realized_pnl.toFixed(2)}
                      </div>
                      <div className={`text-xs ${
                        trade.realized_pnl_percent >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {trade.realized_pnl_percent >= 0 ? '+' : ''}{trade.realized_pnl_percent.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  {/* Price Details */}
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>${trade.entry_price.toFixed(8)} → ${trade.exit_price.toFixed(8)}</span>
                    <span className="text-slate-500">{new Date(trade.entry_time).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
