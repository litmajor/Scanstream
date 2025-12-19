import React from 'react';

/**
 * ReplayModeDesaturatedWrapper
 * 
 * Wraps chart and UI elements in replay mode with visual desaturation
 * Changes color scheme to blue tones to indicate historical data
 */
export default function ReplayModeDesaturatedWrapper(props: {
  children: React.ReactNode;
  isReplaying?: boolean;
}) {
  const { children, isReplaying = false } = props;

  if (!isReplaying) {
    return <>{children}</>;
  }

  return (
    <div className="replay-mode-desaturated relative">
      {/* Desaturate and blue-tint overlay */}
      <style>{`
        .replay-mode-desaturated {
          filter: saturate(0.7) hue-rotate(-10deg) brightness(1.05);
          position: relative;
        }
        
        .replay-mode-desaturated::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(99, 102, 241, 0.05));
          pointer-events: none;
          border-radius: inherit;
        }

        /* Adjust text colors in replay mode */
        .replay-mode-desaturated {
          --tw-text-opacity: 1;
        }

        .replay-mode-desaturated .text-green-400 {
          color: rgb(96, 165, 250 / var(--tw-text-opacity));
        }

        .replay-mode-desaturated .text-red-400 {
          color: rgb(96, 165, 250 / var(--tw-text-opacity));
        }

        .replay-mode-desaturated .bg-green-500\/10 {
          background-color: rgb(59, 130, 246 / 0.1);
        }

        .replay-mode-desaturated .bg-red-500\/10 {
          background-color: rgb(59, 130, 246 / 0.1);
        }

        .replay-mode-desaturated .border-green-500\/30 {
          border-color: rgb(59, 130, 246 / 0.3);
        }

        .replay-mode-desaturated .border-red-500\/30 {
          border-color: rgb(59, 130, 246 / 0.3);
        }

        /* Trade colors become blue in replay */
        .replay-mode-desaturated .bg-gradient-to-r.from-green-500 {
          background: linear-gradient(to right, rgb(59, 130, 246), rgb(59, 130, 246));
        }

        .replay-mode-desaturated .bg-gradient-to-r.from-red-500 {
          background: linear-gradient(to right, rgb(59, 130, 246), rgb(59, 130, 246));
        }
      `}</style>

      {children}
    </div>
  );
}
