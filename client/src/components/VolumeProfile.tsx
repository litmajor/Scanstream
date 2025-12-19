import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity, AlertCircle } from 'lucide-react';
import { Symbol } from '../pages/symbol-universe';

interface VolumeProfileProps {
  symbols: Symbol[];
  selectedSymbol?: string;
}

interface VolumeData {
  priceLevel: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
}

export default function VolumeProfile({ symbols, selectedSymbol }: VolumeProfileProps) {
  const [timeframe, setTimeframe] = useState<'1H' | '4H' | '1D' | '1W'>('1D');
  const [view, setView] = useState<'profile' | 'history' | 'anomalies'>('profile');

  // Mock volume profile data - would come from API
  const volumeData = useMemo<VolumeData[]>(() => {
    const symbol = symbols.find((s) => s.symbol === selectedSymbol);
    if (!symbol) return [];

    // Generate mock volume distribution around current price
    const basePrice = symbol.price;
    const levels = [];

    for (let i = 0; i < 30; i++) {
      const priceLevel = basePrice * (0.95 + (i * 0.003));
      const distanceFromPrice = Math.abs(priceLevel - basePrice) / basePrice;
      const volumeDistribution = Math.exp(-distanceFromPrice * 10); // Bell curve distribution

      levels.push({
        priceLevel: parseFloat(priceLevel.toFixed(2)),
        volume: Math.floor(volumeDistribution * symbol.volume24h),
        buyVolume: Math.floor((volumeDistribution * symbol.volume24h * 55) / 100),
        sellVolume: Math.floor((volumeDistribution * symbol.volume24h * 45) / 100),
      });
    }

    return levels.sort((a, b) => a.priceLevel - b.priceLevel);
  }, [symbols, selectedSymbol]);

  // Historical volume data
  const historicalVolume = useMemo(() => {
    const periods = timeframe === '1H' ? 24 : timeframe === '4H' ? 30 : timeframe === '1D' ? 30 : 52;
    const labels = [];
    const volumes = [];
    const averageVolume = [];

    const baseVolume = symbols[0]?.volume24h || 0;

    for (let i = 0; i < periods; i++) {
      if (timeframe === '1H') {
        labels.push(`${i}:00`);
      } else if (timeframe === '4H') {
        labels.push(`Day ${i}`);
      } else if (timeframe === '1D') {
        labels.push(`Day ${i}`);
      } else {
        labels.push(`Week ${i}`);
      }

      const volume = baseVolume * (0.5 + Math.random() * 1.5);
      volumes.push(volume);
      averageVolume.push(baseVolume);
    }

    return { labels, volumes, averageVolume };
  }, [timeframe, symbols]);

  // Volume anomalies detection
  const anomalies = useMemo(() => {
    const avgVolume = historicalVolume.volumes.reduce((a, b) => a + b, 0) / historicalVolume.volumes.length;
    const stdDev = Math.sqrt(
      historicalVolume.volumes.reduce((sum, v) => sum + Math.pow(v - avgVolume, 2), 0) /
        historicalVolume.volumes.length
    );

    return historicalVolume.volumes
      .map((vol, idx) => ({
        period: historicalVolume.labels[idx],
        volume: vol,
        deviation: ((vol - avgVolume) / stdDev).toFixed(2),
      }))
      .filter((a) => Math.abs(parseFloat(a.deviation)) > 1.5)
      .slice(-5);
  }, [historicalVolume]);

  const maxVolume = Math.max(...volumeData.map((d) => d.volume), 1);
  const maxHistoricalVolume = Math.max(...historicalVolume.volumes, 1);

  const symbol = symbols.find((s) => s.symbol === selectedSymbol);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Volume Profile
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {symbol ? `${symbol.symbol} • 24h Volume: $${(symbol.volume24h / 1e9).toFixed(2)}B` : 'Select a symbol'}
          </p>
        </div>

        {/* Timeframe Selector */}
        <div className="flex gap-2">
          {(['1H', '4H', '1D', '1W'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                timeframe === tf
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-slate-700/30">
        {(['profile', 'history', 'anomalies'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
              view === v
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* Volume Profile View */}
      {view === 'profile' && (
        <div className="bg-slate-800/20 border border-slate-700/30 rounded-lg p-4">
          <div className="space-y-3">
            {volumeData.length > 0 ? (
              volumeData.map((data, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">${data.priceLevel.toFixed(2)}</span>
                    <span className="text-slate-500">{(data.volume / 1e6).toFixed(1)}M</span>
                  </div>

                  <div className="flex gap-1 h-6">
                    {/* Buy volume bar */}
                    <div
                      className="bg-green-500/60 rounded-l"
                      style={{
                        width: `${(data.buyVolume / maxVolume) * 60}%`,
                      }}
                      title={`Buy: ${(data.buyVolume / 1e6).toFixed(1)}M`}
                    />

                    {/* Sell volume bar */}
                    <div
                      className="bg-red-500/60 rounded-r"
                      style={{
                        width: `${(data.sellVolume / maxVolume) * 40}%`,
                      }}
                      title={`Sell: ${(data.sellVolume / 1e6).toFixed(1)}M`}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-400 py-8">No data available. Select a symbol.</div>
            )}
          </div>

          {/* Legend */}
          <div className="flex gap-6 mt-6 pt-4 border-t border-slate-700/30 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500/60 rounded" />
              <span className="text-slate-300">Buy Volume (55%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500/60 rounded" />
              <span className="text-slate-300">Sell Volume (45%)</span>
            </div>
          </div>
        </div>
      )}

      {/* Historical Volume View */}
      {view === 'history' && (
        <div className="bg-slate-800/20 border border-slate-700/30 rounded-lg p-4">
          <div className="space-y-4">
            {/* Chart representation */}
            <div className="h-32 flex items-flex-end gap-1">
              {historicalVolume.volumes.map((vol, idx) => {
                const isAboveAverage = vol > historicalVolume.averageVolume[idx];
                return (
                  <div
                    key={idx}
                    className={`flex-1 rounded-t transition-all hover:opacity-80 cursor-pointer group relative ${
                      isAboveAverage ? 'bg-green-500/60' : 'bg-blue-500/60'
                    }`}
                    style={{
                      height: `${(vol / maxHistoricalVolume) * 100}%`,
                    }}
                    title={`${historicalVolume.labels[idx]}: ${(vol / 1e9).toFixed(2)}B`}
                  >
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                      {(vol / 1e9).toFixed(2)}B
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-700/30">
              <div className="bg-slate-800/30 rounded p-3">
                <div className="text-xs text-slate-500 mb-1">Avg Volume</div>
                <div className="text-sm font-bold text-white">
                  ${(
                    historicalVolume.volumes.reduce((a, b) => a + b, 0) / historicalVolume.volumes.length /
                    1e9
                  ).toFixed(2)}B
                </div>
              </div>
              <div className="bg-slate-800/30 rounded p-3">
                <div className="text-xs text-slate-500 mb-1">Peak Volume</div>
                <div className="text-sm font-bold text-green-400">
                  ${(Math.max(...historicalVolume.volumes) / 1e9).toFixed(2)}B
                </div>
              </div>
              <div className="bg-slate-800/30 rounded p-3">
                <div className="text-xs text-slate-500 mb-1">Min Volume</div>
                <div className="text-sm font-bold text-red-400">
                  ${(Math.min(...historicalVolume.volumes) / 1e9).toFixed(2)}B
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Anomalies View */}
      {view === 'anomalies' && (
        <div className="bg-slate-800/20 border border-slate-700/30 rounded-lg p-4">
          {anomalies.length > 0 ? (
            <div className="space-y-2">
              {anomalies.map((anomaly, idx) => {
                const deviation = parseFloat(anomaly.deviation);
                const isSpike = deviation > 0;

                return (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-800/30 rounded hover:bg-slate-800/50 transition-all">
                    <div className={`p-2 rounded ${isSpike ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
                      {isSpike ? (
                        <TrendingUp className={`w-4 h-4 ${isSpike ? 'text-red-400' : 'text-blue-400'}`} />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-blue-400" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{anomaly.period}</div>
                      <div className="text-xs text-slate-400">
                        {isSpike ? 'Volume Spike' : 'Volume Drop'} ({Math.abs(deviation)}σ)
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold text-white">${(anomaly.volume / 1e9).toFixed(2)}B</div>
                      <div
                        className={`text-xs font-medium ${isSpike ? 'text-red-400' : 'text-blue-400'}`}
                      >
                        {isSpike ? '+' : ''}{deviation}σ
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No significant volume anomalies detected</p>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-300 flex gap-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Volume Profile:</strong> Shows the distribution of trading volume at different price levels. Higher bars = more trading activity. Green = buyer volume, Red = seller volume.
        </div>
      </div>
    </div>
  );
}
