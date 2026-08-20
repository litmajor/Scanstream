
import * as ccxt from 'ccxt';
import { EventEmitter } from 'events';
import { systemKillSwitch } from './services/system-kill-switch';
import { portfolioRiskManager } from './services/portfolio-risk-manager';
import { liveCircuitBreaker } from './services/live-circuit-breaker';
import { getAccountBalanceUsd } from './services/exchange-utils';
import { db } from './db-storage';
import type { Signal } from '@shared/schema';
import { RLFeedbackCallbacks } from './rl-system-integration';
import { randomUUID } from 'crypto';
import { ModuleLogger, formatError } from './utils/logger';
import { getConfidenceScorer } from './services/market-data/confidence-scorer';
import executionMetrics from './metrics-execution';
import SlippageModel from './services/slippage-model';
import PartialFillSimulator from './services/partial-fill-simulator';
import MockNetwork from './services/mock-network';
import VenueRouter from './services/venue-router';
import OrderRetryPolicy from './services/order-retry-policy';
import { evaluatePreTrade, type HardLimits } from './services/risk/hard-limit-gate';
import { reconcileByClientOrderId, isAmbiguousError, buildClientOrderId } from './services/execution/order-reconciler';
import { recordExecutionBlocked, recordOrderReconciliation, recordFlattenAll } from './services/observability/safety-metrics';
import { durabilityGate } from './services/execution/durability-gate';
import {
  applyFills,
  classifyOutcome,
  computeSlippagePct,
  createFillAccount,
  type ExchangeFill,
  type FeeTotal,
  type FillAccount,
  type OrderOutcome,
} from './services/execution/fill-accounting';
import { reconcileAtStartup, type ReconciliationReport } from './services/execution/startup-reconciler';
import { safetyEventLog } from './services/observability/safety-event-log';
import { getSharedService } from './services/shared-service-registry';
import {
  DurableLocalStateStore,
  type LocalStateLoadResult,
} from './services/execution/durable-local-state';
import {
  computeRealizedClosePnl,
  RealizedPnlLedger,
  type PnlConversionRecord,
  type RealizedPnlLoadResult,
  type RealizedPnlEntry,
} from './services/execution/realized-pnl-ledger';
import { QuoteCurrencyConverter } from './services/execution/quote-conversion';
import { getTickerCache } from './services/ticker-snapshot-cache';
import {
  FundingAccounting,
  type FundingAccountingResult,
  type FundingLoadResult,
} from './services/execution/funding-accounting';
import type { RealizedPnlRiskInput } from './services/portfolio-risk-manager';

// Small helper to bound a promise with a timeout. Returns null on timeout or error.
async function promiseWithTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, ms);

    p.then((v) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(v);
      }
    }).catch((_err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    });
  });
}

interface LiveOrder {
  id: string;
  exchangeOrderId: string;
  clientOrderId?: string | null;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  price?: number;
  amount: number;
  status: 'pending' | 'open' | 'closed' | 'canceled' | 'expired' | 'rejected';
  filled: number;
  remaining: number;
  cost: number;
  fee?: {
    cost: number;
    currency: string;
  };
  /** Fees per currency, never collapsed into one number. */
  fees?: FeeTotal[];
  /** Volume-weighted average execution price, null until something fills. */
  avgPrice?: number | null;
  /** Price the sizing decision was made on, for real slippage measurement. */
  requestedPrice?: number | null;
  /** Signed slippage vs requestedPrice in percent; null when unknown. */
  slippagePct?: number | null;
  outcome?: OrderOutcome;
  /** Idempotent fill ledger; the authoritative source of filled/cost. */
  account?: FillAccount;
  timestamp: number;
  signalId?: string;
}

interface LivePosition {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  leverage: number;
  pnl: number;
  pnlPercent: number;
  stopLoss?: number;
  takeProfit?: number;
  openTime: number;
  marginUsed: number;
  liquidationPrice?: number;
  orders: LiveOrder[];
}

interface LocalOrderState {
  exchangeOrderId: string;
  clientOrderId: string | null | undefined;
  filled: number;
  cost: number;
  remaining: number;
  avgPrice: number | null | undefined;
  slippagePct: number | null | undefined;
  outcome: OrderOutcome | undefined;
  status: LiveOrder['status'];
  fees: FeeTotal[];
  fee?: LiveOrder['fee'];
  account: {
    fillIds: string[];
    filled: number;
    cost: number;
    avgPrice: number | null;
    remaining: number;
    fees: FeeTotal[];
    makerFilled: number;
    takerFilled: number;
    lastFillAt: number | null;
  };
}

function captureOrderState(order: LiveOrder): LocalOrderState {
  const account = order.account ?? createFillAccount();
  return {
    exchangeOrderId: order.exchangeOrderId,
    clientOrderId: order.clientOrderId,
    filled: order.filled,
    cost: order.cost,
    remaining: order.remaining,
    avgPrice: order.avgPrice,
    slippagePct: order.slippagePct,
    outcome: order.outcome,
    status: order.status,
    fees: (order.fees ?? []).map((fee) => ({ ...fee })),
    fee: order.fee ? { ...order.fee } : undefined,
    account: {
      fillIds: [...account.fillIds],
      filled: account.filled,
      cost: account.cost,
      avgPrice: account.avgPrice,
      remaining: account.remaining,
      fees: account.fees.map((fee) => ({ ...fee })),
      makerFilled: account.makerFilled,
      takerFilled: account.takerFilled,
      lastFillAt: account.lastFillAt,
    },
  };
}

function feeListsEqual(a: FeeTotal[], b: FeeTotal[]): boolean {
  return a.length === b.length && a.every((fee, index) =>
    fee.currency === b[index]?.currency && fee.cost === b[index]?.cost);
}

function orderStateChanged(before: LocalOrderState, after: LocalOrderState): boolean {
  return before.exchangeOrderId !== after.exchangeOrderId ||
    before.clientOrderId !== after.clientOrderId ||
    before.filled !== after.filled ||
    before.cost !== after.cost ||
    before.remaining !== after.remaining ||
    before.avgPrice !== after.avgPrice ||
    before.slippagePct !== after.slippagePct ||
    before.outcome !== after.outcome ||
    before.status !== after.status ||
    before.fee?.cost !== after.fee?.cost ||
    before.fee?.currency !== after.fee?.currency ||
    !feeListsEqual(before.fees, after.fees) ||
    before.account.filled !== after.account.filled ||
    before.account.cost !== after.account.cost ||
    before.account.avgPrice !== after.account.avgPrice ||
    before.account.remaining !== after.account.remaining ||
    before.account.makerFilled !== after.account.makerFilled ||
    before.account.takerFilled !== after.account.takerFilled ||
    before.account.lastFillAt !== after.account.lastFillAt ||
    before.account.fillIds.length !== after.account.fillIds.length ||
    before.account.fillIds.some((id, index) => id !== after.account.fillIds[index]) ||
    !feeListsEqual(before.account.fees, after.account.fees);
}

export interface FlattenResult {
  requested: number;
  closed: string[];
  failed: Array<{ positionId: string; symbol: string; error: string }>;
  reason: string;
}

interface ExecutionConfig {
  enabled: boolean;
  exchange: string;
  testMode: boolean; // Use exchange sandbox
  maxPositionSize: number; // Max USD per position
  maxTotalExposure: number; // Max total USD exposure
  defaultLeverage: number;
  slippageTolerance: number; // Max acceptable slippage %
  minConfidence: number;
}

export interface LiveTradingEngineDependencies {
  localStateStore?: DurableLocalStateStore;
  localStatePath?: string;
  realizedPnlLedger?: RealizedPnlLedger;
  realizedPnlLedgerPath?: string;
  fundingAccounting?: FundingAccounting;
  fundingAccountingPath?: string;
  fundingInitialLookbackMs?: number;
  fundingRecheckIntervalMs?: number;
  quoteConversionMaxAgeMs?: number;
  quoteConverter?: QuoteCurrencyConverter;
  clock?: () => number;
}

export class LiveTradingEngine extends EventEmitter {
  private exchange: ccxt.Exchange | null = null;
  private positions: Map<string, LivePosition> = new Map();
  private orders: Map<string, LiveOrder> = new Map();
  private isRunning: boolean = false;
  private monitorInterval?: NodeJS.Timeout;
  private config: ExecutionConfig;
  // Shadow execution / simulation helpers
  private slippageModel: SlippageModel;
  private partialFillSim: PartialFillSimulator;
  private mockNetwork: MockNetwork;
  private venueRouter: VenueRouter;
  private retryPolicy: OrderRetryPolicy;
  private consecutiveFailures: number = 0;
  private circuitBreakerThreshold: number = 5; // pause after N consecutive failures
  private onKill?: (state: any) => void;
  private onKillCleared?: (state: any) => void;
  private onBreakerActivated?: (state: any) => void;
  private onBreakerCleared?: (state: any) => void;
  /** Null until startup reconciliation has run in this process. */
  private reconciliation: ReconciliationReport | null = null;
  private flattening: boolean = false;
  private flattenInFlight: Promise<FlattenResult> | null = null;
  private hardLimitOverrides: Partial<HardLimits> = {};
  private readonly localStateStore: DurableLocalStateStore;
  private localStateStatus: LocalStateLoadResult['status'] = 'absent';
  private localStateLoaded = false;
  private localStatePersistenceHealthy = true;
  private readonly realizedPnlLedger: RealizedPnlLedger;
  private readonly fundingAccounting: FundingAccounting;
  private readonly quoteConverter: QuoteCurrencyConverter;
  private realizedPnlStatus: RealizedPnlLoadResult['status'] = 'absent';
  private fundingStatus: FundingLoadResult['status'] = 'absent';
  private realizedPnlLoaded = false;
  private fundingLoaded = false;
  private realizedPnlHealthy = true;
  private fundingHealthy = true;
  private readonly conversionUnknownSignals = new Set<string>();
  private readonly conversionRetryAt = new Map<string, number>();
  private readonly clock: () => number;

  constructor(config?: Partial<ExecutionConfig>, dependencies: LiveTradingEngineDependencies = {}) {
    super();
    this.clock = dependencies.clock ?? Date.now;
    this.config = {
      enabled: false,
      exchange: 'binance',
      testMode: true, // Always start in test mode
      maxPositionSize: 1000,
      maxTotalExposure: 5000,
      defaultLeverage: 5,
      slippageTolerance: 0.5,
      minConfidence: 0.7,
      ...config
    };
    this.localStateStore = dependencies.localStateStore ?? new DurableLocalStateStore({
      filePath: dependencies.localStatePath,
      clock: dependencies.clock,
    });
    this.realizedPnlLedger = dependencies.realizedPnlLedger ?? new RealizedPnlLedger({
      filePath: dependencies.realizedPnlLedgerPath,
      clock: dependencies.clock,
    });
    this.fundingAccounting = dependencies.fundingAccounting ?? new FundingAccounting({
      filePath: dependencies.fundingAccountingPath,
      clock: dependencies.clock,
      initialLookbackMs: dependencies.fundingInitialLookbackMs,
      recheckIntervalMs: dependencies.fundingRecheckIntervalMs,
    });
    this.quoteConverter = dependencies.quoteConverter ?? new QuoteCurrencyConverter({
      maxAgeMs: dependencies.quoteConversionMaxAgeMs,
      clock: dependencies.clock,
    });

    // Listen for global kill-switch events. Handlers are retained so they can
    // be detached in dispose() — the switch and breaker are process-wide
    // singletons, so leaked handlers accumulate for the life of the process.
    try {
      this.onKill = async (state: any) => {
        const logger = new ModuleLogger('LiveTrading');
        logger.warn('Global kill-switch activated, pausing trading', state);
        this.invalidateTickerCache();
        // Pause engine immediately
        this.pause();

        // If operator requested forced close, attempt safe closes if configured
        const forceClose = process.env.KILL_FORCE_CLOSE === '1';
        if (forceClose) {
          logger.warn('Force-close on kill enabled: flattening all positions');
          try {
            await this.flattenAll('kill_switch');
          } catch (e) {
            logger.error('Error while attempting force-close after kill', e);
          }
        }
      };
      systemKillSwitch.on('kill', this.onKill);

      // Listen for global circuit breaker activation
      try {
        this.onBreakerActivated = async (s: any) => {
          const logger = new ModuleLogger('LiveTrading');
          logger.warn('Global circuit breaker activated, halting new placements', s);
          // Prevent new placements
          this.config.enabled = false;
          // Attempt to cancel open orders
          if (this.exchange) {
            for (const [id, ord] of Array.from(this.orders.entries())) {
              try {
                await this.exchange.cancelOrder(ord.exchangeOrderId, ord.symbol);
                logger.info(`Cancelled order due to circuit break: ${ord.exchangeOrderId}`);
              } catch (e) {
                logger.warn('Failed to cancel order during circuit break', e);
              }
            }
          }
        };
        liveCircuitBreaker.on('activated', this.onBreakerActivated);
        this.onBreakerCleared = (s: any) => {
          const logger = new ModuleLogger('LiveTrading');
          logger.info('Global circuit breaker cleared', s);
          // Clearing the breaker never re-enables trading on its own: the kill
          // switch may still be set and the operator may have stopped the
          // engine deliberately. Resuming is an explicit operator action.
          this.emit('circuitBreakerCleared', s);
        };
        liveCircuitBreaker.on('cleared', this.onBreakerCleared);
      } catch (e) {}
      this.onKillCleared = (state: any) => {
        const logger = new ModuleLogger('LiveTrading');
        logger.info('Global kill-switch cleared', state);
      };
      systemKillSwitch.on('clear', this.onKillCleared);
    } catch (e) {
      // ignore if kill-switch unavailable
    }
    // initialize simulation helpers with sensible defaults
    this.slippageModel = new SlippageModel({ percent: 0.2, mode: 'percentage' });
    this.partialFillSim = new PartialFillSimulator({ typicalDepth: 1000, aggressiveness: 0.6 });
    this.mockNetwork = new MockNetwork({ meanLatencyMs: 50, jitterMs: 30, rateLimitPerSec: 1000 });
    this.venueRouter = new VenueRouter();
    this.retryPolicy = new OrderRetryPolicy();
  }

  /**
   * Initialize exchange connection
   */
  async initialize(): Promise<void> {
    try {
      const exchangeName = this.config.exchange;
      const ExchangeClass = ccxt[exchangeName as keyof typeof ccxt] as any;
      
      if (!ExchangeClass) {
        throw new Error(`Exchange ${exchangeName} not supported`);
      }

      this.exchange = new ExchangeClass({
        apiKey: process.env[`${exchangeName.toUpperCase()}_API_KEY`],
        secret: process.env[`${exchangeName.toUpperCase()}_SECRET`],
        enableRateLimit: true,
        options: {
          defaultType: 'future', // Use futures for leverage
          ...(this.config.testMode && { sandbox: true })
        }
      });

      if (!this.exchange) {
        throw new Error(`Failed to initialize exchange ${exchangeName}`);
      }
      await this.exchange.loadMarkets();
      this.invalidateTickerCache();
      
      const logger = new ModuleLogger('LiveTrading');
      logger.info(`Connected to ${exchangeName} (${this.config.testMode ? 'TESTNET' : 'LIVE'})`);

      this.emit('initialized', { exchange: exchangeName, testMode: this.config.testMode });

      if (this.config.testMode) {
        try {
          await this.updatePositions();
        } catch (err) {
          const logger = new ModuleLogger('LiveTrading');
          logger.warn('initial position sync failed', err);
        }
      }
    } catch (error: any) {
      const logger = new ModuleLogger('LiveTrading');
      const fe = formatError(error);
      logger.error(`Initialization failed: ${fe.message}`, { stack: fe.stack });
      throw error;
    }
  }

  /**
   * Attempt to switch active exchange/venue by name (ccxt key). Returns true on success.
   */
  async switchVenue(venueName: string): Promise<boolean> {
    const logger = new ModuleLogger('LiveTrading');
    if (!venueName) return false;
    try {
      const previousVenue = this.config.exchange;
      const ExchangeClass = ccxt[venueName as keyof typeof ccxt] as any;
      if (!ExchangeClass) {
        logger.warn(`switchVenue: exchange ${venueName} not supported`);
        return false;
      }
      const ex = new ExchangeClass({
        apiKey: process.env[`${venueName.toUpperCase()}_API_KEY`],
        secret: process.env[`${venueName.toUpperCase()}_SECRET`],
        enableRateLimit: true,
        options: { defaultType: 'future', ...(this.config.testMode && { sandbox: true }) }
      });
      await ex.loadMarkets();
      this.invalidateTickerCache(previousVenue);
      this.invalidateTickerCache(venueName);
      this.exchange = ex;
      this.config.exchange = venueName;
      logger.info(`Switched venue to ${venueName}`);
      return true;
    } catch (e) {
      logger.warn('Failed to switch venue', e);
      return false;
    }
  }

  private invalidateTickerCache(venue?: string): void {
    try {
      const cache = getTickerCache();
      if (venue) cache.invalidateVenue(venue);
      else cache.invalidateAll();
    } catch {
      // The gateway cache is optional in test and isolated engine processes.
    }
  }

  private loadLocalState(): boolean {
    const result = this.localStateStore.load();
    this.localStateStatus = result.status;

    if (result.status === 'absent') {
      this.orders.clear();
      this.positions.clear();
      this.localStateLoaded = true;
      this.localStatePersistenceHealthy = true;
      return true;
    }

    if (result.status === 'unreadable') {
      this.localStatePersistenceHealthy = false;
      recordExecutionBlocked('local_state_unreadable');
      safetyEventLog.record({
        type: 'durability_failure',
        detail: `local execution state unreadable: ${result.reason}`,
        data: { stateFile: this.localStateStore.getPath() },
      });
      this.emit('executionBlocked', {
        type: 'local_state',
        reason: 'local_state_unreadable',
        detail: result.reason,
        timestamp: Date.now(),
      });
      this.emit('startRefused', {
        reason: 'local_state_unreadable',
        detail: result.reason,
      });
      return false;
    }

    try {
      const orders = result.state.orders as LiveOrder[];
      const positions = result.state.positions as LivePosition[];
      if (
        orders.some((order) => !order || typeof order.id !== 'string' || typeof order.symbol !== 'string') ||
        positions.some((position) => !position || typeof position.symbol !== 'string')
      ) {
        throw new Error('local execution state contains an invalid order or position record');
      }
      this.orders.clear();
      for (const order of orders) this.orders.set(order.id, order);
      this.positions.clear();
      for (const position of positions) {
        this.positions.set(position.symbol, { ...position, id: position.symbol });
      }
      this.localStatePersistenceHealthy = true;
      this.localStateLoaded = true;
      return true;
    } catch (error: any) {
      const reason = error?.message ? String(error.message) : 'local execution state record is invalid';
      this.localStateStatus = 'unreadable';
      this.localStatePersistenceHealthy = false;
      recordExecutionBlocked('local_state_unreadable');
      safetyEventLog.record({
        type: 'durability_failure',
        detail: `local execution state unreadable: ${reason}`,
        data: { stateFile: this.localStateStore.getPath() },
      });
      this.emit('executionBlocked', {
        type: 'local_state',
        reason: 'local_state_unreadable',
        detail: reason,
        timestamp: Date.now(),
      });
      this.emit('startRefused', { reason: 'local_state_unreadable', detail: reason });
      return false;
    }
  }

  private persistLocalState(): boolean {
    if (this.config.testMode) return true;
    try {
      this.localStateStore.persist(
        Array.from(this.orders.values()),
        Array.from(this.positions.values()),
      );
      this.localStateStatus = 'ok';
      this.localStateLoaded = true;
      this.localStatePersistenceHealthy = true;
      return true;
    } catch (error: any) {
      const detail = error?.message ? String(error.message) : 'local execution state write failed';
      this.localStatePersistenceHealthy = false;
      durabilityGate.invalidate(detail);
      recordExecutionBlocked('local_state_persistence_failed');
      safetyEventLog.record({
        type: 'durability_failure',
        detail,
        data: { stateFile: this.localStateStore.getPath() },
      });
      this.emit('executionBlocked', {
        type: 'local_state',
        reason: 'local_state_persistence_failed',
        detail,
        timestamp: Date.now(),
      });
      return false;
    }
  }

  private loadRealizedPnlLedger(): boolean {
    const result = this.realizedPnlLedger.load();
    this.realizedPnlStatus = result.status;
    if (result.status === 'absent' || result.status === 'ok') {
      this.realizedPnlLoaded = true;
      this.realizedPnlHealthy = true;
      return true;
    }

    this.realizedPnlHealthy = false;
    recordExecutionBlocked('realized_pnl_ledger_unreadable');
    safetyEventLog.record({
      type: 'durability_failure',
      detail: `realized PnL ledger unreadable: ${result.reason}`,
      data: { stateFile: this.realizedPnlLedger.getPath() },
    });
    this.emit('executionBlocked', {
      type: 'realized_pnl',
      reason: 'realized_pnl_ledger_unreadable',
      detail: result.reason,
      timestamp: Date.now(),
    });
    this.emit('startRefused', {
      reason: 'realized_pnl_ledger_unreadable',
      detail: result.reason,
    });
    return false;
  }

  private loadFundingState(): boolean {
    const result = this.fundingAccounting.load();
    this.fundingStatus = result.status;
    if (result.status === 'absent' || result.status === 'ok') {
      this.fundingLoaded = true;
      this.fundingHealthy = true;
      return true;
    }

    this.fundingHealthy = false;
    recordExecutionBlocked('funding_state_unreadable');
    safetyEventLog.record({
      type: 'durability_failure',
      detail: `funding state unreadable: ${result.reason}`,
      data: { stateFile: this.fundingAccounting.getPath() },
    });
    this.emit('executionBlocked', {
      type: 'funding',
      reason: 'funding_state_unreadable',
      detail: result.reason,
      timestamp: Date.now(),
    });
    this.emit('startRefused', {
      reason: 'funding_state_unreadable',
      detail: result.reason,
    });
    return false;
  }

  private blockForExecution(reason: string, detail?: string, data?: Record<string, unknown>): void {
    recordExecutionBlocked(reason);
    safetyEventLog.record({
      type: 'execution_blocked',
      detail: detail ?? reason,
      data,
    });
    this.emit('executionBlocked', {
      type: 'execution_safety',
      reason,
      detail,
      timestamp: Date.now(),
      ...data,
    });
  }

  private realizedPnlInput(): RealizedPnlRiskInput {
    const summary = this.realizedPnlLedger.summary();
    return {
      dailyPnl: summary.pnl,
      unknown: summary.unknown,
      unconvertedFees: summary.unconvertedFees,
    };
  }

  private quoteCurrency(symbol: string): string | null {
    const quote = symbol.split('/')[1]?.split(':')[0];
    return quote ? quote.toUpperCase() : null;
  }

  private async appendQuoteConversions(
    entryId: string,
    quoteCurrency: string,
    items: Array<{
      feeIndex: number;
      kind: 'fee' | 'funding';
      sourceCurrency: string;
      sourceAmount: number;
    }>,
  ): Promise<void> {
    if (!this.exchange) return;
    for (const item of items) {
      const result = await this.quoteConverter.convert(
        this.exchange,
        item.sourceCurrency,
        quoteCurrency,
        item.sourceAmount,
      );
      if (result.status !== 'known') {
        const signalKey = `${entryId}:${item.feeIndex}`;
        if (!this.conversionUnknownSignals.has(signalKey)) {
          this.conversionUnknownSignals.add(signalKey);
          safetyEventLog.record({
            type: 'conversion_unknown',
            detail: result.reason,
            data: {
              entryId,
              feeIndex: item.feeIndex,
              kind: item.kind,
              sourceCurrency: item.sourceCurrency,
              quoteCurrency,
            },
          });
        }
        continue;
      }
      const conversion: PnlConversionRecord = {
        kind: item.kind,
        feeIndex: item.feeIndex,
        ...result.conversion,
      };
      try {
        this.realizedPnlLedger.appendConversion(entryId, conversion);
      } catch (error: any) {
        this.realizedPnlHealthy = false;
        this.blockForExecution('realized_pnl_persistence_failed', error?.message, {
          entryId,
          sourceCurrency: item.sourceCurrency,
          quoteCurrency,
        });
        return;
      }
    }
  }

  private async retryCurrentDayQuoteConversions(): Promise<void> {
    if (!this.exchange) return;
    const now = this.clock();
    const today = new Date(now).toISOString().slice(0, 10);
    const allEntries = this.realizedPnlLedger.entries();
    let attempted = 0;
    for (const entry of allEntries) {
      if (attempted >= 8 || (entry.category !== 'trade' && entry.category !== 'funding') ||
          !entry.unconvertedFees.length ||
          !Number.isFinite(Date.parse(entry.at)) ||
          new Date(entry.at).toISOString().slice(0, 10) !== today ||
          entry.quoteCurrency === 'UNKNOWN') {
        continue;
      }
      const convertedIndexes = new Set(
        allEntries
          .filter((candidate) => candidate.category === 'conversion' && candidate.conversionFor === entry.id)
          .map((candidate) => candidate.conversion?.feeIndex)
          .filter((index): index is number => Number.isInteger(index))
      );
      const items = entry.unconvertedFees.flatMap((fee, feeIndex) => {
        if (convertedIndexes.has(feeIndex) || attempted >= 8) return [];
        const retryKey = `${entry.id}:${feeIndex}`;
        if ((this.conversionRetryAt.get(retryKey) ?? 0) > now - 5_000) return [];
        this.conversionRetryAt.set(retryKey, now);
        attempted += 1;
        return [{
          feeIndex,
          kind: entry.category === 'funding' ? 'funding' as const : 'fee' as const,
          sourceCurrency: entry.category === 'funding' ? (entry.fundingCurrency ?? fee.currency) : fee.currency,
          sourceAmount: entry.category === 'funding' ? (entry.fundingAmount ?? fee.cost) : fee.cost,
        }];
      });
      if (items.length > 0) {
        await this.appendQuoteConversions(entry.id, entry.quoteCurrency, items);
      }
    }
  }

  private async ensureFundingAccounted(symbol: string): Promise<boolean> {
    if (!this.fundingLoaded || !this.fundingHealthy) {
      this.blockForExecution('funding_state_unreadable', 'funding state is not trustworthy', {
        symbol,
      });
      return false;
    }

    let result: FundingAccountingResult;
    try {
      result = await this.fundingAccounting.reconcile(this.exchange, symbol);
    } catch (error: any) {
      result = {
        status: 'unknown',
        reason: error?.message ? String(error.message) : 'funding accounting failed',
        payments: [],
      };
    }

    if (result.status === 'not_required') return true;

    const quoteCurrency = this.quoteCurrency(symbol);
    for (const payment of result.payments) {
      const isQuote = quoteCurrency !== null && payment.currency === quoteCurrency;
      const entry: RealizedPnlEntry = {
        id: `funding:${payment.id}`,
        category: 'funding',
        at: new Date(payment.timestamp).toISOString(),
        symbol: payment.symbol,
        quoteCurrency: quoteCurrency ?? payment.currency,
        pnl: isQuote ? payment.amount : null,
        grossPnl: isQuote ? payment.amount : null,
        quoteFees: 0,
        unconvertedFees: isQuote ? [] : [{ currency: payment.currency, cost: Math.abs(payment.amount) }],
        fundingAmount: payment.amount,
        fundingCurrency: payment.currency,
        fundingSource: payment.source,
      };
      try {
        this.realizedPnlLedger.append(entry);
      } catch (error: any) {
        this.realizedPnlHealthy = false;
        this.blockForExecution('realized_pnl_persistence_failed', error?.message, {
          symbol,
          entryId: entry.id,
        });
        return false;
      }
      if (!isQuote && quoteCurrency) {
        await this.appendQuoteConversions(entry.id, quoteCurrency, [{
          feeIndex: 0,
          kind: 'funding',
          sourceCurrency: payment.currency,
          sourceAmount: payment.amount,
        }]);
      }
    }

    if (result.status === 'known') return true;
    if (process.env.ALLOW_UNACCOUNTED_FUNDING === '1') {
      safetyEventLog.record({
        type: 'funding_unknown',
        detail: 'unaccounted funding explicitly allowed by operator',
        data: { symbol, reason: result.reason },
      });
      return true;
    }

    const blockReason = result.reason === 'funding_source_unsupported'
      ? 'funding_source_unsupported'
      : 'funding_unaccounted';
    this.blockForExecution(blockReason, result.reason, { symbol });
    safetyEventLog.record({
      type: 'funding_unknown',
      detail: result.reason,
      data: { symbol },
    });
    return false;
  }

  resolveRealizedPnlEntry(
    id: string,
    resolution:
      | { kind: 'attested_value'; pnl: number; reason: string }
      | { kind: 'excluded_unknown'; reason: string }
  ): RealizedPnlEntry {
    const entry = this.realizedPnlLedger.resolveUnknown(id, resolution);
    safetyEventLog.record({
      type: 'realized_pnl_resolved',
      detail: `realized PnL entry ${id} resolved by operator`,
      data: {
        entryId: id,
        resolution: entry.resolution?.kind,
        pnl: entry.pnl,
        reason: entry.resolution?.reason,
      },
    });
    return entry;
  }

  resolveFundingBaseline(symbol: string, reason: string): void {
    this.fundingAccounting.attestInitialCoverage(symbol, reason);
    safetyEventLog.record({
      type: 'funding_baseline_resolved',
      detail: `funding baseline for ${symbol} attested by operator`,
      data: { symbol, reason: reason.trim() },
    });
  }

  /**
   * Start live trading engine
   */
  async start(): Promise<void> {
    if (systemKillSwitch.isKilled()) {
      const state = systemKillSwitch.getState();
      new ModuleLogger('LiveTrading').error('Start refused: system kill-switch active', state);
      this.emit('startRefused', { reason: 'kill_switch_active', state });
      throw new Error(`Cannot start live trading: kill-switch active (${state.reason || 'unspecified'})`);
    }

    if (!this.config.testMode && !this.loadLocalState()) {
      throw new Error('Cannot start live trading: local execution state is unreadable');
    }
    if (!this.config.testMode && !this.loadRealizedPnlLedger()) {
      throw new Error('Cannot start live trading: realized PnL ledger is unreadable');
    }
    if (!this.config.testMode && !this.loadFundingState()) {
      throw new Error('Cannot start live trading: funding state is unreadable');
    }

    // Live trading without durable persistence would leave real exchange
    // exposure that no local state can reconstruct after a restart.
    const durability = await durabilityGate.requireForLive(this.config.testMode);
    if (!durability.durable) {
      new ModuleLogger('LiveTrading').error('Start refused: durable persistence unavailable', durability);
      recordExecutionBlocked('durable_state_unavailable');
      this.emit('startRefused', { reason: 'durable_state_unavailable', durability });
      throw new Error(
        `Cannot start live trading: durable persistence unavailable (${durability.reason}: ${durability.detail})`
      );
    }

    if (!this.exchange) {
      await this.initialize();
    }

    // Barrier: we must know what the exchange thinks is true before we add to
    // it. Paper/test mode has no real exchange state to reconcile against.
    if (!this.config.testMode) {
      const report = await this.reconcileWithExchange();
      if (!report.complete) {
        recordExecutionBlocked('reconciliation_incomplete');
        this.emit('startRefused', { reason: 'reconciliation_incomplete', report });
        throw new Error(
          `Cannot start live trading: startup reconciliation incomplete (${report.blockedReason})`
        );
      }
    }

    if (!this.config.testMode && !this.localStatePersistenceHealthy) {
      recordExecutionBlocked('local_state_persistence_failed');
      this.emit('startRefused', {
        reason: 'local_state_persistence_failed',
        stateFile: this.localStateStore.getPath(),
      });
      throw new Error('Cannot start live trading: local execution state could not be persisted');
    }

    this.isRunning = true;
    this.config.enabled = true;

    // Monitor positions and orders every 5 seconds
    this.monitorInterval = setInterval(() => {
      this.updatePositions();
      this.checkOrders();
    }, 5000);

    this.emit('started');
    new ModuleLogger('LiveTrading').info('Engine started');
  }

  /**
   * Stop live trading engine
   */
  stop(): void {
    this.isRunning = false;
    this.config.enabled = false;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    this.emit('stopped');
    new ModuleLogger('LiveTrading').info('Engine stopped');
  }

  /**
   * Execute a signal on the live exchange
   */
  async executeSignal(signal: Signal): Promise<LiveOrder | null> {
    const logger = new ModuleLogger('LiveTrading');

    if (!this.config.testMode && (!this.localStatePersistenceHealthy || this.localStateStatus === 'unreadable')) {
      const reason = this.localStateStatus === 'unreadable'
        ? 'local_state_unreadable'
        : 'local_state_persistence_failed';
      logger.error(`Execution blocked: ${reason}`);
      recordExecutionBlocked(reason);
      safetyEventLog.record({
        type: 'execution_blocked',
        detail: reason,
        data: { symbol: signal.symbol, signalId: signal.id },
      });
      this.emit('executionBlocked', {
        type: 'local_state',
        reason,
        symbol: signal.symbol,
        signalId: signal.id,
        timestamp: Date.now(),
      });
      return null;
    }
    if (!this.config.testMode && !this.localStateLoaded && !this.loadLocalState()) return null;
    if (!this.config.testMode && !this.realizedPnlLoaded && !this.loadRealizedPnlLedger()) return null;
    if (!this.config.testMode && !this.fundingLoaded && !this.loadFundingState()) return null;
    if (!this.config.testMode && !this.realizedPnlHealthy) {
      this.blockForExecution('realized_pnl_persistence_failed', 'realized PnL ledger is not healthy', {
        symbol: signal.symbol,
        signalId: signal.id,
      });
      return null;
    }

    if (!this.exchange) {
      logger.info('Engine not initialized');
      return null;
    }

    if (this.flattening) {
      logger.warn('Execution blocked: flatten-all in progress');
      this.emit('executionBlocked', { type: 'flattening', reason: 'flatten_in_progress', symbol: signal.symbol });
      return null;
    }

    // Re-checked per order (cheaply, behind a short probe cache) so a database
    // that disappears mid-session stops live execution rather than accumulating
    // untracked orders.
    const durability = await durabilityGate.requireForLive(this.config.testMode);
    if (!durability.durable) {
      logger.error(`Execution blocked: durable persistence unavailable (${durability.reason})`, durability);
      recordExecutionBlocked('durable_state_unavailable');
      safetyEventLog.record({
        type: 'durability_failure',
        detail: `execution blocked: ${durability.reason}`,
        data: { symbol: signal.symbol, signalId: signal.id },
      });
      this.emit('executionBlocked', {
        type: 'durability',
        reason: 'durable_state_unavailable',
        detail: durability.detail,
        symbol: signal.symbol,
        signalId: signal.id,
        timestamp: Date.now(),
      });
      return null;
    }

    // Nothing may be placed until we have established what the exchange
    // already holds. Re-checked per order because a mid-session reconciliation
    // failure must also stop execution.
    if (!this.config.testMode && !this.reconciliation?.complete) {
      const reason = this.reconciliation?.blockedReason ?? 'reconciliation_not_run';
      logger.error(`Execution blocked: startup reconciliation not complete (${reason})`);
      recordExecutionBlocked('reconciliation_incomplete');
      this.emit('executionBlocked', {
        type: 'reconciliation',
        reason: 'reconciliation_incomplete',
        detail: reason,
        symbol: signal.symbol,
        signalId: signal.id,
        timestamp: Date.now(),
      });
      return null;
    }

    if (!this.config.testMode && !(await this.ensureFundingAccounted(signal.symbol))) {
      return null;
    }

    // Hard limit gate: kill switch, circuit breaker, staleness, size, exposure,
    // position count and leverage. Fails closed and cannot be bypassed by
    // downstream sizing logic.
    const preTrade = this.checkHardLimits(signal, Math.min(this.config.maxPositionSize, this.config.maxTotalExposure - this.getTotalExposure()));
    if (!preTrade.allowed) {
      logger.warn(`Execution blocked by hard limit gate: ${preTrade.code} — ${preTrade.reason}`);
      recordExecutionBlocked(preTrade.code || 'unknown');
      this.emit('executionBlocked', {
        type: 'hard_limit',
        code: preTrade.code,
        reason: preTrade.reason,
        timestamp: Date.now(),
        signalId: signal.id,
        symbol: signal.symbol,
        limits: preTrade.limits,
      });
      return null;
    }

    // Safety checks
    try {
      const scorer = getConfidenceScorer();
      const scored = scorer.scoreWithCurrentMode(signal.confidence, 'execution');
      if (!scored.canTrade) {
        logger.info(`Signal blocked by mode-aware scorer: ${scored.reason}`);
        recordExecutionBlocked('confidence_scorer_refused');
        this.emit('executionBlocked', {
          type: 'confidence',
          reason: 'confidence_scorer_refused',
          detail: scored.reason,
          timestamp: Date.now(),
          signalId: signal.id,
          symbol: signal.symbol,
        });
        return null;
      }
      // Use adjusted confidence for execution threshold checks
      if (scored.adjusted < this.config.minConfidence) {
        logger.info(`Signal confidence too low after adjustment: ${scored.adjusted}`);
        return null;
      }
      // update signal confidence to adjusted
      signal.confidence = scored.adjusted;
    } catch (e) {
      // fallback to legacy check
      if (signal.confidence < this.config.minConfidence) {
        logger.info(`Signal confidence too low: ${signal.confidence}`);
        return null;
      }
    }

    // Enforce portfolio-level limits from PortfolioRiskManager
    let accountBalance = Number(process.env.PORTFOLIO_CAPITAL) || 10000;
    let consensus: any = null;
    let rlDecision: any = null;
    let reservationTokens: string[] | null = null;

    try {
      const fetched = await getAccountBalanceUsd(this.exchange);
      if (typeof fetched === 'number') accountBalance = fetched;

      const limits = portfolioRiskManager.getLimits();
      let realizedInput = this.realizedPnlInput();
      if (realizedInput.dailyPnl === null || realizedInput.unknown) {
        await this.retryCurrentDayQuoteConversions();
        realizedInput = this.realizedPnlInput();
      }
      if (realizedInput.dailyPnl === null || realizedInput.unknown) {
        this.blockForExecution('realized_pnl_unknown', 'daily realized PnL is unknown', {
          symbol: signal.symbol,
          signalId: signal.id,
        });
        return null;
      }
      const metrics = portfolioRiskManager.getPortfolioMetrics(accountBalance, realizedInput);

      if (metrics.dailyPnlPercent < -limits.maxDailyLoss) {
        const reason = `dailyLoss:${metrics.dailyPnlPercent.toFixed(2)}%`;
        logger.warn(`Blocked by daily loss limit: ${metrics.dailyPnlPercent.toFixed(2)}% <= -${limits.maxDailyLoss}%`);
        this.emit('executionBlocked', { 
          type: 'portfolio_limit',
          reason,
          timestamp: Date.now(),
          signalId: signal.id,
          symbol: signal.symbol,
          accountBalance,
          limits,
          metrics,
        });
        return null;
      }

      if (metrics.currentDrawdown >= limits.maxPortfolioDrawdown) {
        const reason = `drawdown:${metrics.currentDrawdown.toFixed(2)}%`;
        logger.warn(`Blocked by portfolio drawdown limit: ${metrics.currentDrawdown.toFixed(2)}% >= ${limits.maxPortfolioDrawdown}%`);
        this.emit('executionBlocked', {
          type: 'portfolio_limit',
          reason,
          timestamp: Date.now(),
          signalId: signal.id,
          symbol: signal.symbol,
          accountBalance,
          limits,
          metrics,
        });
        return null;
      }
    } catch (pmErr) {
      // Portfolio risk state is a hard limit input: if it cannot be evaluated we
      // do not know whether the daily loss / drawdown limits are breached, so we
      // fail closed instead of trading blind.
      logger.error('PortfolioRiskManager check failed — blocking execution', pmErr);
      this.emit('executionBlocked', {
        type: 'portfolio_limit',
        reason: 'risk_state_unavailable',
        timestamp: Date.now(),
        signalId: signal.id,
        symbol: signal.symbol,
      });
      return null;
    }

    const totalExposure = this.getTotalExposure();
    if (totalExposure >= this.config.maxTotalExposure) {
      logger.info(`Max exposure reached: $${totalExposure}`);
      return null;
    }

    // Ensure market data is healthy for this symbol via TruthEngine
    try {
      const truth = getSharedService('truthEngine');
      if (truth && typeof truth.isTradeable === 'function') {
        const tradeable = truth.isTradeable(signal.symbol, {
          minSources: Number(process.env.MIN_TRUTH_SOURCES) || 2,
          minConfidence: Number(process.env.MIN_TRUTH_CONFIDENCE) || 60,
          maxAgeMs: Number(process.env.TRUTH_MAX_AGE_MS) || undefined
        });
        if (!tradeable.ok) {
          logger.warn(`Blocked by TruthEngine: ${tradeable.reason}`);
          this.emit('executionBlocked', {
            type: 'truth',
            reason: tradeable.reason,
            timestamp: Date.now(),
            signalId: signal.id,
            symbol: signal.symbol
          });
          if (process.env.ROUTE_TO_PAPER_ON_TRUTH_FAIL === '1') {
            this.emit('executionRoutedToPaper', { signal, reason: tradeable.reason });
          }
          return null;
        }
      }
    } catch (e) {
      // Market-data quality is a hard gate: if we cannot establish it, we do not
      // trade. Failing open here means placing orders on unverified prices.
      logger.error('TruthEngine tradeability check errored — blocking execution', e);
      recordExecutionBlocked('truth_check_error');
      this.emit('executionBlocked', {
        type: 'truth',
        reason: 'truth_check_error',
        timestamp: Date.now(),
        signalId: signal.id,
        symbol: signal.symbol
      });
      return null;
    }

    try {
      // Position sizing: prefer RL agent if available, otherwise fallback to simple sizing
      let positionSizeUSD = Math.min(
        this.config.maxPositionSize,
        this.config.maxTotalExposure - totalExposure
      );

      // Ask PortfolioRiskManager for consensus sizing and approval (best-effort)
      try {
        const atr = (signal.price || 0) * 0.02;
        const consensus = await portfolioRiskManager.getPositionSizingConsensus(
          signal.symbol,
          signal.confidence || 0,
          signal.type === 'BUY' ? 'BUY' : 'SELL',
          accountBalance,
          signal.price || 0,
          atr,
          'TRENDING',
          '',
          this.realizedPnlInput()
        );

        if (!consensus.approved || consensus.finalSize <= 0) {
            const reason = `consensus_reject`;
            logger.info(`Execution blocked by PortfolioRiskManager: ${consensus.reasoning.join('; ')}`);
            this.emit('executionBlocked', {
              type: 'consensus',
              reason,
              timestamp: Date.now(),
              signalId: signal.id,
              symbol: signal.symbol,
              consensus
            });
            return null;
          }

        positionSizeUSD = Math.min(positionSizeUSD, consensus.finalSize);
      } catch (pmErr) {
        // Sizing consensus also enforces the kill switch and daily-loss limit, so
        // a failure here must not fall through to unconstrained local sizing.
        logger.error('PortfolioRiskManager sizing failed — blocking execution', pmErr);
        this.emit('executionBlocked', {
          type: 'consensus',
          reason: 'sizing_unavailable',
          timestamp: Date.now(),
          signalId: signal.id,
          symbol: signal.symbol,
        });
        return null;
      }

      try {
        const rlAgent = (global as any).rlPositionAgent;
        if (rlAgent && typeof rlAgent.getFullDecision === 'function') {
          try {
            const timeoutMs = Number(process.env.RL_DECISION_TIMEOUT_MS) || 200;
            const decision: any | null = await promiseWithTimeout((rlAgent as any).getFullDecision(signal), timeoutMs);
            if (!decision) {
              logger.warn(`RL decision timed out or failed after ${timeoutMs}ms, using fallback sizing`);
            } else if (decision && decision.sizing && typeof decision.sizing.positionSize === 'number') {
              positionSizeUSD = Math.min(positionSizeUSD, decision.sizing.positionSize);
            }
            // Persist a decision snapshot for RL decision
            try {
              if (decision) {
                await db.createDecisionSnapshot({
                  traceId: (signal as any).correlationId ?? null,
                  agents: ['rlPositionAgent'],
                  contributions: decision.contributions ?? {},
                  policyOutputs: decision.policyOutputs ?? decision.sizing ?? {},
                  positionSizing: { accountBalance, requested: positionSizeUSD, resolved: decision.sizing?.positionSize ?? null },
                  marketFrameId: (await db.getLatestMarketFrame(signal.symbol))?.id ?? null,
                  worldTime: (await db.getLatestMarketFrame(signal.symbol))?.timestamp ?? null,
                  moduleVersion: process.env.COMMIT_SHA || process.env.MODEL_VERSION || null,
                });
              }
            } catch (e) { logger.warn('Failed to persist RL decision snapshot', e); }
          } catch (err) {
            logger.warn('RL decision wrapper error, using fallback sizing', err);
          }
        }
      } catch (e) {
        // ignore RL sizing failures and fallback to default sizing
      }

      let amount = positionSizeUSD / signal.price;
      // If TruthEngine consensus price exists, prefer it for amount calculation
      try {
        const truth = getSharedService('truthEngine');
        if (truth && typeof truth.getConsensus === 'function') {
          const cons = truth.getConsensus(signal.symbol);
          if (cons && typeof cons.price === 'number' && cons.price > 0) {
            // basic staleness check (if available)
            const isStale = typeof truth.isStale === 'function' ? truth.isStale(signal.symbol) : false;
            if (!isStale) {
              // check slippage tolerance vs consensus
              const refPrice = cons.price;
              const sigPrice = signal.price || refPrice;
              const slippagePct = Math.abs((sigPrice - refPrice) / refPrice) * 100;
              if (slippagePct > this.config.slippageTolerance) {
                logger.info(`Blocked execution: signal price ${sigPrice} deviates ${slippagePct.toFixed(2)}% from consensus ${refPrice}`);
                return null;
              }
              // use consensus for amount
              const amt = positionSizeUSD / refPrice;
              // prefer consensus-based amount (safer sizing)
              if (amt > 0) {
                amount = Math.min(amount, amt);
              }
            }
          }
        }
      } catch (e) { /* non-fatal */ }

      // Ensure leverage is set for futures exchanges when supported
      try {
        if (this.config.defaultLeverage && (this.exchange as any).setLeverage) {
          try {
            await (this.exchange as any).setLeverage(this.config.defaultLeverage, signal.symbol);
          } catch (e) {
            // not all exchanges support per-symbol setLeverage; ignore failures
          }
        }
      } catch (e) { /* ignore */ }

      // Re-check hard limits against the FINAL sizing. The pre-trade check ran
      // on the requested size; RL/consensus sizing can change it afterwards.
      const finalNotionalUsd = amount * signal.price;
      const finalGate = this.checkHardLimits(signal, finalNotionalUsd);
      if (!finalGate.allowed) {
        logger.warn(`Final sizing blocked by hard limit gate: ${finalGate.code} — ${finalGate.reason}`);
        recordExecutionBlocked(finalGate.code || 'unknown');
        this.emit('executionBlocked', {
          type: 'hard_limit_final',
          code: finalGate.code,
          reason: finalGate.reason,
          limits: finalGate.limits,
          notionalUsd: finalNotionalUsd,
          timestamp: Date.now(),
          signalId: signal.id,
          symbol: signal.symbol,
        });
        return null;
      }

      // Reserve capital atomically before placement
      let reservationToken: string | null = null;
      try {
        const reserveAmount = positionSizeUSD;
        reservationToken = portfolioRiskManager.reserveCapital(reserveAmount, (signal as any).correlationId ?? null);
      } catch (reserveErr) {
        logger.warn('Reservation failed, blocking execution', reserveErr);
        this.emit('executionBlocked', { type: 'reservation', reason: String(reserveErr), signalId: signal.id, symbol: signal.symbol });
        return null;
      }

      // Place market order with simulated network, slippage and retry/failover behavior
      let order: any = null;
      const enableShadow = (process.env.SHADOW_FIDELITY === '1') || this.config.testMode;
      let attempt = 0;
      let lastError: any = null;
      let currentAmount = amount;
      let currentVenue = this.config.exchange;
      // Idempotency key: lets us prove whether an ambiguous placement landed.
      let clientOrderId = buildClientOrderId('ss', (signal as any).correlationId ?? signal.id ?? signal.symbol);
      const minAmount = amount * 0.1;
      // Bound failover so a multi-venue outage cannot produce an endless retry storm.
      let venueSwitches = 0;
      const maxVenueSwitches = Number(process.env.MAX_VENUE_FAILOVERS) || 2;

      while (true) {
        try {
          // rate-limit and latency injection
          try { this.mockNetwork.checkRateLimit(); } catch (rlErr) { throw rlErr; }
          await this.mockNetwork.delay();

          order = await (this.exchange as any).createOrder(
            signal.symbol,
            'market',
            signal.type.toLowerCase() as 'buy' | 'sell',
            currentAmount,
            undefined,
            { clientOrderId, newClientOrderId: clientOrderId }
          );

          // success
          break;
        } catch (err: any) {
          lastError = err;
          attempt += 1;

          // Ambiguous failure: the order may already exist on the exchange.
          // Reconcile before considering any retry, otherwise a retry doubles
          // real exposure.
          if (isAmbiguousError(err)) {
            const recon = await reconcileByClientOrderId(this.exchange, signal.symbol, clientOrderId);
            recordOrderReconciliation(recon.state);
            this.emit('orderReconciled', {
              symbol: signal.symbol,
              clientOrderId,
              state: recon.state,
              checked: recon.checked,
              errors: recon.errors,
              signalId: signal.id,
            });

            if (recon.state === 'exists') {
              new ModuleLogger('LiveTrading').warn(
                `Ambiguous placement reconciled as LIVE (${clientOrderId}); adopting exchange order`
              );
              order = recon.order;
              break;
            }
            if (recon.state === 'unknown') {
              new ModuleLogger('LiveTrading').error(
                `Ambiguous placement could not be reconciled (${clientOrderId}); aborting to avoid duplicate order`
              );
              throw err;
            }
            // 'absent' — proven not on the exchange, safe to retry with a fresh id.
            clientOrderId = buildClientOrderId('ss', (signal as any).correlationId ?? signal.id ?? signal.symbol);
          }
          const code = err && err.code ? String(err.code) : (err && err.message ? String(err.message) : 'UNKNOWN');
          const action = this.retryPolicy.mapRejection(code || 'UNKNOWN');

          const logger2 = new ModuleLogger('LiveTrading');
          logger2.warn(`Order placement failed (attempt ${attempt}): action=${action} code=${code}`);

          // Record retry decision for traceability
          try {
            await db.createDecisionEvent({
              correlationId: (signal as any).correlationId ?? null,
              phase: 'ORDER_RETRY_DECISION',
              domain: 'OrderRetryPolicy',
              actionPayload: { action, code },
              metrics: { attempt },
              agentIds: ['OrderRetryPolicy'],
              moduleVersion: process.env.COMMIT_SHA || null,
              timestamp: new Date()
            });
          } catch (e) { logger2.warn('Failed to persist retry decision event', e); }

          if (action === 'reduce') {
            // Never round up: for assets priced above $1 a unit-floor would
            // *increase* the order (0.02 BTC -> 1 BTC).
            const reduced = currentAmount * 0.75;
            if (!Number.isFinite(reduced) || reduced < minAmount) {
              new ModuleLogger('LiveTrading').warn(
                `Reduce-retry floor reached (${reduced} < ${minAmount}); aborting placement`
              );
              throw err;
            }
            currentAmount = reduced;
          } else if (action === 'switch_venue') {
            // mark current venue unhealthy and attempt to failover
            this.venueRouter.markFailure(currentVenue, 20);
            const next = this.venueRouter.getNextVenue(currentVenue);
            if (next && venueSwitches < maxVenueSwitches) {
              logger2.info(`Failover: switching to next venue ${next.id}`);
              const switched = await this.switchVenue(next.id);
              if (switched) {
                currentVenue = next.id;
                venueSwitches += 1;
                // reset attempt counter to allow new venue attempts
                attempt = 0;
                currentAmount = amount; // reset amount to original on new venue
                continue; // try placement again on new venue
              } else {
                logger2.warn(`Failover: switch to ${next.id} unsuccessful`);
              }
            }
          } else if (action === 'abort') {
            throw err;
          }

          if (!this.retryPolicy.shouldRetry(attempt)) {
            throw err;
          }

          const waitMs = this.retryPolicy.nextDelayMs(attempt);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
      }

      if (!order) {
        throw lastError || new Error('Order placement failed without exception');
      }

      // If shadow fidelity enabled, apply slippage and simulate partial fills
      if (enableShadow) {
        try {
          // determine execution price
          let execPrice = order.price || signal.price || 0;
          if ((!execPrice || execPrice <= 0) && this.exchange && typeof (this.exchange as any).fetchTicker === 'function') {
            try {
              const tk: any = await (this.exchange as any).fetchTicker(signal.symbol);
              execPrice = Number(tk && (tk.last || tk.close) ? (tk.last || tk.close) : execPrice) || execPrice;
            } catch (_) {}
          }

          const adjustedPrice = this.slippageModel.applySlippage(execPrice || 0, currentAmount, undefined, signal.type.toLowerCase() as 'buy' | 'sell');
          const fills = this.partialFillSim.simulateProgressiveFills(Math.ceil(currentAmount), 5);
          const totalFilled = fills.reduce((s, f) => s + f, 0);

          order.filled = totalFilled;
          order.remaining = Math.max(0, currentAmount - totalFilled);
          order.cost = totalFilled * adjustedPrice;
          order.price = adjustedPrice;
          order.status = order.filled >= currentAmount ? 'closed' : 'open';
        } catch (simErr) {
          const logger2 = new ModuleLogger('LiveTrading');
          logger2.warn('Shadow fidelity simulation failed', simErr);
        }
      }

      const account = this.buildInitialFillAccount(order, currentAmount);
      const liveOrder: LiveOrder = {
        id: typeof randomUUID === 'function' ? randomUUID() : `order-${Date.now()}`,
        exchangeOrderId: order.id,
        clientOrderId,
        symbol: signal.symbol,
        side: signal.type.toLowerCase() as 'buy' | 'sell',
        type: 'market',
        amount: currentAmount,
        status: order.status as any,
        filled: account.filled,
        remaining: account.remaining,
        cost: account.cost,
        fee: account.fees[0]
          ? { ...account.fees[0] }
          : (order.fee
              ? {
                  cost: typeof order.fee.cost === 'number' ? order.fee.cost : Number(order.fee.cost) || 0,
                  currency: String(order.fee.currency || 'USDT'),
                }
              : undefined),
        fees: account.fees,
        avgPrice: account.avgPrice,
        // Recorded so slippage is measured against the price the decision used,
        // not against the execution itself.
        requestedPrice: signal.price ?? null,
        slippagePct: computeSlippagePct(signal.price ?? null, account.avgPrice, signal.type.toLowerCase() as 'buy' | 'sell'),
        outcome: classifyOutcome(order.status, account, currentAmount),
        account,
        timestamp: order.timestamp || Date.now(),
        signalId: signal.id
      };

      // Persist trade provenance
      try {
        const provenance = {
          tradeId: liveOrder.exchangeOrderId || liveOrder.id,
          engine: 'LIVE',
          symbol: liveOrder.symbol,
          signalId: signal.id ?? null,
          correlationId: (signal as any).correlationId ?? null,
          signal: {
            id: signal.id,
            timestamp: signal.timestamp,
            symbol: signal.symbol,
            type: signal.type,
            confidence: signal.confidence,
            price: signal.price,
            reasoning: signal.reasoning
          },
          consensus: (typeof (portfolioRiskManager as any).getPositionSizingConsensus === 'function') ? undefined : undefined,
          agentDecision: (global as any).rlPositionAgent ? (await (global as any).rlPositionAgent.getFullDecision(signal)).sizing : undefined,
          execution: {
            orderId: liveOrder.exchangeOrderId,
            amount: liveOrder.amount,
            cost: liveOrder.cost,
            fee: liveOrder.fee
          },
          extra: {
            env: process.env.NODE_ENV || 'development',
            host: process.env.HOSTNAME || null
          }
        };

        try { await db.createTradeProvenance(provenance); } catch (e) { logger.warn('Failed to persist trade provenance', e); }
      } catch (e) {
        logger.warn('Provenance capture failed', e);
      }
      // Persist order audit record (execution provenance)
      let orderAuditRecord: any = null;
      try {
        const preBalances = { accountBalanceUsd: accountBalance };
        const audit = {
          traceId: (signal as any).correlationId ?? null,
          orderId: liveOrder.exchangeOrderId || liveOrder.id,
          exchange: this.config.exchange,
          venue: currentVenue,
          params: { type: 'market', amount: currentAmount },
          preBalances,
          reservationAmounts: reservationTokens ?? [],
          fills: [],
          simulatedSlippage: null,
          realSlippage: null,
          realizedPnl: null,
        };
        try { orderAuditRecord = await db.createOrderAudit(audit); } catch (e) { logger.warn('Failed to persist order audit', e); }
      } catch (e) {
        logger.warn('Order audit capture failed', e);
      }
      // Hold reservation until child orders (SL/TP) are placed; commit/release as a unit
      reservationTokens = [];
      if (reservationToken) reservationTokens.push(reservationToken);
      // Register position with portfolio manager (best-effort)
      try {
        // Size the registered position on what actually executed; fall back to
        // the requested amount only while nothing has filled yet.
        const filledQty = liveOrder.filled > 0 ? liveOrder.filled : amount;
        const avgPrice = liveOrder.avgPrice ?? (signal.price || 0);
        const sizeUsd = (avgPrice || signal.price || 0) * filledQty;
        portfolioRiskManager.addPosition({
          symbol: liveOrder.symbol,
          side: liveOrder.side === 'buy' ? 'BUY' : 'SELL',
          size: sizeUsd,
          entryPrice: avgPrice || signal.price || 0,
          currentPrice: avgPrice || signal.price || 0,
          pnl: 0,
          pnlPercent: 0
        });
      } catch (pmErr) {
        logger.warn('Failed to add position to PortfolioRiskManager', pmErr);
      }
      this.orders.set(liveOrder.id, liveOrder);
      const persisted = this.persistLocalState();
      this.emit('orderPlaced', liveOrder);
      if (!persisted) {
        safetyEventLog.record({
          type: 'execution_blocked',
          detail: 'order placed but local exposure could not be durably recorded',
          data: {
            orderId: liveOrder.id,
            exchangeOrderId: liveOrder.exchangeOrderId,
            symbol: liveOrder.symbol,
            unrecordableExposure: true,
          },
        });
      }

      // Detect potential self-influencing trades (feedback loop) and tag audit
      try {
        const executedPrice = liveOrder.price || signal.price || 0;
        const tradeUsd = (liveOrder.amount || 0) * executedPrice;
        const feedbackThresholdUsd = Number(process.env.FEEDBACK_THRESHOLD_USD) || (accountBalance * 0.05);
        if (tradeUsd >= feedbackThresholdUsd) {
          try {
            await db.createDecisionEvent({
              correlationId: (signal as any).correlationId ?? null,
              phase: 'FEEDBACK_LOOP_DETECTION',
              domain: 'ExecutionEngine',
              actionPayload: { tradeUsd, threshold: feedbackThresholdUsd },
              metrics: { tradeUsd, accountBalance },
              agentIds: ['ExecutionEngine'],
              moduleVersion: process.env.COMMIT_SHA ?? null,
              timestamp: new Date()
            });
            await db.updateOrderAudit(liveOrder.exchangeOrderId || liveOrder.id, { extra: { selfInfluencing: true } });
          } catch (e) { logger.warn('Failed to mark trace as self-influencing', e); }
        }
      } catch (e) { logger.warn('Feedback detection error', e); }

      // Only the quantity that actually executed at placement; subsequent
      // fills are recorded once, as deltas, by applyOrderSnapshot.
      if (liveOrder.filled > 0) {
        try { executionMetrics.recordFill(signal.symbol, liveOrder.filled); } catch (e) {}
      }
      if (liveOrder.slippagePct !== null && liveOrder.slippagePct !== undefined) {
        try { executionMetrics.recordSlippage(signal.symbol, liveOrder.slippagePct); } catch (e) {}
      }

      // success -> reset circuit breaker
      this.consecutiveFailures = 0;

      // Place stop-loss and take-profit orders; collect any extra reservations for multi-leg orders
      let childPlacementOk = persisted;
      if (persisted) {
        try {
          if (signal.stopLoss) {
            const ok = await this.placeStopLoss(signal.symbol, signal.type, amount, signal.stopLoss, reservationTokens, signal.symbol);
            if (!ok) childPlacementOk = false;
          }
          if (signal.takeProfit) {
            const ok = await this.placeTakeProfit(signal.symbol, signal.type, amount, signal.takeProfit, reservationTokens, signal.symbol);
            if (!ok) childPlacementOk = false;
          }
        } catch (childErr) {
          logger.warn('Child order placement error', childErr);
          childPlacementOk = false;
        }
      }

      // Commit or release all reservations based on child placements
      try {
        if (childPlacementOk) {
          for (const t of reservationTokens) {
            try { portfolioRiskManager.commitReservation(t); } catch (e) { logger.warn('Failed to commit reservation', e); }
          }
        } else {
          for (const t of reservationTokens) {
            try { portfolioRiskManager.releaseReservation(t); } catch (e) { logger.warn('Failed to release reservation', e); }
          }
        }
      } catch (e) {
        logger.warn('Reservation finalization error', e);
      }

      logger.info(`Order placed: ${signal.type} ${amount.toFixed(4)} ${signal.symbol} @ market (signal confidence: ${(signal.confidence * 100).toFixed(0)}%)`);

      // ✅ RL CALLBACK: Register trade with RL system for learning
      try {
        const frames = await db.getMarketFrames(signal.symbol, 20) || [];
        RLFeedbackCallbacks.onTradeOpen({
          tradeId: liveOrder.id,
          symbol: signal.symbol,
          side: signal.type === 'BUY' ? 'BUY' : 'SELL',
          entryPrice: liveOrder.avgPrice ?? signal.price ?? 0,
          entryTime: new Date(),
          quantity: liveOrder.filled,
          frames: frames as any,
          mlConfidence: signal.confidence || 0.5,
          source: 'LIVE'
        });
      } catch (rlError) {
        logger.warn('RL onTradeOpen callback error', rlError);
      }

      return liveOrder;
    } catch (error: any) {
      logger.error('Order execution failed', error);
      this.emit('orderError', { signal, error: error.message });

      // release reservation on failure
      try {
        if (reservationTokens && reservationTokens.length > 0) {
          for (const t of reservationTokens) {
            try { portfolioRiskManager.releaseReservation(t); } catch (e) { logger.warn('Failed to release reservation after error', e); }
          }
        } else if (typeof reservationTokens === 'string' && reservationTokens) {
          portfolioRiskManager.releaseReservation(reservationTokens);
        }
      } catch (e) {
        logger.warn('Failed to release reservation after error', e);
      }

      // circuit breaker: increment and possibly pause
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= this.circuitBreakerThreshold) {
        this.config.enabled = false;
        this.emit('pausedByCircuitBreaker', { threshold: this.circuitBreakerThreshold });
        logger.warn('Pausing execution due to repeated failures');
      }

      return null;
    }
  }

  /**
   * Evaluate the non-overridable hard limit gate for a signal.
   * Exposed so callers (routes, agents) can pre-check with identical semantics.
   */
  checkHardLimits(signal: Signal, requestedSizeUsd: number) {
    return evaluatePreTrade(
      {
        symbol: signal.symbol,
        price: signal.price,
        signalTimestamp: (signal as any).timestamp ?? null,
        requestedSizeUsd,
        currentExposureUsd: this.getTotalExposure(),
        symbolExposureUsd: this.getSymbolExposure(signal.symbol),
        openPositions: this.positions.size,
        leverage: this.config.defaultLeverage,
        engineEnabled: this.config.enabled,
      },
      {
        maxPositionSizeUsd: this.config.maxPositionSize,
        maxTotalExposureUsd: this.config.maxTotalExposure,
        maxLeverage: this.config.defaultLeverage,
        ...this.hardLimitOverrides,
      }
    );
  }

  /**
   * Close every open position. Safe to call repeatedly and while already flat:
   * per-position failures are isolated and reported rather than aborting the
   * sweep, and new placements are blocked for the duration.
   */
  async flattenAll(reason: string = 'manual'): Promise<FlattenResult> {
    // Concurrent requests join the running sweep instead of racing it, so
    // double-clicking the panic button cannot double-close a position.
    if (this.flattenInFlight) return this.flattenInFlight;
    this.flattenInFlight = this.runFlattenAll(reason).finally(() => {
      this.flattenInFlight = null;
    });
    return this.flattenInFlight;
  }

  private async runFlattenAll(reason: string): Promise<FlattenResult> {
    const logger = new ModuleLogger('LiveTrading');
    const closed: string[] = [];
    const failed: Array<{ positionId: string; symbol: string; error: string }> = [];

    // Block new placements for the whole sweep, even if it is re-entered.
    const alreadyFlattening = this.flattening;
    this.flattening = true;
    this.config.enabled = false;

    try {
      // Refresh from the exchange first so we do not miss positions that were
      // opened outside this process.
      try {
        await this.updatePositions();
      } catch (e) {
        logger.warn('flattenAll: position refresh failed, using local view', e);
      }

      const snapshot = Array.from(this.positions.values());
      for (const position of snapshot) {
        try {
          const ok = await this.closePosition(position.id);
          if (ok) closed.push(position.id);
          else failed.push({ positionId: position.id, symbol: position.symbol, error: 'close_returned_false' });
        } catch (err: any) {
          failed.push({ positionId: position.id, symbol: position.symbol, error: err?.message || String(err) });
        }
      }

      const result = { requested: snapshot.length, closed, failed, reason };
      recordFlattenAll(failed.length);
      logger.warn(`flattenAll(${reason}): ${closed.length}/${snapshot.length} closed, ${failed.length} failed`);
      this.emit('flattenAll', result);

      if (failed.length > 0) {
        // Unresolved exposure is an operator-visible condition.
        this.emit('flattenAllIncomplete', result);
      }

      return result;
    } finally {
      if (!alreadyFlattening) this.flattening = false;
    }
  }

  /**
   * Place stop-loss order
   */
  private async placeStopLoss(symbol: string, side: string, amount: number, stopPrice: number, reservationTokens?: string[], parentSymbol?: string): Promise<boolean> {
    if (!this.exchange) return false;

    const logger = new ModuleLogger('LiveTrading');
    let extraToken: string | null = null;
    try {
      // If this stop-loss is on a different symbol (multi-leg), reserve capital for that leg.
      // Estimate required USD exposure as price * amount (with optional buffer) and reserve via PortfolioRiskManager.
      if (parentSymbol && parentSymbol !== symbol) {
        // determine reference price: prefer explicit stopPrice, otherwise try ticker
        let refPrice = typeof stopPrice === 'number' && stopPrice > 0 ? stopPrice : 0;
        if ((!refPrice || refPrice <= 0) && this.exchange && typeof (this.exchange as any).fetchTicker === 'function') {
          try {
            const tk: any = await (this.exchange as any).fetchTicker(symbol);
            if (tk && (tk.last || tk.close || tk.price)) {
              refPrice = Number(tk.last || tk.close || tk.price) || refPrice;
            }
          } catch (_) {
            // ignore ticker fetch failure; we'll fall back to zero and let reserveCapital handle it
          }
        }

        const bufferPct = Number(process.env.CHILD_RESERVATION_BUFFER_PCT) || 2; // percent
        const multiplier = 1 + bufferPct / 100;
        const estimatedUsd = Math.abs(amount) * (refPrice || 0) * multiplier;

        if (estimatedUsd > 0) {
          try {
            extraToken = portfolioRiskManager.reserveCapital(estimatedUsd, `child-leg:${symbol}`);
            if (extraToken && reservationTokens) reservationTokens.push(extraToken);
            // if caller did not provide reservationTokens, commit immediately (we'll release on error below)
            if (!reservationTokens && extraToken) {
              try { portfolioRiskManager.commitReservation(extraToken); } catch (_) {}
            }
          } catch (resErr) {
            logger.warn('Failed to reserve capital for child stop-loss leg', resErr);
            // if we cannot reserve for the child leg, fail-safe: do not place the child order
            return false;
          }
        }
      }

      const stopSide = side === 'BUY' ? 'sell' : 'buy';
      await this.exchange.createOrder(
        symbol,
        'stop',
        stopSide,
        amount,
        undefined,
        { stopPrice }
      );
      logger.info(`Stop-loss placed at $${stopPrice.toFixed(2)}`);
      if (extraToken && reservationTokens && !reservationTokens.includes(extraToken)) reservationTokens.push(extraToken);
      return true;
    } catch (error) {
      logger.error('Failed to place stop-loss', error);
      // release any extra reservation we may have created immediately
      if (extraToken) {
        try { portfolioRiskManager.releaseReservation(extraToken); } catch (_) {}
      }
      return false;
    }
  }

  /**
   * Place take-profit order
   */
  private async placeTakeProfit(symbol: string, side: string, amount: number, tpPrice: number, reservationTokens?: string[], parentSymbol?: string): Promise<boolean> {
    if (!this.exchange) return false;

    const logger = new ModuleLogger('LiveTrading');
    let extraToken: string | null = null;
    try {
      // If this TP leg is on a different symbol (multi-leg), reserve capital for that leg.
      if (parentSymbol && parentSymbol !== symbol) {
        let refPrice = typeof tpPrice === 'number' && tpPrice > 0 ? tpPrice : 0;
        if ((!refPrice || refPrice <= 0) && this.exchange && typeof (this.exchange as any).fetchTicker === 'function') {
          try {
            const tk: any = await (this.exchange as any).fetchTicker(symbol);
            if (tk && (tk.last || tk.close || tk.price)) {
              refPrice = Number(tk.last || tk.close || tk.price) || refPrice;
            }
          } catch (_) {}
        }

        const bufferPct = Number(process.env.CHILD_RESERVATION_BUFFER_PCT) || 2; // percent
        const multiplier = 1 + bufferPct / 100;
        const estimatedUsd = Math.abs(amount) * (refPrice || 0) * multiplier;

        if (estimatedUsd > 0) {
          try {
            extraToken = portfolioRiskManager.reserveCapital(estimatedUsd, `child-leg:${symbol}`);
            if (extraToken && reservationTokens) reservationTokens.push(extraToken);
            if (!reservationTokens && extraToken) {
              try { portfolioRiskManager.commitReservation(extraToken); } catch (_) {}
            }
          } catch (resErr) {
            logger.warn('Failed to reserve capital for child take-profit leg', resErr);
            return false;
          }
        }
      }

      const tpSide = side === 'BUY' ? 'sell' : 'buy';
      await this.exchange.createOrder(
        symbol,
        'limit',
        tpSide,
        amount,
        tpPrice
      );
      logger.info(`Take-profit placed at $${tpPrice.toFixed(2)}`);
      if (extraToken && reservationTokens && !reservationTokens.includes(extraToken)) reservationTokens.push(extraToken);
      return true;
    } catch (error) {
      logger.error('Failed to place take-profit', error);
      if (extraToken) {
        try { portfolioRiskManager.releaseReservation(extraToken); } catch (_) {}
      }
      return false;
    }
  }

  /**
   * Update positions with current prices
   */
  private async updatePositions(): Promise<void> {
    if (!this.exchange) return;

    try {
      const positions = await this.exchange.fetchPositions();
      if (!Array.isArray(positions)) {
        // An unparseable answer is not evidence that we are flat.
        new ModuleLogger('LiveTrading').warn('Position refresh returned no usable array; keeping local view');
        return;
      }

      // The exchange is authoritative. Positions are keyed by symbol so a
      // refresh updates the existing entry instead of appending a new one per
      // poll (the old `${symbol}-${timestamp}` id multiplied one real position
      // into dozens, inflating open-position and exposure counts).
      const seenSymbols = new Set<string>();
      let stateMutated = false;

      for (const pos of positions) {
        if (Math.abs(pos.contracts || 0) > 0) {
          const existing = this.positions.get(pos.symbol);
          seenSymbols.add(pos.symbol);
          const livePos: LivePosition = {
            id: pos.symbol,
            symbol: pos.symbol,
            side: (pos.side as 'long' | 'short') || 'long',
            entryPrice: pos.entryPrice || 0,
            currentPrice: pos.markPrice || 0,
            quantity: Math.abs(pos.contracts || 0),
            leverage: pos.leverage || 1,
            pnl: pos.unrealizedPnl || 0,
            pnlPercent: pos.percentage || 0,
            stopLoss: undefined,
            takeProfit: undefined,
            openTime: existing?.openTime ?? pos.timestamp ?? Date.now(),
            marginUsed: pos.initialMargin || 0,
            liquidationPrice: pos.liquidationPrice,
            orders: existing?.orders ?? []
          };
          livePos.stopLoss = existing?.stopLoss;
          livePos.takeProfit = existing?.takeProfit;

          this.positions.set(livePos.id, livePos);
          stateMutated = true;

          // Update portfolio risk manager with latest price
          try {
            portfolioRiskManager.updatePositionPrice(livePos.symbol, livePos.currentPrice);
          } catch (pmErr) {
            new ModuleLogger('LiveTrading').warn('Failed to update PortfolioRiskManager position price', pmErr);
          }
          // RL CALLBACK: Track live position metrics (MFE/MAE on every update)
          try {
            RLFeedbackCallbacks.onTradeTick(livePos.id, pos.markPrice || 0);
          } catch (rlError) {
            new ModuleLogger('LiveTrading').warn(`RL onTradeTick callback error: ${rlError}`);
          }
        } else if (pos?.symbol) {
          // Explicitly reported flat.
          seenSymbols.add(pos.symbol);
        }
      }

      // A position the exchange explicitly reports as flat is closed and is
      // dropped. A position merely *absent* from the response is NOT treated as
      // closed — the response may be filtered or truncated, and turning unknown
      // into absent would silently shrink measured exposure. Those are surfaced
      // for reconciliation instead, and keep counting toward risk limits.
      for (const [id, position] of Array.from(this.positions.entries())) {
        const stillOpen = positions.some(
          (p: any) => p?.symbol === position.symbol && Math.abs(p?.contracts || 0) > 0
        );
        if (!stillOpen && !seenSymbols.has(position.symbol)) {
          this.emit('positionUnconfirmed', {
            positionId: id,
            symbol: position.symbol,
            timestamp: Date.now(),
          });
          continue;
        }
        if (!stillOpen) {
          this.positions.delete(id);
          stateMutated = true;
          this.emit('positionClosedExternally', {
            positionId: id,
            symbol: position.symbol,
            timestamp: Date.now(),
          });
          try {
            portfolioRiskManager.removePosition(position.symbol);
          } catch (pmErr) {
            new ModuleLogger('LiveTrading').warn('Failed to remove externally closed position', pmErr);
          }
        }
      }

      this.emit('positionsUpdated', Array.from(this.positions.values()));
      if (stateMutated) this.persistLocalState();
    } catch (error) {
      // Fail closed on unknown position state: keep the local view (which is
      // never smaller than what we know about) rather than assuming flat.
      new ModuleLogger('LiveTrading').error('Failed to update positions', error);
      this.emit('positionRefreshFailed', { timestamp: Date.now() });
    }
  }

  /**
   * Check order status
   */
  private async checkOrders(): Promise<void> {
    if (!this.exchange) return;

    for (const order of this.orders.values()) {
      if (order.status !== 'open' && order.status !== 'pending') continue;
      try {
        const updated = await this.exchange.fetchOrder(order.exchangeOrderId, order.symbol);
        // Applied on every poll, not only on status transitions: an order can
        // accumulate partial fills while staying 'open'.
        await this.applyOrderSnapshot(order, updated);
      } catch (error) {
        // An order we cannot query is in an UNKNOWN state, not a finished one.
        new ModuleLogger('LiveTrading').warn(
          `Order state unknown: fetchOrder failed for ${order.exchangeOrderId} (${order.symbol})`
        );
        recordOrderReconciliation('unknown');
        this.emit('orderStateUnknown', {
          orderId: order.id,
          exchangeOrderId: order.exchangeOrderId,
          symbol: order.symbol,
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * Compare local state with the exchange and adopt the exchange's view of
   * positions. Discrepancies we cannot resolve leave the barrier closed.
   */
  async reconcileWithExchange(): Promise<ReconciliationReport> {
    const logger = new ModuleLogger('LiveTrading');
    const report = await reconcileAtStartup({
      exchange: this.exchange as any,
      localOrders: Array.from(this.orders.values()).map((o) => ({
        id: o.id,
        exchangeOrderId: o.exchangeOrderId,
        clientOrderId: o.clientOrderId ?? null,
        symbol: o.symbol,
        amount: o.amount,
        filled: o.filled,
        status: o.status,
      })),
      localPositions: Array.from(this.positions.values()).map((p) => ({
        id: p.id,
        symbol: p.symbol,
        quantity: p.quantity,
      })),
    });

    let stateMutated = false;
    const localByExchangeId = new Map(
      Array.from(this.orders.values()).map((order) => [String(order.exchangeOrderId), order])
    );
    const localByClientId = new Map(
      Array.from(this.orders.values())
        .filter((order) => order.clientOrderId)
        .map((order) => [String(order.clientOrderId), order])
    );
    for (const exchangeOrder of report.orders) {
      const local = localByExchangeId.get(String(exchangeOrder.exchangeOrderId))
        ?? (exchangeOrder.clientOrderId
          ? localByClientId.get(String(exchangeOrder.clientOrderId))
          : undefined);
      if (!local) continue;
      const before = captureOrderState(local);
      local.exchangeOrderId = exchangeOrder.exchangeOrderId;
      await this.applyOrderSnapshot(local, {
        status: exchangeOrder.status,
        filled: exchangeOrder.filled,
      });
      stateMutated = stateMutated || orderStateChanged(before, captureOrderState(local));
    }

    // Adopting exchange positions is idempotent: keyed by symbol, replacing
    // rather than appending, so repeated reconciliation cannot duplicate them.
    for (const pos of report.positions) {
      const existing = this.positions.get(pos.symbol);
      this.positions.set(pos.symbol, {
        id: pos.symbol,
        symbol: pos.symbol,
        side: pos.side,
        entryPrice: pos.entryPrice,
        currentPrice: pos.markPrice,
        quantity: pos.quantity,
        leverage: pos.leverage,
        pnl: pos.unrealizedPnl,
        pnlPercent: existing?.pnlPercent ?? 0,
        stopLoss: existing?.stopLoss,
        takeProfit: existing?.takeProfit,
        openTime: existing?.openTime ?? Date.now(),
        marginUsed: pos.marginUsed,
        liquidationPrice: existing?.liquidationPrice,
        orders: existing?.orders ?? [],
      });
      stateMutated = true;
    }

    this.reconciliation = report;
    if (stateMutated || report.complete) this.persistLocalState();

    safetyEventLog.record({
      type: 'startup_reconciliation',
      detail: report.complete ? 'complete' : `incomplete: ${report.blockedReason}`,
      data: {
        positions: report.positions.length,
        openOrders: report.orders.length,
        discrepancies: report.discrepancies,
      },
    });

    if (report.complete) {
      logger.info(
        `Startup reconciliation complete: ${report.positions.length} position(s), ${report.orders.length} open order(s)`
      );
    } else {
      logger.error(`Startup reconciliation INCOMPLETE: ${report.blockedReason}`, {
        discrepancies: report.discrepancies,
      });
    }
    this.emit('reconciliation', report);
    return report;
  }

  /** Last reconciliation result, for operator/health reporting. */
  getReconciliation(): ReconciliationReport | null {
    return this.reconciliation;
  }

  /**
   * Seed a fill ledger from the placement response.
   */
  private buildInitialFillAccount(snapshot: any, requestedAmount: number): FillAccount {
    const empty = createFillAccount();
    const trades: any[] = Array.isArray(snapshot?.trades) ? snapshot.trades : [];
    if (trades.length > 0) {
      return applyFills(
        empty,
        trades.map((t) => ({
          id: String(t?.id ?? ''),
          amount: t?.amount,
          price: t?.price,
          cost: t?.cost,
          fee: t?.fee ?? null,
          takerOrMaker: t?.takerOrMaker ?? null,
          timestamp: t?.timestamp ?? null,
        })),
        requestedAmount
      ).account;
    }

    const filled = Number(snapshot?.filled);
    const cost = Number(snapshot?.cost);
    const average = Number(snapshot?.average ?? snapshot?.price);
    const resolvedFilled = Number.isFinite(filled) && filled > 0 ? filled : 0;
    const resolvedCost = Number.isFinite(cost) && cost > 0
      ? cost
      : (resolvedFilled > 0 && Number.isFinite(average) && average > 0 ? resolvedFilled * average : 0);

    const fees: FeeTotal[] = [];
    const feeCost = Number(snapshot?.fee?.cost);
    if (Number.isFinite(feeCost) && feeCost !== 0) {
      fees.push({ currency: String(snapshot?.fee?.currency || 'UNKNOWN').toUpperCase(), cost: feeCost });
    }

    return {
      ...empty,
      filled: resolvedFilled,
      cost: resolvedCost,
      avgPrice: resolvedFilled > 0 && resolvedCost > 0 ? resolvedCost / resolvedFilled : null,
      remaining: Math.max(0, requestedAmount - resolvedFilled),
      fees,
    };
  }

  /**
   * Fold an exchange order snapshot into local state through the fill ledger.
   *
   * Two modes, because exchanges differ: when the snapshot carries individual
   * trades we accumulate them idempotently by trade id; otherwise we adopt the
   * snapshot's absolute filled/cost, which is also idempotent because it is a
   * replacement rather than an addition.
   */
  private async applyOrderSnapshot(order: LiveOrder, snapshot: any): Promise<void> {
    const logger = new ModuleLogger('LiveTrading');
    const previousLocalState = captureOrderState(order);
    const previousFilled = order.filled;

    if (!order.account) order.account = createFillAccount();

    const trades: any[] = Array.isArray(snapshot?.trades) ? snapshot.trades : [];
    if (trades.length > 0) {
      const fills: ExchangeFill[] = trades.map((t) => ({
        id: String(t?.id ?? ''),
        amount: t?.amount,
        price: t?.price,
        cost: t?.cost,
        fee: t?.fee ?? null,
        takerOrMaker: t?.takerOrMaker ?? null,
        timestamp: t?.timestamp ?? null,
      }));
      const result = applyFills(order.account, fills, order.amount);
      order.account = result.account;
      const unusable = result.rejected.filter((r) => r.reason !== 'duplicate');
      if (unusable.length > 0) {
        logger.warn(`Discarded ${unusable.length} unusable fill record(s) for ${order.exchangeOrderId}`);
      }
    } else {
      // Snapshot mode: absolute values reported by the exchange.
      const filled = Number(snapshot?.filled);
      const cost = Number(snapshot?.cost);
      if (Number.isFinite(filled) && filled >= 0) {
        const snapshotAverage = Number(snapshot?.average);
        const hasCost = Number.isFinite(cost) && cost > 0;
        const hasAverage = Number.isFinite(snapshotAverage) && snapshotAverage > 0;
        const resolvedCost = hasCost
          ? cost
          : (hasAverage
              ? filled * snapshotAverage
              : filled === order.account.filled ? order.account.cost : 0);
        order.account = {
          ...order.account,
          filled,
          cost: resolvedCost,
          avgPrice: filled > 0 && resolvedCost > 0 ? resolvedCost / filled : null,
          remaining: Math.max(0, order.amount - filled),
        };
      }
      const snapshotFee = snapshot?.fee;
      const feeCost = Number(snapshotFee?.cost);
      if (Number.isFinite(feeCost) && feeCost !== 0) {
        order.account.fees = [{ currency: String(snapshotFee?.currency || 'UNKNOWN').toUpperCase(), cost: feeCost }];
      }
    }

    order.filled = order.account.filled;
    order.cost = order.account.cost;
    order.remaining = order.account.remaining;
    order.avgPrice = order.account.avgPrice;
    order.fees = order.account.fees;
    order.fee = order.account.fees[0] ? { ...order.account.fees[0] } : order.fee;
    order.slippagePct = computeSlippagePct(order.requestedPrice ?? order.price ?? null, order.avgPrice, order.side);

    const outcome = classifyOutcome(snapshot?.status, order.account, order.amount);
    order.outcome = outcome;
    order.status = (typeof snapshot?.status === 'string' ? snapshot.status : order.status) as LiveOrder['status'];

    const filledDelta = order.filled - previousFilled;
    if (!orderStateChanged(previousLocalState, captureOrderState(order))) {
      return;
    }

    if (filledDelta > 0) {
      try { executionMetrics.recordFill(order.symbol, filledDelta); } catch { /* metrics are best-effort */ }
      if (order.slippagePct !== null && order.slippagePct !== undefined) {
        try { executionMetrics.recordSlippage(order.symbol, order.slippagePct); } catch { /* best-effort */ }
      }
      if (order.avgPrice) {
        try {
          portfolioRiskManager.updatePositionPrice(order.symbol, order.avgPrice);
        } catch (pmErr) {
          logger.warn('Failed to update PortfolioRiskManager after fill', pmErr);
        }
      }
    }

    this.emit('orderUpdated', order);

    if (outcome === 'filled' || outcome === 'canceled_partially_filled' || outcome === 'canceled_unfilled') {
      logger.info(
        `Order ${outcome}: ${order.side} ${order.filled} ${order.symbol}` +
          (order.avgPrice ? ` @ ${order.avgPrice}` : '') +
          (order.slippagePct !== null && order.slippagePct !== undefined
            ? ` (slippage ${order.slippagePct.toFixed(4)}%)`
            : ' (slippage unknown)')
      );
      if (outcome === 'canceled_partially_filled') {
        // A cancel that left exposure behind is not a no-op.
        this.emit('orderCanceledWithFills', {
          orderId: order.id,
          exchangeOrderId: order.exchangeOrderId,
          symbol: order.symbol,
          filled: order.filled,
          avgPrice: order.avgPrice,
        });
      }
      this.emit('orderSettled', order);
    }

    try {
      await db.updateOrderAudit(order.exchangeOrderId || order.id, {
        fills: order.account.fillIds.map((id) => ({ id })),
        realSlippage: order.slippagePct,
        extra: {
          outcome,
          filled: order.filled,
          remaining: order.remaining,
          avgPrice: order.avgPrice,
          fees: order.fees,
          makerFilled: order.account.makerFilled,
          takerFilled: order.account.takerFilled,
        },
      });
    } catch (e) {
      // A durable write we cannot complete means local state is no longer
      // provably recoverable; stop trusting the cached durability answer.
      durabilityGate.invalidate('updateOrderAudit failed');
      logger.warn('Failed to persist order audit after fill', e);
    }
    this.persistLocalState();
  }

  /**
   * Close a position
   */
  async closePosition(positionId: string): Promise<boolean> {
    const position = this.positions.get(positionId);
    if (!position || !this.exchange) return false;

    const side = position.side === 'long' ? 'sell' : 'buy';
    const clientOrderId = buildClientOrderId('ssclose', positionId);
    let exchangeOrder: any;
    try {
      const params: Record<string, unknown> = {
        clientOrderId,
        newClientOrderId: clientOrderId,
      };
      const market = (this.exchange as any).markets?.[position.symbol];
      const defaultType = String((this.exchange as any).options?.defaultType ?? '').toLowerCase();
      if (
        market?.type === 'swap' ||
        market?.type === 'future' ||
        market?.contract === true ||
        /swap|future|perpetual/.test(defaultType)
      ) {
        params.reduceOnly = true;
      }
      exchangeOrder = await this.exchange.createOrder(
        position.symbol,
        'market',
        side,
        position.quantity,
        undefined,
        params,
      );
    } catch (error) {
      if (isAmbiguousError(error)) {
        const reconciliation = await reconcileByClientOrderId(
          this.exchange,
          position.symbol,
          clientOrderId,
        );
        recordOrderReconciliation(reconciliation.state);
        safetyEventLog.record({
          type: reconciliation.state === 'unknown' ? 'order_state_unknown' : 'order_reconciled',
          detail: `close order ${reconciliation.state}`,
          data: { positionId, symbol: position.symbol, clientOrderId },
        });
        if (reconciliation.state === 'exists') {
          exchangeOrder = reconciliation.order;
        } else {
          if (reconciliation.state === 'unknown') {
            this.blockForExecution('close_order_state_unknown', 'close placement outcome could not be reconciled', {
              positionId,
              symbol: position.symbol,
              clientOrderId,
            });
          }
          return false;
        }
      } else {
        const fe = formatError(error);
        console.error('[Live Trading] Failed to close position:', fe.message, { stack: fe.stack });
        return false;
      }
    }

    const closeOrder: LiveOrder = {
      id: typeof randomUUID === 'function' ? randomUUID() : `close-${Date.now()}`,
      exchangeOrderId: String(exchangeOrder?.id ?? exchangeOrder?.orderId ?? clientOrderId),
      clientOrderId,
      symbol: position.symbol,
      side,
      type: 'market',
      price: Number.isFinite(Number(exchangeOrder?.price)) ? Number(exchangeOrder.price) : position.currentPrice,
      amount: position.quantity,
      status: (typeof exchangeOrder?.status === 'string' ? exchangeOrder.status : 'open') as LiveOrder['status'],
      filled: 0,
      remaining: position.quantity,
      cost: 0,
      requestedPrice: position.currentPrice,
      slippagePct: null,
      timestamp: Date.now(),
      account: this.buildInitialFillAccount(exchangeOrder, position.quantity),
    };
    closeOrder.filled = closeOrder.account?.filled ?? 0;
    closeOrder.cost = closeOrder.account?.cost ?? 0;
    closeOrder.remaining = closeOrder.account?.remaining ?? position.quantity;
    closeOrder.avgPrice = closeOrder.account?.avgPrice ?? null;
    closeOrder.fees = closeOrder.account?.fees ?? [];
    closeOrder.fee = closeOrder.fees[0] ? { ...closeOrder.fees[0] } : undefined;
    if (
      this.config.testMode &&
      closeOrder.filled === 0 &&
      !exchangeOrder?.status &&
      !Array.isArray(exchangeOrder?.trades)
    ) {
      closeOrder.filled = position.quantity;
      closeOrder.remaining = 0;
      closeOrder.cost = position.quantity * (closeOrder.price ?? position.currentPrice);
      closeOrder.avgPrice = closeOrder.price ?? position.currentPrice;
      closeOrder.account = {
        ...(closeOrder.account ?? createFillAccount()),
        filled: closeOrder.filled,
        cost: closeOrder.cost,
        avgPrice: closeOrder.avgPrice,
        remaining: 0,
      };
      closeOrder.status = 'closed';
    }
    closeOrder.outcome = classifyOutcome(closeOrder.status, closeOrder.account ?? createFillAccount(), closeOrder.amount);
    closeOrder.slippagePct = computeSlippagePct(closeOrder.requestedPrice ?? null, closeOrder.avgPrice ?? null, side);
    this.orders.set(closeOrder.id, closeOrder);
    position.orders = [...(position.orders ?? []), closeOrder];

    const filled = Math.min(position.quantity, Math.max(0, closeOrder.filled));
    const remaining = Math.max(0, position.quantity - filled);
    let realized: ReturnType<typeof computeRealizedClosePnl> | null = null;
    if (filled > 0) {
      realized = computeRealizedClosePnl({
        side: position.side,
        entryPrice: position.entryPrice,
        exitPrice: closeOrder.avgPrice ?? null,
        quantity: filled,
        fees: closeOrder.fees ?? [],
        quoteCurrency: this.quoteCurrency(position.symbol),
      });
      const entry: RealizedPnlEntry = {
        id: `trade-close:${closeOrder.exchangeOrderId}`,
        category: 'trade',
        at: new Date(Date.now()).toISOString(),
        symbol: position.symbol,
        quoteCurrency: this.quoteCurrency(position.symbol) ?? 'UNKNOWN',
        pnl: realized.pnl,
        grossPnl: realized.grossPnl,
        quoteFees: realized.quoteFees,
        unconvertedFees: realized.unconvertedFees,
        quantity: filled,
        entryPrice: position.entryPrice,
        exitPrice: closeOrder.avgPrice,
      };
      try {
        this.realizedPnlLedger.append(entry);
        if (entry.unconvertedFees.length > 0 && entry.quoteCurrency !== 'UNKNOWN') {
          await this.appendQuoteConversions(entry.id, entry.quoteCurrency, entry.unconvertedFees.map((fee, feeIndex) => ({
            feeIndex,
            kind: 'fee' as const,
            sourceCurrency: fee.currency,
            sourceAmount: fee.cost,
          })));
        }
      } catch (ledgerError: any) {
        this.realizedPnlHealthy = false;
        this.blockForExecution('realized_pnl_persistence_failed', ledgerError?.message, {
          positionId,
          symbol: position.symbol,
          entryId: entry.id,
        });
      }
    }

    if (remaining <= Math.max(1e-12, position.quantity * 1e-9)) {
      this.positions.delete(positionId);
      try {
        portfolioRiskManager.removePosition(position.symbol);
      } catch (pmErr) {
        console.warn('[Live Trading] Failed to remove position from PortfolioRiskManager', pmErr);
      }
      this.emit('positionClosed', position);
    } else if (filled > 0) {
      position.quantity = remaining;
      position.currentPrice = closeOrder.avgPrice ?? position.currentPrice;
      position.pnl = position.side === 'long'
        ? (position.currentPrice - position.entryPrice) * remaining
        : (position.entryPrice - position.currentPrice) * remaining;
      position.pnlPercent = position.entryPrice > 0
        ? (position.pnl / (position.entryPrice * remaining)) * 100
        : 0;
      this.positions.set(positionId, position);
      this.emit('positionPartiallyClosed', {
        position,
        order: closeOrder,
        filled,
        remaining,
      });
    }

    const persisted = this.persistLocalState();
    if (!persisted) {
      safetyEventLog.record({
        type: 'execution_blocked',
        detail: 'close order outcome known but local exposure could not be durably recorded',
        data: { positionId, symbol: position.symbol, unrecordableExposure: true },
      });
    }

    if (filled > 0) {
      try {
        RLFeedbackCallbacks.onTradeClose(positionId, {
          exitPrice: closeOrder.avgPrice ?? null,
          exitTime: new Date(),
          exitReason: remaining > 0 ? 'PARTIAL' : 'MANUAL',
          pnl: realized?.pnl ?? null,
          pnlPercent: realized?.pnl !== null && realized?.pnl !== undefined && position.entryPrice > 0
            ? (realized.pnl / (position.entryPrice * filled)) * 100
            : null,
          pnlUnknown: realized?.pnl === null || realized === null,
          maxProfit: 0,
          maxLoss: 0,
        });
      } catch (rlError) {
        console.warn(`[Live Trading] RL onTradeClose callback error: ${rlError}`);
      }
    }

    if (filled <= 0 || remaining > Math.max(1e-12, position.quantity * 1e-9)) {
      return false;
    }
    return persisted;
  }

  /**
   * Exposure of a single position in USD.
   *
   * Margin alone understates exposure by the leverage factor, which would let
   * a 10x position consume a tenth of the configured exposure budget. Notional
   * is the risk-relevant figure; margin is only a floor for the case where we
   * have no usable price.
   */
  private positionExposureUsd(position: LivePosition): number {
    const price = position.currentPrice || position.entryPrice || 0;
    const notional = Math.abs(position.quantity || 0) * price;
    const margin = Math.abs(position.marginUsed || 0);
    return Math.max(Number.isFinite(notional) ? notional : 0, Number.isFinite(margin) ? margin : 0);
  }

  /**
   * Get total exposure across all positions
   */
  private getTotalExposure(): number {
    let total = 0;
    for (const position of this.positions.values()) {
      total += this.positionExposureUsd(position);
    }
    return total;
  }

  /** Notional exposure currently open for a single symbol. */
  private getSymbolExposure(symbol: string): number {
    let total = 0;
    for (const position of this.positions.values()) {
      if (position.symbol === symbol) total += this.positionExposureUsd(position);
    }
    return total;
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      exchange: this.config.exchange,
      testMode: this.config.testMode,
      positions: Array.from(this.positions.values()),
      openOrders: Array.from(this.orders.values()).filter(o => o.status === 'open'),
      totalExposure: this.getTotalExposure(),
      config: this.config
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ExecutionConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('configUpdated', this.config);
  }

  getDiagnostics() {
    return {
      ...this.getStatus(),
      consecutiveFailures: this.consecutiveFailures,
      circuitBreakerThreshold: this.circuitBreakerThreshold,
      rlPositionAgentConnected: !!(global as any).rlPositionAgent,
      uptimeSec: Math.floor(process.uptime())
    };
  }

  pause() {
    this.config.enabled = false;
    this.isRunning = false;
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    this.emit('paused');
  }

  /**
   * Stop trading and detach from the process-wide safety singletons. Without
   * this, every engine ever constructed keeps receiving kill-switch and
   * circuit-breaker events for the life of the process.
   */
  dispose(): void {
    this.pause();
    if (this.onKill) systemKillSwitch.off('kill', this.onKill);
    if (this.onKillCleared) systemKillSwitch.off('clear', this.onKillCleared);
    if (this.onBreakerActivated) liveCircuitBreaker.off('activated', this.onBreakerActivated);
    if (this.onBreakerCleared) liveCircuitBreaker.off('cleared', this.onBreakerCleared);
    this.onKill = undefined;
    this.onKillCleared = undefined;
    this.onBreakerActivated = undefined;
    this.onBreakerCleared = undefined;
  }

  async resume(): Promise<boolean> {
    // Resuming must respect the global safety controls.
    if (systemKillSwitch.isKilled()) {
      new ModuleLogger('LiveTrading').warn('Resume refused: system kill-switch active');
      this.emit('resumeRefused', { reason: 'kill_switch_active', state: systemKillSwitch.getState() });
      return false;
    }
    if (liveCircuitBreaker.isActive()) {
      new ModuleLogger('LiveTrading').warn('Resume refused: live circuit breaker active');
      this.emit('resumeRefused', { reason: 'circuit_breaker_active', state: liveCircuitBreaker.getState() });
      return false;
    }
    // start() re-checks durability; resume must not bypass it by flipping the
    // flags directly.
    if (!this.isRunning) {
      try {
        await this.start();
      } catch (err) {
        new ModuleLogger('LiveTrading').error('Resume failed to start engine', formatError(err));
        return false;
      }
    }
    this.emit('resumed');
    return true;
  }
}

// Singleton instance (disabled by default for safety)
export const liveTradingEngine = new LiveTradingEngine({
  enabled: false,
  testMode: true
});
