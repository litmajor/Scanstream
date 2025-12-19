import React, { useState, useRef, useCallback } from 'react';
import { Play, Pause, X, TrendingUp, BarChart3, Zap, ChevronDown, ChevronUp } from 'lucide-react';

type TuningMethod = 'grid' | 'random' | 'bayesian';

export interface ParameterRange {
  name: string;
  type: 'number' | 'select';
  min?: number;
  max?: number;
  step?: number;
  values?: string[];
  current: number | string;
}

export interface TuningResult {
  parameters: Record<string, number | string>;
  metrics: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
  };
  rank: number;
  testedAt: number;
}

export interface TuningProgress {
  method: TuningMethod;
  currentIteration: number;
  totalIterations: number;
  percentComplete: number;
  timeElapsed: number;
  estimatedTimeRemaining: number;
  bestResult?: TuningResult;
}

interface ParameterTuningPanelProps {
  onStartTuning?: (config: {
    method: TuningMethod;
    parameters: ParameterRange[];
    iterations: number;
  }) => void;
  onComplete?: (bestResult: TuningResult) => void;
  isRunning?: boolean;
  progress?: TuningProgress;
  results?: TuningResult[];
  strategyName?: string;
}

const DEFAULT_PARAMETERS: ParameterRange[] = [
  {
    name: 'FastMA',
    type: 'number',
    min: 5,
    max: 40,
    step: 5,
    current: 10
  },
  {
    name: 'SlowMA',
    type: 'number',
    min: 50,
    max: 200,
    step: 50,
    current: 100
  },
  {
    name: 'TakeProfit',
    type: 'number',
    min: 1,
    max: 10,
    step: 1,
    current: 5
  },
  {
    name: 'StopLoss',
    type: 'number',
    min: 0.5,
    max: 5,
    step: 0.5,
    current: 2
  }
];

export const ParameterTuningPanel: React.FC<ParameterTuningPanelProps> = ({
  onStartTuning,
  onComplete,
  isRunning = false,
  progress,
  results = [],
  strategyName = 'Strategy'
}) => {
  const [tuningMethod, setTuningMethod] = useState<TuningMethod>('grid');
  const [parameters, setParameters] = useState<ParameterRange[]>(DEFAULT_PARAMETERS);
  const [iterations, setIterations] = useState(100);
  const [expandedResult, setExpandedResult] = useState<number | null>(null);
  const [expandedParams, setExpandedParams] = useState(false);

  const startTuning = useCallback(() => {
    onStartTuning?.({
      method: tuningMethod,
      parameters,
      iterations
    });
  }, [tuningMethod, parameters, iterations, onStartTuning]);

  const updateParameter = (index: number, field: string, value: any) => {
    const updated = [...parameters];
    if (field === 'min' || field === 'max' || field === 'step') {
      updated[index] = { ...updated[index], [field]: Number(value) };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setParameters(updated);
  };

  const addParameter = () => {
    setParameters([
      ...parameters,
      {
        name: `Param${parameters.length + 1}`,
        type: 'number',
        min: 0,
        max: 100,
        step: 10,
        current: 50
      }
    ]);
  };

  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const resetParameters = () => {
    setParameters(DEFAULT_PARAMETERS);
  };

  // Calculate total combinations for grid search
  const calculateCombinations = () => {
    if (tuningMethod !== 'grid') return iterations;

    let combinations = 1;
    parameters.forEach(param => {
      if (param.type === 'number' && param.min !== undefined && param.max !== undefined && param.step !== undefined) {
        const count = Math.floor((param.max - param.min) / param.step) + 1;
        combinations *= count;
      } else if (param.type === 'select' && param.values) {
        combinations *= param.values.length;
      }
    });
    return combinations;
  };

  const totalCombinations = calculateCombinations();

  // Sort results by return
  const sortedResults = [...results].sort((a, b) => b.metrics.totalReturn - a.metrics.totalReturn);
  const topResults = sortedResults.slice(0, 10);
  const bestResult = progress?.bestResult || sortedResults[0];

  // Time formatting
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className="space-y-4 p-4 bg-gray-900 rounded-lg border border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-white">Parameter Tuning</h3>
          <span className="text-xs text-gray-500">{strategyName}</span>
        </div>
      </div>

      {/* Tuning Method Selection */}
      <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-2">
        <label className="text-sm font-semibold text-white">Tuning Method:</label>
        <div className="space-y-2">
          {[
            { id: 'grid', label: 'Grid Search', description: 'Test all combinations (exhaustive)' },
            { id: 'random', label: 'Random Search', description: 'Random samples (faster)' },
            { id: 'bayesian', label: 'Bayesian Optimization', description: 'Smart sampling (most efficient)' }
          ].map(method => (
            <label key={method.id} className="flex items-start gap-2 text-sm text-gray-300 cursor-pointer p-2 rounded hover:bg-gray-700">
              <input
                type="radio"
                value={method.id}
                checked={tuningMethod === method.id}
                onChange={(e) => setTuningMethod(e.target.value as TuningMethod)}
                disabled={isRunning}
                className="w-4 h-4 mt-0.5"
              />
              <div className="flex-1">
                <div className="font-medium">{method.label}</div>
                <div className="text-xs text-gray-500">{method.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Iterations Slider */}
      <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-semibold text-white">Iterations:</label>
          <span className="text-lg font-bold text-blue-400">{iterations}</span>
        </div>
        <input
          type="range"
          min="10"
          max="1000"
          step="10"
          value={iterations}
          onChange={(e) => setIterations(Number(e.target.value))}
          disabled={isRunning}
          className="w-full"
        />
        <div className="text-xs text-gray-500">
          {tuningMethod === 'grid' && `Total combinations: ${totalCombinations}`}
        </div>
      </div>

      {/* Parameters Configuration */}
      <div className="bg-gray-800 p-3 rounded border border-gray-700">
        <button
          onClick={() => setExpandedParams(!expandedParams)}
          className="w-full flex items-center justify-between text-sm font-semibold text-white p-2 hover:bg-gray-700 rounded transition"
          disabled={isRunning}
        >
          <span>Parameter Ranges ({parameters.length})</span>
          {expandedParams ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {expandedParams && (
          <div className="mt-3 space-y-2 border-t border-gray-700 pt-3">
            {parameters.map((param, i) => (
              <div key={i} className="flex gap-2 items-end">
                <input
                  type="text"
                  value={param.name}
                  onChange={(e) => updateParameter(i, 'name', e.target.value)}
                  placeholder="Parameter name"
                  disabled={isRunning}
                  className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-white"
                />
                {param.type === 'number' ? (
                  <>
                    <input
                      type="number"
                      value={param.min}
                      onChange={(e) => updateParameter(i, 'min', e.target.value)}
                      placeholder="Min"
                      disabled={isRunning}
                      className="w-16 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs"
                    />
                    <input
                      type="number"
                      value={param.max}
                      onChange={(e) => updateParameter(i, 'max', e.target.value)}
                      placeholder="Max"
                      disabled={isRunning}
                      className="w-16 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs"
                    />
                    <input
                      type="number"
                      value={param.step}
                      onChange={(e) => updateParameter(i, 'step', e.target.value)}
                      placeholder="Step"
                      disabled={isRunning}
                      className="w-16 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs"
                    />
                  </>
                ) : (
                  <input
                    type="text"
                    placeholder="Values (comma-separated)"
                    disabled={isRunning}
                    className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs"
                  />
                )}
                <button
                  onClick={() => removeParameter(i)}
                  disabled={isRunning}
                  className="px-2 py-1 bg-red-900 hover:bg-red-800 disabled:bg-gray-700 text-red-100 rounded text-xs"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            <div className="flex gap-2 pt-2 border-t border-gray-700">
              <button
                onClick={addParameter}
                disabled={isRunning}
                className="flex-1 px-3 py-1 bg-green-900 hover:bg-green-800 disabled:bg-gray-700 text-green-100 rounded text-xs"
              >
                Add Parameter
              </button>
              <button
                onClick={resetParameters}
                disabled={isRunning}
                className="flex-1 px-3 py-1 bg-yellow-900 hover:bg-yellow-800 disabled:bg-gray-700 text-yellow-100 rounded text-xs"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Start/Stop Button */}
      <button
        onClick={startTuning}
        disabled={isRunning}
        className={`w-full px-4 py-3 rounded font-semibold flex items-center justify-center gap-2 transition ${
          isRunning
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
            : 'bg-purple-600 hover:bg-purple-700 text-white'
        }`}
      >
        {isRunning ? (
          <>
            <Pause className="w-4 h-4" />
            Running...
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Start Tuning
          </>
        )}
      </button>

      {/* Progress */}
      {isRunning && progress && (
        <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-3">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-white">
                {progress.currentIteration} / {progress.totalIterations}
              </span>
              <span className="text-sm text-gray-400">{Math.round(progress.percentComplete)}%</span>
            </div>
            <div className="w-full bg-gray-900 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-500 to-blue-500 h-3 transition-all"
                style={{ width: `${progress.percentComplete}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-gray-900 p-2 rounded">
              <div className="text-gray-400">Elapsed</div>
              <div className="text-yellow-400 font-semibold">{formatTime(progress.timeElapsed)}</div>
            </div>
            <div className="bg-gray-900 p-2 rounded">
              <div className="text-gray-400">ETA</div>
              <div className="text-yellow-400 font-semibold">{formatTime(progress.estimatedTimeRemaining)}</div>
            </div>
            <div className="bg-gray-900 p-2 rounded">
              <div className="text-gray-400">Method</div>
              <div className="text-blue-400 font-semibold capitalize">{progress.method}</div>
            </div>
          </div>

          {progress.bestResult && (
            <div className="bg-green-900 border border-green-700 p-2 rounded">
              <div className="text-sm font-semibold text-green-200 mb-1">Best So Far:</div>
              <div className="grid grid-cols-2 gap-2 text-xs text-green-200">
                <div>Return: <span className="font-bold">{(progress.bestResult.metrics.totalReturn * 100).toFixed(2)}%</span></div>
                <div>Sharpe: <span className="font-bold">{progress.bestResult.metrics.sharpeRatio.toFixed(2)}</span></div>
                <div>Max DD: <span className="font-bold">{(progress.bestResult.metrics.maxDrawdown * 100).toFixed(2)}%</span></div>
                <div>Win Rate: <span className="font-bold">{(progress.bestResult.metrics.winRate * 100).toFixed(1)}%</span></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Display */}
      {topResults.length > 0 && (
        <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-2">
          <div className="text-sm font-semibold text-white">
            Top Results ({sortedResults.length} tested)
          </div>

          <div className="space-y-2">
            {topResults.map((result, i) => (
              <div
                key={i}
                onClick={() => setExpandedResult(expandedResult === i ? null : i)}
                className="bg-gray-900 p-2 rounded cursor-pointer hover:bg-gray-850 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="text-sm">
                    <div className="text-white font-semibold">
                      #{i + 1} - Return: {(result.metrics.totalReturn * 100).toFixed(2)}%
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Sharpe: {result.metrics.sharpeRatio.toFixed(2)} | Win: {(result.metrics.winRate * 100).toFixed(1)}%
                    </div>
                  </div>
                  {expandedResult === i ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>

                {expandedResult === i && (
                  <div className="mt-2 pt-2 border-t border-gray-700 space-y-1">
                    <div className="text-xs text-gray-300">
                      <div className="font-semibold mb-1">Parameters:</div>
                      {Object.entries(result.parameters).map(([key, value]) => (
                        <div key={key} className="text-gray-400">
                          {key}: <span className="text-blue-400">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {bestResult && (
            <div className="pt-2 border-t border-gray-700">
              <button
                onClick={() => onComplete?.(bestResult)}
                className="w-full px-3 py-2 bg-green-900 hover:bg-green-800 text-green-100 rounded text-sm font-medium"
              >
                Apply Best Parameters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isRunning && results.length === 0 && (
        <div className="bg-gray-800 p-4 rounded border border-gray-700 text-center text-gray-400 text-sm">
          <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No tuning results yet. Click "Start Tuning" to begin optimization.</p>
        </div>
      )}
    </div>
  );
};

export default ParameterTuningPanel;
