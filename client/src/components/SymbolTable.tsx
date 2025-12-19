import React, { useState } from 'react';
import { Star, ExternalLink, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { Symbol } from '../pages/symbol-universe';

interface SymbolTableProps {
  symbols: Symbol[];
  viewMode: 'table' | 'grid';
  onSelectSymbol: (symbol: Symbol) => void;
}

type SortField = 'symbol' | 'price' | 'change24h' | 'volume24h' | 'marketCap' | 'liquidity' | 'spread';

export default function SymbolTable({ symbols, viewMode, onSelectSymbol }: SymbolTableProps) {
  const [sortField, setSortField] = useState<SortField>('volume24h');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedSymbols = [...symbols].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  if (symbols.length === 0) {
    return (
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-12 text-center">
        <div className="text-slate-400 mb-2">No symbols found</div>
        <div className="text-sm text-slate-500">Try adjusting your filters</div>
      </div>
    );
  }

  // Grid View
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sortedSymbols.map((symbol) => (
          <button
            key={symbol.id}
            onClick={() => onSelectSymbol(symbol)}
            className="bg-slate-800/30 border border-slate-700/50 hover:border-blue-500/50 rounded-lg p-4 transition-all text-left group"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-bold text-white text-lg">{symbol.symbol}</div>
                <div className="text-xs text-slate-400">{symbol.name}</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="text-slate-400 hover:text-yellow-400 transition-colors"
              >
                <Star className="w-4 h-4" fill={symbol.inWatchlist ? 'currentColor' : 'none'} />
              </button>
            </div>

            {/* Price */}
            <div className="mb-3">
              <div className="text-2xl font-bold text-white">${symbol.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
              <div
                className={`text-sm font-semibold flex items-center gap-1 ${
                  symbol.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {symbol.change24h >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {symbol.change24h >= 0 ? '+' : ''}{symbol.change24h.toFixed(2)}%
              </div>
            </div>

            {/* Stats Grid */}
            <div className="space-y-2 mb-3 pb-3 border-b border-slate-700/50 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Volume (24h)</span>
                <span className="text-slate-300">${(symbol.volume24h / 1e9).toFixed(2)}B</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Market Cap</span>
                <span className="text-slate-300">${(symbol.marketCap / 1e9).toFixed(2)}B</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Liquidity</span>
                <span
                  className={`font-semibold ${
                    symbol.liquidity >= 80 ? 'text-green-400' : symbol.liquidity >= 60 ? 'text-yellow-400' : 'text-red-400'
                  }`}
                >
                  {symbol.liquidity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Spread</span>
                <span className="text-slate-300">{symbol.spread.toFixed(4)}%</span>
              </div>
            </div>

            {/* Exchanges */}
            <div className="mb-3">
              <div className="text-xs text-slate-500 mb-1">Available on:</div>
              <div className="flex flex-wrap gap-1">
                {symbol.exchanges.slice(0, 3).map((exchange) => (
                  <span key={exchange} className="bg-slate-700/50 text-slate-300 text-xs px-2 py-0.5 rounded">
                    {exchange}
                  </span>
                ))}
                {symbol.exchanges.length > 3 && (
                  <span className="bg-slate-700/50 text-slate-300 text-xs px-2 py-0.5 rounded">
                    +{symbol.exchanges.length - 3}
                  </span>
                )}
              </div>
            </div>

            {/* Action Button */}
            <button className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium text-sm text-white transition-all flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-blue-500/20">
              <Zap className="w-3 h-3" />
              Trade
            </button>
          </button>
        ))}
      </div>
    );
  }

  // Table View
  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/50 border-b border-slate-700/50">
            <tr>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('symbol')}
                  className="flex items-center gap-2 font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  Symbol
                  <span className="text-xs">{sortField === 'symbol' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  onClick={() => handleSort('price')}
                  className="flex items-center justify-end gap-2 font-semibold text-slate-300 hover:text-white transition-colors w-full"
                >
                  Price
                  <span className="text-xs">{sortField === 'price' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  onClick={() => handleSort('change24h')}
                  className="flex items-center justify-end gap-2 font-semibold text-slate-300 hover:text-white transition-colors w-full"
                >
                  Change (24h)
                  <span className="text-xs">{sortField === 'change24h' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  onClick={() => handleSort('volume24h')}
                  className="flex items-center justify-end gap-2 font-semibold text-slate-300 hover:text-white transition-colors w-full"
                >
                  Volume (24h)
                  <span className="text-xs">{sortField === 'volume24h' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  onClick={() => handleSort('marketCap')}
                  className="flex items-center justify-end gap-2 font-semibold text-slate-300 hover:text-white transition-colors w-full"
                >
                  Market Cap
                  <span className="text-xs">{sortField === 'marketCap' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  onClick={() => handleSort('liquidity')}
                  className="flex items-center justify-end gap-2 font-semibold text-slate-300 hover:text-white transition-colors w-full"
                >
                  Liquidity
                  <span className="text-xs">{sortField === 'liquidity' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  onClick={() => handleSort('spread')}
                  className="flex items-center justify-end gap-2 font-semibold text-slate-300 hover:text-white transition-colors w-full"
                >
                  Spread
                  <span className="text-xs">{sortField === 'spread' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                </button>
              </th>
              <th className="px-4 py-3 text-center font-semibold text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedSymbols.map((symbol, idx) => (
              <tr
                key={symbol.id}
                className={`border-b border-slate-700/30 hover:bg-slate-800/50 transition-colors ${
                  idx % 2 === 0 ? 'bg-slate-900/20' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <button
                    onClick={() => onSelectSymbol(symbol)}
                    className="flex items-center gap-3 hover:text-blue-400 transition-colors group"
                  >
                    <div>
                      <div className="font-semibold text-white group-hover:text-blue-400">{symbol.symbol}</div>
                      <div className="text-xs text-slate-500">{symbol.name}</div>
                    </div>
                  </button>
                </td>
                <td className="px-4 py-3 text-right text-white font-semibold">
                  ${symbol.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </td>
                <td
                  className={`px-4 py-3 text-right font-semibold flex items-center justify-end gap-1 ${
                    symbol.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {symbol.change24h >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {symbol.change24h >= 0 ? '+' : ''}{symbol.change24h.toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-right text-slate-300">
                  ${(symbol.volume24h / 1e9).toFixed(2)}B
                </td>
                <td className="px-4 py-3 text-right text-slate-300">
                  ${(symbol.marketCap / 1e9).toFixed(2)}B
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      symbol.liquidity >= 80
                        ? 'bg-green-500/20 text-green-400'
                        : symbol.liquidity >= 60
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {symbol.liquidity}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-300">{symbol.spread.toFixed(4)}%</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onSelectSymbol(symbol)}
                      className="p-2 hover:bg-blue-600/20 rounded transition-all text-blue-400 hover:text-blue-300"
                      title="View details"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {}}
                      className={`p-2 rounded transition-all ${
                        symbol.inWatchlist
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'hover:bg-yellow-500/10 text-slate-400 hover:text-yellow-400'
                      }`}
                      title={symbol.inWatchlist ? 'In watchlist' : 'Add to watchlist'}
                    >
                      <Star className="w-4 h-4" fill={symbol.inWatchlist ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Stats */}
      <div className="bg-slate-900/50 border-t border-slate-700/50 px-4 py-3 flex items-center justify-between text-sm text-slate-400">
        <div>Showing {sortedSymbols.length} symbols</div>
        <div>
          Total Volume: ${(sortedSymbols.reduce((sum, s) => sum + s.volume24h, 0) / 1e12).toFixed(2)}T
        </div>
      </div>
    </div>
  );
}
