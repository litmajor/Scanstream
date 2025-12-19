import React, { ReactNode, CSSProperties } from 'react';

export interface CardProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'neutral';
  interactive?: boolean;
  highlighted?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

/**
 * Card Component - Base container for grouping related content
 * Part of the Week 1 design system implementation
 */
export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  interactive = false,
  highlighted = false,
  className = '',
  style,
  onClick,
}) => {
  let variantClass = '';
  let borderColor = 'var(--color-border-subtle)';
  let backgroundColor = 'var(--color-bg-secondary)';

  switch (variant) {
    case 'success':
      borderColor = 'var(--color-bullish)';
      backgroundColor = 'var(--color-bg-secondary)';
      variantClass = 'card-success';
      break;
    case 'error':
      borderColor = 'var(--color-bearish)';
      backgroundColor = 'var(--color-bg-secondary)';
      variantClass = 'card-error';
      break;
    case 'warning':
      borderColor = 'var(--color-warning)';
      backgroundColor = 'var(--color-bg-secondary)';
      variantClass = 'card-warning';
      break;
    case 'neutral':
      borderColor = 'var(--color-neutral)';
      backgroundColor = 'var(--color-bg-secondary)';
      variantClass = 'card-neutral';
      break;
    default:
      variantClass = 'card-default';
  }

  const computedStyle: CSSProperties = {
    backgroundColor,
    borderColor,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: '8px',
    padding: 'var(--space-4)',
    transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: interactive ? 'pointer' : 'default',
    opacity: highlighted ? 1 : 0.95,
    boxShadow: interactive
      ? '0 1px 3px rgba(0, 0, 0, 0.1)'
      : '0 1px 2px rgba(0, 0, 0, 0.05)',
    ...style,
  };

  const hoverStyle: React.CSSProperties = interactive
    ? {
        borderColor: 'var(--color-border-hover)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      }
    : {};

  return (
    <div
      className={`card ${variantClass} ${interactive ? 'card-interactive' : ''} ${
        highlighted ? 'card-highlighted' : ''
      } ${className}`}
      style={computedStyle}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (interactive) {
          Object.assign(e.currentTarget.style, hoverStyle);
        }
      }}
      onMouseLeave={(e) => {
        Object.assign(e.currentTarget.style, {
          borderColor: borderColor,
          boxShadow:
            interactive ? '0 1px 3px rgba(0, 0, 0, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.05)',
        });
      }}
      role={interactive ? 'button' : 'article'}
      tabIndex={interactive ? 0 : -1}
    >
      {children}
    </div>
  );
};

export default Card;
