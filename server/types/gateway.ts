
// Gateway Agent Type Definitions

export interface PriceData {
  symbol: string;
  price: number;
  confidence: number; // 0-100
  sources: string[];
  deviation: number; // % variance between sources
  timestamp: Date;
}

export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  exchange: string;
}

export interface ExchangeHealth {
  exchange: string;
  healthy: boolean;
  latency: number; // ms
  rateUsage: number; // 0-1
  lastError?: string;
  lastErrorTime?: Date;
  consecutiveFailures: number;
}

export interface GatewayHealth {
  status: 'healthy' | 'degraded' | 'down';
  exchanges: Record<string, ExchangeHealth>;
  cache: {
    hitRate: number;
    entries: number;
  };
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface RateLimitConfig {
  exchange: string;
  maxRequests: number; // per minute
  currentUsage: number;
  resetTime: number;
}

export interface TokenBucket {
  tokens: number;
  capacity: number;
  refillRate: number; // tokens per second
  lastRefill: number;
}

export type RequestPriority = 'high' | 'normal' | 'low';

export interface QueuedRequest {
  id: string;
  exchange: string;
  priority: RequestPriority;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

export interface GatewayConfig {
  exchanges: {
    primary: string[];
    backup: string[];
    fallback: string[];
  };
  cache: {
    price_ttl: number;
    ohlcv_ttl: number;
    exchange_status_ttl: number;
    gas_ttl: number;
    liquidity_ttl: number;
  };
  rateLimit: Record<string, number>;
}
