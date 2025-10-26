interface ScanProgressProps {
  total: number;
  remaining: number;
}

export function ScanProgress({ total, remaining }: ScanProgressProps) {
  const processed = total - remaining;
  const percentage = total > 0 ? (processed / total) * 100 : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Deep Analysis Progress
        </span>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {processed} / {total} symbols
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        {remaining > 0 ? `Analyzing ${remaining} more symbols...` : 'Analysis complete!'}
      </p>
    </div>
  );
}

