/**
 * SYMBOL UNIVERSE — The Global Map
 * 
 * Everything downstream references symbols from this universe.
 * Never raw broker names or exchange-specific formats.
 * 
 * Key Principle:
 * The UI should behave identically for BTC/USDT and EUR/USD.
 * Asset class is transparent.
 */

/**
 * Asset class enumeration
 * Represents the fundamental nature of the tradeable asset
 */
export enum AssetClass {
  CRYPTO = 'crypto',      // Bitcoin, Ethereum, etc
  FOREX = 'forex',         // EUR/USD, GBP/JPY, etc
  EQUITIES = 'equities',   // AAPL, GOOGL, etc
  COMMODITIES = 'commodities', // Gold, Oil, etc
  INDICES = 'indices',     // SPX, DAX, etc
}

/**
 * Quote currency (base of pair denomination)
 */
export enum QuoteCurrency {
  USDT = 'USDT',   // Tether (crypto standard)
  USDC = 'USDC',   // USD Coin
  USD = 'USD',     // US Dollar
  EUR = 'EUR',     // Euro
  GBP = 'GBP',     // British Pound
  JPY = 'JPY',     // Japanese Yen
  CHF = 'CHF',     // Swiss Franc
  AUD = 'AUD',     // Australian Dollar
  CAD = 'CAD',     // Canadian Dollar
  NZD = 'NZD',     // New Zealand Dollar
  SGD = 'SGD',     // Singapore Dollar
}

/**
 * Instrument type
 * Same symbol can trade as different instruments
 * Examples:
 * - EUR/USD spot (immediate settlement)
 * - EUR/USD CFD (contract for difference, leveraged)
 * - EUR/USD futures (exchange-traded contracts)
 * - SPY options (calls, puts)
 */
export enum InstrumentType {
  SPOT = 'spot',           // Physical/immediate settlement
  CFD = 'cfd',             // Contract for difference
  FUTURE = 'future',       // Futures contract
  OPTION = 'option',       // Options (calls/puts)
  PERPETUAL = 'perpetual', // Perpetual futures (crypto)
}

/**
 * A canonical symbol in the universe
 * 
 * Examples:
 * - Crypto: BTC/USDT, ETH/USDT, SOL/USDT
 * - Forex: EUR/USD, GBP/JPY, USD/JPY
 * - Equities: AAPL, GOOGL, MSFT (no pair notation)
 */
export interface Symbol {
  /**
   * Canonical symbol identifier
   * Format:
   * - Crypto pairs: "BASE/QUOTE" (e.g., "BTC/USDT")
   * - Forex pairs: "BASE/QUOTE" (e.g., "EUR/USD")
   * - Equities: "TICKER" (e.g., "AAPL")
   */
  symbol: string;

  /**
   * Asset class: what kind of asset is this?
   */
  assetClass: AssetClass;

  /**
   * Instrument type
   * How is this symbol traded?
   * Default: spot (physical/immediate settlement)
   * 
   * Examples:
   * - BTC/USDT spot vs BTC/USDT perpetual
   * - EUR/USD spot vs EUR/USD CFD vs EUR/USD futures
   * - SPY spot vs SPY options
   */
  instrumentType?: InstrumentType;

  /**
   * Base asset (left side of pair)
   * Examples: BTC, ETH, EUR, GBP, AAPL
   */
  base: string;

  /**
   * Quote currency (right side of pair, if applicable)
   * For equities, this is typically the listing exchange or "USD"
   * Examples: USDT, USD, JPY
   */
  quote?: string;

  /**
   * Human-readable name
   * Examples: "Bitcoin", "Ethereum", "EUR/USD Pair"
   */
  name: string;

  /**
   * Exchanges where this symbol is available
   * Key: exchange name (binance, kraken, oanda, etc)
   * Value: how this symbol is represented on that exchange
   * 
   * Examples:
   * {
   *   binance: "BTCUSDT",
   *   kraken: "XBTUSDT",
   *   oanda: "EUR_USD"
   * }
   */
  venues: Record<string, string>;

  /**
   * Primary venue for this symbol (default source)
   * Used when no specific venue is requested
   */
  primaryVenue?: string;

  /**
   * Metadata specific to this asset
   */
  metadata: {
    /**
     * Decimal precision for this symbol
     * Examples: BTC = 8, EUR/USD = 5, AAPL = 2
     */
    precisionPrice: number;

    /**
     * Minimum order size / quantity precision
     */
    precisionSize: number;

    /**
     * Minimum tick (price step)
     * Examples: BTC = 0.01, EUR/USD = 0.0001
     */
    minTick?: number;

    /**
     * 24h typical volume in quote currency
     */
    volume24h?: number;

    /**
     * Trading hours (for equities especially)
     * Format: "HH:MM-HH:MM UTC" or "24h"
     */
    tradingHours?: string;

    /**
     * Custody considerations
     * crypto: self-custodial possible
     * forex: custodial (broker holds)
     * equities: custodial (broker holds)
     */
    custody?: 'self' | 'custodial';

    /**
     * Settlement time (T+0, T+1, T+2, etc)
     */
    settlement?: string;

    /**
     * Settlement currency (for forex)
     * Different from quote in some cases
     * Example: EUR/USD trading on OANDA with USD settlement but KES margin
     */
    settlementCurrency?: string;

    /**
     * Margin/account currency (for leverage trading)
     * The currency required for margin on this symbol
     * Can differ from settlement currency
     * Example: EUR/USD on MT5 might require USD margin
     */
    marginCurrency?: string;

    /**
     * Leverage available (for CFD/futures)
     * Spot trading: 1x (no leverage)
     * CFD: up to 500x depending on regulation
     * Futures: varies by contract
     * Perpetual: up to 125x typical
     */
    maxLeverage?: number;

    /**
     * Contract multiplier (for futures/options)
     * Notional value per contract unit
     * Examples:
     * - Standard lot forex: 100,000 units
     * - Micro lot forex: 1,000 units
     * - ES futures: $50 per point
     * - Options: 100 shares per contract
     */
    contractMultiplier?: number;

    /**
     * Expiration date (for futures/options)
     * Unix timestamp in milliseconds
     * Undefined for spot/perpetual
     * Example: 1741996800000 (March 20, 2025, 16:00 UTC)
     */
    expirationDate?: number;

    /**
     * Minimum order value in quote currency
     * Used to validate order size
     */
    minOrderValue?: number;

    /**
     * Custom metadata (flags, indicators, tags)
     */
    tags?: string[];
  };

  /**
   * When this symbol was added to the universe
   */
  createdAt: number;

  /**
   * Last time this symbol's data was updated
   */
  lastSeen?: number;

  /**
   * Is this symbol active/tradeable?
   */
  active: boolean;
}

/**
 * RUNTIME STATE — Time-Dependent Tradability
 * 
 * Symbols are static truth. But tradability is dynamic.
 * This interface captures runtime conditions.
 * 
 * NOT STORED. Produced by Market Data Layer.
 * Agents trade runtime state, not static symbols.
 * 
 * Examples:
 * - EUR/USD: market open 22:00-21:00 UTC (5 days/week)
 * - AAPL: market open 09:30-16:00 EST (weekdays)
 * - BTC/USDT: 24/7 but venue can go down
 */
export interface SymbolRuntimeState {
  /**
   * Canonical symbol (reference to Symbol)
   */
  symbol: string;

  /**
   * Is the underlying market open right now?
   * Examples:
   * - EUR/USD: false between 21:00-22:00 UTC (weekend)
   * - AAPL: false on weekends
   * - BTC/USDT: always true (crypto 24/7)
   */
  isMarketOpen: boolean;

  /**
   * Can we actually trade this symbol right now?
   * isMarketOpen && venueAvailable && liquidityState !== 'LOW'
   * 
   * False if:
   * - Exchange is down
   * - Symbol is halted/suspended
   * - Regulatory restrictions
   */
  isTradeable: boolean;

  /**
   * Is the venue (exchange) currently available?
   * Examples:
   * - Binance: true if API responding
   * - OANDA: false if maintenance window
   */
  venueAvailable: boolean;

  /**
   * Current liquidity state
   * 'HIGH': Normal trading conditions
   * 'MEDIUM': Reduced liquidity (premarket, afterhours)
   * 'LOW': Very thin, large spreads (closing time, holidays)
   */
  liquidityState: 'HIGH' | 'MEDIUM' | 'LOW';

  /**
   * Timestamp of last successful trade for this symbol
   * Undefined if never traded in session
   * Useful for detecting staleness
   */
  lastTradeTs?: number;

  /**
   * Timestamp of last bid/ask quote update
   */
  lastQuoteTs?: number;

  /**
   * Current market mode
   * 'LIVE': Real market conditions
   * 'REPLAY': Simulated historical conditions
   * Useful for agents: can adjust behavior differently
   */
  mode: 'LIVE' | 'REPLAY';

  /**
   * Why is market closed? (if isMarketOpen = false)
   * Used for logging and debugging
   * Examples: 'weekend', 'holiday', 'market-closed', 'venue-maintenance'
   */
  closureReason?: string;

  /**
   * When does market open next?
   * Undefined if already open or unknown
   */
  nextOpenTime?: number;

  /**
   * Estimated spread (bid-ask) right now
   * Undefined if no data available
   * Useful for estimating slippage
   */
  estimatedSpread?: number;

  /**
   * Metadata snapshot at this moment
   * Reference to current Symbol metadata
   */
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
 * Symbol group for UI categorization
 * Allows symbols to be displayed in logical groups
 */
export interface SymbolGroup {
  /**
   * Group identifier
   * Examples: "major-pairs", "top-100", "watchlist"
   */
  id: string;

  /**
   * Human-readable group name
   */
  name: string;

  /**
   * Asset class filter for this group
   * Omitted = all classes
   */
  assetClass?: AssetClass;

  /**
   * Symbols in this group
   */
  symbols: string[]; // canonical symbols

  /**
   * Display order
   */
  order?: number;

  /**
   * UI hint for how to render this group
   */
  displayMode?: 'list' | 'grid' | 'table' | 'cards';
}

/**
 * UI configuration for symbol rendering
 * Ensures consistency across all components
 */
export interface SymbolUIConfig {
  /**
   * Show asset class badge?
   * If true, display: [CRYPTO], [FOREX], etc
   */
  showAssetClass: boolean;

  /**
   * Show quote currency?
   * If true, display: "BTC / USDT" or "EUR / USD"
   */
  showQuote: boolean;

  /**
   * Show volume/liquidity indicator?
   */
  showLiquidity: boolean;

  /**
   * Show trading hours (for equities)?
   */
  showTradingHours: boolean;

  /**
   * Abbreviate long names?
   * If true: "Ethereum" → "ETH"
   */
  abbreviate: boolean;

  /**
   * Color scheme per asset class
   */
  colors: {
    [AssetClass.CRYPTO]: string;      // e.g., "#F7931A" (bitcoin orange)
    [AssetClass.FOREX]: string;        // e.g., "#1E40AF" (blue)
    [AssetClass.EQUITIES]: string;     // e.g., "#059669" (green)
    [AssetClass.COMMODITIES]: string;  // e.g., "#DC2626" (red)
    [AssetClass.INDICES]: string;      // e.g., "#7C3AED" (purple)
  };

  /**
   * Icon mapping per asset class
   * Use emoji or icon library identifiers
   */
  icons: {
    [AssetClass.CRYPTO]: string;       // e.g., "₿"
    [AssetClass.FOREX]: string;        // e.g., "💱"
    [AssetClass.EQUITIES]: string;     // e.g., "📈"
    [AssetClass.COMMODITIES]: string;  // e.g., "⛽"
    [AssetClass.INDICES]: string;      // e.g., "📊"
  };
}

/**
 * Universe consistency validator
 * Ensures symbols follow rules and don't break UI
 */
export interface UniverseValidationRule {
  /**
   * Rule identifier
   */
  id: string;

  /**
   * Human-readable description
   */
  description: string;

  /**
   * Check function
   * Returns true if symbol passes validation
   */
  validate: (symbol: Symbol) => boolean;

  /**
   * Severity if violated
   */
  severity: 'error' | 'warn';

  /**
   * Auto-fix function (optional)
   * If provided, system can auto-correct violations
   */
  autoFix?: (symbol: Symbol) => Symbol;
}

/**
 * Global symbol universe state
 */
export interface SymbolUniverseState {
  /**
   * All symbols in the universe
   * Key: canonical symbol
   * Value: Symbol definition
   */
  symbols: Map<string, Symbol>;

  /**
   * Groups for UI organization
   */
  groups: Map<string, SymbolGroup>;

  /**
   * UI configuration (consistent across all components)
   */
  uiConfig: SymbolUIConfig;

  /**
   * Validation rules
   */
  validationRules: UniverseValidationRule[];

  /**
   * Statistics
   */
  stats: {
    totalSymbols: number;
    byAssetClass: Record<AssetClass, number>;
    activeSymbols: number;
    lastUpdated: number;
  };
}

/**
 * Event emitted when universe changes
 */
export interface UniverseChangeEvent {
  type: 'symbol.added' | 'symbol.updated' | 'symbol.removed' | 'group.updated';
  symbol?: string; // canonical symbol (if applicable)
  previous?: Symbol; // old value (if updated)
  current?: Symbol; // new value
  timestamp: number;
}

/**
 * Helper type for symbol lookup queries
 */
export interface SymbolLookupQuery {
  /**
   * Search by canonical symbol or partial match
   */
  symbol?: string;

  /**
   * Filter by asset class
   */
  assetClass?: AssetClass | AssetClass[];

  /**
   * Filter by venue/exchange
   */
  venue?: string;

  /**
   * Filter by group
   */
  group?: string;

  /**
   * Only active symbols?
   */
  activeOnly?: boolean;

  /**
   * Limit results
   */
  limit?: number;
}

/**
 * Result of symbol lookup
 */
export interface SymbolLookupResult {
  found: boolean;
  symbols: Symbol[];
  totalMatches: number;
}
