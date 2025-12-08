
# RPG Agent System - UI Integration Guide

## Components Needed

### 1. Achievement System UI

Display agent achievements in real-time:

```typescript
// client/src/components/AgentAchievements.tsx
import { Trophy, Zap, Target, TrendingUp } from 'lucide-react';

export function AgentAchievements({ agent }) {
  const achievementIcons = {
    '🔥': 'text-orange-500',
    '⚡': 'text-yellow-400',
    '🎯': 'text-blue-500',
    '💰': 'text-green-500',
    '🏆': 'text-purple-500'
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {agent.achievements.map((achievement, idx) => (
        <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
          <div className="text-2xl mb-1">{achievement.icon}</div>
          <div className="text-sm font-semibold text-white">{achievement.name}</div>
          <div className="text-xs text-slate-400">{achievement.description}</div>
          <div className="text-xs text-slate-500 mt-1">
            {new Date(achievement.unlockedAt).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 2. Skill Tree Visualization

Interactive skill tree with upgrade buttons:

```typescript
// client/src/components/AgentSkillTree.tsx
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export function AgentSkillTree({ agent, onUpgrade }) {
  const skills = [
    { key: 'pattern_recognition', label: 'Pattern Recognition', icon: '🔍' },
    { key: 'timing_precision', label: 'Timing Precision', icon: '⏱️' },
    { key: 'risk_management', label: 'Risk Management', icon: '🛡️' },
    { key: 'exit_optimization', label: 'Exit Optimization', icon: '🚪' },
    { key: 'regime_awareness', label: 'Regime Awareness', icon: '🌐' }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Skill Tree</h3>
        <div className="text-sm text-slate-400">
          Skill Points Available: <span className="text-purple-400 font-bold">{agent.skill_points}</span>
        </div>
      </div>
      
      {skills.map(skill => (
        <div key={skill.key} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{skill.icon}</span>
              <span className="font-semibold text-white">{skill.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-purple-400">
                {agent.skills[skill.key]}/10
              </span>
              {agent.skill_points > 0 && agent.skills[skill.key] < 10 && (
                <Button 
                  size="sm" 
                  onClick={() => onUpgrade(agent.name, skill.key)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Upgrade
                </Button>
              )}
            </div>
          </div>
          <Progress value={agent.skills[skill.key] * 10} className="h-2" />
        </div>
      ))}
    </div>
  );
}
```

### 3. Agent Status Cards

Visual representation of each agent:

```typescript
// client/src/components/AgentStatusCard.tsx
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AgentStatusCard({ agent }) {
  const rankColors = {
    'Master': 'bg-purple-500',
    'Diamond': 'bg-blue-400',
    'Platinum': 'bg-cyan-400',
    'Gold': 'bg-yellow-400',
    'Silver': 'bg-gray-300',
    'Bronze': 'bg-orange-600'
  };

  const moodEmoji = {
    'focused': '🎯',
    'aggressive': '⚡',
    'cautious': '🛡️',
    'tilted': '😤'
  };

  return (
    <Card className="bg-slate-900/50 border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">{moodEmoji[agent.mood]}</span>
            <span>{agent.name}</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={rankColors[agent.rank]}>{agent.rank}</Badge>
            <Badge variant="outline">Level {agent.level}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* XP Progress */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-400">XP Progress</span>
              <span className="text-purple-400">{agent.xp} / {agent.xp_to_next_level}</span>
            </div>
            <Progress value={(agent.xp / agent.xp_to_next_level) * 100} />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">
                {(agent.stats.win_rate * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-slate-400">Win Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">
                {agent.stats.profit_factor.toFixed(2)}
              </div>
              <div className="text-xs text-slate-400">Profit Factor</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-500">
                {agent.stats.sharpe.toFixed(2)}
              </div>
              <div className="text-xs text-slate-400">Sharpe</div>
            </div>
          </div>

          {/* Streaks */}
          <div className="flex justify-around mt-3 pt-3 border-t border-slate-700">
            <div className="text-center">
              <div className="text-green-500 font-bold">{agent.streaks.winning} 🔥</div>
              <div className="text-xs text-slate-400">Win Streak</div>
            </div>
            <div className="text-center">
              <div className="text-red-500 font-bold">{agent.streaks.losing} ❄️</div>
              <div className="text-xs text-slate-400">Loss Streak</div>
            </div>
          </div>

          {/* Confidence Bar */}
          <div className="mt-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-400">Confidence</span>
              <span className={agent.confidence > 0.7 ? 'text-green-400' : agent.confidence < 0.3 ? 'text-red-400' : 'text-yellow-400'}>
                {(agent.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <Progress value={agent.confidence * 100} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 4. Update RPGAgentDashboard

Enhance the existing dashboard:

```typescript
// Replace the content in client/src/components/RPGAgentDashboard.tsx
import { AgentStatusCard } from './AgentStatusCard';
import { AgentSkillTree } from './AgentSkillTree';
import { AgentAchievements } from './AgentAchievements';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function RPGAgentDashboard() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  
  const { data: leaderboard } = useQuery({
    queryKey: ['rpg-agents-leaderboard'],
    queryFn: async () => {
      const res = await fetch('/api/rpg-agents/leaderboard');
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      return res.json();
    },
    refetchInterval: 10000
  });

  const { data: agentDetails } = useQuery({
    queryKey: ['rpg-agent-details', selectedAgent],
    queryFn: async () => {
      if (!selectedAgent) return null;
      const res = await fetch(`/api/rpg-agents/status/${selectedAgent}`);
      if (!res.ok) throw new Error('Failed to fetch agent details');
      return res.json();
    },
    enabled: !!selectedAgent
  });

  const handleUpgradeSkill = async (agentName: string, skill: string) => {
    await fetch('/api/rpg-agents/upgrade-skill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentName, skill })
    });
    // Refetch data
    queryClient.invalidateQueries(['rpg-agent-details', agentName]);
  };

  return (
    <div className="space-y-6">
      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>🏆 Agent Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {leaderboard?.data?.map((entry: any) => (
              <div 
                key={entry.agent_name}
                onClick={() => setSelectedAgent(entry.agent_name)}
                className="cursor-pointer hover:bg-slate-800/50 p-3 rounded-lg"
              >
                <AgentStatusCard agent={entry} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Agent Details */}
      {selectedAgent && agentDetails && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedAgent} Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="skills">
              <TabsList>
                <TabsTrigger value="skills">Skill Tree</TabsTrigger>
                <TabsTrigger value="achievements">Achievements</TabsTrigger>
                <TabsTrigger value="abilities">Abilities</TabsTrigger>
              </TabsList>
              
              <TabsContent value="skills">
                <AgentSkillTree 
                  agent={agentDetails.data} 
                  onUpgrade={handleUpgradeSkill}
                />
              </TabsContent>
              
              <TabsContent value="achievements">
                <AgentAchievements agent={agentDetails.data} />
              </TabsContent>
              
              <TabsContent value="abilities">
                <div className="grid grid-cols-2 gap-3">
                  {agentDetails.data.abilities.map((ability: string) => (
                    <div key={ability} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                      <div className="font-semibold text-white">
                        {ability.replace(/_/g, ' ').toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Combos */}
      {/* Keep existing combos section */}
    </div>
  );
}
```

## Summary

You now have:
1. ✅ **5 RPG Agent Types** (Breakout, Reversal, ML, Trend, Support)
2. ✅ **Market Oracle** (central data hub)
3. ✅ **Strategy Bridge** (integrates with Python strategies, RL agent, BBU)
4. ✅ **Agent Arena** (spawning, consensus, combos)
5. ✅ **API Endpoints** (8 endpoints for full agent control)
6. ✅ **Documentation** (integration guide + UI guide)
7. 🔄 **UI Components** (ready to implement)

**Next Steps**:
1. Test the integration with your Python strategies
2. Implement the UI components
3. Start feeding real market data to agents
4. Watch them level up and improve!
