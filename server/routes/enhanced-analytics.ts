/**
 * Enhanced Analytics Routes
 * Combines exchange data with CoinGecko sentiment for composite scoring
 */

import { Router, Request, Response } from 'express';
import { coinGeckoService } from '../services/coingecko';

const router = Router();

/**
 * Calculate enhanced composite score
 * Combines technical indicators with sentiment data
 */
function calculateCompositeScore(params: {
  // Technical indicators (from scanner)
  rsi?: number;
  macd?: number;
  volumeRatio?: number;
  priceChange24h?: number;
  momentum?: number;
  
  // Sentiment data (from CoinGecko)
  sentimentScore?: number;
  isTrending?: boolean;
  marketRegime?: 'bull' | 'bear' | 'neutral' | 'volatile';
  btcDominance?: number;
  
  // Weights (customizable)
  weights?: {
    technical?: number;
    sentiment?: number;
    marketRegime?: number;
  };
}): {
  compositeScore: number;
  breakdown: any;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
} {
  const {
    rsi = 50,
    macd = 0,
    volumeRatio = 1,
    priceChange24h = 0,
    momentum = 0,
    sentimentScore = 50,
    isTrending = false,
    marketRegime = 'neutral',
    btcDominance = 50,
    weights = { technical: 0.5, sentiment: 0.3, marketRegime: 0.2 }
  } = params;

  // === Technical Score (0-100) ===
  let technicalScore = 50;
  
  // RSI contribution (30-70 range is normal)
  if (rsi < 30) technicalScore += 15; // Oversold
  else if (rsi > 70) technicalScore -= 15; // Overbought
  else technicalScore += (50 - rsi) * 0.3; // Closer to 50 is better
  
  // MACD contribution
  if (macd > 0) technicalScore += 10;
  else technicalScore -= 10;
  
  // Volume contribution
  if (volumeRatio > 2) technicalScore += 15; // Strong volume
  else if (volumeRatio > 1.5) technicalScore += 10;
  else if (volumeRatio < 0.5) technicalScore -= 10; // Weak volume
  
  // Price momentum
  if (priceChange24h > 5) technicalScore += 10;
  else if (priceChange24h > 2) technicalScore += 5;
  else if (priceChange24h < -5) technicalScore -= 10;
  else if (priceChange24h < -2) technicalScore -= 5;
  
  // Momentum indicator
  technicalScore += momentum * 20;
  
  // Clamp technical score
  technicalScore = Math.max(0, Math.min(100, technicalScore));

  // === Sentiment Score (already 0-100) ===
  let adjustedSentiment = sentimentScore;
  
  // Trending boost
  if (isTrending) {
    adjustedSentiment = Math.min(100, adjustedSentiment + 15);
  }

  // === Market Regime Score (0-100) ===
  let regimeScore = 50;
  
  switch (marketRegime) {
    case 'bull':
      regimeScore = 75; // Favorable for longs
      break;
    case 'bear':
      regimeScore = 25; // Unfavorable
      break;
    case 'volatile':
      regimeScore = 60; // Opportunities but risky
      break;
    case 'neutral':
      regimeScore = 50;
      break;
  }
  
  // BTC dominance factor
  if (btcDominance > 60) {
    regimeScore -= 10; // High BTC dominance = risk-off
  } else if (btcDominance < 40) {
    regimeScore += 10; // Low BTC dominance = alt season
  }
  
  regimeScore = Math.max(0, Math.min(100, regimeScore));

  // === Composite Score ===
  const compositeScore = 
    technicalScore * weights.technical! +
    adjustedSentiment * weights.sentiment! +
    regimeScore * weights.marketRegime!;

  // === Generate Recommendation ===
  let recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  
  if (compositeScore >= 75) recommendation = 'strong_buy';
  else if (compositeScore >= 60) recommendation = 'buy';
  else if (compositeScore >= 40) recommendation = 'hold';
  else if (compositeScore >= 25) recommendation = 'sell';
  else recommendation = 'strong_sell';

  return {
    compositeScore: Math.round(compositeScore * 100) / 100,
    breakdown: {
      technical: {
        score: Math.round(technicalScore * 100) / 100,
        weight: weights.technical,
        contribution: Math.round(technicalScore * weights.technical! * 100) / 100,
        components: {
          rsi,
          macd,
          volumeRatio,
          priceChange24h,
          momentum
        }
      },
      sentiment: {
        score: Math.round(adjustedSentiment * 100) / 100,
        weight: weights.sentiment,
        contribution: Math.round(adjustedSentiment * weights.sentiment! * 100) / 100,
        isTrending
      },
      marketRegime: {
        score: Math.round(regimeScore * 100) / 100,
        weight: weights.marketRegime,
        contribution: Math.round(regimeScore * weights.marketRegime! * 100) / 100,
        regime: marketRegime,
        btcDominance
      }
    },
    recommendation
  };
}

/**
 * POST /api/analytics/composite-score
 * Calculate enhanced composite score with sentiment data
 */
router.post('/composite-score', async (req: Request, res: Response) => {
  try {
    const {
      symbol,
      rsi,
      macd,
      volumeRatio,
      priceChange24h,
      momentum,
      includeSentiment = true,
      weights
    } = req.body;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Symbol is required'
      });
    }

    // Get sentiment data if requested
    let sentimentData = {
      sentimentScore: 50,
      isTrending: false
    };

    let regimeData = {
      marketRegime: 'neutral' as 'bull' | 'bear' | 'neutral' | 'volatile',
      btcDominance: 50
    };

    if (includeSentiment) {
      try {
        // Run both in parallel
        const [sentiment, regime] = await Promise.all([
          coinGeckoService.getSentimentScore(symbol),
          coinGeckoService.getMarketRegime()
        ]);

        sentimentData.sentimentScore = sentiment;
        
        // Check if trending
        const trending = await coinGeckoService.getTrendingCoins();
        const coinId = await coinGeckoService.symbolToCoinId(symbol);
        sentimentData.isTrending = trending.some((t: any) => t.item.id === coinId);

        regimeData.marketRegime = regime.regime;
        regimeData.btcDominance = regime.btcDominance;
      } catch (error) {
        console.error('[Enhanced Analytics] Failed to fetch sentiment:', error);
        // Continue with default sentiment values
      }
    }

    // Calculate composite score
    const result = calculateCompositeScore({
      rsi,
      macd,
      volumeRatio,
      priceChange24h,
      momentum,
      ...sentimentData,
      ...regimeData,
      weights
    });

    res.json({
      success: true,
      symbol,
      ...result,
      timestamp: new Date().toISOString(),
      attribution: includeSentiment ? 'Sentiment data provided by CoinGecko (coingecko.com)' : undefined
    });
  } catch (error: any) {
    console.error('[Enhanced Analytics] Composite score error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate composite score'
    });
  }
});

/**
 * POST /api/analytics/batch-composite-score
 * Calculate composite scores for multiple symbols
 */
router.post('/batch-composite-score', async (req: Request, res: Response) => {
  try {
    const { symbols, includeSentiment = true, weights } = req.body;

    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({
        success: false,
        error: 'Symbols array is required'
      });
    }

    // Get global market regime once (shared across all symbols)
    let regimeData = {
      marketRegime: 'neutral' as 'bull' | 'bear' | 'neutral' | 'volatile',
      btcDominance: 50
    };

    if (includeSentiment) {
      try {
        const regime = await coinGeckoService.getMarketRegime();
        regimeData.marketRegime = regime.regime;
        regimeData.btcDominance = regime.btcDominance;
      } catch (error) {
        console.error('[Enhanced Analytics] Failed to fetch regime:', error);
      }
    }

    // Process all symbols
    const results = await Promise.all(
      symbols.map(async (symbolData: any) => {
        const {
          symbol,
          rsi,
          macd,
          volumeRatio,
          priceChange24h,
          momentum
        } = symbolData;

        // Get sentiment for this symbol
        let sentimentData = {
          sentimentScore: 50,
          isTrending: false
        };

        if (includeSentiment) {
          try {
            const sentiment = await coinGeckoService.getSentimentScore(symbol);
            sentimentData.sentimentScore = sentiment;

            const trending = await coinGeckoService.getTrendingCoins();
            const coinId = await coinGeckoService.symbolToCoinId(symbol);
            sentimentData.isTrending = trending.some((t: any) => t.item.id === coinId);
          } catch (error) {
            // Use default sentiment on error
          }
        }

        // Calculate score
        const result = calculateCompositeScore({
          rsi,
          macd,
          volumeRatio,
          priceChange24h,
          momentum,
          ...sentimentData,
          ...regimeData,
          weights
        });

        return {
          symbol,
          ...result
        };
      })
    );

    // Sort by composite score (highest first)
    results.sort((a, b) => b.compositeScore - a.compositeScore);

    res.json({
      success: true,
      results,
      count: results.length,
      globalRegime: regimeData,
      timestamp: new Date().toISOString(),
      attribution: includeSentiment ? 'Sentiment data provided by CoinGecko (coingecko.com)' : undefined
    });
  } catch (error: any) {
    console.error('[Enhanced Analytics] Batch composite score error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate batch composite scores'
    });
  }
});

/**
 * GET /api/analytics/market-overview
 * Get comprehensive market overview with sentiment
 */
router.get('/market-overview', async (req: Request, res: Response) => {
  try {
    const [globalMarket, trending, regime] = await Promise.all([
      coinGeckoService.getGlobalMarket(),
      coinGeckoService.getTrendingCoins(),
      coinGeckoService.getMarketRegime()
    ]);

    res.json({
      success: true,
      global: {
        totalMarketCap: globalMarket.total_market_cap?.usd || 0,
        totalVolume: globalMarket.total_volume?.usd || 0,
        btcDominance: globalMarket.market_cap_percentage?.btc || 0,
        activeCryptocurrencies: globalMarket.active_cryptocurrencies || 0,
        markets: globalMarket.markets || 0
      },
      regime: {
        current: regime.regime,
        confidence: regime.confidence,
        btcDominance: regime.btcDominance
      },
      trending: trending.slice(0, 10).map((t: any) => ({
        id: t.item.id,
        symbol: t.item.symbol,
        name: t.item.name,
        rank: t.item.market_cap_rank,
        score: t.item.score
      })),
      timestamp: new Date().toISOString(),
      attribution: 'Data provided by CoinGecko (coingecko.com)'
    });
  } catch (error: any) {
    console.error('[Enhanced Analytics] Market overview error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch market overview'
    });
  }
});

export default router;

