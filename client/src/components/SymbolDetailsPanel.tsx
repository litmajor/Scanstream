import React, { useState } from 'react';
import { X, Star, TrendingUp, TrendingDown, ExternalLink, Plus } from 'lucide-react';
import { Symbol } from '../pages/symbol-universe';

interface SymbolDetailsPanelProps {
  symbol: Symbol;
  onClose: () => void;
  onAddToWatchlist: (watchlistId: string) => void;
}

export default function SymbolDetailsPanel({ symbol, onClose, onAddToWatchlist }: SymbolDetailsPanelProps) {
  const [showWatchlistMenu, setShowWatchlistMenu] = useState(false);
  const [watchlists, setWatchlists] = useState([]);

  return (
    <div className="fixed right-0 top-0 bottom-0 w-full md:w-96 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border-l border-slate-700/50 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-700/50 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center font-bold text-white">
            {symbol.symbol.slice(0, 2)}
          </div>
          <div>
            <h2 className="font-bold text-white text-lg">{symbol.symbol}</h2>
            <p className="text-xs text-slate-400">{symbol.name}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Price Section */}
        <div className="p-4 border-b border-slate-700/30">
          <div className="text-4xl font-bold text-white mb-2">
            ${symbol.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </div>
          <div className={`text-lg font-semibold flex items-center gap-2 ${symbol.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {symbol.change24h >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            {symbol.change24h >= 0 ? '+' : ''}{symbol.change24h.toFixed(2)}%
          </div>
        </div>

        {/* Key Metrics */}
        <div className="p-4 border-b border-slate-700/30 space-y-3">
          <h3 className="font-semibold text-slate-300 text-sm mb-3">Key Metrics</h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">24h Volume</div>
              <div className="font-bold text-white text-sm">
                ${(symbol.volume24h / 1e9).toFixed(2)}B
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Market Cap</div>
              <div className="font-bold text-white text-sm">
                ${(symbol.marketCap / 1e9).toFixed(2)}B
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Liquidity</div>
              <div
                className={`font-bold text-sm ${
                  symbol.liquidity >= 80
                    ? 'text-green-400'
                    : symbol.liquidity >= 60
                      ? 'text-yellow-400'
                      : 'text-red-400'
                }`}
              >
                {symbol.liquidity}/100
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Bid-Ask Spread</div>
              <div className="font-bold text-white text-sm">{symbol.spread.toFixed(4)}%</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Volatility</div>
              <div className="font-bold text-white text-sm">{symbol.volatility.toFixed(2)}%</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">In Watchlist</div>
              <div className={`font-bold text-sm ${symbol.inWatchlist ? 'text-yellow-400' : 'text-slate-400'}`}>
                {symbol.inWatchlist ? '✓ Yes' : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Exchanges */}
        <div className="p-4 border-b border-slate-700/30">
          <h3 className="font-semibold text-slate-300 text-sm mb-3">Available Exchanges</h3>
          <div className="flex flex-wrap gap-2">
            {symbol.exchanges.map((exchange) => (
              <span
                key={exchange}
                className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:border-slate-700 transition-all"
              >
                {exchange.charAt(0).toUpperCase() + exchange.slice(1)}
              </span>
            ))}
          </div>
        </div>

        {/* Market Analysis Placeholder */}
        <div className="p-4 border-b border-slate-700/30">
          <h3 className="font-semibold text-slate-300 text-sm mb-3">Market Analysis</h3>
          <div className="space-y-2">
            <div className="bg-slate-800/30 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Trend</div>
              <div className="text-sm text-white">
                {symbol.change24h > 5 ? '📈 Uptrend' : symbol.change24h < -5 ? '📉 Downtrend' : '➡️ Sideways'}
              </div>
            </div>
            <div className="bg-slate-800/30 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Volume Analysis</div>
              <div className="text-sm text-white">
                {symbol.volume24h > 1e12 ? '🔥 High' : symbol.volume24h > 1e11 ? '📊 Moderate' : '💤 Low'}
              </div>
            </div>
          </div>
        </div>

        {/* Related Assets */}
        <div className="p-4 border-b border-slate-700/30">
          <h3 className="font-semibold text-slate-300 text-sm mb-3">Similar Assets</h3>
          <div className="space-y-2">
            {['BTC', 'ETH', 'SOL'].map((asset) => (
              <button
                key={asset}
                className="w-full text-left p-2 hover:bg-slate-800/50 rounded transition-all flex items-center justify-between"
              >
                <span className="text-slate-300">{asset}</span>
                <ExternalLink className="w-4 h-4 text-slate-500" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="border-t border-slate-700/50 p-4 space-y-2 bg-slate-900/50">
        <div className="relative">
          <button
            onClick={() => setShowWatchlistMenu(!showWatchlistMenu)}
            className="w-full py-3 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/50 rounded-lg font-medium text-yellow-400 transition-all flex items-center justify-center gap-2"
          >
            <Star className="w-4 h-4" />
            Add to Watchlist
          </button>

          {showWatchlistMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10">
              <div className="p-2 space-y-1 max-h-40 overflow-y-auto">
                {watchlists.length === 0 ? (
                  <div className="text-center text-slate-500 py-3 text-sm">No watchlists available</div>
                ) : (
                  watchlists.map((watchlist: any) => (
                    <button
                      key={watchlist.id}
                      onClick={() => {
                        onAddToWatchlist(watchlist.id);
                        setShowWatchlistMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-all text-sm"
                    >
                      {watchlist.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-white transition-all flex items-center justify-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Open in Trading Terminal
        </button>

        <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2">
          <ExternalLink className="w-4 h-4" />
          View on CoinMarketCap
        </button>
      </div>
    </div>
  );
}
