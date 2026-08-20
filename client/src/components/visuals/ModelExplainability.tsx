import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

export default function ModelExplainability({ confidence = 0.5, shap = [] }: { confidence?: number; shap?: { feature: string; value: number }[] }) {
  const top = shap.slice().sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)).slice(0,8);

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs text-slate-400 mb-1">Model Confidence</div>
        <div className="w-full bg-slate-800 rounded h-3 overflow-hidden">
          <div className={`h-full ${confidence >= 0.5 ? 'bg-emerald-500' : 'bg-yellow-400'}`} style={{ width: `${confidence * 100}%` }} />
        </div>
        <div className="text-xs text-slate-400 mt-1">{(confidence*100).toFixed(1)}%</div>
      </div>

      <div>
        <div className="text-xs text-slate-400 mb-1">Top SHAP Features</div>
        {top.length === 0 ? (
          <div className="text-sm text-slate-500">No SHAP data</div>
        ) : (
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top} layout="vertical" margin={{ left: 0, right: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="feature" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => typeof v === 'number' ? v.toFixed(3) : String(v ?? '')} />
                <Bar dataKey="value" isAnimationActive={false}>
                  {top.map((entry, idx) => (
                    <Cell key={`c-${idx}`} fill={entry.value >= 0 ? '#06b6d4' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
