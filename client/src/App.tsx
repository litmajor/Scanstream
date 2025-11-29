import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationProvider } from "./contexts/NotificationContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import TradingTerminal from "@/pages/trading-terminal";
import PortfolioPage from "@/pages/portfolio";
import ScannerPage from "@/pages/scanner";
import GatewayScannerPage from "@/pages/gateway-scanner";
import BacktestPage from "@/pages/backtest";
import MLEnginePage from "@/pages/ml-engine";
import MultiTimeframePage from "@/pages/multi-timeframe";
import OptimizePage from "@/pages/optimize";
import StrategiesPage from "@/pages/strategies";
import MarketIntelligence from "@/pages/market-intelligence";
import StrategySynthesisPage from './pages/strategy-synthesis';
import PaperTradingPage from "@/pages/paper-trading";
import PositionsPage from "@/pages/positions";
import SignalsPage from "@/pages/signals";
import CardShowcase from "@/pages/card-showcase";
import DashboardGridPage from "@/pages/dashboard-grid";
import NotFound from "@/pages/not-found";
import { useState, useEffect } from "react";
import AppLayout from "./components/AppLayout";

function Router({ isDark, toggleTheme }: { isDark: boolean; toggleTheme: () => void }) {
  return (
    <AppLayout isDark={isDark} toggleTheme={toggleTheme}>
      <Switch>
        <Route path="/" component={TradingTerminal} />
        <Route path="/signals" component={SignalsPage} />
        <Route path="/positions" component={PositionsPage} />
        <Route path="/portfolio" component={PortfolioPage} />
        <Route path="/scanner" component={ScannerPage} />
        <Route path="/gateway-scanner" component={GatewayScannerPage} />
        <Route path="/backtest" component={BacktestPage} />
        <Route path="/ml-engine" component={MLEnginePage} />
        <Route path="/multi-timeframe" component={MultiTimeframePage} />
        <Route path="/optimize" component={OptimizePage} />
        <Route path="/strategies" component={StrategiesPage} />
                <Route path="/strategy-synthesis" component={StrategySynthesisPage} />
                <Route path="/market-intelligence" component={MarketIntelligence} />
                <Route path="/paper-trading" component={PaperTradingPage} />
                <Route path="/card-showcase" component={CardShowcase} />
                <Route path="/dashboard-grid" component={DashboardGridPage} />
                <Route component={NotFound} />
      </Switch>
    </AppLayout>
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
      <ThemeProvider>
        <NotificationProvider>
          <TooltipProvider>
            <Toaster />
            <Router isDark={isDark} toggleTheme={toggleTheme} />
          </TooltipProvider>
        </NotificationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;