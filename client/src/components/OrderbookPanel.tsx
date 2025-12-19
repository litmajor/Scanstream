import React from 'react';

type Entry = { price: number; size: number };

export default function OrderbookPanel({
  orderbook,
  limit = 6,
}: {
  orderbook: { bids?: Entry[]; asks?: Entry[] } | null | undefined;
  limit?: number;
}) {
  const bids = (orderbook?.bids || []).slice(0, limit);
  const asks = (orderbook?.asks || []).slice(0, limit);

  return (
    <div className="rounded-lg p-3 border" style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold text-theme flex items-center">Orderbook</h4>
        <span className="text-xs text-theme-secondary">{bids.length + asks.length} levels</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        <div>
          <div className="text-theme-secondary text-xs mb-1">Bids</div>
          <div className="space-y-1">
            {bids.length === 0 && <div className="text-theme-secondary">No bids</div>}
            {bids.map((b, i) => (
              <div key={`bid-${i}`} className="flex justify-between text-green-400">
                <span>${b.price.toFixed(2)}</span>
                <span className="text-theme">{(b.size).toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-theme-secondary text-xs mb-1">Asks</div>
          <div className="space-y-1">
            {asks.length === 0 && <div className="text-theme-secondary">No asks</div>}
            {asks.map((a, i) => (
              <div key={`ask-${i}`} className="flex justify-between text-red-400">
                <span>${a.price.toFixed(2)}</span>
                <span className="text-theme">{(a.size).toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
