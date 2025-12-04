import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Database, Zap, Brain, Bot, TrendingUp, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface SourceStructure {
  name: string;
  icon: any;
  color: string;
  description: string;
  structure: Record<string, any>;
  example: Record<string, any>;
  endpoint: string;
}

export default function SignalStructuresPage() {
  const [activeTab, setActiveTab] = useState('gateway');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const sourceStructures: SourceStructure[] = [
    {
      name: 'Gateway',
      icon: Zap,
      color: 'bg-yellow-500',
      description: 'Multi-exchange aggregated real-time signals',
      endpoint: '/api/gateway/signals',
      structure: {
        symbol: 'string (e.g., "BTC/USDT")',
        exchange: 'string (e.g., "binance", "coinbase")',
        signal: 'BUY | SELL | HOLD',
        strength: 'number (0-100) - signal confidence %',
        price: 'number - current price',
        change24h: 'number - 24h price change %',
        volume: 'number - 24h trading volume',
        trend: 'up | down | neutral',
        timestamp: 'number - unix timestamp',
        rsi: 'number (optional) - RSI indicator',
        macd: 'number (optional) - MACD value',
      },
      example: {
        symbol: 'BTC/USDT',
        exchange: 'binance',
        signal: 'BUY',
        strength: 78.5,
        price: 42350.50,
        change24h: 2.35,
        volume: 28500000000,
        trend: 'up',
        timestamp: 1701710400000,
        rsi: 65,
        macd: 245.30,
      },
    },
    {
      name: 'Scanner',
      icon: TrendingUp,
      color: 'bg-blue-500',
      description: 'Pattern detection and technical analysis signals',
      endpoint: '/api/scanner/signals',
      structure: {
        symbol: 'string',
        signal: 'BUY | SELL | HOLD',
        strength: 'number (0-100)',
        confidence: 'number (0-1)',
        pattern: 'string - detected pattern name',
        timeframe: 'string (e.g., "1h", "4h", "1d")',
        price: 'number',
        timestamp: 'number',
        source: 'string - "scanner"',
        sourceLabel: 'string - "🔍 Scanner"',
      },
      example: {
        symbol: 'ETH/USDT',
        signal: 'BUY',
        strength: 82.0,
        confidence: 0.82,
        pattern: 'double_bottom',
        timeframe: '4h',
        price: 2250.75,
        timestamp: 1701710400000,
        source: 'scanner',
        sourceLabel: '🔍 Scanner',
      },
    },
    {
      name: 'Strategies',
      icon: Bot,
      color: 'bg-purple-500',
      description: 'Strategy consensus and synthesized signals',
      endpoint: '/api/strategies/signals',
      structure: {
        symbol: 'string',
        signal: 'BUY | SELL | HOLD',
        strength: 'number (0-100)',
        confidence: 'number (0-1)',
        strategyName: 'string - which strategy',
        regime: 'string - market regime type',
        positionSize: 'number - recommended % of portfolio',
        stopLoss: 'number - price level',
        takeProfit: 'number - price level',
        holdingPeriod: 'number - hours',
        timestamp: 'number',
        source: 'string - "strategy"',
        sourceLabel: 'string - "🎯 Strategy"',
      },
      example: {
        symbol: 'SOL/USDT',
        signal: 'SELL',
        strength: 71.5,
        confidence: 0.715,
        strategyName: 'Mean Reversion',
        regime: 'BULL_STRONG',
        positionSize: 2.5,
        stopLoss: 145.50,
        takeProfit: 130.25,
        holdingPeriod: 48,
        timestamp: 1701710400000,
        source: 'strategy',
        sourceLabel: '🎯 Strategy',
      },
    },
    {
      name: 'ML Engine',
      icon: Brain,
      color: 'bg-green-500',
      description: 'Neural network predictions and classifications',
      endpoint: '/api/ml-engine/predictions',
      structure: {
        symbol: 'string',
        type: 'BUY | SELL | HOLD - predicted direction',
        direction: 'UP | DOWN | NEUTRAL',
        confidence: 'number (0-1) - prediction confidence',
        price: 'number | {predicted: number}',
        predictedPrice: 'number - next expected price',
        priceTarget: 'number - price target',
        volatility: 'number - predicted volatility',
        holdingPeriod: '{reason: string, hours: number}',
        timestamp: 'number',
        source: 'string - "ml"',
        sourceLabel: 'string - "🤖 ML Model"',
      },
      example: {
        symbol: 'ARB/USDT',
        type: 'BUY',
        direction: 'UP',
        confidence: 0.73,
        price: 1.25,
        predictedPrice: 1.38,
        priceTarget: 1.50,
        volatility: 0.024,
        holdingPeriod: { reason: 'Pattern continuation', hours: 72 },
        timestamp: 1701710400000,
        source: 'ml',
        sourceLabel: '🤖 ML Model',
      },
    },
    {
      name: 'RL Agent',
      icon: Bot,
      color: 'bg-cyan-500',
      description: 'Reinforcement learning position sizing & exits',
      endpoint: '/api/rl-agent/signals',
      structure: {
        symbol: 'string',
        signal: 'BUY | SELL | HOLD',
        strength: 'number (0-100) - signal strength',
        price: 'number - entry price',
        entryPrice: 'number',
        positionSize: 'number - USD position size',
        stopLoss: 'number - price level for stop',
        takeProfit: 'number - price level for profit target',
        riskReward: 'number - risk:reward ratio',
        confidence: 'number (0-1) - agent confidence',
        timestamp: 'number',
        reasoning: 'string[] - why agent chose this action',
        source: 'string - "rl"',
        sourceLabel: 'string - "🧠 RL Agent"',
      },
      example: {
        symbol: 'LINK/USDT',
        signal: 'BUY',
        strength: 65.0,
        price: 14.75,
        entryPrice: 14.75,
        positionSize: 2500,
        stopLoss: 14.29,
        takeProfit: 15.40,
        riskReward: 1.5,
        confidence: 0.65,
        timestamp: 1701710400000,
        reasoning: [
          'Position size: $2500.00',
          'Risk/Reward: 1.50',
          'Stop Loss: $14.29',
          'Take Profit: $15.40',
          'Volatility: 2.3%',
          'Trend: 45.2%',
        ],
        source: 'rl',
        sourceLabel: '🧠 RL Agent',
      },
    },
  ];

  const handleCopy = (text: string, source: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(source);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  return (
    <div className="flex-1 p-6 bg-gradient-to-br from-background to-background/50">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Database className="w-10 h-10" />
            Signal Structure Explorer
          </h1>
          <p className="text-muted-foreground text-lg">
            View the exact data structure and format from each of your 5 signal sources
          </p>
        </div>

        {/* Source Cards - Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            {sourceStructures.map((source) => (
              <TabsTrigger key={source.name} value={source.name.toLowerCase()}>
                <source.icon className="w-4 h-4 mr-2" />
                {source.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {sourceStructures.map((source) => (
            <TabsContent key={source.name} value={source.name.toLowerCase()}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Structure Card */}
                <Card className="border-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${source.color}`} />
                        Data Structure
                      </span>
                      <Badge variant="outline">{source.name}</Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{source.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-2 max-h-96 overflow-y-auto">
                      {Object.entries(source.structure).map(([key, type]) => (
                        <div key={key} className="flex gap-2">
                          <span className="text-primary font-semibold">{key}:</span>
                          <span className="text-muted-foreground">{typeof type === 'object' ? JSON.stringify(type) : type}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p>
                        <strong>Endpoint:</strong> <code className="bg-muted px-2 py-1 rounded">{source.endpoint}</code>
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Example Data Card */}
                <Card className="border-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${source.color}`} />
                        Example Response
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          handleCopy(JSON.stringify(source.example, null, 2), source.name);
                        }}
                      >
                        {copyFeedback === source.name ? '✓ Copied!' : 'Copy'}
                      </Button>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Live example from {source.name}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
                      <pre>{JSON.stringify(source.example, null, 2)}</pre>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Integration Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              How Signals Are Aggregated
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {sourceStructures.map((source, idx) => (
                <div key={source.name} className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${source.color}`} />
                    <span className="font-semibold">{idx + 1}. {source.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {source.description}
                  </p>
                  <code className="text-xs bg-muted p-2 rounded block text-wrap break-all">
                    {source.endpoint}
                  </code>
                </div>
              ))}
            </div>

            <div className="bg-muted p-4 rounded-lg mt-6">
              <h4 className="font-semibold mb-2">Unified Format</h4>
              <p className="text-sm text-muted-foreground mb-3">
                All signals are normalized to this universal structure in the Signals page:
              </p>
              <div className="bg-background p-3 rounded font-mono text-xs overflow-x-auto">
                <code>{`interface UnifiedSignal {
  symbol: string
  signal: 'BUY' | 'SELL' | 'HOLD'
  strength: number (0-100)
  price: number
  confidence?: number (0-1)
  timestamp: number
  source: 'gateway' | 'scanner' | 'strategy' | 'ml' | 'rl'
  sourceLabel: string  // e.g., "🚀 Gateway"
  [key: string]: any   // Additional source-specific fields
}`}</code>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
              <p className="text-sm">
                <strong>💡 Tip:</strong> Each source has unique strengths. Combined, they provide comprehensive market analysis:
              </p>
              <ul className="text-sm space-y-1 mt-2 ml-4">
                <li>🚀 Gateway = Real-time multi-exchange data</li>
                <li>🔍 Scanner = Pattern detection & technical analysis</li>
                <li>🎯 Strategies = Ensemble strategy consensus</li>
                <li>🤖 ML = Neural network predictions</li>
                <li>🧠 RL = Optimal position sizing & exits</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
