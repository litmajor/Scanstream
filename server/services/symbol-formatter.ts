/**
 * SYMBOL FORMATTER — Unified UI Rendering
 * 
 * Ensures consistent symbol display across all components.
 * Whether it's BTC/USDT (crypto) or EUR/USD (forex),
 * the UI behaves and looks identical.
 * 
 * Key Rule: The user should forget what asset class it is.
 */

import type { Symbol, SymbolUIConfig } from '../types/symbol-universe';
import { AssetClass } from '../types/symbol-universe';
import { symbolManager } from './symbol-manager';

/**
 * Formatted symbol ready for UI rendering
 */
export interface FormattedSymbol {
  /**
   * Canonical symbol (e.g., "BTC/USDT")
   */
  canonical: string;

  /**
   * Display name for the symbol (e.g., "Bitcoin")
   */
  displayName: string;

  /**
   * Short code (e.g., "BTC")
   */
  shortCode: string;

  /**
   * Full pair display (e.g., "BTC / USDT")
   */
  pairDisplay: string;

  /**
   * Asset class badge (e.g., "CRYPTO")
   */
  assetClassBadge: string;

  /**
   * Asset class icon (e.g., "₿")
   */
  assetClassIcon: string;

  /**
   * Color for this asset class
   */
  color: string;

  /**
   * Trading hours (if applicable)
   */
  tradingHours?: string;

  /**
   * Volume indicator (human readable)
   */
  volumeDisplay?: string;

  /**
   * Instrument type display (e.g., "SPOT", "CFD", "FUTURES")
   */
  instrumentTypeBadge?: string;

  /**
   * Full metadata for component use
   */
  meta: {
    assetClass: AssetClass;
    base: string;
    quote?: string;
    precisionPrice: number;
    precisionSize: number;
    custody?: string;
    settlement?: string;
    settlementCurrency?: string;
    marginCurrency?: string;
    instrumentType?: string;
    maxLeverage?: number;
    contractMultiplier?: number;
    expirationDate?: number;
    minOrderValue?: number;
    tags?: string[];
  };
}

/**
 * Symbol display variant for different UI contexts
 */
export enum DisplayVariant {
  /**
   * Minimal: Just the symbol
   * Example: "BTC/USDT"
   */
  COMPACT = 'compact',

  /**
   * Standard: Symbol + asset class badge
   * Example: "BTC/USDT [CRYPTO]"
   */
  STANDARD = 'standard',

  /**
   * Full: All available information
   * Example: "Bitcoin (BTC/USDT) [CRYPTO] 💱"
   */
  FULL = 'full',

  /**
   * Card: Rich card with metadata
   * Used in detailed views
   */
  CARD = 'card',
}

export class SymbolFormatter {
  constructor(private uiConfig: SymbolUIConfig = symbolManager.getUIConfig()) {}

  /**
   * Format symbol for UI display
   */
  format(canonical: string, variant: DisplayVariant = DisplayVariant.STANDARD): FormattedSymbol {
    const symbol = symbolManager.getSymbol(canonical);
    if (!symbol) {
      throw new Error(`Symbol not found: ${canonical}`);
    }

    const [base, quote] = symbol.symbol.split('/');
    const uiConfig = this.uiConfig;

    const formatted: FormattedSymbol = {
      canonical: symbol.symbol,
      displayName: symbol.name,
      shortCode: base,
      pairDisplay: quote ? `${base} / ${quote}` : base,
      assetClassBadge: symbol.assetClass.toUpperCase(),
      assetClassIcon: uiConfig.icons[symbol.assetClass] || '',
      color: uiConfig.colors[symbol.assetClass] || '#666',
      tradingHours: symbol.metadata.tradingHours,
      volumeDisplay: this.formatVolume(symbol.metadata.volume24h),
      instrumentTypeBadge: symbol.instrumentType ? symbol.instrumentType.toUpperCase() : 'SPOT',
      meta: {
        assetClass: symbol.assetClass,
        base: symbol.base,
        quote: symbol.quote,
        precisionPrice: symbol.metadata.precisionPrice,
        precisionSize: symbol.metadata.precisionSize,
        custody: symbol.metadata.custody,
        settlement: symbol.metadata.settlement,
        settlementCurrency: symbol.metadata.settlementCurrency,
        marginCurrency: symbol.metadata.marginCurrency,
        instrumentType: symbol.instrumentType || 'spot',
        maxLeverage: symbol.metadata.maxLeverage,
        contractMultiplier: symbol.metadata.contractMultiplier,
        expirationDate: symbol.metadata.expirationDate,
        minOrderValue: symbol.metadata.minOrderValue,
        tags: symbol.metadata.tags,
      },
    };

    return formatted;
  }

  /**
   * Render symbol as HTML string (for quick display)
   */
  render(canonical: string, variant: DisplayVariant = DisplayVariant.STANDARD): string {
    const formatted = this.format(canonical, variant);

    switch (variant) {
      case DisplayVariant.COMPACT:
        return formatted.canonical;

      case DisplayVariant.STANDARD:
        if (this.uiConfig.showAssetClass) {
          return `${formatted.canonical} ${this.renderBadge(formatted.assetClassBadge, formatted.color)}`;
        }
        return formatted.canonical;

      case DisplayVariant.FULL:
        return (
          `${formatted.assetClassIcon} ${formatted.displayName} ` +
          `(${formatted.canonical})` +
          (this.uiConfig.showAssetClass ? ` ${this.renderBadge(formatted.assetClassBadge, formatted.color)}` : '')
        );

      case DisplayVariant.CARD:
        return this.renderCard(formatted);

      default:
        return formatted.canonical;
    }
  }

  /**
   * Check if UI should behave differently for this symbol
   * This is THE KEY RULE: it should NOT.
   * 
   * Returns empty object (all symbols treated identically)
   */
  getUIBehaviorDifferences(canonical: string): Record<string, any> {
    // IMPORTANT: This should be empty
    // All symbols (crypto, forex, equities) get identical UI treatment
    return {};
  }

  /**
   * Get consistent icon for this asset class
   */
  getIcon(assetClass: AssetClass): string {
    return this.uiConfig.icons[assetClass] || '';
  }

  /**
   * Get consistent color for this asset class
   */
  getColor(assetClass: AssetClass): string {
    return this.uiConfig.colors[assetClass] || '#666';
  }

  /**
   * Format volume for display
   * Examples: 1.2M, 34.5K, etc
   */
  private formatVolume(volume?: number): string {
    if (!volume || volume === 0) return 'N/A';

    if (volume >= 1_000_000_000) {
      return `$${(volume / 1_000_000_000).toFixed(1)}B`;
    }
    if (volume >= 1_000_000) {
      return `$${(volume / 1_000_000).toFixed(1)}M`;
    }
    if (volume >= 1_000) {
      return `$${(volume / 1_000).toFixed(1)}K`;
    }
    return `$${volume.toFixed(0)}`;
  }

  /**
   * Render HTML badge
   */
  private renderBadge(text: string, color: string): string {
    return `<span style="background-color: ${color}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: bold;">${text}</span>`;
  }

  /**
   * Render card (rich display)
   */
  private renderCard(formatted: FormattedSymbol): string {
    let html = `
      <div style="border: 1px solid #ddd; border-radius: 8px; padding: 12px; background: white;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 24px; margin-right: 8px; display: inline-block;">
              ${formatted.assetClassIcon}
            </div>
            <h3 style="margin: 0; display: inline-block;">
              ${formatted.displayName}
            </h3>
          </div>
          <div style="text-align: right;">
            ${this.renderBadge(formatted.assetClassBadge, formatted.color)}
          </div>
        </div>
        <div style="margin-top: 8px; color: #666; font-size: 14px;">
          <div><strong>Pair:</strong> ${formatted.pairDisplay}</div>
          <div><strong>Canonical:</strong> ${formatted.canonical}</div>
    `;

    if (formatted.tradingHours) {
      html += `<div><strong>Trading Hours:</strong> ${formatted.tradingHours}</div>`;
    }

    if (formatted.volumeDisplay) {
      html += `<div><strong>24h Volume:</strong> ${formatted.volumeDisplay}</div>`;
    }

    if (formatted.meta.tags && formatted.meta.tags.length > 0) {
      html += `<div><strong>Tags:</strong> ${formatted.meta.tags.join(', ')}</div>`;
    }

    html += `</div></div>`;

    return html;
  }
}

/**
 * Price formatter respecting symbol precision
 */
export class PriceFormatter {
  constructor(private symbol: Symbol) {}

  /**
   * Format price with correct decimal places
   */
  format(price: number): string {
    const decimals = this.symbol.metadata.precisionPrice;
    return price.toFixed(decimals);
  }

  /**
   * Parse and validate price string
   */
  parse(priceStr: string): number | null {
    const parsed = parseFloat(priceStr);
    if (isNaN(parsed)) return null;

    // Check against minimum tick if available
    if (this.symbol.metadata.minTick) {
      const remainder = parsed % this.symbol.metadata.minTick;
      if (remainder !== 0) {
        console.warn(`Price ${parsed} not aligned to tick ${this.symbol.metadata.minTick}`);
      }
    }

    return parsed;
  }
}

/**
 * Size formatter respecting symbol precision
 */
export class SizeFormatter {
  constructor(private symbol: Symbol) {}

  /**
   * Format size with correct decimal places
   */
  format(size: number): string {
    const decimals = this.symbol.metadata.precisionSize;
    return size.toFixed(decimals);
  }

  /**
   * Parse and validate size string
   */
  parse(sizeStr: string): number | null {
    const parsed = parseFloat(sizeStr);
    if (isNaN(parsed)) return null;
    return parsed;
  }
}

/**
 * Global symbol formatter instance
 */
export const symbolFormatter = new SymbolFormatter();

/**
 * Quick helper to format a symbol
 */
export function formatSymbol(canonical: string, variant: DisplayVariant = DisplayVariant.STANDARD): string {
  return symbolFormatter.render(canonical, variant);
}

/**
 * Quick helper to get formatted symbol object
 */
export function getFormattedSymbol(canonical: string): FormattedSymbol {
  return symbolFormatter.format(canonical);
}
