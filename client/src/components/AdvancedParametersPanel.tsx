import React, { useState } from 'react';
import { ChevronDown, ChevronUp, RotateCcw, Save, Plus, Trash2 } from 'lucide-react';

interface AdvancedParameters {
  slippage: number;
  commission: number;
  positionSizingMethod: 'fixed' | 'dynamic' | 'kelly' | 'volatility';
  positionSize: number;
  maxDrawdown: number;
  dailyLossLimit: number;
  riskPerTrade: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  trailingStopPercent?: number;
  useTrailingStop: boolean;
  maxPositionSize: number;
  minPositionSize: number;
}

interface ParameterPreset {
  name: string;
  params: AdvancedParameters;
}

interface AdvancedParametersPanelProps {
  parameters: AdvancedParameters;
  onParametersChange: (params: AdvancedParameters) => void;
}

export default function AdvancedParametersPanel({
  parameters,
  onParametersChange
}: AdvancedParametersPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [savedPresets, setSavedPresets] = useState<ParameterPreset[]>([
    {
      name: 'Conservative',
      params: {
        slippage: 0.001,
        commission: 0,
        positionSizingMethod: 'fixed',
        positionSize: 0.05,
        maxDrawdown: 0.1,
        dailyLossLimit: 500,
        riskPerTrade: 0.01,
        stopLossPercent: 2,
        takeProfitPercent: 5,
        useTrailingStop: true,
        trailingStopPercent: 2,
        maxPositionSize: 0.1,
        minPositionSize: 0.02
      }
    },
    {
      name: 'Aggressive',
      params: {
        slippage: 0.002,
        commission: 0,
        positionSizingMethod: 'dynamic',
        positionSize: 0.25,
        maxDrawdown: 0.2,
        dailyLossLimit: 2000,
        riskPerTrade: 0.05,
        stopLossPercent: 5,
        takeProfitPercent: 15,
        useTrailingStop: true,
        trailingStopPercent: 3,
        maxPositionSize: 0.3,
        minPositionSize: 0.05
      }
    },
    {
      name: 'Balanced',
      params: {
        slippage: 0.0015,
        commission: 0,
        positionSizingMethod: 'kelly',
        positionSize: 0.1,
        maxDrawdown: 0.15,
        dailyLossLimit: 1000,
        riskPerTrade: 0.02,
        stopLossPercent: 3,
        takeProfitPercent: 8,
        useTrailingStop: true,
        trailingStopPercent: 2.5,
        maxPositionSize: 0.2,
        minPositionSize: 0.03
      }
    }
  ]);
  const [showPresetSave, setShowPresetSave] = useState(false);
  const [presetName, setPresetName] = useState('');

  const handleParameterChange = (key: keyof AdvancedParameters, value: any) => {
    onParametersChange({
      ...parameters,
      [key]: value
    });
  };

  const handleLoadPreset = (preset: ParameterPreset) => {
    onParametersChange(preset.params);
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      alert('Please enter a preset name');
      return;
    }

    const newPreset: ParameterPreset = {
      name: presetName,
      params: parameters
    };

    setSavedPresets([...savedPresets, newPreset]);
    setPresetName('');
    setShowPresetSave(false);
  };

  const handleDeletePreset = (index: number) => {
    setSavedPresets(savedPresets.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    onParametersChange({
      slippage: 0.001,
      commission: 0,
      positionSizingMethod: 'fixed',
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
  };

  return (
    <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold text-white">Advanced Parameters</h3>
          <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded">Phase 6B</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-slate-700/50 p-6 space-y-6">
          {/* Trading Costs */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center">
              <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
              Trading Costs
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Slippage (%)</label>
                <input
                  type="number"
                  step="0.001"
                  value={parameters.slippage}
                  onChange={(e) => handleParameterChange('slippage', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
                />
                <p className="text-xs text-slate-500 mt-1">Price impact per trade</p>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Commission ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={parameters.commission}
                  onChange={(e) => handleParameterChange('commission', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
                />
                <p className="text-xs text-slate-500 mt-1">Per trade cost</p>
              </div>
            </div>
          </div>

          {/* Position Sizing */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
              Position Sizing
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Method</label>
                <select
                  value={parameters.positionSizingMethod}
                  onChange={(e) => handleParameterChange('positionSizingMethod', e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
                >
                  <option value="fixed">Fixed Size</option>
                  <option value="dynamic">Dynamic (Volatility-Based)</option>
                  <option value="kelly">Kelly Criterion</option>
                  <option value="volatility">Volatility Adjusted</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  {parameters.positionSizingMethod === 'fixed' && 'Constant position size'}
                  {parameters.positionSizingMethod === 'dynamic' && 'Adjust based on account'}
                  {parameters.positionSizingMethod === 'kelly' && 'Optimal sizing formula'}
                  {parameters.positionSizingMethod === 'volatility' && 'Inverse to market volatility'}
                </p>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Size (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={parameters.positionSize}
                  onChange={(e) => handleParameterChange('positionSize', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {(parameters.positionSize * 100).toFixed(1)}% of capital
                </p>
              </div>
            </div>

            {/* Position Limits */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Max Position Size (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={parameters.maxPositionSize}
                  onChange={(e) => handleParameterChange('maxPositionSize', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Min Position Size (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={parameters.minPositionSize}
                  onChange={(e) => handleParameterChange('minPositionSize', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors text-sm"
                />
              </div>
            </div>
          </div>

          {/* Risk Controls */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center">
              <span className="w-2 h-2 bg-red-400 rounded-full mr-2"></span>
              Risk Controls
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Max Drawdown (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={parameters.maxDrawdown}
                  onChange={(e) => handleParameterChange('maxDrawdown', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
                />
                <p className="text-xs text-slate-500 mt-1">Stop trading if exceeded</p>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Daily Loss Limit ($)</label>
                <input
                  type="number"
                  step="100"
                  value={parameters.dailyLossLimit}
                  onChange={(e) => handleParameterChange('dailyLossLimit', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
                />
                <p className="text-xs text-slate-500 mt-1">Max daily loss allowed</p>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Risk Per Trade (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="0.1"
                  value={parameters.riskPerTrade}
                  onChange={(e) => handleParameterChange('riskPerTrade', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
                />
                <p className="text-xs text-slate-500 mt-1">Max % of capital per trade</p>
              </div>
            </div>
          </div>

          {/* Exit Strategy */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center">
              <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
              Exit Strategy
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Stop Loss (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={parameters.stopLossPercent}
                  onChange={(e) => handleParameterChange('stopLossPercent', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Take Profit (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={parameters.takeProfitPercent}
                  onChange={(e) => handleParameterChange('takeProfitPercent', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
                />
              </div>
              <div>
                <label className="flex items-center space-x-2 mb-2">
                  <input
                    type="checkbox"
                    checked={parameters.useTrailingStop}
                    onChange={(e) => handleParameterChange('useTrailingStop', e.target.checked)}
                    className="w-4 h-4 accent-blue-500"
                  />
                  <span className="text-sm text-slate-400">Trailing Stop</span>
                </label>
                {parameters.useTrailingStop && (
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={parameters.trailingStopPercent || 0}
                    onChange={(e) => handleParameterChange('trailingStopPercent', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors text-sm"
                    placeholder="Trail %"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Presets */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center">
              <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
              Parameter Presets
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
              {savedPresets.map((preset, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg hover:border-slate-600/50 transition-colors"
                >
                  <button
                    onClick={() => handleLoadPreset(preset)}
                    className="flex-1 text-left text-sm font-medium text-slate-300 hover:text-white transition-colors"
                  >
                    {preset.name}
                  </button>
                  {idx >= 3 && (
                    <button
                      onClick={() => handleDeletePreset(idx)}
                      className="p-1 hover:bg-red-500/20 rounded transition-colors text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Save New Preset */}
            {!showPresetSave ? (
              <button
                onClick={() => setShowPresetSave(true)}
                className="w-full px-4 py-2 flex items-center justify-center space-x-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg text-slate-300 hover:text-white transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Save Current as Preset</span>
              </button>
            ) : (
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name..."
                  className="flex-1 px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                />
                <button
                  onClick={handleSavePreset}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium transition-all flex items-center space-x-1"
                >
                  <Save className="w-4 h-4" />
                  <span>Save</span>
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-700/50 flex space-x-3">
            <button
              onClick={handleReset}
              className="flex-1 px-4 py-2 flex items-center justify-center space-x-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg text-slate-300 hover:text-white transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset to Default</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
