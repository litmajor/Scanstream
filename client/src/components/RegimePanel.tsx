import React, { useEffect, useState } from 'react';

interface RegimeContext {
  type: string;
  volatility?: string;
  momentum?: number;
  trend?: string;
  score?: number;
  confidence?: number;
  computedAt?: number;
  source?: string;
}

interface RegimePanelProps {
  symbol: string;
  timeframe?: string;
}

export const RegimePanel: React.FC<RegimePanelProps> = ({ symbol, timeframe = '1h' }) => {
  const [regime, setRegime] = useState<RegimeContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRegime = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ symbol, timeframe });
      const res = await fetch(`/api/analysis/regime?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRegime(data.regime || data || null);
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch regime');
      setRegime(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegime();
    // poll occasionally
    const id = setInterval(fetchRegime, 30_000);
    return () => clearInterval(id);
  }, [symbol, timeframe]);

  if (loading && !regime) {
    return <div className="text-xs text-slate-400">Loading regime...</div>;
  }

  if (error) {
    return <div className="text-xs text-rose-400">Regime: {error}</div>;
  }

  if (!regime) {
    return <div className="text-xs text-slate-400">No regime data</div>;
  }

  return (
    <div className="mt-3 bg-slate-900/30 rounded px-3 py-2 border border-slate-700/40">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-300">Regime ({timeframe})</div>
        <button
          onClick={() => fetchRegime()}
          className="text-xs text-blue-400 hover:text-blue-300"
        >Refresh</button>
      </div>
      <div className="mt-2 text-sm font-bold text-white">{regime.type}</div>
      <div className="text-xs text-slate-400">Confidence: {Math.round((regime.confidence ?? (regime.score ? (regime.score/100) : 0)) * 100)}%</div>
      <div className="text-xs text-slate-400">Volatility: {regime.volatility ?? 'n/a'}</div>
      <div className="text-xs text-slate-400">Trend: {regime.trend ?? 'n/a'}</div>
      <div className="text-xs text-slate-400">Momentum: {typeof regime.momentum === 'number' ? regime.momentum.toFixed(3) : 'n/a'}</div>
      <div className="text-xs text-slate-500 mt-1">Source: {regime.source ?? 'server'}</div>
    </div>
  );
};

export default RegimePanel;
