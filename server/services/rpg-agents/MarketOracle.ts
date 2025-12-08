
/**
 * Market Oracle - Central Intelligence Hub
 * 
 * Distributes preprocessed market data to all agents:
 * - Python strategies (via API)
 * - TypeScript RL agent
 * - RPG agents
 * 
 * Features:
 * - Data normalization
 * - Multi-timeframe aggregation
 * - Regime detection
 * - Feature extraction
 */

interface MarketSnapshot {
  symbol: string;
  timestamp: number;
  
  // Price data
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  
  // Technical indicators
  rsi: number;
  macd: { macd: number; signal: number; histogram: number };
  ema20: number;
  ema50: number;
  ema200: number;
  adx: number;
  atr: number;
  
  // Support/Resistance
  support: number;
  resistance: number;
  
  // Volume analysis
  avg_volume: number;
  volume_ratio: number;
  
  // Regime
  regime: string;
  
  // ML predictions (if available)
  ml_prediction?: {
    direction: string;
    probability: number;
    ensemble_confidence: number;
    pattern_similarity: number;
    predicted_price: number;
  };
  
  // Asset velocity (for targets)
  expected_7d_move?: number;
  
  // Historical data for pattern detection
  price_history?: number[];
  rsi_history?: number[];
  
  // Bounce quality (for support trades)
  bounce_quality?: number;
}

export class MarketOracle {
  private marketData: Map<string, MarketSnapshot> = new Map();
  private subscribers: Array<(data: MarketSnapshot) => void> = [];
  
  /**
   * Update market data for a symbol
   */
  updateMarketData(symbol: string, data: Partial<MarketSnapshot>): void {
    const existing = this.marketData.get(symbol) || {} as MarketSnapshot;
    
    const updated: MarketSnapshot = {
      ...existing,
      ...data,
      symbol,
      timestamp: Date.now()
    };
    
    this.marketData.set(symbol, updated);
    
    // Notify subscribers
    this.notifySubscribers(updated);
  }
  
  /**
   * Get current market data for a symbol
   */
  getMarketData(symbol: string): MarketSnapshot | null {
    return this.marketData.get(symbol) || null;
  }
  
  /**
   * Subscribe to market data updates
   */
  subscribe(callback: (data: MarketSnapshot) => void): void {
    this.subscribers.push(callback);
  }
  
  /**
   * Unsubscribe from updates
   */
  unsubscribe(callback: (data: MarketSnapshot) => void): void {
    const index = this.subscribers.indexOf(callback);
    if (index > -1) {
      this.subscribers.splice(index, 1);
    }
  }
  
  private notifySubscribers(data: MarketSnapshot): void {
    this.subscribers.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('[Market Oracle] Subscriber error:', error);
      }
    });
  }
  
  /**
   * Get data formatted for Python strategies
   */
  getDataForPythonStrategy(symbol: string): any {
    const data = this.getMarketData(symbol);
    if (!data) return null;
    
    return {
      symbol: data.symbol,
      timestamp: data.timestamp,
      price: {
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.price
      },
      volume: data.volume,
      indicators: {
        rsi: data.rsi,
        macd: data.macd,
        ema20: data.ema20,
        ema50: data.ema50,
        ema200: data.ema200,
        adx: data.adx,
        atr: data.atr
      },
      support: data.support,
      resistance: data.resistance,
      regime: data.regime
    };
  }
}

export const marketOracle = new MarketOracle();
