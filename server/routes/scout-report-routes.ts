/**
 * Scout Report API Routes
 * 
 * Complete API for Scout Reports with:
 * - Multi-source signal aggregation endpoints
 * - Filtering and sorting capabilities
 * - Comparison and analysis tools
 * - Watchlist integration
 * 
 * Base path: /api/scout
 */

import { Router, Request, Response } from 'express';
import { Logger } from '../services/logger';
import { ScoutReportService } from '../services/scout-report-service';

import type {
  ScoutReport,
  ExecutiveSummary,
  TradeOpportunity,
  TradeType,
  SourceType,
  ScoutReportRequest,
} from '../types/scout-report-types';

const logger = new Logger('ScoutReportRoutes');
const router = Router();

/**
 * Get Scout Report Service from global context
 */
function getScoutReportService(): ScoutReportService {
  const service = (global as any).scoutReportService as ScoutReportService;
  if (!service) {
    throw new Error('Scout Report Service not initialized');
  }
  return service;
}

// ============================================================================
// CORE ENDPOINTS (2.1)
// ============================================================================

/**
 * GET /api/scout/:symbol
 * Full scout report for single symbol
 */
router.get('/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { includeHistorical } = req.query;

    logger.info(`Fetching full scout report for ${symbol}`);

    const request: ScoutReportRequest = {
      symbol,
      includeHistorical: includeHistorical === 'true',
    };

    const service = getScoutReportService();
    const report = await service.generateScoutReport(symbol, request);

    res.json({
      success: true,
      data: report,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error fetching scout report', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to generate scout report',
    });
  }
});

/**
 * GET /api/scout/:symbol/executive
 * Executive summary only (faster)
 */
router.get('/:symbol/executive', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    logger.info(`Fetching executive summary for ${symbol}`);

    const service = getScoutReportService(); const report = await service.generateScoutReport(symbol);

    res.json({
      success: true,
      data: {
        executiveSummary: report.executiveSummary,
        topOpportunity: report.opportunities[0] || null,
        generatedIn: report.generatedIn,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error fetching executive summary', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch executive summary',
    });
  }
});

/**
 * GET /api/scout/:symbol/sources
 * Source analysis only with optional filtering
 * Query params: source (ML, SCANNER, AGENTS, PRICE_ACTION)
 */
router.get('/:symbol/sources', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { source } = req.query as { source?: SourceType };

    logger.info(`Fetching sources for ${symbol}`, { source });

    const service = getScoutReportService(); const report = await service.generateScoutReport(symbol);

    let sources = report.sourcesAnalysis;

    // Filter by specific source if requested
    if (source && source !== 'ALL') {
      const sourceKey = source.toLowerCase();
      sources = {
        ml: sourceKey === 'ml' ? sources.ml : undefined,
        scanner: sourceKey === 'scanner' ? sources.scanner : undefined,
        agents: sourceKey === 'agents' ? sources.agents : undefined,
        priceAction: sourceKey === 'price_action' ? sources.priceAction : undefined,
      };
    }

    res.json({
      success: true,
      data: sources,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error fetching sources', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sources',
    });
  }
});

/**
 * GET /api/scout/:symbol/opportunities
 * Opportunities list with filtering
 * Query params: type (SCALP, DAY, SWING), minConfidence, minRiskReward, sort
 */
router.get('/:symbol/opportunities', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const {
      type,
      minConfidence = 0,
      minRiskReward = 0,
      sort = 'riskReward',
      limit = 100,
    } = req.query;

    logger.info(`Fetching opportunities for ${symbol}`, {
      type,
      minConfidence,
      minRiskReward,
      sort,
      limit,
    });

    const service = getScoutReportService(); const report = await service.generateScoutReport(symbol);

    let opportunities = report.opportunities;

    // Filter by type
    if (type && type !== 'ALL') {
      opportunities = opportunities.filter((opp) => opp.type === type);
    }

    // Filter by minimum confidence
    if (minConfidence) {
      const minConf = parseFloat(String(minConfidence));
      opportunities = opportunities.filter((opp) => opp.confidence >= minConf);
    }

    // Filter by minimum risk/reward
    if (minRiskReward) {
      const minRR = parseFloat(String(minRiskReward));
      opportunities = opportunities.filter((opp) => opp.riskRewardRatio >= minRR);
    }

    // Sort opportunities
    opportunities = sortOpportunities(opportunities, String(sort));

    // Limit results
    opportunities = opportunities.slice(0, Math.min(100, parseInt(String(limit))));

    res.json({
      success: true,
      data: {
        opportunities,
        count: opportunities.length,
        totalCount: report.opportunities.length,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error fetching opportunities', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch opportunities',
    });
  }
});

// ============================================================================
// FILTERED ENDPOINTS (2.2)
// ============================================================================

/**
 * GET /api/scout/:symbol/scalp
 * Scalp opportunities only
 */
router.get('/:symbol/scalp', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const service = getScoutReportService(); const report = await service.generateScoutReport(symbol);
    const scalps = report.opportunities.filter((opp) => opp.type === 'SCALP');

    res.json({
      success: true,
      data: scalps,
      count: scalps.length,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error fetching scalp opportunities', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scalp opportunities',
    });
  }
});

/**
 * GET /api/scout/:symbol/day
 * Day trading opportunities only
 */
router.get('/:symbol/day', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const service = getScoutReportService(); const report = await service.generateScoutReport(symbol);
    const dayTrades = report.opportunities.filter((opp) => opp.type === 'DAY');

    res.json({
      success: true,
      data: dayTrades,
      count: dayTrades.length,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error fetching day trade opportunities', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch day trade opportunities',
    });
  }
});

/**
 * GET /api/scout/:symbol/swing
 * Swing trading opportunities only
 */
router.get('/:symbol/swing', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const service = getScoutReportService(); const report = await service.generateScoutReport(symbol);
    const swings = report.opportunities.filter((opp) => opp.type === 'SWING');

    res.json({
      success: true,
      data: swings,
      count: swings.length,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error fetching swing opportunities', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch swing opportunities',
    });
  }
});

/**
 * GET /api/scout/:symbol/consensus
 * Consensus details with alternatives
 */
router.get('/:symbol/consensus', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const service = getScoutReportService(); const report = await service.generateScoutReport(symbol);

    res.json({
      success: true,
      data: {
        consensus: report.consensus,
        alternatives: report.alternatives,
        insights: report.insights,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error fetching consensus', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch consensus',
    });
  }
});

/**
 * GET /api/scout/:symbol/risk-assessment
 * Risk details including levels, SL, TP
 */
router.get('/:symbol/risk-assessment', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const service = getScoutReportService(); const report = await service.generateScoutReport(symbol);

    const riskData = {
      riskAssessment: report.riskAssessment,
      opportunities: report.opportunities.map((opp) => ({
        id: opp.id,
        type: opp.type,
        direction: opp.direction,
        stopLoss: opp.stopLoss,
        targets: opp.targets,
        riskRewardRatio: opp.riskRewardRatio,
      })),
    };

    res.json({
      success: true,
      data: riskData,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error fetching risk assessment', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch risk assessment',
    });
  }
});

// ============================================================================
// ADVANCED ENDPOINTS (2.3)
// ============================================================================

/**
 * GET /api/scout/multi
 * Multiple symbols at once
 * Query params: symbols (comma-separated), type, minConfidence
 */
router.get('/multi', async (req: Request, res: Response) => {
  try {
    const { symbols, type, minConfidence = 0 } = req.query;

    if (!symbols || typeof symbols !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'symbols parameter required (comma-separated)',
      });
    }

    const symbolList = symbols.split(',').map((s) => s.trim());
    logger.info(`Fetching scout reports for multiple symbols`, {
      symbols: symbolList,
      type,
      minConfidence,
    });

    // Fetch reports in parallel
    const service = getScoutReportService();
    const reports = await Promise.all(
      symbolList.map((symbol) => service.generateScoutReport(symbol))
    );

    // Apply filters if specified
    let results = reports.map((report) => ({
      symbol: report.symbol,
      executiveSummary: report.executiveSummary,
      opportunities: report.opportunities,
      consensus: report.consensus,
    }));

    if (type && type !== 'ALL') {
      results = results.map((r) => ({
        ...r,
        opportunities: r.opportunities.filter((opp) => opp.type === type),
      }));
    }

    if (minConfidence) {
      const minConf = parseFloat(String(minConfidence));
      results = results.map((r) => ({
        ...r,
        opportunities: r.opportunities.filter((opp) => opp.confidence >= minConf),
      }));
    }

    res.json({
      success: true,
      data: results,
      count: results.length,
      totalOpportunities: results.reduce((sum, r) => sum + r.opportunities.length, 0),
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error fetching multi-symbol reports', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch multi-symbol reports',
    });
  }
});

/**
 * GET /api/scout/compare
 * Compare two symbols side-by-side
 * Query params: symbol1, symbol2
 */
router.get('/compare', async (req: Request, res: Response) => {
  try {
    const { symbol1, symbol2 } = req.query;

    if (!symbol1 || !symbol2 || typeof symbol1 !== 'string' || typeof symbol2 !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'symbol1 and symbol2 parameters required',
      });
    }

    logger.info(`Comparing scout reports`, { symbol1, symbol2 });

    const service = getScoutReportService();
    const [report1, report2] = await Promise.all([
      service.generateScoutReport(symbol1),
      service.generateScoutReport(symbol2),
    ]);

    const comparison = {
      symbol1: {
        symbol: symbol1,
        direction: report1.executiveSummary.direction,
        confidence: report1.executiveSummary.confidence,
        strength: report1.executiveSummary.strength,
        recommendation: report1.executiveSummary.recommendation,
        topOpportunity: report1.opportunities[0] || null,
        riskScore: report1.riskAssessment.overallRiskScore,
      },
      symbol2: {
        symbol: symbol2,
        direction: report2.executiveSummary.direction,
        confidence: report2.executiveSummary.confidence,
        strength: report2.executiveSummary.strength,
        recommendation: report2.executiveSummary.recommendation,
        topOpportunity: report2.opportunities[0] || null,
        riskScore: report2.riskAssessment.overallRiskScore,
      },
      winner:
        report1.executiveSummary.strength > report2.executiveSummary.strength
          ? symbol1
          : symbol2,
      winnerReason:
        report1.executiveSummary.strength > report2.executiveSummary.strength
          ? `${symbol1} has higher signal strength (${report1.executiveSummary.strength} vs ${report2.executiveSummary.strength})`
          : `${symbol2} has higher signal strength (${report2.executiveSummary.strength} vs ${report1.executiveSummary.strength})`,
    };

    res.json({
      success: true,
      data: comparison,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error comparing scout reports', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to compare scout reports',
    });
  }
});

/**
 * GET /api/scout/best
 * Best opportunities across all symbols
 * Query params: type (SCALP, DAY, SWING), limit, sort
 */
router.get('/best', async (req: Request, res: Response) => {
  try {
    // This would require a list of symbols to scan
    // In production, this would be all symbols in the universe or user's watchlist
    const { type, limit = 10, sort = 'riskReward' } = req.query;

    logger.info(`Fetching best opportunities`, { type, limit, sort });

    // Placeholder: In production, fetch all symbols from a watchlist or symbol universe
    const symbolsToScan = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT']; // Example symbols

    const service = getScoutReportService();
    const allReports = await Promise.all(
      symbolsToScan.map((symbol) => service.generateScoutReport(symbol))
    );

    // Collect all opportunities
    let allOpportunities: (TradeOpportunity & { symbol: string })[] = [];
    allReports.forEach((report) => {
      report.opportunities.forEach((opp) => {
        allOpportunities.push({ ...opp, symbol: report.symbol });
      });
    });

    // Filter by type
    if (type && type !== 'ALL') {
      allOpportunities = allOpportunities.filter((opp) => opp.type === type);
    }

    // Sort by specified metric
    allOpportunities = sortOpportunities(allOpportunities, String(sort));

    // Limit results
    const bestOpportunities = allOpportunities.slice(0, Math.min(100, parseInt(String(limit))));

    res.json({
      success: true,
      data: bestOpportunities,
      count: bestOpportunities.length,
      totalAvailable: allOpportunities.length,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error fetching best opportunities', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch best opportunities',
    });
  }
});

/**
 * GET /api/scout/watch-list
 * Scout reports for user's watchlist
 * Query params: userId, limit
 */
router.get('/watch-list', async (req: Request, res: Response) => {
  try {
    const { userId, limit = 20 } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId parameter required',
      });
    }

    logger.info(`Fetching watchlist scout reports for user ${userId}`);

    // Placeholder: In production, fetch user's watchlist from database
    const userWatchlist = ['BTC/USDT', 'ETH/USDT']; // Example

    const service = getScoutReportService();
    const watchlistReports = await Promise.all(
      userWatchlist.map((symbol) => service.generateScoutReport(symbol))
    );

    // Sort by consensus strength
    watchlistReports.sort(
      (a, b) => b.executiveSummary.strength - a.executiveSummary.strength
    );

    // Limit results
    const results = watchlistReports.slice(0, Math.min(100, parseInt(String(limit))));

    res.json({
      success: true,
      data: results.map((report) => ({
        symbol: report.symbol,
        executiveSummary: report.executiveSummary,
        topOpportunities: report.opportunities.slice(0, 3),
        riskLevel: report.riskAssessment.riskLevel,
      })),
      count: results.length,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error fetching watchlist', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch watchlist scout reports',
    });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Sort opportunities by specified metric
 */
function sortOpportunities(
  opportunities: TradeOpportunity[],
  sortBy: string
): TradeOpportunity[] {
  const sorted = [...opportunities];

  switch (sortBy) {
    case 'confidence':
      sorted.sort((a, b) => b.confidence - a.confidence);
      break;
    case 'riskReward':
      sorted.sort((a, b) => b.riskRewardRatio - a.riskRewardRatio);
      break;
    case 'probability':
      sorted.sort((a, b) => b.probability - a.probability);
      break;
    case 'ev':
      sorted.sort((a, b) => (b.expectedValue || 0) - (a.expectedValue || 0));
      break;
    case 'quality':
      sorted.sort((a, b) => b.qualityScore - a.qualityScore);
      break;
    default:
      sorted.sort((a, b) => b.riskRewardRatio - a.riskRewardRatio);
  }

  return sorted;
}

export default router;
