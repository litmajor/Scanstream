import { useState } from 'react';
import { 
  Zap, 
  TrendingUp, 
  Search, 
  Star, 
  Bell as AlertBell,
  Camera,
  Share2,
  X,
  DollarSign,
  Plus
} from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  hoverColor: string;
  onClick: () => void;
  shortcut?: string;
}

interface QuickActionsBarProps {
  onQuickTrade: () => void;
  onQuickScan: () => void;
  onAddToWatchlist: () => void;
  onSetPriceAlert: () => void;
  onTakeScreenshot: () => void;
  onShareChart: () => void;
  currentSymbol?: string;
}

export default function QuickActionsBar({
  onQuickTrade,
  onQuickScan,
  onAddToWatchlist,
  onSetPriceAlert,
  onTakeScreenshot,
  onShareChart,
  currentSymbol = 'BTC/USDT',
}: QuickActionsBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const actions: QuickAction[] = [
    {
      id: 'trade',
      label: 'Quick Trade',
      icon: TrendingUp,
      color: 'bg-green-600',
      hoverColor: 'hover:bg-green-500',
      onClick: () => {
        onQuickTrade();
        setIsExpanded(false);
      },
      shortcut: 'T',
    },
    {
      id: 'scan',
      label: 'Quick Scan',
      icon: Search,
      color: 'bg-blue-600',
      hoverColor: 'hover:bg-blue-500',
      onClick: () => {
        onQuickScan();
        setIsExpanded(false);
      },
      shortcut: 'S',
    },
    {
      id: 'watchlist',
      label: 'Add to Watchlist',
      icon: Star,
      color: 'bg-yellow-600',
      hoverColor: 'hover:bg-yellow-500',
      onClick: () => {
        onAddToWatchlist();
        setIsExpanded(false);
      },
      shortcut: 'W',
    },
    {
      id: 'alert',
      label: 'Set Price Alert',
      icon: AlertBell,
      color: 'bg-orange-600',
      hoverColor: 'hover:bg-orange-500',
      onClick: () => {
        onSetPriceAlert();
        setIsExpanded(false);
      },
      shortcut: 'A',
    },
    {
      id: 'screenshot',
      label: 'Take Screenshot',
      icon: Camera,
      color: 'bg-purple-600',
      hoverColor: 'hover:bg-purple-500',
      onClick: () => {
        onTakeScreenshot();
        setIsExpanded(false);
      },
      shortcut: 'C',
    },
    {
      id: 'share',
      label: 'Share Chart',
      icon: Share2,
      color: 'bg-pink-600',
      hoverColor: 'hover:bg-pink-500',
      onClick: () => {
        onShareChart();
        setIsExpanded(false);
      },
      shortcut: 'H',
    },
  ];

  // Calculate positions for radial menu (circular layout)
  const getActionPosition = (index: number, total: number) => {
    const radius = 120; // Distance from center
    const startAngle = -90; // Start from top
    const angleStep = 180 / (total - 1); // Spread across semicircle (top half)
    const angle = (startAngle + angleStep * index) * (Math.PI / 180);
    
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  };

  return (
    <>
      {/* Backdrop when expanded */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-in fade-in duration-200"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Quick Actions Container */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* Radial Menu Items */}
        {isExpanded && (
          <div className="absolute bottom-0 right-0">
            {actions.map((action, index) => {
              const Icon = action.icon;
              const position = getActionPosition(index, actions.length);
              
              return (
                <button
                  key={action.id}
                  onClick={action.onClick}
                  className={`
                    absolute p-4 ${action.color} ${action.hoverColor} 
                    text-white rounded-full shadow-2xl
                    transition-all duration-300 ease-out
                    hover:scale-110 group
                    animate-in zoom-in duration-300
                  `}
                  style={{
                    bottom: `${60 - position.y}px`,
                    right: `${60 - position.x}px`,
                    animationDelay: `${index * 50}ms`,
                  }}
                  title={`${action.label} ${action.shortcut ? `(${action.shortcut})` : ''}`}
                  aria-label={action.label}
                >
                  <Icon className="w-5 h-5" />
                  
                  {/* Tooltip */}
                  <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {action.label}
                    {action.shortcut && (
                      <kbd className="ml-2 px-1.5 py-0.5 bg-slate-800 rounded text-[10px]">
                        Q+{action.shortcut}
                      </kbd>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Main FAB Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            relative p-4 bg-gradient-to-r from-blue-600 to-purple-600 
            hover:from-blue-500 hover:to-purple-500 
            text-white rounded-full shadow-2xl
            transition-all duration-300 group
            ${isExpanded ? 'rotate-45 scale-110' : 'hover:scale-110'}
          `}
          title={isExpanded ? 'Close Quick Actions (Q)' : 'Quick Actions (Q)'}
          aria-label={isExpanded ? 'Close quick actions menu' : 'Open quick actions menu'}
          aria-expanded={isExpanded ? "true" : "false"}
        >
          {isExpanded ? (
            <X className="w-6 h-6" />
          ) : (
            <Zap className="w-6 h-6" />
          )}
          
          {/* Pulse Ring */}
          {!isExpanded && (
            <span className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-75" />
          )}
          
          {/* Keyboard Hint (only when closed) */}
          {!isExpanded && (
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Press <kbd className="px-1 bg-slate-800 rounded">Q</kbd>
            </span>
          )}
        </button>

        {/* Current Symbol Badge (when expanded) */}
        {isExpanded && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900 text-white text-xs rounded-lg shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200 whitespace-nowrap">
            <span className="text-slate-400">Quick Actions for</span>
            <span className="ml-1 font-bold text-blue-400">{currentSymbol}</span>
          </div>
        )}
      </div>
    </>
  );
}

