import React from 'react';
import VirtualList from './VirtualList';

export default function WorldTicksPanel({
  ticks,
  limit = 8,
}: {
  ticks?: Array<{ timestamp?: number; symbol?: string; price?: number; side?: string; size?: number }>; 
  limit?: number;
}) {
  const all = ticks || [];
  // If we have a very large ticks array, use the VirtualList to avoid rendering jank.
  const VIRTUALIZE_THRESHOLD = 64;

  const shouldVirtualize = all.length > VIRTUALIZE_THRESHOLD;

  const rows = all.slice(0, limit);

  return (
    <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 rounded-lg p-3 border border-slate-700/50">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold text-white flex items-center">World Ticks</h4>
        <span className="text-xs text-slate-400">Latest</span>
      </div>
      <div className="text-xs font-mono">
        {all.length === 0 && <div className="text-slate-500">No recent ticks</div>}

        {shouldVirtualize ? (
          <div className="rounded overflow-hidden">
            <VirtualList
              items={all.slice(0, 200)}
              height={Math.min(8, Math.max(3, Math.floor((all.length || 0) / 10))) * 48}
              itemHeight={48}
              renderItem={(t, i) => (
                <div key={`tick-${i}`} className="flex justify-between items-center px-2">
                  <div className="text-slate-300">{t.symbol}</div>
                  <div className="flex items-center space-x-2">
                    <div className={`text-sm font-bold ${t.side === 'buy' ? 'text-green-400' : t.side === 'sell' ? 'text-red-400' : 'text-slate-300'}`}>
                      ${((t.price) || 0).toFixed(2)}
                    </div>
                    <div className="text-slate-500">{((t.size) || 0).toFixed(4)}</div>
                  </div>
                </div>
              )}
            />
          </div>
        ) : (
          <div className="space-y-2">
            {rows.length === 0 && <div className="text-slate-500">No recent ticks</div>}
            {rows.map((t, i) => (
              <div key={`tick-${i}`} className="flex justify-between items-center">
                <div className="text-slate-300">{t.symbol}</div>
                <div className="flex items-center space-x-2">
                  <div className={`text-sm font-bold ${t.side === 'buy' ? 'text-green-400' : t.side === 'sell' ? 'text-red-400' : 'text-slate-300'}`}>
                    ${((t.price) || 0).toFixed(2)}
                  </div>
                  <div className="text-slate-500">{((t.size) || 0).toFixed(4)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
