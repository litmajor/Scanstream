/**
 * Structured Error Logger
 * 
 * Logs all errors with context, exchange failures, retries, and edge cases
 */

export interface LogContext {
  service?: string;
  exchange?: string;
  symbol?: string;
  action?: string;
  attempt?: number;
  maxRetries?: number;
  duration?: number;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context: LogContext;
  error?: {
    code?: string;
    message: string;
    stack?: string;
  };
}

export class StructuredErrorLogger {
  private logs: LogEntry[] = [];
  private readonly maxLogs = 10000;
  private readonly logRetentionMs = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Log an info message
   */
  info(message: string, context: LogContext = {}) {
    this.addLog('info', message, context);
  }

  /**
   * Log a warning
   */
  warn(message: string, context: LogContext = {}) {
    this.addLog('warn', message, context);
    console.warn(`[${context.service || 'APP'}] ${message}`, context);
  }

  /**
   * Log an error with context
   */
  error(message: string, error: Error | string, context: LogContext = {}) {
    const errorObj = typeof error === 'string'
      ? { message: error }
      : {
          code: (error as any).code,
          message: error.message,
          stack: error.stack
        };

    this.addLog('error', message, context, errorObj);
    console.error(`[${context.service || 'APP'}] ${message}`, { error: errorObj, context });
  }

  /**
   * Log exchange failure with retry info
   */
  logExchangeFailure(
    exchange: string,
    symbol: string,
    error: Error | string,
    attempt: number = 1,
    maxRetries: number = 3
  ) {
    const isRetryable = attempt < maxRetries;
    const context: LogContext = {
      service: 'Exchange',
      exchange,
      symbol,
      attempt,
      maxRetries,
      retryable: isRetryable
    };

    if (isRetryable) {
      this.warn(
        `Exchange failure (will retry): ${exchange}/${symbol} attempt ${attempt}/${maxRetries}`,
        context
      );
    } else {
      this.error(
        `Exchange failure (max retries exceeded): ${exchange}/${symbol}`,
        error,
        context
      );
    }
  }

  /**
   * Log successful retry
   */
  logRetrySuccess(
    exchange: string,
    symbol: string,
    attempt: number,
    duration: number
  ) {
    this.info(
      `Retry successful: ${exchange}/${symbol} on attempt ${attempt}`,
      {
        service: 'Exchange',
        exchange,
        symbol,
        attempt,
        duration
      }
    );
  }

  /**
   * Log rate limit hit
   */
  logRateLimit(exchange: string, resetTime: number) {
    this.warn(
      `Rate limit hit for ${exchange}`,
      {
        service: 'RateLimit',
        exchange,
        resetTimeMs: resetTime
      }
    );
  }

  /**
   * Log API response error
   */
  logAPIError(endpoint: string, statusCode: number, error: string, context: LogContext = {}) {
    this.error(
      `API Error: ${endpoint} (${statusCode})`,
      error,
      { service: 'API', endpoint, statusCode, ...context }
    );
  }

  /**
   * Log data validation issue
   */
  logValidationError(field: string, value: any, reason: string, context: LogContext = {}) {
    this.error(
      `Validation failed: ${field}`,
      reason,
      { service: 'Validation', field, value, ...context }
    );
  }

  /**
   * Log WebSocket event
   */
  logWebSocket(event: 'connect' | 'disconnect' | 'error' | 'message', details: LogContext = {}) {
    this.info(
      `WebSocket ${event}`,
      { service: 'WebSocket', event, ...details }
    );
  }

  /**
   * Private helper to add log entry
   */
  private addLog(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    context: LogContext,
    error?: any
  ) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context,
      error
    };

    this.logs.push(entry);

    // Maintain log size
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  /**
   * Get all logs
   */
  getLogs(
    filter?: {
      level?: 'info' | 'warn' | 'error' | 'debug';
      service?: string;
      exchange?: string;
      limit?: number;
    }
  ): LogEntry[] {
    let filtered = [...this.logs];

    if (filter?.level) {
      filtered = filtered.filter(l => l.level === filter.level);
    }

    if (filter?.service) {
      filtered = filtered.filter(l => l.context.service === filter.service);
    }

    if (filter?.exchange) {
      filtered = filtered.filter(l => l.context.exchange === filter.exchange);
    }

    const limit = filter?.limit || 100;
    return filtered.slice(-limit);
  }

  /**
   * Get error summary
   */
  getErrorSummary(): {
    totalErrors: number;
    errorsByService: Record<string, number>;
    errorsByExchange: Record<string, number>;
    recentErrors: LogEntry[];
  } {
    const errors = this.logs.filter(l => l.level === 'error');

    const errorsByService: Record<string, number> = {};
    const errorsByExchange: Record<string, number> = {};

    errors.forEach(e => {
      if (e.context.service) {
        errorsByService[e.context.service] = (errorsByService[e.context.service] || 0) + 1;
      }
      if (e.context.exchange) {
        errorsByExchange[e.context.exchange] = (errorsByExchange[e.context.exchange] || 0) + 1;
      }
    });

    return {
      totalErrors: errors.length,
      errorsByService,
      errorsByExchange,
      recentErrors: errors.slice(-20)
    };
  }

  /**
   * Export logs
   */
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const header = 'Timestamp,Level,Message,Service,Exchange,Symbol\n';
      const rows = this.logs.map(l =>
        `${new Date(l.timestamp).toISOString()},${l.level},${l.message},"${l.context.service || ''}","${l.context.exchange || ''}","${l.context.symbol || ''}"`
      );
      return header + rows.join('\n');
    }
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Prune old logs
   */
  pruneOldLogs() {
    const cutoffTime = Date.now() - this.logRetentionMs;
    this.logs = this.logs.filter(l => l.timestamp > cutoffTime);
  }

  /**
   * Clear all logs
   */
  clear() {
    this.logs = [];
  }
}

// Global singleton
let logger: StructuredErrorLogger | null = null;

export function getErrorLogger(): StructuredErrorLogger {
  if (!logger) {
    logger = new StructuredErrorLogger();
  }
  return logger;
}
