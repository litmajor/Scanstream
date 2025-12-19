/**
 * Historical Trend Chart Component
 * 
 * Displays signal performance and confidence trends over time
 */

import React, { useMemo } from 'react';

export interface HistoryPoint {
  timestamp: number;
  signal: string;
  confidence: number;
  compositeScore: number;
}

interface HistoricalTrendChartProps {
  data: HistoryPoint[];
  symbol: string;
  loading?: boolean;
}

export const HistoricalTrendChart: React.FC<HistoricalTrendChartProps> = ({
  data,
  symbol,
  loading = false
}) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        points: [],
        minScore: 0,
        maxScore: 100,
        minTime: Date.now(),
        maxTime: Date.now()
      };
    }

    const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
    const scores = sorted.map(d => d.compositeScore);
    const minScore = Math.floor(Math.min(...scores) - 5);
    const maxScore = Math.ceil(Math.max(...scores) + 5);
    const minTime = sorted[0].timestamp;
    const maxTime = sorted[sorted.length - 1].timestamp;

    return {
      points: sorted,
      minScore: Math.max(0, minScore),
      maxScore: Math.min(100, maxScore),
      minTime,
      maxTime
    };
  }, [data]);

  const getSignalColor = (signal: string): string => {
    if (signal.includes('Strong Buy')) return '#00aa00';
    if (signal.includes('Buy')) return '#00dd00';
    if (signal.includes('Weak Buy')) return '#88dd00';
    if (signal.includes('Weak Sell')) return '#ffaa00';
    if (signal.includes('Sell')) return '#ff6600';
    if (signal.includes('Strong Sell')) return '#ff0000';
    return '#999999';
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const calculateWinRate = (): number => {
    if (chartData.points.length === 0) return 0;
    const bullishSignals = chartData.points.filter(p => p.signal.includes('Buy')).length;
    return (bullishSignals / chartData.points.length) * 100;
  };

  if (loading) {
    return (
      <div className="historical-trend-chart loading">
        <h3>📈 Historical Trend - {symbol}</h3>
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (chartData.points.length === 0) {
    return (
      <div className="historical-trend-chart empty">
        <h3>📈 Historical Trend - {symbol}</h3>
        <p>No historical data available. Scan this symbol multiple times to see trends.</p>
      </div>
    );
  }

  const timeRange = chartData.maxTime - chartData.minTime;
  const scoreRange = chartData.maxScore - chartData.minScore;

  return (
    <div className="historical-trend-chart">
      <h3>📈 Historical Trend - {symbol}</h3>

      <div className="chart-container">
        <div className="chart-area">
          <svg width="100%" height="300" viewBox="0 0 800 300" style={{ background: 'white' }}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
              const y = 30 + (1 - ratio) * 240;
              const score = chartData.minScore + ratio * scoreRange;
              return (
                <g key={`grid-${ratio}`}>
                  <line x1="40" y1={y} x2="780" y2={y} stroke="#eee" strokeWidth="1" />
                  <text
                    x="35"
                    y={y + 4}
                    fontSize="10"
                    textAnchor="end"
                    fill="#999"
                  >
                    {score.toFixed(0)}
                  </text>
                </g>
              );
            })}

            {/* Score line */}
            <polyline
              points={chartData.points
                .map((point, idx) => {
                  const x = 40 + ((point.timestamp - chartData.minTime) / timeRange) * 740;
                  const y = 30 + (1 - (point.compositeScore - chartData.minScore) / scoreRange) * 240;
                  return `${x},${y}`;
                })
                .join(' ')}
              stroke="#0066ff"
              strokeWidth="2"
              fill="none"
              style={{ pointerEvents: 'none' }}
            />

            {/* Data points */}
            {chartData.points.map((point, idx) => {
              const x = 40 + ((point.timestamp - chartData.minTime) / timeRange) * 740;
              const y = 30 + (1 - (point.compositeScore - chartData.minScore) / scoreRange) * 240;
              const color = getSignalColor(point.signal);

              return (
                <g key={idx} className="data-point">
                  <circle
                    cx={x}
                    cy={y}
                    r="4"
                    fill={color}
                    stroke="white"
                    strokeWidth="2"
                    style={{ cursor: 'pointer' }}
                  >
                    <title>{`${point.signal} @ ${formatTime(point.timestamp)} (Score: ${point.compositeScore.toFixed(1)})`}</title>
                  </circle>
                </g>
              );
            })}

            {/* Axes */}
            <line x1="40" y1="270" x2="780" y2="270" stroke="#333" strokeWidth="2" />
            <line x1="40" y1="30" x2="40" y2="270" stroke="#333" strokeWidth="2" />

            {/* Axis labels */}
            <text x="410" y="295" fontSize="12" textAnchor="middle" fill="#333">
              Time
            </text>
            <text x="15" y="155" fontSize="12" textAnchor="middle" fill="#333" transform="rotate(-90 15 155)">
              Score
            </text>
          </svg>
        </div>

        <div className="chart-stats">
          <div className="stat-box">
            <span className="stat-label">Total Scans:</span>
            <span className="stat-value">{chartData.points.length}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Avg Score:</span>
            <span className="stat-value">
              {(
                chartData.points.reduce((sum, p) => sum + p.compositeScore, 0) /
                chartData.points.length
              ).toFixed(1)}
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Bullish Rate:</span>
            <span className="stat-value">{calculateWinRate().toFixed(1)}%</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Time Range:</span>
            <span className="stat-value">
              {Math.round((chartData.maxTime - chartData.minTime) / (1000 * 60))} min
            </span>
          </div>
        </div>
      </div>

      <div className="legend">
        <div className="legend-item">
          <span style={{ backgroundColor: '#00aa00' }} className="legend-color" />
          <span>Strong Buy</span>
        </div>
        <div className="legend-item">
          <span style={{ backgroundColor: '#00dd00' }} className="legend-color" />
          <span>Buy</span>
        </div>
        <div className="legend-item">
          <span style={{ backgroundColor: '#88dd00' }} className="legend-color" />
          <span>Weak Buy</span>
        </div>
        <div className="legend-item">
          <span style={{ backgroundColor: '#ffaa00' }} className="legend-color" />
          <span>Weak Sell</span>
        </div>
        <div className="legend-item">
          <span style={{ backgroundColor: '#ff6600' }} className="legend-color" />
          <span>Sell</span>
        </div>
        <div className="legend-item">
          <span style={{ backgroundColor: '#ff0000' }} className="legend-color" />
          <span>Strong Sell</span>
        </div>
      </div>

      <style>{`
        .historical-trend-chart {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .historical-trend-chart h3 {
          margin: 0 0 1rem 0;
          font-size: 1.1rem;
          color: #333;
        }

        .historical-trend-chart.loading,
        .historical-trend-chart.empty {
          text-align: center;
          color: #999;
        }

        .loading-spinner {
          padding: 2rem;
          color: #666;
        }

        .chart-container {
          display: flex;
          gap: 1.5rem;
          margin-bottom: 1rem;
        }

        .chart-area {
          flex: 1;
          border: 1px solid #eee;
          border-radius: 4px;
          background: #fafafa;
          overflow-x: auto;
        }

        .chart-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          flex: 0 0 auto;
        }

        .stat-box {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          padding: 0.75rem;
          background: #f5f5f5;
          border-radius: 4px;
          border: 1px solid #eee;
        }

        .stat-label {
          font-size: 0.8rem;
          color: #666;
          font-weight: 500;
        }

        .stat-value {
          font-size: 1.2rem;
          font-weight: 600;
          color: #333;
        }

        .legend {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #eee;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: #666;
        }

        .legend-color {
          display: inline-block;
          width: 12px;
          height: 12px;
          border-radius: 2px;
        }

        .data-point circle:hover {
          r: 6;
          filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.3));
        }
      `}</style>
    </div>
  );
};

export default HistoricalTrendChart;
