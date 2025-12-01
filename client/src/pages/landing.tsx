import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  TrendingUp, 
  Zap, 
  Shield, 
  LineChart, 
  Clock,
  ArrowRight,
  Activity,
  Globe
} from "lucide-react";

export default function LandingPage() {
  const features = [
    {
      icon: Zap,
      title: "Real-Time Signals",
      description: "Get instant trading signals powered by advanced technical analysis and machine learning algorithms."
    },
    {
      icon: LineChart,
      title: "Multi-Timeframe Analysis",
      description: "Analyze markets across multiple timeframes simultaneously for comprehensive trading decisions."
    },
    {
      icon: Globe,
      title: "CoinGecko Integration",
      description: "Access real-time market data, sentiment analysis, and comprehensive crypto metrics."
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description: "Volume profile, flow field analysis, and composite scoring for deep market insights."
    },
    {
      icon: Shield,
      title: "Risk Management",
      description: "Built-in stop-loss, take-profit calculations and position sizing recommendations."
    },
    {
      icon: Clock,
      title: "Paper Trading",
      description: "Test your strategies risk-free with our realistic paper trading simulation."
    }
  ];

  const stats = [
    { value: "50+", label: "Trading Pairs" },
    { value: "6", label: "Exchanges" },
    { value: "< 1s", label: "Signal Latency" },
    { value: "24/7", label: "Market Coverage" }
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-500" />
            <span className="font-bold text-xl">Scanstream</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-features">
              Features
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-pricing">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild data-testid="button-login">
              <a href="/api/login">Log In</a>
            </Button>
            <Button asChild data-testid="button-signup">
              <a href="/api/login">Get Started</a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="py-20 md:py-32">
          <div className="container mx-auto px-4 text-center">
            <Badge variant="secondary" className="mb-4" data-testid="badge-hero">
              Professional Trading Terminal
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6" data-testid="text-hero-title">
              Trade Smarter with
              <span className="text-blue-500"> AI-Powered</span> Signals
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8" data-testid="text-hero-description">
              Scanstream is a professional-grade trading terminal that combines real-time market data, 
              advanced technical analysis, and machine learning to help you make better trading decisions.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" asChild data-testid="button-start-trading">
                <a href="/api/login">
                  Start Trading Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild data-testid="button-view-demo">
                <a href="#features">View Features</a>
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 max-w-3xl mx-auto">
              {stats.map((stat, index) => (
                <div key={index} className="text-center" data-testid={`stat-${index}`}>
                  <div className="text-3xl font-bold text-blue-500">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="py-20 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4" data-testid="text-features-title">
                Everything You Need to Trade
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto" data-testid="text-features-description">
                Comprehensive tools and features designed for both beginners and professional traders.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <Card key={index} className="bg-card" data-testid={`card-feature-${index}`}>
                  <CardHeader>
                    <feature.icon className="h-10 w-10 text-blue-500 mb-2" />
                    <CardTitle>{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4" data-testid="text-exchanges-title">
                Supported Exchanges
              </h2>
              <p className="text-muted-foreground" data-testid="text-exchanges-description">
                Connect to major cryptocurrency exchanges for real-time data and trading.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-8">
              {["Binance", "Coinbase", "Kraken", "KuCoin", "OKX", "Bybit"].map((exchange, index) => (
                <div key={index} className="text-lg font-medium text-muted-foreground" data-testid={`exchange-${exchange.toLowerCase()}`}>
                  {exchange}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="py-20 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4" data-testid="text-cta-title">
                Ready to Start Trading?
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto mb-8" data-testid="text-cta-description">
                Join thousands of traders who are already using Scanstream to make smarter trading decisions.
              </p>
              <Button size="lg" asChild data-testid="button-cta-signup">
                <a href="/api/login">
                  Create Free Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <span className="font-semibold">Scanstream</span>
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-footer">
              Professional trading terminal for cryptocurrency markets.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
