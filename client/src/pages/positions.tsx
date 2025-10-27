import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, X, Edit, Target, AlertTriangle, DollarSign, Percent, Clock } from 'lucide-react';
import { Link } from 'wouter';

interface Position {
  id: string;
  symbol: string;
  exchange: string;
  side: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  leverage: number;
  pnl: number;
  pnlPercent: number;
  stopLoss?: number;
  takeProfit?: number;
  openTime: number;
  marginUsed: number;
  liquidationPrice?: number;
}

export default function PositionsPage() {
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  const { data: positions, isLoading } = useQuery<Position[]>({
    queryKey: ['positions'],
    queryFn: async () => {
      const response = await fetch('/api/positions');
      if (!response.ok) throw new Error('Failed to fetch positions');
      return response.json();
    },
    refetchInterval: 5000,
  });

  const totalPnL = positions?.reduce((sum, pos) => sum + pos.pnl, 0) || 0;
  const totalMargin = positions?.reduce((sum, pos) => sum + pos.marginUsed, 0) || 0;
  const longPositions = positions?.filter(p => p.side === 'long').length || 0;
  const shortPositions = positions?.filter(p => p.side === 'short').length || 0;

  const closePosition = async (positionId: string) => {
    try {
      const response = await fetch(`/api/positions/${positionId}/close`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to close position');
      // Refetch positions after closing
    } catch (error) {
      console.error('Error closing position:', error);
    }
  };

  const updatePosition = async (positionId: string, updates: Partial<Position>) => {
    try {
      const response = await fetch(`/api/positions/${positionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update position');
    } catch (error) {
      console.error('Error updating position:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Active Positions
            </h1>
            <p className="text-slate-400 mt-1">Manage your open trades</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Total P&L</span>
              <DollarSign className="h-4 w-4 text-slate-500" />
            </div>
            <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Open Positions</span>
              <Target className="h-4 w-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold text-white">
              {positions?.length || 0}
            </div>
            <div className="flex items-center space-x-3 mt-2 text-xs">
              <span className="text-green-400">{longPositions} Long</span>
              <span className="text-red-400">{shortPositions} Short</span>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Margin Used</span>
              <Percent className="h-4 w-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold text-white">
              ${totalMargin.toFixed(2)}
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Avg P&L %</span>
              <TrendingUp className="h-4 w-4 text-slate-500" />
            </div>
            <div className={`text-2xl font-bold ${
              positions && positions.length > 0 
                ? (totalPnL / positions.length >= 0 ? 'text-green-400' : 'text-red-400')
                : 'text-white'
            }`}>
              {positions && positions.length > 0 
                ? `${((totalPnL / totalMargin) * 100).toFixed(2)}%`
                : '0.00%'
              }
            </div>
          </div>
        </div>
      </div>

      {/* Positions Table */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-slate-400">Loading positions...</p>
            </div>
          </div>
        ) : !positions || positions.length === 0 ? (
          <div className="text-center py-20">
            <Target className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Open Positions</h3>
            <p className="text-slate-400 mb-6">You don't have any active trades at the moment</p>
            <Link href="/scanner">
              <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg font-semibold transition-all">
                Find Opportunities
              </button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Symbol
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Side
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Entry
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Current
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    P&L
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    SL / TP
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {positions.map((position) => (
                  <tr key={position.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-bold text-white">{position.symbol}</div>
                        <div className="text-xs text-slate-500 uppercase">{position.exchange}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        position.side === 'long' 
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {position.side === 'long' ? (
                          <><TrendingUp className="inline h-3 w-3 mr-1" />LONG</>
                        ) : (
                          <><TrendingDown className="inline h-3 w-3 mr-1" />SHORT</>
                        )}
                      </span>
                      {position.leverage > 1 && (
                        <div className="text-xs text-slate-500 mt-1">{position.leverage}x</div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-white">
                      ${position.entryPrice.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 font-mono text-white">
                      ${position.currentPrice.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 font-mono text-white">
                      {position.quantity}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`font-bold ${position.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                      </div>
                      <div className={`text-xs ${position.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="space-y-1">
                        {position.stopLoss && (
                          <div className="text-red-400 font-mono">
                            SL: ${position.stopLoss.toFixed(2)}
                          </div>
                        )}
                        {position.takeProfit && (
                          <div className="text-green-400 font-mono">
                            TP: ${position.takeProfit.toFixed(2)}
                          </div>
                        )}
                        {!position.stopLoss && !position.takeProfit && (
                          <div className="text-slate-500 flex items-center space-x-1">
                            <AlertTriangle className="h-3 w-3" />
                            <span className="text-xs">Not set</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(position.openTime).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setSelectedPosition(position)}
                          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Edit position"
                        >
                          <Edit className="h-4 w-4 text-slate-400" />
                        </button>
                        <button
                          onClick={() => closePosition(position.id)}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Close position"
                        >
                          <X className="h-4 w-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

