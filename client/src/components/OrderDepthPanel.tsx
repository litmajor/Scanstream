import React from 'react';

interface OrderBookEntry {
  price: number;
  size: number;
}

interface OrderDepthPanelProps {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  title?: string;
}

export default function OrderDepthPanel({ bids = [], asks = [], title = 'Order Depth' }: OrderDepthPanelProps) {
  const topBids = bids.slice(0, 10);
  const topAsks = asks.slice(0, 10);

  return (
    <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 rounded-lg p-3 border border-slate-700/50">
      <h4 className="text-sm font-bold text-white mb-3">{title}</h4>
      <div className="flex gap-3 text-xs font-mono">
        <div className="flex-1">
          <div className="text-xs text-slate-400 mb-2">Bids</div>
          <div className="space-y-1 max-h-40 overflow-auto">
            {topBids.length === 0 && <div className="text-slate-400">No bid data</div>}
            {topBids.map((b, i) => (
              <div key={i} className="flex justify-between text-green-300">
                <div>{b.price.toFixed(2)}</div>
                <div className="text-slate-300">{b.size.toFixed(4)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-slate-400 mb-2">Asks</div>
          <div className="space-y-1 max-h-40 overflow-auto">
            {topAsks.length === 0 && <div className="text-slate-400">No ask data</div>}
            {topAsks.map((a, i) => (
              <div key={i} className="flex justify-between text-red-300">
                <div>{a.price.toFixed(2)}</div>
                <div className="text-slate-300">{a.size.toFixed(4)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
