import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TrendingUp, TrendingDown, Zap, AlertCircle, Brain, Target, BarChart3, CheckCircle2, XCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

interface AgentSignal {
  agentName: string;
  agentType: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  strength?: number;
  historicalAccuracy?: number;
  recentWinRate?: number;
}

interface ScanResult {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  agentSignals?: AgentSignal[];
  consensus?: {
    signal: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    riskScore: 'LOW' | 'MEDIUM' | 'HIGH';
    agentAgreement: number; // e.g., 9/13 agents agree
  };
  // Optional runtime/UI fields used across the scanner pages
  id?: string;
  exchange?: string;
  timeframe?: string;
  agentConsensus?: {
    signal?: 'BUY' | 'SELL' | 'HOLD';
    confidence?: number;
    riskScore?: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  };
  signal?: 'BUY' | 'SELL' | 'HOLD';
  strength?: number;
  currentPrice?: number;
  risk_reward?: {
    entry_price?: number;
    stop_loss?: number;
    take_profit?: number;
    stop_loss_pct?: number;
    take_profit_pct?: number;
    risk_reward_ratio?: number;
  };
  suggestedStopLoss?: number;
  suggestedTakeProfit?: number;
  advanced?: any;
  indicators?: any;
}

interface ScannerAgentAnalysisProps {
  scanResult: ScanResult;
  onTrade?: (result: ScanResult) => void;
}

export default function ScannerAgentAnalysis({ scanResult, onTrade }: ScannerAgentAnalysisProps) {
  const [agents, setAgents] = useState<AgentSignal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch agent analysis when scan result changes
  useEffect(() => {
    if (!scanResult.symbol) return;

    const fetchAgentAnalysis = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/scanner/agent-analysis/${scanResult.symbol}`, {
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          const data = await response.json();
          setAgents(data.agents || []);
        } else {
          throw new Error(`API returned ${response.status}`);
        }
      } catch (err) {
        console.error('Failed to fetch agent analysis:', err);
        setError('Failed to load agent analysis');
        // Fallback to provided signals if available
        if (scanResult.agentSignals) {
          setAgents(scanResult.agentSignals);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAgentAnalysis();
  }, [scanResult.symbol, scanResult.agentSignals]);

  const consensus = scanResult.consensus;
  const agentList = agents.length > 0 ? agents : scanResult.agentSignals || [];
  const buyAgents = agentList.filter(a => a.signal === 'BUY').length;
  const sellAgents = agentList.filter(a => a.signal === 'SELL').length;
  const holdAgents = agentList.filter(a => a.signal === 'HOLD').length;
  const totalAgents = agentList.length;

  // Determine consensus signal if not provided
  const consensusSignal = consensus?.signal || (
    buyAgents >= 7 ? 'BUY' : sellAgents >= 7 ? 'SELL' : 'HOLD'
  );

  // Determine consensus confidence
  const avgConfidence = agentList.length > 0 
    ? (agentList.reduce((sum, a) => sum + a.confidence, 0) / agentList.length * 100)
    : 0;

  const consensusConfidence = consensus?.confidence || avgConfidence;

  // Risk score calculation
  const riskScore = consensus?.riskScore || (
    buyAgents >= 10 && consensusConfidence > 70 ? 'LOW' :
    sellAgents >= 7 ? 'HIGH' : 'MEDIUM'
  );

  return (
    <div className="space-y-4">
      {/* Header with Consensus Summary */}
      <Card className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-slate-700">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="w-5 h-5 text-blue-400" />
                13-Agent Consensus
              </CardTitle>
              <CardDescription className="text-xs">
                {scanResult.symbol} at ${scanResult.price.toFixed(2)} ({scanResult.change24h > 0 ? '+' : ''}{scanResult.change24h.toFixed(2)}%)
              </CardDescription>
            </div>
            <Badge className={`text-lg px-3 py-1 ${
              consensusSignal === 'BUY' ? 'bg-green-500/30 text-green-300' :
              consensusSignal === 'SELL' ? 'bg-red-500/30 text-red-300' :
              'bg-slate-600 text-slate-200'
            }`}>
              {consensusSignal}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Consensus Stats Grid */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-slate-700/50 rounded p-3">
              <div className="text-xs text-slate-400 mb-1">Consensus</div>
              <div className="text-2xl font-bold text-white">{consensusConfidence.toFixed(0)}%</div>
              <div className="text-xs text-slate-400">Confidence</div>
            </div>
            <div className="bg-green-500/10 rounded p-3 border border-green-500/30">
              <div className="text-xs text-slate-400 mb-1">Buy Votes</div>
              <div className="text-2xl font-bold text-green-400">{buyAgents}</div>
              <div className="text-xs text-slate-400">of {totalAgents}</div>
            </div>
            <div className="bg-red-500/10 rounded p-3 border border-red-500/30">
              <div className="text-xs text-slate-400 mb-1">Sell Votes</div>
              <div className="text-2xl font-bold text-red-400">{sellAgents}</div>
              <div className="text-xs text-slate-400">of {totalAgents}</div>
            </div>
            <div className={`rounded p-3 border ${
              riskScore === 'LOW' ? 'bg-green-500/10 border-green-500/30' :
              riskScore === 'HIGH' ? 'bg-red-500/10 border-red-500/30' :
              'bg-yellow-500/10 border-yellow-500/30'
            }`}>
              <div className="text-xs text-slate-400 mb-1">Risk Score</div>
              <div className={`text-lg font-bold ${
                riskScore === 'LOW' ? 'text-green-400' :
                riskScore === 'HIGH' ? 'text-red-400' :
                'text-yellow-400'
              }`}>
                {riskScore}
              </div>
            </div>
          </div>

          {/* Trade Button */}
          <Button 
            onClick={() => onTrade?.(scanResult)}
            disabled={consensusSignal === 'HOLD'}
            className={`w-full font-semibold ${
              consensusSignal === 'BUY' ? 'bg-green-600 hover:bg-green-700' :
              consensusSignal === 'SELL' ? 'bg-red-600 hover:bg-red-700' :
              'bg-slate-600 cursor-not-allowed'
            }`}
          >
            {consensusSignal === 'BUY' ? '📈 Long Entry' : 
             consensusSignal === 'SELL' ? '📉 Short Entry' : 
             '⏸️ Wait for Signal'}
          </Button>
        </CardContent>
      </Card>

      {/* Agent Votes Grid */}
      {!loading && agentList.length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Individual Agent Signals ({agentList.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {agentList.map((agent, idx) => (
                <Dialog key={idx}>
                  <DialogTrigger asChild>
                    <div className="p-3 rounded border border-slate-700 hover:border-slate-600 cursor-pointer transition bg-slate-800/50 hover:bg-slate-800">
                      <div className="text-xs font-semibold text-slate-400 mb-2">{agent.agentType}</div>
                      <div className="font-semibold text-sm mb-2">{agent.agentName}</div>
                      <Badge className={`mb-2 ${
                        agent.signal === 'BUY' ? 'bg-green-500/30 text-green-300' :
                        agent.signal === 'SELL' ? 'bg-red-500/30 text-red-300' :
                        'bg-slate-600 text-slate-200'
                      }`}>
                        {agent.signal}
                      </Badge>
                      <div className="text-xs text-slate-400">
                        <div>Conf: {(agent.confidence * 100).toFixed(0)}%</div>
                        {agent.historicalAccuracy && (
                          <div>Acc: {(agent.historicalAccuracy * 100).toFixed(0)}%</div>
                        )}
                      </div>
                    </div>
                  </DialogTrigger>

                  {/* Agent Detail Dialog */}
                  <DialogContent className="max-w-md bg-slate-900 border-slate-800">
                    <DialogHeader>
                      <DialogTitle>{agent.agentName}</DialogTitle>
                      <DialogDescription>{agent.agentType} Agent</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      {/* Signal and Confidence */}
                      <div className="bg-slate-800 rounded p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-slate-400">Signal</span>
                          <Badge className={
                            agent.signal === 'BUY' ? 'bg-green-500/30 text-green-300' :
                            agent.signal === 'SELL' ? 'bg-red-500/30 text-red-300' :
                            'bg-slate-600 text-slate-200'
                          }>
                            {agent.signal}
                          </Badge>
                        </div>
                        <div className="mb-2">
                          <div className="flex justify-between mb-1">
                            <span className="text-xs text-slate-400">Confidence</span>
                            <span className="text-sm font-semibold">{(agent.confidence * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-slate-700 rounded h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded transition-all"
                              style={{ width: `${agent.confidence * 100}%` }}
                            />
                          </div>
                        </div>
                        {agent.strength && (
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-xs text-slate-400">Strength</span>
                              <span className="text-sm font-semibold">{agent.strength.toFixed(1)}/10</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded h-2">
                              <div 
                                className="bg-purple-500 h-2 rounded transition-all"
                                style={{ width: `${Math.min(agent.strength * 10, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Historical Performance */}
                      {agent.historicalAccuracy && (
                        <div className="bg-slate-800 rounded p-4">
                          <div className="text-sm font-semibold mb-3">Historical Performance</div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-400">Accuracy</span>
                              <span className="text-sm font-semibold text-green-400">
                                {(agent.historicalAccuracy * 100).toFixed(1)}%
                              </span>
                            </div>
                            {agent.recentWinRate && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400">Recent Win Rate</span>
                                <span className="text-sm font-semibold text-green-400">
                                  {(agent.recentWinRate * 100).toFixed(1)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Close Button */}
                      <Button variant="outline" className="w-full" onClick={() => {}}>
                        Close
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6 text-center">
            <div className="text-slate-400">Loading agent analysis...</div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && !loading && agentList.length === 0 && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="pt-6 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
