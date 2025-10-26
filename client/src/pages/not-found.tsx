import { AlertCircle, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      {/* Content */}
      <div className="relative w-full min-h-screen flex items-center justify-center px-4">
        <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-8 max-w-md w-full shadow-xl shadow-blue-500/5">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-red-500/10 rounded-lg">
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">404</h1>
              <p className="text-sm text-slate-400">Page Not Found</p>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-300 mb-6">
            The page you're looking for doesn't exist or may have been moved.
          </p>

          <button
            onClick={() => setLocation('/')}
            className="w-full px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg transition-all flex items-center justify-center space-x-2 text-white font-semibold shadow-lg shadow-blue-500/20"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
}
