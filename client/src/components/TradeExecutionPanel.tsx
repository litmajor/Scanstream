import { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Send, 
  AlertCircle,
  DollarSign,
  Percent,
  Lock
} from 'lucide-react';

interface TradeExecutionPanelProps {
  symbol: string;
  currentPrice: number;
  onExecuteTrade?: (trade: TradeOrder) => void;
  availableCash?: number;
  maxLeverage?: number;
}

export interface TradeOrder {
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  entryPrice: number;
  positionSize: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage?: number;
  totalValue: number;
  risk: number;
  riskReward?: number;
}

export default function TradeExecutionPanel({
  symbol,
  currentPrice,
  onExecuteTrade,
  availableCash = 10000,
  maxLeverage = 1,
}: TradeExecutionPanelProps) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [entryPrice, setEntryPrice] = useState(currentPrice.toString());
  const [positionSize, setPositionSize] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [leverage, setLeverage] = useState('1');
  const [errors, setErrors] = useState<string[]>([]);

  // Calculate derived values
  const calculations = useMemo(() => {
    const entry = parseFloat(entryPrice) || 0;
    const size = parseFloat(positionSize) || 0;
    const sl = parseFloat(stopLoss) || 0;
    const tp = parseFloat(takeProfit) || 0;
    const lev = parseFloat(leverage) || 1;

    const totalValue = entry * size * lev;
    const requiredMargin = totalValue / lev;
    
    let risk = 0;
    let riskReward = undefined;
    
    if (side === 'buy') {
      if (sl > 0 && sl < entry) {
        risk = (entry - sl) * size;
        if (tp > entry) {
          const reward = (tp - entry) * size;
          riskReward = reward / risk;
        }
      }
    } else {
      if (sl > 0 && sl > entry) {
        risk = (sl - entry) * size;
        if (tp < entry) {
          const reward = (entry - tp) * size;
          riskReward = reward / risk;
        }
      }
    }

    return {
      totalValue,
      requiredMargin,
      risk,
      riskReward,
      percentOfPortfolio: (requiredMargin / availableCash) * 100,
    };
  }, [entryPrice, positionSize, stopLoss, takeProfit, leverage, side, availableCash]);

  const validateTrade = (): boolean => {
    const newErrors: string[] = [];

    if (!positionSize || parseFloat(positionSize) <= 0) {
      newErrors.push('Position size must be greater than 0');
    }

    if (!entryPrice || parseFloat(entryPrice) <= 0) {
      newErrors.push('Entry price must be greater than 0');
    }

    if (orderType === 'limit' && parseFloat(entryPrice) === 0) {
      newErrors.push('Limit price must be set for limit orders');
    }

    if (parseFloat(leverage) > maxLeverage) {
      newErrors.push(`Leverage exceeds maximum (${maxLeverage}x)`);
    }

    if (calculations.requiredMargin > availableCash) {
      newErrors.push(`Insufficient margin: ${calculations.requiredMargin.toFixed(2)} needed, ${availableCash.toFixed(2)} available`);
    }

    const entry = parseFloat(entryPrice) || 0;
    const sl = parseFloat(stopLoss) || 0;
    const tp = parseFloat(takeProfit) || 0;

    if (side === 'buy') {
      if (sl > 0 && sl >= entry) {
        newErrors.push('Stop loss must be below entry price for buy orders');
      }
      if (tp > 0 && tp <= entry) {
        newErrors.push('Take profit must be above entry price for buy orders');
      }
    } else {
      if (sl > 0 && sl <= entry) {
        newErrors.push('Stop loss must be above entry price for sell orders');
      }
      if (tp > 0 && tp >= entry) {
        newErrors.push('Take profit must be below entry price for sell orders');
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleExecute = () => {
    if (!validateTrade()) return;

    const trade: TradeOrder = {
      symbol,
      side,
      orderType,
      entryPrice: parseFloat(entryPrice),
      positionSize: parseFloat(positionSize),
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
      leverage: parseFloat(leverage),
      totalValue: calculations.totalValue,
      risk: calculations.risk,
      riskReward: calculations.riskReward,
    };

    onExecuteTrade?.(trade);

    // Reset form
    setPositionSize('');
    setEntryPrice(currentPrice.toString());
    setStopLoss('');
    setTakeProfit('');
    setLeverage('1');
    setErrors([]);
  };

  const isValidTrade = !errors.length && parseFloat(positionSize) > 0 && parseFloat(entryPrice) > 0;

  return (
    <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 rounded-lg border border-slate-700/50 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Send className="w-4 h-4 text-blue-400" />
          <span>Trade Execution</span>
        </h3>
        <span className="text-xs text-slate-400">{symbol}</span>
      </div>

      {/* Side Selection */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setSide('buy')}
          className={`py-2 rounded-lg font-semibold transition-all flex items-center justify-center space-x-1 ${
            side === 'buy'
              ? 'bg-green-600/80 text-white shadow-lg'
              : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Buy</span>
        </button>
        <button
          onClick={() => setSide('sell')}
          className={`py-2 rounded-lg font-semibold transition-all flex items-center justify-center space-x-1 ${
            side === 'sell'
              ? 'bg-red-600/80 text-white shadow-lg'
              : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>Sell</span>
        </button>
      </div>

      {/* Order Type */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setOrderType('market')}
          className={`py-1.5 rounded text-sm font-medium transition-colors ${
            orderType === 'market'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Market
        </button>
        <button
          onClick={() => setOrderType('limit')}
          className={`py-1.5 rounded text-sm font-medium transition-colors ${
            orderType === 'limit'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Limit
        </button>
      </div>

      {/* Entry Price */}
      <div>
        <label className="text-xs text-slate-400 font-medium mb-1 block">
          Entry Price
        </label>
        <input
          type="number"
          value={entryPrice}
          onChange={(e) => setEntryPrice(e.target.value)}
          step="0.00000001"
          className="w-full bg-slate-700/50 border border-slate-600/50 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
          placeholder="0.00"
        />
        <div className="text-xs text-slate-500 mt-1">
          Current: ${currentPrice.toFixed(8)}
        </div>
      </div>

      {/* Position Size */}
      <div>
        <label className="text-xs text-slate-400 font-medium mb-1 block">
          Position Size
        </label>
        <input
          type="number"
          value={positionSize}
          onChange={(e) => setPositionSize(e.target.value)}
          step="0.00000001"
          className="w-full bg-slate-700/50 border border-slate-600/50 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
          placeholder="0.00"
        />
      </div>

      {/* Leverage */}
      {maxLeverage > 1 && (
        <div>
          <label className="text-xs text-slate-400 font-medium mb-1 flex items-center space-x-1">
            <Lock className="w-3 h-3" />
            <span>Leverage</span>
          </label>
          <div className="grid grid-cols-4 gap-1">
            {[1, 2, 5, 10].map((lev) => (
              <button
                key={lev}
                onClick={() => setLeverage(lev.toString())}
                disabled={lev > maxLeverage}
                className={`py-1 rounded text-xs font-medium transition-colors ${
                  parseFloat(leverage) === lev
                    ? 'bg-blue-600 text-white'
                    : lev > maxLeverage
                    ? 'bg-slate-700/30 text-slate-500 cursor-not-allowed'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {lev}x
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stop Loss */}
      <div>
        <label className="text-xs text-slate-400 font-medium mb-1 block">
          Stop Loss (Optional)
        </label>
        <input
          type="number"
          value={stopLoss}
          onChange={(e) => setStopLoss(e.target.value)}
          step="0.00000001"
          className="w-full bg-slate-700/50 border border-slate-600/50 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
          placeholder="0.00"
        />
      </div>

      {/* Take Profit */}
      <div>
        <label className="text-xs text-slate-400 font-medium mb-1 block">
          Take Profit (Optional)
        </label>
        <input
          type="number"
          value={takeProfit}
          onChange={(e) => setTakeProfit(e.target.value)}
          step="0.00000001"
          className="w-full bg-slate-700/50 border border-slate-600/50 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
          placeholder="0.00"
        />
      </div>

      {/* Calculations Display */}
      <div className="bg-slate-900/50 rounded-lg p-3 space-y-2 border border-slate-700/30">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">Total Value</span>
          <span className="text-sm font-semibold text-white">
            ${calculations.totalValue.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">Required Margin</span>
          <span className="text-sm font-semibold text-white">
            ${calculations.requiredMargin.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">% of Portfolio</span>
          <span className={`text-sm font-semibold ${
            calculations.percentOfPortfolio > 100
              ? 'text-red-400'
              : calculations.percentOfPortfolio > 50
              ? 'text-yellow-400'
              : 'text-green-400'
          }`}>
            {calculations.percentOfPortfolio.toFixed(1)}%
          </span>
        </div>
        {calculations.risk > 0 && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Risk Amount</span>
              <span className="text-sm font-semibold text-red-400">
                ${calculations.risk.toFixed(2)}
              </span>
            </div>
            {calculations.riskReward && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Risk/Reward Ratio</span>
                <span className={`text-sm font-semibold ${
                  calculations.riskReward >= 2
                    ? 'text-green-400'
                    : calculations.riskReward >= 1
                    ? 'text-yellow-400'
                    : 'text-red-400'
                }`}>
                  1:{calculations.riskReward.toFixed(2)}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 space-y-1">
          {errors.map((error, idx) => (
            <div key={idx} className="flex items-start space-x-2">
              <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          ))}
        </div>
      )}

      {/* Execute Button */}
      <button
        onClick={handleExecute}
        disabled={!isValidTrade}
        className={`w-full py-3 rounded-lg font-bold transition-all flex items-center justify-center space-x-2 ${
          isValidTrade
            ? `${
                side === 'buy'
                  ? 'bg-gradient-to-r from-green-600 to-green-500 hover:shadow-lg hover:shadow-green-500/20'
                  : 'bg-gradient-to-r from-red-600 to-red-500 hover:shadow-lg hover:shadow-red-500/20'
              } text-white cursor-pointer`
            : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
        }`}
      >
        <Send className="w-4 h-4" />
        <span>Execute {side === 'buy' ? 'Buy' : 'Sell'} Order</span>
      </button>
    </div>
  );
}
