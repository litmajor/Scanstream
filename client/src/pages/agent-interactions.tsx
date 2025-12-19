import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, HelpCircle, TrendingDown, TrendingUp, Clock, Zap } from 'lucide-react';

interface VoteData {
  agentName: string;
  agentType: string;
  vote: 'EXIT' | 'HOLD';
  confidence: number;
  reasoning: string;
  timestamp: string;
}

interface ConsensusVote {
  symbol: string;
  timestamp: string;
  votes: VoteData[];
  consensus: 'EXIT' | 'HOLD';
  confidence: number;
  exitUrgency?: 'HOLD' | 'TIGHTEN_STOP' | 'EXIT_STANDARD' | 'EXIT_URGENT';
}

interface InteractionFlow {
  exitAgent: {
    stage: string;
    reason: string;
    confidence: number;
  };
  oppositionAgent: {
    nearSupport: boolean;
    nearResistance: boolean;
    breakoutRisk: number;
  };
  microstructureAgent: {
    spreadAlert: boolean;
    depthWarning: boolean;
    volumeAnomaly: boolean;
  };
}

// Vote visualization card
const VoteCard: React.FC<{ vote: VoteData }> = ({ vote }) => {
  const isExit = vote.vote === 'EXIT';
  
  return (
    <div className={`rounded-lg border-2 p-4 ${
      isExit 
        ? 'bg-red-950 border-red-600' 
        : 'bg-green-950 border-green-600'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-bold text-white">{vote.agentName}</h4>
          <p className="text-sm text-gray-400">{vote.agentType}</p>
        </div>
        <div className={`text-2xl font-bold ${isExit ? 'text-red-400' : 'text-green-400'}`}>
          {isExit ? '🚪' : '🛡️'}
        </div>
      </div>

      <div className="mb-3">
        <div className="text-sm text-gray-300 mb-1">Vote Confidence</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full ${isExit ? 'bg-red-600' : 'bg-green-600'}`}
              style={{ width: `${vote.confidence * 100}%` }}
            />
          </div>
          <span className="text-sm font-bold text-gray-300 min-w-12">{(vote.confidence * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div className="bg-black bg-opacity-30 rounded p-2 text-sm text-gray-300">
        <div className="text-xs text-gray-500 mb-1">Reasoning:</div>
        {vote.reasoning}
      </div>

      <div className="mt-2 text-xs text-gray-500">
        {new Date(vote.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};

// Consensus display
const ConsensusDisplay: React.FC<{ consensus: ConsensusVote }> = ({ consensus }) => {
  const exitVotes = consensus.votes.filter(v => v.vote === 'EXIT').length;
  const holdVotes = consensus.votes.filter(v => v.vote === 'HOLD').length;
  const totalVotes = consensus.votes.length;
  const exitPercentage = (exitVotes / totalVotes) * 100;

  const consensusText = exitPercentage >= 66 ? 'STRONG EXIT' : exitPercentage >= 50 ? 'EXIT' : 'HOLD';
  const consensusColor = exitPercentage >= 66 ? 'text-red-500' : exitPercentage >= 50 ? 'text-orange-500' : 'text-green-500';

  return (
    <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg border border-gray-600 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">{consensus.symbol}</h3>
          <p className="text-sm text-gray-400">{new Date(consensus.timestamp).toLocaleString()}</p>
        </div>
        <div className={`text-4xl font-bold ${consensusColor}`}>
          {consensusText}
        </div>
      </div>

      {/* Vote Distribution */}
      <div className="mb-6">
        <div className="text-sm text-gray-400 mb-2">Vote Distribution ({exitVotes}EXIT / {holdVotes}HOLD)</div>
        <div className="flex gap-2 mb-2">
          <div className="flex-1 bg-red-900 rounded-lg h-6 flex items-center justify-center">
            <span className="text-sm font-bold text-red-100">{exitPercentage.toFixed(0)}% EXIT</span>
          </div>
          <div className="flex-1 bg-green-900 rounded-lg h-6 flex items-center justify-center">
            <span className="text-sm font-bold text-green-100">{(100 - exitPercentage).toFixed(0)}% HOLD</span>
          </div>
        </div>
      </div>

      {/* Consensus Confidence */}
      <div className="bg-gray-900 rounded p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-300 text-sm">Consensus Strength</span>
          <span className="font-bold text-gray-200">{(consensus.confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-yellow-500 to-orange-500 h-full"
            style={{ width: `${consensus.confidence * 100}%` }}
          />
        </div>
      </div>

      {/* Exit Urgency */}
      {consensus.exitUrgency && (
        <div className="bg-gray-900 rounded p-3">
          <div className="text-sm text-gray-400 mb-1">Exit Urgency</div>
          <div className={`font-bold text-lg ${
            consensus.exitUrgency === 'EXIT_URGENT' ? 'text-red-400' :
            consensus.exitUrgency === 'EXIT_STANDARD' ? 'text-orange-400' :
            consensus.exitUrgency === 'TIGHTEN_STOP' ? 'text-yellow-400' :
            'text-green-400'
          }`}>
            {consensus.exitUrgency}
          </div>
        </div>
      )}
    </div>
  );
};

// Agent Interaction Flow
const InteractionFlowView: React.FC<{ flow: InteractionFlow }> = ({ flow }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <h3 className="text-xl font-bold text-white mb-4">📊 Interaction Flow</h3>
      
      <div className="space-y-4">
        {/* Exit Agent Status */}
        <div className="border border-green-600 bg-green-950 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="text-green-400" size={20} />
            <h4 className="font-bold text-green-300">Exit Orchestrator</h4>
          </div>
          <div className="ml-7 text-sm text-gray-300">
            <div className="mb-1"><span className="text-gray-500">Stage:</span> {flow.exitAgent.stage}</div>
            <div className="mb-1"><span className="text-gray-500">Reason:</span> {flow.exitAgent.reason}</div>
            <div>
              <span className="text-gray-500">Confidence:</span>
              <div className="w-full bg-gray-700 rounded h-2 mt-1">
                <div 
                  className="bg-green-600 h-2 rounded"
                  style={{ width: `${flow.exitAgent.confidence * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Opposition Agent Status */}
        <div className="border border-orange-600 bg-orange-950 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="text-orange-400" size={20} />
            <h4 className="font-bold text-orange-300">Opposition Resistance Agent</h4>
          </div>
          <div className="ml-7 text-sm text-gray-300 space-y-1">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${flow.oppositionAgent.nearSupport ? 'bg-red-500' : 'bg-gray-600'}`} />
              Near Support: {flow.oppositionAgent.nearSupport ? '⚠️ YES' : '✓ No'}
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${flow.oppositionAgent.nearResistance ? 'bg-red-500' : 'bg-gray-600'}`} />
              Near Resistance: {flow.oppositionAgent.nearResistance ? '⚠️ YES' : '✓ No'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Breakout Risk:</span>
              <div className="flex-1 bg-gray-700 rounded h-2 ml-2">
                <div 
                  className={`h-2 rounded ${flow.oppositionAgent.breakoutRisk > 0.7 ? 'bg-red-600' : flow.oppositionAgent.breakoutRisk > 0.4 ? 'bg-yellow-600' : 'bg-green-600'}`}
                  style={{ width: `${flow.oppositionAgent.breakoutRisk * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 min-w-8">{(flow.oppositionAgent.breakoutRisk * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Microstructure Agent Status */}
        <div className="border border-purple-600 bg-purple-950 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="text-purple-400" size={20} />
            <h4 className="font-bold text-purple-300">Microstructure Specialist</h4>
          </div>
          <div className="ml-7 text-sm text-gray-300 space-y-1">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${flow.microstructureAgent.spreadAlert ? 'bg-red-500' : 'bg-gray-600'}`} />
              Spread Alert: {flow.microstructureAgent.spreadAlert ? '⚠️ YES' : '✓ No'}
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${flow.microstructureAgent.depthWarning ? 'bg-red-500' : 'bg-gray-600'}`} />
              Depth Warning: {flow.microstructureAgent.depthWarning ? '⚠️ YES' : '✓ No'}
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${flow.microstructureAgent.volumeAnomaly ? 'bg-orange-500' : 'bg-gray-600'}`} />
              Volume Anomaly: {flow.microstructureAgent.volumeAnomaly ? '⚠️ YES' : '✓ No'}
            </div>
          </div>
        </div>
      </div>

      {/* Decision Tree */}
      <div className="mt-6 pt-6 border-t border-gray-700">
        <h4 className="text-sm font-bold text-gray-400 mb-3">Decision Logic:</h4>
        <div className="space-y-2 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span className="text-purple-400">→</span> Exit Agent determines optimal exit stage
          </div>
          <div className="flex items-center gap-2">
            <span className="text-orange-400">→</span> Opposition Agent validates support/resistance levels
          </div>
          <div className="flex items-center gap-2">
            <span className="text-purple-400">→</span> Microstructure Agent checks order flow liquidity
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">→</span> Consensus reached: 2/3 agents must agree
          </div>
        </div>
      </div>
    </div>
  );
};

// Activity Feed
interface ActivityItem {
  timestamp: string;
  type: 'vote' | 'consensus' | 'trade' | 'error';
  message: string;
  details?: string;
}

const ActivityFeed: React.FC<{ items: ActivityItem[] }> = ({ items }) => {
  const iconMap = {
    vote: <HelpCircle size={16} className="text-blue-400" />,
    consensus: <CheckCircle size={16} className="text-green-400" />,
    trade: <TrendingUp size={16} className="text-yellow-400" />,
    error: <AlertCircle size={16} className="text-red-400" />,
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-bold text-white mb-4">📋 Activity Feed</h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {items.length === 0 ? (
          <div className="text-gray-500 text-center py-8">No recent activity</div>
        ) : (
          items.map((item, idx) => (
            <div key={idx} className="flex gap-3 border-b border-gray-700 pb-3 last:border-b-0">
              <div className="mt-1">{iconMap[item.type]}</div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-gray-300 text-sm font-semibold">{item.message}</span>
                  <span className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleTimeString()}</span>
                </div>
                {item.details && (
                  <div className="text-xs text-gray-500">{item.details}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Main Component
export default function AgentInteractionDashboard() {
  const [consensusVotes, setConsensusVotes] = useState<ConsensusVote[]>([]);
  const [currentFlow, setCurrentFlow] = useState<InteractionFlow | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch consensus votes
  useEffect(() => {
    const fetchVotes = async () => {
      try {
        const response = await fetch('/api/agents/exit/consensus-history');
        if (response.ok) {
          const data = await response.json();
          setConsensusVotes(data.data?.slice(0, 5) || []);
        }
      } catch (error) {
        console.error('Failed to fetch consensus votes:', error);
      } finally {
        setLoading(false);
      }
    };

    // Fetch interaction flow
    const fetchFlow = async () => {
      try {
        const response = await fetch('/api/agents/exit/interaction-flow');
        if (response.ok) {
          const data = await response.json();
          setCurrentFlow(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch interaction flow:', error);
      }
    };

    // Fetch activity feed
    const fetchActivity = async () => {
      try {
        const response = await fetch('/api/agents/exit/activity-log');
        if (response.ok) {
          const data = await response.json();
          setActivityFeed(data.data?.slice(0, 15) || []);
        }
      } catch (error) {
        console.error('Failed to fetch activity:', error);
      }
    };

    fetchVotes();
    fetchFlow();
    fetchActivity();

    // Refresh every 5 seconds
    const interval = setInterval(() => {
      fetchVotes();
      fetchFlow();
      fetchActivity();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🔗 Agent Interactions</h1>
          <p className="text-gray-400">Real-time consensus voting and decision flows across exit agents</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-96">
            <div className="text-gray-400">Loading agent interactions...</div>
          </div>
        ) : (
          <>
            {/* Current Interaction Flow */}
            {currentFlow && (
              <InteractionFlowView flow={currentFlow} />
            )}

            {/* Recent Consensus Votes */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-4">🗳️ Recent Consensus Votes</h2>
              {consensusVotes.length === 0 ? (
                <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-400">
                  No consensus votes yet
                </div>
              ) : (
                <div className="space-y-6">
                  {consensusVotes.map((consensus, idx) => (
                    <div key={idx}>
                      <ConsensusDisplay consensus={consensus} />
                      
                      {/* Vote cards grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {consensus.votes.map((vote, vIdx) => (
                          <VoteCard key={vIdx} vote={vote} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activity Feed */}
            <ActivityFeed items={activityFeed} />
          </>
        )}
      </div>
    </div>
  );
}
