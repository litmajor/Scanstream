/**
 * Scanner Service
 * 
 * API client wrapper for multi-exchange scanner endpoints
 * Provides type-safe methods for all scanner operations
 */

import axios, { AxiosInstance } from 'axios';

const API_BASE = '/api/scanner';

export interface ScanOptions {
  timeframe?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  limit?: number;
  minVolume?: number;
  topN?: number;
}

export interface ScanRequest {
  symbols: string[];
  exchanges?: string[];
  options?: ScanOptions;
}

export interface ScanResult {
  symbol: string;
  exchange: string;
  signal: string;
  strength: number;
  confidence: number;
  compositeScore?: number;
  armSignal?: string;
  armConfidence?: number;
  marketState?: string;
  price: number;
  volume24h: number;
  change24h?: number;
}

export interface CrossExchangeSignal {
  symbol: string;
  type: 'CONSENSUS' | 'DIVERGENCE' | 'ARBITRAGE' | 'ACCUMULATION' | 'DISTRIBUTION';
  confidence: number;
  exchanges: string[];
  description?: string;
  avgCompositeScore?: number;
}

export interface MultiExchangeScanResponse {
  success: boolean;
  sessionId: string;
  timestamp: string;
  totalResults: number;
  exchanges: Array<{
    exchange: string;
    scanned: number;
    success: number;
    avgConfidence: number;
    topAssets: ScanResult[];
  }>;
  crossExchangeSignals: CrossExchangeSignal[];
  topAssets: ScanResult[];
  signalSummary: {
    total: number;
    strongBuy: number;
    buy: number;
    neutral: number;
    sell: number;
    strongSell: number;
  };
}

export interface SignalStats {
  totalScans: number;
  avgConfidence: number;
  signalCounts: Record<string, number>;
  topExchange: string;
  trend: 'bullish' | 'bearish' | 'neutral';
}

export interface SignalStatsResponse {
  success: boolean;
  symbol: string;
  period: string;
  stats: SignalStats;
}

export interface HistoryResult {
  id: string;
  symbol: string;
  exchange: string;
  signal: string;
  confidence: number;
  compositeScore: number;
  timestamp: number;
  price: number;
  volume24h: number;
}

export interface HistoryResponse {
  success: boolean;
  symbol: string;
  exchange: string;
  period: string;
  history: HistoryResult[];
}

export interface CrossExchangeHistoryResponse {
  success: boolean;
  symbol: string;
  period: string;
  signals: CrossExchangeSignal[];
}

export interface TopPerformer {
  symbol: string;
  avgScore: number;
  scanCount: number;
}

export interface TopPerformersResponse {
  success: boolean;
  period: string;
  limit: number;
  performers: TopPerformer[];
}

export interface ScannerConfig {
  defaults: {
    timeframe: string;
    limit: number;
    minVolume: number;
    topN: number;
  };
  timeframes: string[];
  signals: string[];
  regimes: string[];
  crossExchangeSignalTypes: string[];
  availableExchanges: string[];
}

export interface ConfigResponse {
  success: boolean;
  [key: string]: any;
}

export class ScannerService {
  private api: AxiosInstance;

  constructor(baseURL: string = API_BASE) {
    this.api = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      response => response,
      error => {
        console.error('[ScannerService] API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Scan multiple exchanges in parallel
   */
  async multiExchangeScan(request: ScanRequest): Promise<MultiExchangeScanResponse> {
    const { data } = await this.api.post<MultiExchangeScanResponse>(
      '/multi-exchange-scan',
      request
    );
    return data;
  }

  /**
   * Get signal statistics for a symbol
   */
  async getSymbolStats(
    symbol: string,
    days: number = 7
  ): Promise<SignalStatsResponse> {
    const { data } = await this.api.get<SignalStatsResponse>(
      `/symbol/${encodeURIComponent(symbol)}/stats?days=${days}`
    );
    return data;
  }

  /**
   * Get recent scan history for a symbol
   */
  async getSymbolHistory(
    symbol: string,
    exchange?: string,
    hours: number = 24
  ): Promise<HistoryResponse> {
    const params = new URLSearchParams();
    if (exchange) params.append('exchange', exchange);
    params.append('hours', hours.toString());

    const { data } = await this.api.get<HistoryResponse>(
      `/symbol/${encodeURIComponent(symbol)}/history?${params.toString()}`
    );
    return data;
  }

  /**
   * Get cross-exchange signal history for a symbol
   */
  async getCrossExchangeSignals(
    symbol: string,
    days: number = 7
  ): Promise<CrossExchangeHistoryResponse> {
    const { data } = await this.api.get<CrossExchangeHistoryResponse>(
      `/symbol/${encodeURIComponent(symbol)}/cross-exchange?days=${days}`
    );
    return data;
  }

  /**
   * Get top performing symbols
   */
  async getTopPerformers(
    days: number = 7,
    limit: number = 10
  ): Promise<TopPerformersResponse> {
    const { data } = await this.api.get<TopPerformersResponse>(
      `/top-performers?days=${days}&limit=${limit}`
    );
    return data;
  }

  /**
   * Get scanner configuration
   */
  async getConfig(): Promise<ConfigResponse> {
    const { data } = await this.api.get<ConfigResponse>('/config');
    return data;
  }

  /**
   * Quick scan with default settings
   */
  async quickScan(symbols: string[], exchange?: string): Promise<any> {
    const { data } = await this.api.post('/quick-scan', {
      symbols,
      ...(exchange && { exchange })
    });
    return data;
  }

  /**
   * Get scanner signals (basic)
   */
  async getSignals(): Promise<any> {
    const { data } = await this.api.get('/signals');
    return data;
  }

  /**
   * Run a single exchange scan
   */
  async scan(
    symbols: string,
    timeframe: string = '1h'
  ): Promise<any> {
    const { data } = await this.api.get(
      `/scan?symbols=${encodeURIComponent(symbols)}&timeframe=${timeframe}`
    );
    return data;
  }
}

// Export singleton instance
export const scannerService = new ScannerService();

export default scannerService;
