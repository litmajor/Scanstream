
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
}

interface AgentAchievementsProps {
  agentName: string;
}

const tierColors = {
  bronze: 'bg-orange-700',
  silver: 'bg-gray-400',
  gold: 'bg-yellow-500',
  platinum: 'bg-cyan-400',
  diamond: 'bg-purple-500'
};

export default function AgentAchievements({ agentName }: AgentAchievementsProps) {
  const [unlocked, setUnlocked] = useState<Achievement[]>([]);
  const [locked, setLocked] = useState<Achievement[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    fetchAchievements();
  }, [agentName]);

  const fetchAchievements = async () => {
    try {
      const res = await fetch(`/api/rpg-agents/${agentName}/achievements`);
      const data = await res.json();
      setUnlocked(data.unlocked || []);
      setLocked(data.locked || []);
      setProgress(data.progress || 0);
    } catch (error) {
      console.error('Failed to fetch achievements:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">🏆 Achievements</h3>
        <div className="text-sm text-gray-400">
          {unlocked.length} / {unlocked.length + locked.length}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm">Progress</span>
          <span className="text-sm font-bold">{progress.toFixed(0)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {unlocked.map((achievement) => (
          <Card key={achievement.id} className="p-4 bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-green-500/50">
            <div className="flex items-start gap-3">
              <div className="text-4xl">{achievement.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold">{achievement.name}</h4>
                  <Badge className={tierColors[achievement.tier]}>
                    {achievement.tier}
                  </Badge>
                </div>
                <p className="text-sm text-gray-400 mt-1">{achievement.description}</p>
              </div>
            </div>
          </Card>
        ))}

        {locked.map((achievement) => (
          <Card key={achievement.id} className="p-4 bg-gray-900/50 border border-gray-700 opacity-50">
            <div className="flex items-start gap-3">
              <div className="text-4xl grayscale">{achievement.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-gray-500">{achievement.name}</h4>
                  <Badge variant="outline" className="text-gray-500">
                    {achievement.tier}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mt-1">{achievement.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
