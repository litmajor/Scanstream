import { MarketFrame, Signal, Trade } from "@shared/schema";
import { EnhancedPortfolioSimulator } from "./portfolio-simulator";

export interface BacktestOptions {
  initialCapital?: number;
  signals: Signal[];
  marketFrames: MarketFrame[];
  slippage?: number; // percent, e.g. 0.001 for 0.1%
  commission?: number; // per trade
  positionSize?: number; // USD or asset units
}

export interface BacktestResult {
  portfolio: EnhancedPortfolioSimulator;
  trades: Trade[];
  metrics: ReturnType<EnhancedPortfolioSimulator["getPerformanceMetrics"]>;
}

export async function runBacktest(options: BacktestOptions): Promise<BacktestResult> {
  const config = (await import('../config/trading-config.json', { assert: { type: 'json' } })).default;
  const {
    initialCapital = config.initialCapital,
    signals,
    marketFrames,
    slippage = config.slippageRate,
    commission = config.commissionRate,
    positionSize = config.positionSize * config.initialCapital
  } = options;

  const sim = new EnhancedPortfolioSimulator({ initialCapital });
  const frameMap = new Map<string, MarketFrame[]>();
  for (const frame of marketFrames) {
    if (!frameMap.has(frame.symbol)) frameMap.set(frame.symbol, []);
    frameMap.get(frame.symbol)!.push(frame);
  }

  for (const signal of signals) {
    // Find the next market frame after the signal timestamp
    const frames = frameMap.get(signal.symbol) || [];
    const entryFrame = frames.find(f => new Date(f.timestamp).getTime() >= new Date(signal.timestamp).getTime());
    if (!entryFrame) continue;
    const price = entryFrame.price as { open: number; high: number; low: number; close: number };
    const entryPrice = price.close * (1 + (signal.type === 'BUY' ? slippage : -slippage));
    const quantity = positionSize / entryPrice;
    const trade: Trade = {
      id: `${signal.symbol}-${signal.timestamp}`,
      symbol: signal.symbol,
      side: signal.type,
      entryTime: new Date(entryFrame.timestamp),
      entryPrice,
      quantity,
      commission,
      status: 'OPEN',
      exitTime: null,
      exitPrice: null,
      pnl: null,
    };
    sim.openPosition(trade);

    // Find exit: stop loss, take profit, or next opposite signal
    let exitFrame: MarketFrame | undefined;
    for (const f of frames) {
      if (new Date(f.timestamp).getTime() <= new Date(entryFrame.timestamp).getTime()) continue;
      const fPrice = f.price as { open: number; high: number; low: number; close: number };
      if (signal.type === 'BUY') {
        if (fPrice.low <= signal.stopLoss) { exitFrame = f; break; }
        if (fPrice.high >= signal.takeProfit) { exitFrame = f; break; }
      } else if (signal.type === 'SELL') {
        if (fPrice.high >= signal.stopLoss) { exitFrame = f; break; }
        if (fPrice.low <= signal.takeProfit) { exitFrame = f; break; }
      }
    }
    if (!exitFrame) exitFrame = frames[frames.length - 1];
    const exitPrice = (exitFrame.price as { close: number }).close * (1 - (signal.type === 'BUY' ? slippage : -slippage));
    sim.closePosition(signal.symbol, exitPrice, new Date(exitFrame.timestamp));
  }

  return {
    portfolio: sim,
    trades: sim.getClosedTrades(),
    metrics: sim.getPerformanceMetrics(),
  };
}
