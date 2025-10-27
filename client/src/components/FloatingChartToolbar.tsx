import { useState } from 'react';
import { 
  Maximize2, 
  Minimize2, 
  TrendingUp, 
  Activity, 
  Camera, 
  Download,
  Settings,
  Layers,
  ChevronDown
} from 'lucide-react';

interface FloatingChartToolbarProps {
  selectedTimeframe: string;
  onTimeframeChange: (timeframe: string) => void;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  onScreenshot?: () => void;
  onExport?: () => void;
}

const timeframes = [
  { value: '1m', label: '1m', shortcut: '1' },
  { value: '5m', label: '5m', shortcut: '2' },
  { value: '1h', label: '1h', shortcut: '3' },
  { value: '1d', label: '1d', shortcut: '4' },
  { value: '1w', label: '1w', shortcut: '5' },
];

const chartPresets = [
  { 
    name: 'Scalping', 
    icon: Activity,
    timeframe: '1m',
    indicators: ['Volume', 'EMA'],
    description: 'Fast-paced 1-5 minute trades'
  },
  { 
    name: 'Day Trading', 
    icon: TrendingUp,
    timeframe: '1h',
    indicators: ['RSI', 'MACD', 'Volume'],
    description: 'Intraday position management'
  },
  { 
    name: 'Swing', 
    icon: Layers,
    timeframe: '1d',
    indicators: ['Bollinger', 'RSI', 'Volume'],
    description: 'Multi-day position holds'
  },
];

const indicators = [
  { id: 'rsi', name: 'RSI', color: 'text-purple-400' },
  { id: 'macd', name: 'MACD', color: 'text-blue-400' },
  { id: 'bollinger', name: 'Bollinger Bands', color: 'text-green-400' },
  { id: 'volume', name: 'Volume', color: 'text-orange-400' },
  { id: 'ema', name: 'EMA', color: 'text-cyan-400' },
];

export default function FloatingChartToolbar({
  selectedTimeframe,
  onTimeframeChange,
  isFullscreen,
  onFullscreenToggle,
  onScreenshot,
  onExport,
}: FloatingChartToolbarProps) {
  const [showPresets, setShowPresets] = useState(false);
  const [showIndicators, setShowIndicators] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<string[]>(['volume']);

  const applyPreset = (preset: typeof chartPresets[0]) => {
    onTimeframeChange(preset.timeframe);
    setActiveIndicators(preset.indicators.map(i => i.toLowerCase()));
    setShowPresets(false);
  };

  const toggleIndicator = (id: string) => {
    setActiveIndicators(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <>
      {/* Floating Toolbar - Positioned at bottom of chart area */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center space-x-2">
        {/* Timeframe Selector */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-lg p-1.5 flex items-center space-x-1 shadow-xl">
          {timeframes.map((tf) => (
            <button
              key={tf.value}
              onClick={() => onTimeframeChange(tf.value)}
              className={`
                px-3 py-1.5 rounded-md text-sm font-medium transition-all
                ${selectedTimeframe === tf.value
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }
              `}
              title={`${tf.label} (Press ${tf.shortcut})`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Chart Presets */}
        <div className="relative">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-lg px-3 py-2 flex items-center space-x-2 text-slate-300 hover:text-white transition-colors shadow-xl"
            title="Chart Presets"
          >
            <Layers className="w-4 h-4" />
            <span className="text-sm font-medium">Presets</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showPresets ? 'rotate-180' : ''}`} />
          </button>

          {showPresets && (
            <div className="absolute bottom-full mb-2 left-0 w-64 bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
              {chartPresets.map((preset) => {
                const Icon = preset.icon;
                return (
                  <button
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    className="w-full px-4 py-3 flex items-start space-x-3 hover:bg-slate-800/50 transition-colors text-left group"
                  >
                    <div className="p-2 rounded-lg bg-slate-800 group-hover:bg-slate-700 transition-colors">
                      <Icon className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white mb-0.5">
                        {preset.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {preset.description}
                      </div>
                      <div className="flex items-center space-x-1 mt-1">
                        <span className="text-xs text-slate-500">
                          {preset.timeframe} • {preset.indicators.join(', ')}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Indicators Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowIndicators(!showIndicators)}
            className="bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-lg px-3 py-2 flex items-center space-x-2 text-slate-300 hover:text-white transition-colors shadow-xl"
            title="Indicators"
          >
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">Indicators</span>
            {activeIndicators.length > 0 && (
              <span className="px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                {activeIndicators.length}
              </span>
            )}
          </button>

          {showIndicators && (
            <div className="absolute bottom-full mb-2 left-0 w-56 bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
              <div className="p-2 space-y-1">
                {indicators.map((indicator) => (
                  <button
                    key={indicator.id}
                    onClick={() => toggleIndicator(indicator.id)}
                    className={`
                      w-full px-3 py-2 rounded-lg flex items-center justify-between
                      transition-all
                      ${activeIndicators.includes(indicator.id)
                        ? 'bg-slate-800 border border-blue-500/50'
                        : 'hover:bg-slate-800/50'
                      }
                    `}
                  >
                    <span className={`text-sm font-medium ${
                      activeIndicators.includes(indicator.id) ? 'text-white' : 'text-slate-400'
                    }`}>
                      {indicator.name}
                    </span>
                    {activeIndicators.includes(indicator.id) && (
                      <div className={`w-2 h-2 rounded-full ${indicator.color.replace('text-', 'bg-')}`} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-lg p-1.5 flex items-center space-x-1 shadow-xl">
          {onScreenshot && (
            <button
              onClick={onScreenshot}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
              title="Screenshot (Ctrl+Shift+S)"
            >
              <Camera className="w-4 h-4" />
            </button>
          )}
          
          {onExport && (
            <button
              onClick={onExport}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
              title="Export Data"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          
          <button
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            title="Chart Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          
          <div className="w-px h-5 bg-slate-700" />
          
          <button
            onClick={onFullscreenToggle}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            title={isFullscreen ? 'Exit Fullscreen (F or ESC)' : 'Fullscreen (F)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Keyboard Shortcuts Hint */}
      {!isFullscreen && (
        <div className="absolute top-2 right-2 z-30 bg-slate-900/70 backdrop-blur-sm border border-slate-700/30 rounded-lg px-3 py-1.5 text-xs text-slate-400">
          Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-white">F</kbd> for fullscreen
        </div>
      )}
    </>
  );
}

