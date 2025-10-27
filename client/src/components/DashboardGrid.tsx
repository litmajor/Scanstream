import { useState } from 'react';
import { Plus, Save } from 'lucide-react';
import ChartWidget from './widgets/ChartWidget';
import SignalsWidget from './widgets/SignalsWidget';
import PortfolioWidget from './widgets/PortfolioWidget';
import MarketOverviewWidget from './widgets/MarketOverviewWidget';

interface Widget {
  id: string;
  type: 'chart' | 'signals' | 'portfolio' | 'market';
  colSpan: number;
  rowSpan: number;
  x: number;
  y: number;
}

interface DashboardGridProps {
  onClose?: () => void;
}

type LayoutPreset = 'beginner' | 'day_trader' | 'analyst' | 'minimalist';

const presets: Record<LayoutPreset, Widget[]> = {
  beginner: [
    { id: 'chart-1', type: 'chart', colSpan: 2, rowSpan: 2, x: 0, y: 0 },
    { id: 'signals-1', type: 'signals', colSpan: 1, rowSpan: 1, x: 2, y: 0 },
    { id: 'portfolio-1', type: 'portfolio', colSpan: 1, rowSpan: 2, x: 3, y: 0 },
    { id: 'market-1', type: 'market', colSpan: 1, rowSpan: 1, x: 2, y: 1 },
  ],
  day_trader: [
    { id: 'chart-1', type: 'chart', colSpan: 3, rowSpan: 2, x: 0, y: 0 },
    { id: 'signals-1', type: 'signals', colSpan: 1, rowSpan: 2, x: 3, y: 0 },
  ],
  analyst: [
    { id: 'chart-1', type: 'chart', colSpan: 2, rowSpan: 2, x: 0, y: 0 },
    { id: 'signals-1', type: 'signals', colSpan: 1, rowSpan: 1, x: 2, y: 0 },
    { id: 'portfolio-1', type: 'portfolio', colSpan: 1, rowSpan: 1, x: 3, y: 0 },
    { id: 'market-1', type: 'market', colSpan: 1, rowSpan: 1, x: 2, y: 1 },
    { id: 'chart-2', type: 'chart', colSpan: 2, rowSpan: 2, x: 0, y: 2 },
  ],
  minimalist: [
    { id: 'chart-1', type: 'chart', colSpan: 4, rowSpan: 3, x: 0, y: 0 },
  ],
};

export default function DashboardGrid({ onClose }: DashboardGridProps) {
  const [widgets, setWidgets] = useState<Widget[]>(() => {
    const saved = localStorage.getItem('dashboardLayout');
    return saved ? JSON.parse(saved) : presets.beginner;
  });

  const [selectedPreset, setSelectedPreset] = useState<LayoutPreset>('beginner');
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Mock data for widgets
  const mockSignals = [
    { symbol: 'BTC/USDT', type: 'BUY' as const, price: 45230, change: 2.45 },
    { symbol: 'ETH/USDT', type: 'BUY' as const, price: 2456, change: 1.23 },
    { symbol: 'SOL/USDT', type: 'SELL' as const, price: 98.5, change: -0.87 },
  ];

  const handleDragStart = (widgetId: string, e: React.MouseEvent) => {
    setDraggedWidget(widgetId);
    const widget = widgets.find(w => w.id === widgetId);
    if (widget) {
      const gridX = Math.floor(e.clientX / 100); // Approximate grid size
      const gridY = Math.floor(e.clientY / 100);
      setDragOffset({ x: gridX - widget.x, y: gridY - widget.y });
    }
  };

  const handleDragEnd = () => {
    setDraggedWidget(null);
  };

  const handlePresetChange = (preset: LayoutPreset) => {
    setSelectedPreset(preset);
    setWidgets(presets[preset]);
    localStorage.setItem('dashboardLayout', JSON.stringify(presets[preset]));
  };

  const handleSaveLayout = () => {
    localStorage.setItem('dashboardLayout', JSON.stringify(widgets));
    // TODO: Show success toast
  };

  const handleRemoveWidget = (widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
  };

  const renderWidget = (widget: Widget) => {
    switch (widget.type) {
      case 'chart':
        return (
          <ChartWidget
            id={widget.id}
            symbol="BTC/USDT"
            price={45230}
            change={512.5}
            changePercent={2.45}
            onRemove={handleRemoveWidget}
          />
        );
      case 'signals':
        return (
          <SignalsWidget
            id={widget.id}
            signals={mockSignals}
            onRemove={handleRemoveWidget}
          />
        );
      case 'portfolio':
        return (
          <PortfolioWidget
            id={widget.id}
            balance={12500.75}
            totalReturn={0.15}
            winRate={0.62}
            totalTrades={120}
            onRemove={handleRemoveWidget}
          />
        );
      case 'market':
        return (
          <MarketOverviewWidget
            id={widget.id}
            fearGreedIndex={45}
            btcDominance={48.2}
            totalMarketCap={1.8}
            volume24h={95.5}
            onRemove={handleRemoveWidget}
          />
        );
      default:
        return null;
    }
  };

  // Generate dynamic grid template
  const maxCol = Math.max(...widgets.map(w => w.x + w.colSpan), 4);
  const maxRow = Math.max(...widgets.map(w => w.y + w.rowSpan), 3);

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-slate-900/80 border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Dashboard Grid
          </h1>
          
          {/* Preset Selector */}
          <div className="flex items-center space-x-2">
            <label htmlFor="preset-selector" className="sr-only">Layout Preset</label>
            <select
              id="preset-selector"
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value as LayoutPreset)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              aria-label="Select layout preset"
            >
              <option value="beginner">Beginner</option>
              <option value="day_trader">Day Trader</option>
              <option value="analyst">Analyst</option>
              <option value="minimalist">Minimalist</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSaveLayout}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Save Layout</span>
          </button>
          
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-all"
            >
              Close
            </button>
          )}
        </div>
      </header>

      {/* Dashboard Grid */}
      <div className="flex-1 overflow-auto p-6">
        <div
          className="grid gap-4 mx-auto"
          style={{
            gridTemplateColumns: `repeat(${maxCol}, minmax(200px, 1fr))`,
            gridAutoRows: 'minmax(200px, auto)',
            maxWidth: '1600px',
          }}
        >
          {widgets.map((widget) => {
            const isDragging = draggedWidget === widget.id;
            return (
              <div
                key={widget.id}
                style={{
                  gridColumn: `span ${widget.colSpan}`,
                  gridRow: `span ${widget.rowSpan}`,
                  opacity: isDragging ? 0.5 : 1,
                }}
                onMouseDown={(e) => handleDragStart(widget.id, e)}
                onMouseUp={handleDragEnd}
                className="cursor-move"
              >
                {renderWidget(widget)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Info */}
      <footer className="bg-slate-900/80 border-t border-slate-700/50 px-6 py-3 text-sm text-slate-400">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span>Drag widgets to reorder</span>
            <span>•</span>
            <span>{widgets.length} widgets</span>
          </div>
          <button className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 transition-colors">
            <Plus className="w-4 h-4" />
            <span>Add Widget</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
