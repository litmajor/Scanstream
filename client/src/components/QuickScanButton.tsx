import { RefreshCw } from 'lucide-react';

interface QuickScanButtonProps {
  isScanning: boolean;
  onClick: () => void;
}

export function QuickScanButton({ isScanning, onClick }: QuickScanButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isScanning}
      className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
        isScanning
          ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
      }`}
    >
      <RefreshCw className={`w-5 h-5 ${isScanning ? 'animate-spin' : ''}`} />
      {isScanning ? 'Scanning...' : 'Quick Scan (5-10s)'}
    </button>
  );
}

