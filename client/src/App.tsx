import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationProvider } from "./contexts/NotificationContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./hooks/useAuth";
import TradingTerminal from "@/pages/trading-terminal";
import PortfolioPage from "@/pages/portfolio";
import ScannerPage from "@/pages/scanner";
import GatewayScannerPage from "@/pages/gateway-scanner";
import BacktestPage from "@/pages/backtest";
import MLEnginePage from "@/pages/ml-engine";
import OptimizePage from "@/pages/optimize";
import MLTrainingHub from "@/pages/ml-training-hub";
import MultiTimeframePage from "@/pages/multi-timeframe";
import FlowFieldPage from "@/pages/flow-field";
import FlowEnginePage from './pages/flow-engine';
import StrategiesPage from "@/pages/strategies";
import MarketIntelligence from "@/pages/market-intelligence";
import StrategySynthesisPage from './pages/strategy-synthesis';
import AnalyticsDashboard from '@/pages/analytics-dashboard';
import AdvancedAnalytics from '@/pages/advanced-analytics';
import RLPositionAgent from '@/pages/rl-position-agent';
import PaperTradingPage from "@/pages/paper-trading";
import PositionsPage from "@/pages/positions";
import SignalsPage from "@/pages/signals";
import CardShowcase from "@/pages/card-showcase";
import DashboardGridPage from "@/pages/dashboard-grid";
import NotFound from "@/pages/not-found";
import SignalPerformance from './pages/signal-performance';
import LandingPage from "@/pages/landing";
import SettingsPage from "@/pages/settings";
import ProfilePage from "@/pages/profile";
import GatewayAlertsPage from "@/pages/gateway-alerts";
import { useEffect } from "react";
import AppLayout from "./components/AppLayout";

function AuthenticatedRouter() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={TradingTerminal} />
        <Route path="/signals" component={SignalsPage} />
        <Route path="/positions" component={PositionsPage} />
        <Route path="/portfolio" component={PortfolioPage} />
        <Route path="/scanner" component={ScannerPage} />
        <Route path="/gateway-scanner" component={GatewayScannerPage} />
        <Route path="/backtest" component={BacktestPage} />
        <Route path="/ml-engine" component={MLEnginePage} />
        <Route path="/ml-training" component={MLTrainingHub} />
        <Route path="/optimize" component={OptimizePage} />
        <Route path="/strategies" component={StrategiesPage} />
        <Route path="/strategy-synthesis" component={StrategySynthesisPage} />
        <Route path="/analytics" component={AnalyticsDashboard} />
        <Route path="/advanced-analytics" component={AdvancedAnalytics} />
        <Route path="/rl-position-agent" component={RLPositionAgent} />
        <Route path="/market-intelligence" component={MarketIntelligence} />
        <Route path="/paper-trading" component={PaperTradingPage} />
        <Route path="/card-showcase" component={CardShowcase} />
        <Route path="/dashboard-grid" component={DashboardGridPage} />
        <Route path="/signal-performance" component={SignalPerformance} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/gateway-alerts" component={GatewayAlertsPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function UnauthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route component={LandingPage} />
    </Switch>
  );
}

function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <UnauthenticatedRouter />;
  }

  return <AuthenticatedRouter />;
}

function App() {
  useEffect(() => {
    const htmlElement = document.documentElement;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NotificationProvider>
          <TooltipProvider>
            <Toaster />
            <AppRouter />
          </TooltipProvider>
        </NotificationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;