import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationProvider } from "./contexts/NotificationContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { RealtimeProvider } from "./contexts/RealtimeContext";
import { useAuth } from "./hooks/useAuth";
import DashboardPage from "@/pages/dashboard";
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
import RLPositionAgent from './pages/rl-position-agent';
import PositionSizingDashboard from './pages/position-sizing-dashboard';
import PaperTradingPage from "@/pages/paper-trading";
import PositionsPage from "@/pages/positions";
import SignalsPage from "@/pages/signals";
import AgentInteractionDashboard from "@/pages/agent-interactions";
import AgentSignalInsightsDashboard from "@/pages/agent-signal-insights";
import SignalStructuresPage from "@/pages/signal-structures";
import SymbolUniversePage from "@/pages/symbol-universe";
import LearningCenter from "@/pages/learning-center";
// removed CardShowcase and DashboardGrid pages (replaced by Agent Hub)
import NotFound from "@/pages/not-found";
import SignalPerformance from './pages/signal-performance';
import ScoutReportsPage from './pages/scout-reports';
import ScoutReportPage from './pages/scout-report';
import OrderPage from './pages/orders/[orderId]';
import LandingPage from "@/pages/landing";
import SettingsPage from "@/pages/settings";
import ProfilePage from "@/pages/profile";
import WatchlistPage from "@/pages/watchlist";
import GatewayAlertsPage from "@/pages/gateway-alerts";
import CommanderDashboard from "@/components/CommanderDashboard";
import AdminAPIDocsPanel from "@/pages/AdminAPIDocsPanel";
import { useEffect, lazy, Suspense } from "react";
const AgentArenaPage = lazy(() => import('@/pages/agent-arena-hub'))
import AgentRosterPage from "@/pages/agent-roster";
import AgentDetailPage from "@/pages/agent-detail";
import AgentLeaderboardPage from "@/pages/agent-leaderboard";
import AchievementTrackerPage from "@/pages/achievement-tracker";
import ComboActivityPage from "@/pages/combo-activity";
import RealtimeUpdatesPage from "@/pages/realtime-updates";
import MetricsDashboard from "@/pages/metrics-dashboard";
import RealtimeEventFeed from "@/components/RealtimeEventFeed";
import AppLayout from "./components/AppLayout";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";

function AuthenticatedRouter() {
  return (
    <RealtimeProvider>
      <AppLayout>
      <Switch>
        <Route path="/login">{() => <LoginPage />}</Route>
        <Route path="/register">{() => <RegisterPage />}</Route>
        <Route path="/" component={DashboardPage} />
        <Route path="/trading-terminal" component={TradingTerminal} />
        <Route path="/signals" component={SignalsPage} />
        <Route path="/signal-structures" component={SignalStructuresPage} />
        <Route path="/positions" component={PositionsPage} />
        <Route path="/portfolio" component={PortfolioPage} />
        <Route path="/scanner" component={ScannerPage} />
        <Route path="/gateway-scanner" component={GatewayScannerPage} />
        <Route path="/backtest" component={BacktestPage} />
        <Route path="/ml-engine" component={MLEnginePage} />
        <Route path="/ml-training" component={MLTrainingHub} />
        <Route path="/multi-timeframe" component={MultiTimeframePage} />
        <Route path="/flow-field" component={FlowFieldPage} />
        <Route path="/flow-engine" component={FlowEnginePage} />
        <Route path="/optimize" component={OptimizePage} />
        <Route path="/strategies" component={StrategiesPage} />
        <Route path="/agent-arena-hub" component={AgentArenaPage} />
        <Route path="/agent-roster" component={AgentRosterPage} />
        <Route path="/agent-detail/:agentName" component={AgentDetailPage} />
        <Route path="/agent-leaderboard" component={AgentLeaderboardPage} />
        <Route path="/achievements" component={AchievementTrackerPage} />
        <Route path="/combo-activity" component={ComboActivityPage} />
        <Route path="/realtime-updates" component={RealtimeUpdatesPage} />
        <Route path="/metrics-dashboard" component={MetricsDashboard} />
        <Route path="/strategy-synthesis" component={StrategySynthesisPage} />
        <Route path="/analytics" component={AnalyticsDashboard} />
        <Route path="/advanced-analytics" component={AdvancedAnalytics} />
        <Route path="/rl-position-agent" component={RLPositionAgent} />
        <Route path="/position-sizing" component={PositionSizingDashboard} />
        <Route path="/market-intelligence" component={MarketIntelligence} />
        <Route path="/paper-trading" component={PaperTradingPage} />
        <Route path="/agent-interactions" component={AgentInteractionDashboard} />
        <Route path="/agent-signal-insights" component={AgentSignalInsightsDashboard} />
        <Route path="/symbol-universe" component={SymbolUniversePage} />
        {/* /card-showcase and /dashboard-grid removed; Agent Hub is at /agent-arena-hub */}
        <Route path="/signal-performance" component={SignalPerformance} />
        <Route path="/learning-center" component={LearningCenter} />
        <Route path="/scout-reports" component={ScoutReportsPage} />
        <Route path="/scout-report/:symbol" component={ScoutReportPage} />
        <Route path="/orders/:orderId" component={OrderPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/watchlist" component={WatchlistPage} />
        <Route path="/gateway-alerts" component={GatewayAlertsPage} />
        <Route path="/commander" component={CommanderDashboard} />
        <Route path="/admin/api-docs" component={AdminAPIDocsPanel} />
        <Route component={NotFound} />
      </Switch>
      <RealtimeEventFeed position="bottom-right" maxVisible={3} />
    </AppLayout>
    </RealtimeProvider>
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
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
              <AppRouter />
            </Suspense>
          </TooltipProvider>
        </NotificationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;