import { useState, useMemo } from 'react';
import {
  AlertCircle,
  DollarSign,
  Percent,
  TrendingDown,
  Lock,
  Zap,
  BarChart3,
  Calculator,
} from 'lucide-react';

interface RiskManagementSettings {
  maxRiskPerTrade: number;
  maxDailyLoss: number;
  maxOpenPositions: number;
  maxLeverage: number;
  protectiveStopPercent: number;
  riskRewardRatio: number;
  portfolioMaxAllocation: number;
}

interface RiskManagementPanelProps {
  portfolioValue: number;
  currentRisk?: number;
  dailyLoss?: number;
  onSettingsChange?: (settings: RiskManagementSettings) => void;
  defaultSettings?: Partial<RiskManagementSettings>;
}

export default function RiskManagementPanel({
  portfolioValue,
  currentRisk = 0,
  dailyLoss = 0,
  onSettingsChange,
  defaultSettings = {},
}: RiskManagementPanelProps) {
  const [settings, setSettings] = useState<RiskManagementSettings>({
    maxRiskPerTrade: 2,
    maxDailyLoss: portfolioValue * 0.05,
    maxOpenPositions: 5,
    maxLeverage: 1,
    protectiveStopPercent: 5,
    riskRewardRatio: 1.5,
    portfolioMaxAllocation: 10,
    ...defaultSettings,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const positionSizing = useMemo(() => {
    const riskAmount = (portfolioValue * settings.maxRiskPerTrade) / 100;
    const maxAllocationAmount = (portfolioValue * settings.portfolioMaxAllocation) / 100;

    return {
      maxRiskPerTrade: riskAmount,
      maxAllocationAmount,
      recommendedStopPercent: settings.protectiveStopPercent,
      minRiskRewardRatio: settings.riskRewardRatio,
    };
  }, [portfolioValue, settings.maxRiskPerTrade, settings.portfolioMaxAllocation, settings.protectiveStopPercent, settings.riskRewardRatio]);

  const portfolioMetrics = useMemo(() => {
    const dailyLossPercent = (dailyLoss / portfolioValue) * 100;
    const remainingDailyLoss = settings.maxDailyLoss - dailyLoss;
    const remainingDailyLossPercent = (remainingDailyLoss / portfolioValue) * 100;
    
    const healthColor = dailyLossPercent < 50 ? 'green' : dailyLossPercent < 75 ? 'yellow' : 'red';

    return {
      dailyLossPercent,
      remainingDailyLoss: Math.max(0, remainingDailyLoss),
      remainingDailyLossPercent,
      healthColor,
      isAtRisk: dailyLossPercent >= 100,
    };
  }, [dailyLoss, settings.maxDailyLoss, portfolioValue]);

  const handleSettingChange = (key: keyof RiskManagementSettings, value: number) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange?.(newSettings);
  };

  const dailyLossPercent = Math.min(100, (dailyLoss / settings.maxDailyLoss) * 100);

  return (
    <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 rounded-lg border border-slate-700/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-yellow-400" />
          <span>Risk Management</span>
        </h3>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          {showAdvanced ? 'Hide' : 'Show'} Advanced
        </button>
      </div>

      <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Portfolio Risk Status</span>
          <span className={`text-xs font-semibold px-2 py-1 rounded ${
            portfolioMetrics.healthColor === 'green'
              ? 'bg-green-600/30 text-green-400'
              : portfolioMetrics.healthColor === 'yellow'
              ? 'bg-yellow-600/30 text-yellow-400'
              : 'bg-red-600/30 text-red-400'
          }`}>
            {portfolioMetrics.dailyLossPercent.toFixed(1)}% Daily Loss
          </span>
        </div>

        <div className="space-y-1">
          <div className="w-full bg-slate-700/30 rounded h-2 overflow-hidden">
            <div
              className={`h-full transition-all ${
                portfolioMetrics.healthColor === 'green'
                  ? 'bg-gradient-to-r from-green-600 to-green-400'
                  : portfolioMetrics.healthColor === 'yellow'
                  ? 'bg-gradient-to-r from-yellow-600 to-yellow-400'
                  : 'bg-gradient-to-r from-red-600 to-red-400'
              } ${
                dailyLossPercent < 25 ? 'w-1/4' :
                dailyLossPercent < 50 ? 'w-1/2' :
                dailyLossPercent < 75 ? 'w-3/4' :
                'w-full'
              }`}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>${dailyLoss.toFixed(2)}</span>
            <span className={portfolioMetrics.remainingDailyLoss <= 0 ? 'text-red-400' : 'text-slate-400'}>
              ${portfolioMetrics.remainingDailyLoss.toFixed(2)} remaining
            </span>
          </div>
        </div>

        {portfolioMetrics.isAtRisk && (
          <div className="flex items-start space-x-2 bg-red-600/20 border border-red-700/50 rounded p-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">Daily loss limit exceeded. No new trades allowed.</p>
          </div>
        )}
      </div>

      <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30 space-y-3">
        <h4 className="text-xs font-semibold text-white flex items-center space-x-2">
          <Calculator className="w-3 h-3 text-blue-400" />
          <span>Position Sizing</span>
        </h4>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Max Risk Per Trade</span>
            <span className="text-white font-semibold">${positionSizing.maxRiskPerTrade.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Max Position Size</span>
            <span className="text-white font-semibold">${positionSizing.maxAllocationAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Recommended Stop %</span>
            <span className="text-white font-semibold">{positionSizing.recommendedStopPercent.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Min Risk/Reward</span>
            <span className="text-white font-semibold">1:{positionSizing.minRiskRewardRatio.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 font-medium mb-2 flex items-center space-x-1">
            <Percent className="w-3 h-3" />
            <span>Max Risk Per Trade</span>
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={settings.maxRiskPerTrade}
              onChange={(e) => handleSettingChange('maxRiskPerTrade', parseFloat(e.target.value))}
              className="flex-1"
              title="Maximum risk per trade"
            />
            <div className="w-16 bg-slate-700/50 rounded px-2 py-1 text-right">
              <span className="text-white text-sm font-semibold">{settings.maxRiskPerTrade.toFixed(1)}%</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            ${positionSizing.maxRiskPerTrade.toFixed(2)} per trade
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 font-medium mb-2 flex items-center space-x-1">
            <TrendingDown className="w-3 h-3" />
            <span>Max Daily Loss</span>
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={settings.maxDailyLoss}
              onChange={(e) => handleSettingChange('maxDailyLoss', parseFloat(e.target.value))}
              className="flex-1 bg-slate-700/50 border border-slate-600/50 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
              title="Maximum daily loss"
              placeholder="5000"
            />
            <div className="text-sm text-slate-400 w-20">
              {((settings.maxDailyLoss / portfolioValue) * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 font-medium mb-2 flex items-center space-x-1">
            <BarChart3 className="w-3 h-3" />
            <span>Max Per Position</span>
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={settings.portfolioMaxAllocation}
              onChange={(e) => handleSettingChange('portfolioMaxAllocation', parseFloat(e.target.value))}
              className="flex-1"
              title="Max allocation per position"
            />
            <div className="w-16 bg-slate-700/50 rounded px-2 py-1 text-right">
              <span className="text-white text-sm font-semibold">{settings.portfolioMaxAllocation.toFixed(0)}%</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            ${positionSizing.maxAllocationAmount.toFixed(2)} max per position
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 font-medium mb-2 flex items-center space-x-1">
            <Zap className="w-3 h-3" />
            <span>Protective Stop</span>
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="1"
              max="20"
              step="0.5"
              value={settings.protectiveStopPercent}
              onChange={(e) => handleSettingChange('protectiveStopPercent', parseFloat(e.target.value))}
              className="flex-1"
              title="Protective stop percentage"
            />
            <div className="w-16 bg-slate-700/50 rounded px-2 py-1 text-right">
              <span className="text-white text-sm font-semibold">{settings.protectiveStopPercent.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {showAdvanced && (
        <div className="border-t border-slate-700/50 pt-3 space-y-3">
          <div>
            <label className="text-xs text-slate-400 font-medium mb-2 block">
              Max Open Positions
            </label>
            <div className="grid grid-cols-5 gap-1">
              {[1, 3, 5, 10, 20].map((num) => (
                <button
                  key={num}
                  onClick={() => handleSettingChange('maxOpenPositions', num)}
                  className={`py-1.5 rounded text-xs font-medium transition-colors ${
                    settings.maxOpenPositions === num
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium mb-2 flex items-center space-x-1">
              <Lock className="w-3 h-3" />
              <span>Max Leverage</span>
            </label>
            <div className="grid grid-cols-5 gap-1">
              {[1, 2, 5, 10, 20].map((lev) => (
                <button
                  key={lev}
                  onClick={() => handleSettingChange('maxLeverage', lev)}
                  className={`py-1.5 rounded text-xs font-medium transition-colors ${
                    settings.maxLeverage === lev
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {lev}x
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium mb-2 block">
              Min Risk/Reward Ratio
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.1"
                value={settings.riskRewardRatio}
                onChange={(e) => handleSettingChange('riskRewardRatio', parseFloat(e.target.value))}
                className="flex-1"
                title="Risk reward ratio"
              />
              <div className="w-20 bg-slate-700/50 rounded px-2 py-1 text-right">
                <span className="text-white text-sm font-semibold">1:{settings.riskRewardRatio.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-600/20 border border-blue-700/50 rounded p-3">
        <p className="text-xs text-blue-400">
          <strong>💡 Tip:</strong> Adjust these settings based on your risk tolerance and trading strategy.
        </p>
      </div>
    </div>
  );
}
