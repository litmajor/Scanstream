
import express, { type Request, type Response } from 'express';
import { EnhancedMultiTimeframeAnalyzer } from '../multi-timeframe';
import { SignalEngine } from '../trading-engine';
import { MultiTimeframeConfirmation } from '../services/multi-timeframe-confirmation';

const router = express.Router();

/**
 * GET /api/mtf-confirmation/:symbol
 * 
 * Get multi-timeframe confirmation analysis for a symbol
 */
router.get('/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const baseConfidence = parseFloat(req.query.confidence as string) || 0.75;

    // Initialize analyzers
    const signalEngine = new SignalEngine();
    const mtfAnalyzer = new EnhancedMultiTimeframeAnalyzer(signalEngine);
    const mtfConfirmation = new MultiTimeframeConfirmation();

    // Run multi-timeframe analysis
    const mtfSignal = await mtfAnalyzer.analyzeMultiTimeframe(symbol);

    if (!mtfSignal) {
      return res.status(404).json({
        error: 'Analysis failed',
        message: `Could not generate multi-timeframe analysis for ${symbol}`
      });
    }

    // Get confirmation recommendation
    const recommendation = mtfConfirmation.getTradeRecommendation(mtfSignal, baseConfidence);
    const alignmentReport = mtfConfirmation.getAlignmentReport(mtfSignal);
    const enhancedSignal = mtfConfirmation.enhanceSignalWithMTF(mtfSignal, recommendation);

    res.json({
      symbol,
      baseConfidence,
      recommendation: {
        action: recommendation.action,
        alignmentScore: recommendation.alignmentScore,
        alignedTimeframes: recommendation.alignedTimeframes,
        totalTimeframes: recommendation.totalTimeframes,
        dominantTrend: recommendation.dominantTrend,
        reasoning: recommendation.reasoning
      },
      multipliers: {
        confidence: recommendation.confidenceMultiplier,
        position: recommendation.positionMultiplier,
        target: recommendation.targetMultiplier,
        stopLoss: recommendation.stopMultiplier
      },
      enhancedSignal: {
        type: enhancedSignal.type,
        confidence: enhancedSignal.confidence,
        price: enhancedSignal.price,
        takeProfit: enhancedSignal.takeProfit,
        stopLoss: enhancedSignal.stopLoss,
        reasoning: enhancedSignal.reasoning
      },
      alignmentReport,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[MTF Confirmation] Error:', error);
    res.status(500).json({
      error: error.message,
      message: 'Failed to generate multi-timeframe confirmation'
    });
  }
});

/**
 * POST /api/mtf-confirmation/batch
 * 
 * Get MTF confirmation for multiple symbols
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { symbols, baseConfidence = 0.75 } = req.body;

    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'symbols array required'
      });
    }

    const signalEngine = new SignalEngine();
    const mtfAnalyzer = new EnhancedMultiTimeframeAnalyzer(signalEngine);
    const mtfConfirmation = new MultiTimeframeConfirmation();

    const results = await Promise.all(
      symbols.map(async (symbol: string) => {
        try {
          const mtfSignal = await mtfAnalyzer.analyzeMultiTimeframe(symbol);
          if (!mtfSignal) return null;

          const recommendation = mtfConfirmation.getTradeRecommendation(
            mtfSignal, 
            baseConfidence
          );

          return {
            symbol,
            action: recommendation.action,
            alignmentScore: recommendation.alignmentScore,
            alignedTimeframes: recommendation.alignedTimeframes,
            totalTimeframes: recommendation.totalTimeframes,
            positionMultiplier: recommendation.positionMultiplier,
            reasoning: recommendation.reasoning
          };
        } catch (error) {
          console.error(`[MTF Confirmation] Error for ${symbol}:`, error);
          return null;
        }
      })
    );

    const validResults = results.filter(r => r !== null);

    // Sort by alignment score
    validResults.sort((a, b) => Math.abs(b!.alignmentScore) - Math.abs(a!.alignmentScore));

    res.json({
      total: symbols.length,
      analyzed: validResults.length,
      results: validResults,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[MTF Confirmation Batch] Error:', error);
    res.status(500).json({
      error: error.message,
      message: 'Failed to process batch MTF confirmation'
    });
  }
});

export default router;
