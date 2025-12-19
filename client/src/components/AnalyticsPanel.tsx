import React from 'react';
import { BarChart3, Clock } from 'lucide-react';

export default function AnalyticsPanel(props: {
  onStart?: (speedMs?: number) => void;
  onPause?: () => void;
  onStop?: () => void;
  onSetSpeed?: (ms: number) => void;
  onSeek?: (index: number) => void;
  isReplaying?: boolean;
  speedMs?: number;
  position?: number;
  duration?: number;
}){
  const { onStart, onPause, onStop, onSetSpeed, onSeek, isReplaying, speedMs = 200, position = 0, duration = 0 } = props;

  return (
    <div className="p-3 border-b border-slate-700/50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold">Analytics</h4>
        <BarChart3 className="w-4 h-4 text-slate-400" />
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between bg-slate-800/30 p-2 rounded">
          <div className="text-xs text-slate-400">Sharpe</div>
          <div className="font-mono font-semibold">—</div>
        </div>
        <div className="flex items-center justify-between bg-slate-800/30 p-2 rounded">
          <div className="text-xs text-slate-400">Max Drawdown</div>
          <div className="font-mono font-semibold">—</div>
        </div>
        <div className="flex items-center justify-between bg-slate-800/30 p-2 rounded">
          <div className="text-xs text-slate-400">Winrate</div>
          <div className="font-mono font-semibold">—</div>
        </div>

        <div className="pt-2">
          <div className="flex items-center gap-2">
            {!isReplaying ? (
              <button className="px-3 py-1 bg-blue-600 rounded text-white text-sm" onClick={() => onStart && onStart(speedMs)}>Play</button>
            ) : (
              <button className="px-3 py-1 bg-yellow-600 rounded text-black text-sm" onClick={() => onPause && onPause()}>Pause</button>
            )}
            <button className="px-3 py-1 bg-red-600 rounded text-white text-sm" onClick={() => onStop && onStop()}>Stop</button>
            <div className="flex items-center space-x-2 ml-2">
              <label className="text-xs text-slate-400">Speed</label>
              <input type="range" min={50} max={1000} value={speedMs} onChange={(e) => onSetSpeed && onSetSpeed(Number(e.target.value))} />
              <div className="text-xs font-mono">{speedMs}ms</div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <label className="text-xs text-slate-400">Seek</label>
            <input type="number" min={0} max={Math.max(0, duration - 1)} value={position} onChange={(e) => onSeek && onSeek(Number(e.target.value))} className="w-24 px-2 py-1 bg-slate-800 text-white rounded" />
            <div className="text-xs text-slate-400">/ {duration}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
