import React from 'react';
import usePerformanceMark from '../hooks/usePerformanceMark';
import { ArrowUpRight, ArrowDownRight, X, Pencil } from 'lucide-react';
import { Card } from './Card';
import { Badge } from './Badge';

export interface PositionCardProps {
  symbol: string;
  size?: number; // quantity
  entryPrice: number;
  markPrice: number;
  pnlPercent?: number; // percent
  side: 'LONG' | 'SHORT';
  openedAt?: string; // iso date
  onClose?: () => void;
  onEdit?: () => void;
}

/**
 * PositionCard - lightweight display for an open position
 * Phase 3: uses `.position-card` and PnL utilities from components.css
 */
export const PositionCard: React.FC<PositionCardProps> = ({
  symbol,
  size = 0,
  entryPrice,
  markPrice,
  pnlPercent = 0,
  side,
  openedAt,
  onClose,
  onEdit,
}) => {
  const pnlPositive = pnlPercent >= 0;
  const pnlColor = pnlPositive ? 'var(--color-bullish)' : 'var(--color-bearish)';
  const sideBadge = side === 'LONG' ? 'Buy' : 'Sell';
  const sideIcon = side === 'LONG' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />;

  try { usePerformanceMark(`PositionCard:${symbol}`); } catch (e) {}

  return (
    <Card className={`position-card ${pnlPositive ? 'position-pnl-positive' : 'position-pnl-negative'}`} interactive style={{ padding: 0 }}>
      <div style={{ padding: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}> 
        <div style={{ flex: '1 1 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>{symbol}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>{size} @ ${entryPrice.toFixed(2)}</div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: pnlColor, fontFamily: 'var(--font-mono)' }}>
                {pnlPositive ? '+' : ''}{pnlPercent.toFixed(2)}%
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>Mark ${markPrice.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Badge variant={side === 'LONG' ? 'success' : 'error'} size="sm">
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>{sideIcon}{sideBadge}</span>
          </Badge>

          <button aria-label="Edit position" title="Edit position" onClick={onEdit} className="button button-ghost" style={{ padding: 'var(--space-2)', borderRadius: '6px' }}>
            <Pencil size={14} />
          </button>

          <button aria-label="Close position" title="Close position" onClick={onClose} className="button button-danger" style={{ padding: 'var(--space-2)', borderRadius: '6px' }}>
            <X size={14} />
          </button>
        </div>
      </div>
    </Card>
  );
};

export default React.memo(PositionCard);
