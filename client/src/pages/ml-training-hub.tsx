
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Brain, Play, Download, TrendingUp, Activity, Target, Zap, BarChart3, RefreshCw } from 'lucide-react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ModelMetrics {
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  avgConfidence: number;
  winRate: number;
  avgPriceError: number;
  precision: number;
  recall: number;
  f1Score: number;
}

interface OptimizationResult {
  bestParams: Record<string, any>;
  bestScore: number;
  history: Array<{ params: Record<string, any>; score: number }>;
  iterations: number;
}

export default function MLTrainingHub() {
  const [, setLocation] = useLocation();
  const [trainingInProgress, setTrainingInProgress] = useState(false);
  const [optimizationInProgress, setOptimizationInProgress] = useState(false);

  // Fetch model performance metrics
  const { data: metrics, refetch: refetchMetrics } = useQuery<ModelMetrics>({
    queryKey: ['model-metrics'],
    queryFn: async () => {
      const res = await fetch('/api/model-performance/metrics');
      if (!res.ok) throw new Error('Failed to fetch metrics');
      const data = await res.json();
      return data.metrics;
    },
    refetchInterval: 30000,
  });

  // Fetch optimization status
  const { data: optimizationStatus } = useQuery({
    queryKey: ['optimization-status'],
    queryFn: async () => {
      const res = await fetch('/api/optimize/status');
      if (!res.ok) return { initialized: false };
      return res.json();
    },
    refetchInterval: 15000,
  });

  // Fetch ML predictions (to show signals)
  const { data: mlSignals } = useQuery({
    queryKey: ['ml-signals'],
    queryFn: async () => {
      const res = await fetch('/api/ml-engine/predictions');
      if (!res.ok) return { predictions: [] };
      return res.json();
    },
    refetchInterval: 45000,
  });

  // Train models mutation
  const trainModelsMutation = useMutation({
    mutationFn: async () => {
      // Fetch chart data for training
      const chartRes = await fetch('/api/chart/BTC/USDT?timeframe=1h&limit=500');
      if (!chartRes.ok) throw new Error('Failed to fetch training data');
      const chartData = await chartRes.json();

      // Submit training request
      const res = await fetch('/api/ml-training/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chartData: chartData.candles || chartData,
          modelType: 'all'
        })
      });

      if (!res.ok) throw new Error('Training failed');
      return res.json();
    },
    onSuccess: () => {
      setTrainingInProgress(false);
      refetchMetrics();
    },
    onError: (error) => {
      setTrainingInProgress(false);
      console.error('Training error:', error);
    }
  });

  // Run optimization mutation
  const optimizeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/optimize/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optimizeScanner: true,
          optimizeML: true,
          optimizeRL: true,
          optimizeStrategies: true,
          iterations: 15,
          parallelOptimization: false,
          symbol: 'BTC/USDT',
          timeframe: '1h',
          dataPoints: 500
        })
      });

      if (!res.ok) throw new Error('Optimization failed');
      return res.json();
    },
    onSuccess: () => {
      setOptimizationInProgress(false);
    },
    onError: (error) => {
      setOptimizationInProgress(false);
      console.error('Optimization error:', error);
    }
  });

  const handleTrainModels = () => {
    setTrainingInProgress(true);
    trainModelsMutation.mutate();
  };

  const handleOptimize = () => {
    setOptimizationInProgress(true);
    optimizeMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800/50 backdrop-blur-xl bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => setLocation('/')}
              className="flex items-center text-slate-400 hover:text-white transition-all"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="font-medium">Back</span>
            </button>

            <div className="flex-1 text-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                ML Training & Optimization Hub
              </h1>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                onClick={() => refetchMetrics()}
                variant="outline"
                size="sm"
                className="border-slate-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
            <CardHeader>
              <CardTitle className="flex items-center text-blue-400">
                <Brain className="w-5 h-5 mr-2" />
                Train ML Models
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">
                Train all ML models on latest market data (500 candles)
              </p>
              <Button
                onClick={handleTrainModels}
                disabled={trainingInProgress}
                className="w-full bg-blue-600 hover:bg-blue-500"
              >
                {trainingInProgress ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Training...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Training
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20">
            <CardHeader>
              <CardTitle className="flex items-center text-purple-400">
                <Target className="w-5 h-5 mr-2" />
                Run Optimization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">
                Optimize all agents (Scanner, ML, RL, Strategies)
              </p>
              <Button
                onClick={handleOptimize}
                disabled={optimizationInProgress}
                className="w-full bg-purple-600 hover:bg-purple-500"
              >
                {optimizationInProgress ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Optimizing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Start Optimization
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Model Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400">Total Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {metrics?.totalPredictions || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400">Accuracy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">
                {metrics?.accuracy?.toFixed(1) || 0}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400">Win Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">
                {metrics?.winRate?.toFixed(1) || 0}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400">Avg Confidence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-400">
                {(metrics?.avgConfidence || 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="metrics" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="metrics">Model Metrics</TabsTrigger>
            <TabsTrigger value="signals">Recent Signals</TabsTrigger>
            <TabsTrigger value="optimization">Optimization Status</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics">
            <Card>
              <CardHeader>
                <CardTitle>Detailed Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Precision:</span>
                      <span className="font-mono text-white">{metrics?.precision?.toFixed(2) || 0}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Recall:</span>
                      <span className="font-mono text-white">{metrics?.recall?.toFixed(2) || 0}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">F1 Score:</span>
                      <span className="font-mono text-white">{metrics?.f1Score?.toFixed(2) || 0}%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Correct Predictions:</span>
                      <span className="font-mono text-green-400">{metrics?.correctPredictions || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Avg Price Error:</span>
                      <span className="font-mono text-red-400">{metrics?.avgPriceError?.toFixed(2) || 0}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signals">
            <Card>
              <CardHeader>
                <CardTitle>Recent ML Signals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mlSignals?.predictions?.slice(0, 10).map((signal: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                      <div>
                        <div className="font-bold text-white">{signal.symbol}</div>
                        <div className="text-sm text-slate-400">
                          Direction: {signal.direction} | Confidence: {(signal.confidence * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-400">Price Target</div>
                        <div className="font-mono text-white">${signal.price?.toFixed(2)}</div>
                      </div>
                    </div>
                  )) || (
                    <div className="text-center text-slate-500 py-8">
                      No signals yet. Train models to generate predictions.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="optimization">
            <Card>
              <CardHeader>
                <CardTitle>Optimization Status</CardTitle>
              </CardHeader>
              <CardContent>
                {optimizationStatus?.initialized ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Status:</span>
                      <span className="text-green-400 font-semibold">Active</span>
                    </div>
                    {optimizationStatus.report && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-white">Agent Performance:</h3>
                        {Object.entries(optimizationStatus.report.agents || {}).map(([name, data]: [string, any]) => (
                          <div key={name} className="flex justify-between p-2 bg-slate-800/30 rounded">
                            <span className="text-slate-300">{name}</span>
                            <span className="font-mono text-blue-400">
                              {data.bestPerformance?.toFixed(4) || 'N/A'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-slate-500 py-8">
                    Not initialized. Run optimization to begin tracking.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
