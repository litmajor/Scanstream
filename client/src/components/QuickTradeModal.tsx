import { useState } from 'react';
import { X, TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react';

interface QuickTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  currentPrice: number;
}

export default function QuickTradeModal({
  isOpen,
  onClose,
  symbol,
  currentPrice,
}: QuickTradeModalProps) {
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [limitPrice, setLimitPrice] = useState(currentPrice.toString());

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement actual trade logic
    console.log('Trade submitted:', { tradeType, amount, orderType, limitPrice, symbol });
    onClose();
  };

  const estimatedTotal = parseFloat(amount || '0') * (orderType === 'market' ? currentPrice : parseFloat(limitPrice || '0'));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] bg-gradient-to-br from-slate-900/98 to-slate-950/98 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl z-50 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Quick Trade</h2>
                <p className="text-sm text-slate-400">
                  {symbol} @ ${currentPrice.toFixed(2)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Buy/Sell Toggle */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => setTradeType('buy')}
              className={`
                flex-1 py-3 rounded-lg font-semibold transition-all
                ${tradeType === 'buy'
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-500/20'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                }
              `}
            >
              <TrendingUp className="w-4 h-4 inline-block mr-2" />
              Buy
            </button>
            <button
              type="button"
              onClick={() => setTradeType('sell')}
              className={`
                flex-1 py-3 rounded-lg font-semibold transition-all
                ${tradeType === 'sell'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-500/20'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                }
              `}
            >
              <TrendingDown className="w-4 h-4 inline-block mr-2" />
              Sell
            </button>
          </div>

          {/* Order Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Order Type
            </label>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setOrderType('market')}
                className={`
                  flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all
                  ${orderType === 'market'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                  }
                `}
              >
                Market
              </button>
              <button
                type="button"
                onClick={() => setOrderType('limit')}
                className={`
                  flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all
                  ${orderType === 'limit'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                  }
                `}
              >
                Limit
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Amount ({symbol.split('/')[0]})
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.00000001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                required
              />
              <button
                type="button"
                onClick={() => setAmount('0.1')}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 rounded transition-colors"
              >
                0.1
              </button>
            </div>
          </div>

          {/* Limit Price (only if limit order) */}
          {orderType === 'limit' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Limit Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder="Enter limit price"
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                aria-label="Limit price"
                required
              />
            </div>
          )}

          {/* Estimated Total */}
          <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Estimated Total</span>
              <span className="text-lg font-bold text-white">
                ${estimatedTotal.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Fee (0.1%)</span>
              <span>${(estimatedTotal * 0.001).toFixed(2)}</span>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-800/50 hover:bg-slate-800 text-slate-300 rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`
                flex-1 py-3 rounded-lg font-semibold transition-all
                ${tradeType === 'buy'
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg'
                  : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg'
                }
              `}
            >
              {tradeType === 'buy' ? 'Place Buy Order' : 'Place Sell Order'}
            </button>
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-center text-slate-500">
            This is a simulated trade interface. No real orders will be placed.
          </p>
        </form>
      </div>
    </>
  );
}

