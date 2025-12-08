
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import AgentAchievements from './AgentAchievements';
import AgentVotingPanel from './AgentVotingPanel';
import { Sword, Zap, TrendingUp, Shield, Target, Trophy, Flame, Star } from 'lucide-react';

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

  const { data: liveActivities } = useQuery({
    queryKey: ['rpg-agents-activities'],
    queryFn: async () => {
      // Mock for now - implement real endpoint later
      return {
        activities: [
          { time: '2 min ago', agent: 'ML_ORACLE', action: 'Closed ETH trade', result: '+4.2%', type: 'win' },
          { time: '15 min ago', agent: 'BREAKOUT_HUNTER', action: 'Entered BTC breakout', result: 'Active', type: 'active' },
          { time: '1 hour ago', agent: 'REVERSAL_MASTER', action: 'Activated after hibernation', result: 'Ready', type: 'status' }
        ]
      };
    },
    refetchInterval: 5000
  });

  const selectedAgent = leaderboard?.data?.[0]; 

  const getAgentIcon = (agentName: string) => {
    if (agentName.includes('BREAKOUT')) return <Sword className="w-5 h-5" />;
    if (agentName.includes('ML') || agentName.includes('ORACLE')) return <Zap className="w-5 h-5" />;
    if (agentName.includes('TREND')) return <TrendingUp className="w-5 h-5" />;
    if (agentName.includes('REVERSAL')) return <Shield className="w-5 h-5" />;
    if (agentName.includes('SUPPORT')) return <Target className="w-5 h-5" />;
    return <Star className="w-5 h-5" />;
  };

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
    <div className="space-y-6 p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-screen">
      {/* Epic Header */}
      <div className="text-center space-y-2 py-8">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
          🎮 Agent Command Center
        </h1>
        <p className="text-slate-400 text-lg">Your autonomous trading army - watching, learning, evolving</p>
      </div>

      {/* Live Activity Feed - The "Morning Coffee" Experience */}
      <Card className="border-2 border-purple-500/30 bg-slate-900/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Live Agent Activity
          </CardTitle>
          <CardDescription>What your agents are doing right now</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {liveActivities?.activities?.map((activity: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-purple-500/50 transition-all">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${activity.type === 'win' ? 'bg-green-500' : activity.type === 'active' ? 'bg-blue-500' : 'bg-yellow-500'} animate-pulse`} />
                  <div>
                    <div className="font-semibold text-white">{activity.agent}</div>
                    <div className="text-sm text-slate-400">{activity.action}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${activity.type === 'win' ? 'text-green-400' : 'text-slate-300'}`}>
                    {activity.result}
                  </div>
                  <div className="text-xs text-slate-500">{activity.time}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="agents" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-slate-800">
          <TabsTrigger value="agents">🗡️ Agents</TabsTrigger>
          <TabsTrigger value="combos">🌊 Combos</TabsTrigger>
          <TabsTrigger value="voting">🎯 Voting</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4 mt-4">
          {/* Agent Cards - RPG Style */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {leaderboard?.data?.map((entry: any, idx: number) => (
              <Card key={entry.agent_name} className="border-2 border-slate-700 bg-slate-900/80 backdrop-blur hover:border-purple-500/50 hover:scale-105 transition-all cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getAgentIcon(entry.agent_name)}
                      <CardTitle className="text-lg">{entry.agent_name}</CardTitle>
                    </div>
                    <Badge className={getRankColor(entry.rank)}>{entry.rank}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Level Progress */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400">Level {entry.level}</span>
                      <span className="text-purple-400">{entry.xp || 0} XP</span>
                    </div>
                    <Progress value={(entry.xp || 0) % 1000 / 10} className="h-2" />
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/50 p-3 rounded-lg">
                      <div className="text-xs text-slate-400">Win Rate</div>
                      <div className="text-xl font-bold text-green-400">{entry.win_rate.toFixed(1)}%</div>
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded-lg">
                      <div className="text-xs text-slate-400">Profit</div>
                      <div className="text-xl font-bold text-green-400">${entry.total_profit.toFixed(0)}</div>
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded-lg">
                      <div className="text-xs text-slate-400">Trades</div>
                      <div className="text-xl font-bold text-white">{entry.total_trades || 0}</div>
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded-lg">
                      <div className="text-xs text-slate-400">Rank</div>
                      <div className="text-xl font-bold text-yellow-400">#{idx + 1}</div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1">View Details</Button>
                    <Button size="sm" variant="outline" className="flex-1">Hibernate</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="combos" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {combos?.data?.map((combo: any) => (
              <Card key={combo.name} className="border-2 border-blue-500/30 bg-gradient-to-br from-blue-900/20 to-purple-900/20 backdrop-blur">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-xl flex items-center gap-2">
                      🌊 {combo.name}
                    </CardTitle>
                    <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500">
                      +{((combo.bonus_multiplier - 1) * 100).toFixed(0)}% Bonus
                    </Badge>
                  </div>
                  <CardDescription className="text-slate-300">
                    {combo.agents.join(' + ')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-slate-800/50 p-3 rounded-lg">
                      <div className="text-xs text-slate-400">Win Rate</div>
                      <div className="text-lg font-bold text-green-400">{(combo.historical_win_rate * 100).toFixed(0)}%</div>
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded-lg">
                      <div className="text-xs text-slate-400">Profit Factor</div>
                      <div className="text-lg font-bold text-purple-400">{combo.historical_profit_factor.toFixed(1)}x</div>
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded-lg">
                      <div className="text-xs text-slate-400">Activated</div>
                      <div className="text-lg font-bold text-blue-400">{combo.times_activated}x</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    <span>Last activated: 2 days ago</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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

      {/* Achievement Showcase */}
      {selectedAgent && (
        <Card className="border-2 border-purple-500/30 bg-slate-900/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Recent Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AgentAchievements agentName={selectedAgent.agent_name} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
