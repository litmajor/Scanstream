import React from 'react';
import { AlertCircle, Pause, RotateCcw } from 'lucide-react';

/**
 * ReplayModeBanner
 * 
 * Displays a prominent warning banner when in REPLAY mode
 * Indicates that trading is disabled and data is historical
 */
export default function ReplayModeBanner(props: {
  isReplaying?: boolean;
  currentTime?: number;
  totalTime?: number;
  onResume?: () => void;
  onReset?: () => void;
}) {
  const { isReplaying = false, currentTime = 0, totalTime = 0, onResume, onReset } = props;

  if (!isReplaying) {
    return null;
  }

  return (
    <div className="w-full bg-gradient-to-r from-yellow-600/20 via-amber-600/20 to-yellow-600/20 border-y border-yellow-600/50 px-4 py-3 shadow-lg">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Left: Warning Icon & Message */}
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-yellow-600/30 border border-yellow-600/50">
              <AlertCircle className="h-5 w-5 text-yellow-400 animate-pulse" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-yellow-300">
              ⏪ REPLAY MODE — TRADING DISABLED
            </h3>
            <p className="text-xs text-yellow-200/80 mt-0.5">
              You are viewing historical data. No live trades will be executed.
            </p>
          </div>
        </div>

        {/* Center: Progress */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="text-xs text-yellow-200/80 font-mono">
            {currentTime.toLocaleString()} / {totalTime.toLocaleString()}
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onResume}
            className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600/30 hover:bg-yellow-600/50 border border-yellow-600/50 rounded text-xs font-medium text-yellow-300 hover:text-yellow-200 transition-all"
            title="Resume replay"
          >
            <Pause className="w-3 h-3" />
            <span className="hidden sm:inline">Resume</span>
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600/30 hover:bg-yellow-600/50 border border-yellow-600/50 rounded text-xs font-medium text-yellow-300 hover:text-yellow-200 transition-all"
            title="Reset replay to beginning"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
