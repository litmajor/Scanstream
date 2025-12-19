/**
 * Strategy Router & Agent Specialization Engine
 * 
 * Routes strategies to the correct agent/scanner based on:
 * - Strategy type (trend-following, momentum, volatility, etc.)
 * - Market conditions (trending, ranging, volatile)
 * - Agent specialization (TrendRider, MomentumHunter, VolatilityTrader, etc.)
 * 
 * Example:
 * - TrendRider agent → MACD, Parabolic SAR, Ichimoku, ADX
 * - MomentumHunter → RSI, Stochastic, CCI
 * - VolatilityTrader → Bollinger Squeeze, Keltner, ATR
 * - VolumeAnalyzer → OBV, MFI, CMF
 * - PrecisionScalper → Triple Confirmation, Bollinger+RSI
 * - SwingTrader → Trend+Volume, Ichimoku+Fib, Elder Ray
 */

import { StrategySignal, StrategyResults, StrategyInput } from './strategy-engine';
import * as Strategies from './strategy-engine';
import * as indicators from './indicators';

export type StrategyCategory = 
  | 'TREND_FOLLOWING'
  | 'MOMENTUM'
  | 'VOLATILITY'
  | 'VOLUME'
  | 'COMBINATION'
  | 'ADVANCED';

export type AgentSpecialty =
  | 'TrendRider'
  | 'MomentumHunter'
  | 'VolatilityTrader'
  | 'VolumeAnalyzer'
  | 'PrecisionScalper'
  | 'SwingTrader'
  | 'MultiStrategy';

export enum MarketCondition {
  STRONG_UPTREND = 'STRONG_UPTREND',
  UPTREND = 'UPTREND',
  RANGING = 'RANGING',
  DOWNTREND = 'DOWNTREND',
  STRONG_DOWNTREND = 'STRONG_DOWNTREND',
  VOLATILE = 'VOLATILE',
  LOW_VOLATILITY = 'LOW_VOLATILITY'
}

export interface StrategyDefinition {
  name: string;
  category: StrategyCategory;
  fn: (input: StrategyInput) => StrategySignal;
  bestFor: MarketCondition[];
  agentSpecialties: AgentSpecialty[];
  description: string;
  timeframes: string[]; // e.g., ['1h', '4h', 'daily']
  winRate: number; // e.g., 55, 60, 72
}

export interface RoutingDecision {
  primaryStrategy: string;
  recommendedStrategies: string[];
  marketCondition: MarketCondition;
  agentRecommendation: AgentSpecialty;
  reason: string;
}

/**
 * STRATEGY REGISTRY
 * Maps strategy names to their definitions
 */
export const STRATEGY_REGISTRY: Record<string, StrategyDefinition> = {
  // TREND-FOLLOWING
  macdCrossover: {
    name: 'MACD Crossover',
    category: 'TREND_FOLLOWING',
    fn: Strategies.macdCrossover,
    bestFor: [MarketCondition.UPTREND, MarketCondition.DOWNTREND, MarketCondition.STRONG_UPTREND],
    agentSpecialties: ['TrendRider', 'SwingTrader', 'MultiStrategy'],
    description: 'Golden/Death cross of MACD and signal line',
    timeframes: ['4h', 'daily', 'weekly'],
    winRate: 58
  },
  adxTrendFilter: {
    name: 'ADX Trend Strength',
    category: 'TREND_FOLLOWING',
    fn: Strategies.adxTrendFilter,
    bestFor: [MarketCondition.STRONG_UPTREND, MarketCondition.STRONG_DOWNTREND, MarketCondition.UPTREND],
    agentSpecialties: ['TrendRider', 'MultiStrategy'],
    description: 'Filter: Only trade in strong trends (ADX > 25)',
    timeframes: ['1h', '4h', 'daily', 'weekly'],
    winRate: 0 // Filter, not a signal generator
  },
  parabolicSAR: {
    name: 'Parabolic SAR',
    category: 'TREND_FOLLOWING',
    fn: Strategies.parabolicSarTrend,
    bestFor: [MarketCondition.UPTREND, MarketCondition.DOWNTREND, MarketCondition.STRONG_UPTREND],
    agentSpecialties: ['TrendRider', 'SwingTrader'],
    description: 'SAR flips provide entry/exit with built-in stops',
    timeframes: ['1h', '4h', 'daily'],
    winRate: 52
  },
  ichimokuCloud: {
    name: 'Ichimoku Cloud',
    category: 'TREND_FOLLOWING',
    fn: Strategies.ichimokuCloud,
    bestFor: [MarketCondition.STRONG_UPTREND, MarketCondition.STRONG_DOWNTREND],
    agentSpecialties: ['SwingTrader', 'MultiStrategy'],
    description: '5+ bullish/bearish conditions aligned',
    timeframes: ['4h', 'daily', 'weekly'],
    winRate: 68
  },

  // MOMENTUM
  rsiOversold: {
    name: 'RSI Oversold/Overbought',
    category: 'MOMENTUM',
    fn: Strategies.rsiOversoldOverbought,
    bestFor: [MarketCondition.RANGING, MarketCondition.UPTREND],
    agentSpecialties: ['MomentumHunter', 'PrecisionScalper', 'MultiStrategy'],
    description: 'Buy RSI > 30 from oversold, Sell RSI < 70 from overbought',
    timeframes: ['1h', '4h', 'daily'],
    winRate: 62
  },
  stochastic: {
    name: 'Stochastic Crossover',
    category: 'MOMENTUM',
    fn: Strategies.stochasticCrossover,
    bestFor: [MarketCondition.RANGING],
    agentSpecialties: ['MomentumHunter', 'PrecisionScalper'],
    description: '%K crosses %D in oversold/overbought zones',
    timeframes: ['1h', '4h'],
    winRate: 63
  },
  cci: {
    name: 'CCI Mean Reversion',
    category: 'MOMENTUM',
    fn: Strategies.cciMeanReversion,
    bestFor: [MarketCondition.RANGING],
    agentSpecialties: ['MomentumHunter', 'MultiStrategy'],
    description: 'Mean reversion when CCI crosses -100/+100',
    timeframes: ['15m', '1h', '4h'],
    winRate: 58
  },

  // VOLATILITY
  bollingerSqueeze: {
    name: 'Bollinger Squeeze',
    category: 'VOLATILITY',
    fn: Strategies.bollingerSqueeze,
    bestFor: [MarketCondition.LOW_VOLATILITY],
    agentSpecialties: ['VolatilityTrader', 'PrecisionScalper'],
    description: 'Breakout after band squeeze',
    timeframes: ['4h', 'daily'],
    winRate: 68
  },
  bollingerReversal: {
    name: 'Bollinger Reversal',
    category: 'VOLATILITY',
    fn: Strategies.bollingerReversal,
    bestFor: [MarketCondition.RANGING],
    agentSpecialties: ['VolatilityTrader', 'MomentumHunter'],
    description: 'Mean reversion at band extremes',
    timeframes: ['1h', '4h'],
    winRate: 65
  },
  keltnerBreakout: {
    name: 'Keltner Breakout',
    category: 'VOLATILITY',
    fn: Strategies.keltnerBreakout,
    bestFor: [MarketCondition.UPTREND, MarketCondition.DOWNTREND],
    agentSpecialties: ['VolatilityTrader', 'TrendRider'],
    description: 'Breakout above/below Keltner with rising ATR',
    timeframes: ['4h', 'daily'],
    winRate: 62
  },

  // VOLUME
  obv: {
    name: 'OBV Divergence',
    category: 'VOLUME',
    fn: Strategies.obvDivergence,
    bestFor: [MarketCondition.UPTREND, MarketCondition.DOWNTREND, MarketCondition.RANGING],
    agentSpecialties: ['VolumeAnalyzer', 'SwingTrader'],
    description: 'Price/OBV divergence signals reversals',
    timeframes: ['daily', 'weekly'],
    winRate: 68
  },
  mfi: {
    name: 'MFI Oversold/Overbought',
    category: 'VOLUME',
    fn: Strategies.mfiOversoldOverbought,
    bestFor: [MarketCondition.RANGING],
    agentSpecialties: ['VolumeAnalyzer', 'MomentumHunter'],
    description: 'RSI but with volume weighting',
    timeframes: ['4h', 'daily'],
    winRate: 63
  },
  cmf: {
    name: 'CMF Accumulation',
    category: 'VOLUME',
    fn: Strategies.cmfAccumulation,
    bestFor: [MarketCondition.UPTREND, MarketCondition.DOWNTREND],
    agentSpecialties: ['VolumeAnalyzer', 'MultiStrategy'],
    description: 'Accumulation/distribution confirmation',
    timeframes: ['daily', 'weekly'],
    winRate: 60
  },

  // COMBINATION
  tripleConfirmation: {
    name: 'Triple Confirmation',
    category: 'COMBINATION',
    fn: Strategies.tripleConfirmation,
    bestFor: [MarketCondition.UPTREND, MarketCondition.DOWNTREND],
    agentSpecialties: ['PrecisionScalper', 'SwingTrader', 'MultiStrategy'],
    description: 'MACD + RSI + ADX alignment (72% win rate)',
    timeframes: ['1h', '4h', 'daily'],
    winRate: 72
  },
  bollingerRsi: {
    name: 'Bollinger + RSI Double',
    category: 'COMBINATION',
    fn: Strategies.bollingerRsiDouble,
    bestFor: [MarketCondition.RANGING],
    agentSpecialties: ['PrecisionScalper', 'VolatilityTrader'],
    description: 'Bollinger band touch + RSI extreme',
    timeframes: ['1h', '4h'],
    winRate: 68
  },
  trendVolume: {
    name: 'Trend + Volume',
    category: 'COMBINATION',
    fn: Strategies.trendVolumeConfirmation,
    bestFor: [MarketCondition.UPTREND, MarketCondition.DOWNTREND],
    agentSpecialties: ['SwingTrader', 'VolumeAnalyzer'],
    description: 'Golden/Death cross with OBV confirmation',
    timeframes: ['4h', 'daily'],
    winRate: 68
  },

  // ADVANCED
  ichimokuFib: {
    name: 'Ichimoku + Fibonacci',
    category: 'ADVANCED',
    fn: Strategies.ichimokuFibonacciConfluence,
    bestFor: [MarketCondition.UPTREND, MarketCondition.DOWNTREND],
    agentSpecialties: ['SwingTrader', 'MultiStrategy'],
    description: 'Cloud edges align with Fib levels',
    timeframes: ['daily', 'weekly'],
    winRate: 72
  },
  elderRay: {
    name: 'Elder Ray Power',
    category: 'ADVANCED',
    fn: Strategies.elderRayPower,
    bestFor: [MarketCondition.UPTREND, MarketCondition.DOWNTREND, MarketCondition.STRONG_UPTREND],
    agentSpecialties: ['SwingTrader', 'TrendRider'],
    description: 'Bull/Bear power and trend strength',
    timeframes: ['daily', 'weekly'],
    winRate: 65
  }
};

/**
 * AGENT SPECIALIZATION MAPPING
 * Defines which strategies each agent should use
 */
export const AGENT_STRATEGIES: Record<AgentSpecialty, string[]> = {
  TrendRider: [
    'macdCrossover',
    'adxTrendFilter',
    'parabolicSAR',
    'ichimokuCloud',
    'keltnerBreakout',
    'elderRay'
  ],
  MomentumHunter: [
    'rsiOversold',
    'stochastic',
    'cci',
    'mfi',
    'bollingerReversal'
  ],
  VolatilityTrader: [
    'bollingerSqueeze',
    'bollingerReversal',
    'keltnerBreakout',
    'bollingerRsi'
  ],
  VolumeAnalyzer: [
    'obv',
    'mfi',
    'cmf',
    'trendVolume',
    'adxTrendFilter'
  ],
  PrecisionScalper: [
    'tripleConfirmation',
    'bollingerRsi',
    'rsiOversold',
    'stochastic',
    'cci'
  ],
  SwingTrader: [
    'trendVolume',
    'ichimokuFib',
    'elderRay',
    'tripleConfirmation',
    'ichimokuCloud',
    'obv'
  ],
  MultiStrategy: [
    'macdCrossover',
    'adxTrendFilter',
    'ichimokuCloud',
    'rsiOversold',
    'tripleConfirmation',
    'trendVolume',
    'cmf',
    'ichimokuFib'
  ]
};

/**
 * Detect market condition from indicators
 */
export function detectMarketCondition(input: StrategyInput): MarketCondition {
  const { high, low, close } = input;
  const i = close.length - 1;

  // Calculate EMA and ADX
  const ema20 = indicators.ema(close, 20);
  const ema50 = indicators.ema(close, 50);
  const adx = indicators.adx(high, low, close, 14);
  const atr = indicators.atr(high, low, close, 14);

  const ema20Val = ema20[i];
  const ema50Val = ema50[i];
  const adxVal = adx[i];
  const atrVal = atr[i];
  const closeVal = close[i];

  // Calculate volatility
  const volatilityThreshold = atrVal / closeVal; // ATR as % of price

  // Trend detection
  const bullTrend = ema20Val > ema50Val;
  const strongTrend = adxVal > 25;
  const veryStrongTrend = adxVal > 40;

  // Volatility detection
  const highVol = volatilityThreshold > 0.02; // > 2% ATR
  const lowVol = volatilityThreshold < 0.01; // < 1% ATR

  if (veryStrongTrend && bullTrend) return MarketCondition.STRONG_UPTREND;
  if (veryStrongTrend && !bullTrend) return MarketCondition.STRONG_DOWNTREND;
  if (strongTrend && bullTrend) return MarketCondition.UPTREND;
  if (strongTrend && !bullTrend) return MarketCondition.DOWNTREND;
  if (highVol) return MarketCondition.VOLATILE;
  if (lowVol) return MarketCondition.LOW_VOLATILITY;
  return MarketCondition.RANGING;
}

/**
 * Route strategies based on agent specialization
 */
export function routeStrategiesForAgent(
  agent: AgentSpecialty,
  input: StrategyInput
): { signals: Map<string, StrategySignal>; marketCondition: MarketCondition } {
  const strategyNames = AGENT_STRATEGIES[agent];
  const signals = new Map<string, StrategySignal>();
  const marketCondition = detectMarketCondition(input);

  for (const strategyName of strategyNames) {
    const def = STRATEGY_REGISTRY[strategyName];
    if (def) {
      // Check if strategy is good for current market condition
      if (def.bestFor.includes(marketCondition) || marketCondition === MarketCondition.VOLATILE) {
        signals.set(strategyName, def.fn(input));
      }
    }
  }

  return { signals, marketCondition };
}

/**
 * Route strategies for scanner based on market condition
 */
export function routeStrategiesForScanner(
  marketCondition: MarketCondition,
  input: StrategyInput
): { signals: Map<string, StrategySignal>; marketCondition: MarketCondition } {
  const signals = new Map<string, StrategySignal>();

  // Get all strategies best for this market condition
  for (const [name, def] of Object.entries(STRATEGY_REGISTRY)) {
    if (def.bestFor.includes(marketCondition)) {
      signals.set(name, def.fn(input));
    }
  }

  return { signals, marketCondition };
}

/**
 * Recommend best agent for current market
 */
export function recommendAgentForMarket(
  marketCondition: MarketCondition
): AgentSpecialty[] {
  const recommendations: Record<MarketCondition, AgentSpecialty[]> = {
    [MarketCondition.STRONG_UPTREND]: ['TrendRider', 'SwingTrader', 'MultiStrategy'],
    [MarketCondition.UPTREND]: ['TrendRider', 'VolumeAnalyzer', 'SwingTrader'],
    [MarketCondition.RANGING]: ['MomentumHunter', 'PrecisionScalper', 'VolatilityTrader'],
    [MarketCondition.DOWNTREND]: ['TrendRider', 'VolumeAnalyzer', 'SwingTrader'],
    [MarketCondition.STRONG_DOWNTREND]: ['TrendRider', 'SwingTrader', 'MultiStrategy'],
    [MarketCondition.VOLATILE]: ['VolatilityTrader', 'PrecisionScalper', 'MultiStrategy'],
    [MarketCondition.LOW_VOLATILITY]: ['PrecisionScalper', 'VolatilityTrader']
  };

  return recommendations[marketCondition] || ['MultiStrategy'];
}

/**
 * Make routing decision with explanation
 */
export function makeRoutingDecision(
  input: StrategyInput,
  preferredAgent?: AgentSpecialty
): RoutingDecision {
  const marketCondition = detectMarketCondition(input);
  const recommendedAgents = recommendAgentForMarket(marketCondition);

  // Use preferred agent if provided and suitable
  let selectedAgent = preferredAgent && recommendedAgents.includes(preferredAgent)
    ? preferredAgent
    : recommendedAgents[0];

  const agentStrategies = AGENT_STRATEGIES[selectedAgent];
  const { signals } = routeStrategiesForAgent(selectedAgent, input);

  // Find best strategy
  let primaryStrategy = '';
  let maxConfidence = 0;
  for (const [name, signal] of signals.entries()) {
    if (signal.confidence > maxConfidence) {
      maxConfidence = signal.confidence;
      primaryStrategy = name;
    }
  }

  // Find recommended strategies (top 3)
  const sorted = Array.from(signals.entries())
    .sort((a, b) => b[1].confidence - a[1].confidence)
    .slice(0, 3)
    .map(([name]) => name);

  const reason = `Market: ${marketCondition} | Agent: ${selectedAgent} | Primary: ${primaryStrategy} (${maxConfidence.toFixed(0)}% confidence)`;

  return {
    primaryStrategy,
    recommendedStrategies: sorted,
    marketCondition,
    agentRecommendation: selectedAgent,
    reason
  };
}

/**
 * Get strategies by category for filtering
 */
export function getStrategiesByCategory(category: StrategyCategory): StrategyDefinition[] {
  return Object.values(STRATEGY_REGISTRY).filter(def => def.category === category);
}

/**
 * Get strategies by agent
 */
export function getStrategiesForAgent(agent: AgentSpecialty): StrategyDefinition[] {
  const strategyNames = AGENT_STRATEGIES[agent];
  return strategyNames.map(name => STRATEGY_REGISTRY[name]).filter(Boolean);
}

/**
 * Get strategies by win rate (performance ranking)
 */
export function getTopStrategiesByPerformance(limit: number = 10): StrategyDefinition[] {
  return Object.values(STRATEGY_REGISTRY)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, limit);
}

/**
 * Get strategies suitable for specific timeframe
 */
export function getStrategiesForTimeframe(timeframe: string): StrategyDefinition[] {
  return Object.values(STRATEGY_REGISTRY).filter(def => def.timeframes.includes(timeframe));
}
