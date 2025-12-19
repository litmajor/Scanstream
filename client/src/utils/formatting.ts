/**
 * Context-Aware Formatting Utilities
 * 
 * Replaces blanket formatToDP() with intelligent formatters:
 * - formatPrice: Auto-detects decimal places based on price magnitude
 * - formatMetric: For percentages, ratios, Sharpe, profit factor (always 2 DP)
 * - formatCurrency: USD formatting with locale
 * - formatPct: Percentage with symbol
 * - formatQuantity: Trade quantities and volumes
 */

/**
 * Format asset prices with intelligent decimal place detection
 * 
 * Rules:
 * - > $100: 2 decimals (e.g., $43,251.00)
 * - $1-$100: 4 decimals (e.g., $0.2154)
 * - $0.01-$1: 6 decimals (e.g., $0.001234)
 * - < $0.01: Scientific notation (e.g., 1.23e-8)
 * 
 * @example
 * formatPrice(43251.6789) → "43,251.68"
 * formatPrice(0.0001234) → "0.000123"
 * formatPrice(0.000000000123) → "1.23e-11"
 */
export function formatPrice(price: number, options?: { symbol?: string; showCommas?: boolean }): string {
  const { symbol = '$', showCommas = true } = options || {};
  
  if (typeof price !== 'number' || isNaN(price)) return '–';
  if (!isFinite(price)) return 'Infinity';
  
  let decimals = 2;
  const absPrice = Math.abs(price);
  
  // Auto-detect decimals based on magnitude
  if (absPrice < 0.01 && absPrice > 0) {
    // Very small prices: use scientific notation
    return `${symbol}${price.toExponential(2)}`;
  } else if (absPrice < 1) {
    decimals = 6; // $0.001234
  } else if (absPrice < 100) {
    decimals = 4; // $0.2154
  }
  // else: > 100, use 2 decimals
  
  const formatted = price.toFixed(decimals);
  
  if (!showCommas) return `${symbol}${formatted}`;
  
  // Add thousands separator
  const [whole, fraction] = formatted.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${symbol}${withCommas}${fraction ? '.' + fraction : ''}`;
}

/**
 * Format percentage values (always 2 decimal places)
 * 
 * @example
 * formatPct(75.2547) → "75.25%"
 * formatPct(2.5) → "2.50%"
 * formatPct(-5.333) → "-5.33%"
 */
export function formatPct(value: number, decimals: number = 2): string {
  if (typeof value !== 'number' || isNaN(value)) return '–';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format metrics: Sharpe ratio, profit factor, win rate, etc.
 * Always 2 decimal places for consistency
 * 
 * @example
 * formatMetric(2.1547) → "2.15"
 * formatMetric(1.999) → "2.00"
 * formatMetric(0.5234) → "0.52"
 */
export function formatMetric(value: number, decimals: number = 2): string {
  if (typeof value !== 'number' || isNaN(value)) return '–';
  return value.toFixed(decimals);
}

/**
 * Format currency amounts (USD with locale)
 * 
 * @example
 * formatCurrency(1000) → "$1,000.00"
 * formatCurrency(1234567.89) → "$1,234,567.89"
 * formatCurrency(-500) → "-$500.00"
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
 * Format trade quantity/volume with commas and appropriate decimals
 * 
 * Rules:
 * - Whole numbers: no decimals (e.g., 1000, 500000)
 * - Fractional amounts: up to 8 decimals for crypto (e.g., 0.12345678 BTC)
 * 
 * @example
 * formatQuantity(1000) → "1,000"
 * formatQuantity(0.12345678) → "0.12345678"
 * formatQuantity(1234567.5) → "1,234,567.5"
 */
export function formatQuantity(quantity: number, decimals?: number): string {
  if (typeof quantity !== 'number' || isNaN(quantity)) return '–';
  
  // If decimals not specified, auto-detect
  if (decimals === undefined) {
    decimals = quantity === Math.floor(quantity) ? 0 : 8;
  }
  
  const formatted = quantity.toFixed(decimals);
  const [whole, fraction] = formatted.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  return fraction ? `${withCommas}.${fraction}` : withCommas;
}

/**
 * Format P&L (profit/loss) with color-coded sign
 * Returns object with value and className for styling
 * 
 * @example
 * formatPnL(250.50) → { value: "+$250.50", className: "text-green-400" }
 * formatPnL(-150.25) → { value: "-$150.25", className: "text-red-400" }
 */
export function formatPnL(pnl: number): { value: string; className: string } {
  if (typeof pnl !== 'number' || isNaN(pnl)) return { value: '–', className: 'text-gray-400' };
  
  const formatted = formatCurrency(pnl);
  const isPositive = pnl > 0;
  const isNeutral = pnl === 0;
  
  return {
    value: isPositive && !isNeutral ? `+${formatted}` : formatted,
    className: isPositive ? 'text-green-400' : isNeutral ? 'text-gray-400' : 'text-red-400'
  };
}

/**
 * Format win rate as percentage with visual indicator
 * 
 * @example
 * formatWinRate(75.5) → "75.50%"
 * formatWinRate(50) → "50.00%"
 */
export function formatWinRate(rate: number): string {
  if (typeof rate !== 'number' || isNaN(rate)) return '–';
  return formatPct(Math.min(100, Math.max(0, rate)));
}

/**
 * Format time duration (hours, days, months)
 * 
 * @example
 * formatDuration(0.5) → "30 min"
 * formatDuration(24) → "1 day"
 * formatDuration(720) → "1 month"
 */
export function formatDuration(hours: number): string {
  if (typeof hours !== 'number' || isNaN(hours)) return '–';
  
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} min`;
  } else if (hours < 24) {
    return `${hours.toFixed(1)} h`;
  } else if (hours < 720) {
    const days = (hours / 24).toFixed(1);
    return `${days} day${days !== '1' ? 's' : ''}`;
  } else {
    const months = (hours / 720).toFixed(1);
    return `${months} mo`;
  }
}

/**
 * Format confidence/probability as percentage (0-100)
 * 
 * @example
 * formatConfidence(0.75) → "75%" (if 0-1 range)
 * formatConfidence(75) → "75%" (if 0-100 range)
 */
export function formatConfidence(confidence: number): string {
  if (typeof confidence !== 'number' || isNaN(confidence)) return '–';
  
  // Auto-detect range (0-1 or 0-100)
  const value = confidence > 1 ? confidence : confidence * 100;
  return formatPct(Math.min(100, Math.max(0, value)), 0);
}

/**
 * Format numbers with appropriate thousand separators
 * Used for large numbers that aren't prices or currency
 * 
 * @example
 * formatNumber(1000000) → "1,000,000"
 * formatNumber(42) → "42"
 */
export function formatNumber(value: number, decimals: number = 0): string {
  if (typeof value !== 'number' || isNaN(value)) return '–';
  
  const formatted = value.toFixed(decimals);
  const [whole, fraction] = formatted.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  return fraction ? `${withCommas}.${fraction}` : withCommas;
}

/**
 * Legacy support: format to N decimal places (context-agnostic)
 * DEPRECATED: Use specific formatters (formatPrice, formatMetric, etc.) instead
 */
export function formatToDP(value: number, decimals: number = 2): string {
  if (typeof value !== 'number' || isNaN(value)) return '–';
  return value.toFixed(decimals);
}

/**
 * Formatting configuration and rules
 */
export const FORMATTING_RULES = {
  // Price formatting rules (by field name)
  fields: {
    // Prices & levels
    price: { type: 'price', description: 'Asset price' },
    entry_price: { type: 'price', description: 'Entry price' },
    stop_loss: { type: 'price', description: 'Stop loss level' },
    target: { type: 'price', description: 'Target price' },
    current_price: { type: 'price', description: 'Current market price' },
    
    // Support/Resistance
    support: { type: 'price', description: 'Support level' },
    resistance: { type: 'price', description: 'Resistance level' },
    
    // Metrics (always 2 DP)
    win_rate: { type: 'pct', description: 'Win rate percentage' },
    profit_factor: { type: 'metric', description: 'Profit factor ratio' },
    sharpe_ratio: { type: 'metric', description: 'Sharpe ratio' },
    confidence: { type: 'confidence', description: 'Confidence 0-1 or 0-100' },
    
    // Currency amounts
    profit: { type: 'currency', description: 'Profit amount' },
    loss: { type: 'currency', description: 'Loss amount' },
    pnl: { type: 'pnl', description: 'P&L amount' },
    total_profit: { type: 'currency', description: 'Total profit' },
    entry_value: { type: 'currency', description: 'Entry trade value' },
    exit_value: { type: 'currency', description: 'Exit trade value' },
    
    // Quantities
    quantity: { type: 'quantity', description: 'Trade quantity' },
    volume: { type: 'quantity', description: 'Volume' },
    size: { type: 'quantity', description: 'Position size' },
    filled_quantity: { type: 'quantity', description: 'Filled quantity' },
    
    // Duration
    duration: { type: 'duration', description: 'Trade duration in hours' },
    estimated_duration_hours: { type: 'duration', description: 'Estimated duration' },
  }
} as const;

/**
 * Auto-format value based on field name
 * Useful for generic display components
 * 
 * @example
 * autoFormat('entry_price', 43251.6789) → "$43,251.68"
 * autoFormat('win_rate', 75.5) → "75.50%"
 * autoFormat('profit', 1000) → "$1,000.00"
 */
export function autoFormat(fieldName: string, value: number): string {
  const rule = FORMATTING_RULES.fields[fieldName as keyof typeof FORMATTING_RULES.fields];
  
  if (!rule) return formatToDP(value); // fallback
  
  switch (rule.type) {
    case 'price':
      return formatPrice(value);
    case 'pct':
      return formatWinRate(value);
    case 'metric':
      return formatMetric(value);
    case 'confidence':
      return formatConfidence(value);
    case 'currency':
      return formatCurrency(value);
    case 'pnl':
      return formatPnL(value).value;
    case 'quantity':
      return formatQuantity(value);
    case 'duration':
      return formatDuration(value);
    default:
      return formatToDP(value);
  }
}
