/**
 * CoinGecko API Routes
 * Exposes sentiment and market data from CoinGecko
 */

import { Router, Request, Response } from 'express';
import { coinGeckoService } from '../services/coingecko';

const router = Router();

/**
 * GET /api/coingecko/markets
 * Get market data for top coins
 */
router.get('/markets', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const perPage = Math.min(parseInt(req.query.per_page as string) || 100, 250);
    const vsCurrency = (req.query.vs_currency as string) || 'usd';

    const data = await coinGeckoService.getMarketData(vsCurrency, page, perPage);

    res.json({
      success: true,
      data,
      page,
      perPage,
      timestamp: new Date().toISOString(),
      attribution: 'Data provided by CoinGecko (coingecko.com)'
    });
  } catch (error: any) {
    console.error('[CoinGecko] Markets error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch market data'
    });
  }
});

/**
 * GET /api/coingecko/trending
 * Get trending coins based on social sentiment
 */
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const data = await coinGeckoService.getTrendingCoins();

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
      attribution: 'Data provided by CoinGecko (coingecko.com)'
    });
  } catch (error: any) {
    console.error('[CoinGecko] Trending error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch trending coins'
    });
  }
});

/**
 * GET /api/coingecko/global
 * Get global market overview
 */
router.get('/global', async (req: Request, res: Response) => {
  try {
    const data = await coinGeckoService.getGlobalMarket();

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
      attribution: 'Data provided by CoinGecko (coingecko.com)'
    });
  } catch (error: any) {
    console.error('[CoinGecko] Global error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch global market data'
    });
  }
});

/**
 * GET /api/coingecko/sentiment/:symbol
 * Get sentiment score for a specific symbol
 */
router.get('/sentiment/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const score = await coinGeckoService.getSentimentScore(symbol);

    res.json({
      success: true,
      symbol,
      sentimentScore: score,
      interpretation: score > 70 ? 'bullish' : score < 30 ? 'bearish' : 'neutral',
      timestamp: new Date().toISOString(),
      attribution: 'Data provided by CoinGecko (coingecko.com)'
    });
  } catch (error: any) {
    console.error(`[CoinGecko] Sentiment error for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch sentiment data'
    });
  }
});

/**
 * GET /api/coingecko/regime
 * Get current market regime
 */
router.get('/regime', async (req: Request, res: Response) => {
  try {
    const regime = await coinGeckoService.getMarketRegime();

    res.json({
      success: true,
      ...regime,
      timestamp: new Date().toISOString(),
      attribution: 'Data provided by CoinGecko (coingecko.com)'
    });
  } catch (error: any) {
    console.error('[CoinGecko] Regime error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch market regime'
    });
  }
});

/**
 * GET /api/coingecko/ohlc/:coinId
 * Get OHLC data for a specific coin
 */
router.get('/ohlc/:coinId', async (req: Request, res: Response) => {
  try {
    const coinId = req.params.coinId;
    const days = parseInt(req.query.days as string) || 1;
    const vsCurrency = (req.query.vs_currency as string) || 'usd';

    const data = await coinGeckoService.getOHLC(coinId, vsCurrency, days);

    res.json({
      success: true,
      coinId,
      data,
      days,
      timestamp: new Date().toISOString(),
      attribution: 'Data provided by CoinGecko (coingecko.com)'
    });
  } catch (error: any) {
    console.error(`[CoinGecko] OHLC error for ${req.params.coinId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch OHLC data'
    });
  }
});

/**
 * GET /api/coingecko/coin/:coinId
 * Get detailed coin information
 */
router.get('/coin/:coinId', async (req: Request, res: Response) => {
  try {
    const coinId = req.params.coinId;
    const data = await coinGeckoService.getCoinDetails(coinId);

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
      attribution: 'Data provided by CoinGecko (coingecko.com)'
    });
  } catch (error: any) {
    console.error(`[CoinGecko] Coin details error for ${req.params.coinId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch coin details'
    });
  }
});

/**
 * POST /api/coingecko/clear-cache
 * Clear the cache (admin endpoint)
 */
router.post('/clear-cache', async (req: Request, res: Response) => {
  try {
    coinGeckoService.clearCache();
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error: any) {
    console.error('[CoinGecko] Clear cache error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear cache'
    });
  }
});

/**
 * GET /api/coingecko/signals
 * Generate trading signals from CoinGecko market data
 */
router.get('/signals', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    
    // Get market data from CoinGecko
    const marketData = await coinGeckoService.getMarketData('usd', 1, limit);
    const globalData = await coinGeckoService.getGlobalMarket();
    
    // Calculate custom Fear & Greed Index
    const fearGreedIndex = calculateFearGreedIndex(globalData, marketData);
    
    // Convert market data to scanner signals
    const signals = marketData.map((coin: any) => {
      const priceChange24h = coin.price_change_percentage_24h || 0;
      const volume = coin.total_volume || 0;
      const marketCap = coin.market_cap || 0;
      const priceChangeAbsolute = Math.abs(priceChange24h);
      
      // Calculate signal strength based on momentum and volume
      const volumeScore = Math.min((volume / 1000000000) * 10, 40); // 0-40 points
      const momentumScore = Math.min(priceChangeAbsolute * 2, 40); // 0-40 points
      const marketCapScore = marketCap > 10000000000 ? 20 : marketCap > 1000000000 ? 10 : 5;
      const strength = Math.round(volumeScore + momentumScore + marketCapScore);
      
      // Determine signal type
      let signal: 'BUY' | 'SELL' | 'HOLD';
      if (priceChange24h > 5 && volume > 500000000) {
        signal = 'BUY';
      } else if (priceChange24h < -5 && volume > 500000000) {
        signal = 'SELL';
      } else {
        signal = 'HOLD';
      }
      
      // Mock RSI based on price change
      const rsi = 50 + (priceChange24h * 2);
      const clampedRsi = Math.max(0, Math.min(100, rsi));
      
      return {
        id: coin.id,
        symbol: `${coin.symbol.toUpperCase()}/USDT`,
        exchange: 'coingecko',
        timeframe: '24h',
        signal,
        strength: Math.min(100, Math.max(0, strength)),
        price: coin.current_price,
        change: priceChange24h,
        change24h: priceChange24h,
        volume: volume,
        timestamp: new Date(),
        indicators: {
          rsi: Math.round(clampedRsi),
          macd: priceChange24h > 0 ? 'bullish' : 'bearish',
          ema: priceChange24h > 0 ? 'above' : 'below',
          volume: volume > 1000000000 ? 'very_high' : volume > 500000000 ? 'high' : 'medium'
        },
        advanced: {
          opportunity_score: Math.min(100, strength),
          market_cap: marketCap,
          volume_24h: volume,
          price_change_7d: coin.price_change_percentage_7d_in_currency || 0,
          ath: coin.ath,
          ath_change_percentage: coin.ath_change_percentage
        }
      };
    });
    
    res.json({
      success: true,
      signals: signals.slice(0, limit),
      count: signals.length,
      fearGreedIndex,
      filters: {
        exchanges: ['coingecko'],
        timeframes: ['24h'],
        signals: ['BUY', 'SELL', 'HOLD'],
        minStrength: 0,
        maxStrength: 100
      },
      metadata: {
        source: 'CoinGecko',
        message: 'Signals generated from CoinGecko market data',
        fearGreed: fearGreedIndex
      },
      timestamp: new Date().toISOString(),
      attribution: 'Data provided by CoinGecko (coingecko.com)'
    });
  } catch (error: any) {
    console.error('[CoinGecko] Signals generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate signals from CoinGecko data'
    });
  }
});

/**
 * Calculate custom Fear & Greed Index
 * Based on market metrics from CoinGecko
 */
function calculateFearGreedIndex(globalData: any, marketData: any[]): {
  index: number;
  sentiment: string;
  components: any;
} {
  try {
    // Component 1: Market Cap Change (0-25 points)
    const marketCapChange = globalData.market_cap_change_percentage_24h_usd || 0;
    const marketCapScore = Math.max(0, Math.min(25, 12.5 + (marketCapChange * 2.5)));
    
    // Component 2: Bitcoin Dominance (0-25 points)
    const btcDominance = globalData.market_cap_percentage?.btc || 50;
    const btcScore = btcDominance > 50 ? 25 - ((btcDominance - 50) * 0.5) : 15 + ((50 - btcDominance) * 0.2);
    
    // Component 3: Volume (0-25 points)
    const totalVolume = globalData.total_volume?.usd || 0;
    const volumeScore = Math.min(25, (totalVolume / 100000000000) * 25);
    
    // Component 4: Market Momentum (0-25 points)
    const topCoinsPositive = marketData.filter(c => (c.price_change_percentage_24h || 0) > 0).length;
    const momentumScore = (topCoinsPositive / marketData.length) * 25;
    
    // Calculate total index (0-100)
    const index = Math.round(marketCapScore + btcScore + volumeScore + momentumScore);
    
    // Determine sentiment
    let sentiment: string;
    if (index >= 75) sentiment = 'Extreme Greed';
    else if (index >= 60) sentiment = 'Greed';
    else if (index >= 45) sentiment = 'Neutral';
    else if (index >= 30) sentiment = 'Fear';
    else sentiment = 'Extreme Fear';
    
    return {
      index: Math.max(0, Math.min(100, index)),
      sentiment,
      components: {
        marketCapChange: Math.round(marketCapScore),
        bitcoinDominance: Math.round(btcScore),
        volume: Math.round(volumeScore),
        momentum: Math.round(momentumScore)
      }
    };
  } catch (error) {
    console.error('[CoinGecko] Fear & Greed calculation error:', error);
    return {
      index: 50,
      sentiment: 'Neutral',
      components: {
        marketCapChange: 12,
        bitcoinDominance: 12,
        volume: 12,
        momentum: 12
      }
    };
  }
}

export default router;

