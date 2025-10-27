import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface SignalStrengthHeatmapProps {
  signals: {
    symbol: string;
    timeframes: {
      '1m': number;
      '5m': number;
      '15m': number;
      '1h': number;
      '4h': number;
      '1d': number;
    };
  }[];
}

export default function SignalStrengthHeatmap({ signals }: SignalStrengthHeatmapProps) {
  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
  
  const getStrengthColor = (strength: number) => {
    if (strength >= 80) return 'bg-green-500';
    if (strength >= 60) return 'bg-green-400';
    if (strength >= 40) return 'bg-yellow-400';
    if (strength >= 20) return 'bg-orange-400';
    return 'bg-red-400';
  };

  const getStrengthLabel = (strength: number) => {
    if (strength >= 80) return 'Very Strong';
    if (strength >= 60) return 'Strong';
    if (strength >= 40) return 'Moderate';
    if (strength >= 20) return 'Weak';
    return 'Very Weak';
  };

  return (
    <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Activity className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-bold text-white">Signal Strength Heatmap</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Symbol</th>
              {timeframes.map(tf => (
                <th key={tf} className="text-center py-3 px-4 text-sm font-semibold text-slate-400">
                  {tf}
                </th>
              ))}
              <th className="text-center py-3 px-4 text-sm font-semibold text-slate-400">Avg</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((signal, idx) => {
              const avgStrength = timeframes.reduce((sum, tf) => sum + signal.timeframes[tf], 0) / timeframes.length;
              return (
                <tr key={idx} className="border-b border-slate-700/30 hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-mono text-sm font-semibold text-white">{signal.symbol}</span>
                  </td>
                  {timeframes.map(tf => {
                    const strength = signal.timeframes[tf];
                    return (
                      <td key={tf} className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <div
                            className={`w-12 h-8 rounded ${getStrengthColor(strength)} transition-all hover:scale-110 cursor-pointer`}
                            title={`${signal.symbol} ${tf}: ${strength}% (${getStrengthLabel(strength)})`}
                          >
                            <span className="text-white text-xs font-bold flex items-center justify-center h-full">
                              {strength}
                            </span>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                  <td className="py-3 px-4 text-center">
                    <div className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg ${
                      avgStrength >= 60 ? 'bg-green-900/30 text-green-400' :
                      avgStrength >= 40 ? 'bg-yellow-900/30 text-yellow-400' :
                      'bg-red-900/30 text-red-400'
                    }`}>
                      {avgStrength >= 50 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      <span className="text-sm font-bold">{avgStrength.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center space-x-4 text-xs">
        <span className="text-slate-400">Strength:</span>
        <div className="flex items-center space-x-1">
          <div className="w-8 h-4 bg-red-400 rounded"></div>
          <span className="text-slate-300">0-20%</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-8 h-4 bg-orange-400 rounded"></div>
          <span className="text-slate-300">20-40%</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-8 h-4 bg-yellow-400 rounded"></div>
          <span className="text-slate-300">40-60%</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-8 h-4 bg-green-400 rounded"></div>
          <span className="text-slate-300">60-80%</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-8 h-4 bg-green-500 rounded"></div>
          <span className="text-slate-300">80-100%</span>
        </div>
      </div>
    </div>
  );
}
