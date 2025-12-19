/**
 * SCOUT REPORT CONSTANTS
 * 
 * Global configuration, thresholds, colors, and constants for Scout Reports
 * Used throughout frontend and backend for consistent behavior
 */

// ============================================================================
// CONFIDENCE & AGREEMENT THRESHOLDS
// ============================================================================

export const CONFIDENCE_THRESHOLDS = {
  VERY_LOW: 0.2,
  LOW: 0.4,
  MEDIUM: 0.6,
  HIGH: 0.75,
  VERY_HIGH: 0.9
} as const;

export const AGREEMENT_THRESHOLDS = {
  WEAK: 0.5,
  MODERATE: 0.65,
  STRONG: 0.8,
  VERY_STRONG: 0.9
} as const;

export const PROBABILITY_THRESHOLDS = {
  VERY_LOW: 0.3,
  LOW: 0.4,
  MEDIUM: 0.5,
  HIGH: 0.65,
  VERY_HIGH: 0.8
} as const;

export const RISK_REWARD_THRESHOLDS = {
  POOR: 0.5,
  FAIR: 1.0,
  GOOD: 1.5,
  EXCELLENT: 2.0,
  EXCEPTIONAL: 3.0
} as const;

export const QUALITY_THRESHOLDS = {
  LOW: 25,
  MEDIUM: 50,
  GOOD: 75,
  EXCELLENT: 90
} as const;

// ============================================================================
// RISK SCORES & LEVELS
// ============================================================================

export const RISK_SCORE_LEVELS = {
  VERY_LOW: { min: 1, max: 2, label: "Very Low", color: "green" },
  LOW: { min: 2, max: 3, label: "Low", color: "green" },
  MODERATE: { min: 3, max: 5, label: "Moderate", color: "yellow" },
  ELEVATED: { min: 5, max: 7, label: "Elevated", color: "orange" },
  HIGH: { min: 7, max: 9, label: "High", color: "red" },
  CRITICAL: { min: 9, max: 10, label: "Critical", color: "darkred" }
} as const;

export const RISK_ASSESSMENT_DEFAULTS = {
  minSupportDistance: 0.5, // 0.5% from support before SL
  minResistanceDistance: 0.5, // 0.5% from resistance before TP
  defaultStopLossPercent: 1.5, // 1.5% default stop loss
  defaultTakeProfitPercent: 3.0, // 3% default take profit
  atrMultiplierSL: 1.5, // 1.5x ATR for stop loss
  atrMultiplierTP: 2.5 // 2.5x ATR for take profit
} as const;

// ============================================================================
// TRADE TYPE DURATIONS (MINUTES)
// ============================================================================

export const TRADE_TYPE_DURATIONS = {
  SCALP: {
    min: 1,
    max: 30,
    label: "1-30 min",
    badge: "⚡",
    color: "purple"
  },
  DAY: {
    min: 30,
    max: 480, // 8 hours
    label: "30 min - 8 hours",
    badge: "☀️",
    color: "blue"
  },
  SWING: {
    min: 480, // 8 hours
    max: 10080, // 7 days
    label: "8 hours - 7 days",
    badge: "🌊",
    color: "orange"
  },
  POSITION: {
    min: 10080, // 7 days
    max: 43200, // 30 days
    label: "1-30 days",
    badge: "🎯",
    color: "indigo"
  }
} as const;

// ============================================================================
// TRADE TYPE CHARACTERISTICS
// ============================================================================

export const TRADE_TYPE_CONFIG = {
  SCALP: {
    type: "SCALP",
    typeName: "Scalp Trade",
    minConfidence: CONFIDENCE_THRESHOLDS.HIGH, // Need 75%+ confidence
    minAgreement: AGREEMENT_THRESHOLDS.MODERATE, // 65%+ agreement
    typicalDuration: "1-30 min",
    targetRiskReward: 0.5,
    profitTargetPercent: 0.5,
    stopLossPercent: 0.2,
    positionSize: 2, // 2x normal
    tradingHours: "US Market Hours (9:30-16:00 EST)"
  },
  DAY: {
    type: "DAY",
    typeName: "Day Trade",
    minConfidence: CONFIDENCE_THRESHOLDS.MEDIUM,
    minAgreement: AGREEMENT_THRESHOLDS.MODERATE,
    typicalDuration: "30 min - 8 hours",
    targetRiskReward: 1.5,
    profitTargetPercent: 2.0,
    stopLossPercent: 1.5,
    positionSize: 1, // Normal
    tradingHours: "US Market Hours (9:30-16:00 EST)"
  },
  SWING: {
    type: "SWING",
    typeName: "Swing Trade",
    minConfidence: CONFIDENCE_THRESHOLDS.LOW,
    minAgreement: AGREEMENT_THRESHOLDS.WEAK,
    typicalDuration: "8 hours - 7 days",
    targetRiskReward: 2.0,
    profitTargetPercent: 3.5,
    stopLossPercent: 2.0,
    positionSize: 0.5, // 0.5x normal
    tradingHours: "Any time"
  },
  POSITION: {
    type: "POSITION",
    typeName: "Position Trade",
    minConfidence: CONFIDENCE_THRESHOLDS.VERY_LOW,
    minAgreement: AGREEMENT_THRESHOLDS.WEAK,
    typicalDuration: "1-30 days",
    targetRiskReward: 3.0,
    profitTargetPercent: 5.0,
    stopLossPercent: 3.0,
    positionSize: 0.25, // 0.25x normal
    tradingHours: "Any time"
  }
} as const;

// ============================================================================
// COLOR SCHEMES
// ============================================================================

export const DIRECTION_COLORS = {
  BULLISH: {
    text: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950",
    border: "border-green-200 dark:border-green-800",
    icon: "📈",
    label: "BULLISH"
  },
  BEARISH: {
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950",
    border: "border-red-200 dark:border-red-800",
    icon: "📉",
    label: "BEARISH"
  },
  NEUTRAL: {
    text: "text-gray-600 dark:text-gray-400",
    bg: "bg-gray-50 dark:bg-gray-900",
    border: "border-gray-200 dark:border-gray-700",
    icon: "➡️",
    label: "NEUTRAL"
  }
} as const;

export const SOURCE_COLORS = {
  ML: {
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    text: "text-purple-600 dark:text-purple-400",
    icon: "🤖",
    label: "ML Model"
  },
  SCANNER: {
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    text: "text-blue-600 dark:text-blue-400",
    icon: "📊",
    label: "Scanner"
  },
  AGENTS: {
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    text: "text-amber-600 dark:text-amber-400",
    icon: "🦾",
    label: "Agents"
  },
  PRICE_ACTION: {
    badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    text: "text-green-600 dark:text-green-400",
    icon: "📈",
    label: "Price Action"
  }
} as const;

export const CONVICTION_COLORS = {
  LOW: {
    text: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950",
    level: 1,
    label: "Low"
  },
  MEDIUM: {
    text: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-950",
    level: 2,
    label: "Medium"
  },
  HIGH: {
    text: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950",
    level: 3,
    label: "High"
  },
  VERY_HIGH: {
    text: "text-green-700 dark:text-green-300",
    bg: "bg-green-100 dark:bg-green-900",
    level: 4,
    label: "Very High"
  }
} as const;

// ============================================================================
// CONFIDENCE & QUALITY COLORS
// ============================================================================

export const CONFIDENCE_COLOR_RANGES = {
  VERY_LOW: { min: 0, max: 0.2, color: "bg-red-600", textColor: "text-red-600" },
  LOW: { min: 0.2, max: 0.4, color: "bg-orange-500", textColor: "text-orange-500" },
  MEDIUM: { min: 0.4, max: 0.6, color: "bg-yellow-500", textColor: "text-yellow-500" },
  HIGH: { min: 0.6, max: 0.8, color: "bg-lime-500", textColor: "text-lime-500" },
  VERY_HIGH: { min: 0.8, max: 1.0, color: "bg-green-600", textColor: "text-green-600" }
} as const;

// ============================================================================
// URGENCY BADGES
// ============================================================================

export const URGENCY_CONFIG = {
  HIGH: {
    label: "🔥 HIGH URGENCY",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    description: "Strong signals with high confidence. Act soon."
  },
  MEDIUM: {
    label: "⚠️ MEDIUM URGENCY",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    description: "Moderate signals. Standard opportunity."
  },
  LOW: {
    label: "ℹ️ LOW URGENCY",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    description: "Weak signals. Watch for confirmation."
  }
} as const;

// ============================================================================
// CACHE & PERFORMANCE SETTINGS
// ============================================================================

export const CACHE_CONFIG = {
  SCOUT_REPORT_TTL_MS: 5 * 60 * 1000, // 5 minutes
  MULTI_SYMBOL_TTL_MS: 3 * 60 * 1000, // 3 minutes
  BEST_OPPORTUNITIES_TTL_MS: 2 * 60 * 1000, // 2 minutes
  AUTO_REFRESH_INTERVAL_MS: 30 * 1000 // 30 seconds
} as const;

// ============================================================================
// API PARAMETERS & LIMITS
// ============================================================================

export const API_LIMITS = {
  MAX_SYMBOLS_PER_REQUEST: 50,
  MAX_OPPORTUNITIES_RETURN: 100,
  MAX_AGENTS_RETURN: 20,
  MAX_ALTERNATIVES_RETURN: 5,
  DEFAULT_LIMIT: 10,
  MIN_LIMIT: 1,
  MAX_LIMIT: 100
} as const;

export const FILTER_PRESETS = {
  CONSERVATIVE: {
    name: "Conservative",
    minConfidence: CONFIDENCE_THRESHOLDS.HIGH,
    minRiskReward: RISK_REWARD_THRESHOLDS.GOOD,
    minProbability: PROBABILITY_THRESHOLDS.HIGH,
    description: "High confidence, good R:R, high probability"
  },
  MODERATE: {
    name: "Moderate",
    minConfidence: CONFIDENCE_THRESHOLDS.MEDIUM,
    minRiskReward: RISK_REWARD_THRESHOLDS.FAIR,
    minProbability: PROBABILITY_THRESHOLDS.MEDIUM,
    description: "Balanced risk/reward setup"
  },
  AGGRESSIVE: {
    name: "Aggressive",
    minConfidence: CONFIDENCE_THRESHOLDS.LOW,
    minRiskReward: RISK_REWARD_THRESHOLDS.POOR,
    minProbability: PROBABILITY_THRESHOLDS.VERY_LOW,
    description: "All opportunities, may include lower quality"
  },
  HIGH_PROBABILITY: {
    name: "High Probability",
    minConfidence: CONFIDENCE_THRESHOLDS.MEDIUM,
    minRiskReward: RISK_REWARD_THRESHOLDS.FAIR,
    minProbability: PROBABILITY_THRESHOLDS.HIGH,
    description: "Focus on probability over R:R"
  },
  HIGH_REWARD: {
    name: "High Reward",
    minConfidence: CONFIDENCE_THRESHOLDS.LOW,
    minRiskReward: RISK_REWARD_THRESHOLDS.EXCELLENT,
    minProbability: PROBABILITY_THRESHOLDS.VERY_LOW,
    description: "Focus on high risk/reward only"
  }
} as const;

// ============================================================================
// METRIC DISPLAY SETTINGS
// ============================================================================

export const METRIC_CONFIG = {
  DECIMAL_PLACES: 2,
  CONFIDENCE_FORMAT: "percent", // percent or 0-1
  PROBABILITY_FORMAT: "percent",
  PRICE_FORMAT: "USD",
  RISK_REWARD_FORMAT: "ratio", // ratio or multiplier
  VOLUME_FORMAT: "shorthand" // shorthand (1.2M) or full (1200000)
} as const;

// ============================================================================
// SORTING OPTIONS
// ============================================================================

export const SORT_OPTIONS = [
  {
    id: "riskReward",
    label: "Risk/Reward",
    icon: "📊",
    description: "Best risk/reward ratio first"
  },
  {
    id: "confidence",
    label: "Confidence",
    icon: "💯",
    description: "Highest confidence first"
  },
  {
    id: "probability",
    label: "Probability",
    icon: "🎯",
    description: "Highest probability first"
  },
  {
    id: "quality",
    label: "Quality",
    icon: "⭐",
    description: "Highest quality score first"
  },
  {
    id: "ev",
    label: "Expected Value",
    icon: "📈",
    description: "Highest expected value first"
  },
  {
    id: "duration",
    label: "Duration",
    icon: "⏱️",
    description: "Fastest setups first"
  }
] as const;

// ============================================================================
// SUPPORT/RESISTANCE LEVELS
// ============================================================================

export const SUPPORT_RESISTANCE_CONFIG = {
  STRONG: { minTouches: 3, label: "Strong", color: "text-red-600" },
  MODERATE: { minTouches: 2, label: "Moderate", color: "text-orange-600" },
  WEAK: { minTouches: 1, label: "Weak", color: "text-yellow-600" }
} as const;

// ============================================================================
// DIVERGENCE & PATTERN DETECTION
// ============================================================================

export const DIVERGENCE_TYPES = {
  BULLISH: { icon: "🔺", label: "Bullish Divergence", color: "green" },
  BEARISH: { icon: "🔻", label: "Bearish Divergence", color: "red" },
  HIDDEN_BULLISH: { icon: "📈", label: "Hidden Bullish", color: "lightgreen" },
  HIDDEN_BEARISH: { icon: "📉", label: "Hidden Bearish", color: "lightred" }
} as const;

// ============================================================================
// EXECUTION STRATEGIES
// ============================================================================

export const EXECUTION_STRATEGIES = {
  CONSERVATIVE: {
    name: "Conservative Entry",
    description: "Wait for confirmation after breakout",
    priceAdjustment: -0.5, // 0.5% below entry
    riskMultiplier: 0.8, // Reduce risk by 20%
    profitMultiplier: 0.7 // Reduce profit target
  },
  OPTIMAL: {
    name: "Optimal Entry",
    description: "Entry at identified zone",
    priceAdjustment: 0,
    riskMultiplier: 1.0,
    profitMultiplier: 1.0
  },
  AGGRESSIVE: {
    name: "Aggressive Entry",
    description: "Jump in early before breakout",
    priceAdjustment: 0.5, // 0.5% above entry
    riskMultiplier: 1.3, // Increase risk by 30%
    profitMultiplier: 1.2 // Increase profit target
  }
} as const;

// ============================================================================
// ALERT THRESHOLDS
// ============================================================================

export const ALERT_THRESHOLDS = {
  HIGH_CONFIDENCE_SETUP: CONFIDENCE_THRESHOLDS.VERY_HIGH,
  STRONG_CONSENSUS: AGREEMENT_THRESHOLDS.STRONG,
  EXCELLENT_RR: RISK_REWARD_THRESHOLDS.EXCELLENT,
  PRICE_AT_LEVEL: 0.5, // Within 0.5% of key level
  MAJOR_DIVERGENCE: 0.15 // 15% divergence between sources
} as const;
