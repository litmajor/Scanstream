import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ProgressIndicatorProps {
  current: number;
  total: number;
  label?: string;
  status?: 'running' | 'success' | 'error';
  detail?: string;
}

export default function ProgressIndicator({ 
  current, 
  total, 
  label = 'Processing',
  status = 'running',
  detail
}: ProgressIndicatorProps) {
  const percentage = Math.min((current / total) * 100, 100);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {status === 'running' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
          {status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
          {status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
          <span className="text-sm font-medium text-white">{label}</span>
        </div>
        <span className="text-sm font-mono text-slate-400">
          {current} / {total}
        </span>
      </div>
      
      {/* Progress bar */}
      <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            status === 'success' ? 'bg-green-500' :
            status === 'error' ? 'bg-red-500' :
            'bg-blue-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {detail && (
        <p className="text-xs text-slate-400 mt-1">{detail}</p>
      )}
    </div>
  );
}
