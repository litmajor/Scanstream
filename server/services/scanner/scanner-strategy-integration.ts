/**
 * Scanner Strategy Integration
 * 
 * Wires strategy engine into the multi-exchange scanner
 * Allows filtering by:
 * - Strategy type (trend-following, momentum, etc.)
 * - Market condition (trending, ranging, volatile)
 * - Agent specialization (TrendRider, MomentumHunter, etc.)
 */

import {
  routeStrategiesForScanner,
  routeStrategiesForAgent,
  makeRoutingDecision,
  detectMarketCondition,
  recommendAgentForMarket,
  getStrategiesForTimeframe,
  MarketCondition,
  AgentSpecialty,
  RoutingDecision,
  StrategyDefinition,
  STRATEGY_REGISTRY,
  AGENT_STRATEGIES
} from './strategy-router';
import {
  runAllStrategies,
  StrategyInput,
  StrategySignal,
  StrategyResults
} from './strategy-engine';

export interface ScannerStrategyConfig {
  enabled: boolean;
  agentFilter?: AgentSpecialty; // If set, only run strategies for this agent
  strategyFilter?: string[]; // If set, only run these specific strategies
  marketConditionFilter?: MarketCondition; // If set, only run strategies for this condition
  minConfidence?: number; // Minimum confidence to include (default: 30)
  onlyPrimary?: boolean; // If true, only return highest confidence signal
  includeDetails?: boolean; // If true, include detailed reasoning
  timeframe?: string; // Filter strategies suitable for this timeframe
}

export interface EnhancedScanResult {
  // Original scan results
  symbol: string;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  
  // Strategy engine additions
  strategyAnalysis: {
    marketCondition: MarketCondition;
    primaryStrategy: string;
    strategyConfidence: number;
    recommendedAgent: AgentSpecialty;
    agentAlignment: number; // % of agent strategies that agree
    allSignals: Array<{
      name: string;
      signal: 'BUY' | 'SELL' | 'NEUTRAL';
      confidence: number;
      strength: number;
      reason: string;
    }>;
    reasoning: string;
  };
  
  // Trading action recommendations
  recommendation: {
    action: 'BUY' | 'SELL' | 'HOLD';
    reason: string;
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
    suggestedAgent: AgentSpecialty;
    confidence: number;
  };
}

/**
 * Apply strategy analysis to scanner results
 */
export function enhanceScanResultWithStrategies(
  symbol: string,
  originalSignal: 'BUY' | 'SELL' | 'NEUTRAL',
  originalConfidence: number,
  input: StrategyInput,
  config: ScannerStrategyConfig = { enabled: true }
): EnhancedScanResult {
  const {
    agentFilter,
    strategyFilter,
    marketConditionFilter,
    minConfidence = 30,
    onlyPrimary = false,
    includeDetails = true,
    timeframe
  } = config;

  // Detect market condition
  const marketCondition = detectMarketCondition(input);

  // Get appropriate strategies
  let signals: Map<string, StrategySignal>;
  
  if (agentFilter) {
    // Route by agent specialization
    signals = routeStrategiesForAgent(agentFilter, input).signals;
  } else if (marketConditionFilter && marketConditionFilter !== marketCondition) {
    // Filter by specific market condition
    signals = routeStrategiesForScanner(marketConditionFilter, input).signals;
  } else {
    // Run for detected market condition
    signals = routeStrategiesForScanner(marketCondition, input).signals;
  }

  // Apply strategy filter if provided
  if (strategyFilter && strategyFilter.length > 0) {
    const filtered = new Map<string, StrategySignal>();
    for (const name of strategyFilter) {
      if (signals.has(name)) {
        filtered.set(name, signals.get(name)!);
      }
    }
    signals = filtered;
  }

  // Apply timeframe filter if provided
  if (timeframe) {
    const timeframeStrategies = getStrategiesForTimeframe(timeframe);
    const timeframeNames = new Set(timeframeStrategies.map(s => {
      // Find strategy name by function
      for (const [name, def] of Object.entries(STRATEGY_REGISTRY)) {
        if (def.fn === s.fn) return name;
      }
      return '';
    }));

    const filtered = new Map<string, StrategySignal>();
    for (const [name, signal] of signals.entries()) {
      if (timeframeNames.has(name)) {
        filtered.set(name, signal);
      }
    }
    signals = filtered;
  }

  // Filter by confidence
  const filteredSignals = new Map<string, StrategySignal>();
  for (const [name, signal] of signals.entries()) {
    if (signal.confidence >= minConfidence) {
      filteredSignals.set(name, signal);
    }
  }
  signals = filteredSignals;

  // Aggregate signals
  let buyCount = 0;
  let sellCount = 0;
  let totalConfidence = 0;
  let maxConfidence = 0;
  let primaryStrategy = '';
  let primarySignal: StrategySignal | null = null;

  for (const [name, signal] of signals.entries()) {
    if (signal.signal === 'BUY') buyCount++;
    if (signal.signal === 'SELL') sellCount++;
    totalConfidence += signal.confidence;

    if (signal.confidence > maxConfidence) {
      maxConfidence = signal.confidence;
      primaryStrategy = name;
      primarySignal = signal;
    }
  }

  const avgConfidence = signals.size > 0 ? totalConfidence / signals.size : 0;
  const agreementPercentage = signals.size > 0 ? Math.max(buyCount, sellCount) / signals.size : 0;

  // Recommend agent based on market condition
  const recommendedAgents = recommendAgentForMarket(marketCondition);
  const suggestedAgent = agentFilter || recommendedAgents[0];

  // Calculate agent alignment
  const agentStrats = AGENT_STRATEGIES[suggestedAgent] || [];
  let agentMatches = 0;
  for (const stratName of agentStrats) {
    if (signals.has(stratName)) agentMatches++;
  }
  const agentAlignment = agentStrats.length > 0 ? (agentMatches / agentStrats.length) * 100 : 0;

  // Determine final action
  let finalSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let finalConfidence = 0;
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';

  if (buyCount > sellCount && agreementPercentage > 0.4) {
    finalSignal = 'BUY';
    finalConfidence = avgConfidence;
  } else if (sellCount > buyCount && agreementPercentage > 0.4) {
    finalSignal = 'SELL';
    finalConfidence = avgConfidence;
  } else {
    finalSignal = 'NEUTRAL';
    finalConfidence = 0;
  }

  // Risk assessment
  if (agentAlignment < 50) {
    riskLevel = 'HIGH'; // Disagreement with agent specialization
  } else if (agreementPercentage < 0.5) {
    riskLevel = 'MEDIUM'; // Less than 50% agreement
  } else if (agreementPercentage < 0.3) {
    riskLevel = 'LOW';
  }

  // Build enhanced result
  return {
    symbol,
    signal: finalSignal,
    confidence: finalConfidence,
    strategyAnalysis: {
      marketCondition,
      primaryStrategy,
      strategyConfidence: maxConfidence,
      recommendedAgent: suggestedAgent,
      agentAlignment,
      allSignals: Array.from(signals.entries())
        .sort((a, b) => b[1].confidence - a[1].confidence)
        .map(([name, sig]) => ({
          name,
          signal: sig.signal,
          confidence: sig.confidence,
          strength: sig.strength,
          reason: sig.reason
        })),
      reasoning: includeDetails
        ? `Market: ${marketCondition} | Primary: ${primaryStrategy} (${maxConfidence.toFixed(0)}%) | Agreement: ${agreementPercentage * 100 | 0}% | Agent: ${suggestedAgent}`
        : `${primaryStrategy} (${maxConfidence.toFixed(0)}%)`
    },
    recommendation: {
      action: finalSignal === 'NEUTRAL' ? 'HOLD' : finalSignal,
      reason: primarySignal?.reason || 'No clear signal',
      risk: riskLevel,
      suggestedAgent,
      confidence: finalConfidence
    }
  };
}

/**
 * Batch enhance multiple scan results
 */
export function enhanceMultipleScanResults(
  results: Array<{
    symbol: string;
    signal: 'BUY' | 'SELL' | 'NEUTRAL';
    confidence: number;
    ohlcv: Array<{ high: number; low: number; close: number; volume: number }>;
  }>,
  config: ScannerStrategyConfig = { enabled: true }
): EnhancedScanResult[] {
  return results.map(result => {
    const input: StrategyInput = {
      high: result.ohlcv.map(c => c.high),
      low: result.ohlcv.map(c => c.low),
      close: result.ohlcv.map(c => c.close),
      volume: result.ohlcv.map(c => c.volume)
    };

    return enhanceScanResultWithStrategies(
      result.symbol,
      result.signal,
      result.confidence,
      input,
      config
    );
  });
}

/**
 * Get strategy recommendations for specific agent
 */
export function getAgentOptimizedStrategies(
  agent: AgentSpecialty,
  input: StrategyInput,
  config: ScannerStrategyConfig = { enabled: true }
): {
  agent: AgentSpecialty;
  marketCondition: MarketCondition;
  recommendations: Array<{
    strategy: string;
    signal: 'BUY' | 'SELL' | 'NEUTRAL';
    confidence: number;
    reason: string;
    aligned: boolean;
  }>;
  bestStrategy: string;
  actionable: boolean;
} {
  const marketCondition = detectMarketCondition(input);
  const { signals } = routeStrategiesForAgent(agent, input);
  const agentStrats = AGENT_STRATEGIES[agent];

  const recommendations = Array.from(signals.entries())
    .sort((a, b) => b[1].confidence - a[1].confidence)
    .map(([name, sig]) => ({
      strategy: name,
      signal: sig.signal,
      confidence: sig.confidence,
      reason: sig.reason,
      aligned: agentStrats.includes(name)
    }));

  const bestStrategy = recommendations[0]?.strategy || '';
  const actionable = recommendations.some(r => r.confidence >= (config.minConfidence || 50));

  return {
    agent,
    marketCondition,
    recommendations,
    bestStrategy,
    actionable
  };
}

/**
 * Compare strategies across different agents
 */
export function compareStrategyRecommendations(
  input: StrategyInput,
  agents: AgentSpecialty[]
): {
  marketCondition: MarketCondition;
  perAgent: Array<{
    agent: AgentSpecialty;
    primaryStrategy: string;
    confidence: number;
    consensus: boolean;
  }>;
  consensus: string | null; // If all agents recommend same signal
} {
  const marketCondition = detectMarketCondition(input);
  const perAgent = [];
  const signals: ('BUY' | 'SELL' | 'NEUTRAL')[] = [];

  for (const agent of agents) {
    const { signals: agentSignals } = routeStrategiesForAgent(agent, input);
    let maxConfidence = 0;
    let primaryStrategy = '';
    let primarySignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';

    for (const [name, sig] of agentSignals.entries()) {
      if (sig.confidence > maxConfidence) {
        maxConfidence = sig.confidence;
        primaryStrategy = name;
        primarySignal = sig.signal;
      }
    }

    perAgent.push({
      agent,
      primaryStrategy,
      confidence: maxConfidence,
      consensus: false // Will be set if all agree
    });

    signals.push(primarySignal);
  }

  // Check for consensus
  const consensus = signals.every(s => s === signals[0]) ? signals[0] : null;

  // Mark consensus agents
  for (const item of perAgent) {
    item.consensus = consensus !== null;
  }

  return {
    marketCondition,
    perAgent,
    consensus
  };
}

/**
 * Export strategies for different use cases
 */
export const ScannerStrategyExports = {
  // For TrendRider agent
  getTrendRiderConfig: (): ScannerStrategyConfig => ({
    enabled: true,
    agentFilter: 'TrendRider',
    minConfidence: 50,
    includeDetails: true
  }),

  // For MomentumHunter agent
  getMomentumHunterConfig: (): ScannerStrategyConfig => ({
    enabled: true,
    agentFilter: 'MomentumHunter',
    minConfidence: 50,
    includeDetails: true
  }),

  // For VolatilityTrader agent
  getVolatilityTraderConfig: (): ScannerStrategyConfig => ({
    enabled: true,
    agentFilter: 'VolatilityTrader',
    minConfidence: 50,
    includeDetails: true
  }),

  // For VolumeAnalyzer agent
  getVolumeAnalyzerConfig: (): ScannerStrategyConfig => ({
    enabled: true,
    agentFilter: 'VolumeAnalyzer',
    minConfidence: 50,
    includeDetails: true
  }),

  // For PrecisionScalper agent
  getPrecisionScalperConfig: (): ScannerStrategyConfig => ({
    enabled: true,
    agentFilter: 'PrecisionScalper',
    minConfidence: 60, // Higher threshold for scalping
    includeDetails: true
  }),

  // For SwingTrader agent
  getSwingTraderConfig: (): ScannerStrategyConfig => ({
    enabled: true,
    agentFilter: 'SwingTrader',
    minConfidence: 55,
    includeDetails: true
  }),

  // For scanner's multi-strategy mode
  getMultiStrategyConfig: (): ScannerStrategyConfig => ({
    enabled: true,
    agentFilter: 'MultiStrategy',
    minConfidence: 50,
    includeDetails: false
  }),

  // For high-confidence only
  getHighConfidenceConfig: (): ScannerStrategyConfig => ({
    enabled: true,
    strategyFilter: ['tripleConfirmation', 'ichimokuFib', 'trendVolume'],
    minConfidence: 65,
    includeDetails: true
  }),

  // For daily timeframe
  getDailyTimeframeConfig: (): ScannerStrategyConfig => ({
    enabled: true,
    timeframe: 'daily',
    minConfidence: 50,
    includeDetails: true
  }),

  // For 4-hour timeframe
  getFourHourTimeframeConfig: (): ScannerStrategyConfig => ({
    enabled: true,
    timeframe: '4h',
    minConfidence: 50,
    includeDetails: true
  })
};
