// Core trading types
export interface Trade {
  id: string;
  symbol: string;
  side?: string; // 'BUY' | 'SELL'
  signalId?: string | null;
  entryTime?: Date | string; // For newer code
  entryPrice: number;
  quantity: number;
  exitTime?: Date | string | null; // For newer code
  exitPrice?: number | null;
  commission?: number;
  pnl?: number;
  pnlPercent?: number;
  status?: 'OPEN' | 'CLOSED' | 'PENDING' | 'CANCELLED';
  timestamp?: Date; // Legacy
  exitTimestamp?: Date; // Legacy
}

export interface BacktestMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL?: number;
  totalPnLPct?: number;
  totalReturn?: number; // Alternative to totalPnL
  totalReturnPercent?: number;
  avgReturn?: number;
  avgWin: number;
  avgLoss: number;
  avgWinPercent?: number;
  avgLossPercent?: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  consistency?: number;
  avgHoldingBars?: number;
}

export interface BacktestResult {
  asset: string;
  metrics: BacktestMetrics;
  trades: Trade[];
  diagnostics: {
    totalTrades: number;
    successRate: number;
    averageProfit: number;
  };
}
