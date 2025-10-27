import { useState, useEffect } from 'react';
import { Activity, Wifi, WifiOff, Clock, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

interface MarketStatusBarProps {
  isConnected: boolean;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  volume24h: number;
  portfolioValue: number;
  dayChangePercent: number;
  exchangeStatus?: {
    isOperational: boolean;
    latency: number;
  };
}

interface TickerItem {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

export default function MarketStatusBar({
  isConnected,
  currentPrice,
  priceChange,
  priceChangePercent,
  volume24h,
  portfolioValue,
  dayChangePercent,
  exchangeStatus,
}: MarketStatusBarProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [marketStatus, setMarketStatus] = useState<'open' | 'closed'>('closed');
  const [timeUntilChange, setTimeUntilChange] = useState('');

  // Ticker data (in production, this would come from WebSocket/API)
  const [tickerData] = useState<TickerItem[]>([
    { symbol: 'BTC', price: currentPrice, change: priceChange, changePercent: priceChangePercent },
    { symbol: 'ETH', price: 2480, change: 15.30, changePercent: 0.62 },
    { symbol: 'BNB', price: 312.50, change: -2.10, changePercent: -0.67 },
    { symbol: 'SOL', price: 98.75, change: 3.25, changePercent: 3.40 },
    { symbol: 'XRP', price: 0.52, change: 0.01, changePercent: 1.96 },
  ]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Determine market status (crypto markets are 24/7, but we'll simulate for demo)
  useEffect(() => {
    const hour = currentTime.getHours();
    // Simulate market closed between 2 AM - 3 AM UTC for demo
    const isClosed = hour >= 2 && hour < 3;
    setMarketStatus(isClosed ? 'closed' : 'open');

    // Calculate time until market change
    if (isClosed) {
      const minutesUntilOpen = (3 - hour) * 60 - currentTime.getMinutes();
      setTimeUntilChange(`Opens in ${minutesUntilOpen}m`);
    } else {
      const minutesUntilClose = ((26 - hour) % 24) * 60 - currentTime.getMinutes();
      if (minutesUntilClose < 120) {
        setTimeUntilChange(`Closes in ${minutesUntilClose}m`);
      } else {
        setTimeUntilChange('');
      }
    }
  }, [currentTime]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatCompactNumber = (value: number) => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
    return value.toFixed(2);
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs">
        {/* Left Section: Market Status & Time */}
        <div className="flex items-center space-x-4">
          {/* Market Status */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div className="relative">
              <div
                className={`w-2 h-2 rounded-full ${
                  marketStatus === 'open' ? 'bg-green-400' : 'bg-red-400'
                }`}
              />
              {marketStatus === 'open' && (
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-400 animate-ping opacity-75" />
              )}
            </div>
            <span className="text-slate-400 font-medium">Market</span>
            <span
              className={`font-bold ${
                marketStatus === 'open' ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {marketStatus.toUpperCase()}
            </span>
            {timeUntilChange && (
              <span className="text-slate-500">• {timeUntilChange}</span>
            )}
          </div>

          {/* Global Time */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <Clock className="w-3 h-3 text-slate-400" />
            <span className="text-slate-400">UTC</span>
            <span className="text-white font-mono font-semibold">
              {currentTime.toLocaleTimeString('en-US', { 
                timeZone: 'UTC', 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                hour12: false 
              })}
            </span>
          </div>

          {/* Network Status */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
            {isConnected ? (
              <>
                <Wifi className="w-3 h-3 text-green-400" />
                <span className="text-green-400 font-medium">Connected</span>
                {exchangeStatus && (
                  <span className="text-slate-500">
                    • {exchangeStatus.latency}ms
                  </span>
                )}
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-red-400" />
                <span className="text-red-400 font-medium">Disconnected</span>
              </>
            )}
          </div>

          {/* API Health */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <Activity className="w-3 h-3 text-blue-400" />
            <span className="text-slate-400">API</span>
            <span className={`font-medium ${
              exchangeStatus?.isOperational ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {exchangeStatus?.isOperational ? 'Healthy' : 'Degraded'}
            </span>
          </div>
        </div>

        {/* Center Section: Scrolling Ticker */}
        <div className="flex-1 mx-4 overflow-hidden">
          <div className="flex items-center space-x-6 animate-marquee whitespace-nowrap">
            {tickerData.map((ticker) => (
              <div
                key={ticker.symbol}
                className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800/30 rounded-lg border border-slate-700/30"
              >
                <span className="text-slate-400 font-semibold">{ticker.symbol}</span>
                <span className="text-white font-mono font-bold">
                  {ticker.symbol === 'BTC' ? formatCurrency(ticker.price) : 
                   ticker.price >= 1 ? `$${ticker.price.toFixed(2)}` : 
                   `$${ticker.price.toFixed(4)}`}
                </span>
                <div className="flex items-center space-x-1">
                  {ticker.change >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-400" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-400" />
                  )}
                  <span
                    className={`font-mono font-medium ${
                      ticker.change >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {ticker.changePercent >= 0 ? '+' : ''}
                    {ticker.changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
            {/* Duplicate for seamless loop */}
            {tickerData.map((ticker) => (
              <div
                key={`${ticker.symbol}-dup`}
                className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800/30 rounded-lg border border-slate-700/30"
              >
                <span className="text-slate-400 font-semibold">{ticker.symbol}</span>
                <span className="text-white font-mono font-bold">
                  {ticker.symbol === 'BTC' ? formatCurrency(ticker.price) : 
                   ticker.price >= 1 ? `$${ticker.price.toFixed(2)}` : 
                   `$${ticker.price.toFixed(4)}`}
                </span>
                <div className="flex items-center space-x-1">
                  {ticker.change >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-400" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-400" />
                  )}
                  <span
                    className={`font-mono font-medium ${
                      ticker.change >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {ticker.changePercent >= 0 ? '+' : ''}
                    {ticker.changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Section: Account Balance */}
        <div className="flex items-center space-x-4">
          {/* 24h Volume */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <span className="text-slate-400">24h Vol</span>
            <span className="text-blue-400 font-mono font-bold">
              ${formatCompactNumber(volume24h * 1e9)}
            </span>
          </div>

          {/* Portfolio Value */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg border border-blue-500/50">
            <DollarSign className="w-3 h-3 text-blue-400" />
            <span className="text-slate-300 font-medium">Portfolio</span>
            <span className="text-white font-mono font-bold">
              {formatCurrency(portfolioValue)}
            </span>
            <span
              className={`font-mono font-bold ${
                dayChangePercent >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {dayChangePercent >= 0 ? '+' : ''}
              {dayChangePercent.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .animate-marquee {
          animation: marquee 30s linear infinite;
        }

        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

