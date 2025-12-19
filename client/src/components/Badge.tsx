import React, { CSSProperties } from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: CSSProperties;
  onRemove?: () => void;
}

/**
 * Badge Component - Small status/tag indicator
 * Part of the Week 1 design system implementation
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  style,
  onRemove,
}) => {
  // Variant colors
  let bgColor = 'var(--color-bg-tertiary)';
  let textColor = 'var(--color-text-secondary)';
  let borderColor = 'var(--color-border-subtle)';

  switch (variant) {
    case 'success':
      bgColor = 'var(--color-bullish)';
      textColor = '#ffffff';
      borderColor = 'var(--color-bullish)';
      break;
    case 'error':
      bgColor = 'var(--color-bearish)';
      textColor = '#ffffff';
      borderColor = 'var(--color-bearish)';
      break;
    case 'warning':
      bgColor = 'var(--color-warning)';
      textColor = '#ffffff';
      borderColor = 'var(--color-warning)';
      break;
    case 'info':
      bgColor = 'var(--color-primary)';
      textColor = '#ffffff';
      borderColor = 'var(--color-primary)';
      break;
    case 'neutral':
      bgColor = 'var(--color-neutral)';
      textColor = '#ffffff';
      borderColor = 'var(--color-neutral)';
      break;
  }

  // Size styles
  let padding = 'var(--space-2) var(--space-3)';
  let fontSize = 'var(--text-sm)';

  switch (size) {
    case 'sm':
      padding = 'var(--space-1) var(--space-2)';
      fontSize = 'var(--text-xs)';
      break;
    case 'lg':
      padding = 'var(--space-3) var(--space-4)';
      fontSize = 'var(--text-base)';
      break;
  }

  const badgeStyle: CSSProperties = {
    backgroundColor: bgColor,
    color: textColor,
    borderColor,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: '20px',
    padding,
    fontSize,
    fontWeight: 'var(--font-semibold)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    whiteSpace: 'nowrap',
    width: 'fit-content',
    transition: 'all 200ms ease',
    ...style,
  };

  return (
    <span className={`badge badge-${variant} badge-${size} ${className}`} style={badgeStyle}>
      <span className="badge-content">{children}</span>
      {onRemove && (
        <button
          className="badge-remove"
          onClick={onRemove}
          style={{
            background: 'none',
            border: 'none',
            padding: '0',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.7,
            transition: 'opacity 200ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.7';
          }}
          aria-label="Remove badge"
        >
          ×
        </button>
      )}
    </span>
  );
};

export default Badge;
