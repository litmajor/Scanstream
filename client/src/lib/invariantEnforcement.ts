/**
 * Environment-Based Invariant Enforcement Configuration
 * 
 * Controls whether invariant checks are enabled/disabled based on environment (dev/test/prod).
 * Allows performance tuning while maintaining safety in development.
 */

export type EnvironmentMode = 'development' | 'test' | 'production';

interface InvariantConfig {
  enabled: boolean;
  throwOnViolation: boolean;
  logViolations: boolean;
  verbose: boolean;
}

let currentMode: EnvironmentMode = (import.meta.env.MODE ?? 'production') as EnvironmentMode;

// Overridable by tests or manual configuration
let invariantConfig: InvariantConfig = getDefaultConfigForMode(currentMode);

/**
 * Get default invariant enforcement config for a given environment.
 */
function getDefaultConfigForMode(mode: EnvironmentMode): InvariantConfig {
  switch (mode) {
    case 'development':
      // Dev: strict enforcement, throw on violations, verbose logging
      return {
        enabled: true,
        throwOnViolation: true,
        logViolations: true,
        verbose: true,
      };

    case 'test':
      // Test: strict enforcement, throw, less verbose
      return {
        enabled: true,
        throwOnViolation: true,
        logViolations: true,
        verbose: false,
      };

    case 'production':
      // Prod: enforcement enabled but don't throw (warn only), minimal logging
      return {
        enabled: true,
        throwOnViolation: false,
        logViolations: false,
        verbose: false,
      };

    default:
      return {
        enabled: true,
        throwOnViolation: false,
        logViolations: true,
        verbose: false,
      };
  }
}

/**
 * Detect current environment from Vite or Node.js.
 */
function detectEnvironment(): EnvironmentMode {
  // Check Vite import.meta.env first
  try {
    const mode = (import.meta.env.MODE ?? 'production') as EnvironmentMode;
    if (['development', 'test', 'production'].includes(mode)) {
      return mode;
    }
  } catch {
    // Fallback to NODE_ENV
  }

  const nodeEnv = typeof process !== 'undefined' ? process.env.NODE_ENV : undefined;
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return nodeEnv as EnvironmentMode;
  }

  return 'production';
}

/**
 * Initialize invariant enforcement based on environment.
 * Call this once at application startup.
 */
export function initializeInvariantEnforcement(): void {
  const detectedMode = detectEnvironment();
  currentMode = detectedMode;
  invariantConfig = getDefaultConfigForMode(detectedMode);

  if (invariantConfig.verbose) {
    console.log(`[Invariants] Initialized for ${detectedMode} mode:`, invariantConfig);
  }
}

/**
 * Manually set the environment mode and update invariant config.
 */
export function setEnvironmentMode(mode: EnvironmentMode): void {
  currentMode = mode;
  invariantConfig = getDefaultConfigForMode(mode);

  if (invariantConfig.verbose) {
    console.log(`[Invariants] Environment switched to ${mode}:`, invariantConfig);
  }
}

/**
 * Manually set invariant enforcement config (overrides environment defaults).
 */
export function setInvariantConfig(config: Partial<InvariantConfig>): void {
  invariantConfig = { ...invariantConfig, ...config };

  if (invariantConfig.verbose) {
    console.log('[Invariants] Config updated:', invariantConfig);
  }
}

/**
 * Get current environment mode.
 */
export function getEnvironmentMode(): EnvironmentMode {
  return currentMode;
}

/**
 * Get current invariant enforcement config.
 */
export function getInvariantConfig(): Readonly<InvariantConfig> {
  return Object.freeze({ ...invariantConfig });
}

/**
 * Check if invariant enforcement is enabled.
 */
export function isInvariantEnforcementEnabled(): boolean {
  return invariantConfig.enabled;
}

/**
 * Handle an invariant violation (throw or warn depending on config).
 */
export function handleInvariantViolation(message: string, data?: any): void {
  if (!invariantConfig.enabled) return;

  const fullMessage = data
    ? `${message}\nData: ${JSON.stringify(data)}`
    : message;

  if (invariantConfig.logViolations) {
    if (invariantConfig.throwOnViolation) {
      console.error('[INVARIANT VIOLATION]', fullMessage);
    } else {
      console.warn('[INVARIANT WARNING]', fullMessage);
    }
  }

  if (invariantConfig.throwOnViolation) {
    throw new Error(`[INVARIANT VIOLATION] ${message}`);
  }
}

/**
 * Conditionally execute a safety check based on enforcement config.
 * Returns early if enforcement is disabled.
 */
export function runInvariantCheck(
  name: string,
  check: () => boolean,
  errorMessage: string,
  data?: any
): void {
  if (!invariantConfig.enabled) return;

  try {
    if (!check()) {
      handleInvariantViolation(`${name}: ${errorMessage}`, data);
    }
  } catch (err) {
    handleInvariantViolation(`${name}: ${String(err)}`, data);
  }
}

/**
 * Log a message if verbose logging is enabled.
 */
export function logInvariantDebug(message: string): void {
  if (invariantConfig.verbose) {
    console.log('[Invariants]', message);
  }
}

/**
 * Suppress invariant enforcement for a specific operation (useful for tests/migrations).
 */
export function withoutInvariantEnforcement<T>(fn: () => T): T {
  const savedConfig = invariantConfig;
  invariantConfig = { ...invariantConfig, enabled: false };
  try {
    return fn();
  } finally {
    invariantConfig = savedConfig;
  }
}
