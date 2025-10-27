import { Wallet, TrendingUp, Users, DollarSign, BarChart3, Zap, Bell, Rocket, Award } from 'lucide-react';
import { StatCard, ActionCard, InfoCard, AlertCard } from '../components/cards';
import { useState } from 'react';

export default function CardShowcase() {
  const [alerts, setAlerts] = useState([
    { id: 1, type: 'success' as const, title: 'Trade Executed', message: 'BTC/USDT long position opened at $45,000' },
    { id: 2, type: 'warning' as const, title: 'Risk Warning', message: 'Portfolio drawdown approaching 15% threshold' },
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            Unified Card System
          </h1>
          <p className="text-slate-400">
            Professional, consistent card components with glassmorphism design
          </p>
        </div>

        {/* Alert Cards */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Alert Cards</h2>
          <div className="grid grid-cols-1 gap-4">
            {alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                type={alert.type}
                title={alert.title}
                message={alert.message}
                onClose={() => setAlerts(alerts.filter(a => a.id !== alert.id))}
                action={{
                  label: 'View Details',
                  onClick: () => console.log('View details clicked'),
                }}
              />
            ))}
            
            <AlertCard
              type="error"
              title="Connection Lost"
              message="WebSocket connection to trading server has been interrupted. Attempting to reconnect..."
            />
            
            <AlertCard
              type="info"
              title="System Update"
              message="New ML model v2.5 is now available. Upgrade to improve prediction accuracy by 12%."
              action={{
                label: 'Upgrade Now',
                onClick: () => console.log('Upgrade clicked'),
              }}
            />
          </div>
        </section>

        {/* Stat Cards */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Stat Cards</h2>
          
          {/* Default Size (md) */}
          <h3 className="text-lg font-semibold text-slate-400 mb-4">Medium Size (Default)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              title="Total Portfolio"
              value="$45,234.56"
              change={12.5}
              changeLabel="this month"
              icon={Wallet}
              variant="success"
            />
            
            <StatCard
              title="Win Rate"
              value="68.4%"
              change={2.3}
              icon={TrendingUp}
              variant="info"
            />
            
            <StatCard
              title="Active Positions"
              value="12"
              change={-1}
              changeLabel="from yesterday"
              icon={Users}
            />
            
            <StatCard
              title="Daily P&L"
              value="-$234.50"
              change={-3.2}
              icon={DollarSign}
              variant="error"
            />
          </div>

          {/* Small Size */}
          <h3 className="text-lg font-semibold text-slate-400 mb-4">Small Size</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatCard
              title="Trades"
              value="156"
              change={8}
              icon={BarChart3}
              size="sm"
            />
            
            <StatCard
              title="Signals"
              value="42"
              change={0}
              trend="neutral"
              icon={Zap}
              size="sm"
              variant="warning"
            />
            
            <StatCard
              title="Alerts"
              value="3"
              icon={Bell}
              size="sm"
              variant="info"
            />
            
            <StatCard
              title="Score"
              value="A+"
              icon={Award}
              size="sm"
              variant="success"
            />
          </div>

          {/* Large Size */}
          <h3 className="text-lg font-semibold text-slate-400 mb-4">Large Size</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard
              title="Total Return"
              value="$12,345.67"
              change={45.8}
              changeLabel="since inception"
              icon={Rocket}
              variant="success"
              size="lg"
            />
            
            <StatCard
              title="Best Strategy"
              value="RSI + MACD"
              change={89.5}
              changeLabel="success rate"
              icon={Award}
              variant="info"
              size="lg"
            />
          </div>
        </section>

        {/* Action Cards */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Action Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ActionCard
              title="Run Backtest"
              description="Test your strategy against historical data to evaluate performance before going live."
              icon={BarChart3}
              variant="primary"
              onClick={() => console.log('Backtest clicked')}
            />
            
            <ActionCard
              title="Start Paper Trading"
              description="Practice trading with virtual money in real market conditions without any risk."
              icon={TrendingUp}
              variant="success"
              onClick={() => console.log('Paper trading clicked')}
            />
            
            <ActionCard
              title="Deploy Strategy"
              description="Launch your optimized strategy to live trading with automatic execution."
              icon={Rocket}
              variant="warning"
              badge="Pro"
              onClick={() => console.log('Deploy clicked')}
            />
            
            <ActionCard
              title="View Market Intelligence"
              description="Access AI-powered market analysis and predictions for informed trading decisions."
              icon={Zap}
              onClick={() => console.log('Market intel clicked')}
            />
            
            <ActionCard
              title="Optimize Parameters"
              description="Use machine learning to find the best strategy parameters for maximum profitability."
              icon={Award}
              variant="primary"
              onClick={() => console.log('Optimize clicked')}
            />
            
            <ActionCard
              title="Export Reports"
              description="Generate comprehensive PDF reports of your trading performance and analytics."
              icon={DollarSign}
              disabled
              badge="Coming Soon"
              onClick={() => console.log('Export clicked')}
            />
          </div>
        </section>

        {/* Info Cards */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Info Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoCard
              title="Trading Strategy: RSI Momentum"
              content={
                <div className="space-y-2">
                  <p>A trend-following strategy that uses RSI indicator to identify oversold/overbought conditions.</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-500">
                    <li>Entry: RSI crosses below 30</li>
                    <li>Exit: RSI crosses above 70</li>
                    <li>Stop Loss: 2% from entry</li>
                    <li>Take Profit: 5% from entry</li>
                  </ul>
                </div>
              }
              icon={BarChart3}
              variant="primary"
              footer={
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Last updated: 2 hours ago</span>
                  <span className="text-green-400">Active</span>
                </div>
              }
            />
            
            <InfoCard
              title="Market Conditions"
              content="Current market shows high volatility with increased trading volume. BTC dominance at 48.5%. Fear & Greed Index: 35 (Fear)."
              icon={TrendingUp}
              variant="info"
            />
            
            <InfoCard
              title="Risk Management"
              content="Your portfolio is well-diversified across 5 assets. Current risk score: Low. Maximum drawdown: 12.5%. Recommended position size: 3-5% per trade."
              icon={Wallet}
              variant="success"
              size="sm"
            />
            
            <InfoCard
              title="System Performance"
              content="All systems operational. WebSocket latency: 15ms. API response time: 45ms. Database queries: 250/sec. Server uptime: 99.8%."
              icon={Zap}
              variant="info"
              size="sm"
              footer={
                <span className="text-xs text-green-400">● All systems healthy</span>
              }
            />
          </div>
        </section>

        {/* Color Variants Showcase */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Color Variants</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              title="Default"
              value="50"
              icon={BarChart3}
            />
            <StatCard
              title="Success"
              value="85"
              icon={TrendingUp}
              variant="success"
            />
            <StatCard
              title="Warning"
              value="65"
              icon={Bell}
              variant="warning"
            />
            <StatCard
              title="Error"
              value="25"
              icon={DollarSign}
              variant="error"
            />
            <StatCard
              title="Info"
              value="92"
              icon={Zap}
              variant="info"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

