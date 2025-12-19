/**
 * GLOBAL FORMATTING UTILITIES
 * 
 * Centralized formatting helpers for system-wide consistency
 * All metrics, percentages, prices, and values use these functions
 */

/**
 * Format decimal to 2 decimal places
 * Universal helper for ALL metrics across the system
 * 
 * @param value - Number to format
 * @param decimals - Number of decimal places (default 2)
 * @returns Formatted number with specified decimal places
 * 
 * Examples:
 * formatToDP(85.456) => "85.46"
 * formatToDP(0.6789, 2) => "0.68"
 * formatToDP(123.4) => "123.40"
 * formatToDP(99.999) => "100.00"
 */
export function formatToDP(value: number, decimals: number = 2): string {
  if (!Number.isFinite(value)) {
    return "0.00";
  }
  return value.toFixed(decimals);
}

/**
 * Format number for display (2 DP with trailing zeros)
 * Used in all MetricCard and stat displays
 */
export function formatMetric(value: number): string {
  return formatToDP(value, 2);
}

/**
 * Format currency amounts (USD with locale)
 * @example
 * formatCurrency(1000) → "$1,000.00"
 * formatCurrency(1234567.89) → "$1,234,567.89"
 */
export function formatCurrency(amount: number, decimals: number = 2): string {
  if (typeof amount !== 'number' || isNaN(amount)) return '–';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: 'auto'
  }).format(amount);
}

/**
 * Format percentage display (value already as percentage)
 * @example
 * formatPct(75.2547) → "75.25%"
 * formatPct(2.5) → "2.50%"
 */
export function formatPct(value: number, decimals: number = 2): string {
  if (typeof value !== 'number' || isNaN(value)) return '–';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Auto-format value based on field name
 * Intelligently formats numbers based on what field they represent
 * @example
 * autoFormat('price', 150.235) → "$150.24"
 * autoFormat('confidence', 0.85) → "85.00%"
 */
export function autoFormat(fieldName: string, value: number): string {
  if (typeof value !== 'number' || isNaN(value)) return '–';

  const lowerField = fieldName.toLowerCase();

  // Currency fields
  if (lowerField.includes('price') || lowerField.includes('entry') || 
      lowerField.includes('target') || lowerField.includes('stop') ||
      lowerField.includes('pnl') || lowerField.includes('amount')) {
    return formatCurrency(value);
  }

  // Percentage fields
  if (lowerField.includes('confidence') || lowerField.includes('probability') ||
      lowerField.includes('agreement') || lowerField.includes('pct') || 
      lowerField.includes('percent') || lowerField.includes('rate')) {
    return formatPct(value);
  }

  // Ratio fields
  if (lowerField.includes('ratio') || lowerField.includes('riskr')) {
    return formatMetric(value);
  }

  // Default: metric
  return formatMetric(value);
}

/**
 * Format percentage for display (2 DP)
 * Used for confidence, agreement, probability displays
 */
export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.00%";
  }
  return `${formatToDP(value * 100, 2)}%`;
}

/**
 * Format percentage from raw decimal (0-1) to display
 * Used for confidence scores (0.85 => "85.00%")
 */
export function formatPercentFromDecimal(value: number): string {
  return formatPercent(value);
}

/**
 * Format price with 2 DP
 * Used for entry prices, targets, stop losses
 */
export function formatPrice(value: number): string {
  return `$${formatToDP(value, 2)}`;
}

/**
 * Format risk/reward ratio (e.g., "1:2.35")
 * Both values shown with 2 DP
 */
export function formatRiskReward(risk: number, reward: number): string {
  const riskDP = formatToDP(risk, 2);
  const rewardDP = formatToDP(reward, 2);
  return `1:${rewardDP}`;
}

/**
 * Format ratio display (generic)
 * Used for any ratio display
 */
export function formatRatio(numerator: number, denominator: number): string {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return "0.00";
  }
  return formatToDP(numerator / denominator, 2);
}

/**
 * Format direction label with proper styling
 * BULLISH, BEARISH, NEUTRAL
 */
export function formatDirection(direction: string): {
  label: string;
  color: string;
  icon: string;
} {
  const directionUpper = direction.toUpperCase();
  
  const directionMap: Record<string, { label: string; color: string; icon: string }> = {
    BULLISH: {
      label: "BULLISH",
      color: "text-green-600 dark:text-green-400",
      icon: "📈"
    },
    BEARISH: {
      label: "BEARISH",
      color: "text-red-600 dark:text-red-400",
      icon: "📉"
    },
    NEUTRAL: {
      label: "NEUTRAL",
      color: "text-gray-600 dark:text-gray-400",
      icon: "➡️"
    }
  };

  return directionMap[directionUpper] || directionMap.NEUTRAL;
}

/**
 * Format trade type display
 * SCALP, DAY, SWING, POSITION
 */
export function formatTradeType(type: string): {
  label: string;
  color: string;
  badge: string;
} {
  const typeUpper = type.toUpperCase();
  
  const typeMap: Record<string, { label: string; color: string; badge: string }> = {
    SCALP: {
      label: "SCALP",
      color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      badge: "⚡"
    },
    DAY: {
      label: "DAY TRADE",
      color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      badge: "☀️"
    },
    SWING: {
      label: "SWING",
      color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      badge: "🌊"
    },
    POSITION: {
      label: "POSITION",
      color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
      badge: "🎯"
    }
  };

  return typeMap[typeUpper] || typeMap.DAY;
}

/**
 * Format conviction level display
 * LOW, MEDIUM, HIGH, VERY_HIGH
 */
export function formatConviction(conviction: string): {
  label: string;
  color: string;
  level: number;
} {
  const convictionUpper = conviction.toUpperCase().replace(/ /g, "_");
  
  const convictionMap: Record<string, { label: string; color: string; level: number }> = {
    LOW: {
      label: "LOW",
      color: "text-orange-600 dark:text-orange-400",
      level: 1
    },
    MEDIUM: {
      label: "MEDIUM",
      color: "text-yellow-600 dark:text-yellow-400",
      level: 2
    },
    HIGH: {
      label: "HIGH",
      color: "text-green-600 dark:text-green-400",
      level: 3
    },
    VERY_HIGH: {
      label: "VERY HIGH",
      color: "text-green-700 dark:text-green-300",
      level: 4
    }
  };

  return convictionMap[convictionUpper] || convictionMap.MEDIUM;
}

/**
 * Format source type display
 * ML, SCANNER, AGENTS, PRICE_ACTION
 */
export function formatSourceType(source: string): {
  label: string;
  color: string;
  icon: string;
} {
  const sourceUpper = source.toUpperCase();
  
  const sourceMap: Record<string, { label: string; color: string; icon: string }> = {
    ML: {
      label: "ML Model",
      color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      icon: "🤖"
    },
    SCANNER: {
      label: "Scanner",
      color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      icon: "📊"
    },
    AGENTS: {
      label: "Agents",
      color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      icon: "🦾"
    },
    PRICE_ACTION: {
      label: "Price Action",
      color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      icon: "📈"
    }
  };

  return sourceMap[sourceUpper] || sourceMap.ML;
}

/**
 * Format duration display
 * Convert minutes to human-readable format
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${formatToDP(minutes, 0)} min`;
  } else if (minutes < 1440) {
    const hours = minutes / 60;
    return `${formatToDP(hours, 1)}h`;
  } else {
    const days = minutes / 1440;
    return `${formatToDP(days, 1)}d`;
  }
}

/**
 * Format time to target estimate
 * "5-15 min", "1-4 hours", "1-5 days"
 */
export function formatTimeToTarget(minMinutes: number, maxMinutes: number): string {
  const formatTime = (mins: number): string => {
    if (mins < 60) return `${Math.round(mins)}m`;
    if (mins < 1440) return `${formatToDP(mins / 60, 1)}h`;
    return `${formatToDP(mins / 1440, 1)}d`;
  };

  return `${formatTime(minMinutes)}-${formatTime(maxMinutes)}`;
}

/**
 * Format large numbers with K/M/B suffix
 * 1500 => "1.5K", 1000000 => "1M"
 */
export function formatLargeNumber(num: number): string {
  if (!Number.isFinite(num)) return "0";
  
  const absNum = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  
  if (absNum >= 1_000_000_000) {
    return `${sign}${formatToDP(absNum / 1_000_000_000, 2)}B`;
  } else if (absNum >= 1_000_000) {
    return `${sign}${formatToDP(absNum / 1_000_000, 2)}M`;
  } else if (absNum >= 1_000) {
    return `${sign}${formatToDP(absNum / 1_000, 2)}K`;
  }
  
  return `${sign}${formatToDP(absNum, 2)}`;
}

/**
 * Format change display with direction
 * "+5.25%" (green) or "-2.10%" (red)
 */
export function formatChange(change: number): {
  text: string;
  color: string;
  icon: string;
} {
  const isPositive = change > 0;
  const absChange = Math.abs(change);
  const formatted = formatToDP(absChange, 2);
  
  return {
    text: `${isPositive ? "+" : "-"}${formatted}%`,
    color: isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
    icon: isPositive ? "📈" : "📉"
  };
}

/**
 * Format confidence level with color
 * 0-33: Red, 33-67: Yellow, 67-100: Green
 */
export function formatConfidenceWithColor(value: number): {
  text: string;
  color: string;
  level: "low" | "medium" | "high";
} {
  const normalized = Math.max(0, Math.min(100, value));
  const formatted = formatToDP(normalized, 2);
  
  let level: "low" | "medium" | "high";
  let color: string;
  
  if (normalized >= 67) {
    level = "high";
    color = "text-green-600 dark:text-green-400";
  } else if (normalized >= 33) {
    level = "medium";
    color = "text-yellow-600 dark:text-yellow-400";
  } else {
    level = "low";
    color = "text-red-600 dark:text-red-400";
  }
  
  return {
    text: `${formatted}%`,
    color,
    level
  };
}

/**
 * Format probability with color
 * Similar to confidence
 */
export function formatProbabilityWithColor(value: number): {
  text: string;
  color: string;
  level: "low" | "medium" | "high";
} {
  return formatConfidenceWithColor(value);
}

/**
 * Format risk score (1-10) with color
 * 1-3: Green (low), 4-7: Yellow (medium), 8-10: Red (high)
 */
export function formatRiskScore(value: number): {
  text: string;
  color: string;
  level: "low" | "medium" | "high";
} {
  const clamped = Math.max(1, Math.min(10, value));
  const formatted = formatToDP(clamped, 2);
  
  let level: "low" | "medium" | "high";
  let color: string;
  
  if (clamped <= 3) {
    level = "low";
    color = "text-green-600 dark:text-green-400";
  } else if (clamped <= 7) {
    level = "medium";
    color = "text-yellow-600 dark:text-yellow-400";
  } else {
    level = "high";
    color = "text-red-600 dark:text-red-400";
  }
  
  return {
    text: formatted,
    color,
    level
  };
}
