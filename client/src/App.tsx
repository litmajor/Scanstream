import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import TradingTerminal from "@/pages/trading-terminal";
import PortfolioPage from "@/pages/portfolio";
import ScannerPage from "@/pages/scanner";
import BacktestPage from "@/pages/backtest";
import MLEnginePage from "@/pages/ml-engine";
import MultiTimeframePage from "@/pages/multi-timeframe";
import OptimizePage from "@/pages/optimize";
import StrategiesPage from "@/pages/strategies";
import MarketIntelligence from "@/pages/market-intelligence";
import NotFound from "@/pages/not-found";
import { useState, useEffect } from "react";
import { Activity, TrendingUp, BarChart3, Zap, Target, Users, DollarSign, Settings } from 'lucide-react';
import TopSignalsWidget from './components/TopSignalsWidget';

function Router() {
  return (
    <Switch>
      <Route path="/" component={TradingTerminal} />
      <Route path="/portfolio" component={PortfolioPage} />
      <Route path="/scanner" component={ScannerPage} />
      <Route path="/backtest" component={BacktestPage} />
      <Route path="/ml-engine" component={MLEnginePage} />
      <Route path="/multi-timeframe" component={MultiTimeframePage} />
      <Route path="/optimize" component={OptimizePage} />
      <Route path="/strategies" component={StrategiesPage} />
      <Route path="/market-intelligence" component={MarketIntelligence} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Initialize theme from localStorage or system preference
  const [isDark, setIsDark] = useState(() => {
    // First, check localStorage for saved preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }

    // Then check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return true;
    }

    // Default to light mode
    return false;
  });

  const toggleTheme = () => {
    setIsDark(prev => {
      const newTheme = !prev;
      // Save preference to localStorage
      localStorage.setItem('theme', newTheme ? 'dark' : 'light');
      return newTheme;
    });
  };

  // Add keyboard shortcut for theme toggle (Ctrl+Shift+T)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // toggleTheme is stable, no need in deps

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className={isDark ? "dark" : ""}>
          <Toaster />
          {/* Navigation (Sidebar) */}
          <nav className="fixed inset-y-0 left-0 w-64 bg-slate-900/50 backdrop-blur-sm border-r border-slate-700/50 p-4 flex flex-col space-y-2">
            <a href="/" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors text-white font-bold">
              <img src="/logo.png" alt="Logo" className="w-8 h-8" />
              <span>AlgoTrader</span>
            </a>
            <a
              href="/"
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors text-slate-300 hover:text-white"
            >
              <Zap className="w-5 h-5" />
              <span>Dashboard</span>
            </a>
            <a
              href="/portfolio"
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors text-slate-300 hover:text-white"
            >
              <Users className="w-5 h-5" />
              <span>Portfolio</span>
            </a>
            <a
              href="/scanner"
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors text-slate-300 hover:text-white"
            >
              <Target className="w-5 h-5" />
              <span>Scanner</span>
            </a>
            <a
              href="/backtest"
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors text-slate-300 hover:text-white"
            >
              <BarChart3 className="w-5 h-5" />
              <span>Backtest</span>
            </a>
            <a
              href="/strategies"
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors text-slate-300 hover:text-white"
            >
              <Target className="w-5 h-5" />
              <span>Strategies</span>
            </a>
            <a
              href="/paper-trading"
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors text-slate-300 hover:text-white"
            >
              <DollarSign className="w-5 h-5" />
              <span>Paper Trading</span>
            </a>
            <a
              href="/ml-engine"
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors text-slate-300 hover:text-white"
            >
              <Settings className="w-5 h-5" />
              <span>ML Engine</span>
            </a>
            <a
              href="/market-intelligence"
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors text-slate-300 hover:text-white"
            >
              <TrendingUp className="w-5 h-5" />
              <span>Market Intelligence</span>
            </a>
            <div className="mt-auto">
              {/* Placeholder for potential future elements like settings or logout */}
            </div>
          </nav>

          {/* Main Content Area */}
          <div className="ml-64 p-8">
            <main className="flex flex-col space-y-8">
              {/* Top Signals Section */}
      <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl shadow-blue-500/5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-green-400" />
            Top Signals
          </h2>
          <a href="/scanner" className="text-sm text-blue-400 hover:text-blue-300">View All →</a>
        </div>
        <TopSignalsWidget />
      </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Market Overview */}
                <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl shadow-blue-500/5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white flex items-center">
                      <Activity className="w-5 h-5 mr-2 text-blue-400" />
                      Market Overview
                    </h2>
                  </div>
                  {/* Market Overview Content */}
                  <div className="space-y-4">
                    <p className="text-slate-400">Current market sentiment and key performance indicators.</p>
                    {/* Add more market overview components here */}
                  </div>
                </div>

                {/* Other Widgets - Placeholder */}
                <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl shadow-blue-500/5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2 text-purple-400" />
                      Performance Metrics
                    </h2>
                  </div>
                  <p className="text-slate-400">Detailed performance metrics will be displayed here.</p>
                </div>
              </div>

              {/* Placeholder for other dashboard sections */}
              <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl shadow-blue-500/5">
                <h2 className="text-lg font-semibold text-white mb-4">
                  <Zap className="w-5 h-5 mr-2 text-yellow-400 inline-block" />
                  Recent Activity
                </h2>
                <p className="text-slate-400">Recent activities and updates will appear here.</p>
              </div>
            </main>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="fixed bottom-4 right-4 theme-toggle z-50"
            aria-label={`Toggle theme (Current: ${isDark ? 'Dark' : 'Light'} mode). Shortcut: Ctrl+Shift+T`}
            title="Toggle theme (Ctrl+Shift+T)"
          >
            {isDark ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;