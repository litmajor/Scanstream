import { DEFAULT_HARD_LIMITS, HARD_LIMIT_CEILINGS } from '../risk/hard-limit-gate';

export type QuoteConversionDirection = 'direct' | 'inverse';

export interface QuoteConversion {
  sourceCurrency: string;
  quoteCurrency: string;
  sourceAmount: number;
  quoteAmount: number;
  rate: number;
  market: string;
  direction: QuoteConversionDirection;
  tickerTimestamp: number;
  convertedAt: string;
}

export type QuoteConversionResult =
  | { status: 'known'; conversion: QuoteConversion }
  | { status: 'unknown'; reason: string };

export interface QuoteConverterOptions {
  maxAgeMs?: number;
  clock?: () => number;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function positive(value: unknown): value is number {
  return finite(value) && value > 0;
}

function envMaxAge(): number {
  const configured = Number(process.env.PNL_CONVERSION_MAX_AGE_MS);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.min(configured, HARD_LIMIT_CEILINGS.maxSignalAgeMs);
  }
  return DEFAULT_HARD_LIMITS.maxSignalAgeMs;
}

export class QuoteCurrencyConverter {
  private readonly maxAgeMs: number;
  private readonly clock: () => number;

  constructor(options: QuoteConverterOptions = {}) {
    this.maxAgeMs = Number.isFinite(options.maxAgeMs) && (options.maxAgeMs as number) > 0
      ? Math.min(options.maxAgeMs as number, HARD_LIMIT_CEILINGS.maxSignalAgeMs)
      : envMaxAge();
    this.clock = options.clock ?? Date.now;
  }

  async convert(
    exchange: any,
    sourceCurrency: string,
    quoteCurrency: string,
    sourceAmount: number,
  ): Promise<QuoteConversionResult> {
    if (typeof sourceCurrency !== 'string' || typeof quoteCurrency !== 'string') {
      return { status: 'unknown', reason: 'conversion_currency_invalid' };
    }
    const source = sourceCurrency.trim().toUpperCase();
    const quote = quoteCurrency.trim().toUpperCase();
    if (!source || !quote || source === quote) {
      return { status: 'unknown', reason: 'conversion_currency_invalid' };
    }
    if (!finite(sourceAmount)) {
      return { status: 'unknown', reason: 'conversion_amount_unknown' };
    }

    const direct = this.findMarket(exchange, `${source}/${quote}`);
    const inverse = direct ? null : this.findMarket(exchange, `${quote}/${source}`);
    if (!direct && !inverse) return { status: 'unknown', reason: 'conversion_market_missing' };
    if (typeof exchange?.fetchTicker !== 'function') {
      return { status: 'unknown', reason: 'conversion_ticker_unsupported' };
    }

    const market = direct ?? inverse;
    if (!market) return { status: 'unknown', reason: 'conversion_market_missing' };
    const direction: QuoteConversionDirection = direct ? 'direct' : 'inverse';
    let ticker: any;
    try {
      ticker = await exchange.fetchTicker(market);
    } catch {
      return { status: 'unknown', reason: 'conversion_ticker_failed' };
    }

    const tickerTimestamp = Number(ticker?.timestamp);
    const now = this.clock();
    if (!finite(tickerTimestamp) || now < tickerTimestamp || now - tickerTimestamp > this.maxAgeMs) {
      return { status: 'unknown', reason: 'conversion_ticker_stale_or_timestamp_unknown' };
    }
    const rate = Number(ticker?.last);
    if (!positive(rate)) return { status: 'unknown', reason: 'conversion_price_invalid' };

    const quoteAmount = direct ? sourceAmount * rate : sourceAmount / rate;
    if (!finite(quoteAmount)) return { status: 'unknown', reason: 'conversion_result_invalid' };
    return {
      status: 'known',
      conversion: {
        sourceCurrency: source,
        quoteCurrency: quote,
        sourceAmount,
        quoteAmount,
        rate,
        market,
        direction,
        tickerTimestamp,
        convertedAt: new Date(now).toISOString(),
      },
    };
  }

  private findMarket(exchange: any, symbol: string): string | null {
    if (exchange?.markets?.[symbol]) return symbol;
    if (Array.isArray(exchange?.symbols) && exchange.symbols.includes(symbol)) return symbol;
    return null;
  }
}

export default QuoteCurrencyConverter;
