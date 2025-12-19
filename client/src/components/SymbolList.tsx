import React, { useMemo, useState } from 'react';
import type { UITick } from '../types';

export default function SymbolList<T extends { symbol?: string }>(props: {
  symbols: string[];
  worldTicks?: Array<UITick | { timestamp?: number; ts?: number; symbol?: string; price?: number; side?: string; size?: number }>;
  orderbook?: { bids?: { price: number; size: number }[]; asks?: { price: number; size: number }[] } | null;
  signals?: Array<{ symbol?: string; confidence?: number }>;
  pinned?: string[];
  spreads?: Record<string, number>;
  onTogglePin?: (symbol: string) => void;
  onSelect?: (symbol: string) => void;
}) {
  const { symbols, worldTicks, orderbook, signals, pinned = [], spreads = {}, onTogglePin, onSelect } = props;
  const [query, setQuery] = useState('');

  const latestTickBySymbol = useMemo(() => {
    const map = new Map<string, number>();
    (worldTicks || []).forEach(t => {
      if (!t.symbol || !t.timestamp) return;
      const ts = t.timestamp < 1e12 ? t.timestamp * 1000 : t.timestamp;
      const prev = map.get(t.symbol) || 0;
      if (ts > prev) map.set(t.symbol, ts);
    });
    return map;
  }, [worldTicks]);

  const confidenceBySymbol = useMemo(() => {
    const map = new Map<string, number[]>();
    (signals || []).forEach(s => {
      if (!s.symbol) return;
      const arr = map.get(s.symbol) || [];
      if (s.confidence !== undefined) arr.push(s.confidence);
      map.set(s.symbol, arr);
    });
    const avg = new Map<string, number>();
    map.forEach((arr, k) => {
      if (arr.length === 0) return;
      avg.set(k, arr.reduce((a, b) => a + b, 0) / arr.length);
    });
    return avg;
  }, [signals]);

  const list = useMemo(() => {
    const normalized = Array.from(new Set(symbols.concat(Array.from(latestTickBySymbol.keys()))));
    const filtered = normalized.filter(s => s && s.toLowerCase().includes(query.toLowerCase()));
    filtered.sort((a, b) => (pinned.includes(b) ? 1 : 0) - (pinned.includes(a) ? 1 : 0));
    return filtered;
  }, [symbols, latestTickBySymbol, query, pinned]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-slate-700/30">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search symbols"
          className="w-full px-2 py-1 rounded bg-slate-800/50 text-sm text-slate-200 border border-slate-700/50"
          aria-label="Search symbols"
        />
      </div>
      <div className="p-2 overflow-y-auto flex-1 space-y-1">
        {list.length === 0 && <div className="text-xs text-slate-500 p-2">No symbols</div>}
        {list.map(sym => (
          <button
            key={sym}
            onClick={() => onSelect && onSelect(sym)}
            className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-slate-800/40 text-sm"
            data-symbol={sym}
          >
            <div className="flex items-center space-x-2">
              <div className="font-mono font-semibold">{sym}</div>
              <div className="text-xs text-slate-400">
                {latestTickBySymbol.has(sym) ? new Date(latestTickBySymbol.get(sym)!).toLocaleTimeString() : ''}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="text-xs text-slate-300">{confidenceBySymbol.has(sym) ? `${Math.round((confidenceBySymbol.get(sym)!)*100)}%` : '--'}</div>
              <div className="text-xs text-slate-400 px-2 py-0.5 rounded bg-slate-700/30">
                {typeof spreads[sym] === 'number' ? `${spreads[sym] < 1 ? spreads[sym].toFixed(4) : spreads[sym].toFixed(2)}` : '--'}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onTogglePin && onTogglePin(sym); }}
                className={`px-2 py-0.5 text-xs rounded ${pinned.includes(sym) ? 'bg-yellow-600 text-black' : 'bg-slate-700 text-slate-300'}`}
                aria-pressed={pinned.includes(sym)}
              >
                {pinned.includes(sym) ? 'Pinned' : 'Pin'}
              </button>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
