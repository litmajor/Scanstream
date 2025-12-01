
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
  Globe,
  CheckCircle2,
  Star,
  Brain,
  Target,
  Sparkles,
  ChevronRight,
  Users,
  Award,
  Code,
  Rocket
} from "lucide-react";

export default function LandingPage() {
  const features = [
    {
      icon: Zap,
      title: "Real-Time Signals",
      description: "Get instant trading signals powered by advanced technical analysis and machine learning algorithms.",
      color: "text-yellow-500"
    },
    {
      icon: LineChart,
      title: "Multi-Timeframe Analysis",
      description: "Analyze markets across multiple timeframes simultaneously for comprehensive trading decisions.",
      color: "text-blue-500"
    },
    {
      icon: Globe,
      title: "CoinGecko Integration",
      description: "Access real-time market data, sentiment analysis, and comprehensive crypto metrics.",
      color: "text-green-500"
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description: "Volume profile, flow field analysis, and composite scoring for deep market insights.",
      color: "text-purple-500"
    },
    {
      icon: Shield,
      title: "Risk Management",
      description: "Built-in stop-loss, take-profit calculations and position sizing recommendations.",
      color: "text-red-500"
    },
    {
      icon: Clock,
      title: "Paper Trading",
      description: "Test your strategies risk-free with our realistic paper trading simulation.",
      color: "text-orange-500"
    }
  ];

  const stats = [
    { value: "50+", label: "Trading Pairs", icon: Target },
    { value: "6", label: "Exchanges", icon: Globe },
    { value: "< 1s", label: "Signal Latency", icon: Zap },
    { value: "24/7", label: "Market Coverage", icon: Clock }
  ];

  const benefits = [
    "AI-powered signal generation",
    "Real-time market scanning",
    "Advanced risk management",
    "Multi-exchange support",
    "Backtesting engine",
    "Portfolio analytics"
  ];

  const testimonials = [
    {
      name: "Alex Chen",
      role: "Day Trader",
      content: "Scanstream has transformed my trading. The real-time signals are incredibly accurate.",
      rating: 5
    },
    {
      name: "Sarah Johnson",
      role: "Crypto Investor",
      content: "Best trading terminal I've used. The analytics are professional-grade.",
      rating: 5
    },
    {
      name: "Mike Rodriguez",
      role: "Algorithmic Trader",
      content: "The backtesting and ML features are exactly what I needed. Highly recommend!",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-500" />
            <span className="font-bold text-xl bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              Scanstream
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-features">
              Features
            </a>
            <a href="#benefits" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Benefits
            </a>
            <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Testimonials
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-pricing">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild data-testid="button-login">
              <a href="/api/login">Log In</a>
            </Button>
            <Button asChild data-testid="button-signup" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <a href="/api/login">Get Started</a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="py-20 md:py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 animate-pulse" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <Badge variant="secondary" className="mb-4 animate-bounce" data-testid="badge-hero">
              <Sparkles className="h-3 w-3 mr-1" />
              Professional Trading Terminal
            </Badge>
            <h1 className="text-4xl md:text-7xl font-bold tracking-tight mb-6" data-testid="text-hero-title">
              Trade Smarter with
              <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent"> AI-Powered</span> Signals
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed" data-testid="text-hero-description">
              Scanstream is a professional-grade trading terminal that combines real-time market data, 
              advanced technical analysis, and machine learning to help you make better trading decisions.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
              <Button size="lg" asChild data-testid="button-start-trading" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg px-8 py-6">
                <a href="/api/login">
                  Start Trading Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild data-testid="button-view-demo" className="text-lg px-8 py-6 border-2">
                <a href="#features">
                  View Features
                  <ChevronRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 max-w-4xl mx-auto">
              {stats.map((stat, index) => (
                <div key={index} className="relative group" data-testid={`stat-${index}`}>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg opacity-0 group-hover:opacity-20 transition-opacity blur" />
                  <Card className="relative border-2 hover:border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:scale-105">
                    <CardContent className="pt-6 text-center">
                      <stat.icon className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                      <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">{stat.value}</div>
                      <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4">
                <Rocket className="h-3 w-3 mr-1" />
                Powerful Features
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-features-title">
                Everything You Need to Trade
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-features-description">
                Comprehensive tools and features designed for both beginners and professional traders.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <Card key={index} className="bg-card hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 hover:border-blue-500/50 group" data-testid={`card-feature-${index}`}>
                  <CardHeader>
                    <div className="relative">
                      <div className={`absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full opacity-0 group-hover:opacity-20 transition-opacity blur-xl`} />
                      <feature.icon className={`h-12 w-12 mb-4 ${feature.color} relative z-10`} />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                    <CardDescription className="text-base">{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section id="benefits" className="py-20">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <Badge variant="outline" className="mb-4">
                  <Star className="h-3 w-3 mr-1" />
                  Why Choose Us
                </Badge>
                <h2 className="text-4xl font-bold mb-6">
                  Professional Trading Made Simple
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Access institutional-grade tools without the complexity. Our platform combines cutting-edge 
                  technology with an intuitive interface.
                </p>
                <div className="grid gap-4">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="flex items-center gap-3 group">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      </div>
                      <span className="text-lg">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-3xl opacity-20 blur-3xl" />
                <Card className="relative border-2 p-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Brain className="h-6 w-6 text-blue-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold">AI-Powered Intelligence</h3>
                        <p className="text-sm text-muted-foreground">Machine learning models analyze market patterns</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Code className="h-6 w-6 text-purple-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Advanced Algorithms</h3>
                        <p className="text-sm text-muted-foreground">Sophisticated technical indicators and strategies</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <Award className="h-6 w-6 text-green-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Proven Results</h3>
                        <p className="text-sm text-muted-foreground">Trusted by thousands of active traders</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="py-20 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4">
                <Users className="h-3 w-3 mr-1" />
                Testimonials
              </Badge>
              <h2 className="text-4xl font-bold mb-4">
                Loved by Traders Worldwide
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Join thousands of successful traders who trust Scanstream
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((testimonial, index) => (
                <Card key={index} className="hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <CardHeader>
                    <div className="flex items-center gap-1 mb-2">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      ))}
                    </div>
                    <CardDescription className="text-base italic">"{testimonial.content}"</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Exchanges Section */}
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
                <div key={index} className="group" data-testid={`exchange-${exchange.toLowerCase()}`}>
                  <div className="text-xl font-semibold text-muted-foreground group-hover:text-foreground transition-colors group-hover:scale-110 transform duration-200">
                    {exchange}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section id="pricing" className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12 max-w-3xl mx-auto">
              <h2 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-cta-title">
                Ready to Start Trading?
              </h2>
              <p className="text-lg md:text-xl text-white/90 mb-8" data-testid="text-cta-description">
                Join thousands of traders who are already using Scanstream to make smarter trading decisions.
                Start your free trial today, no credit card required.
              </p>
              <Button size="lg" asChild data-testid="button-cta-signup" variant="secondary" className="text-lg px-8 py-6">
                <a href="/api/login">
                  Create Free Account
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
              <p className="text-sm text-white/70 mt-4">Free forever. No credit card required.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-5 w-5 text-blue-500" />
                <span className="font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                  Scanstream
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Professional trading terminal for cryptocurrency markets.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#benefits" className="hover:text-foreground transition-colors">Benefits</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API Reference</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Guides</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground" data-testid="text-footer">
              © 2024 Scanstream. All rights reserved.
            </p>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
