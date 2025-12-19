import React from 'react';
import { Card } from './Card';
import MarketStatusBar from './MarketStatusBar';
import { HeroSection, TopAsset } from './HeroSection';
import { usePanelState, PanelMeta } from '../hooks/usePanelState';
import useMountSafeTransitions from '../hooks/useMountSafeTransitions';

export type ViewMode = 'grid' | 'focus' | 'minimal';

interface TerminalLayoutProps {
  hero?: TopAsset | null;
  left?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  panels?: Array<{ id: string; title?: string; content: React.ReactNode }>;
  defaultPanels?: PanelMeta[];
  currentSymbol?: string;
  currentPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
  signalsCount?: number;
  isLive?: boolean;
}

export const TerminalLayout: React.FC<TerminalLayoutProps> = ({
  hero = null,
  left,
  right,
  panels = [],
  defaultPanels = [],
  currentSymbol,
  currentPrice,
  priceChange,
  priceChangePercent,
  signalsCount = 0,
  isLive = true,
}) => {
  const { panels: panelState, toggleCollapse, setPosition, registerPanel } = usePanelState(defaultPanels);
  const { withTransitionsDisabled } = useMountSafeTransitions();

  // register panels on mount
  React.useEffect(() => {
    defaultPanels.forEach(p => registerPanel(p));
  }, [defaultPanels, registerPanel]);

  const [viewMode, setViewMode] = React.useState<ViewMode>('grid');

  return (
    <div className="terminal-layout" style={{ minHeight: '100vh' }}>
      {/* Left Sidebar (docked by default) */}
      <aside className={`sidebar ${panelState['left']?.position === 'hidden' ? 'sidebar-hidden' : ''}`} style={{ display: panelState['left']?.position === 'hidden' ? 'none' : undefined }}>
        {left}
      </aside>

      {/* Main content */}
      <main className="main-content">
        {/* Top header / status bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <MarketStatusBar
            isConnected={true}
            currentPrice={currentPrice || 0}
            priceChange={priceChange || 0}
            priceChangePercent={priceChangePercent || 0}
            volume24h={0}
            portfolioValue={0}
            dayChangePercent={0}
            isOperational={{ isOperational: true, latency: 0 }} as any
            mdlConnected={true}
            topItems={[] as any}
            selectedSymbol={currentSymbol}
            onBackfill={async () => { /* caller can override */ }}
            backfillInProgress={false}
            backfillCount={0}
            liveTickerData={[] as any}
          />

          {/* Hero Section */}
          {hero && (
            <div>
              <HeroSection topAsset={hero} />
            </div>
          )}

          {/* Quick mode controls */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <button onClick={() => setViewMode('grid')} className={`button ${viewMode === 'grid' ? 'button-primary' : 'button-ghost'}`}>Grid</button>
            <button onClick={() => setViewMode('focus')} className={`button ${viewMode === 'focus' ? 'button-primary' : 'button-ghost'}`}>Focus</button>
            <button onClick={() => setViewMode('minimal')} className={`button ${viewMode === 'minimal' ? 'button-primary' : 'button-ghost'}`}>Minimal</button>
            <div style={{ marginLeft: 'auto' }} />
          </div>
        </div>

        {/* Panels grid - adapt to view mode */}
        <div className="panels-grid" style={{ marginTop: 'var(--space-4)' }}>
          {panels.map(p => (
            <div key={p.id} className={`panel-item ${panelState[p.id]?.collapsed ? 'panel-collapsed' : 'panel-expanded'}`}>
              <div className="panel-header">
                <div className="panel-header-title">{p.title}</div>
                <div className="panel-header-actions">
                  <button onClick={() => withTransitionsDisabled(() => toggleCollapse(p.id))} className="button button-ghost">{panelState[p.id]?.collapsed ? 'Expand' : 'Collapse'}</button>
                  <button onClick={() => withTransitionsDisabled(() => setPosition(p.id, panelState[p.id]?.position === 'docked' ? 'floating' : 'docked'))} className="button button-ghost">Toggle Dock</button>
                </div>
              </div>
              <div className="panel-body">{p.content}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Right Sidebar */}
      <aside className="sidebar sidebar-right" style={{ display: panelState['right']?.position === 'hidden' ? 'none' : undefined }}>
        {right}
      </aside>
    </div>
  );
};

export default TerminalLayout;
