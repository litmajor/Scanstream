import React, { CSSProperties } from 'react';

export interface SkeletonProps {
  variant?: 'rect' | 'circle' | 'text';
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: CSSProperties;
  count?: number;
  gap?: string;
}

/**
 * Skeleton Component - Animated loading placeholder
 * Displays shimmer effect while data is loading
 * Part of the Week 1 design system implementation
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rect',
  width = '100%',
  height = '20px',
  className = '',
  style,
  count = 1,
  gap = 'var(--space-3)',
}) => {
  const baseStyle: CSSProperties = {
    backgroundColor: 'var(--color-bg-tertiary)',
    borderRadius: variant === 'circle' ? '50%' : '6px',
    overflow: 'hidden',
    ...style,
  };

  // Apply width/height based on variant
  if (variant === 'circle') {
    baseStyle.width = width;
    baseStyle.height = height || width; // Circle should be square
  } else {
    baseStyle.width = width;
    baseStyle.height = height;
  }

  const shimmerKeyframes = `
    @keyframes skeleton-shimmer {
      0% {
        background-position: -1000px 0;
      }
      100% {
        background-position: 1000px 0;
      }
    }
  `;

  const shimmerStyle: CSSProperties = {
    ...baseStyle,
    backgroundImage: `linear-gradient(
      90deg,
      var(--color-bg-tertiary) 0%,
      var(--color-bg-quaternary) 50%,
      var(--color-bg-tertiary) 100%
    )`,
    backgroundSize: '1000px 100%',
    animation: 'skeleton-shimmer 2s infinite',
  };

  // Text variant - multiple lines
  if (variant === 'text' && count > 1) {
    return (
      <div className={`skeleton-group ${className}`} style={{ display: 'flex', flexDirection: 'column', gap }}>
        <style>{shimmerKeyframes}</style>
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className={`skeleton skeleton-text skeleton-line-${index + 1}`}
            style={{
              ...shimmerStyle,
              height: index === count - 1 ? '60%' : '100%',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <style>{shimmerKeyframes}</style>
      <div className={`skeleton skeleton-${variant} ${className}`} style={shimmerStyle} />
    </>
  );
};

/**
 * SkeletonCard Component - Pre-styled skeleton for card loading state
 */
export const SkeletonCard: React.FC<{ count?: number }> = ({ count = 1 }) => {
  const cardStyle: CSSProperties = {
    backgroundColor: 'var(--color-bg-secondary)',
    borderColor: 'var(--color-border-subtle)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: '8px',
    padding: 'var(--space-4)',
  };

  const shimmerKeyframes = `
    @keyframes skeleton-shimmer {
      0% {
        background-position: -1000px 0;
      }
      100% {
        background-position: 1000px 0;
      }
    }
  `;

  return (
    <>
      <style>{shimmerKeyframes}</style>
      <div className="skeleton-card-group" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {Array.from({ length: count }).map((_, cardIndex) => (
          <div key={cardIndex} className="skeleton-card" style={cardStyle}>
            {/* Title line */}
            <div
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                backgroundImage: `linear-gradient(
                  90deg,
                  var(--color-bg-tertiary) 0%,
                  var(--color-bg-quaternary) 50%,
                  var(--color-bg-tertiary) 100%
                )`,
                backgroundSize: '1000px 100%',
                animation: 'skeleton-shimmer 2s infinite',
                height: '24px',
                borderRadius: '6px',
                marginBottom: 'var(--space-4)',
                width: '60%',
              }}
            />

            {/* Content lines */}
            {[1, 2, 3].map((lineIndex) => (
              <div
                key={lineIndex}
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  backgroundImage: `linear-gradient(
                    90deg,
                    var(--color-bg-tertiary) 0%,
                    var(--color-bg-quaternary) 50%,
                    var(--color-bg-tertiary) 100%
                  )`,
                  backgroundSize: '1000px 100%',
                  animation: 'skeleton-shimmer 2s infinite',
                  height: '16px',
                  borderRadius: '4px',
                  marginBottom: lineIndex < 3 ? 'var(--space-3)' : '0',
                  width: lineIndex === 3 ? '80%' : '100%',
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  );
};

/**
 * SkeletonTable Component - Pre-styled skeleton for table loading state
 */
export const SkeletonTable: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4,
}) => {
  const shimmerKeyframes = `
    @keyframes skeleton-shimmer {
      0% {
        background-position: -1000px 0;
      }
      100% {
        background-position: 1000px 0;
      }
    }
  `;

  return (
    <>
      <style>{shimmerKeyframes}</style>
      <div
        style={{
          width: '100%',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: '0',
            backgroundColor: 'var(--color-bg-tertiary)',
            borderBottom: '1px solid var(--color-border-subtle)',
            padding: 'var(--space-4)',
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              style={{
                backgroundColor: 'var(--color-bg-quaternary)',
                backgroundImage: `linear-gradient(
                  90deg,
                  var(--color-bg-quaternary) 0%,
                  rgba(255,255,255,0.1) 50%,
                  var(--color-bg-quaternary) 100%
                )`,
                backgroundSize: '1000px 100%',
                animation: 'skeleton-shimmer 2s infinite',
                height: '20px',
                borderRadius: '4px',
              }}
            />
          ))}
        </div>

        {/* Rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: '0',
              borderBottom:
                rowIndex < rows - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              padding: 'var(--space-4)',
              backgroundColor: rowIndex % 2 === 0 ? 'transparent' : 'var(--color-bg-tertiary)',
            }}
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={colIndex}
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  backgroundImage: `linear-gradient(
                    90deg,
                    var(--color-bg-tertiary) 0%,
                    var(--color-bg-quaternary) 50%,
                    var(--color-bg-tertiary) 100%
                  )`,
                  backgroundSize: '1000px 100%',
                  animation: 'skeleton-shimmer 2s infinite',
                  height: '16px',
                  borderRadius: '4px',
                  width: colIndex === 0 ? '80%' : '90%',
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  );
};

export default Skeleton;
