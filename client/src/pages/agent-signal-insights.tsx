import React, { useState, useEffect } from 'react';
import { TrendingUp, Zap, Eye, Radio, Filter, ChevronDown, AlertCircle } from 'lucide-react';

/**
 * AGENT SIGNAL INSIGHTS DASHBOARD
 * 
 * Purpose: Show for each asset, how ALL agents see it differently
 * - Same data source (market data)
 * - Different analysis (each agent has unique perspective)
 * - Multiple signals per asset with different reasoning
 * - Visualization of consensus vs divergence
 */

interface AgentSignalInsight {
  agentName: string;
  agentType: 'SCANNER' | 'ML' | 'RL' | 'FLOW' | 'VFMD' | 'EXIT' | 'OPPOSITION' | 'MICROSTRUCTURE';
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  
  // What this agent sees
  insights: {
    primary: string;           // Main reason for signal
    secondary: string[];       // Supporting reasons
    dataPoints: Record<string, number | string>;  // Specific metrics this agent analyzed
  };
  
  // Quality metrics
  historicalAccuracy: number;
  recentWinRate: number;
  strength: number;            // How strong is this signal for this agent
  
  // Context
  timeframe: string;
  patternOrModel?: string;     // What pattern/model this agent used
  timestamp: string;
}

interface AssetSignalGroup {
  symbol: string;
  price: number;
  timestamp: string;
  
  // Consensus info
  buyAgents: number;
  sellAgents: number;
  holdAgents: number;
  consensus: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' | 'DIVERGENCE';
  
  // All signals for this asset
  signals: AgentSignalInsight[];
}

// Define custom icon components first before using them
const Brain = (props: any) => <Zap {...props} />;
const Wind = (props: any) => <Zap {...props} />;
const CheckCircle = (props: any) => <Zap {...props} />;
const Volume2 = (props: any) => <Zap {...props} />;

// Color scheme for agent types
const AGENT_TYPE_COLORS: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  SCANNER: { color: '#FF6B6B', bg: '#FFE5E5', icon: <Radio size={16} /> },
  ML: { color: '#4ECDC4', bg: '#E0F7F6', icon: <Brain size={16} /> },
  RL: { color: '#95E1D3', bg: '#E8F8F5', icon: <Zap size={16} /> },
  FLOW: { color: '#264653', bg: '#E5E9EC', icon: <Wind size={16} /> },
  VFMD: { color: '#D62828', bg: '#FAE2E3', icon: <Eye size={16} /> },
  EXIT: { color: '#06A77D', bg: '#E8F5F0', icon: <CheckCircle size={16} /> },
  OPPOSITION: { color: '#D62828', bg: '#FAE2E3', icon: <AlertCircle size={16} /> },
  MICROSTRUCTURE: { color: '#8338EC', bg: '#F5E5FF', icon: <Volume2 size={16} /> },
};

const signalEmojis = {
  BUY: '🟢',
  SELL: '🔴',
  HOLD: '🟡'
};

// Single Agent Signal Card
const AgentSignalCard: React.FC<{ insight: AgentSignalInsight }> = ({ insight }) => {
  const config = AGENT_TYPE_COLORS[insight.agentType];
  const isAccurate = insight.historicalAccuracy > 0.65;
  
  return (
    <div 
      className="rounded-lg border-2 p-3 hover:shadow-md transition-all"
      style={{ borderColor: config.color, backgroundColor: config.bg }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div style={{ color: config.color }}>
            {config.icon}
          </div>
          <div>
            <div className="font-bold text-sm">{insight.agentName}</div>
            <div className="text-xs text-gray-600">{insight.agentType}</div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xl font-bold ${
            insight.signal === 'BUY' ? 'text-green-600' :
            insight.signal === 'SELL' ? 'text-red-600' :
            'text-yellow-600'
          }`}>
            {signalEmojis[insight.signal]}
          </div>
          <div className="text-xs text-gray-600">{insight.signal}</div>
        </div>
      </div>

      {/* Confidence Bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-700">Confidence</span>
          <span className="font-semibold">{(insight.confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden">
          <div 
            className="h-full transition-all"
            style={{ 
              width: `${insight.confidence * 100}%`,
              backgroundColor: config.color 
            }}
          />
        </div>
      </div>

      {/* Primary Insight */}
      <div className="mb-2 p-2 bg-white bg-opacity-50 rounded text-xs text-gray-800">
        <div className="font-semibold mb-1">💡 Why:</div>
        {insight.insights.primary}
      </div>

      {/* Secondary Insights */}
      {insight.insights.secondary.length > 0 && (
        <div className="mb-2 text-xs">
          <div className="font-semibold text-gray-700 mb-1">Supporting:</div>
          <ul className="space-y-1">
            {insight.insights.secondary.slice(0, 2).map((reason, idx) => (
              <li key={idx} className="text-gray-700">• {reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Data Points This Agent Analyzed */}
      <div className="mb-2 text-xs border-t pt-2">
        <div className="font-semibold text-gray-700 mb-1">📊 Data Points:</div>
        <div className="space-y-1">
          {Object.entries(insight.insights.dataPoints).slice(0, 3).map(([key, value]) => (
            <div key={key} className="flex justify-between text-gray-700">
              <span>{key}:</span>
              <span className="font-mono font-semibold">
                {typeof value === 'number' ? value.toFixed(2) : value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Accuracy Metrics */}
      <div className="flex gap-2 text-xs border-t pt-2">
        <div className="flex-1">
          <div className="text-gray-600">Historical</div>
          <div className={`font-bold ${isAccurate ? 'text-green-600' : 'text-orange-600'}`}>
            {(insight.historicalAccuracy * 100).toFixed(0)}%
          </div>
        </div>
        <div className="flex-1">
          <div className="text-gray-600">Recent</div>
          <div className="font-bold text-blue-600">
            {(insight.recentWinRate * 100).toFixed(0)}%
          </div>
        </div>
        <div className="flex-1">
          <div className="text-gray-600">Strength</div>
          <div className="font-bold text-purple-600">
            {insight.strength.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Pattern/Model Used */}
      {insight.patternOrModel && (
        <div className="mt-2 text-xs bg-gray-200 bg-opacity-50 px-2 py-1 rounded">
          <span className="text-gray-700">Pattern: <span className="font-mono">{insight.patternOrModel}</span></span>
        </div>
      )}
    </div>
  );
};

// Consensus Visualization
const ConsensusView: React.FC<{ group: AssetSignalGroup }> = ({ group }) => {
  const total = group.buyAgents + group.sellAgents + group.holdAgents;
  const buyPct = (group.buyAgents / total) * 100;
  const sellPct = (group.sellAgents / total) * 100;
  const holdPct = (group.holdAgents / total) * 100;

  const consensusColor = {
    'STRONG_BUY': '#27ae60',
    'BUY': '#2ecc71',
    'HOLD': '#f39c12',
    'SELL': '#e74c3c',
    'STRONG_SELL': '#c0392b',
    'DIVERGENCE': '#9b59b6'
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xl font-bold text-white">{group.symbol}</h3>
          <div className="text-sm text-gray-400">Price: ${group.price.toFixed(2)}</div>
        </div>
        <div className="text-right">
          <div 
            className="text-3xl font-bold mb-1"
            style={{ color: consensusColor[group.consensus] }}
          >
            {group.consensus}
          </div>
          <div className="text-sm text-gray-400">{total} agents analyzed</div>
        </div>
      </div>

      {/* Vote Distribution */}
      <div className="mb-4">
        <div className="text-sm text-gray-400 mb-2">Agent Agreement Distribution</div>
        <div className="flex gap-2 mb-2">
          <div className="flex-1 bg-green-900 rounded-lg p-2 text-center">
            <div className="text-sm font-bold text-green-300">{group.buyAgents}</div>
            <div className="text-xs text-green-200">BUY</div>
          </div>
          <div className="flex-1 bg-yellow-900 rounded-lg p-2 text-center">
            <div className="text-sm font-bold text-yellow-300">{group.holdAgents}</div>
            <div className="text-xs text-yellow-200">HOLD</div>
          </div>
          <div className="flex-1 bg-red-900 rounded-lg p-2 text-center">
            <div className="text-sm font-bold text-red-300">{group.sellAgents}</div>
            <div className="text-xs text-red-200">SELL</div>
          </div>
        </div>

        {/* Percentage Bars */}
        <div className="flex gap-1 h-3 rounded-full overflow-hidden">
          <div 
            className="bg-green-500"
            style={{ width: `${buyPct}%` }}
          />
          <div 
            className="bg-yellow-500"
            style={{ width: `${holdPct}%` }}
          />
          <div 
            className="bg-red-500"
            style={{ width: `${sellPct}%` }}
          />
        </div>
      </div>

      {/* Divergence Info */}
      {group.consensus === 'DIVERGENCE' && (
        <div className="bg-purple-900 bg-opacity-50 border border-purple-600 rounded p-3 text-sm text-purple-200">
          ⚠️ Agents are divergent on this asset - multiple perspectives present. Exercise caution.
        </div>
      )}
    </div>
  );
};

// Main Dashboard Component
export default function AgentSignalInsightsDashboard() {
  const [assetGroups, setAssetGroups] = useState<AssetSignalGroup[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetSignalGroup | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'consensus' | 'agreement' | 'price'>('consensus');
  const [loading, setLoading] = useState(true);

  // Fetch asset signal groups
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/agents/signals/asset-insights');
        if (response.ok) {
          const data = await response.json();
          setAssetGroups(data.data || []);
          if (data.data && data.data.length > 0) {
            setSelectedAsset(data.data[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch signal insights:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-gray-400">Loading agent insights...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🔍 Agent Signal Insights</h1>
          <p className="text-gray-400">See how each agent analyzes the same asset differently</p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: Asset List */}
          <div className="col-span-1 bg-gray-800 rounded-lg p-4 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Assets</h2>
              <span className="text-sm text-gray-400">{assetGroups.length}</span>
            </div>

            <div className="space-y-2">
              {assetGroups.map(group => (
                <button
                  key={group.symbol}
                  onClick={() => setSelectedAsset(group)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    selectedAsset?.symbol === group.symbol
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold">{group.symbol}</div>
                      <div className="text-xs text-gray-400">${group.price.toFixed(2)}</div>
                    </div>
                    <div className={`text-lg font-bold ${
                      group.consensus.includes('BUY') ? 'text-green-400' :
                      group.consensus.includes('SELL') ? 'text-red-400' :
                      'text-yellow-400'
                    }`}>
                      {group.consensus === 'STRONG_BUY' ? '🟢' :
                       group.consensus === 'BUY' ? '🟢' :
                       group.consensus === 'HOLD' ? '🟡' :
                       group.consensus === 'SELL' ? '🔴' :
                       '🔴'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Asset Details & Signals */}
          <div className="col-span-2">
            {selectedAsset ? (
              <>
                {/* Consensus */}
                <ConsensusView group={selectedAsset} />

                {/* Filter Controls */}
                <div className="mb-4 flex gap-3">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 text-sm"
                  >
                    <option value="all">All Agents</option>
                    <option value="buy">Buy Only</option>
                    <option value="sell">Sell Only</option>
                    <option value="divergent">Divergent</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 text-sm"
                  >
                    <option value="consensus">By Confidence</option>
                    <option value="agreement">By Accuracy</option>
                    <option value="price">By Type</option>
                  </select>
                </div>

                {/* Agent Signal Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedAsset.signals
                    .filter(s => {
                      if (filterType === 'all') return true;
                      if (filterType === 'buy') return s.signal === 'BUY';
                      if (filterType === 'sell') return s.signal === 'SELL';
                      if (filterType === 'divergent') return selectedAsset.consensus === 'DIVERGENCE';
                      return true;
                    })
                    .sort((a, b) => {
                      if (sortBy === 'consensus') return b.confidence - a.confidence;
                      if (sortBy === 'agreement') return b.historicalAccuracy - a.historicalAccuracy;
                      return a.agentType.localeCompare(b.agentType);
                    })
                    .map(signal => (
                      <AgentSignalCard key={signal.agentName} insight={signal} />
                    ))}
                </div>

                {/* Interpretation Guide */}
                <div className="mt-6 bg-gray-800 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-white mb-3">📚 How to Read This View</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
                    <div>
                      <div className="font-semibold text-green-400 mb-1">🟢 BUY Signals</div>
                      <div>Agent sees bullish momentum or entry opportunity</div>
                    </div>
                    <div>
                      <div className="font-semibold text-red-400 mb-1">🔴 SELL Signals</div>
                      <div>Agent sees bearish reversal or profit-taking</div>
                    </div>
                    <div>
                      <div className="font-semibold text-yellow-400 mb-1">🟡 HOLD Signals</div>
                      <div>Agent sees sideways consolidation</div>
                    </div>
                    <div>
                      <div className="font-semibold text-purple-400 mb-1">🟣 DIVERGENCE</div>
                      <div>Agents disagree - multiple valid perspectives</div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <h4 className="font-semibold text-white mb-2">Agent Types Explained:</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs text-gray-400">
                      <div>📻 <span className="font-mono">SCANNER</span> - Pattern detection</div>
                      <div>🧠 <span className="font-mono">ML</span> - Neural networks</div>
                      <div>⚡ <span className="font-mono">RL</span> - Reinforcement learning</div>
                      <div>🌀 <span className="font-mono">FLOW</span> - Flow field forces</div>
                      <div>👁️ <span className="font-mono">VFMD</span> - Vector divergence</div>
                      <div>🎬 <span className="font-mono">EXIT</span> - Exit specialist</div>
                      <div>🚧 <span className="font-mono">OPPOSITION</span> - Support/resistance</div>
                      <div>🌊 <span className="font-mono">MICROSTRUCTURE</span> - Order flow</div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-400 py-12">
                No assets with signals yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
