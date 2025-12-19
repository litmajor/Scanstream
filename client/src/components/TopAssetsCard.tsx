/**
 * Top Assets Card Component
 * 
 * Displays ranked assets by composite score with ARM confidence
 */

import React from 'react';
import type { ScanResult } from '../services/scannerService';

interface TopAssetsCardProps {
  assets: ScanResult[];
  loading?: boolean;
  onAssetClick?: (symbol: string) => void;
}

export const TopAssetsCard: React.FC<TopAssetsCardProps> = ({
  assets,
  loading = false,
  onAssetClick
}) => {
  const getSignalColor = (signal: string): string => {
    if (signal.includes('Strong Buy')) return '#00aa00';
    if (signal.includes('Buy')) return '#00dd00';
    if (signal.includes('Weak Buy')) return '#88dd00';
    if (signal.includes('Weak Sell')) return '#ffaa00';
    if (signal.includes('Sell')) return '#ff6600';
    if (signal.includes('Strong Sell')) return '#ff0000';
    return '#999999';
  };

  const getArmSignalIcon = (signal?: string): string => {
    if (signal === 'LONG') return '⬆️';
    if (signal === 'SHORT') return '⬇️';
    return '−';
  };

  if (loading) {
    return (
      <div className="top-assets-card loading">
        <h3>📈 Top Assets</h3>
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (!assets || assets.length === 0) {
    return (
      <div className="top-assets-card empty">
        <h3>📈 Top Assets</h3>
        <p>No assets to display. Run a scan to see results.</p>
      </div>
    );
  }

  return (
    <div className="top-assets-card">
      <h3>📈 Top Assets</h3>
      <div className="assets-table-container">
        <table className="assets-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Symbol</th>
              <th>Signal</th>
              <th>Score</th>
              <th>ARM</th>
              <th>Confidence</th>
              <th>Exchange</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset, idx) => (
              <tr
                key={`${asset.symbol}-${asset.exchange}`}
                className="asset-row"
                onClick={() => onAssetClick?.(asset.symbol)}
              >
                <td className="rank">{idx + 1}</td>
                <td className="symbol" style={{ fontWeight: 'bold' }}>
                  {asset.symbol}
                </td>
                <td
                  className="signal"
                  style={{
                    backgroundColor: getSignalColor(asset.signal),
                    color: 'white',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '0.85rem'
                  }}
                >
                  {asset.signal}
                </td>
                <td className="score">
                  <span
                    style={{
                      backgroundColor: '#f0f0f0',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontWeight: 'bold'
                    }}
                  >
                    {(asset.compositeScore || 0).toFixed(1)}
                  </span>
                </td>
                <td className="arm-signal" style={{ fontSize: '1.2rem' }}>
                  {getArmSignalIcon(asset.armSignal)} {asset.armSignal || '−'}
                </td>
                <td className="confidence">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '4px',
                        backgroundColor: '#ddd',
                        borderRadius: '2px',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          width: `${(asset.confidence || 0) * 100}%`,
                          height: '100%',
                          backgroundColor: (asset.confidence || 0) > 0.7 ? '#00aa00' : '#ffaa00',
                          transition: 'width 0.3s'
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.8rem' }}>
                      {((asset.confidence || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                </td>
                <td className="exchange" style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                  {asset.exchange}
                </td>
                <td className="price" style={{ textAlign: 'right' }}>
                  ${(asset.price || 0).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`
        .top-assets-card {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .top-assets-card h3 {
          margin: 0 0 1rem 0;
          font-size: 1.1rem;
          color: #333;
        }

        .top-assets-card.loading,
        .top-assets-card.empty {
          text-align: center;
          color: #999;
        }

        .loading-spinner {
          padding: 2rem;
          color: #666;
        }

        .assets-table-container {
          overflow-x: auto;
        }

        .assets-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }

        .assets-table th {
          background: #f5f5f5;
          padding: 0.75rem;
          text-align: left;
          font-weight: 600;
          border-bottom: 2px solid #ddd;
        }

        .assets-table td {
          padding: 0.75rem;
          border-bottom: 1px solid #eee;
        }

        .asset-row {
          cursor: pointer;
          transition: background 0.2s;
        }

        .asset-row:hover {
          background: #f9f9f9;
        }

        .assets-table .rank {
          text-align: center;
          font-weight: bold;
          color: #666;
        }

        .assets-table .symbol {
          color: #0066ff;
        }

        .assets-table .score {
          text-align: center;
        }

        .assets-table .arm-signal {
          text-align: center;
        }

        .assets-table .price {
          color: #333;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

export default TopAssetsCard;
