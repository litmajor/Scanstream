interface SkeletonLoaderProps {
  className?: string;
  width?: string;
  height?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export default function SkeletonLoader({ 
  className = '', 
  width, 
  height,
  variant = 'rectangular'
}: SkeletonLoaderProps) {
  const baseClasses = 'animate-pulse bg-slate-700/30 rounded';
  
  const variantClasses = {
    text: 'h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const style = {
    width: width || undefined,
    height: height || undefined,
  };

  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
}

// Preset skeleton components for common use cases
export function SignalCardSkeleton() {
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <SkeletonLoader width="120px" height="24px" variant="text" />
        <SkeletonLoader width="80px" height="20px" variant="text" />
      </div>
      <div className="space-y-2 mb-3">
        <SkeletonLoader height="16px" variant="text" />
        <SkeletonLoader height="16px" variant="text" />
      </div>
      <div className="flex items-center space-x-2">
        <SkeletonLoader width="100px" height="20px" variant="text" />
        <SkeletonLoader width="80px" height="20px" variant="text" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <SkeletonLoader width="100px" height="16px" variant="text" />
        <SkeletonLoader width="16px" height="16px" variant="circular" />
      </div>
      <SkeletonLoader width="120px" height="32px" variant="text" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <SkeletonLoader width="200px" height="32px" variant="text" />
        <SkeletonLoader width="100px" height="24px" variant="text" />
      </div>
      <SkeletonLoader height="300px" variant="rectangular" />
    </div>
  );
}

export function HeatmapRowSkeleton() {
  return (
    <tr className="border-b border-slate-700/30">
      <td className="py-3 px-4">
        <SkeletonLoader width="80px" height="20px" variant="text" />
      </td>
      {[...Array(6)].map((_, i) => (
        <td key={i} className="py-3 px-4 text-center">
          <SkeletonLoader width="48px" height="32px" variant="rectangular" />
        </td>
      ))}
      <td className="py-3 px-4 text-center">
        <SkeletonLoader width="60px" height="24px" variant="rectangular" />
      </td>
    </tr>
  );
}

export function TimelineEventSkeleton() {
  return (
    <div className="relative pl-12">
      <SkeletonLoader 
        className="absolute left-4" 
        width="16px" 
        height="16px" 
        variant="circular" 
      />
      <div className="border-l-4 rounded-r-lg p-4 bg-slate-900/40">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2">
            <SkeletonLoader width="60px" height="20px" variant="rectangular" />
            <SkeletonLoader width="60px" height="20px" variant="rectangular" />
          </div>
          <SkeletonLoader width="60px" height="16px" variant="text" />
        </div>
        <div className="grid grid-cols-3 gap-4 mt-2">
          {[...Array(3)].map((_, i) => (
            <div key={i}>
              <SkeletonLoader width="60px" height="12px" variant="text" className="mb-1" />
              <SkeletonLoader width="80px" height="20px" variant="text" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
