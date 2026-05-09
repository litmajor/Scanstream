import React, { useState, useEffect } from 'react';
import { Play, Pause, X, CheckCircle, AlertCircle, Clock, Zap, Target, TrendingUp } from 'lucide-react';

interface BatchConfig {
  assets: string[];
  presets: string[];
  timeframe: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  signalSources: string[];
  votingStrategy: string;
  runMode: 'sequential' | 'parallel';
  timeout: number;
}

interface BatchResultItem {
  preset: string;
  asset: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration: number;
  metrics?: {
    totalReturn?: number;
    sharpeRatio?: number;
    maxDrawdown?: number;
    winRate?: number;
    profitFactor?: number;
  };
  error?: string;
}

interface BatchBacktestRunnerProps {
  initialConfig?: Partial<BatchConfig>;
  onComplete?: (results: BatchResultItem[]) => void;
  onCancel?: () => void;
}

const BatchBacktestRunner: React.FC<BatchBacktestRunnerProps> = ({
  initialConfig,
  onComplete,
  onCancel,
}) => {
  // Configuration
  const [assets, setAssets] = useState<string[]>(initialConfig?.assets || ['BTC/USDT', 'ETH/USDT']);
  const [presets, setPresets] = useState<string[]>(
    initialConfig?.presets || ['Conservative', 'Aggressive', 'Balanced']
  );
  const [timeframe, setTimeframe] = useState(initialConfig?.timeframe || '1h');
  const [startDate, setStartDate] = useState(initialConfig?.startDate || '2024-01-01');
  const [endDate, setEndDate] = useState(initialConfig?.endDate || '2024-12-31');
  const [initialCapital, setInitialCapital] = useState(initialConfig?.initialCapital || 10000);
  const [signalSources, setSignalSources] = useState<string[]>(initialConfig?.signalSources || ['all']);
  const [votingStrategy, setVotingStrategy] = useState(initialConfig?.votingStrategy || 'majority');
  const [runMode, setRunMode] = useState<'sequential' | 'parallel'>(
    initialConfig?.runMode || 'sequential'
  );

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResultItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        if (startTime) {
          setTimeElapsed(Math.floor((Date.now() - startTime) / 1000));
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, isPaused, startTime]);

  // Calculate totals
  const totalTests = assets.length * presets.length;
  const completed = batchResults.filter((r) => r.status === 'completed' || r.status === 'failed').length;
  const success = batchResults.filter((r) => r.status === 'completed').length;
  const failed = batchResults.filter((r) => r.status === 'failed').length;

  // Estimate time
  const avgDuration = batchResults.length > 0
    ? batchResults.reduce((sum, r) => sum + r.duration, 0) / success || 0
    : 0;
  const estimatedRemaining = Math.max(0, (totalTests - completed) * avgDuration);

  // Format time
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  // Start batch
  const handleStart = async () => {
    setIsRunning(true);
    setIsPaused(false);
    setStartTime(Date.now());
    setTimeElapsed(0);

    const results: BatchResultItem[] = [];
    const configs = [];

    // Generate all test configs
    for (const preset of presets) {
      for (const asset of assets) {
        configs.push({ preset, asset });
      }
    }

    // Execute tests
    for (let i = 0; i < configs.length; i++) {
      if (!isRunning) break;

      const { preset, asset } = configs[i];
      setCurrentIndex(i + 1);

      const result: BatchResultItem = {
        preset,
        asset,
        status: 'running',
        duration: 0,
      };

      results.push(result);
      setBatchResults([...results]);

      const testStartTime = Date.now();

      try {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 3000));

        const duration = Date.now() - testStartTime;
        result.status = 'completed';
        result.duration = duration;
        result.metrics = {
          totalReturn: (Math.random() - 0.3) * 0.5,
          sharpeRatio: Math.random() * 2,
          maxDrawdown: Math.random() * 0.3,
          winRate: Math.random() * 0.6 + 0.3,
          profitFactor: Math.random() * 3,
        };
      } catch (error) {
        result.status = 'failed';
        result.error = (error as Error).message;
        result.duration = Date.now() - testStartTime;
      }

      setBatchResults([...results]);
    }

    setIsRunning(false);
    if (onComplete) {
      onComplete(results);
    }
  };

  // Pause/Resume
  const handlePauseResume = () => {
    setIsPaused(!isPaused);
  };

  // Cancel
  const handleCancel = () => {
    setIsRunning(false);
    setIsPaused(false);
    setTimeElapsed(0);
    setStartTime(null);
    setCurrentIndex(0);
    setBatchResults([]);
    if (onCancel) {
      onCancel();
    }
  };

  // Generate results matrix
  const generateMatrix = () => {
    const matrix: Record<string, Record<string, number>> = {};

    presets.forEach((preset) => {
      matrix[preset] = {};
      assets.forEach((asset) => {
        const result = batchResults.find((r) => r.preset === preset && r.asset === asset);
        matrix[preset][asset] = result?.metrics?.totalReturn ?? 0;
      });
    });

    return matrix;
  };

  const matrix = generateMatrix();

  return (
    <div className="w-full bg-gray-900 rounded-lg border border-gray-700 p-6 text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-400" />
            Batch Backtest Runner
          </h2>
          <p className="text-gray-400 mt-1">
            Run multiple configurations automatically
          </p>
        </div>
        {isRunning && (
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-400">
              {completed}/{totalTests}
            </p>
            <p className="text-xs text-gray-400">Completed</p>
          </div>
        )}
      </div>

      {/* Configuration Section */}
      {!isRunning && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
          <h3 className="text-lg font-semibold mb-4">Configuration</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Assets */}
            <div>
              <label className="block text-sm font-semibold mb-2">Assets</label>
              <div className="flex flex-wrap gap-2">
                {['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'ADA/USDT'].map((asset) => (
                  <button
                    key={asset}
                    onClick={() =>
                      setAssets(
                        assets.includes(asset)
                          ? assets.filter((a) => a !== asset)
                          : [...assets, asset]
                      )
                    }
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      assets.includes(asset)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {asset}
                  </button>
                ))}
              </div>
            </div>

            {/* Presets */}
            <div>
              <label className="block text-sm font-semibold mb-2">Presets</label>
              <div className="flex flex-wrap gap-2">
                {['Conservative', 'Aggressive', 'Balanced'].map((preset) => (
                  <button
                    key={preset}
                    onClick={() =>
                      setPresets(
                        presets.includes(preset)
                          ? presets.filter((p) => p !== preset)
                          : [...presets, preset]
                      )
                    }
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      presets.includes(preset)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeframe */}
            <div>
              <label className="block text-sm font-semibold mb-2">Timeframe</label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              >
                <option>1h</option>
                <option>4h</option>
                <option>1d</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="md:col-span-1">
              <label className="block text-sm font-semibold mb-2">Date Range</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-2 text-sm"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-2 text-sm"
                />
              </div>
            </div>

            {/* Capital */}
            <div>
              <label className="block text-sm font-semibold mb-2">Initial Capital</label>
              <input
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(Number(e.target.value))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>

            {/* Run Mode */}
            <div>
              <label className="block text-sm font-semibold mb-2">Run Mode</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setRunMode('sequential')}
                  className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${
                    runMode === 'sequential'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Sequential
                </button>
                <button
                  onClick={() => setRunMode('parallel')}
                  className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${
                    runMode === 'parallel'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Parallel
                </button>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-400 mb-4">
            Total tests: {totalTests} ({assets.length} assets × {presets.length} presets)
          </div>

          {/* Action Buttons */}
          <button
            onClick={handleStart}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors"
          >
            <Play className="w-5 h-5" />
            Start Batch Test
          </button>
        </div>
      )}

      {/* Progress Section */}
      {isRunning && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold">
                {currentIndex === 0
                  ? 'Initializing...'
                  : `Test ${currentIndex}/${totalTests}`}
              </p>
              <p className="text-sm text-gray-400">{formatTime(timeElapsed)} elapsed</p>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(completed / totalTests) * 100}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-gray-900 rounded p-3 border border-gray-700">
              <p className="text-xs text-gray-400">Completed</p>
              <p className="text-2xl font-bold text-green-400">{success}</p>
            </div>
            <div className="bg-gray-900 rounded p-3 border border-gray-700">
              <p className="text-xs text-gray-400">Failed</p>
              <p className="text-2xl font-bold text-red-400">{failed}</p>
            </div>
            <div className="bg-gray-900 rounded p-3 border border-gray-700">
              <p className="text-xs text-gray-400">Remaining</p>
              <p className="text-2xl font-bold text-yellow-400">{totalTests - completed}</p>
            </div>
            <div className="bg-gray-900 rounded p-3 border border-gray-700">
              <p className="text-xs text-gray-400">ETA</p>
              <p className="text-lg font-bold text-blue-400">{formatTime(Math.ceil(estimatedRemaining))}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-3">
            <button
              onClick={handlePauseResume}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors"
            >
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors"
            >
              <X className="w-5 h-5" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Results Section */}
      {batchResults.length > 0 && (
        <div className="space-y-4">
          {/* Results Matrix */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-400" />
              Results Matrix
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-3 py-2 text-left text-gray-400">Preset</th>
                    {assets.map((asset) => (
                      <th key={asset} className="px-3 py-2 text-center text-gray-400">
                        {asset}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {presets.map((preset) => (
                    <tr key={preset} className="border-b border-gray-700">
                      <td className="px-3 py-2 font-semibold">{preset}</td>
                      {assets.map((asset) => {
                        const result = batchResults.find(
                          (r) => r.preset === preset && r.asset === asset
                        );
                        const value = result?.metrics?.totalReturn ?? 0;
                        return (
                          <td
                            key={`${preset}-${asset}`}
                            className={`px-3 py-2 text-center font-semibold ${
                              value >= 0
                                ? 'text-green-400'
                                : value === 0
                                  ? 'text-gray-400'
                                  : 'text-red-400'
                            }`}
                          >
                            {(value * 100).toFixed(1)}%
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Results */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Detailed Results
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {batchResults.map((result, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-gray-900 rounded p-3 border border-gray-700"
                >
                  <div className="flex items-center gap-3">
                    {result.status === 'completed' && (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    )}
                    {result.status === 'failed' && (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    )}
                    {result.status === 'running' && (
                      <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    )}
                    <div>
                      <p className="font-semibold text-sm">
                        {result.preset} - {result.asset}
                      </p>
                      <p className="text-xs text-gray-400">
                        {result.status === 'completed' && `${result.duration}ms`}
                        {result.status === 'failed' && `Failed: ${result.error}`}
                        {result.status === 'running' && 'Running...'}
                      </p>
                    </div>
                  </div>
                  {result.metrics && (
                    <p className="font-bold text-green-400">
                      {result.metrics.totalReturn ? (result.metrics.totalReturn * 100).toFixed(1) : '0.0'}%
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {success > 0 && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold mb-3">Recommendations</h3>
              {/* Best Overall */}
              {(() => {
                const best = batchResults.reduce((prev, current) =>
                  (current.metrics?.totalReturn ?? 0) > (prev.metrics?.totalReturn ?? 0)
                    ? current
                    : prev
                );
                return (
                  <p className="text-sm text-green-400">
                    <strong>Best Overall:</strong> {best.preset} on {best.asset} (
                    {((best.metrics?.totalReturn ?? 0) * 100).toFixed(1)}% return)
                  </p>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BatchBacktestRunner;
