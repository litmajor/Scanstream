import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Brain, Play, Download, Settings, TrendingUp, BarChart3, Zap, Target } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

// Mock ML data - replace with real data from API
const mockMLData = {
  models: [
    {
      id: '1',
      name: 'BTC Price Predictor',
      type: 'LSTM',
      symbol: 'BTC/USDT',
      accuracy: 87.3,
      status: 'trained',
      lastTrained: new Date('2024-10-18'),
      predictions: {
        nextHour: 45120,
        nextDay: 46250,
        nextWeek: 48500,
        confidence: 0.85
      }
    },
    {
      id: '2',
      name: 'ETH Volatility Model',
      type: 'Random Forest',
      symbol: 'ETH/USDT',
      accuracy: 82.1,
      status: 'training',
      lastTrained: new Date('2024-10-19'),
      predictions: {
        nextHour: 3250,
        nextDay: 3180,
        nextWeek: 3400,
        confidence: 0.78
      }
    },
    {
      id: '3',
      name: 'Market Sentiment Analyzer',
      type: 'BERT',
      symbol: 'SOL/USDT',
      accuracy: 91.5,
      status: 'trained',
      lastTrained: new Date('2024-10-17'),
      predictions: {
        nextHour: 98,
        nextDay: 105,
        nextWeek: 112,
        confidence: 0.92
      }
    }
  ],
  features: [
    { name: 'Price', weight: 0.35, importance: 'high' },
    { name: 'Volume', weight: 0.25, importance: 'high' },
    { name: 'RSI', weight: 0.15, importance: 'medium' },
    { name: 'MACD', weight: 0.12, importance: 'medium' },
    { name: 'EMA', weight: 0.08, importance: 'low' },
    { name: 'Sentiment', weight: 0.05, importance: 'low' }
  ],
  performance: {
    totalPredictions: 1247,
    correctPredictions: 1089,
    accuracy: 87.3,
    avgConfidence: 0.84
  }
};

export default function MLEnginePage() {
  const [, setLocation] = useLocation();
  const [selectedModel, setSelectedModel] = useState('');
  const [isTraining, setIsTraining] = useState(false);

  // Fetch ML data from API
  const { data: mlData, isLoading, error, refetch } = useQuery({
    queryKey: ['ml-data'],
    queryFn: async () => {
      const [predictionsRes, statusRes, performanceRes, ensembleRes] = await Promise.all([
        fetch('/api/ml-engine/predictions'),
        fetch('/api/ml-engine/status'),
        fetch('/api/model-performance/metrics'),
        fetch('/api/model-performance/ensemble-status')
      ]);

      if (!predictionsRes.ok) {
        throw new Error('Failed to fetch predictions');
      }

      const predictions = await predictionsRes.json();
      const status = statusRes.ok ? await statusRes.json() : {};
      const performance = performanceRes.ok ? await performanceRes.json() : { metrics: {} };
      const ensemble = ensembleRes.ok ? await ensembleRes.json() : { ensemble: {} };

      // Transform to expected format with real performance metrics
      const metrics = performance.metrics || {};
      
      return {
        models: (predictions.predictions || []).slice(0, 3).map((p: any, i: number) => ({
          id: String(i + 1),
          name: `${p.symbol} Direction & Price`,
          type: 'Ensemble Model',
          symbol: p.symbol,
          accuracy: ((metrics.accuracy || 75)).toFixed(1),
          status: ensemble.ensemble?.status || 'active',
          lastTrained: new Date(),
          predictions: {
            nextHour: p.price,
            nextDay: p.price * (p.direction === 'UP' ? 1.01 : 0.99),
            nextWeek: p.price * (p.direction === 'UP' ? 1.03 : 0.97),
            confidence: p.confidence
          }
        })),
        features: Object.entries(status.featureImportance || {}).map(([name, weight]) => ({
          name,
          weight: Number(weight),
          importance: Number(weight) > 0.3 ? 'high' : Number(weight) > 0.15 ? 'medium' : 'low'
        })),
        performance: {
          totalPredictions: metrics.totalPredictions || 0,
          correctPredictions: metrics.correctPredictions || 0,
          accuracy: (metrics.accuracy || 75).toFixed(1),
          avgConfidence: (metrics.avgConfidence || 0.75).toFixed(2),
          winRate: (metrics.winRate || 0).toFixed(1),
          precision: (metrics.precision || 0).toFixed(1)
        }
      };
    },
    refetchInterval: 15000,
  });

  const handleTrainModel = async () => {
    if (!selectedModel) {
      alert('Please select a model to train');
      return;
    }

    setIsTraining(true);
    try {
      const response = await fetch('/api/ml-training/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: selectedModel })
      });

      if (!response.ok) {
        throw new Error('Training failed');
      }

      await refetch();
    } catch (err) {
      console.error('Training error:', err);
      alert('Training failed. Check console for details.');
    } finally {
      setIsTraining(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'trained': return 'text-green-500 bg-green-100 dark:bg-green-900';
      case 'training': return 'text-blue-500 bg-blue-100 dark:bg-blue-900';
      case 'failed': return 'text-red-500 bg-red-100 dark:bg-red-900';
      default: return 'text-gray-500 bg-gray-100 dark:bg-gray-900';
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 85) return 'text-green-500';
    if (accuracy >= 75) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading ML models...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-white mb-2">Error Loading ML Engine</h2>
          <p className="text-slate-400 mb-4">Failed to load ML models</p>
          <button
            onClick={() => refetch()}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg transition-all text-white font-semibold shadow-lg shadow-blue-500/20"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      {/* Header */}
      <div className="relative border-b border-slate-800/50 backdrop-blur-xl bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Back Button */}
            <button
              onClick={() => setLocation('/')}
              className="flex items-center text-slate-400 hover:text-white transition-all hover:translate-x-[-2px]"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="font-medium">Back to Dashboard</span>
            </button>

            {/* Page Title */}
            <div className="flex-1 text-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                ML Engine
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Machine learning powered predictions</p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <button
                className="p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all text-slate-300 hover:text-white"
                title="Export Models"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                className="p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all text-slate-300 hover:text-white"
                title="ML Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ML Engine Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Performance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Target className="w-6 h-6 text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-400">Total Predictions</p>
                <p className="text-2xl font-semibold text-white">
                  {mlData?.performance.totalPredictions.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-400">Accuracy</p>
                <p className={`text-2xl font-semibold ${getAccuracyColor(mlData?.performance.accuracy || 0)}`}>
                  {mlData?.performance.accuracy}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Brain className="w-6 h-6 text-purple-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-400">Avg Confidence</p>
                <p className="text-2xl font-semibold text-white">
                  {(mlData?.performance.avgConfidence || 0 * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Zap className="w-6 h-6 text-yellow-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-400">Active Models</p>
                <p className="text-2xl font-semibold text-white">
                  {mlData?.models.filter(m => m.status === 'trained').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Model Training */}
        <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 mb-6 shadow-xl shadow-blue-500/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Train Models</h2>
            <Brain className="w-5 h-5 text-slate-400" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Select Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
              >
                <option value="">Select Model to Train</option>
                {mlData?.models.map(model => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleTrainModel}
                disabled={isTraining || !selectedModel}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center shadow-lg shadow-blue-500/20"
              >
                {isTraining ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Training...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Train Model
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ML Models */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-white">ML Models</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {mlData?.models.map((model) => (
              <div key={model.id} className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-slate-600/50 transition-all hover:shadow-xl hover:shadow-blue-500/5">
                {/* Model Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">{model.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(model.status)}`}>
                    {model.status}
                  </span>
                </div>

                {/* Model Details */}
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Type</span>
                    <span className="text-white font-medium">{model.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Symbol</span>
                    <span className="text-white font-medium">{model.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Accuracy</span>
                    <span className={`font-semibold ${getAccuracyColor(model.accuracy)}`}>
                      {model.accuracy}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Confidence</span>
                    <span className="font-semibold text-white">
                      {(model.predictions.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Predictions */}
              <div className="mb-4 pt-4 border-t border-slate-700/30">
                <h4 className="text-sm font-medium text-slate-300 mb-2">Predictions</h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className="text-slate-400">Price</div>
                    <div className="font-semibold text-white">
                      ${model.predictions.nextHour?.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-400">Change</div>
                    <div className={`font-semibold ${model.predictions.nextDay > model.predictions.nextHour ? 'text-green-400' : 'text-red-400'}`}>
                      {((model.predictions.nextDay - model.predictions.nextHour) / model.predictions.nextHour * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-400">Hold</div>
                    <div className="font-semibold text-purple-400">
                      {(model.predictions.nextWeek / 24).toFixed(1)}d
                    </div>
                  </div>
                </div>
              </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-500/20">
                    View Details
                  </button>
                  <button className="flex-1 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-white py-2 px-4 rounded-lg text-sm font-medium transition-all">
                    Retrain
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature Importance */}
        <div className="mt-6 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl shadow-blue-500/5">
          <h2 className="text-lg font-semibold text-white mb-4">Feature Importance</h2>
          <div className="space-y-3">
            {mlData?.features.map((feature, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    feature.importance === 'high' ? 'bg-green-500' :
                    feature.importance === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-white font-medium">{feature.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-slate-700/50 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${feature.weight * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-slate-400 w-12 text-right">
                    {(feature.weight * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}