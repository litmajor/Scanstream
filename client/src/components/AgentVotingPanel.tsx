
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface Vote {
  agent: string;
  vote: boolean;
  confidence: number;
}

interface VotingPanelProps {
  signal: any;
  onVoteComplete?: (result: any) => void;
}

export default function AgentVotingPanel({ signal, onVoteComplete }: VotingPanelProps) {
  const [voting, setVoting] = useState(false);
  const [voteResult, setVoteResult] = useState<any>(null);

  const initiateVote = async () => {
    setVoting(true);
    try {
      const res = await fetch('/api/rpg-agents/vote-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signal)
      });
      const result = await res.json();
      setVoteResult(result);
      onVoteComplete?.(result);
    } catch (error) {
      console.error('Voting failed:', error);
    } finally {
      setVoting(false);
    }
  };

  return (
    <Card className="p-4 bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border-indigo-500/30">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">🗳️ Agent Consensus Vote</h3>
          <Button
            onClick={initiateVote}
            disabled={voting}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {voting ? 'Voting...' : 'Start Vote'}
          </Button>
        </div>

        {voteResult && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Consensus</span>
              <Badge className={voteResult.consensus ? 'bg-green-600' : 'bg-red-600'}>
                {voteResult.consensus ? '✓ APPROVED' : '✗ REJECTED'}
              </Badge>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Confidence</span>
                <span className="font-bold">{(voteResult.confidence * 100).toFixed(1)}%</span>
              </div>
              <Progress value={voteResult.confidence * 100} className="h-2" />
            </div>

            <div className="text-sm text-gray-400 italic">
              {voteResult.reasoning}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold">Individual Votes:</div>
              {voteResult.votes.map((vote: Vote, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-gray-800/50 rounded">
                  <div className="flex items-center gap-2">
                    <span className={vote.vote ? 'text-green-400' : 'text-red-400'}>
                      {vote.vote ? '👍' : '👎'}
                    </span>
                    <span className="text-sm">{vote.agent}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {(vote.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
