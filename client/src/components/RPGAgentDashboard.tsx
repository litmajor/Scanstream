import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AgentAchievements from './AgentAchievements';
import AgentVotingPanel from './AgentVotingPanel';

export default function RPGAgentDashboard() {
  const { data: leaderboard } = useQuery({
    queryKey: ['rpg-agents-leaderboard'],
    queryFn: async () => {
      const res = await fetch('/api/rpg-agents/leaderboard');
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      return res.json();
    },
    refetchInterval: 10000
  });

  const { data: combos } = useQuery({
    queryKey: ['rpg-agents-combos'],
    queryFn: async () => {
      const res = await fetch('/api/rpg-agents/combos');
      if (!res.ok) throw new Error('Failed to fetch combos');
      return res.json();
    }
  });

  // Placeholder for selected agent, adjust as needed
  const selectedAgent = leaderboard?.data?.[0]; 

  const getRankColor = (rank: string) => {
    const colors: Record<string, string> = {
      'Master': 'bg-purple-500',
      'Diamond': 'bg-blue-400',
      'Platinum': 'bg-cyan-400',
      'Gold': 'bg-yellow-400',
      'Silver': 'bg-gray-300',
      'Bronze': 'bg-orange-600'
    };
    return colors[rank] || 'bg-gray-500';
  };

  return (
    <div className="space-y-6">
        <h2 className="text-3xl font-bold">🎮 RPG Agent System</h2>

        <Tabs defaultValue="agents" className="w-full">
          <TabsList>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="voting">Voting</TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="space-y-4 mt-4">
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                <CardHeader>
                    <CardTitle>🏆 Agent Leaderboard</CardTitle>
                    <CardDescription>Top performing trading agents</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                    {leaderboard?.data?.map((entry: any, idx: number) => (
                        <div key={entry.agent_name} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="text-2xl font-bold text-muted-foreground">#{idx + 1}</div>
                            <div>
                            <div className="font-semibold">{entry.agent_name}</div>
                            <div className="text-sm text-muted-foreground">
                                Level {entry.level} · {entry.win_rate.toFixed(1)}% WR
                            </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <Badge className={getRankColor(entry.rank)}>{entry.rank}</Badge>
                            <div className="text-sm font-mono text-green-500 mt-1">
                            ${entry.total_profit.toFixed(0)}
                            </div>
                        </div>
                        </div>
                    ))}
                    </div>
                </CardContent>
                </Card>

                <Card>
                <CardHeader>
                    <CardTitle>🌊 Agent Combos</CardTitle>
                    <CardDescription>Powerful multi-agent synergies</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                    {combos?.data?.map((combo: any) => (
                        <div key={combo.name} className="p-3 bg-secondary rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold">{combo.name}</h3>
                            <Badge variant="outline">+{((combo.bonus_multiplier - 1) * 100).toFixed(0)}%</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">
                            {combo.agents.join(' + ')}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                            <div className="text-muted-foreground">Win Rate</div>
                            <div className="font-semibold text-green-500">{(combo.historical_win_rate * 100).toFixed(0)}%</div>
                            </div>
                            <div>
                            <div className="text-muted-foreground">PF</div>
                            <div className="font-semibold">{combo.historical_profit_factor.toFixed(1)}</div>
                            </div>
                            <div>
                            <div className="text-muted-foreground">Activated</div>
                            <div className="font-semibold">{combo.times_activated}x</div>
                            </div>
                        </div>
                        </div>
                    ))}
                    </div>
                </CardContent>
                </Card>
            </div>
          </TabsContent>

          <TabsContent value="achievements" className="mt-4">
            {selectedAgent && (
              <AgentAchievements agentName={selectedAgent.name} />
            )}
          </TabsContent>

          <TabsContent value="voting" className="mt-4">
            <AgentVotingPanel 
              signal={{
                symbol: 'BTC/USDT',
                pattern: 'BREAKOUT',
                confidence: 0.75
              }}
              onVoteComplete={(result) => console.log('Vote result:', result)}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}