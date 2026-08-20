import fs from 'fs';
import path from 'path';
import { realizedPnl, type FeeTotal } from './fill-accounting';

export const REALIZED_PNL_SCHEMA_VERSION = 1;

export type RealizedPnlCategory = 'trade' | 'funding' | 'resolution' | 'conversion';

export interface PnlConversionRecord {
  kind: 'fee' | 'funding';
  feeIndex: number;
  sourceCurrency: string;
  quoteCurrency: string;
  sourceAmount: number;
  quoteAmount: number;
  rate: number;
  market: string;
  direction: 'direct' | 'inverse';
  tickerTimestamp: number;
  convertedAt: string;
}

export interface RealizedPnlEntry {
  id: string;
  category: RealizedPnlCategory;
  at: string;
  symbol: string;
  quoteCurrency: string;
  pnl: number | null;
  grossPnl: number | null;
  quoteFees: number | null;
  unconvertedFees: FeeTotal[];
  quantity?: number | null;
  entryPrice?: number | null;
  exitPrice?: number | null;
  fundingAmount?: number | null;
  fundingCurrency?: string | null;
  fundingSource?: 'funding_history' | 'ledger';
  resolutionFor?: string;
  resolution?: RealizedPnlResolution;
  conversionFor?: string;
  conversion?: PnlConversionRecord;
}

export type RealizedPnlResolution =
  | {
      kind: 'attested_value';
      pnl: number;
      reason: string;
      attestedAt: string;
    }
  | {
      kind: 'excluded_unknown';
      reason: string;
      attestedAt: string;
    };

export interface RealizedPnlState {
  schemaVersion: number;
  writtenAt: string;
  entries: RealizedPnlEntry[];
}

export type RealizedPnlLoadResult =
  | { status: 'absent' }
  | { status: 'ok'; state: RealizedPnlState }
  | { status: 'unreadable'; reason: string };

export interface RealizedPnlLedgerOptions {
  filePath?: string;
  clock?: () => number;
}

export interface RealizedPnlSummary {
  pnl: number | null;
  unknown: boolean;
  unconvertedFees: FeeTotal[];
  tradePnl: number | null;
  fundingPnl: number | null;
  entries: number;
}

export interface RealizedClosePnlInput {
  side: 'long' | 'short';
  entryPrice: number | null | undefined;
  exitPrice: number | null | undefined;
  quantity: number | null | undefined;
  fees: FeeTotal[] | null | undefined;
  quoteCurrency: string | null | undefined;
}

export interface RealizedClosePnl {
  grossPnl: number | null;
  pnl: number | null;
  quoteFees: number | null;
  unconvertedFees: FeeTotal[];
  reason?: string;
}

const DEFAULT_FILE_PATH = path.join(process.cwd(), 'data', 'realized-pnl-ledger.json');

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function positive(value: unknown): value is number {
  return finite(value) && value > 0;
}

function dateKey(at: string): string {
  return new Date(at).toISOString().slice(0, 10);
}

export function computeRealizedClosePnl(input: RealizedClosePnlInput): RealizedClosePnl {
  if (!positive(input.entryPrice)) return { grossPnl: null, pnl: null, quoteFees: null, unconvertedFees: [], reason: 'entry_price_unknown' };
  if (!positive(input.exitPrice)) return { grossPnl: null, pnl: null, quoteFees: null, unconvertedFees: [], reason: 'exit_price_unknown' };
  if (!positive(input.quantity)) return { grossPnl: null, pnl: null, quoteFees: null, unconvertedFees: [], reason: 'close_quantity_unknown' };
  if (!input.quoteCurrency || !Array.isArray(input.fees)) {
    return { grossPnl: null, pnl: null, quoteFees: null, unconvertedFees: [], reason: 'fee_or_quote_currency_unknown' };
  }
  if (input.fees.some((fee) => !fee || typeof fee.currency !== 'string' || !finite(fee.cost))) {
    return { grossPnl: null, pnl: null, quoteFees: null, unconvertedFees: [], reason: 'fee_record_unknown' };
  }

  const result = realizedPnl({
    side: input.side,
    entryPrice: input.entryPrice,
    exitPrice: input.exitPrice,
    quantity: input.quantity,
    fees: input.fees,
    quoteCurrency: input.quoteCurrency,
  });
  const quote = input.quoteCurrency.toUpperCase();
  const quoteFees = input.fees
    .filter((fee) => fee.currency.toUpperCase() === quote)
    .reduce((sum, fee) => sum + fee.cost, 0);
  return {
    grossPnl: result.gross,
    pnl: result.net,
    quoteFees,
    unconvertedFees: result.unconvertedFees,
  };
}

export class RealizedPnlLedger {
  private readonly filePath: string;
  private readonly clock: () => number;
  private state: RealizedPnlState = {
    schemaVersion: REALIZED_PNL_SCHEMA_VERSION,
    writtenAt: new Date(0).toISOString(),
    entries: [],
  };

  constructor(options: RealizedPnlLedgerOptions = {}) {
    this.filePath = options.filePath ?? DEFAULT_FILE_PATH;
    this.clock = options.clock ?? Date.now;
  }

  getPath(): string {
    return this.filePath;
  }

  load(): RealizedPnlLoadResult {
    if (!fs.existsSync(this.filePath)) {
      this.state = {
        schemaVersion: REALIZED_PNL_SCHEMA_VERSION,
        writtenAt: new Date(0).toISOString(),
        entries: [],
      };
      return { status: 'absent' };
    }

    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (!this.isValidState(parsed)) {
        return { status: 'unreadable', reason: 'unknown or invalid realized PnL schema' };
      }
      this.state = parsed;
      return { status: 'ok', state: parsed };
    } catch (error: any) {
      return {
        status: 'unreadable',
        reason: error?.message ? String(error.message) : 'realized PnL ledger could not be parsed',
      };
    }
  }

  append(entry: RealizedPnlEntry): boolean {
    if (this.state.entries.some((existing) => existing.id === entry.id)) return false;
    const nextEntries = [...this.state.entries, {
      ...entry,
      unconvertedFees: entry.unconvertedFees.map((fee) => ({ ...fee })),
      conversion: entry.conversion ? { ...entry.conversion } : undefined,
    }];
    const next: RealizedPnlState = {
      schemaVersion: REALIZED_PNL_SCHEMA_VERSION,
      writtenAt: new Date(this.clock()).toISOString(),
      entries: nextEntries,
    };
    this.write(next);
    this.state = next;
    return true;
  }

  appendConversion(entryId: string, conversion: PnlConversionRecord): boolean {
    const source = this.state.entries.find((entry) => entry.id === entryId);
    if (!source || source.category === 'conversion' || source.category === 'resolution') {
      throw new Error('realized PnL conversion source not found');
    }
    if (conversion.kind === 'funding' && source.category !== 'funding') {
      throw new Error('funding conversion requires a funding entry');
    }
    if (conversion.kind === 'fee' && source.category !== 'trade') {
      throw new Error('fee conversion requires a trade entry');
    }
    if (!Number.isInteger(conversion.feeIndex) || conversion.feeIndex < 0 ||
        conversion.feeIndex >= source.unconvertedFees.length) {
      throw new Error('realized PnL conversion fee index is invalid');
    }
    const expectedAmount = conversion.kind === 'funding'
      ? source.fundingAmount
      : source.unconvertedFees[conversion.feeIndex]?.cost;
    const expectedCurrency = conversion.kind === 'funding'
      ? source.fundingCurrency
      : source.unconvertedFees[conversion.feeIndex]?.currency;
    if (!finite(expectedAmount) ||
        conversion.sourceAmount !== expectedAmount ||
        conversion.sourceCurrency.toUpperCase() !== expectedCurrency?.toUpperCase()) {
      throw new Error('realized PnL conversion source does not match entry');
    }
    if (this.state.entries.some((entry) =>
      entry.category === 'conversion' &&
      entry.conversionFor === entryId &&
      entry.conversion?.feeIndex === conversion.feeIndex
    )) return false;

    const entry: RealizedPnlEntry = {
      id: `conversion:${entryId}:${conversion.feeIndex}`,
      category: 'conversion',
      at: conversion.convertedAt,
      symbol: source.symbol,
      quoteCurrency: source.quoteCurrency,
      pnl: 0,
      grossPnl: 0,
      quoteFees: 0,
      unconvertedFees: [],
      conversionFor: entryId,
      conversion: { ...conversion },
    };
    return this.append(entry);
  }

  resolveUnknown(
    id: string,
    resolution:
      | { kind: 'attested_value'; pnl: number; reason: string }
      | { kind: 'excluded_unknown'; reason: string }
  ): RealizedPnlEntry {
    const index = this.state.entries.findIndex((entry) => entry.id === id);
    if (index < 0) throw new Error('realized PnL entry not found');
    const current = this.state.entries[index];
    if (current.pnl !== null || current.category === 'resolution' ||
      this.state.entries.some((entry) => entry.resolutionFor === id)) {
      throw new Error('realized PnL entry is already resolved');
    }
    if (resolution.kind === 'attested_value' && !finite(resolution.pnl)) {
      throw new Error('attested realized PnL must be finite');
    }
    if (!resolution.reason.trim()) throw new Error('resolution reason is required');

    const resolved: RealizedPnlEntry = {
      id: `resolution:${id}:${this.clock()}`,
      category: 'resolution',
      at: new Date(this.clock()).toISOString(),
      symbol: current.symbol,
      quoteCurrency: current.quoteCurrency,
      pnl: 0,
      grossPnl: 0,
      quoteFees: 0,
      unconvertedFees: [],
      resolutionFor: id,
      resolution: {
        ...resolution,
        reason: resolution.reason.trim(),
        attestedAt: new Date(this.clock()).toISOString(),
      },
    };
    const entries = [...this.state.entries, resolved];
    const next: RealizedPnlState = {
      schemaVersion: REALIZED_PNL_SCHEMA_VERSION,
      writtenAt: new Date(this.clock()).toISOString(),
      entries,
    };
    this.write(next);
    this.state = next;
    return { ...current, resolution: resolved.resolution, unconvertedFees: current.unconvertedFees.map((fee) => ({ ...fee })) };
  }

  summary(now: number = this.clock()): RealizedPnlSummary {
    const today = new Date(now).toISOString().slice(0, 10);
    const entries = this.state.entries.filter((entry) => {
      try {
        return dateKey(entry.at) === today;
      } catch {
        return false;
      }
    });
    const resolutions = new Map(
      this.state.entries
        .filter((entry) => entry.category === 'resolution' && entry.resolutionFor)
        .map((entry) => [entry.resolutionFor as string, entry.resolution])
    );
    const conversions = new Map<string, RealizedPnlEntry[]>();
    for (const entry of this.state.entries.filter((candidate) => candidate.category === 'conversion' && candidate.conversionFor)) {
      const existing = conversions.get(entry.conversionFor as string) ?? [];
      existing.push(entry);
      conversions.set(entry.conversionFor as string, existing);
    }
    const baseEntries = entries.filter((entry) =>
      entry.category !== 'resolution' && entry.category !== 'conversion'
    );
    let pnl = 0;
    let tradePnl = 0;
    let fundingPnl = 0;
    let unknown = false;
    const unconvertedFees: FeeTotal[] = [];

    for (const entry of baseEntries) {
      const resolution = resolutions.get(entry.id);
      const conversionEntries = conversions.get(entry.id) ?? [];
      const feeConversions = new Map(
        conversionEntries
          .filter((conversion) => conversion.conversion?.kind === 'fee')
          .map((conversion) => [conversion.conversion?.feeIndex, conversion])
      );
      const fundingConversions = conversionEntries.filter((conversion) => conversion.conversion?.kind === 'funding');
      const convertedIndexes = new Set(
        conversionEntries
          .map((conversion) => conversion.conversion?.feeIndex)
          .filter((index): index is number => Number.isInteger(index))
      );
      const allFeesConverted = entry.unconvertedFees.every((_fee, index) => convertedIndexes.has(index));
      const convertedFeeQuoteAmount = [...feeConversions.values()]
        .reduce((sum, conversion) => sum + (conversion.conversion?.quoteAmount ?? 0), 0);
      const convertedFundingQuoteAmount = fundingConversions
        .reduce((sum, conversion) => sum + (conversion.conversion?.quoteAmount ?? 0), 0);
      let effectivePnl = resolution?.kind === 'attested_value' ? resolution.pnl : entry.pnl;
      if (!resolution && entry.unconvertedFees.length > 0 && entry.category === 'funding' &&
          fundingConversions.length > 0 && allFeesConverted) {
        effectivePnl = convertedFundingQuoteAmount;
      } else if (!resolution && entry.unconvertedFees.length > 0 && allFeesConverted && effectivePnl !== null) {
        effectivePnl -= convertedFeeQuoteAmount;
      } else if (!resolution && entry.unconvertedFees.length > 0) {
        effectivePnl = null;
      }
      if (resolution?.kind === 'excluded_unknown') {
        // Explicit exclusion removes the unknown from the daily gate, but the
        // original entry and any non-quote fees remain visible for review.
      } else if (effectivePnl === null || !finite(effectivePnl)) {
        unknown = true;
      } else {
        pnl += effectivePnl;
        if (entry.category === 'trade') tradePnl += effectivePnl;
        else fundingPnl += effectivePnl;
      }
      for (const [index, fee] of entry.unconvertedFees.entries()) {
        if (convertedIndexes.has(index)) continue;
        const existing = unconvertedFees.find((candidate) => candidate.currency === fee.currency);
        if (existing) existing.cost += fee.cost;
        else unconvertedFees.push({ ...fee });
      }
    }

    return {
      pnl: unknown ? null : pnl,
      unknown,
      unconvertedFees,
      tradePnl: unknown ? null : tradePnl,
      fundingPnl: unknown ? null : fundingPnl,
      entries: baseEntries.length,
    };
  }

  entries(): RealizedPnlEntry[] {
    return this.state.entries.map((entry) => ({
      ...entry,
      unconvertedFees: entry.unconvertedFees.map((fee) => ({ ...fee })),
      conversion: entry.conversion ? { ...entry.conversion } : undefined,
    }));
  }

  private write(next: RealizedPnlState): void {
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
        // The previous ledger remains authoritative if cleanup also fails.
      }
      throw error;
    }
  }

  private isValidState(value: unknown): value is RealizedPnlState {
    if (!value || typeof value !== 'object') return false;
    const state = value as Partial<RealizedPnlState>;
    return (
      state.schemaVersion === REALIZED_PNL_SCHEMA_VERSION &&
      typeof state.writtenAt === 'string' &&
      Array.isArray(state.entries) &&
      state.entries.every((entry) => this.isValidEntry(entry))
    );
  }

  private isValidEntry(value: unknown): value is RealizedPnlEntry {
    if (!value || typeof value !== 'object') return false;
    const entry = value as Partial<RealizedPnlEntry>;
    if (
      typeof entry.id !== 'string' ||
      (entry.category !== 'trade' && entry.category !== 'funding' &&
        entry.category !== 'resolution' && entry.category !== 'conversion') ||
      typeof entry.at !== 'string' ||
      typeof entry.symbol !== 'string' ||
      typeof entry.quoteCurrency !== 'string' ||
      (entry.fundingSource !== undefined &&
        entry.fundingSource !== 'funding_history' &&
        entry.fundingSource !== 'ledger') ||
      (entry.pnl !== null && !finite(entry.pnl)) ||
      (entry.grossPnl !== null && !finite(entry.grossPnl)) ||
      (entry.quoteFees !== null && !finite(entry.quoteFees)) ||
      !Array.isArray(entry.unconvertedFees) ||
      !entry.unconvertedFees.every((fee) => fee && typeof fee.currency === 'string' && finite(fee.cost))
    ) return false;

    if (entry.category === 'resolution') {
      return typeof entry.resolutionFor === 'string' &&
        !!entry.resolution &&
        ((entry.resolution.kind === 'attested_value' && finite(entry.resolution.pnl)) ||
          (entry.resolution.kind === 'excluded_unknown' && entry.pnl === 0)) &&
        typeof entry.resolution.reason === 'string' &&
        typeof entry.resolution.attestedAt === 'string' &&
        !entry.conversion &&
        !entry.conversionFor;
    }
    if (entry.category === 'conversion') {
      return typeof entry.conversionFor === 'string' &&
        !!entry.conversion &&
        (entry.conversion.kind === 'fee' || entry.conversion.kind === 'funding') &&
        Number.isInteger(entry.conversion.feeIndex) &&
        entry.conversion.feeIndex >= 0 &&
        typeof entry.conversion.sourceCurrency === 'string' &&
        typeof entry.conversion.quoteCurrency === 'string' &&
        finite(entry.conversion.sourceAmount) &&
        finite(entry.conversion.quoteAmount) &&
        finite(entry.conversion.rate) &&
        entry.conversion.rate > 0 &&
        typeof entry.conversion.market === 'string' &&
        (entry.conversion.direction === 'direct' || entry.conversion.direction === 'inverse') &&
        finite(entry.conversion.tickerTimestamp) &&
        typeof entry.conversion.convertedAt === 'string' &&
        !entry.resolution &&
        !entry.resolutionFor;
    }
    return !entry.resolution && !entry.resolutionFor && !entry.conversion && !entry.conversionFor;
  }
}

export default RealizedPnlLedger;
