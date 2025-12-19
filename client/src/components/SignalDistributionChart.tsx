/**
 * Signal Distribution Chart Component
 * 
 * Displays signal distribution per exchange
 */

import React, { useMemo } from 'react';
import type { ScanResult } from '../services/scannerService';

interface SignalDistributionChartProps {
  results: ScanResult[];
  loading?: boolean;
}

export const SignalDistributionChart: React.FC<SignalDistributionChartProps> = ({
  results,
  loading = false
}) => {
  const signalDistribution = useMemo(() => {
    if (!results || results.length === 0) {
      return {};
    }

    const distribution: Record<string, Record<string, number>> = {};

    results.forEach(result => {
      if (!distribution[result.exchange]) {
        distribution[result.exchange] = {
          'Strong Buy': 0,
          'Buy': 0,
          'Weak Buy': 0,
          'Neutral': 0,
          'Weak Sell': 0,
          'Sell': 0,
          'Strong Sell': 0
        };
      }
      distribution[result.exchange][result.signal] = (distribution[result.exchange][result.signal] || 0) + 1;
    });

    return distribution;
  }, [results]);

  const getSignalColor = (signal: string): string => {
    if (signal.includes('Strong Buy')) return '#00aa00';
    if (signal.includes('Buy')) return '#00dd00';
    if (signal.includes('Weak Buy')) return '#88dd00';
    if (signal.includes('Weak Sell')) return '#ffaa00';
    if (signal.includes('Sell')) return '#ff6600';
    if (signal.includes('Strong Sell')) return '#ff0000';
    return '#999999';
  };

  if (loading) {
    return (
      <div className="signal-distribution-chart loading">
        <h3>📊 Signal Distribution by Exchange</h3>
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  const exchanges = Object.keys(signalDistribution);
  if (exchanges.length === 0) {
    return (
      <div className="signal-distribution-chart empty">
        <h3>📊 Signal Distribution by Exchange</h3>
        <p>No data available. Run a scan to see signal distribution.</p>
      </div>
    );
  }

  return (
    <div className="signal-distribution-chart">
      <h3>📊 Signal Distribution by Exchange</h3>
      <div className="distribution-container">
        {exchanges.map(exchange => {
          const signals = signalDistribution[exchange];
          const total = Object.values(signals).reduce((sum, count) => sum + count, 0);
          const signalEntries = Object.entries(signals).filter(([_, count]) => count > 0);

          return (
            <div key={exchange} className="exchange-distribution">
              <div className="exchange-name">{exchange.toUpperCase()}</div>
              <div className="signals-bar">
                {signalEntries.map(([signal, count]) => {
                  const percentage = (count / total) * 100;
                  return (
                    <div
                      key={signal}
                      className="signal-segment"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: getSignalColor(signal),
                        minWidth: percentage > 5 ? undefined : 'auto'
                      }}
                      title={`${signal}: ${count} (${percentage.toFixed(1)}%)`}
                    >
                      {percentage > 8 && (
                        <span className="segment-label">{count}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="exchange-stats">
                <span className="stat-label">Total: {total}</span>
                {signalEntries.map(([signal, count]) => (
                  <div key={signal} className="stat-item">
                    <span
                      className="stat-color"
                      style={{ backgroundColor: getSignalColor(signal) }}
                    />
                    <span className="stat-text">
                      {signal}: {count} ({((count / total) * 100).toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .signal-distribution-chart {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .signal-distribution-chart h3 {
          margin: 0 0 1rem 0;
          font-size: 1.1rem;
          color: #333;
        }

        .signal-distribution-chart.loading,
        .signal-distribution-chart.empty {
          text-align: center;
          color: #999;
        }

        .loading-spinner {
          padding: 2rem;
          color: #666;
        }

        .distribution-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .exchange-distribution {
          border: 1px solid #eee;
          border-radius: 6px;
          padding: 1rem;
          background: #f9f9f9;
        }

        .exchange-name {
          font-weight: 600;
          color: #333;
          margin-bottom: 0.75rem;
          font-size: 0.95rem;
        }

        .signals-bar {
          display: flex;
          height: 40px;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 0.75rem;
          border: 1px solid #ddd;
        }

        .signal-segment {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          flex: 0;
          transition: opacity 0.2s;
        }

        .signal-segment:hover {
          opacity: 0.8;
        }

        .segment-label {
          color: white;
          font-size: 0.75rem;
          font-weight: 600;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .exchange-stats {
          font-size: 0.85rem;
          color: #666;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .stat-label {
          font-weight: 600;
          color: #333;
          margin-bottom: 0.25rem;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .stat-color {
          display: inline-block;
          width: 12px;
          height: 12px;
          border-radius: 2px;
        }

        .stat-text {
          color: #666;
        }
      `}</style>
    </div>
  );
};

export default SignalDistributionChart;
