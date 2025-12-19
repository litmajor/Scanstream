/**
 * Strategy Routing API Routes
 * 
 * Exposes strategy routing to scanner and agents
 * 
 * Routes:
 * - /api/strategy/route - Route OHLCV data to best strategies
 * - /api/strategy/agent/:agent - Get agent-specific signals
 * - /api/strategy/market-condition - Detect market condition
 * - /api/strategy/recommend-agent - Recommend best agent for market
 * - /api/strategy/scanner-enhance - Enhance scanner results with strategies
 * - /api/strategy/agent-decision - Get agent trading decision
 * - /api/strategy/compare-agents - Compare all agents on same data
 */

import express from 'express';
import {
  makeRoutingDecision,
  detectMarketCondition,
  recommendAgentForMarket,
  getStrategiesForAgent,
  getStrategiesByCategory,
  MarketCondition,
  AgentSpecialty
} from '../services/scanner/strategy-router';
import {
  enhanceScanResultWithStrategies,
  getAgentOptimizedStrategies,
  compareStrategyRecommendations,
  ScannerStrategyExports
} from '../services/scanner/scanner-strategy-integration';
import {
  routeToAgent,
  TrendRiderAgent,
  MomentumHunterAgent,
  VolatilityTraderAgent,
  VolumeAnalyzerAgent,
  PrecisionScalperAgent,
  SwingTraderAgent,
  recommendAgentForMarketCondition
} from '../services/scanner/agent-strategy-integration';
import { StrategyInput } from '../services/scanner/strategy-engine';

export const strategyRoutingRoutes = express.Router();

/**
 * POST /api/strategy/route
 * Route OHLCV data to optimal strategies and agent
 */
strategyRoutingRoutes.post('/route', async (req, res) => {
  try {
    const { high, low, close, volume, symbol, preferredAgent } = req.body;

    if (!high || !low || !close || !volume) {
      return res.status(400).json({ error: 'Missing OHLCV data' });
    }

    const input: StrategyInput = {
      high: Array.isArray(high) ? high : [high],
      low: Array.isArray(low) ? low : [low],
      close: Array.isArray(close) ? close : [close],
      volume: Array.isArray(volume) ? volume : [volume]
    };

    const decision = makeRoutingDecision(input, preferredAgent);

    res.json({
      success: true,
      symbol,
      routing: {
        primaryStrategy: decision.primaryStrategy,
        recommendedStrategies: decision.recommendedStrategies,
        marketCondition: decision.marketCondition,
        agentRecommendation: decision.agentRecommendation,
        confidence: decision.reason
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/strategy/market-condition
 * Detect current market condition from OHLCV
 */
strategyRoutingRoutes.post('/market-condition', async (req, res) => {
  try {
    const { high, low, close } = req.body;

    if (!high || !low || !close) {
      return res.status(400).json({ error: 'Missing OHLCV data' });
    }

    const input: StrategyInput = {
      high: Array.isArray(high) ? high : [high],
      low: Array.isArray(low) ? low : [low],
      close: Array.isArray(close) ? close : [close],
      volume: req.body.volume ? (Array.isArray(req.body.volume) ? req.body.volume : [req.body.volume]) : []
    };

    const condition = detectMarketCondition(input);

    res.json({
      success: true,
      marketCondition: condition,
      description: {
        'STRONG_UPTREND': 'Very strong uptrend, favor trend-following',
        'UPTREND': 'Uptrend with ADX > 25',
        'RANGING': 'Range-bound market, favor mean reversion',
        'DOWNTREND': 'Downtrend with ADX > 25',
        'STRONG_DOWNTREND': 'Very strong downtrend',
        'VOLATILE': 'High volatility, favor volatility strategies',
        'LOW_VOLATILITY': 'Low volatility squeeze, await breakout'
      }[condition]
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/strategy/recommend-agent
 * Get recommended agents for current market condition
 */
strategyRoutingRoutes.post('/recommend-agent', async (req, res) => {
  try {
    const { high, low, close } = req.body;

    if (!high || !low || !close) {
      return res.status(400).json({ error: 'Missing OHLCV data' });
    }

    const input: StrategyInput = {
      high: Array.isArray(high) ? high : [high],
      low: Array.isArray(low) ? low : [low],
      close: Array.isArray(close) ? close : [close],
      volume: req.body.volume ? (Array.isArray(req.body.volume) ? req.body.volume : [req.body.volume]) : []
    };

    const condition = detectMarketCondition(input);
    const recommended = recommendAgentForMarket(condition);

    res.json({
      success: true,
      marketCondition: condition,
      recommendedAgents: recommended,
      agentDescriptions: {
        'TrendRider': 'Specializes in trend-following strategies',
        'MomentumHunter': 'Specializes in momentum/mean reversion',
        'VolatilityTrader': 'Specializes in volatility-based strategies',
        'VolumeAnalyzer': 'Specializes in volume confirmation',
        'PrecisionScalper': 'High-precision, high-confidence only',
        'SwingTrader': 'Multi-strategy advanced approach',
        'MultiStrategy': 'Consensus from all agents'
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/strategy/agent/:agent
 * Get optimized strategies for specific agent
 */
strategyRoutingRoutes.post('/agent/:agent', async (req, res) => {
  try {
    const { agent } = req.params;
    const { high, low, close, volume } = req.body;

    if (!high || !low || !close || !volume) {
      return res.status(400).json({ error: 'Missing OHLCV data' });
    }

    const validAgents = ['TrendRider', 'MomentumHunter', 'VolatilityTrader', 'VolumeAnalyzer', 'PrecisionScalper', 'SwingTrader', 'MultiStrategy'];
    if (!validAgents.includes(agent)) {
      return res.status(400).json({ 
        error: 'Invalid agent',
        validAgents 
      });
    }

    const input: StrategyInput = {
      high: Array.isArray(high) ? high : [high],
      low: Array.isArray(low) ? low : [low],
      close: Array.isArray(close) ? close : [close],
      volume: Array.isArray(volume) ? volume : [volume]
    };

    const result = getAgentOptimizedStrategies(agent as AgentSpecialty, input);

    res.json({
      success: true,
      agent,
      marketCondition: result.marketCondition,
      bestStrategy: result.bestStrategy,
      actionable: result.actionable,
      recommendations: result.recommendations.slice(0, 5) // Top 5
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/strategy/scanner-enhance
 * Enhance scanner results with strategy analysis
 */
strategyRoutingRoutes.post('/scanner-enhance', async (req, res) => {
  try {
    const { symbol, signal, confidence, high, low, close, volume, agentFilter } = req.body;

    if (!high || !low || !close || !volume) {
      return res.status(400).json({ error: 'Missing OHLCV data' });
    }

    const input: StrategyInput = {
      high: Array.isArray(high) ? high : [high],
      low: Array.isArray(low) ? low : [low],
      close: Array.isArray(close) ? close : [close],
      volume: Array.isArray(volume) ? volume : [volume]
    };

    const enhanced = enhanceScanResultWithStrategies(
      symbol || 'UNKNOWN',
      signal || 'NEUTRAL',
      confidence || 0,
      input,
      { agentFilter, includeDetails: true, enabled: true }
    );

    res.json({
      success: true,
      enhanced
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/strategy/agent-decision
 * Get agent trading decision
 */
strategyRoutingRoutes.post('/agent-decision', async (req, res) => {
  try {
    const { agent, high, low, close, volume } = req.body;

    if (!high || !low || !close || !volume) {
      return res.status(400).json({ error: 'Missing OHLCV data' });
    }

    const input: StrategyInput = {
      high: Array.isArray(high) ? high : [high],
      low: Array.isArray(low) ? low : [low],
      close: Array.isArray(close) ? close : [close],
      volume: Array.isArray(volume) ? volume : [volume]
    };

    const decision = routeToAgent('', input, agent);

    res.json({
      success: true,
      decision
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/strategy/compare-agents
 * Compare all agents on same market data
 */
strategyRoutingRoutes.post('/compare-agents', async (req, res) => {
  try {
    const { high, low, close, volume } = req.body;

    if (!high || !low || !close || !volume) {
      return res.status(400).json({ error: 'Missing OHLCV data' });
    }

    const input: StrategyInput = {
      high: Array.isArray(high) ? high : [high],
      low: Array.isArray(low) ? low : [low],
      close: Array.isArray(close) ? close : [close],
      volume: Array.isArray(volume) ? volume : [volume]
    };

    // Get decisions from all agents
    const agents: AgentSpecialty[] = ['TrendRider', 'MomentumHunter', 'VolatilityTrader', 'VolumeAnalyzer', 'PrecisionScalper', 'SwingTrader'];
    const decisions = agents.map(agent => routeToAgent('', input, agent));

    // Calculate consensus
    const buys = decisions.filter(d => d.action === 'BUY').length;
    const sells = decisions.filter(d => d.action === 'SELL').length;
    const holds = decisions.filter(d => d.action === 'HOLD').length;

    res.json({
      success: true,
      marketCondition: decisions[0].marketCondition,
      consensus: {
        buys,
        sells,
        holds,
        consensusSignal: buys > sells ? 'BUY' : sells > buys ? 'SELL' : 'HOLD'
      },
      perAgent: decisions.map(d => ({
        agent: d.agent,
        action: d.action,
        confidence: d.confidence,
        primaryStrategy: d.primaryStrategy
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/strategy/registry
 * Get strategy registry with all definitions
 */
strategyRoutingRoutes.get('/registry', async (req, res) => {
  try {
    const { category, agent, timeframe } = req.query;

    let strategies: any[] = [];

    if (category) {
      strategies = getStrategiesByCategory(category as any);
    } else if (agent) {
      strategies = getStrategiesForAgent(agent as AgentSpecialty);
    } else {
      strategies = Object.values(getStrategiesByCategory('TREND_FOLLOWING' as any))
        .concat(Object.values(getStrategiesByCategory('MOMENTUM' as any)))
        .concat(Object.values(getStrategiesByCategory('VOLATILITY' as any)))
        .concat(Object.values(getStrategiesByCategory('VOLUME' as any)))
        .concat(Object.values(getStrategiesByCategory('COMBINATION' as any)))
        .concat(Object.values(getStrategiesByCategory('ADVANCED' as any)));
    }

    res.json({
      success: true,
      count: strategies.length,
      strategies: strategies.map(s => ({
        name: s.name,
        category: s.category,
        description: s.description,
        bestFor: s.bestFor,
        agentSpecialties: s.agentSpecialties,
        timeframes: s.timeframes,
        winRate: s.winRate
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/strategy/agent-config/:agent
 * Get pre-configured settings for agent
 */
strategyRoutingRoutes.get('/agent-config/:agent', async (req, res) => {
  try {
    const { agent } = req.params;

    const configMap: Record<string, any> = {
      'TrendRider': ScannerStrategyExports.getTrendRiderConfig(),
      'MomentumHunter': ScannerStrategyExports.getMomentumHunterConfig(),
      'VolatilityTrader': ScannerStrategyExports.getVolatilityTraderConfig(),
      'VolumeAnalyzer': ScannerStrategyExports.getVolumeAnalyzerConfig(),
      'PrecisionScalper': ScannerStrategyExports.getPrecisionScalperConfig(),
      'SwingTrader': ScannerStrategyExports.getSwingTraderConfig(),
      'MultiStrategy': ScannerStrategyExports.getMultiStrategyConfig()
    };

    const config = configMap[agent];
    if (!config) {
      return res.status(400).json({ error: 'Unknown agent' });
    }

    res.json({
      success: true,
      agent,
      config
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default strategyRoutingRoutes;
