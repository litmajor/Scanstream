import React from 'react';
import { Clock, Activity } from 'lucide-react';

import VirtualList from './VirtualList';

export default function EventFeedPanel(props: { ticks?: any[]; signals?: any[]; alerts?: any[] }){
  const { ticks = [], signals = [], alerts = [] } = props;

  const merged = [
    ...ticks.map(t => ({ type: 'tick', ts: t.timestamp || Date.now(), text: `${t.symbol} ${t.price}` })),
    ...signals.map(s => ({ type: 'signal', ts: s.timestamp || Date.now(), text: `${s.symbol} ${s.type}` })),
    ...alerts.map(a => ({ type: 'alert', ts: a.timestamp || Date.now(), text: a.text || 'alert' })),
  ].sort((a,b) => (b.ts||0)-(a.ts||0));

  const shouldVirtualize = merged.length > 24;

  return (
    <div className="p-3 border-b border-slate-700/50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold">Event Feed</h4>
        <Clock className="w-4 h-4 text-slate-400" />
      </div>
      <div className="text-xs">
        {shouldVirtualize ? (
          <VirtualList
            items={merged}
            height={Math.min(8, Math.max(3, Math.floor(merged.length / 6))) * 48}
            itemHeight={48}
            renderItem={(m: any, i: number) => (
              <div key={i} className="text-xs text-slate-300 bg-slate-800/30 p-2 rounded">
                <div className="font-mono text-xs text-slate-400">{new Date(m.ts).toLocaleTimeString()}</div>
                <div>{m.text}</div>
              </div>
            )}
          />
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {merged.slice(0, 24).map((m, i) => (
              <div key={i} className="text-xs text-slate-300 bg-slate-800/30 p-2 rounded">
                <div className="font-mono text-xs text-slate-400">{new Date(m.ts).toLocaleTimeString()}</div>
                <div>{m.text}</div>
              </div>
            ))}
            {merged.length === 0 && <div className="text-xs text-slate-500">No events</div>}
          </div>
        )}
      </div>
    </div>
  );
}
