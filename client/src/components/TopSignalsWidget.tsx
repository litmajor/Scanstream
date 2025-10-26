
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function TopSignalsWidget() {
  const [signals, setSignals] = useState<any[]>([]);

  useEffect(() => {
    const loadSignals = () => {
      const stored = localStorage.getItem('latestScanResults');
      if (stored) {
        const data = JSON.parse(stored);
        setSignals(data.signals.slice(0, 5)); // Top 5
      }
    };

    loadSignals();
    const interval = setInterval(loadSignals, 5000);
    return () => clearInterval(interval);
  }, []);

  if (signals.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <p className="text-sm">No signals available</p>
        <a href="/scanner" className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Run Scanner →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {signals.map((signal, idx) => (
        <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className={`text-2xl ${signal.signal === 'BUY' ? 'text-green-400' : signal.signal === 'SELL' ? 'text-red-400' : 'text-yellow-400'}`}>
              {signal.signal === 'BUY' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
            <div>
              <div className="font-semibold text-white">{signal.symbol}</div>
              <div className="text-xs text-slate-400">Strength: {signal.strength}%</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-white">${signal.price?.toFixed(2) || 'N/A'}</div>
            <div className={`text-xs ${signal.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {signal.change24h >= 0 ? '+' : ''}{signal.change24h?.toFixed(2) || 0}%
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
