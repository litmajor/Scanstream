import React from 'react';
import { PanelMeta, usePanelState } from '../hooks/usePanelState';

interface PanelManagerProps {
  defaultPanels?: PanelMeta[];
}

export default function PanelManager({ defaultPanels = [] }: PanelManagerProps) {
  const { panels, order, setPosition, toggleCollapse, moveUp, moveDown, reset } = usePanelState(defaultPanels);

  const keys = Object.keys(panels);

  return (
    <div className="panel-manager p-4 bg-slate-900 rounded shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Panel Manager</h3>
        <button className="button button-ghost" onClick={() => reset()}>Reset</button>
      </div>
      {keys.length === 0 && <div className="text-xs text-slate-400">No panels registered</div>}
      <div className="space-y-2">
        {order.map((k, idx) => {
          const p = panels[k];
          if (!p) return null;
          return (
            <div key={k} className="flex items-center justify-between bg-slate-800/20 p-2 rounded">
              <div>
                <div className="text-sm font-medium">{p.title || p.id}</div>
                <div className="text-xs text-slate-400">{p.position} • {p.collapsed ? 'collapsed' : 'expanded'}</div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex flex-col">
                  <button className="button button-ghost px-2" onClick={() => moveUp(k)} disabled={idx === 0} aria-label={`Move ${k} up`}>▲</button>
                  <button className="button button-ghost px-2" onClick={() => moveDown(k)} disabled={idx === order.length - 1} aria-label={`Move ${k} down`}>▼</button>
                </div>
                <select value={p.position} onChange={(e) => setPosition(k, e.target.value as any)} className="text-sm">
                  <option value="docked">Docked</option>
                  <option value="floating">Floating</option>
                  <option value="hidden">Hidden</option>
                </select>
                <button className="button button-ghost" onClick={() => toggleCollapse(k)}>{p.collapsed ? 'Expand' : 'Collapse'}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
