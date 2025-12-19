import React from 'react';

interface WorldTick {
  symbol: string;
  price: number;
  change: number; // percent
  source?: string;
  timestamp?: number;
}

interface WorldTickPanelProps {
  ticks: WorldTick[];
  title?: string;
}

export default function WorldTickPanel({ ticks = [], title = 'World Tick' }: WorldTickPanelProps) {
  return (
    <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 rounded-lg p-3 border border-slate-700/50">
      <h4 className="text-sm font-bold text-white mb-3">{title}</h4>
      <div className="space-y-2 max-h-44 overflow-auto text-xs font-mono">
        {ticks.length === 0 && <div className="text-slate-400">No world ticks yet</div>}
        {ticks.slice(0, 12).map((t, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex-1">
              <div className="font-semibold text-white">{t.symbol}</div>
              <div className="text-slate-400 text-[11px]">{t.source || 'aggregated'}</div>
            </div>
            <div className={`text-right ${t.change >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              <div className="font-mono">${t.price.toFixed(2)}</div>
              <div className="text-[11px]">{t.change >= 0 ? '+' : ''}{t.change.toFixed(2)}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
