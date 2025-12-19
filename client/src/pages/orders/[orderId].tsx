import React from 'react';
import { useParams } from 'wouter';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';

export default function OrderPage() {
  const params = useParams();
  const orderId = (params as any)?.orderId;
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
      if (!res.ok) throw new Error('Failed to fetch order');
      const body = await res.json();
      return body?.data || body;
    },
    enabled: !!orderId,
  });

  if (isLoading) return <div className="p-6">Loading order...</div>;
  if (error) return <div className="p-6 text-red-600">Failed to load order</div>;

  const order = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white">
      <div className="max-w-4xl mx-auto bg-slate-900/60 rounded-lg border border-slate-700 p-6">
        <button onClick={() => setLocation('/orders')} className="mb-4 inline-flex items-center gap-2 text-slate-300 hover:text-white">
          <ArrowLeft className="w-5 h-5" /> Back
        </button>

        <h1 className="text-2xl font-bold mb-2">Order Confirmation</h1>
        <p className="text-slate-400 mb-4">Order ID: <span className="font-mono text-slate-200">{orderId}</span></p>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800/40 rounded p-4">
            <div className="text-slate-400 text-sm">Symbol</div>
            <div className="font-bold text-white text-lg">{order?.symbol || 'N/A'}</div>
          </div>

          <div className="bg-slate-800/40 rounded p-4">
            <div className="text-slate-400 text-sm">Status</div>
            <div className="font-bold text-white text-lg">{order?.status || 'N/A'}</div>
          </div>

          <div className="bg-slate-800/40 rounded p-4">
            <div className="text-slate-400 text-sm">Price</div>
            <div className="font-bold text-white text-lg">{order?.price?.toFixed ? order.price.toFixed(2) : order?.price || 'N/A'}</div>
          </div>

          <div className="bg-slate-800/40 rounded p-4">
            <div className="text-slate-400 text-sm">Filled Quantity</div>
            <div className="font-bold text-white text-lg">{order?.filledQty ?? order?.filledQuantity ?? 'N/A'}</div>
          </div>
        </div>

        <div className="mt-6 bg-slate-800/30 rounded p-4 text-sm text-slate-300">
          <pre className="whitespace-pre-wrap">{JSON.stringify(order, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
