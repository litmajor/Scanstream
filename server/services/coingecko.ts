/**
 * CoinGecko API Integration Service
 * Provides market data, sentiment, and trending coins
 * 
 * Rate Limits (Free Tier):
 * - 10-30 requests/minute per IP
 * - Use caching to minimize API calls
 * 
 * Attribution Required:
 * - Must display "Data provided by CoinGecko" in UI
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE = 'https://api.coingecko.com/api/v3';
const CACHE_DURATION_MS = 180000; // 3 minutes default cache
const SENTIMENT_CACHE_MS = 900000; // 15 minutes for sentiment (Fear & Greed Index)
const MARKET_DATA_CACHE_MS = 600000; // 10 minutes for market data

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class CoinGeckoService {
  private client: AxiosInstance;
  private cache: Map<string, CacheEntry<any>>;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      timeout: 10000,
      headers: {
        'Accept': 'application/json'
      }
    });
    this.cache = new Map();
    
    console.log('✅ CoinGecko service initialized');
  }

  /**
   * Retry with exponential backoff for rate limit errors
   */
  private async retryWithBackoff<T>(
    fetcher: () => Promise<T>,
    maxRetries = 3,
    initialDelay = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fetcher();
      } catch (error) {
        lastError = error;
        
        // Check if it's a rate limit error (429)
        if (axios.isAxiosError(error) && error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          const delay = retryAfter 
            ? parseInt(retryAfter) * 1000 
            : initialDelay * Math.pow(2, attempt);
          
          console.warn(`[CoinGecko] Rate limited (429). Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
          
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // For other errors, throw immediately
        throw error;
      }
    }
    
    throw lastError;
  }

  /**
   * Get cached data or fetch fresh data
   */
  private async getCached<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttl: number = CACHE_DURATION_MS
  ): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < ttl) {
      console.log(`[CoinGecko] Cache hit: ${key}`);
      return cached.data as T;
    }

    console.log(`[CoinGecko] Cache miss, fetching: ${key}`);
    
    try {
      const data = await this.retryWithBackoff(() => fetcher());
      this.cache.set(key, { data, timestamp: now });
      return data;
    } catch (error) {
      // If we have stale cache data and the API is rate limiting, return stale data
      if (cached && axios.isAxiosError(error) && error.response?.status === 429) {
        console.warn(`[CoinGecko] Rate limited, returning stale cache for: ${key}`);
        return cached.data as T;
      }
      throw error;
    }
  }

  /**
   * Get market data for top coins by market cap
   */
  async getMarketData(vsCurrency = 'usd', page = 1, perPage = 100) {
    return this.getCached(
      `markets_${vsCurrency}_${page}_${perPage}`,
      async () => {
        const response = await this.client.get('/coins/markets', {
          params: {
            vs_currency: vsCurrency,
            order: 'market_cap_desc',
            per_page: perPage,
            page,
            sparkline: false,
            price_change_percentage: '24h,7d'
          }
        });
        return response.data;
      }
    );
  }

  /**
   * Get market data for specific coin IDs
   */
  async getMarketDataByIds(coinIds: string, vsCurrency = 'usd') {
    // Don't cache IDs queries as they can be different each time
    const response = await this.client.get('/coins/markets', {
      params: {
        vs_currency: vsCurrency,
        ids: coinIds,
        order: 'market_cap_desc',
        per_page: 250,
        sparkline: false,
        price_change_percentage: '24h,7d'
      }
    });
    return response.data;
  }

  /**
   * Get trending coins (social sentiment)
   */
  async getTrendingCoins() {
    return this.getCached(
      'trending',
      async () => {
        const response = await this.client.get('/search/trending');
        return response.data.coins;
      },
      600000 // 10 minutes cache (trending changes slowly)
    );
  }

  /**
   * Get global market overview
   */
  async getGlobalMarket() {
    return this.getCached(
      'global',
      async () => {
        const response = await this.client.get('/global');
        return response.data.data;
      },
      600000 // 10 minutes cache (global market data changes slowly)
    );
  }

  /**
   * Get OHLC data for a specific coin
   */
  async getOHLC(coinId: string, vsCurrency = 'usd', days = 1) {
    return this.getCached(
      `ohlc_${coinId}_${vsCurrency}_${days}`,
      async () => {
        const response = await this.client.get(`/coins/${coinId}/ohlc`, {
          params: {
            vs_currency: vsCurrency,
            days
          }
        });
        return response.data;
      }
    );
  }

  /**
   * Get detailed coin information
   */
  async getCoinDetails(coinId: string) {
    return this.getCached(
      `coin_${coinId}`,
      async () => {
        const response = await this.client.get(`/coins/${coinId}`, {
          params: {
            localization: false,
            tickers: false,
            community_data: true,
            developer_data: true,
            sparkline: false
          }
        });
        return response.data;
      },
      600000 // 10 minutes cache (coin details change slowly)
    );
  }

  /**
   * Search for coins by query
   */
  async searchCoins(query: string) {
    return this.getCached(
      `search_${query}`,
      async () => {
        const response = await this.client.get('/search', {
          params: { query }
        });
        return response.data;
      }
    );
  }

  /**
   * Map exchange symbol to CoinGecko ID
   * e.g., "BTC/USDT" -> "bitcoin"
   */
  async symbolToCoinId(symbol: string): Promise<string | null> {
    try {
      // Remove trading pairs and normalize
      const baseSymbol = symbol.split('/')[0].toLowerCase();
      
      // Common mappings
      const knownMappings: Record<string, string> = {
        'btc': 'bitcoin',
        'eth': 'ethereum',
        'bnb': 'binancecoin',
        'xrp': 'ripple',
        'ada': 'cardano',
        'doge': 'dogecoin',
        'sol': 'solana',
        'dot': 'polkadot',
        'matic': 'matic-network',
        'link': 'chainlink',
        'avax': 'avalanche-2',
        'uni': 'uniswap',
        'atom': 'cosmos',
        'xlm': 'stellar',
        'ltc': 'litecoin',
        'etc': 'ethereum-classic',
        'bch': 'bitcoin-cash',
        'algo': 'algorand',
        'vet': 'vechain',
        'icp': 'internet-computer',
        'fil': 'filecoin',
        'trx': 'tron',
        'eos': 'eos',
        'aave': 'aave',
        'mkr': 'maker',
        'theta': 'theta-token',
        'xtz': 'tezos',
        'ftm': 'fantom',
        'axs': 'axie-infinity',
        'sand': 'the-sandbox',
        'mana': 'decentraland',
        'gala': 'gala',
        'chz': 'chiliz',
        'enj': 'enjincoin',
        'near': 'near',
        'flow': 'flow',
        'apt': 'aptos',
        'arb': 'arbitrum',
        'op': 'optimism',
        'sui': 'sui'
      };

      if (knownMappings[baseSymbol]) {
        return knownMappings[baseSymbol];
      }

      // Fallback: search CoinGecko
      const searchResults = await this.searchCoins(baseSymbol);
      if (searchResults.coins && searchResults.coins.length > 0) {
        return searchResults.coins[0].id;
      }

      return null;
    } catch (error) {
      console.error(`[CoinGecko] Failed to map symbol ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get sentiment score for a coin (0-100)
   * Based on trending status, social activity, and price action
   */
  async getSentimentScore(symbol: string): Promise<number> {
    try {
      const coinId = await this.symbolToCoinId(symbol);
      if (!coinId) return 50; // Neutral if not found

      // Get trending coins
      const trending = await this.getTrendingCoins();
      const isTrending = trending.some((t: any) => t.item.id === coinId);

      // Get coin details for sentiment data
      const details = await this.getCoinDetails(coinId);
      
      let score = 50; // Start neutral

      // Trending boost (+20)
      if (isTrending) {
        score += 20;
      }

      // Price change sentiment
      const priceChange24h = details.market_data?.price_change_percentage_24h || 0;
      if (priceChange24h > 10) score += 15;
      else if (priceChange24h > 5) score += 10;
      else if (priceChange24h > 0) score += 5;
      else if (priceChange24h < -10) score -= 15;
      else if (priceChange24h < -5) score -= 10;
      else if (priceChange24h < 0) score -= 5;

      // Social/community data
      if (details.community_data) {
        const twitterFollowers = details.community_data.twitter_followers || 0;
        const redditSubscribers = details.community_data.reddit_subscribers || 0;
        
        // Large community = positive sentiment
        if (twitterFollowers > 1000000 || redditSubscribers > 100000) {
          score += 10;
        } else if (twitterFollowers > 500000 || redditSubscribers > 50000) {
          score += 5;
        }
      }

      // Developer activity
      if (details.developer_data) {
        const commits = details.developer_data.commit_count_4_weeks || 0;
        if (commits > 100) score += 5;
      }

      // Clamp between 0-100
      return Math.max(0, Math.min(100, score));
    } catch (error) {
      console.error(`[CoinGecko] Failed to get sentiment for ${symbol}:`, error);
      return 50; // Neutral on error
    }
  }

  /**
   * Get market regime based on global market data
   */
  async getMarketRegime(): Promise<{
    regime: 'bull' | 'bear' | 'neutral' | 'volatile';
    confidence: number;
    btcDominance: number;
    totalMarketCap: number;
    totalVolume: number;
    epistemicState?: string;
    epistemicReasons?: string[];
  }> {
    try {
      const global = await this.getGlobalMarket();
      
      const btcDominance = global.market_cap_percentage?.btc || 0;
      const totalMarketCap = global.total_market_cap?.usd || 0;
      const totalVolume = global.total_volume?.usd || 0;
      const volumeToMcap = totalVolume / totalMarketCap;
      const marketCapChange = Math.abs(global.market_cap_change_percentage_24h_usd || 0);

      // EXPENSIVE-TO-EARN, CHEAP-TO-LOSE CONFIDENCE
      // Start ultra-low: require multiple evidence sources to exceed thresholds
      let regime: 'bull' | 'bear' | 'neutral' | 'volatile' = 'neutral';
      let confidence = 10; // Start VERY LOW
      const epistemicReasons: string[] = [];

      // Component 1: Volume confirmation (0-30 points)
      let volumeConfidence = 0;
      if (volumeToMcap > 0.08) {
        volumeConfidence = 30; // Strong volume confirmation
      } else if (volumeToMcap > 0.06) {
        volumeConfidence = 25;
      } else if (volumeToMcap > 0.04) {
        volumeConfidence = 15;
      } else if (volumeToMcap > 0.02) {
        volumeConfidence = 0; // Below threshold = 0 points (not 5)
        epistemicReasons.push('LOW_VOLUME');
      } else {
        volumeConfidence = 0;
        epistemicReasons.push('INSUFFICIENT_VOLUME');
      }

      // Component 2: Dominance clarity (0-35 points)
      let dominanceConfidence = 0;
      const dominanceDelta = Math.abs(btcDominance - 50); // Distance from neutral
      if (dominanceDelta > 15) {
        dominanceConfidence = 35; // Strong dominance signal
      } else if (dominanceDelta > 10) {
        dominanceConfidence = 28;
      } else if (dominanceDelta > 5) {
        dominanceConfidence = 0; // Weak signal = 0 points (not 18)
        epistemicReasons.push('WEAK_DOMINANCE');
      } else {
        dominanceConfidence = 0; // No signal
        epistemicReasons.push('NEUTRAL_DOMINANCE');
      }

      // Component 3: Volatility context (0-20 points)
      // High volatility = noise = 0 points (not partial credit)
      // Low volatility = clear signal = full credit
      let volatilityConfidence = 0;
      if (marketCapChange < 1) {
        volatilityConfidence = 20; // Calm market = clear trend
      } else if (marketCapChange < 2) {
        volatilityConfidence = 15;
      } else if (marketCapChange < 4) {
        volatilityConfidence = 0; // Chaotic = 0 points (not 10)
        epistemicReasons.push('HIGH_VOLATILITY');
      } else {
        volatilityConfidence = 0; // Very chaotic
        epistemicReasons.push('EXTREME_VOLATILITY');
      }

      // Component 4: Regime clarity (0-15 points)
      // Only award if clear signals exist
      let regimeConfidence = 0;
      if (volumeToMcap > 0.06) {
        regime = 'volatile';
        regimeConfidence = 15; // Clear volatile signal
      } else if (btcDominance > 55) {
        regime = 'bear';
        regimeConfidence = dominanceDelta > 10 ? 15 : 0; // Only if STRONG signal (not 8)
      } else if (btcDominance < 45) {
        regime = 'bull';
        regimeConfidence = dominanceDelta > 10 ? 15 : 0; // Only if STRONG signal (not 8)
      } else {
        regime = 'neutral';
        regimeConfidence = 0; // No clear regime = no bonus
        epistemicReasons.push('NEUTRAL_REGIME');
      }

      // Count strong signals (>0 points)
      const strongSignals = [
        volumeConfidence > 0 ? 1 : 0,
        dominanceConfidence > 0 ? 1 : 0,
        volatilityConfidence > 0 ? 1 : 0,
        regimeConfidence > 0 ? 1 : 0
      ].reduce((a, b) => a + b, 0);

      // Sum all components
      const componentSum = volumeConfidence + dominanceConfidence + volatilityConfidence + regimeConfidence;

      // GATING: Require agreement from multiple sources
      if (strongSignals < 2) {
        // Insufficient evidence = cap at 30
        confidence = Math.min(30, 10 + componentSum * 0.2);
        epistemicReasons.push('INSUFFICIENT_CORROBORATION');
      } else if (strongSignals === 2) {
        // Moderate evidence = cap at 60
        confidence = Math.min(60, 10 + componentSum * 0.4);
      } else {
        // Strong evidence = can reach higher
        confidence = Math.min(100, componentSum);
      }

      // Determine epistemic state
      let epistemicState = 'CONFIDENT';
      if (confidence < 30) {
        epistemicState = 'INSUFFICIENT';
      } else if (confidence < 50) {
        epistemicState = 'UNCERTAIN';
      } else {
        epistemicState = 'CONFIDENT';
      }

      return {
        regime,
        confidence: Math.round(confidence),
        btcDominance,
        totalMarketCap,
        totalVolume,
        epistemicState,
        epistemicReasons: epistemicReasons.length > 0 ? epistemicReasons : ['NORMAL']
      };
    } catch (error) {
      console.error('[CoinGecko] Failed to get market regime:', error);
      return {
        regime: 'neutral',
        confidence: 0, // Low confidence on error, not medium-high
        btcDominance: 0,
        totalMarketCap: 0,
        totalVolume: 0
      };
    }
  }

  /**
   * Get top gainers and losers (24h)
   */
  async getTopMovers(limit = 10) {
    return this.getCached(
      `top_movers_${limit}`,
      async () => {
        const markets = await this.getMarketData('usd', 1, 250);
        
        // Sort by price change percentage
        const sorted = [...markets].sort((a, b) => 
          (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)
        );
        
        const gainers = sorted.slice(0, limit).map(coin => ({
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          price: coin.current_price,
          change24h: coin.price_change_percentage_24h || 0,
          volume: coin.total_volume,
          marketCap: coin.market_cap,
          rank: coin.market_cap_rank
        }));
        
        const losers = sorted.slice(-limit).reverse().map(coin => ({
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          price: coin.current_price,
          change24h: coin.price_change_percentage_24h || 0,
          volume: coin.total_volume,
          marketCap: coin.market_cap,
          rank: coin.market_cap_rank
        }));
        
        return { gainers, losers };
      },
      300000 // 5 minutes cache
    );
  }

  /**
   * Get comprehensive coin data with historical changes
   */
  async getCoinMetrics(coinId: string) {
    return this.getCached(
      `coin_metrics_${coinId}`,
      async () => {
        const details = await this.getCoinDetails(coinId);
        
        return {
          symbol: details.symbol?.toUpperCase(),
          name: details.name,
          currentPrice: details.market_data?.current_price?.usd || 0,
          marketCap: details.market_data?.market_cap?.usd || 0,
          volume24h: details.market_data?.total_volume?.usd || 0,
          circulatingSupply: details.market_data?.circulating_supply || 0,
          totalSupply: details.market_data?.total_supply || 0,
          maxSupply: details.market_data?.max_supply || null,
          ath: details.market_data?.ath?.usd || 0,
          athDate: details.market_data?.ath_date?.usd || null,
          athChangePercentage: details.market_data?.ath_change_percentage?.usd || 0,
          atl: details.market_data?.atl?.usd || 0,
          atlDate: details.market_data?.atl_date?.usd || null,
          atlChangePercentage: details.market_data?.atl_change_percentage?.usd || 0,
          priceChanges: {
            '1h': details.market_data?.price_change_percentage_1h_in_currency?.usd || 0,
            '24h': details.market_data?.price_change_percentage_24h || 0,
            '7d': details.market_data?.price_change_percentage_7d || 0,
            '30d': details.market_data?.price_change_percentage_30d || 0,
            '1y': details.market_data?.price_change_percentage_1y || 0
          },
          roi: details.market_data?.roi || null,
          socialData: {
            twitterFollowers: details.community_data?.twitter_followers || 0,
            redditSubscribers: details.community_data?.reddit_subscribers || 0,
            redditActiveAccounts: details.community_data?.reddit_average_posts_48h || 0,
            telegramUsers: details.community_data?.telegram_channel_user_count || 0
          },
          developerData: {
            githubStars: details.developer_data?.stars || 0,
            githubForks: details.developer_data?.forks || 0,
            commits4Weeks: details.developer_data?.commit_count_4_weeks || 0,
            contributors: details.developer_data?.pull_request_contributors || 0
          }
        };
      },
      600000 // 10 minutes cache
    );
  }

  /**
   * Get derivatives data (futures, perpetuals)
   */
  async getDerivatives() {
    return this.getCached(
      'derivatives',
      async () => {
        const response = await this.client.get('/derivatives');
        return response.data;
      },
      600000 // 10 minutes cache
    );
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache() {
    this.cache.clear();
    console.log('[CoinGecko] Cache cleared');
  }
}

// Export singleton instance
export const coinGeckoService = new CoinGeckoService();

