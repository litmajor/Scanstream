import React, { useState, useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import { Symbol } from '../pages/symbol-universe';

interface CorrelationMatrixProps {
  symbols: Symbol[];
}

export default function CorrelationMatrix({ symbols }: CorrelationMatrixProps) {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(symbols.slice(0, 10).map(s => s.symbol));

  // Generate mock correlation data
  const correlationData = useMemo(() => {
    const matrix: number[][] = [];
    
    for (let i = 0; i < selectedSymbols.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < selectedSymbols.length; j++) {
        if (i === j) {
          matrix[i][j] = 1; // Perfect correlation with itself
        } else {
          // Random correlation between -1 and 1
          matrix[i][j] = (Math.random() * 2) - 1;
        }
      }
    }
    
    return matrix;
  }, [selectedSymbols]);

  const getCorrelationColor = (value: number) => {
    if (value > 0.7) return 'bg-green-600';
    if (value > 0.3) return 'bg-amber-500';
    if (value > -0.3) return 'bg-gray-600';
    if (value > -0.7) return 'bg-red-500';
    return 'bg-red-700';
  };

  const getCorrelationLabel = (value: number) => {
    if (value > 0.7) return '🟢 Strong Positive';
    if (value > 0.3) return '🟡 Moderate Positive';
    if (value > -0.3) return '⚪ Weak';
    if (value > -0.7) return '🔴 Moderate Negative';
    return '🔴 Strong Negative';
  };

  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol].slice(0, 15) // Limit to 15 symbols
    );
  };

  return (
    <div className="space-y-6">
      {/* Symbol Selector */}
      <div className="bg-slate-800/20 border border-slate-700/30 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Select Symbols for Correlation Analysis</h3>
        <div className="flex flex-wrap gap-2">
          {symbols.map((symbol) => (
            <button
              key={symbol.symbol}
              onClick={() => toggleSymbol(symbol.symbol)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                selectedSymbols.includes(symbol.symbol)
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {symbol.symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Correlation Matrix Heatmap */}
      <div className="bg-slate-800/20 border border-slate-700/30 rounded-lg p-4 overflow-x-auto">
        <div className="inline-block">
          <div className="flex">
            {/* Column headers */}
            <div className="flex flex-col">
              <div className="w-16 h-12" />
              {selectedSymbols.map((symbol) => (
                <div
                  key={`row-${symbol}`}
                  className="w-16 h-12 flex items-center justify-center text-xs font-bold text-white border border-slate-700/30"
                >
                  {symbol}
                </div>
              ))}
            </div>

            {/* Matrix cells */}
            <div className="flex flex-col">
              <div className="flex">
                {selectedSymbols.map((symbol) => (
                  <div
                    key={`col-${symbol}`}
                    className="w-12 h-12 flex items-center justify-center text-xs font-bold text-white border border-slate-700/30 bg-slate-900/50"
                  >
                    {symbol}
                  </div>
                ))}
              </div>

              {selectedSymbols.map((row, rowIdx) => (
                <div key={row} className="flex">
                  {selectedSymbols.map((col, colIdx) => {
                    const correlation = correlationData[rowIdx][colIdx];
                    return (
                      <div
                        key={`${row}-${col}`}
                        className={`w-12 h-12 flex items-center justify-center text-xs font-bold text-white border border-slate-700/30 cursor-pointer hover:opacity-80 transition-opacity ${getCorrelationColor(
                          correlation
                        )}`}
                        title={`${row} ↔ ${col}: ${correlation.toFixed(3)}`}
                      >
                        {(correlation * 100).toFixed(0)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Correlation Legend and Insights */}
      <div className="grid grid-cols-2 gap-4">
        {/* Legend */}
        <div className="bg-slate-800/20 border border-slate-700/30 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Correlation Strength</h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-600 rounded" />
              <span className="text-slate-300">&gt; 0.7: Strong Positive</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-amber-500 rounded" />
              <span className="text-slate-300">0.3 to 0.7: Moderate Positive</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-600 rounded" />
              <span className="text-slate-300">-0.3 to 0.3: Weak</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded" />
              <span className="text-slate-300">-0.7 to -0.3: Moderate Negative</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-700 rounded" />
              <span className="text-slate-300">&lt; -0.7: Strong Negative</span>
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="bg-slate-800/20 border border-slate-700/30 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Portfolio Insights</h3>
          <div className="space-y-2 text-xs text-slate-300">
            <div>
              <strong className="text-green-400">✓ Diversification:</strong> Low correlations reduce portfolio risk
            </div>
            <div>
              <strong className="text-amber-400">⚠ Hedging:</strong> Negative correlations provide hedge opportunities
            </div>
            <div>
              <strong className="text-blue-400">ℹ Momentum:</strong> High correlations suggest synchronized movements
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-300 flex gap-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Correlation Analysis:</strong> Shows how different assets move together. Use this to diversify your portfolio and identify hedging opportunities.
        </div>
      </div>
    </div>
  );
}
