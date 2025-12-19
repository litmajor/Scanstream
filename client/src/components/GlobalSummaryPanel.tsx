import React from 'react';
import { Globe, Layers, Activity } from 'lucide-react';

export default function GlobalSummaryPanel(props: { 
  totalSignals?: number;
  reliability?: Record<string, number>;
  activePositions?: number;
}) {
  const { totalSignals = 0, reliability = {}, activePositions = 0 } = props;

  return (
    <div className="p-3 border-b border-slate-700/50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold">Global Summary</h4>
        <Globe className="w-4 h-4 text-slate-400" />
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-slate-800/30 rounded p-2">
          <div className="text-xs text-slate-400">Active Signals</div>
          <div className="font-mono font-bold text-white text-lg">{totalSignals}</div>
        </div>
        <div className="bg-slate-800/30 rounded p-2">
          <div className="text-xs text-slate-400">Open Positions</div>
          <div className="font-mono font-bold text-white text-lg">{activePositions}</div>
        </div>
        <div className="col-span-2 mt-1">
          <div className="text-xs text-slate-400 mb-1">Exchange Reliability</div>
          <div className="flex gap-2 flex-wrap">
            {Object.keys(reliability).length === 0 && (
              <div className="text-xs text-slate-500">No data</div>
            )}
            {Object.entries(reliability).map(([k, v]) => (
              <div key={k} className="text-xs bg-slate-700/30 px-2 py-1 rounded">
                <div className="font-semibold">{k}</div>
                <div className="text-xs text-slate-300">{Math.round(v*100)}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
