/**
 * VFMD Deduplicator
 * 
 * CRITICAL FIX #2: Prevent Same-Direction VFMD Clustering
 * 
 * Problem: VFMD can fire multiple times during same imbalance
 * - Initial move (high R-score)
 * - Pullback within move (R drops, then re-accelerates)
 * - Secondary break (another VFMD on same direction)
 * 
 * Risk: Engine doesn't know which VFMD to track
 * - Double-entry on same structure
 * - Confused state machine transitions
 * - Over-leverage on correlated exposure
 * 
 * Solution: Explicit de-duplication rules
 * - Cooldown: Ignore same-direction fires within 3 bars
 * - State awareness: Different rules per engine state
 * - Opposite detection: Treat as regime-change candidate
 */

export type EngineState = 'IDLE' | 'OBSERVATION' | 'ENTRY_PENDING' | 'POSITION_ACTIVE' | 'DORMANT' | 'CLOSING';

export interface VFMDSignal {
  direction: 'BUY' | 'SELL';
  strength: number;    // 0-1
  bar: number;
  price: number;
  reason: string;
}

export interface DeduplicationResult {
  shouldProcess: boolean;
  reason: string;
  action: 'PROCESS' | 'IGNORE' | 'REGIME_CHECK';
}

export class VFMDDeduplicator {
  private lastVFMDSignal: VFMDSignal | null = null;
  private lastVFMDBar: number = -1000;
  private readonly dedupCooldown: number;  // bars between same-direction VFMDs
  
  private lastProcessedBar: number = -1000;
  private processCount: number = 0;
  private ignoredCount: number = 0;
  
  /**
   * Initialize deduplicator
   * @param dedupCooldown - Number of bars cooldown for same-direction (default 3)
   */
  constructor(dedupCooldown: number = 3) {
    this.dedupCooldown = dedupCooldown;
  }
  
  /**
   * Determine if VFMD should be processed
   * 
   * State-dependent rules:
   * - IDLE: Always process
   * - OBSERVATION: Never process (validating current thesis)
   * - ENTRY_PENDING: Never process (committed to entry)
   * - POSITION_ACTIVE: Only process if opposite direction (regime check)
   * - DORMANT: Process (cooling down from last position)
   */
  filter(
    vfmdSignal: VFMDSignal,
    currentBar: number,
    engineState: EngineState
  ): DeduplicationResult {
    const barsSinceLast = currentBar - this.lastVFMDBar;
    const sameDirection = this.lastVFMDSignal?.direction === vfmdSignal.direction;
    const oppositeDirection = this.lastVFMDSignal?.direction !== vfmdSignal.direction;
    
    // RULE 1: Cooldown for same-direction fires
    if (barsSinceLast < this.dedupCooldown && sameDirection) {
      this.ignoredCount++;
      return {
        shouldProcess: false,
        reason: `Same-direction VFMD within cooldown (${barsSinceLast}/${this.dedupCooldown} bars)`,
        action: 'IGNORE'
      };
    }
    
    // RULE 2: Per-state logic
    switch (engineState) {
      case 'IDLE':
        // IDLE state: Always process new VFMD
        this.processCount++;
        return {
          shouldProcess: true,
          reason: 'IDLE state: processing new VFMD',
          action: 'PROCESS'
        };
      
      case 'OBSERVATION':
      case 'ENTRY_PENDING':
        // Validating current thesis; ignore competing signals
        this.ignoredCount++;
        return {
          shouldProcess: false,
          reason: `In ${engineState} state: validating current thesis, ignoring new VFMD`,
          action: 'IGNORE'
        };
      
      case 'POSITION_ACTIVE':
        if (sameDirection) {
          // Same direction while already holding: ignore (prevents double-entry)
          this.ignoredCount++;
          return {
            shouldProcess: false,
            reason: 'POSITION_ACTIVE with same direction: ignoring (already holding)',
            action: 'IGNORE'
          };
        } else if (oppositeDirection) {
          // Opposite direction while holding: potential regime change
          // Process this as regime-change validation
          this.processCount++;
          return {
            shouldProcess: true,
            reason: 'POSITION_ACTIVE with opposite direction: triggering regime check',
            action: 'REGIME_CHECK'
          };
        }
        break;
      
      case 'DORMANT':
        // Cooling down from last position; OK to process
        this.processCount++;
        return {
          shouldProcess: true,
          reason: 'DORMANT state: ready for new signals',
          action: 'PROCESS'
        };
      
      case 'CLOSING':
        // Exiting position; ignore new VFMD
        this.ignoredCount++;
        return {
          shouldProcess: false,
          reason: 'CLOSING state: exiting position, ignoring new VFMD',
          action: 'IGNORE'
        };
      
      default:
        // Unknown state; default to ignore
        this.ignoredCount++;
        return {
          shouldProcess: false,
          reason: `Unknown state: ${engineState}`,
          action: 'IGNORE'
        };
    }
    
    // Default: process
    this.processCount++;
    return {
      shouldProcess: true,
      reason: 'Default: processing VFMD',
      action: 'PROCESS'
    };
  }
  
  /**
   * Record processed VFMD for future filtering
   * Call this only if VFMD was processed
   */
  record(vfmdSignal: VFMDSignal, currentBar: number): void {
    this.lastVFMDSignal = vfmdSignal;
    this.lastVFMDBar = currentBar;
    this.lastProcessedBar = currentBar;
  }
  
  /**
   * Get last processed VFMD signal
   */
  getLastSignal(): VFMDSignal | null {
    return this.lastVFMDSignal;
  }
  
  /**
   * Get bars since last processed VFMD
   */
  getBarsSinceLast(): number {
    return this.lastProcessedBar >= 0 ? -this.lastProcessedBar : Infinity;
  }
  
  /**
   * Get deduplication statistics (for monitoring)
   */
  getStats(): { processed: number; ignored: number; ignoreRate: number } {
    const total = this.processCount + this.ignoredCount;
    return {
      processed: this.processCount,
      ignored: this.ignoredCount,
      ignoreRate: total > 0 ? this.ignoredCount / total : 0
    };
  }
  
  /**
   * Reset deduplicator (e.g., on symbol/timeframe change)
   */
  reset(): void {
    this.lastVFMDSignal = null;
    this.lastVFMDBar = -1000;
    this.lastProcessedBar = -1000;
    this.processCount = 0;
    this.ignoredCount = 0;
  }
  
  /**
   * Diagnostic: Check if system is over-filtering
   * @returns true if ignore rate > 40% (potential over-filtering)
   */
  isOverFiltering(): boolean {
    const stats = this.getStats();
    return stats.ignoreRate > 0.4;
  }
}
