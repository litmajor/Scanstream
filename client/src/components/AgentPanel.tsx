import React, { useState } from 'react';
import { Activity } from 'lucide-react';

type Agent = { id: string; name: string; status: 'idle'|'active'|'error'; lastSignal?: string };

export default function AgentPanel(props: { agents?: Agent[]; onToggle?: (id: string) => Promise<any> }) {
  const { agents = [], onToggle } = props;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [agentHistory, setAgentHistory] = useState<Record<string, any[]>>({});
  const [loadingHistory, setLoadingHistory] = useState<Record<string, boolean>>({});

  const fetchHistory = async (id: string) => {
    if (agentHistory[id]) return; // already loaded
    setLoadingHistory(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(id)}/signals`);
      if (!res.ok) {
        setAgentHistory(prev => ({ ...prev, [id]: [] }));
      } else {
        const data = await res.json();
        setAgentHistory(prev => ({ ...prev, [id]: data }));
      }
    } catch (err) {
      setAgentHistory(prev => ({ ...prev, [id]: [] }));
    } finally {
      setLoadingHistory(prev => ({ ...prev, [id]: false }));
    }
  };

  const toggleAgent = async (id: string) => {
    if (!onToggle) return;
    try {
      await onToggle(id);
    } catch (err) {
      console.error('Failed to toggle agent', err);
    }
  };

  return (
    <div className="p-3 border-b border-slate-700/50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold">Agents</h4>
        <Activity className="w-4 h-4 text-slate-400" />
      </div>
      <div className="space-y-2">
        {agents.length === 0 && <div className="text-xs text-slate-500">No agents connected</div>}
        {agents.map(a => (
          <div key={a.id} className="bg-slate-800/30 rounded">
            <div className="flex items-center justify-between p-2">
              <div>
                <div className="font-semibold">{a.name}</div>
                <div className="text-xs text-slate-400">{a.lastSignal || '—'}</div>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`text-xs px-2 py-0.5 rounded ${a.status==='active' ? 'bg-green-600' : a.status==='idle' ? 'bg-slate-700' : 'bg-red-600'}`}>{a.status}</div>
                <button className="text-xs px-2 py-0.5 rounded bg-slate-700" onClick={() => toggleAgent(a.id)}>Toggle</button>
                <button className="text-xs px-2 py-0.5 rounded bg-slate-700" onClick={async () => { setExpanded(prev => prev === a.id ? null : a.id); if (expanded !== a.id) await fetchHistory(a.id); }}>
                  {expanded === a.id ? 'Close' : 'Details'}
                </button>
              </div>
            </div>
            {expanded === a.id && (
              <div className="p-2 border-t border-slate-700/50">
                {loadingHistory[a.id] ? (
                  <div className="text-xs text-slate-500">Loading history…</div>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {(agentHistory[a.id] || []).length === 0 && <div className="text-xs text-slate-500">No history</div>}
                    {(agentHistory[a.id] || []).map((h, i) => (
                      <div key={i} className="text-xs bg-slate-800/20 p-1 rounded">
                        <div className="font-mono text-xs text-slate-400">{new Date(h.timestamp || Date.now()).toLocaleString()}</div>
                        <div>{h.symbol || '--'} {h.type || h.reason || ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
