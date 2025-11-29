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
  Grid3x3
} from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
  isDark: boolean;
  toggleTheme: () => void;
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
  { name: 'Paper Trading', path: '/paper-trading', icon: DollarSign, section: 'advanced' },
  { name: 'Multi-Timeframe', path: '/multi-timeframe', icon: Layers, section: 'advanced' },
  { name: 'Optimize', path: '/optimize', icon: Sparkles, section: 'advanced' },
  { name: 'Market Intelligence', path: '/market-intelligence', icon: TrendingUp, section: 'advanced' },

  // Dev Section - Component showcase
  { name: 'Dashboard Grid', path: '/dashboard-grid', icon: Grid3x3, section: 'dev' },
  { name: 'Card Showcase', path: '/card-showcase', icon: Wallet, section: 'dev' },
];

export default function AppLayout({ children, isDark, toggleTheme }: AppLayoutProps) {
  const [location] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { preset, colors } = useTheme();

  const mainItems = navItems.filter(item => item.section === 'main');
  const tradingItems = navItems.filter(item => item.section === 'trading');
  const advancedItems = navItems.filter(item => item.section === 'advanced');
  const devItems = navItems.filter(item => item.section === 'dev');

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-950 text-white">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-800 bg-slate-900/95 backdrop-blur-sm transition-all duration-300 ${
            isSidebarOpen ? 'w-64' : 'w-16'
          }`}
        >
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
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
              className="rounded-lg p-2 hover:bg-slate-800 transition-colors"
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
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                        className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        } ${!isSidebarOpen && 'justify-center'}`}
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
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                        className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        } ${!isSidebarOpen && 'justify-center'}`}
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
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                        className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        } ${!isSidebarOpen && 'justify-center'}`}
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

            {/* Dev Section */}
            <div>
              {isSidebarOpen && (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                        className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        } ${!isSidebarOpen && 'justify-center'}`}
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
          <div className="border-t border-slate-800 p-3 space-y-2">
            {/* Legacy dark/light toggle */}
            <button
              onClick={toggleTheme}
              className={`flex w-full items-center space-x-3 rounded-lg px-3 py-2.5 transition-all hover:bg-slate-800 text-slate-400 hover:text-white ${
                !isSidebarOpen && 'justify-center'
              }`}
              title={isSidebarOpen ? 'Toggle theme (Ctrl+Shift+T)' : isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark ? (
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
              <div className="flex items-center space-x-2 px-3 py-2.5 rounded-lg bg-slate-900/50">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-400">Theme: {preset}</p>
                </div>
                <ThemeSelector />
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main
          className={`transition-all duration-300 ${
            isSidebarOpen ? 'ml-64' : 'ml-16'
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

