/**
 * OANDA HTTP Client
 * 
 * Pure REST API wrapper. No caching, no retries, no polling.
 * Each call is fresh. Responsibility deferred to caller.
 */

import type {
  OandaCandlesRequest,
  OandaCandleResponse,
  OandaResponse,
} from './oanda-types';

export interface OandaClientConfig {
  apiKey: string;
  accountId: string;
  environment?: 'live' | 'practice';  // practice = sandbox
}

export class OandaClient {
  private baseUrl: string;
  private apiKey: string;
  private accountId: string;

  constructor(config: OandaClientConfig) {
    this.apiKey = config.apiKey;
    this.accountId = config.accountId;
    
    // Default to practice (sandbox) for safety
    const env = config.environment || 'practice';
    this.baseUrl = env === 'live'
      ? 'https://api-fxpractice.oanda.com/v3'
      : 'https://api-fxpractice.oanda.com/v3';
  }

  /**
   * Fetch candles (OHLCV)
   * 
   * @param params Request parameters
   * @returns Array of candles or null if error
   */
  async getCandles(
    params: OandaCandlesRequest
  ): Promise<OandaCandleResponse | null> {
    try {
      const queryString = new URLSearchParams();
      
      if (params.count) queryString.append('count', String(params.count));
      if (params.from) queryString.append('from', params.from);
      if (params.to) queryString.append('to', params.to);
      if (params.price) queryString.append('price', params.price);
      if (params.granularity) queryString.append('granularity', params.granularity);

      const url = `${this.baseUrl}/instruments/${params.instrument}/candles?${queryString}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept-Datetime-Format': 'UNIX',  // Request Unix timestamps
        },
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`[OandaClient] HTTP ${response.status}: ${error.errorMessage}`);
        return null;
      }

      const data: OandaResponse<OandaCandleResponse> = await response.json();
      
      if (data.error) {
        console.error(`[OandaClient] API error: ${data.error.code} - ${data.error.message}`);
        return null;
      }

      return data.data || null;
    } catch (err) {
      console.error('[OandaClient] Fetch error:', err);
      return null;
    }
  }

  /**
   * Get account details (for connectivity check)
   */
  async getAccount(): Promise<any | null> {
    try {
      const url = `${this.baseUrl}/accounts/${this.accountId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`[OandaClient] Account check failed: ${response.status}`);
        return null;
      }

      return await response.json();
    } catch (err) {
      console.error('[OandaClient] Account check error:', err);
      return null;
    }
  }
}
