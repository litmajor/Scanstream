/**
 * Symbol Universe Type Definitions (Client-Side)
 * 
 * Mirrors server-side types for client components.
 * These are serialized over the API.
 */

/**
 * Supported asset classes
 */
export type AssetClass = 'crypto' | 'forex' | 'equities' | 'commodities' | 'indices';

/**
 * Supported quote currencies
 */
export type QuoteCurrency =
  | 'USDT'
  | 'USDC'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'JPY'
  | 'CHF'
  | 'AUD'
  | 'CAD'
  | 'NZD'
  | 'SGD';

/**
 * Instrument types (Gap #3)
 */
export type InstrumentType = 'spot' | 'cfd' | 'future' | 'option' | 'perpetual';

/**
 * Symbol metadata
 */
export interface SymbolMetadata {
  precisionPrice: number;
  precisionSize: number;
  custody?: string;
  settlement?: string;
  settlementCurrency?: string;
  marginCurrency?: string;
  tradingHours?: string;
  volume24h?: number;
  maxLeverage?: number;
  contractMultiplier?: number;
  expirationDate?: number;
  minOrderValue?: number;
  tags?: string[];
}

/**
 * Base symbol definition
 */
export interface Symbol {
  symbol: string;
  name: string;
  base: string;
  quote: string;
  assetClass: AssetClass;
  instrumentType?: InstrumentType;
  primaryVenue?: string;
  venues: Record<string, string>;
  metadata: SymbolMetadata;
  active: boolean;
  createdAt: number;
}

/**
 * Symbol lookup query
 */
export interface SymbolLookupQuery {
  symbol?: string;
  assetClass?: AssetClass | AssetClass[];
  venue?: string;
  activeOnly?: boolean;
  limit?: number;
}

/**
 * Symbol UI configuration
 */
export interface SymbolUIConfig {
  // UI toggles
  showAssetClass?: boolean;
  showQuote?: boolean;
  showLiquidity?: boolean;
  showTradingHours?: boolean;
  abbreviate?: boolean;

  // Visuals
  icons: Record<AssetClass, string>;
  colors: Record<AssetClass, string>;
  displayVariants: ('COMPACT' | 'STANDARD' | 'FULL' | 'CARD')[];
}

/**
 * Runtime state for tradability (Gap #1)
 */
export interface SymbolRuntimeState {
  symbol: string;
  isMarketOpen: boolean;
  isTradeable: boolean;
  venueAvailable: boolean;
  liquidityState: 'HIGH' | 'MEDIUM' | 'LOW';
  lastTradeTs?: number;
  lastQuoteTs?: number;
  mode: 'LIVE' | 'REPLAY';
  closureReason?: string;
  nextOpenTime?: number;
  estimatedSpread?: number;
  meta: {
    assetClass: AssetClass;
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
  };
}

/**
 * Formatted symbol for display
 */
export interface FormattedSymbolResult {
  canonical: string;
  displayName: string;
  shortCode: string;
  pairDisplay: string;
  assetClassBadge: string;
  assetClassIcon: string;
  color: string;
  tradingHours?: string;
  volumeDisplay?: string;
  instrumentTypeBadge?: string;
  meta: {
    assetClass: AssetClass;
    base: string;
    quote: string;
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
 * Lookup result
 */
export interface LookupResult {
  found: boolean;
  symbols: Symbol[];
  totalMatches: number;
}

/**
 * Hook options
 */
export interface UseSymbolUniverseOptions {
  autoLoad?: boolean;
  watchChanges?: boolean;
  assetClassFilter?: AssetClass | AssetClass[];
}
