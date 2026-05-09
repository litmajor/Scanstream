// ─────────────────────────────────────────────
// SessionEntryFilter.ts
// Blocks entries during session open whipsaw windows
// Derived from loss cluster analysis: London 07–08, NY 13–14, Asia 22–01
// ─────────────────────────────────────────────

export type SessionWindow = {
  label:        string;
  /** UTC hour start of blackout */
  blackout_start: number;
  /** UTC hour end of blackout (exclusive) */
  blackout_end:   number;
  /** Days active (0=Sun … 6=Sat) */
  active_days:    number[];
  /**
   * If true: block ALL entries.
   * If false: block SHORT entries only (directional bias window).
   */
  block_all:      boolean;
};

export interface SessionFilterConfig {
  windows:         SessionWindow[];
  /** Minutes after blackout_end before entries re-enable (cooldown) */
  cooldown_mins:   number;
}

// ── Default Windows (from loss cluster analysis) ─────────────────────────────

export const DEFAULT_SESSION_FILTER: SessionFilterConfig = {
  cooldown_mins: 30,
  windows: [
    {
      label:          "LONDON_OPEN",
      blackout_start: 7,
      blackout_end:   8,
      active_days:    [1, 2, 3, 4, 5],
      block_all:      false, // block shorts only — London opens bullish bias in uptrend
    },
    {
      label:          "NY_OPEN",
      blackout_start: 13,
      blackout_end:   14,
      active_days:    [1, 2, 3, 4, 5],
      block_all:      false, // block shorts only
    },
    {
      label:          "NY_CLOSE_ASIA_EARLY",
      blackout_start: 22,
      blackout_end:   1,   // wraps midnight
      active_days:    [0, 1, 2, 3, 4, 5, 6],
      block_all:      true, // low liquidity — no entries at all
    },
  ],
};

// ── Filter Result ─────────────────────────────────────────────────────────────

export interface SessionFilterResult {
  allowed:        boolean;
  reason:         string | null;
  active_window:  SessionWindow | null;
  /** Minutes until next allowed entry (0 if allowed now) */
  wait_mins:      number;
}

// ── Implementation ────────────────────────────────────────────────────────────

export class SessionEntryFilter {
  evaluate(
    direction:    "LONG" | "SHORT",
    utcTimestamp: number,
    config:       SessionFilterConfig = DEFAULT_SESSION_FILTER
  ): SessionFilterResult {
    const date = new Date(utcTimestamp);
    const hour = date.getUTCHours();
    const min  = date.getUTCMinutes();
    const dow  = date.getUTCDay();

    for (const window of config.windows) {
      if (!window.active_days.includes(dow)) continue;

      const inWindow = this._inWindow(hour, window.blackout_start, window.blackout_end);

      if (inWindow) {
        if (window.block_all) {
          return {
            allowed:       false,
            reason:        `${window.label}: low-liquidity blackout — no entries`,
            active_window: window,
            wait_mins:     this._minsUntilEnd(hour, min, window.blackout_end, config.cooldown_mins),
          };
        }

        if (direction === "SHORT") {
          return {
            allowed:       false,
            reason:        `${window.label}: session open volatility — short entries blocked`,
            active_window: window,
            wait_mins:     this._minsUntilEnd(hour, min, window.blackout_end, config.cooldown_mins),
          };
        }
      }

      // Cooldown: just exited the window
      const inCooldown = this._inCooldown(hour, min, window.blackout_end, config.cooldown_mins);
      if (inCooldown && window.block_all) {
        return {
          allowed:       false,
          reason:        `${window.label}: post-blackout cooldown`,
          active_window: window,
          wait_mins:     this._cooldownRemaining(hour, min, window.blackout_end, config.cooldown_mins),
        };
      }
    }

    return {
      allowed:       true,
      reason:        null,
      active_window: null,
      wait_mins:     0,
    };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _inWindow(hour: number, start: number, end: number): boolean {
    if (start < end) return hour >= start && hour < end;
    // Wraps midnight (e.g. 22 → 01)
    return hour >= start || hour < end;
  }

  private _minsUntilEnd(
    hour:         number,
    min:          number,
    end:          number,
    cooldown:     number
  ): number {
    const currentMins = hour * 60 + min;
    const endMins     = end * 60 + cooldown;
    return endMins > currentMins ? endMins - currentMins : 0;
  }

  private _inCooldown(
    hour:     number,
    min:      number,
    end:      number,
    cooldown: number
  ): boolean {
    const currentMins = hour * 60 + min;
    const endMins     = end * 60;
    return currentMins >= endMins && currentMins < endMins + cooldown;
  }

  private _cooldownRemaining(
    hour:     number,
    min:      number,
    end:      number,
    cooldown: number
  ): number {
    const currentMins = hour * 60 + min;
    const endMins     = end * 60;
    return Math.max(0, endMins + cooldown - currentMins);
  }
}