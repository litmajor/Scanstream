import React, { ReactNode, CSSProperties } from 'react';

export interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
}

/**
 * Button Component - Reusable button with multiple variants and sizes
 * Part of the Week 1 design system implementation
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  className = '',
  style,
  onClick,
  type = 'button',
  fullWidth = false,
}) => {
  // Variant styles
  let bgColor = 'var(--color-primary)';
  let textColor = '#ffffff';
  let hoverBgColor = 'var(--color-primary-hover)';
  let borderColor = 'transparent';

  switch (variant) {
    case 'secondary':
      bgColor = 'var(--color-secondary)';
      hoverBgColor = 'var(--color-secondary-hover)';
      break;
    case 'tertiary':
      bgColor = 'transparent';
      textColor = 'var(--color-primary)';
      borderColor = 'var(--color-primary)';
      hoverBgColor = 'var(--color-bg-tertiary)';
      break;
    case 'danger':
      bgColor = 'var(--color-bearish)';
      hoverBgColor = '#dc2626';
      break;
    case 'ghost':
      bgColor = 'transparent';
      textColor = 'var(--color-text-primary)';
      hoverBgColor = 'var(--color-bg-tertiary)';
      break;
  }

  // Size styles
  let padding = 'var(--space-3) var(--space-4)';
  let fontSize = 'var(--text-base)';

  switch (size) {
    case 'sm':
      padding = 'var(--space-2) var(--space-3)';
      fontSize = 'var(--text-sm)';
      break;
    case 'lg':
      padding = 'var(--space-4) var(--space-6)';
      fontSize = 'var(--text-lg)';
      break;
  }

  const buttonStyle: CSSProperties = {
    backgroundColor: disabled ? 'var(--color-bg-tertiary)' : bgColor,
    color: disabled ? 'var(--color-text-tertiary)' : textColor,
    borderColor: disabled ? 'var(--color-border-subtle)' : borderColor,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: '6px',
    padding,
    fontSize,
    fontWeight: 'var(--font-semibold)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-2)',
    whiteSpace: 'nowrap',
    width: fullWidth ? '100%' : 'auto',
    opacity: disabled ? 0.6 : 1,
    ...style,
  };

  const hoverStyle: React.CSSProperties = disabled
    ? {}
    : {
        backgroundColor: hoverBgColor,
        boxShadow: variant !== 'ghost' ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none',
      };

  return (
    <button
      className={`button button-${variant} button-${size} ${disabled ? 'button-disabled' : ''} ${
        loading ? 'button-loading' : ''
      } ${className}`}
      style={buttonStyle}
      onClick={onClick}
      disabled={disabled || loading}
      type={type}
      onMouseEnter={(e) => {
        if (!disabled) {
          Object.assign(e.currentTarget.style, hoverStyle);
        }
      }}
      onMouseLeave={(e) => {
        Object.assign(e.currentTarget.style, {
          backgroundColor: disabled ? 'var(--color-bg-tertiary)' : bgColor,
          boxShadow: 'none',
        });
      }}
    >
      {icon && iconPosition === 'left' && !loading && (
        <span className="button-icon button-icon-left">{icon}</span>
      )}
      {loading && (
        <span
          className="button-loader"
          style={{
            width: '16px',
            height: '16px',
            border: '2px solid currentColor',
            borderRadius: '50%',
            borderTopColor: 'transparent',
            animation: 'spin 600ms linear infinite',
          }}
        />
      )}
      <span className="button-text">{children}</span>
      {icon && iconPosition === 'right' && !loading && (
        <span className="button-icon button-icon-right">{icon}</span>
      )}
    </button>
  );
};

export default Button;
