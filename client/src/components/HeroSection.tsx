import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from './Card';
import { Badge } from './Badge';

export interface TopAsset {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d?: number;
  change30d?: number;
  marketCap?: number;
  volume24h?: number;
  image?: string;
}

export interface HeroSectionProps {
  topAsset?: TopAsset;
  loading?: boolean;
}

/**
 * HeroSection Component - Displays featured asset with price and market data
 * Part of the Week 1 trading terminal redesign
 * Uses: Card, Badge, grid system, typography system
 */
export const HeroSection: React.FC<HeroSectionProps> = ({
  topAsset,
  loading = false,
}) => {
  // Format currency
  const formatCurrency = (value: number): string => {
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    }
    if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    }
    if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  // Determine trend color
  const trendColor = useMemo(() => {
    if (!topAsset) return 'var(--color-neutral)';
    return topAsset.change24h >= 0 ? 'var(--color-bullish)' : 'var(--color-bearish)';
  }, [topAsset]);

  const trendIcon = useMemo(() => {
    if (!topAsset) return null;
    return topAsset.change24h >= 0 ? (
      <TrendingUp size={24} color={trendColor} />
    ) : (
      <TrendingDown size={24} color={trendColor} />
    );
  }, [topAsset, trendColor]);

  if (loading || !topAsset) {
    return (
      <div className="hero-section-skeleton" style={{ marginBottom: 'var(--space-8)' }}>
        <Card>
          <div style={{ padding: 'var(--space-6)' }}>
            <div
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                height: '40px',
                borderRadius: '6px',
                marginBottom: 'var(--space-4)',
                animation: 'skeleton-shimmer 2s infinite',
                width: '30%',
              }}
            />
            <div
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                height: '60px',
                borderRadius: '6px',
                marginBottom: 'var(--space-4)',
                animation: 'skeleton-shimmer 2s infinite',
                width: '60%',
              }}
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 'var(--space-4)',
              }}
            >
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <div
                    style={{
                      backgroundColor: 'var(--color-bg-tertiary)',
                      height: '16px',
                      borderRadius: '4px',
                      marginBottom: 'var(--space-2)',
                      animation: 'skeleton-shimmer 2s infinite',
                      width: '50%',
                    }}
                  />
                  <div
                    style={{
                      backgroundColor: 'var(--color-bg-tertiary)',
                      height: '20px',
                      borderRadius: '4px',
                      animation: 'skeleton-shimmer 2s infinite',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="hero-section"
      style={{
        marginBottom: 'var(--space-8)',
      }}
    >
      <Card variant="default" interactive={false}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: 'var(--space-6)',
            alignItems: 'start',
          }}
        >
          {/* Left Section - Asset Info */}
          <div
            style={{
              gridColumn: '1 / 2',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
            }}
          >
            {topAsset.image && (
              <img
                src={topAsset.image}
                alt={topAsset.name}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                }}
              />
            )}
            <div>
              <h2
                style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--font-bold)',
                  margin: '0 0 var(--space-1) 0',
                  color: 'var(--color-text-primary)',
                }}
              >
                {topAsset.name}
              </h2>
              <p
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-secondary)',
                  margin: 0,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 'var(--font-semibold)',
                }}
              >
                {topAsset.symbol.toUpperCase()}
              </p>
            </div>
          </div>

          {/* Center Section - Price & Change */}
          <div
            style={{
              gridColumn: '2 / 3',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
              justifyContent: 'center',
            }}
          >
            <div>
              <div
                className="price-display"
                style={{
                  fontSize: 'var(--text-4xl)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 'var(--font-bold)',
                  color: 'var(--color-text-primary)',
                  margin: '0 0 var(--space-2) 0',
                }}
              >
                {topAsset.price < 1 ? topAsset.price.toFixed(6) : topAsset.price.toFixed(2)}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--space-2)',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <Badge variant={topAsset.change24h >= 0 ? 'success' : 'error'}>
                  <span style={{ color: trendColor, fontWeight: 'var(--font-bold)' }}>
                    {topAsset.change24h >= 0 ? '+' : ''}
                    {topAsset.change24h.toFixed(2)}%
                  </span>
                </Badge>
                {topAsset.change7d !== undefined && (
                  <Badge
                    variant={topAsset.change7d >= 0 ? 'success' : 'error'}
                    size="sm"
                  >
                    7d: {topAsset.change7d >= 0 ? '+' : ''}
                    {topAsset.change7d.toFixed(2)}%
                  </Badge>
                )}
              </div>
            </div>
            <div style={{ fontSize: '32px', opacity: 0.8 }}>{trendIcon}</div>
          </div>

          {/* Right Section - Market Data */}
          <div
            style={{
              gridColumn: '3 / 4',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-4)',
            }}
          >
            {topAsset.marketCap && (
              <div>
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--font-semibold)',
                    color: 'var(--color-text-secondary)',
                    textTransform: 'uppercase',
                    marginBottom: 'var(--space-1)',
                  }}
                >
                  Market Cap
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--font-semibold)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {formatCurrency(topAsset.marketCap)}
                </div>
              </div>
            )}
            {topAsset.volume24h && (
              <div>
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--font-semibold)',
                    color: 'var(--color-text-secondary)',
                    textTransform: 'uppercase',
                    marginBottom: 'var(--space-1)',
                  }}
                >
                  24h Volume
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--font-semibold)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {formatCurrency(topAsset.volume24h)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom - Summary Stats Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 'var(--space-4)',
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-6)',
            borderTop: '1px solid var(--color-border-subtle)',
          }}
        >
          {topAsset.change30d !== undefined && (
            <div>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-secondary)',
                  marginBottom: 'var(--space-1)',
                  textTransform: 'uppercase',
                  fontWeight: 'var(--font-semibold)',
                }}
              >
                30d Change
              </div>
              <div
                style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--font-semibold)',
                  color: topAsset.change30d >= 0 ? 'var(--color-bullish)' : 'var(--color-bearish)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {topAsset.change30d >= 0 ? '+' : ''}
                {topAsset.change30d.toFixed(2)}%
              </div>
            </div>
          )}
          <div>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--space-1)',
                textTransform: 'uppercase',
                fontWeight: 'var(--font-semibold)',
              }}
            >
              Status
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div
                className="status-dot status-dot-live"
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-bullish)',
                }}
              />
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                Live
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default HeroSection;
