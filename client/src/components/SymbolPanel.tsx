import React from 'react';
import { BarChart3 } from 'lucide-react';

export default function SymbolPanel(props: { symbol?: string; latest?: any; signals?: any[] }){
  const { symbol='-', latest, signals = [] } = props;

  return (
    <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-700/50">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold">{symbol}</h4>
        <BarChart3 className="w-4 h-4 text-slate-400" />
      </div>
      <div className="text-xs text-slate-400 mb-2">Realtime candlestick & summary</div>
      <div className="h-36 bg-slate-800/20 rounded mb-2 flex items-center justify-center text-slate-500">Chart placeholder</div>
      <div className="text-xs text-slate-300">Signals:</div>
      <div className="mt-1 space-y-1">
        {signals.length === 0 && <div className="text-xs text-slate-500">No active signals</div>}
        {signals.slice(0,3).map((s, i) => (
          <div key={i} className="text-xs bg-slate-800/30 p-2 rounded">{s.type || s.reason || 'signal'}</div>
        ))}
      </div>
    </div>
  );
}
