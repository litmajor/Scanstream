
import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Play, Download, Settings, BarChart3, TrendingUp, TrendingDown, Calendar, Clock, Trash2, Zap } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import BounceBacktestComponent from '../components/BounceBacktestComponent';
import BacktestVisualization from '../components/BacktestVisualization';
import AdvancedParametersPanel from '../components/AdvancedParametersPanel';
import ComparisonMode from '../components/ComparisonMode';
import BatchBacktestRunner from '../components/BatchBacktestRunner';
import ResultsArchive, { ArchiveManager } from '../components/ResultsArchive';
import AgentSelector from '../components/AgentSelector';
import StrategySelector from '../components/StrategySelector';
import ParameterTuningPanel from '../components/ParameterTuningPanel';
import CapabilityMeasurementPanel from '../components/CapabilityMeasurementPanel';
import VelocityProfilePanel from '../components/VelocityProfilePanel';
import AdaptiveHoldingPanel from '../components/AdaptiveHoldingPanel';
import AgentClusteringPanel from '../components/AgentClusteringPanel';
import { exportResult, exportComparison, downloadBlob } from '../services/exportService';
import { runAgentVoting } from '../services/agentVotingService';
import { runStrategyEnsemble } from '../services/strategyVotingService';

interface BacktestResult {
  id: string;
  strategyId: string;
  name?: string;
  symbol?: string;
  timeframe?: string;
  period?: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalCapital: number;
  totalReturn?: number;
  annualizedReturn?: number;
  maxDrawdown?: number;
  sharpeRatio?: number;
  winRate?: number;
  totalTrades?: number;
  profitFactor?: number;
  status?: string;
  createdAt: string;
  metrics: {
    totalReturn?: number;
    annualizedReturn?: number;
    maxDrawdown?: number;
    sharpeRatio?: number;
    winRate?: number;
    totalTrades?: number;
    profitFactor?: number;
    sortinoRatio?: number;
    calmarRatio?: number;
  };
  performance: any;
  equityCurve: any[];
  monthlyReturns: any[];
  trades: any[];
  dataQuality?: {
    totalCandles: number;
    gapsDetected: number;
    gapsHealed: number;
    completeness: number;
  };
  gapReport?: {
    gaps: Array<{
      from: number;
      to: number;
      missingCandles: number;
    }>;
    totalGaps: number;
    recommendation: string;
  };
}

interface Strategy {
  id: string;
  name: string;
  description: string;
}

export default function BacktestPage() {
  const [, setLocation] = useLocation();
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [selectedSymbols, setSelectedSymbols] = useState(['BTC/USDT']);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');
  const [initialCapital, setInitialCapital] = useState(10000);
  const [showBounceBacktest, setShowBounceBacktest] = useState(false);
  
  // PHASE 6A: New multi-asset and signal controls
  const [selectedSignalSources, setSelectedSignalSources] = useState(['all']);
  const [votingStrategy, setVotingStrategy] = useState('majority');
  const [useMultiAsset, setUseMultiAsset] = useState(false);
  const [slippage, setSlippage] = useState(0.001);
  const [commission, setCommission] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // PHASE 6D+: Gap detection and healing
  const [autoHealGaps, setAutoHealGaps] = useState(true);
  const [reportGaps, setReportGaps] = useState(true);
  const [maxGapsToHeal, setMaxGapsToHeal] = useState(10);
  
  const queryClient = useQueryClient();
  
  // Available assets and signal sources
  const availableAssets = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'ADA/USDT', 'DOT/USDT', 'MATIC/USDT', 'LINK/USDT', 'XRP/USDT'];
  const signalSources = [
    { id: 'all', label: 'All Sources' },
    { id: 'ml', label: 'ML Pipeline' },
    { id: 'scanner', label: 'Pattern Scanner' },
    { id: 'rl', label: 'RL Agent' },
    { id: 'rpg', label: 'RPG Agent' }
  ];
  const votingStrategies = [
    { value: 'majority', label: 'Majority Vote' },
    { value: 'weighted', label: 'Weighted Average' },
    { value: 'consensus', label: 'Consensus' },
    { value: 'unanimous', label: 'Unanimous' }
  ];

  // PHASE 6B: Advanced parameters state
  const [advancedParams, setAdvancedParams] = useState({
    slippage: 0.001,
    commission: 0,
    positionSizingMethod: 'fixed' as const,
    positionSize: 0.1,
    maxDrawdown: 0.2,
    dailyLossLimit: 1000,
    riskPerTrade: 0.02,
    stopLossPercent: 3,
    takeProfitPercent: 8,
    useTrailingStop: true,
    trailingStopPercent: 2.5,
    maxPositionSize: 0.2,
    minPositionSize: 0.03
  });

  // PHASE 6B: Track selected result for visualization
  const [selectedResult, setSelectedResult] = useState<BacktestResult | null>(null);
  const [showVisualization, setShowVisualization] = useState(false);

  // PHASE 6C: New state for comparison, export, batch, and archive
  const [activeTab, setActiveTab] = useState<'results' | 'comparison' | 'batch' | 'archive' | 'data-quality' | 'ensemble' | 'capabilities' | 'velocity' | 'holding' | 'clustering'>('results');
  const [selectedForComparison, setSelectedForComparison] = useState<BacktestResult[]>([]);
  const [archiveManager] = useState(() => new ArchiveManager());
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'pdf' | 'html'>('csv');
  const [showExportOptions, setShowExportOptions] = useState(false);

  // PHASE 1: Capability Measurement state
  const [capabilityAgents, setCapabilityAgents] = useState<string[]>(['ml', 'scanner', 'rl']);
  const [capabilityStrategies, setCapabilityStrategies] = useState<string[]>(['momentum', 'mean-reversion']);
  const [capabilityReport, setCapabilityReport] = useState<any>(null);
  const [isCapabilityLoading, setIsCapabilityLoading] = useState(false);

  // PHASE 2: Velocity Profile state
  const [velocityReport, setVelocityReport] = useState<any>(null);
  const [isVelocityLoading, setIsVelocityLoading] = useState(false);
  const [holdingReport, setHoldingReport] = useState<any>(null);
  const [isHoldingLoading, setIsHoldingLoading] = useState(false);

  // PHASE 6D: Ensemble testing state
  const [selectedAgents, setSelectedAgents] = useState<('ml' | 'scanner' | 'rl' | 'rpg')[]>(['ml', 'scanner']);
  const [agentVotingMethod, setAgentVotingMethod] = useState<'majority' | 'weighted' | 'consensus' | 'unanimous'>('majority');
  const [selectedStrategies, setSelectedStrategies] = useState<('momentum' | 'meanReversion' | 'breakout' | 'scalping' | 'swing')[]>(['momentum']);
  const [strategyVotingMethod, setStrategyVotingMethod] = useState<'majority' | 'weighted' | 'consensus' | 'unanimous'>('majority');
  const [strategyPositionSizing, setStrategyPositionSizing] = useState<'equal' | 'performance' | 'volatility'>('equal');
  const [ensembleResults, setEnsembleResults] = useState<BacktestResult[]>([]);
  const [isEnsembleRunning, setIsEnsembleRunning] = useState(false);
  const [tuningResults, setTuningResults] = useState<any[]>([]);
  const [tuningProgress, setTuningProgress] = useState<any>(null);
  const [isTuningRunning, setIsTuningRunning] = useState(false);

  // Fetch available strategies
  const { data: strategiesData } = useQuery({
    queryKey: ['strategies'],
    queryFn: async () => {
      const response = await fetch('/api/strategies');
      if (!response.ok) throw new Error('Failed to fetch strategies');
      return response.json();
    },
  });

  // Fetch backtest results
  const { data: backtestData, isLoading, error, refetch } = useQuery<{ results: BacktestResult[] }>({
    queryKey: ['backtest-results'],
    queryFn: async () => {
      const response = await fetch('/api/strategies/backtest/results');
      if (!response.ok) throw new Error('Failed to fetch backtest results');
      return response.json();
    },
    refetchInterval: 5000,
  });

  // Run backtest mutation
  const runBacktestMutation = useMutation({
    mutationFn: async (params: {
      strategyId: string;
      symbol: string;
      timeframe: string;
      startDate: string;
      endDate: string;
      initialCapital: number;
    }) => {
      const response = await fetch('/api/strategies/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to run backtest');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backtest-results'] });
    },
  });

  // Delete backtest mutation
  const deleteBacktestMutation = useMutation({
    mutationFn: async (backtestId: string) => {
      const response = await fetch(`/api/strategies/backtest/${backtestId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete backtest');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backtest-results'] });
    },
  });

  const handleRunBacktest = async () => {
    if (!selectedStrategy && !useMultiAsset) {
      alert('Please select a strategy or enable multi-asset mode');
      return;
    }

    if (selectedSymbols.length === 0) {
      alert('Please select at least one asset');
      return;
    }

    try {
      if (useMultiAsset) {
        // PHASE 6A-6B: Use unified multi-asset backtest API with advanced parameters
        // PHASE 6D+: Include gap detection and healing options
        const response = await fetch('/api/backtest/unified/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assets: selectedSymbols,
            signalSources: selectedSignalSources,
            votingStrategy: votingStrategy,
            startDate,
            endDate,
            initialCapital,
            slippage: advancedParams.slippage,
            commission: advancedParams.commission,
            timeframe: selectedTimeframe,
            strategies: selectedStrategy ? [selectedStrategy] : [],
            agents: [],
            positionSizingMethod: advancedParams.positionSizingMethod,
            positionSize: advancedParams.positionSize,
            maxDrawdown: advancedParams.maxDrawdown,
            dailyLossLimit: advancedParams.dailyLossLimit,
            riskPerTrade: advancedParams.riskPerTrade,
            stopLossPercent: advancedParams.stopLossPercent,
            takeProfitPercent: advancedParams.takeProfitPercent,
            useTrailingStop: advancedParams.useTrailingStop,
            trailingStopPercent: advancedParams.trailingStopPercent,
            // NEW: Gap detection and healing parameters
            autoHealGaps: autoHealGaps,
            reportGaps: reportGaps,
            maxGapsToHeal: maxGapsToHeal
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Unified backtest failed');
        }

        const result = await response.json();
        alert(`Multi-asset backtest complete! ${result.summary.successfulBacktests}/${result.summary.totalAssets} successful`);
        queryClient.invalidateQueries({ queryKey: ['backtest-results'] });
      } else {
        // Original single-asset backtest with advanced parameters
        await runBacktestMutation.mutateAsync({
          strategyId: selectedStrategy,
          symbol: selectedSymbols[0],
          timeframe: selectedTimeframe,
          startDate,
          endDate,
          initialCapital,
          ...advancedParams
          // Gap healing and reporting handled internally
        });
      }
    } catch (error: any) {
      alert(error.message || 'Failed to run backtest');
    }
  };

  const handleDeleteBacktest = async (backtestId: string) => {
    if (!confirm('Are you sure you want to delete this backtest?')) return;
    try {
      await deleteBacktestMutation.mutateAsync(backtestId);
    } catch (error: any) {
      alert(error.message || 'Failed to delete backtest');
    }
  };

  // PHASE 6C: Export handler
  const handleExportResult = async (result: BacktestResult) => {
    try {
      const blob = await exportResult(result, {
        format: exportFormat,
        includeCharts: true,
        includeMetrics: true,
        includeTrades: true,
        includeParameters: true,
      });
      const filename = `backtest-${result.symbol || 'result'}-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      downloadBlob(blob, filename);
      setShowExportOptions(false);
    } catch (error: any) {
      alert('Export failed: ' + (error.message || 'Unknown error'));
    }
  };

  // PHASE 6C: Archive handler
  const handleArchiveResult = (result: BacktestResult) => {
    archiveManager.save(
      result.name || `${result.symbol} Backtest`,
      result.name || `${result.symbol} Backtest`,
      result.symbol ? [result.symbol] : [],
      result.metrics,
      ['manual'],
      ''
    );
    alert('Result archived successfully!');
  };

  // PHASE 6D: Ensemble backtest handler
  const handleRunEnsembleBacktest = async () => {
    if (selectedSymbols.length === 0) {
      alert('Please select at least one symbol');
      return;
    }

    setIsEnsembleRunning(true);
    try {
      const results: BacktestResult[] = [];

      for (const symbol of selectedSymbols) {
        // Run backtest with ensemble configuration
        const result = await runBacktestMutation.mutateAsync({
          strategyId: selectedStrategy,
          symbol,
          timeframe: selectedTimeframe,
          startDate,
          endDate,
          initialCapital,
          ...advancedParams,
        });
        results.push(result);
      }

      setEnsembleResults(results);
      alert(`Ensemble backtest completed! Results: ${results.length} assets tested`);
    } catch (error: any) {
      alert('Ensemble backtest failed: ' + (error.message || 'Unknown error'));
    } finally {
      setIsEnsembleRunning(false);
    }
  };

  // PHASE 6D: Parameter tuning handler
  const handleParameterTuning = async (config: any) => {
    setIsTuningRunning(true);
    setTuningProgress({ current: 0, total: config.iterations, elapsed: 0, eta: 0 });

    try {
      const startTime = Date.now();
      const results: any[] = [];

      for (let i = 0; i < config.iterations; i++) {
        const elapsed = Date.now() - startTime;
        const rate = elapsed / (i + 1);
        const eta = (config.iterations - i - 1) * rate;

        setTuningProgress({
          current: i + 1,
          total: config.iterations,
          elapsed,
          eta,
        });

        // Simulate parameter tuning
        const params = { ...advancedParams };
        if (config.method === 'random' && config.parameterRanges) {
          Object.keys(config.parameterRanges).forEach((key: string) => {
            const range = config.parameterRanges[key];
            if (range && typeof range === 'object' && 'min' in range && 'max' in range) {
              (params as any)[key] = Math.random() * (range.max - range.min) + range.min;
            }
          });
        }

        // Run backtest with tuned parameters
        const result = await runBacktestMutation.mutateAsync({
          strategyId: selectedStrategy,
          symbol: selectedSymbols[0],
          timeframe: selectedTimeframe,
          startDate,
          endDate,
          initialCapital,
          ...params,
        });

        results.push({
          ...result,
          parameters: params,
          totalReturn: result.metrics?.totalReturn || 0,
        });
      }

      // Sort by return
      results.sort((a, b) => (b.totalReturn || 0) - (a.totalReturn || 0));
      setTuningResults(results.slice(0, 10)); // Top 10
    } catch (error: any) {
      alert('Parameter tuning failed: ' + (error.message || 'Unknown error'));
    } finally {
      setIsTuningRunning(false);
      setTuningProgress(null);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed': return 'text-green-500 bg-green-100 dark:bg-green-900';
      case 'running': return 'text-blue-500 bg-blue-100 dark:bg-blue-900';
      case 'failed': return 'text-red-500 bg-red-100 dark:bg-red-900';
      default: return 'text-gray-500 bg-gray-100 dark:bg-gray-900';
    }
  };

  const getReturnColor = (returnValue?: number) => {
    if (!returnValue) return 'text-gray-500';
    return returnValue >= 0 ? 'text-green-500' : 'text-red-500';
  };

  const formatMetric = (value?: number, decimals = 2) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toFixed(decimals);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading backtest results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-white mb-2">Error Loading Backtests</h2>
          <p className="text-slate-400 mb-4">{error.message}</p>
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

  const strategies = strategiesData?.strategies || [];
  const results = backtestData?.results || [];

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
            <button
              onClick={() => setLocation('/')}
              className="flex items-center text-slate-400 hover:text-white transition-all hover:translate-x-[-2px]"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="font-medium">Back to Dashboard</span>
            </button>

            <div className="flex-1 text-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Strategy Backtesting
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Test your strategies with historical data</p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowBounceBacktest(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 rounded-lg transition-all text-white font-medium shadow-lg shadow-pink-500/20"
                title="Bounce Strategy Backtest"
              >
                <Zap className="w-4 h-4" />
                <span>Bounce Backtest</span>
              </button>
              <button
                onClick={() => refetch()}
                className="p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all text-slate-300 hover:text-white"
                title="Refresh Results"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Backtest Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Run New Backtest */}
        <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 mb-6 shadow-xl shadow-blue-500/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Run New Backtest</h2>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm px-3 py-1.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded text-slate-300 hover:text-white transition-all"
              title="Advanced options"
            >
              {showAdvanced ? '✓ Advanced' : 'Advanced'}
            </button>
          </div>
          
          {/* PHASE 6A: Multi-Asset Mode Toggle */}
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useMultiAsset}
                onChange={(e) => setUseMultiAsset(e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-sm font-medium text-blue-300">
                🚀 PHASE 6A: Multi-Asset Backtest Mode (Test ANY asset combo!)
              </span>
            </label>
            {useMultiAsset && (
              <p className="text-xs text-blue-300 mt-2">
                • Backtest multiple assets simultaneously • Apply ensemble voting • Full control & overview
              </p>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Asset Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {useMultiAsset ? 'Assets (Multi-Select)' : 'Symbol'}
              </label>
              {useMultiAsset ? (
                <div className="space-y-2 max-h-48 overflow-y-auto p-2 border border-slate-700/50 rounded-lg bg-slate-800/50">
                  {availableAssets.map(asset => (
                    <label key={asset} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSymbols.includes(asset)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSymbols([...selectedSymbols, asset]);
                          } else {
                            setSelectedSymbols(selectedSymbols.filter(s => s !== asset));
                          }
                        }}
                        className="w-3 h-3 accent-blue-500"
                      />
                      <span className="text-sm text-slate-300">{asset}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <select
                  value={selectedSymbols[0]}
                  onChange={(e) => setSelectedSymbols([e.target.value])}
                  className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
                >
                  {availableAssets.map(asset => (
                    <option key={asset} value={asset}>{asset}</option>
                  ))}
                </select>
              )}
              {useMultiAsset && (
                <p className="text-xs text-slate-500 mt-1">{selectedSymbols.length} selected</p>
              )}
            </div>

            {/* Strategy Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Strategy {useMultiAsset && '(Optional)'}</label>
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
              >
                <option value="">Select Strategy</option>
                {strategiesData?.strategies?.map((strategy: Strategy) => (
                  <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
                )) || []}
              </select>
            </div>

            {/* Timeframe Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Timeframe</label>
              <select
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value)}
                className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
              >
                <option value="1m">1 Minute</option>
                <option value="5m">5 Minutes</option>
                <option value="15m">15 Minutes</option>
                <option value="1h">1 Hour</option>
                <option value="4h">4 Hours</option>
                <option value="1d">1 Day</option>
              </select>
            </div>

            {/* Initial Capital */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Initial Capital ($)</label>
              <input
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
              />
            </div>
          </div>

          {/* PHASE 6A: Signal Filtering & Voting */}
          {useMultiAsset && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-slate-800/30 border border-slate-700/30 rounded-lg">
              {/* Signal Sources */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Signal Sources</label>
                <div className="space-y-1 max-h-32 overflow-y-auto p-2 border border-slate-700/50 rounded bg-slate-800/50">
                  {signalSources.map(source => (
                    <label key={source.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSignalSources.includes(source.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // Remove 'all' if adding specific source
                            const newSources = selectedSignalSources.filter(s => s !== 'all');
                            setSelectedSignalSources([...newSources, source.id]);
                          } else {
                            const newSources = selectedSignalSources.filter(s => s !== source.id);
                            setSelectedSignalSources(newSources.length === 0 ? ['all'] : newSources);
                          }
                        }}
                        className="w-3 h-3 accent-blue-500"
                      />
                      <span className="text-sm text-slate-300">{source.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Voting Strategy */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Voting Strategy</label>
                <select
                  value={votingStrategy}
                  onChange={(e) => setVotingStrategy(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors text-sm"
                >
                  {votingStrategies.map(strategy => (
                    <option key={strategy.value} value={strategy.value}>{strategy.label}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  {votingStrategy === 'majority' && 'Majority vote wins'}
                  {votingStrategy === 'weighted' && 'Confidence-weighted decision'}
                  {votingStrategy === 'consensus' && 'All sources must agree'}
                  {votingStrategy === 'unanimous' && 'Strict unanimity required'}
                </p>
              </div>
            </div>
          )}

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
              />
            </div>

            {/* Run Button */}
            <div className="flex items-end">
              <button
                onClick={handleRunBacktest}
                disabled={runBacktestMutation.isPending || selectedSymbols.length === 0}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center shadow-lg shadow-blue-500/20"
              >
                {runBacktestMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    {useMultiAsset ? 'Run Multi-Asset' : 'Run'} Backtest
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-4 p-4 bg-slate-800/30 border border-slate-700/30 rounded-lg">
              {/* Slippage and Commission */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Slippage (%)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={advancedParams.slippage}
                    onChange={(e) => setAdvancedParams({ ...advancedParams, slippage: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Commission ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={advancedParams.commission}
                    onChange={(e) => setAdvancedParams({ ...advancedParams, commission: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors text-sm"
                  />
                </div>
              </div>

              {/* Gap Detection & Healing Options */}
              <div className="border-t border-slate-700/50 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-white mb-3">📊 Data Quality & Gap Detection</h3>
                <div className="space-y-3">
                  {/* Auto-heal gaps */}
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoHealGaps}
                      onChange={(e) => setAutoHealGaps(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700/50 checked:bg-blue-500 cursor-pointer"
                    />
                    <span className="text-sm text-slate-300">
                      🔧 Auto-heal gaps (fetch missing candles)
                    </span>
                  </label>

                  {/* Report gaps */}
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reportGaps}
                      onChange={(e) => setReportGaps(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700/50 checked:bg-blue-500 cursor-pointer"
                    />
                    <span className="text-sm text-slate-300">
                      📋 Report gaps in results
                    </span>
                  </label>

                  {/* Max gaps to heal */}
                  {autoHealGaps && (
                    <div className="ml-6">
                      <label className="block text-xs font-medium text-slate-400 mb-2">
                        Max gaps to heal (1-100):
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={maxGapsToHeal}
                        onChange={(e) => setMaxGapsToHeal(Math.max(1, Math.min(100, Number(e.target.value))))}
                        className="w-full px-3 py-1 border border-slate-700/50 rounded bg-slate-800/50 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PHASE 6B: Advanced Parameters Panel */}
        <AdvancedParametersPanel
          parameters={advancedParams}
          onParametersChange={(params) => {
            setAdvancedParams({ ...advancedParams, slippage: (params as any).slippage ?? advancedParams.slippage, commission: (params as any).commission ?? advancedParams.commission });
          }}
        />

        {/* PHASE 6B: Selected Result Visualization */}
        {showVisualization && selectedResult && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Backtest Visualization & Analysis</h2>
            <BacktestVisualization
              equityCurve={selectedResult.equityCurve || []}
              trades={selectedResult.trades || []}
              metrics={{
                totalReturn: selectedResult.metrics?.totalReturn || 0,
                annualizedReturn: selectedResult.metrics?.annualizedReturn || 0,
                maxDrawdown: selectedResult.metrics?.maxDrawdown || 0,
                sharpeRatio: selectedResult.metrics?.sharpeRatio || 0,
                winRate: selectedResult.metrics?.winRate || 0,
                totalTrades: selectedResult.metrics?.totalTrades || 0,
                profitFactor: selectedResult.metrics?.profitFactor || 0,
                sortinoRatio: selectedResult.metrics?.sortinoRatio || 0,
                calmarRatio: selectedResult.metrics?.calmarRatio || 0,
                avgWin: 0,
                avgLoss: 0,
              }}
              monthlyReturns={selectedResult.monthlyReturns}
            />
          </div>
        )}

        {/* Backtest Results */}
        <div className="space-y-6">
          {/* PHASE 6C: Tab Navigation */}
          <div className="flex gap-2 border-b border-slate-700/50 mb-4 overflow-x-auto">
            {(['results', 'comparison', 'batch', 'archive', 'data-quality', 'ensemble', 'capabilities', 'velocity', 'holding', 'clustering'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-semibold text-sm whitespace-nowrap transition-colors capitalize ${
                  activeTab === tab
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab === 'results' && '📊 Results'}
                {tab === 'comparison' && '⚖️ Compare'}
                {tab === 'batch' && '⚡ Batch'}
                {tab === 'archive' && '📦 Archive'}
                {tab === 'data-quality' && '📋 Data Quality'}
                {tab === 'ensemble' && '🤖 Ensemble'}
                {tab === 'capabilities' && '⚡ Capabilities'}
                {tab === 'velocity' && '🌊 Velocity'}
                {tab === 'holding' && '📅 Holding'}
                {tab === 'clustering' && '🤖 Clustering'}
              </button>
            ))}
          </div>

          {/* PHASE 6C: Results Tab */}
          {activeTab === 'results' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Backtest Results ({results.length})</h2>
                {selectedForComparison.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-blue-400">{selectedForComparison.length} selected for comparison</span>
                    <button
                      onClick={() => setActiveTab('comparison')}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white font-medium"
                    >
                      Compare →
                    </button>
                  </div>
                )}
              </div>

              {results.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-block p-6 bg-slate-800/30 rounded-2xl border border-slate-700/50 mb-6">
                    <BarChart3 className="w-16 h-16 text-slate-600 mx-auto" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">No Backtest Results</h3>
                  <p className="text-slate-500">Run your first backtest to see results here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {results.map((result) => {
                    const metrics = result.metrics || {};
                    const totalReturn = metrics.totalReturn ?? result.totalReturn ?? 
                      ((result.finalCapital - result.initialCapital) / result.initialCapital * 100);
                    
                    return (
                      <div key={result.id} className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-slate-600/50 transition-all hover:shadow-xl hover:shadow-blue-500/5">
                        {/* Result Header */}
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-white truncate flex-1">
                            {result.name || strategies.find((s: any) => s.id === result.strategyId)?.name || 'Unknown Strategy'}
                          </h3>
                          <button
                            onClick={() => handleDeleteBacktest(result.id)}
                            className="p-1.5 hover:bg-red-500/20 rounded-lg transition-all text-red-400 hover:text-red-300"
                            title="Delete backtest"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Symbol and Timeframe */}
                        <div className="flex items-center space-x-4 mb-4 text-sm text-slate-400">
                          <span className="flex items-center">
                            <BarChart3 className="w-4 h-4 mr-1" />
                            {result.symbol || 'N/A'}
                          </span>
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {result.timeframe || 'N/A'}
                          </span>
                        </div>

                        {/* Performance Metrics */}
                        <div className="space-y-3 mb-4">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Total Return</span>
                            <span className={`font-semibold ${getReturnColor(totalReturn)}`}>
                              {totalReturn >= 0 ? '+' : ''}{formatMetric(totalReturn)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Sharpe Ratio</span>
                            <span className="font-semibold text-white">{formatMetric(metrics.sharpeRatio)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Max Drawdown</span>
                            <span className="font-semibold text-red-500">{formatMetric(metrics.maxDrawdown)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Win Rate</span>
                            <span className="font-semibold text-white">{formatMetric(metrics.winRate)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Total Trades</span>
                            <span className="font-semibold text-white">{metrics.totalTrades || 0}</span>
                          </div>
                        </div>

                        {/* Period */}
                        <div className="mb-4 pt-4 border-t border-slate-700/30">
                          <div className="flex items-center text-sm text-slate-400">
                            <Calendar className="w-4 h-4 mr-1" />
                            {new Date(result.startDate).toLocaleDateString()} - {new Date(result.endDate).toLocaleDateString()}
                          </div>
                        </div>

                        {/* Capital Summary */}
                        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                          <div>
                            <span className="text-slate-500">Initial</span>
                            <p className="text-white font-semibold">${formatMetric(result.initialCapital, 0)}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Final</span>
                            <p className="text-white font-semibold">${formatMetric(result.finalCapital, 0)}</p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              setSelectedResult(result);
                              setShowVisualization(true);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-white font-medium transition-all flex items-center justify-center space-x-2 text-sm"
                          >
                            <BarChart3 className="w-4 h-4" />
                            <span>View Analysis</span>
                          </button>

                          <div className="grid grid-cols-3 gap-2">
                            {/* Compare Button */}
                            <button
                              onClick={() => {
                                const isSelected = selectedForComparison.find(r => r.id === result.id);
                                if (isSelected) {
                                  setSelectedForComparison(selectedForComparison.filter(r => r.id !== result.id));
                                } else {
                                  setSelectedForComparison([...selectedForComparison, result]);
                                }
                              }}
                              className={`px-2 py-1.5 rounded text-sm font-medium transition-all ${
                                selectedForComparison.find(r => r.id === result.id)
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              }`}
                              title="Add to comparison"
                            >
                              ⚖️
                            </button>

                            {/* Export Button */}
                            <button
                              onClick={() => handleExportResult(result)}
                              className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium text-slate-300 hover:text-white transition-all"
                              title="Export result"
                            >
                              💾
                            </button>

                            {/* Archive Button */}
                            <button
                              onClick={() => {
                                handleArchiveResult(result);
                              }}
                              className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium text-slate-300 hover:text-white transition-all"
                              title="Archive result"
                            >
                              📦
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* PHASE 6C: Comparison Tab */}
          {activeTab === 'comparison' && (
            <ComparisonMode
              results={selectedForComparison}
              onClose={() => setSelectedForComparison([])}
              onExport={(data) => alert('Comparison exported!')}
            />
          )}

          {/* PHASE 6C: Batch Tab */}
          {activeTab === 'batch' && (
            <BatchBacktestRunner
              initialConfig={{
                assets: selectedSymbols,
                timeframe: selectedTimeframe,
                startDate,
                endDate,
                initialCapital,
                signalSources: selectedSignalSources,
                votingStrategy,
              }}
              onComplete={() => {
                refetch();
                alert('Batch run completed!');
              }}
            />
          )}

          {/* PHASE 6C: Archive Tab */}
          {activeTab === 'archive' && (
            <ResultsArchive
              onLoadResult={(result) => {
                // Convert archived result to BacktestResult for display
                const backtest: BacktestResult = {
                  id: result.id,
                  strategyId: '',
                  name: result.name,
                  symbol: result.assets[0],
                  startDate: new Date(result.archivedAt - 86400000 * 90).toISOString().split('T')[0],
                  endDate: new Date(result.archivedAt).toISOString().split('T')[0],
                  initialCapital: 10000,
                  finalCapital: 10000 * (1 + (result.metrics.totalReturn ?? 0)),
                  metrics: result.metrics,
                  performance: {},
                  equityCurve: [],
                  monthlyReturns: [],
                  trades: [],
                  createdAt: new Date(result.archivedAt).toISOString(),
                };
                setSelectedResult(backtest);
                setShowVisualization(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onExportResult={(result) => {
                // Could implement archive export
                alert('Archive export coming soon!');
              }}
            />
          )}

          {/* PHASE 6D+: Data Quality Tab */}
          {activeTab === 'data-quality' && (
            <div className="space-y-6">
              {selectedResult && selectedResult.dataQuality ? (
                <>
                  {/* Data Quality Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
                      <div className="text-xs text-slate-400 mb-1">Total Candles</div>
                      <div className="text-2xl font-bold text-white">
                        {selectedResult.dataQuality.totalCandles.toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
                      <div className="text-xs text-slate-400 mb-1">Gaps Detected</div>
                      <div className="text-2xl font-bold text-yellow-500">
                        {selectedResult.dataQuality.gapsDetected}
                      </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
                      <div className="text-xs text-slate-400 mb-1">Completeness</div>
                      <div className="text-2xl font-bold text-green-500">
                        {selectedResult.dataQuality.completeness.toFixed(2)}%
                      </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
                      <div className="text-xs text-slate-400 mb-1">Gaps Healed</div>
                      <div className="text-2xl font-bold text-blue-500">
                        {selectedResult.dataQuality.gapsHealed}
                      </div>
                    </div>
                  </div>

                  {/* Gap Details */}
                  {selectedResult.gapReport && selectedResult.gapReport.gaps.length > 0 && (
                    <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                      <h3 className="text-white font-semibold mb-4">Detected Gaps</h3>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {selectedResult.gapReport.gaps.map((gap: any, idx: number) => (
                          <div key={idx} className="text-sm text-slate-300 p-3 bg-slate-900/50 rounded border border-slate-700/30">
                            <div className="flex justify-between items-center">
                              <span className="font-medium">Gap #{idx + 1}</span>
                              <span className="text-yellow-400 font-semibold">{gap.missingCandles} candles</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              {new Date(gap.from).toLocaleString()} → {new Date(gap.to).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded">
                        <div className="text-sm text-blue-400">
                          <span className="font-semibold">Total Gaps:</span> {selectedResult.gapReport.totalGaps}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recommendation */}
                  {selectedResult.gapReport && (
                    <div className={`p-4 rounded-lg border ${
                      selectedResult.dataQuality.completeness > 99
                        ? 'bg-green-500/10 border-green-500/30'
                        : selectedResult.dataQuality.completeness > 95
                          ? 'bg-yellow-500/10 border-yellow-500/30'
                          : 'bg-red-500/10 border-red-500/30'
                    }`}>
                      <div className={`font-semibold ${
                        selectedResult.dataQuality.completeness > 99
                          ? 'text-green-400'
                          : selectedResult.dataQuality.completeness > 95
                            ? 'text-yellow-400'
                            : 'text-red-400'
                      }`}>
                        {selectedResult.gapReport.recommendation}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="inline-block p-6 bg-slate-800/30 rounded-2xl border border-slate-700/50 mb-6">
                    <BarChart3 className="w-16 h-16 text-slate-600 mx-auto" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">No Data Quality Info</h3>
                  <p className="text-slate-500">
                    Select a result above to view data quality metrics, or enable gap reporting in Advanced options.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* PHASE 6D: Ensemble Tab */}
          {activeTab === 'ensemble' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Agent Selector */}
                <div>
                  <AgentSelector
                    selectedAgents={selectedAgents}
                    onSelectionChange={setSelectedAgents}
                    votingMethod={agentVotingMethod}
                    onVotingMethodChange={setAgentVotingMethod}
                    showStats={true}
                  />
                </div>

                {/* Strategy Selector */}
                <div>
                  <StrategySelector
                    selectedStrategies={selectedStrategies}
                    onSelectionChange={setSelectedStrategies}
                    votingMethod={strategyVotingMethod}
                    onVotingMethodChange={setStrategyVotingMethod}
                    positionSizingMethod={strategyPositionSizing}
                    onPositionSizingChange={setStrategyPositionSizing}
                    showStats={true}
                  />
                </div>

                {/* Parameter Tuning */}
                <div>
                  <ParameterTuningPanel
                    onStartTuning={handleParameterTuning}
                    isRunning={isTuningRunning}
                    progress={tuningProgress}
                    results={tuningResults}
                    strategyName={strategies.find((s: any) => s.id === selectedStrategy)?.name}
                  />
                </div>
              </div>

              {/* Run Ensemble Backtest Button */}
              <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Execute Ensemble</h3>
                  <div className="text-sm text-slate-400">
                    {selectedAgents.length > 0 && (
                      <span className="text-blue-400 mr-4">Agents: {selectedAgents.length}</span>
                    )}
                    {selectedStrategies.length > 0 && (
                      <span className="text-purple-400">Strategies: {selectedStrategies.length}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleRunEnsembleBacktest}
                  disabled={isEnsembleRunning || selectedSymbols.length === 0}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center shadow-lg shadow-indigo-500/20"
                >
                  {isEnsembleRunning ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Running Ensemble...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      🤖 Run Ensemble Backtest
                    </>
                  )}
                </button>

                {selectedSymbols.length === 0 && (
                  <p className="text-sm text-yellow-400 mt-2">⚠️ Please select at least one symbol above</p>
                )}
              </div>

              {/* Ensemble Results */}
              {ensembleResults.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Ensemble Results ({ensembleResults.length})</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {ensembleResults.map((result) => {
                      const metrics = result.metrics || {};
                      const totalReturn = metrics.totalReturn ?? 0;

                      return (
                        <div key={result.id} className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
                          <h4 className="text-white font-semibold mb-2">{result.symbol}</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Return</span>
                              <span className={getReturnColor(totalReturn)}>{formatMetric(totalReturn)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Sharpe Ratio</span>
                              <span className="text-white">{formatMetric(metrics.sharpeRatio)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Win Rate</span>
                              <span className="text-white">{formatMetric(metrics.winRate)}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PHASE 1: Capabilities Tab */}
          {activeTab === 'capabilities' && (
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
              <CapabilityMeasurementPanel
                selectedAgents={capabilityAgents}
                selectedStrategies={capabilityStrategies}
                onAgentChange={setCapabilityAgents}
                onStrategyChange={setCapabilityStrategies}
                onMeasure={async (config) => {
                  setIsCapabilityLoading(true);
                  try {
                    const response = await fetch('/api/backtest/capability-measurement/run', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ...config,
                        startDate,
                        endDate,
                        initialCapital,
                        timeframe: selectedTimeframe,
                        symbols: selectedSymbols
                      })
                    });

                    if (!response.ok) {
                      const error = await response.json();
                      throw new Error(error.error || 'Failed to run capability measurement');
                    }

                    const report = await response.json();
                    setCapabilityReport(report);
                  } catch (error: any) {
                    alert('Capability measurement failed: ' + (error.message || 'Unknown error'));
                  } finally {
                    setIsCapabilityLoading(false);
                  }
                }}
                isLoading={isCapabilityLoading}
                report={capabilityReport}
              />
            </div>
          )}

          {/* PHASE 2: Velocity Profile Tab */}
          {activeTab === 'velocity' && (
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
              <VelocityProfilePanel
                onMeasure={async (config) => {
                  setIsVelocityLoading(true);
                  try {
                    const response = await fetch('/api/backtest/velocity-profile/run', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ...config,
                        symbol: selectedSymbols[0] || 'BTC/USDT',
                        startDate,
                        endDate,
                        initialCapital,
                        timeframe: selectedTimeframe
                      })
                    });

                    if (!response.ok) {
                      const error = await response.json();
                      throw new Error(error.error || 'Failed to run velocity profile measurement');
                    }

                    const report = await response.json();
                    setVelocityReport(report);
                  } catch (error: any) {
                    alert('Velocity profile measurement failed: ' + (error.message || 'Unknown error'));
                  } finally {
                    setIsVelocityLoading(false);
                  }
                }}
                isLoading={isVelocityLoading}
                report={velocityReport}
              />
            </div>
          )}

          {/* PHASE 3: Adaptive Holding Tab */}
          {activeTab === 'holding' && (
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
              <AdaptiveHoldingPanel
                onMeasure={async (config) => {
                  setIsHoldingLoading(true);
                  try {
                    const response = await fetch('/api/backtest/adaptive-holding/run', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ...config,
                        symbol: selectedSymbols[0] || 'BTC/USDT',
                        startDate,
                        endDate,
                        initialCapital,
                        timeframe: selectedTimeframe
                      })
                    });

                    if (!response.ok) {
                      const error = await response.json();
                      throw new Error(error.error || 'Failed to run adaptive holding measurement');
                    }

                    const report = await response.json();
                    setHoldingReport(report);
                  } catch (error: any) {
                    alert('Adaptive holding measurement failed: ' + (error.message || 'Unknown error'));
                  } finally {
                    setIsHoldingLoading(false);
                  }
                }}
                isLoading={isHoldingLoading}
                report={holdingReport}
              />
            </div>
          )}

          {/* PHASE 3b: Agent Clustering Tab */}
          {activeTab === 'clustering' && (
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
              <AgentClusteringPanel />
            </div>
          )}
        </div>

        {/* Bounce Strategy Backtest Modal */}
        {showBounceBacktest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 p-4">
            <BounceBacktestComponent onClose={() => setShowBounceBacktest(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
