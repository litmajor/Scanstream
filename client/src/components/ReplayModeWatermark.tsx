import React from 'react';

/**
 * ReplayModeWatermark
 * 
 * Displays a subtle watermark in the corner indicating REPLAY mode
 * Positioned absolutely to overlay chart and data sections
 */
export default function ReplayModeWatermark(props: {
  isReplaying?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  opacity?: number;
}) {
  const { isReplaying = false, position = 'top-left', opacity = 0.15 } = props;

  if (!isReplaying) {
    return null;
  }

  const positionClasses: Record<string, string> = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  return (
    <div
      className={`absolute ${positionClasses[position]} pointer-events-none z-10`}
      style={{ opacity }}
    >
      <div className="text-center">
        <div className="text-5xl font-black text-slate-400 transform -rotate-12 select-none">
          ⏪ REPLAY
        </div>
        <div className="text-xs text-slate-500 mt-2 font-semibold uppercase tracking-widest text-center">
          Historical Data
        </div>
      </div>
    </div>
  );
}
