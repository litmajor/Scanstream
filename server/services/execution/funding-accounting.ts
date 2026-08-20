import fs from 'fs';
import path from 'path';

export const FUNDING_STATE_SCHEMA_VERSION = 1;
export const DEFAULT_FUNDING_INITIAL_LOOKBACK_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_FUNDING_RECHECK_INTERVAL_MS = 60 * 60 * 1000;
const MAX_FUNDING_INITIAL_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const FUNDING_PAGE_LIMIT = 200;

export interface FundingPayment {
  id: string;
  symbol: string;
  amount: number;
  currency: string;
  timestamp: number;
  source: 'funding_history' | 'ledger';
}

interface FundingBaselineAttestation {
  symbol: string;
  reason: string;
  attestedAt: string;
}

interface FundingState {
  schemaVersion: number;
  writtenAt: string;
  payments: FundingPayment[];
  lastCheckedAt: Record<string, number>;
  lastKnownAt: Record<string, number>;
  initialLookbackUnknown: Record<string, boolean>;
  initialLookbackSince: Record<string, number>;
  baselineAttestations: Record<string, FundingBaselineAttestation>;
}

export type FundingLoadResult =
  | { status: 'absent' }
  | { status: 'ok'; state: FundingState }
  | { status: 'unreadable'; reason: string };

export type FundingAccountingResult =
  | { status: 'not_required'; payments: FundingPayment[] }
  | { status: 'known'; payments: FundingPayment[] }
  | { status: 'unknown'; reason: string; payments: FundingPayment[] };

export interface FundingAccountingOptions {
  filePath?: string;
  clock?: () => number;
  initialLookbackMs?: number;
  recheckIntervalMs?: number;
}

const DEFAULT_FILE_PATH = path.join(process.cwd(), 'data', 'funding-accounting.json');

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function marketType(exchange: any, symbol: string): string | null {
  const market = exchange?.markets?.[symbol];
  if (!market) return null;
  if (market.type) return String(market.type).toLowerCase();
  if (market.info?.contractType) return String(market.info.contractType).toLowerCase();
  return null;
}

function isSpotMarket(exchange: any, symbol: string): boolean {
  const market = exchange?.markets?.[symbol];
  return market?.type === 'spot' || market?.spot === true;
}

function isSwapMarket(exchange: any, symbol: string): boolean {
  const market = exchange?.markets?.[symbol];
  const contractType = String(market?.info?.contractType ?? '').toLowerCase();
  return (
    marketType(exchange, symbol) === 'swap' ||
    market?.swap === true ||
    contractType === 'perpetual' ||
    contractType === 'swap'
  );
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function resolveMarketRecord(exchange: unknown, candidate: string): Record<string, unknown> | null {
  const exchangeRecord = recordValue(exchange);
  const marketMethod = exchangeRecord?.market;
  if (typeof marketMethod === 'function') {
    try {
      const market = marketMethod.call(exchange, candidate);
      const record = recordValue(market);
      if (record) return record;
    } catch {
      // Fall through to the exchange's raw-id index.
    }
  }

  const marketsById = recordValue(exchangeRecord?.markets_by_id);
  const indexed = marketsById?.[candidate];
  const candidates = Array.isArray(indexed) ? indexed : [indexed];
  for (const market of candidates) {
    const record = recordValue(market);
    if (record) return record;
  }

  const markets = recordValue(exchangeRecord?.markets);
  const unified = recordValue(markets?.[candidate]);
  if (unified) return unified;

  return null;
}

function isContractMarket(market: Record<string, unknown>): boolean {
  const type = typeof market.type === 'string' ? market.type.toLowerCase() : '';
  const info = recordValue(market.info);
  const contractType = typeof info?.contractType === 'string'
    ? info.contractType.toLowerCase()
    : '';
  return market.swap === true
    || market.contract === true
    || ['swap', 'future', 'futures', 'contract', 'perpetual'].includes(type)
    || ['swap', 'future', 'futures', 'contract', 'perpetual'].includes(contractType);
}

function ledgerAttribution(
  exchange: unknown,
  row: unknown,
  requestedSymbol: string,
): 'unattributable' | 'ambiguous' | 'other' | 'matched' {
  const rowRecord = recordValue(row);
  const info = recordValue(rowRecord?.info);
  const candidates = [
    rowRecord?.symbol,
    ...(info ? Object.values(info) : []),
  ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0);
  const resolvedSymbols = new Set<string>();
  for (const candidate of candidates) {
    const market = resolveMarketRecord(exchange, candidate);
    const symbol = typeof market?.symbol === 'string' && market.symbol ? market.symbol : null;
    if (market && symbol && isContractMarket(market)) resolvedSymbols.add(symbol);
  }

  if (resolvedSymbols.size === 0) return 'unattributable';
  if (resolvedSymbols.size > 1) return 'ambiguous';
  return resolvedSymbols.has(requestedSymbol) ? 'matched' : 'other';
}

export class FundingAccounting {
  private readonly filePath: string;
  private readonly clock: () => number;
  private readonly initialLookbackMs: number;
  private readonly recheckIntervalMs: number;
  private state: FundingState = {
    schemaVersion: FUNDING_STATE_SCHEMA_VERSION,
    writtenAt: new Date(0).toISOString(),
    payments: [],
    lastCheckedAt: {},
    lastKnownAt: {},
    initialLookbackUnknown: {},
    initialLookbackSince: {},
    baselineAttestations: {},
  };

  constructor(options: FundingAccountingOptions = {}) {
    this.filePath = options.filePath ?? DEFAULT_FILE_PATH;
    this.clock = options.clock ?? Date.now;
    this.initialLookbackMs = Math.min(
      Math.max(options.initialLookbackMs ?? DEFAULT_FUNDING_INITIAL_LOOKBACK_MS, 1),
      MAX_FUNDING_INITIAL_LOOKBACK_MS,
    );
    this.recheckIntervalMs = Math.max(options.recheckIntervalMs ?? DEFAULT_FUNDING_RECHECK_INTERVAL_MS, 0);
  }

  getPath(): string {
    return this.filePath;
  }

  load(): FundingLoadResult {
    if (!fs.existsSync(this.filePath)) {
      this.state = {
        schemaVersion: FUNDING_STATE_SCHEMA_VERSION,
        writtenAt: new Date(0).toISOString(),
        payments: [],
        lastCheckedAt: {},
        lastKnownAt: {},
        initialLookbackUnknown: {},
        initialLookbackSince: {},
        baselineAttestations: {},
      };
      return { status: 'absent' };
    }
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      const normalized = this.normalizeState(parsed);
      if (!this.isValidState(normalized)) {
        return { status: 'unreadable', reason: 'unknown or invalid funding state schema' };
      }
      this.state = normalized;
      return { status: 'ok', state: normalized };
    } catch (error: any) {
      return {
        status: 'unreadable',
        reason: error?.message ? String(error.message) : 'funding state could not be parsed',
      };
    }
  }

  async reconcile(exchange: any, symbol: string): Promise<FundingAccountingResult> {
    if (isSpotMarket(exchange, symbol)) return { status: 'not_required', payments: [] };
    if (!isSwapMarket(exchange, symbol)) return { status: 'unknown', reason: 'market_type_unknown', payments: [] };
    const source = this.selectSource(exchange);
    if (!source) return { status: 'unknown', reason: 'funding_source_unsupported', payments: [] };

    const now = this.clock();
    const lastKnownAt = this.state.lastKnownAt[symbol];
    if (finite(lastKnownAt) && now - lastKnownAt < this.recheckIntervalMs) {
      return { status: 'known', payments: [] };
    }

    const since = this.state.lastCheckedAt[symbol] ?? now - this.initialLookbackMs;
    const initial = this.state.lastCheckedAt[symbol] === undefined;
    const initialCoverageUnknown = this.state.initialLookbackUnknown[symbol] === true;
    const initialBoundary = this.state.initialLookbackSince[symbol] ?? since;
    const rows: any[] = [];
    let pageSince = since;
    let complete = false;
    let firstPage = true;
    let firstPageShort = false;
    let oldestTimestamp = Number.POSITIVE_INFINITY;
    let ledgerCurrency: string | undefined;
    if (source === 'ledger') {
      const marketRecord = resolveMarketRecord(exchange, symbol);
      if (!marketRecord) return { status: 'unknown', reason: 'funding_ledger_market_unknown', payments: [] };
      const currency = marketRecord?.settle ?? marketRecord?.quote;
      if (typeof currency !== 'string' || !currency) {
        return { status: 'unknown', reason: 'funding_ledger_currency_unknown', payments: [] };
      }
      ledgerCurrency = currency;
    }
    for (let page = 0; page < 1000; page += 1) {
      let response: unknown;
      try {
        response = source === 'funding_history'
          ? await exchange.fetchFundingHistory(symbol, pageSince, FUNDING_PAGE_LIMIT)
          : await exchange.fetchLedger(ledgerCurrency, pageSince, FUNDING_PAGE_LIMIT);
      } catch (error: any) {
        return {
          status: 'unknown',
          reason: error?.message ? `funding_history_query_failed:${error.message}` : 'funding_history_query_failed',
          payments: [],
        };
      }
      if (!Array.isArray(response)) return { status: 'unknown', reason: 'funding_history_unusable', payments: [] };
      rows.push(...(source === 'ledger'
        ? response.filter((row: any) => this.isFundingLedgerRow(row))
        : response));
      if (firstPage) {
        firstPageShort = response.length < FUNDING_PAGE_LIMIT;
        firstPage = false;
      }
      for (const row of response) {
        const timestamp = Number(row?.timestamp ?? (row?.datetime ? Date.parse(row.datetime) : NaN));
        if (finite(timestamp)) oldestTimestamp = Math.min(oldestTimestamp, timestamp);
      }
      if (response.length < FUNDING_PAGE_LIMIT) {
        complete = true;
        break;
      }
      const timestamps = response
        .map((row: any) => row?.timestamp ?? (row?.datetime ? Date.parse(row.datetime) : null))
        .map(Number)
        .filter((timestamp: number) => finite(timestamp));
      if (timestamps.length !== response.length) {
        return { status: 'unknown', reason: 'funding_page_cursor_unknown', payments: [] };
      }
      const nextSince = Math.max(...timestamps) + 1;
      if (nextSince <= pageSince) {
        return { status: 'unknown', reason: 'funding_page_cursor_stalled', payments: [] };
      }
      pageSince = nextSince;
    }
    if (!complete) return { status: 'unknown', reason: 'funding_history_pagination_limit', payments: [] };
    const coverageProven = initial
      ? firstPageShort || oldestTimestamp <= initialBoundary
      : oldestTimestamp <= initialBoundary;

    const additions: FundingPayment[] = [];
    for (const row of rows) {
      if (source === 'ledger') {
        const attribution = ledgerAttribution(exchange, row, symbol);
        if (attribution === 'unattributable') {
          return { status: 'unknown', reason: 'funding_ledger_unattributable', payments: additions };
        }
        if (attribution === 'ambiguous') {
          return { status: 'unknown', reason: 'funding_ledger_attribution_ambiguous', payments: additions };
        }
        if (attribution === 'other') continue;
      }
      const id = row?.id ?? row?.info?.id ?? row?.info?.paymentId;
      const amount = row?.amount ?? row?.cost ?? row?.info?.amount;
      const currency = row?.currency ?? row?.info?.currency;
      const timestamp = row?.timestamp ?? (row?.datetime ? Date.parse(row.datetime) : null);
      if (typeof id !== 'string' && typeof id !== 'number') {
        return { status: 'unknown', reason: 'funding_payment_id_unknown', payments: additions };
      }
      if (!finite(Number(amount)) || typeof currency !== 'string' || !currency || !finite(Number(timestamp))) {
        return { status: 'unknown', reason: 'funding_payment_fields_unknown', payments: additions };
      }
      const payment: FundingPayment = {
        id: String(id),
        symbol,
        amount: Number(amount),
        currency: currency.toUpperCase(),
        timestamp: Number(timestamp),
        source,
      };
      if (!this.state.payments.some((existing) => existing.id === payment.id) &&
          !additions.some((existing) => existing.id === payment.id)) {
        additions.push(payment);
      }
    }

    const nextLastCheckedAt = { ...this.state.lastCheckedAt };
    const nextLastKnownAt = { ...this.state.lastKnownAt };
    nextLastCheckedAt[symbol] = now;
    const coverageUnknown = (initial || initialCoverageUnknown) && !coverageProven;
    if ((!initial && !coverageUnknown) || (initial && coverageProven)) nextLastKnownAt[symbol] = now;
    const nextInitialLookbackUnknown = { ...this.state.initialLookbackUnknown };
    if (initial) nextInitialLookbackUnknown[symbol] = !coverageProven;
    const nextInitialLookbackSince = { ...this.state.initialLookbackSince };
    if (initial) nextInitialLookbackSince[symbol] = since;
    const next: FundingState = {
      schemaVersion: FUNDING_STATE_SCHEMA_VERSION,
      writtenAt: new Date(now).toISOString(),
      payments: [...this.state.payments, ...additions],
      lastCheckedAt: nextLastCheckedAt,
      lastKnownAt: nextLastKnownAt,
      initialLookbackUnknown: nextInitialLookbackUnknown,
      initialLookbackSince: nextInitialLookbackSince,
      baselineAttestations: { ...this.state.baselineAttestations },
    };
    try {
      this.write(next);
      this.state = next;
    } catch {
      return { status: 'unknown', reason: 'funding_state_persistence_failed', payments: additions };
    }
    if (coverageUnknown) {
      return {
        status: 'unknown',
        reason: 'funding_history_older_than_initial_lookback',
        payments: additions,
      };
    }
    return { status: 'known', payments: additions };
  }

  attestInitialCoverage(symbol: string, reason: string): void {
    if (!symbol || symbol.includes('*')) throw new Error('a specific funding symbol is required');
    if (!reason.trim()) throw new Error('funding baseline reason is required');
    if (this.state.initialLookbackUnknown[symbol] !== true) {
      throw new Error('funding baseline is not awaiting attestation');
    }
    const now = this.clock();
    const next: FundingState = {
      ...this.state,
      writtenAt: new Date(now).toISOString(),
      initialLookbackUnknown: { ...this.state.initialLookbackUnknown, [symbol]: false },
      baselineAttestations: {
        ...this.state.baselineAttestations,
        [symbol]: {
          symbol,
          reason: reason.trim(),
          attestedAt: new Date(now).toISOString(),
        },
      },
      lastKnownAt: { ...this.state.lastKnownAt },
    };
    delete next.lastKnownAt[symbol];
    this.write(next);
    this.state = next;
  }

  payments(): FundingPayment[] {
    return this.state.payments.map((payment) => ({ ...payment }));
  }

  private write(next: FundingState): void {
    const directory = path.dirname(this.filePath);
    const temporaryPath = `${this.filePath}.${process.pid}.${this.clock()}.tmp`;
    try {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(temporaryPath, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 });
      const fd = fs.openSync(temporaryPath, 'r');
      try {
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(temporaryPath, this.filePath);
      const directoryFd = fs.openSync(directory, 'r');
      try {
        fs.fsyncSync(directoryFd);
      } finally {
        fs.closeSync(directoryFd);
      }
    } catch (error) {
      try {
        fs.unlinkSync(temporaryPath);
      } catch {
        // The previous funding state remains authoritative if cleanup fails.
      }
      throw error;
    }
  }

  private isValidState(value: unknown): value is FundingState {
    if (!value || typeof value !== 'object') return false;
    const state = value as Partial<FundingState>;
    return (
      state.schemaVersion === FUNDING_STATE_SCHEMA_VERSION &&
      typeof state.writtenAt === 'string' &&
      Array.isArray(state.payments) &&
      !!state.lastCheckedAt &&
      typeof state.lastCheckedAt === 'object' &&
      Object.values(state.lastCheckedAt).every((timestamp) => finite(timestamp)) &&
      !!state.lastKnownAt &&
      typeof state.lastKnownAt === 'object' &&
      Object.values(state.lastKnownAt).every((timestamp) => finite(timestamp)) &&
      !!state.initialLookbackUnknown &&
      typeof state.initialLookbackUnknown === 'object' &&
      Object.values(state.initialLookbackUnknown).every((unknown) => typeof unknown === 'boolean') &&
      !!state.initialLookbackSince &&
      typeof state.initialLookbackSince === 'object' &&
      Object.values(state.initialLookbackSince).every((timestamp) => finite(timestamp)) &&
      !!state.baselineAttestations &&
      typeof state.baselineAttestations === 'object' &&
      Object.values(state.baselineAttestations).every((attestation) =>
        !!attestation &&
        typeof attestation.symbol === 'string' &&
        typeof attestation.reason === 'string' &&
        typeof attestation.attestedAt === 'string'
      ) &&
      state.payments.every((payment) =>
        payment &&
        typeof payment.id === 'string' &&
        typeof payment.symbol === 'string' &&
        finite(payment.amount) &&
        typeof payment.currency === 'string' &&
        (payment.source === 'funding_history' || payment.source === 'ledger') &&
        finite(payment.timestamp)
      )
    );
  }

  private selectSource(exchange: any): 'funding_history' | 'ledger' | null {
    const has = exchange?.has ?? {};
    if (has.fetchFundingHistory === true || has.fetchFundingHistory === 'emulated') {
      return 'funding_history';
    }
    if (has.fetchLedger === true || has.fetchLedger === 'emulated') {
      return 'ledger';
    }
    return null;
  }

  private isFundingLedgerRow(row: any): boolean {
    const type = String(row?.type ?? row?.info?.type ?? '').toLowerCase();
    return type.includes('funding');
  }

  private normalizeState(value: unknown): unknown {
    if (!value || typeof value !== 'object') return value;
    const state = value as Record<string, unknown>;
    return {
      ...state,
      payments: Array.isArray(state.payments)
        ? state.payments.map((payment) => (
          payment && typeof payment === 'object' && (payment as Record<string, unknown>).source === undefined
            ? { ...(payment as Record<string, unknown>), source: 'funding_history' }
            : payment
        ))
        : state.payments,
      initialLookbackSince:
        state.initialLookbackSince === undefined
          ? { ...((state.lastCheckedAt as Record<string, number> | undefined) ?? {}) }
          : state.initialLookbackSince,
      baselineAttestations: state.baselineAttestations === undefined ? {} : state.baselineAttestations,
    };
  }
}

export default FundingAccounting;
