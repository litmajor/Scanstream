
import { useState, useEffect } from 'react';
import { ArrowLeft, Play, Pause, RotateCcw, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useLocation } from 'wouter';

export default function PaperTradingPage() {
  const [, setLocation] = useLocation();
  const [isActive, setIsActive] = useState(false);
  const [portfolio, setPortfolio] = useState({
    balance: 10000,
    positions: [] as any[],
    trades: [] as any[],
    performance: {
      totalReturn: 0,
      winRate: 0,
      sharpeRatio: 0
    }
  });

  useEffect(() => {
    const stored = localStorage.getItem('paperTradingPortfolio');
    if (stored) {
      setPortfolio(JSON.parse(stored));
    }
  }, []);

  const resetPortfolio = () => {
    const initial = {
      balance: 10000,
      positions: [],
      trades: [],
      performance: { totalReturn: 0, winRate: 0, sharpeRatio: 0 }
    };
    setPortfolio(initial);
    localStorage.setItem('paperTradingPortfolio', JSON.stringify(initial));
  };

  const executeSignal = async (signal: any) => {
    const positionSize = portfolio.balance * 0.1; // 10% per trade
    const newPosition = {
      symbol: signal.symbol,
      entry: signal.price,
      size: positionSize / signal.price,
      stopLoss: signal.price * 0.98,
      takeProfit: signal.price * 1.05,
      entryTime: new Date(),
      signal: signal.signal
    };

    setPortfolio(prev => ({
      ...prev,
      positions: [...prev.positions, newPosition],
      balance: prev.balance - positionSize
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="border-b border-slate-800/50 backdrop-blur-xl bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setLocation('/')} className="flex items-center text-slate-400 hover:text-white">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Dashboard
            </button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Paper Trading
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => setIsActive(!isActive)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${isActive ? 'bg-red-600' : 'bg-green-600'}`}
              >
                {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isActive ? 'Pause' : 'Start'}
              </button>
              <button onClick={resetPortfolio} className="px-4 py-2 bg-slate-700 rounded-lg flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 text-sm mb-2">Balance</div>
            <div className="text-2xl font-bold text-white">${portfolio.balance.toFixed(2)}</div>
          </div>
          <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 text-sm mb-2">Total Return</div>
            <div className={`text-2xl font-bold ${portfolio.performance.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {portfolio.performance.totalReturn >= 0 ? '+' : ''}{portfolio.performance.totalReturn.toFixed(2)}%
            </div>
          </div>
          <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 text-sm mb-2">Open Positions</div>
            <div className="text-2xl font-bold text-white">{portfolio.positions.length}</div>
          </div>
        </div>

        <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
          <h2 className="text-lg font-semibold text-white mb-4">Open Positions</h2>
          {portfolio.positions.length === 0 ? (
            <div className="text-center text-slate-400 py-8">No open positions</div>
          ) : (
            <div className="space-y-3">
              {portfolio.positions.map((pos, idx) => (
                <div key={idx} className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/30">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-white">{pos.symbol}</div>
                      <div className="text-sm text-slate-400">Entry: ${pos.entry.toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-400">Size: {pos.size.toFixed(4)}</div>
                      <div className={`font-semibold ${pos.signal === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                        {pos.signal}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
