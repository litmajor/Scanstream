import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useTheme } from '../contexts/ThemeContext';
import ThemeSelector from './ThemeSelector';
import {
  LayoutDashboard,
  Search,
  Wallet,
  BarChart3,
  Target,
  DollarSign,
  Brain,
  TrendingUp,
  Layers,
  Sparkles,
  Menu,
  X,
  Moon,
  Sun,
  Zap,
  Activity,
  Grid3x3,
  Wind, // Added Wind icon
  Award // Added Award icon
} from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  section: 'main' | 'trading' | 'advanced' | 'dev';
}

const navItems: NavItem[] = [
  // Main Section - Core functionality
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, section: 'main' },
  { name: 'Signals', path: '/signals', icon: Zap, section: 'main' },
  { name: 'Positions', path: '/positions', icon: Activity, section: 'main' },
  { name: 'Portfolio', path: '/portfolio', icon: Wallet, section: 'main' },

  // Trading Section - Active trading tools
  { name: 'Scanner', path: '/scanner', icon: Search, section: 'trading' },
  { name: 'Gateway Scanner', path: '/gateway-scanner', icon: Zap, section: 'trading' },
  { name: 'Strategies', path: '/strategies', icon: Target, section: 'trading' },
  { name: 'Backtest', path: '/backtest', icon: BarChart3, section: 'trading' },

  // Advanced Section - ML, optimization, and intelligence
  { name: 'ML Engine', path: '/ml-engine', icon: Brain, section: 'advanced' },
  { name: 'Advanced Analytics', path: '/advanced-analytics', icon: BarChart3, section: 'advanced' },
  { name: 'RL Position Agent', path: '/rl-position-agent', icon: Brain, section: 'advanced' },
  { name: 'Paper Trading', path: '/paper-trading', icon: DollarSign, section: 'advanced' },
  { name: 'Multi-Timeframe', path: '/multi-timeframe', icon: Layers, section: 'advanced' },
  { name: 'Flow Field', path: '/flow-field', icon: Activity, section: 'advanced' },
  { name: 'Optimize', path: '/optimize', icon: Sparkles, section: 'advanced' },
  { name: 'Market Intelligence', path: '/market-intelligence', icon: TrendingUp, section: 'advanced' },
  // Added Signal Performance and Flow Field Backtesting to navItems
  { name: 'Signal Performance', path: '/signal-performance', icon: Award, section: 'advanced' },
  { name: 'Flow Field Backtesting', path: '/flow-field-backtesting', icon: Wind, section: 'advanced' },


  // Dev Section - Component showcase
  { name: 'Dashboard Grid', path: '/dashboard-grid', icon: Grid3x3, section: 'dev' },
  { name: 'Card Showcase', path: '/card-showcase', icon: Wallet, section: 'dev' },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { preset, setPreset, colors } = useTheme();

  const mainItems = navItems.filter(item => item.section === 'main');
  const tradingItems = navItems.filter(item => item.section === 'trading');
  const advancedItems = navItems.filter(item => item.section === 'advanced');
  const devItems = navItems.filter(item => item.section === 'dev');

  return (
    <div 
      className="min-h-screen transition-colors duration-300 flex"
      style={{
        backgroundColor: colors.background,
        color: colors.text,
      }}
    >
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col backdrop-blur-sm transition-all duration-300 ${
          isSidebarOpen ? 'w-64' : 'w-16'
        }`}
        style={{
          backgroundColor: colors.surface,
          borderRightColor: colors.border,
        }}
      >
        {/* Header */}
        <div 
          className="flex h-16 items-center justify-between border-b px-4"
          style={{ borderBottomColor: colors.border }}
        >
          {isSidebarOpen && (
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                AlgoTrader
              </span>
            </div>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="rounded-lg p-2 transition-colors"
            style={{ color: colors.text }}
            aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-6">
            {/* Main Section */}
            <div>
              {isSidebarOpen && (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                  Main
                </h3>
              )}
              <div className="space-y-1">
                {mainItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.path;
                  return (
                    <Link key={item.path} href={item.path}>
                      <span
                        className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${!isSidebarOpen && 'justify-center'}`}
                        style={{
                          backgroundColor: isActive ? colors.accent : 'transparent',
                          color: isActive ? colors.background : colors.textSecondary,
                        }}
                        title={!isSidebarOpen ? item.name : undefined}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        {isSidebarOpen && <span className="font-medium">{item.name}</span>}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Trading Section */}
            <div>
              {isSidebarOpen && (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                  Trading
                </h3>
              )}
              <div className="space-y-1">
                {tradingItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.path;
                  return (
                    <Link key={item.path} href={item.path}>
                      <span
                        className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${!isSidebarOpen && 'justify-center'}`}
                        style={{
                          backgroundColor: isActive ? colors.accent : 'transparent',
                          color: isActive ? colors.background : colors.textSecondary,
                        }}
                        title={!isSidebarOpen ? item.name : undefined}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        {isSidebarOpen && <span className="font-medium">{item.name}</span>}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Advanced Section */}
            <div>
              {isSidebarOpen && (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                  Advanced
                </h3>
              )}
              <div className="space-y-1">
                {advancedItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.path;
                  return (
                    <Link key={item.path} href={item.path}>
                      <span
                        className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${!isSidebarOpen && 'justify-center'}`}
                        style={{
                          backgroundColor: isActive ? colors.accent : 'transparent',
                          color: isActive ? colors.background : colors.textSecondary,
                        }}
                        title={!isSidebarOpen ? item.name : undefined}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        {isSidebarOpen && <span className="font-medium">{item.name}</span>}
                      </span>
                    </Link>
                  );
                })}
                {/* Flow Engine addition to sidebar */}
                {isSidebarOpen && (
                  <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                    Flow Engine
                  </h3>
                )}
                <div className="space-y-1">
                  <Link href="/flow-engine">
                    <span
                      className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${!isSidebarOpen && 'justify-center'}`}
                      style={{
                        backgroundColor: location === '/flow-engine' ? colors.accent : 'transparent',
                        color: location === '/flow-engine' ? colors.background : colors.textSecondary,
                      }}
                      title={!isSidebarOpen ? 'Flow Engine' : undefined}
                    >
                      <Zap className="h-5 w-5 flex-shrink-0" />
                      {isSidebarOpen && <span className="font-medium">Flow Engine</span>}
                    </span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Dev Section */}
            <div>
              {isSidebarOpen && (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                  Dev
                </h3>
              )}
              <div className="space-y-1">
                {devItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.path;
                  return (
                    <Link key={item.path} href={item.path}>
                      <span
                        className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${!isSidebarOpen && 'justify-center'}`}
                        style={{
                          backgroundColor: isActive ? colors.accent : 'transparent',
                          color: isActive ? colors.background : colors.textSecondary,
                        }}
                        title={!isSidebarOpen ? item.name : undefined}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        {isSidebarOpen && <span className="font-medium">{item.name}</span>}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* Theme Toggle at Bottom */}
          <div 
            className="border-t p-3 space-y-2"
            style={{ borderTopColor: colors.border }}
          >
            {/* Modern theme toggle */}
            <button
              onClick={() => setPreset(preset === 'dark' ? 'light' : 'dark')}
              className={`flex w-full items-center space-x-3 rounded-lg px-3 py-2.5 transition-all ${
                !isSidebarOpen && 'justify-center'
              }`}
              style={{ color: colors.textSecondary }}
              title={preset === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              data-testid="button-theme-toggle"
            >
              {preset === 'dark' ? (
                <>
                  <Sun className="h-5 w-5 flex-shrink-0" />
                  {isSidebarOpen && <span className="font-medium">Light Mode</span>}
                </>
              ) : (
                <>
                  <Moon className="h-5 w-5 flex-shrink-0" />
                  {isSidebarOpen && <span className="font-medium">Dark Mode</span>}
                </>
              )}
            </button>

            {/* Advanced theme selector */}
            {isSidebarOpen && (
              <div className="flex items-center space-x-2 px-3 py-2.5 rounded-lg" style={{ backgroundColor: `${colors.card}66` }}>
                <div className="flex-1">
                  <p className="text-xs font-medium" style={{ color: colors.textSecondary }}>Theme: {preset}</p>
                </div>
                <ThemeSelector />
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main
          className={`flex-1 transition-all duration-300 ${
            isSidebarOpen ? 'ml-64' : 'ml-16'
          }`}
        >
          {children}
        </main>
      </div>
  );
}