import React, { useMemo } from 'react';
import { Symbol } from '../pages/symbol-universe';

interface LiquidityHeatmapProps {
  symbols: Symbol[];
}

const EXCHANGES = ['binance', 'coinbase', 'kraken', 'okx', 'bybit', 'kucoin'];

export default function LiquidityHeatmap({ symbols }: LiquidityHeatmapProps) {
  const heatmapData = useMemo(() => {
    return symbols.slice(0, 30).map((symbol) => ({
      symbol: symbol.symbol,
      data: EXCHANGES.map((exchange) => {
        const isAvailable = symbol.exchanges.includes(exchange);
        return {
          exchange,
          available: isAvailable,
          liquidity: isAvailable ? symbol.liquidity : 0,
          spread: isAvailable ? symbol.spread : 0,
        };
      }),
    }));
  }, [symbols]);

  const getLiquidityColor = (liquidity: number): string => {
    if (liquidity === 0) return '#1e293b'; // slate-800
    if (liquidity >= 80) return '#10b981'; // green-500
    if (liquidity >= 60) return '#f59e0b'; // amber-500
    if (liquidity >= 40) return '#ef4444'; // red-500
    return '#7f1d1d'; // red-900
  };

  const maxLiquidity = Math.max(...symbols.map((s) => s.liquidity));

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-6 overflow-x-auto">
      <h2 className="text-2xl font-bold text-white mb-6">🔥 Liquidity Heatmap by Exchange</h2>

      <div className="min-w-max">
        {/* Legend */}
        <div className="mb-6 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }} />
            <span className="text-slate-400">Excellent (80+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f59e0b' }} />
            <span className="text-slate-400">Good (60-80)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }} />
            <span className="text-slate-400">Fair (40-60)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#1e293b' }} />
            <span className="text-slate-400">Not Available</span>
          </div>
        </div>

        {/* Heatmap Table */}
        <div className="border border-slate-700/50 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-700/50">
                <th className="px-4 py-3 text-left font-semibold text-slate-300 w-32">Symbol</th>
                {EXCHANGES.map((exchange) => (
                  <th key={exchange} className="px-4 py-3 text-center font-semibold text-slate-300 min-w-24">
                    <div className="capitalize text-sm">{exchange}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapData.map((row, idx) => (
                <tr key={row.symbol} className={idx % 2 === 0 ? 'bg-slate-900/20' : ''}>
                  <td className="px-4 py-3 font-semibold text-white">{row.symbol}</td>
                  {row.data.map((cell) => (
                    <td
                      key={`${row.symbol}-${cell.exchange}`}
                      className="px-4 py-3 text-center"
                      title={
                        cell.available
                          ? `Liquidity: ${cell.liquidity}, Spread: ${cell.spread.toFixed(4)}%`
                          : 'Not available'
                      }
                    >
                      {cell.available ? (
                        <div
                          className="rounded py-2 px-3 text-center text-white font-semibold text-sm transition-all hover:shadow-lg"
                          style={{
                            backgroundColor: getLiquidityColor(cell.liquidity),
                          }}
                        >
                          <div>{cell.liquidity}</div>
                          <div className="text-xs opacity-75">{cell.spread.toFixed(3)}%</div>
                        </div>
                      ) : (
                        <div className="text-slate-600 text-sm">—</div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 text-center">
            <div className="text-sm text-slate-400 mb-1">Symbols Analyzed</div>
            <div className="text-2xl font-bold text-white">{heatmapData.length}</div>
          </div>
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 text-center">
            <div className="text-sm text-slate-400 mb-1">Avg Liquidity</div>
            <div className="text-2xl font-bold text-white">
              {(symbols.reduce((sum, s) => sum + s.liquidity, 0) / symbols.length).toFixed(0)}
            </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 text-center">
            <div className="text-sm text-slate-400 mb-1">Avg Spread</div>
            <div className="text-2xl font-bold text-white">
              {(symbols.reduce((sum, s) => sum + s.spread, 0) / symbols.length).toFixed(4)}%
            </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 text-center">
            <div className="text-sm text-slate-400 mb-1">Most Liquid</div>
            <div className="text-2xl font-bold text-green-400">
              {symbols.reduce((max, s) => (s.liquidity > max.liquidity ? s : max)).symbol}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="mt-6 p-4 bg-blue-950/30 border border-blue-900/50 rounded-lg text-sm text-blue-200">
        <strong>💡 Tip:</strong> Green cells indicate excellent liquidity for execution. Use this heatmap to find the best
        exchange for trading specific symbols with minimal slippage.
      </div>
    </div>
  );
}
