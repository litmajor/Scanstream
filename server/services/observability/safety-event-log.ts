/**
 * Durable safety + operator audit log.
 *
 * Counters in memory answer "how often"; after an incident the questions are
 * "what happened, in what order, who asked for it, and what did the system
 * know at the time" — and those answers must survive the restart that follows
 * the incident. So safety-critical events and every operator action against a
 * capital-moving endpoint are appended to an append-only JSONL file.
 *
 * Deliberately small: a file, an fsync-free append, and a size cap. This is not
 * an observability platform, and it is not on the hot path of order placement.
 *
 * The operator token is never recorded. Operator identity is the fact that a
 * request carried the shared token, recorded as `shared-operator-token`.
 */

import fs from 'fs';
import path from 'path';

export type SafetyEventType =
  | 'execution_blocked'
  | 'integrity_bypass_blocked'
  | 'candle_rejected'
  | 'order_reconciled'
  | 'order_state_unknown'
  | 'startup_reconciliation'
  | 'flatten_all'
  | 'flatten_failed'
  | 'kill_switch'
  | 'circuit_breaker'
  | 'durability_failure'
  | 'funding_unknown'
  | 'conversion_unknown'
  | 'funding_baseline_resolved'
  | 'realized_pnl_resolved'
  | 'operator_action';

export type OperatorAction =
  | 'start'
  | 'stop'
  | 'resume'
  | 'pause'
  | 'config'
  | 'execute'
  | 'close'
  | 'flatten_all'
  | 'kill_switch_activate'
  | 'kill_switch_clear'
  | 'circuit_breaker_activate'
  | 'circuit_breaker_clear'
  | 'resolve_realized_pnl'
  | 'resolve_funding_baseline'
  | 'execution_decision'
  | 'record_outcome'
  | 'reset_execution'
  | 'prune_model_history'
  | 'exit_orchestrator'
  | 'exit_opposition'
  | 'exit_microstructure'
  | 'exit_consensus'
  | 'exit_coordinate'
  | 'signal_generate';

export interface SafetyEvent {
  type: SafetyEventType;
  at: string;
  detail?: string;
  /** Free-form, must never contain secrets. */
  data?: Record<string, unknown>;
}

export interface OperatorAuditEvent extends SafetyEvent {
  type: 'operator_action';
  action: OperatorAction;
  /** Always the shared token identity; the token value is never stored. */
  operator: 'shared-operator-token';
  target?: string;
  previousState?: unknown;
  resultingState?: unknown;
  success: boolean;
  reason?: string;
  requestId?: string;
}

const DEFAULT_FILE = path.join(process.cwd(), 'data', 'safety-events.jsonl');
/** Rotated at 8 MB; one previous generation is kept. */
const MAX_BYTES = 8 * 1024 * 1024;
const MEMORY_LIMIT = 500;

export class SafetyEventLog {
  private filePath: string;
  private recent: SafetyEvent[] = [];
  private writeFailures = 0;
  /**
   * Under the test runner the default path is not written to, so unit tests do
   * not append to the operator's real audit trail. Tests that exercise
   * durability call setFilePath() with a temp file, which enables writes.
   */
  private diskEnabled: boolean;

  constructor(filePath: string = DEFAULT_FILE) {
    this.filePath = filePath;
    this.diskEnabled = !process.env.VITEST;
  }

  /** Test seam. Also resets the in-memory tail. */
  setFilePath(filePath: string): void {
    this.filePath = filePath;
    this.recent = [];
    this.writeFailures = 0;
    this.diskEnabled = true;
  }

  record(event: Omit<SafetyEvent, 'at'> & { at?: string }): SafetyEvent {
    const full: SafetyEvent = { ...event, at: event.at ?? new Date().toISOString() };

    this.recent.push(full);
    if (this.recent.length > MEMORY_LIMIT) this.recent.shift();

    this.append(full);
    return full;
  }

  recordOperatorAction(
    event: Omit<OperatorAuditEvent, 'type' | 'at' | 'operator'> & { at?: string }
  ): OperatorAuditEvent {
    const full: OperatorAuditEvent = {
      ...event,
      type: 'operator_action',
      operator: 'shared-operator-token',
      at: event.at ?? new Date().toISOString(),
    };
    this.recent.push(full);
    if (this.recent.length > MEMORY_LIMIT) this.recent.shift();
    this.append(full);
    return full;
  }

  /** Most recent events from this process, newest last. */
  tail(limit = 100): SafetyEvent[] {
    return this.recent.slice(-limit);
  }

  /**
   * Events read back from disk, including those written before the last
   * restart. Corrupt lines are skipped rather than failing the read: a
   * truncated final line is the expected outcome of a crash mid-append.
   */
  readPersisted(limit = 100): SafetyEvent[] {
    try {
      if (!fs.existsSync(this.filePath)) return [];
      const lines = fs.readFileSync(this.filePath, 'utf8').split('\n').filter(Boolean);
      const out: SafetyEvent[] = [];
      for (const line of lines.slice(-limit)) {
        try {
          out.push(JSON.parse(line));
        } catch {
          /* skip corrupt line */
        }
      }
      return out;
    } catch {
      return [];
    }
  }

  /** Non-zero means safety events may be missing from disk. */
  getWriteFailures(): number {
    return this.writeFailures;
  }

  private append(event: SafetyEvent): void {
    if (!this.diskEnabled) return;
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      this.rotateIfNeeded();
      fs.appendFileSync(this.filePath, `${JSON.stringify(event)}\n`, 'utf8');
    } catch {
      // A failed audit write must never take down the trading process, but it
      // must be visible: surfaced through getWriteFailures() and health.
      this.writeFailures += 1;
    }
  }

  private rotateIfNeeded(): void {
    try {
      const stat = fs.statSync(this.filePath);
      if (stat.size < MAX_BYTES) return;
      fs.renameSync(this.filePath, `${this.filePath}.1`);
    } catch {
      /* missing file: nothing to rotate */
    }
  }
}

export const safetyEventLog = new SafetyEventLog();
