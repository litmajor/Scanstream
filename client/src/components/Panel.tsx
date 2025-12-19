import React, { ReactNode, CSSProperties, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface PanelProps {
  title?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  footer?: ReactNode;
  headerActions?: ReactNode;
  className?: string;
  style?: CSSProperties;
  variant?: 'default' | 'success' | 'error' | 'warning';
}

/**
 * Panel Component - Card with header, body, and optional footer
 * Supports collapsible functionality for space efficiency
 * Part of the Week 1 design system implementation
 */
export const Panel: React.FC<PanelProps> = ({
  title,
  children,
  collapsible = false,
  defaultExpanded = true,
  footer,
  headerActions,
  className = '',
  style,
  variant = 'default',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  let borderColor = 'var(--color-border-subtle)';
  let headerBgColor = 'var(--color-bg-tertiary)';

  switch (variant) {
    case 'success':
      borderColor = 'var(--color-bullish)';
      break;
    case 'error':
      borderColor = 'var(--color-bearish)';
      break;
    case 'warning':
      borderColor = 'var(--color-warning)';
      break;
  }

  const panelStyle: CSSProperties = {
    backgroundColor: 'var(--color-bg-secondary)',
    borderColor,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: '8px',
    overflow: 'hidden',
    transition: 'all 200ms ease',
    ...style,
  };

  const headerStyle: CSSProperties = {
    backgroundColor: headerBgColor,
    padding: 'var(--space-4)',
    borderBottom: isExpanded ? `1px solid ${borderColor}` : 'none',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 'var(--space-3)',
    cursor: collapsible ? 'pointer' : 'default',
    transition: 'background-color 200ms ease',
  };

  const titleStyle: CSSProperties = {
    fontSize: 'var(--text-lg)',
    fontWeight: 'var(--font-semibold)',
    color: 'var(--color-text-primary)',
    margin: 0,
    flex: 1,
  };

  const bodyStyle: CSSProperties = {
    padding: 'var(--space-4)',
    maxHeight: isExpanded ? '1000px' : '0px',
    overflow: 'hidden',
    transition: 'max-height 300ms cubic-bezier(0.4, 0, 0.2, 1)',
  };

  const footerStyle: CSSProperties = {
    padding: 'var(--space-4)',
    borderTop: `1px solid ${borderColor}`,
    backgroundColor: headerBgColor,
    display: 'flex',
    gap: 'var(--space-2)',
    justifyContent: 'flex-end',
  };

  const handleHeaderClick = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div
      className={`panel panel-${variant} ${collapsible ? 'panel-collapsible' : ''} ${
        isExpanded ? 'panel-expanded' : 'panel-collapsed'
      } ${className}`}
      style={panelStyle}
    >
      {title && (
        <div
          className="panel-header"
          style={headerStyle}
          onClick={handleHeaderClick}
          role={collapsible ? 'button' : undefined}
          tabIndex={collapsible ? 0 : -1}
          onKeyDown={(e) => {
            if (collapsible && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setIsExpanded(!isExpanded);
            }
          }}
        >
          <h3 className="panel-title" style={titleStyle}>
            {title}
          </h3>
          <div className="panel-header-actions" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            {headerActions}
            {collapsible && (
              <ChevronDown
                size={20}
                style={{
                  transition: 'transform 200ms ease',
                  transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                  color: 'var(--color-text-secondary)',
                }}
              />
            )}
          </div>
        </div>
      )}

      <div className="panel-body" style={bodyStyle}>
        {children}
      </div>

      {footer && isExpanded && (
        <div className="panel-footer" style={footerStyle}>
          {footer}
        </div>
      )}
    </div>
  );
};

export default Panel;
