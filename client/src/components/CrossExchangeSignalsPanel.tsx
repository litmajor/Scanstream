/**
 * Cross-Exchange Signals Panel Component
 * 
 * Displays multi-exchange signals (consensus, divergence, arbitrage, etc.)
 */

import React from 'react';
import type { CrossExchangeSignal } from '../services/scannerService';

interface CrossExchangeSignalsPanelProps {
  signals: CrossExchangeSignal[];
  loading?: boolean;
  onSignalClick?: (signal: CrossExchangeSignal) => void;
}

export const CrossExchangeSignalsPanel: React.FC<CrossExchangeSignalsPanelProps> = ({
  signals,
  loading = false,
  onSignalClick
}) => {
  const getSignalTypeConfig = (type: string) => {
    const configs: Record<string, { color: string; bgColor: string; icon: string; label: string }> = {
      CONSENSUS: {
        color: '#00aa00',
        bgColor: '#f0fff0',
        icon: '🤝',
        label: 'All exchanges align'
      },
      DIVERGENCE: {
        color: '#ff6600',
        bgColor: '#fff5f0',
        icon: '⚠️',
        label: 'Mixed signals (risky)'
      },
      ARBITRAGE: {
        color: '#0066ff',
        bgColor: '#f0f5ff',
        icon: '💱',
        label: 'Price divergence opportunity'
      },
      ACCUMULATION: {
        color: '#6600ff',
        bgColor: '#f5f0ff',
        icon: '📈',
        label: 'High volume + bullish'
      },
      DISTRIBUTION: {
        color: '#ff0000',
        bgColor: '#fff0f0',
        icon: '📉',
        label: 'High volume + bearish'
      }
    };

    return configs[type] || {
      color: '#999',
      bgColor: '#f5f5f5',
      icon: '•',
      label: type
    };
  };

  if (loading) {
    return (
      <div className="cross-exchange-panel loading">
        <h3>🔗 Cross-Exchange Signals</h3>
        <div className="loading-spinner">Loading signals...</div>
      </div>
    );
  }

  if (!signals || signals.length === 0) {
    return (
      <div className="cross-exchange-panel empty">
        <h3>🔗 Cross-Exchange Signals</h3>
        <p>No cross-exchange signals detected. Run a multi-exchange scan for better signal detection.</p>
      </div>
    );
  }

  // Group signals by type
  const signalsByType = signals.reduce((acc, signal) => {
    if (!acc[signal.type]) acc[signal.type] = [];
    acc[signal.type].push(signal);
    return acc;
  }, {} as Record<string, CrossExchangeSignal[]>);

  return (
    <div className="cross-exchange-panel">
      <h3>🔗 Cross-Exchange Signals</h3>
      <div className="signals-container">
        {Object.entries(signalsByType).map(([type, typeSignals]) => {
          const config = getSignalTypeConfig(type);
          return (
            <div key={type} className="signal-type-group">
              <div className="signal-type-header" style={{ borderLeftColor: config.color }}>
                <span className="icon">{config.icon}</span>
                <span className="type-label">{type}</span>
                <span className="count">{typeSignals.length}</span>
              </div>
              <div className="signals-list">
                {typeSignals.map((signal, idx) => (
                  <div
                    key={idx}
                    className="signal-item"
                    style={{ backgroundColor: config.bgColor }}
                    onClick={() => onSignalClick?.(signal)}
                  >
                    <div className="signal-header">
                      <span className="symbol" style={{ color: config.color, fontWeight: 'bold' }}>
                        {signal.symbol}
                      </span>
                      <span className="confidence-badge" style={{ backgroundColor: config.color }}>
                        {(signal.confidence * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div className="signal-details">
                      <div className="detail-row">
                        <span className="label">Exchanges:</span>
                        <span className="value">
                          {signal.exchanges.join(', ')}
                        </span>
                      </div>

                      {signal.avgCompositeScore !== undefined && (
                        <div className="detail-row">
                          <span className="label">Avg Score:</span>
                          <span className="value">
                            {(signal.avgCompositeScore || 0).toFixed(1)}
                          </span>
                        </div>
                      )}

                      {signal.description && (
                        <div className="detail-row full-width">
                          <span className="description">{signal.description}</span>
                        </div>
                      )}
                    </div>

                    <div className="signal-meta">
                      <span className="meta-label">{config.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .cross-exchange-panel {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .cross-exchange-panel h3 {
          margin: 0 0 1rem 0;
          font-size: 1.1rem;
          color: #333;
        }

        .cross-exchange-panel.loading,
        .cross-exchange-panel.empty {
          text-align: center;
          color: #999;
        }

        .loading-spinner {
          padding: 2rem;
          color: #666;
        }

        .signals-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .signal-type-group {
          border-radius: 8px;
          overflow: hidden;
        }

        .signal-type-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: #f5f5f5;
          border-left: 4px solid;
          font-weight: 600;
        }

        .signal-type-header .icon {
          font-size: 1.5rem;
        }

        .signal-type-header .type-label {
          flex: 1;
        }

        .signal-type-header .count {
          background: #ddd;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: normal;
        }

        .signals-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
          padding: 1rem;
        }

        .signal-item {
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 6px;
          padding: 1rem;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .signal-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .signal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .signal-header .symbol {
          font-size: 0.95rem;
        }

        .confidence-badge {
          color: white;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .signal-details {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          font-size: 0.85rem;
        }

        .detail-row {
          display: flex;
          gap: 0.5rem;
        }

        .detail-row.full-width {
          flex-direction: column;
        }

        .detail-row .label {
          font-weight: 600;
          color: #666;
          min-width: 80px;
        }

        .detail-row .value {
          color: #333;
          flex: 1;
        }

        .detail-row .description {
          color: #555;
          font-style: italic;
        }

        .signal-meta {
          padding-top: 0.5rem;
          border-top: 1px solid rgba(0, 0, 0, 0.05);
          font-size: 0.8rem;
          color: #666;
        }

        .signal-meta .meta-label {
          display: inline-block;
          padding: 2px 6px;
          background: rgba(0, 0, 0, 0.05);
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
};

export default CrossExchangeSignalsPanel;
