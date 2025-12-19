import React, { useMemo, useCallback } from 'react';
import { AlertCircle, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { Card } from './Card';
import { Badge } from './Badge';
import usePerformanceMark from '../hooks/usePerformanceMark';

export interface SignalCardProps {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence?: number; // 0-100
  reasoning?: string;
  riskReward?: string;
  momentumLabel?: string;
  momentum?: number; // -100 to 100
  price?: number;
  change24h?: number;
  loading?: boolean;
}

/**
 * SignalCard Component - Displays trading signal with confidence and reasoning
 * Part of the Week 1 trading terminal redesign
 * Uses: Card, Badge, typography system
 */
export const SignalCard: React.FC<SignalCardProps> = ({
  symbol,
  signal,
  confidence = 50,
  reasoning = 'Technical analysis in progress...',
  riskReward = '1:2',
  momentumLabel = 'Neutral',
  momentum = 0,
  price,
  change24h,
  loading = false,
}) => {
  // Determine signal color
  const signalColor = useMemo(() => {
    switch (signal) {
      case 'BUY':
        return 'var(--color-bullish)';
      case 'SELL':
        return 'var(--color-bearish)';
      default:
        return 'var(--color-neutral)';
    }
  }, [signal]);

  const signalBadgeVariant = useMemo(() => {
    switch (signal) {
      case 'BUY':
        return 'success' as const;
      case 'SELL':
        return 'error' as const;
      default:
        return 'neutral' as const;
    }
  }, [signal]);

  // Confidence color gradient
  const confidenceColor = useMemo(() => {
    if (confidence >= 75) return 'var(--color-bullish)';
    if (confidence >= 50) return 'var(--color-warning)';
    return 'var(--color-neutral)';
  }, [confidence]);

  // Momentum color
  const momentumColor = useMemo(() => {
    if (momentum > 20) return 'var(--color-bullish)';
    if (momentum < -20) return 'var(--color-bearish)';
    return 'var(--color-neutral)';
  }, [momentum]);

  if (loading) {
    return (
      <Card className="signal-card signal-card-gradient-neutral" interactive>
        <div style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div style={{ backgroundColor: 'var(--color-bg-tertiary)', height: '20px', borderRadius: '4px', width: '40%', animation: 'skeleton-shimmer 2s infinite' }} />
            <div style={{ backgroundColor: 'var(--color-bg-tertiary)', height: '24px', borderRadius: '4px', width: '30%', animation: 'skeleton-shimmer 2s infinite' }} />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ backgroundColor: 'var(--color-bg-tertiary)', height: '16px', borderRadius: '4px', marginBottom: 'var(--space-2)', animation: 'skeleton-shimmer 2s infinite' }} />
          ))}
        </div>
      </Card>
    );
  }

  const gradientClass = signal === 'BUY' ? 'signal-card-gradient-buy' : signal === 'SELL' ? 'signal-card-gradient-sell' : 'signal-card-gradient-neutral';
  try { usePerformanceMark(`SignalCard:${symbol}`); } catch (e) {}

  const handleViewDetails = useCallback(() => {
    // Dispatch a cross-app event so pages can subscribe without changing props everywhere
    try {
      const ev = new CustomEvent('scanstream:openSignalDetails', { detail: { symbol, signal } });
      window.dispatchEvent(ev);
    } catch (err) {
      // ignore
    }
  }, [symbol, signal]);

  return (
    <Card
      variant={signal === 'BUY' ? 'success' : signal === 'SELL' ? 'error' : 'neutral'}
      interactive
      className={`signal-card ${gradientClass}`}
      style={{ padding: 0 }}
    >
      <div role="article" aria-label={`Signal card for ${symbol}`} style={{ padding: 'var(--space-4)' }}>
      {/* Header */}
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-0)' }}>
          <div>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-1) 0', color: 'var(--color-text-primary)' }}>{symbol}</h3>
            {price && (<p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0, fontFamily: 'var(--font-mono)' }}>${price.toFixed(2)}</p>)}
          </div>
          <div>
            <Badge variant={signalBadgeVariant} size="lg">
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                {signal === 'BUY' ? (<TrendingUp size={16} />) : signal === 'SELL' ? (<TrendingDown size={16} />) : (<AlertCircle size={16} />)}
                {signal}
              </span>
            </Badge>
          </div>
        </div>

      {/* Confidence & Momentum */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-4)',
        }}
      >
        {/* Confidence */}
        <div>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--space-2)',
              textTransform: 'uppercase',
            }}
          >
            Confidence
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-2)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-bold)',
                color: confidenceColor,
              }}
            >
              {confidence.toFixed(0)}%
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '6px',
              backgroundColor: 'var(--color-bg-tertiary)',
              borderRadius: '3px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${confidence}%`,
                backgroundColor: confidenceColor,
                transition: 'width 300ms ease',
              }}
            />
          </div>
        </div>

        {/* Momentum */}
        <div>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--space-2)',
              textTransform: 'uppercase',
            }}
          >
            Momentum
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-2)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-bold)',
                color: momentumColor,
              }}
            >
              {momentum > 0 ? '+' : ''}{momentum.toFixed(0)}
            </span>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              {momentumLabel}
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '6px',
              backgroundColor: 'var(--color-bg-tertiary)',
              borderRadius: '3px',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Center line at 50% */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: 0,
                width: '1px',
                height: '100%',
                backgroundColor: 'var(--color-border-subtle)',
              }}
            />
            {/* Bar from center */}
            <div
              style={{
                position: 'absolute',
                left: momentum >= 0 ? '50%' : `${50 + momentum}%`,
                width: `${Math.abs(momentum) / 2}%`,
                height: '100%',
                backgroundColor: momentumColor,
                transition: 'all 300ms ease',
              }}
            />
          </div>
        </div>
      </div>

        {/* Reasoning */}
        {reasoning && (
          <div className="text-clamp-2" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)', textTransform: 'uppercase' }}>Reasoning</div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 'var(--leading-normal)' }}>{reasoning}</p>
          </div>
        )}

        {/* Footer: Risk/Reward */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Zap size={14} color={signalColor} />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontWeight: 'var(--font-semibold)' }}>Risk/Reward</span>
          </div>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: signalColor, fontFamily: 'var(--font-mono)' }}>{riskReward}</span>
        </div>

        {/* Hover overlay action */}
        <div className="signal-overlay" aria-hidden>
          <button onClick={handleViewDetails} className="button button-primary" style={{ padding: 'var(--space-3) var(--space-4)' }}>View Details →</button>
        </div>
      </div>

      {/* 24h Change indicator */}
      {change24h !== undefined && (
        <div
          style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-bg-tertiary)',
            borderRadius: '6px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-secondary)',
              fontWeight: 'var(--font-semibold)',
            }}
          >
            24h Change
          </span>
          <span
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-bold)',
              color: change24h >= 0 ? 'var(--color-bullish)' : 'var(--color-bearish)',
            }}
          >
            {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
          </span>
        </div>
      )}
    </Card>
  );
};

// Memoize to avoid expensive re-renders
export default React.memo(SignalCard);
export const SignalCardMemo = React.memo(SignalCard);
