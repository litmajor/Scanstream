/**
 * SYMBOL NORMALIZER — Exchange-Agnostic Format Conversion
 * 
 * Converts raw broker/exchange formats to canonical symbols.
 * Works bidirectionally:
 * - Raw format (exchange-specific) → Canonical (BTC/USDT, EUR/USD)
 * - Canonical → Raw format (for submitting to exchanges)
 * 
 * Examples:
 * - binance: "BTCUSDT" → "BTC/USDT" ✓
 * - kraken: "XBTUSDT" → "BTC/USDT" ✓
 * - oanda: "EUR_USD" → "EUR/USD" ✓
 * - coinbase: "BTC-USD" → "BTC/USD" ✓
 */

import { symbolManager } from './symbol-manager';
import type { Symbol } from '../types/symbol-universe';

/**
 * Normalization result with confidence level
 */
export interface NormalizationResult {
  /**
   * Successfully normalized?
   */
  success: boolean;

  /**
   * Canonical symbol (if successful)
   */
  canonical?: string;

  /**
   * The symbol object (if found)
   */
  symbol?: Symbol;

  /**
   * Why it failed (if unsuccessful)
   */
  error?: string;

  /**
   * Confidence level (0-1)
   * 1.0 = exact match, 0.5 = likely match, etc
   */
  confidence: number;

  /**
   * Hints for fallback handling
   */
  hints?: {
    possibleMatches: string[];
    suggestion?: string;
  };
}

/**
 * Cache for normalization lookups
 * Format: "venue:format" → "canonical"
 */
const normalizationCache = new Map<string, NormalizationResult>();

/**
 * Pattern definitions for different exchanges
 */
const EXCHANGE_PATTERNS: Record<string, RegExp> = {
  // Binance/KuCoin futures: BTCUSDT, BTC-USDT, BTC/USDT
  binance: /^([A-Z0-9]+)(USDT|BUSD|USDC|USD|BNB)$/i,
  kucoinfutures: /^([A-Z0-9]+)[:\-\/]?(USDT|USD|BNB)$/i,
  kraken: /^([A-Z0-9]+)[\/\-]?(USDT|USD|EUR|GBP|JPY)$/i,

  // OANDA: EUR_USD, GBP_JPY
  oanda: /^([A-Z]{3})_([A-Z]{3})$/,

  // Coinbase: BTC-USD, ETH-USD
  coinbase: /^([A-Z0-9]+)\-([A-Z]{3,4})$/,

  // Forex: EURUSD, GBPJPY (no separator)
  forex: /^([A-Z]{3})([A-Z]{3})$/,
};

export class SymbolNormalizer {
  /**
   * Normalize exchange-specific format to canonical symbol
   */
  normalize(format: string, venue: string): NormalizationResult {
    const cacheKey = `${venue}:${format}`;

    // Check cache first
    const cached = normalizationCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Try to resolve directly
    const canonical = symbolManager.resolveVenue(format, venue);
    if (canonical) {
      const result: NormalizationResult = {
        success: true,
        canonical,
        symbol: symbolManager.getSymbol(canonical),
        confidence: 1.0,
      };
      normalizationCache.set(cacheKey, result);
      return result;
    }

    // Try pattern-based matching
    const result = this.patternMatch(format, venue);
    normalizationCache.set(cacheKey, result);
    return result;
  }

  /**
   * Denormalize canonical symbol to venue-specific format
   */
  denormalize(canonical: string, venue: string): NormalizationResult {
    const cacheKey = `denorm:${venue}:${canonical}`;

    const cached = normalizationCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const symbol = symbolManager.getSymbol(canonical);
    if (!symbol) {
      return {
        success: false,
        error: `Symbol not found: ${canonical}`,
        confidence: 0,
      };
    }

    const venueFormat = symbol.venues[venue];
    if (!venueFormat) {
      return {
        success: false,
        error: `Symbol ${canonical} not available on ${venue}`,
        confidence: 0,
        hints: {
          possibleMatches: Object.keys(symbol.venues),
          suggestion: `Try ${Object.keys(symbol.venues)[0] || 'another venue'}`,
        },
      };
    }

    const result: NormalizationResult = {
      success: true,
      canonical,
      symbol,
      confidence: 1.0,
    };

    normalizationCache.set(cacheKey, result);
    return result;
  }

  /**
   * Pattern-based matching (fallback when not in registry)
   * This is smart: handles common exchange formats without being registered
   */
  private patternMatch(format: string, venue: string): NormalizationResult {
    const pattern = EXCHANGE_PATTERNS[venue.toLowerCase()];

    if (!pattern) {
      return {
        success: false,
        error: `Unknown venue: ${venue}`,
        confidence: 0,
      };
    }

    const match = format.match(pattern);
    if (!match) {
      return {
        success: false,
        error: `Format "${format}" doesn't match ${venue} pattern`,
        confidence: 0,
      };
    }

    const [, base, quote] = match;

    // Construct canonical symbol
    let canonical = `${base.toUpperCase()}/${quote.toUpperCase()}`;

    // Normalize quote (USDT → USDT is fine, but handle edge cases)
    if (quote.toUpperCase() === 'BUSD') {
      canonical = `${base.toUpperCase()}/BUSD`;
    }

    // Check if this symbol exists
    const symbol = symbolManager.getSymbol(canonical);

    if (symbol) {
      return {
        success: true,
        canonical,
        symbol,
        confidence: 0.95, // Pattern match is slightly less confident
      };
    }

    // Even if not registered, we can still normalize
    return {
      success: true,
      canonical,
      confidence: 0.7, // Lower confidence (not in registry)
      hints: {
        possibleMatches: [canonical],
        suggestion: `Symbol ${canonical} not in registry. Consider registering it.`,
      },
    };
  }

  /**
   * Batch normalize symbols
   */
  normalizeBatch(
    formats: string[],
    venue: string
  ): Map<string, NormalizationResult> {
    const results = new Map<string, NormalizationResult>();

    for (const format of formats) {
      results.set(format, this.normalize(format, venue));
    }

    return results;
  }

  /**
   * Smart symbol detection (guess what it is)
   * Used when venue is unknown
   */
  detect(format: string): NormalizationResult {
    // Try each known venue
    for (const [venue] of Object.entries(EXCHANGE_PATTERNS)) {
      const result = this.normalize(format, venue);
      if (result.success && result.confidence > 0.8) {
        return { ...result, hints: { possibleMatches: [venue] } };
      }
    }

    // Fallback: try to parse as simple pair
    if (format.includes('/')) {
      const [base, quote] = format.split('/');
      return {
        success: true,
        canonical: format,
        confidence: 0.5,
        hints: {
          possibleMatches: [format],
          suggestion: 'Format looks like a pair, but not registered',
        },
      };
    }

    return {
      success: false,
      error: `Could not detect symbol format: ${format}`,
      confidence: 0,
    };
  }

  /**
   * Validate if a format is valid for a venue
   */
  isValidFormat(format: string, venue: string): boolean {
    const result = this.normalize(format, venue);
    return result.success && result.confidence > 0.7;
  }

  /**
   * Clear cache (useful for testing or after symbol updates)
   */
  clearCache(): void {
    normalizationCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      entries: normalizationCache.size,
      size: Math.round(
        normalizationCache.size * 100 // rough estimate
      ),
    };
  }
}

/**
 * Global normalizer instance
 */
export const symbolNormalizer = new SymbolNormalizer();

/**
 * Quick helpers
 */

export function normalizeSymbol(format: string, venue: string): NormalizationResult {
  return symbolNormalizer.normalize(format, venue);
}

export function denormalizeSymbol(canonical: string, venue: string): NormalizationResult {
  return symbolNormalizer.denormalize(canonical, venue);
}

export function detectSymbol(format: string): NormalizationResult {
  return symbolNormalizer.detect(format);
}

/**
 * Validate symbol format for venue
 * Throws if invalid
 */
export function validateSymbolFormat(format: string, venue: string): string {
  const result = normalizeSymbol(format, venue);

  if (!result.success) {
    throw new Error(
      result.error || `Invalid symbol format: ${format} for ${venue}`
    );
  }

  return result.canonical!;
}
