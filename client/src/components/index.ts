/**
 * Component Library Index
 * Week 1 Design System Implementation
 *
 * Exports all UI components for use throughout the application
 * Organized by category for easy discovery and usage
 */

// Base Components
export { Card, type CardProps } from './Card';
export { Panel, type PanelProps } from './Panel';
export { Button, type ButtonProps } from './Button';
export { Badge, type BadgeProps } from './Badge';
export {
  Skeleton,
  SkeletonCard,
  SkeletonTable,
  type SkeletonProps,
} from './Skeleton';

// Feature Components
export { HeroSection, type HeroSectionProps, type TopAsset } from './HeroSection';
export { SignalCard, type SignalCardProps } from './SignalCard';
export { PositionCard, type PositionCardProps } from './PositionCard';

/**
 * Component Usage Guide
 *
 * BASE COMPONENTS
 * ===============
 *
 * Card - Base container for grouping content
 * - Variants: default, success, error, warning, neutral
 * - Props: interactive, highlighted, onClick
 * - Example: <Card variant="success"><h3>Success!</h3></Card>
 *
 * Panel - Card with header and optional footer
 * - Props: title, collapsible, defaultExpanded, footer, headerActions
 * - Example: <Panel title="Settings" collapsible><SettingsForm /></Panel>
 *
 * Button - Reusable button with variants
 * - Variants: primary, secondary, tertiary, danger, ghost
 * - Sizes: sm, md, lg
 * - Props: loading, disabled, icon, iconPosition, fullWidth
 * - Example: <Button variant="primary" size="lg" loading={isLoading}>Submit</Button>
 *
 * Badge - Status/tag indicator
 * - Variants: default, success, error, warning, info, neutral
 * - Sizes: sm, md, lg
 * - Props: onRemove (shows remove button)
 * - Example: <Badge variant="success">Live</Badge>
 *
 * Skeleton - Animated loading placeholder
 * - SkeletonCard - Pre-styled card skeleton with 3 content lines
 * - SkeletonTable - Pre-styled table skeleton with configurable rows/cols
 * - Example: {isLoading ? <SkeletonCard count={3} /> : <Card>...</Card>}
 *
 * FEATURE COMPONENTS
 * ==================
 *
 * HeroSection - Featured asset display with price and market data
 * - Props: topAsset (TopAsset object), loading
 * - Displays: Price, 24h/7d change, market cap, volume, status
 * - Uses: Card, Badge, grid system
 * - Example: <HeroSection topAsset={btc} loading={false} />
 *
 * SignalCard - Trading signal with confidence and momentum
 * - Props: symbol, signal (BUY|SELL|NEUTRAL), confidence, momentum, etc.
 * - Displays: Confidence bar, momentum gauge, reasoning, risk/reward
 * - Uses: Card, Badge
 * - Example: <SignalCard symbol="BTC" signal="BUY" confidence={85} momentum={45} />
 *
 * CSS VARIABLES (from design system)
 * ==================================
 *
 * Colors:
 * --color-primary, --color-secondary (actions)
 * --color-bullish (green), --color-bearish (red), --color-neutral (gray)
 * --color-warning (amber)
 * --color-text-primary, --color-text-secondary, --color-text-tertiary
 * --color-bg-primary, --color-bg-secondary, --color-bg-tertiary, --color-bg-quaternary
 * --color-border-subtle, --color-border-hover
 *
 * Typography:
 * --font-sans (default), --font-mono (numbers/prices)
 * --text-xs (12px) to --text-5xl (48px)
 * --font-normal (400) to --font-extrabold (800)
 *
 * Spacing (4px base unit):
 * --space-1 (4px), --space-2 (8px), --space-4 (16px), --space-6 (24px), --space-8 (32px)
 *
 * Grid:
 * 12-column on desktop, 8-column on tablet, 4-column on mobile
 * Breakpoints: mobile (320px), tablet (768px), desktop (1024px), wide (1440px)
 *
 * RESPONSIVE CLASSES
 * ==================
 *
 * Grid:
 * .grid - 12-column grid (desktop)
 * .col-1 to .col-12 - column span
 * .col-sm-1 to .col-sm-4 - mobile (4 col)
 * .col-md-1 to .col-md-8 - tablet (8 col)
 *
 * Layout:
 * .terminal-layout - sidebar + main content
 * .sidebar (docked, floating, hidden, collapsed, expanded)
 * .panels-grid - 3-column panel grid
 * .hero-grid - 2-column hero section
 *
 * Utilities:
 * .gap-*, .space-x-*, .space-y-* - flexbox spacing
 * .p-* - padding
 * .m-* - margin
 * .text-bullish, .text-bearish - color utilities
 * .bg-bullish-faint - subtle backgrounds
 *
 * INTERACTION PATTERNS
 * ====================
 *
 * Loading States:
 * - Use Skeleton components for loading states
 * - Button: loading={true} shows spinner
 * - Card: opacity changes for loading effect
 *
 * Variants:
 * - Use variant prop on Card/Panel/Badge/Button
 * - Variants auto-apply colors and borders
 *
 * Collapsible:
 * - Panel: collapsible={true} with defaultExpanded state
 * - Click header to toggle expand/collapse
 *
 * Interactive:
 * - Card: interactive={true} adds pointer cursor and hover effect
 * - Button: onClick handler for actions
 * - Badge: onRemove handler for dismissal
 *
 * ANIMATION & TRANSITIONS
 * =======================
 *
 * Keyframes:
 * - skeleton-shimmer: 2s loading animation
 * - spin: 360deg rotation (for loaders)
 * - pulse: opacity fade effect
 * - fade-in, slide-in-up, slide-in-down
 *
 * Transitions:
 * - .transition-all: 200ms cubic-bezier
 * - .transition-colors: color changes
 * - .transition-opacity: fade effects
 * - .transition-transform: movement effects
 *
 * ACCESSIBILITY
 * ==============
 *
 * All components include:
 * - Proper semantic HTML
 * - ARIA labels and roles where needed
 * - Keyboard navigation support (Tab, Enter, Space)
 * - Color contrast compliant (WCAG AA minimum)
 * - Focus indicators on interactive elements
 *
 * Testing:
 * - Run Lighthouse audit in Chrome DevTools
 * - Test on mobile (375px), tablet (768px), desktop (1024px+)
 * - Verify keyboard navigation (Tab through all interactive elements)
 * - Check color contrast in axe DevTools
 */
