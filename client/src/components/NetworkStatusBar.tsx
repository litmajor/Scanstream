import { useEffect, useState } from 'react';
import { Wifi, WifiOff, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface NetworkStatusBarProps {
  isSlow?: boolean;
  latency?: number;
  isConnected?: boolean;
}

export default function NetworkStatusBar({ 
  isSlow = false, 
  latency,
  isConnected = true 
}: NetworkStatusBarProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isSlow) {
      setShowWarning(true);
      const timer = setTimeout(() => setShowWarning(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isSlow]);

  if (!mounted || !showWarning) return null;

  return (
    <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-top duration-300">
      <div className={`
        flex items-center space-x-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-sm
        ${isSlow && !isConnected ? 'bg-red-900/80 border-red-600/50 text-red-100' :
          isSlow ? 'bg-orange-900/80 border-orange-600/50 text-orange-100' :
          'bg-green-900/80 border-green-600/50 text-green-100'}
      `}>
        {!isConnected ? (
          <>
            <WifiOff className="w-5 h-5" />
            <div>
              <p className="font-semibold">Disconnected</p>
              <p className="text-xs">Reconnecting...</p>
            </div>
          </>
        ) : isSlow ? (
          <>
            <AlertTriangle className="w-5 h-5" />
            <div>
              <p className="font-semibold">Slow Network Detected</p>
              <p className="text-xs">
                Latency: {latency ? `${latency}ms` : 'High'}
              </p>
            </div>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-5 h-5" />
            <div>
              <p className="font-semibold">Connected</p>
              <p className="text-xs">
                {latency ? `${latency}ms latency` : 'Network OK'}
              </p>
            </div>
          </>
        )}
        <button
          onClick={() => setShowWarning(false)}
          className="ml-2 text-current opacity-70 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}
