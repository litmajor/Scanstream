import fs from 'fs';
import path from 'path';

export const LOCAL_STATE_SCHEMA_VERSION = 1;

export interface DurableLocalState {
  schemaVersion: number;
  writtenAt: string;
  orders: unknown[];
  positions: unknown[];
}

export type LocalStateLoadResult =
  | { status: 'absent' }
  | { status: 'ok'; state: DurableLocalState }
  | { status: 'unreadable'; reason: string };

export interface DurableLocalStateStoreOptions {
  filePath?: string;
  clock?: () => number;
}

const DEFAULT_STATE_FILE = path.join(process.cwd(), 'data', 'live-execution-state.json');

/**
 * The local view is part of the evidence used to decide whether live trading
 * may resume. A torn or unknown state file is therefore unknown exposure, not
 * an empty account.
 */
export class DurableLocalStateStore {
  private readonly filePath: string;
  private readonly clock: () => number;

  constructor(options: DurableLocalStateStoreOptions = {}) {
    this.filePath = options.filePath ?? DEFAULT_STATE_FILE;
    this.clock = options.clock ?? Date.now;
  }

  getPath(): string {
    return this.filePath;
  }

  load(): LocalStateLoadResult {
    if (!fs.existsSync(this.filePath)) return { status: 'absent' };

    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (!this.isValidState(parsed)) {
        return { status: 'unreadable', reason: 'unknown or invalid local state schema' };
      }
      return { status: 'ok', state: parsed };
    } catch (error: any) {
      return {
        status: 'unreadable',
        reason: error?.message ? String(error.message) : 'local state file could not be parsed',
      };
    }
  }

  persist(orders: unknown[], positions: unknown[]): void {
    const state: DurableLocalState = {
      schemaVersion: LOCAL_STATE_SCHEMA_VERSION,
      writtenAt: new Date(this.clock()).toISOString(),
      orders,
      positions,
    };
    const directory = path.dirname(this.filePath);
    const temporaryPath = `${this.filePath}.${process.pid}.${this.clock()}.tmp`;

    try {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(temporaryPath, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
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
        // The original state remains authoritative if cleanup also fails.
      }
      throw error;
    }
  }

  private isValidState(value: unknown): value is DurableLocalState {
    if (!value || typeof value !== 'object') return false;
    const state = value as Partial<DurableLocalState>;
    return (
      state.schemaVersion === LOCAL_STATE_SCHEMA_VERSION &&
      typeof state.writtenAt === 'string' &&
      Array.isArray(state.orders) &&
      Array.isArray(state.positions)
    );
  }
}

export default DurableLocalStateStore;
