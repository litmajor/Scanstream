import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface CorrelationData {
  symbols: string[];
  correlations: number[][];
}

interface SectorData {
  name: string;
  performance: number;
  symbols: number;
  topAsset: string;
  topChange: number;
}

interface CorrelationHeatmapProps {
  correlationData?: CorrelationData;
  sectorData?: SectorData[];
  onSymbolSelect?: (symbol: string) => void;
}

export default function CorrelationHeatmap({
  correlationData,
  sectorData = [],
  onSymbolSelect,
}: CorrelationHeatmapProps) {
  // Generate demo correlation data if not provided
  const defaultCorrelationData = useMemo<CorrelationData>(() => ({
    symbols: ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOGE'],
    correlations: [
      [1.0, 0.82, 0.65, 0.58, 0.72, 0.69],
      [0.82, 1.0, 0.71, 0.53, 0.68, 0.62],
      [0.65, 0.71, 1.0, 0.48, 0.55, 0.51],
      [0.58, 0.53, 0.48, 1.0, 0.67, 0.59],
      [0.72, 0.68, 0.55, 0.67, 1.0, 0.78],
      [0.69, 0.62, 0.51, 0.59, 0.78, 1.0],
    ],
  }), []);

  const defaultSectorData = useMemo<SectorData[]>(() => [
    { name: 'Layer 1', performance: 8.5, symbols: 12, topAsset: 'BTC', topChange: 12.3 },
    { name: 'Layer 2', performance: 15.2, symbols: 8, topAsset: 'SOL', topChange: 18.7 },
    { name: 'DeFi', performance: 5.3, symbols: 24, topAsset: 'AAVE', topChange: 9.2 },
    { name: 'Metaverse', performance: -8.1, symbols: 15, topAsset: 'SAND', topChange: -5.3 },
    { name: 'Stablecoins', performance: 0.1, symbols: 6, topAsset: 'USDC', topChange: 0.0 },
  ], []);

  const correlations = correlationData || defaultCorrelationData;
  const sectors = sectorData.length > 0 ? sectorData : defaultSectorData;

  // Get color for correlation value (0 to 1)
  const getCorrelationColor = (value: number): string => {
    if (value >= 0.8) return 'bg-red-600';
    if (value >= 0.6) return 'bg-orange-500';
    if (value >= 0.4) return 'bg-yellow-500';
    if (value >= 0.2) return 'bg-blue-500';
    return 'bg-slate-600';
  };

  const getCorrelationLabel = (value: number): string => {
    if (value >= 0.8) return 'Very High';
    if (value >= 0.6) return 'High';
    if (value >= 0.4) return 'Medium';
    if (value >= 0.2) return 'Low';
    return 'Very Low';
  };

  // Get color for sector performance
  const getSectorColor = (perf: number): string => {
    if (perf >= 10) return 'text-green-400 bg-green-600/20';
    if (perf >= 5) return 'text-emerald-400 bg-emerald-600/20';
    if (perf >= 0) return 'text-slate-400 bg-slate-600/20';
    if (perf >= -5) return 'text-orange-400 bg-orange-600/20';
    return 'text-red-400 bg-red-600/20';
  };

  return (
    <div className="space-y-4">
      {/* Sector Performance Grid */}
      <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 rounded-lg border border-slate-700/50 p-4 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <span>Sector Performance</span>
        </h3>

        <div className="grid grid-cols-1 gap-2">
          {sectors.map((sector) => (
            <div
              key={sector.name}
              className="bg-slate-900/30 rounded border border-slate-700/30 p-3 hover:bg-slate-900/50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white mb-1">{sector.name}</div>
                  <div className="text-xs text-slate-400">
                    {sector.symbols} assets • Top: {sector.topAsset}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold px-2 py-1 rounded ${getSectorColor(sector.performance)}`}>
                    {sector.performance > 0 ? '+' : ''}{sector.performance.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Mini performance bar */}
              <div className="w-full bg-slate-700/30 rounded h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    sector.performance >= 5
                      ? 'bg-gradient-to-r from-green-600 to-green-400'
                      : sector.performance >= 0
                      ? 'bg-gradient-to-r from-blue-600 to-blue-400'
                      : 'bg-gradient-to-r from-red-600 to-red-400'
                  } ${
                    Math.abs(sector.performance) * 5 >= 95 ? 'w-full' :
                    Math.abs(sector.performance) * 5 >= 90 ? 'w-11/12' :
                    Math.abs(sector.performance) * 5 >= 85 ? 'w-5/6' :
                    Math.abs(sector.performance) * 5 >= 80 ? 'w-4/5' :
                    Math.abs(sector.performance) * 5 >= 75 ? 'w-3/4' :
                    Math.abs(sector.performance) * 5 >= 70 ? 'w-7/10' :
                    Math.abs(sector.performance) * 5 >= 60 ? 'w-3/5' :
                    Math.abs(sector.performance) * 5 >= 50 ? 'w-1/2' :
                    Math.abs(sector.performance) * 5 >= 40 ? 'w-2/5' :
                    Math.abs(sector.performance) * 5 >= 30 ? 'w-1/3' :
                    Math.abs(sector.performance) * 5 >= 20 ? 'w-1/5' :
                    Math.abs(sector.performance) * 5 >= 10 ? 'w-1/12' :
                    'w-0.5'
                  }`}
                />
              </div>

              {/* Top performer in sector */}
              <div className="mt-2 pt-2 border-t border-slate-700/30 flex items-center justify-between">
                <span className="text-xs text-slate-500">Top performer</span>
                <div className="flex items-center space-x-1">
                  <span className="text-xs font-semibold text-slate-300">{sector.topAsset}</span>
                  {sector.topChange >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-400" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-400" />
                  )}
                  <span className={`text-xs font-semibold ${sector.topChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {sector.topChange > 0 ? '+' : ''}{sector.topChange.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Correlation Matrix */}
      <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 rounded-lg border border-slate-700/50 p-4 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Activity className="w-4 h-4 text-purple-400" />
          <span>Symbol Correlations</span>
        </h3>

        {/* Legend */}
        <div className="flex items-center space-x-2 text-xs overflow-x-auto pb-2">
          <span className="text-slate-400 whitespace-nowrap">Correlation:</span>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded bg-red-600" />
            <span className="text-slate-400">High</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded bg-yellow-500" />
            <span className="text-slate-400">Medium</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span className="text-slate-400">Low</span>
          </div>
        </div>

        {/* Heatmap Grid - Scrollable */}
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Header row */}
            <div className="flex">
              <div className="w-12 h-12" />
              {correlations.symbols.map((symbol) => (
                <div
                  key={`header-${symbol}`}
                  className="w-12 h-12 flex items-center justify-center text-xs font-semibold text-white border-b border-r border-slate-700/30"
                >
                  {symbol}
                </div>
              ))}
            </div>

            {/* Data rows */}
            {correlations.symbols.map((rowSymbol, rowIndex) => (
              <div key={`row-${rowSymbol}`} className="flex">
                {/* Row header */}
                <div className="w-12 h-12 flex items-center justify-center text-xs font-semibold text-white bg-slate-800/30 border-b border-r border-slate-700/30">
                  {rowSymbol}
                </div>

                {/* Data cells */}
                {correlations.correlations[rowIndex].map((corrValue, colIndex) => (
                  <button
                    key={`cell-${rowIndex}-${colIndex}`}
                    onClick={() => {
                      if (rowIndex !== colIndex) {
                        onSymbolSelect?.(
                          `${correlations.symbols[rowIndex]}/${correlations.symbols[colIndex]}`
                        );
                      }
                    }}
                    title={`${getCorrelationLabel(corrValue)} correlation (${(corrValue * 100).toFixed(0)}%)`}
                    className={`w-12 h-12 flex items-center justify-center text-xs font-bold text-white border-b border-r border-slate-700/30 ${getCorrelationColor(
                      corrValue
                    )} hover:opacity-80 transition-opacity ${
                      rowIndex === colIndex ? 'opacity-50 cursor-default' : 'cursor-pointer'
                    }`}
                  >
                    {(corrValue * 100).toFixed(0)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Interpretation Guide */}
        <div className="bg-slate-900/50 rounded p-3 border border-slate-700/30 mt-3 space-y-1">
          <div className="text-xs font-semibold text-blue-400 mb-2">Interpretation:</div>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>• <span className="text-red-400">High correlation (0.8+)</span> = Move together (low diversification)</li>
            <li>• <span className="text-yellow-400">Medium correlation (0.4-0.8)</span> = Partial movement sync</li>
            <li>• <span className="text-blue-400">Low correlation (&lt;0.4)</span> = Independent movements (good diversification)</li>
          </ul>
        </div>
      </div>

      {/* Portfolio Diversification Score */}
      <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 rounded-lg border border-slate-700/50 p-4">
        <h4 className="text-sm font-bold text-white mb-3">Portfolio Diversification</h4>

        <div className="space-y-3">
          {/* Diversification metric 1 */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-400">Asset Correlation</span>
              <span className="text-sm font-semibold text-white">42%</span>
            </div>
            <div className="w-full bg-slate-700/30 rounded h-2 overflow-hidden">
              <div className="h-full w-5/12 bg-gradient-to-r from-yellow-600 to-yellow-400" />
            </div>
            <div className="text-xs text-slate-500 mt-1">Moderate - room for improvement</div>
          </div>

          {/* Diversification metric 2 */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-400">Sector Distribution</span>
              <span className="text-sm font-semibold text-white">5 Sectors</span>
            </div>
            <div className="w-full bg-slate-700/30 rounded h-2 overflow-hidden">
              <div className="h-full w-3/4 bg-gradient-to-r from-green-600 to-green-400" />
            </div>
            <div className="text-xs text-slate-500 mt-1">Good - well distributed</div>
          </div>

          {/* Diversification metric 3 */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-400">Risk Spread</span>
              <span className="text-sm font-semibold text-white">Balanced</span>
            </div>
            <div className="w-full bg-slate-700/30 rounded h-2 overflow-hidden">
              <div className="h-full w-2/3 bg-gradient-to-r from-blue-600 to-blue-400" />
            </div>
            <div className="text-xs text-slate-500 mt-1">Below max per-asset allocation</div>
          </div>
        </div>
      </div>
    </div>
  );
}
