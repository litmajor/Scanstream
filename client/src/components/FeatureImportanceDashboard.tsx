import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Trash2, Plus, FlaskConical, TrendingUp, Activity, Zap } from 'lucide-react';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface FeatureImportance {
  featureName: string;
  importance: number;
  correlationWithSuccess: number;
  usageFrequency: number;
  avgContribution: number;
}

interface FeatureSet {
  id: string;
  agentId: string;
  features: Record<string, any>;
  performance: {
    totalSignals: number;
    successfulSignals: number;
    avgReturn: number;
  };
}

export function FeatureImportanceDashboard() {
  const [selectedTab, setSelectedTab] = useState('importance');

  const { data: importanceData, isLoading: loadingImportance } = useQuery<{ data: FeatureImportance[] }>({
    queryKey: ['/api/feature-engineering/importance']
  });

  const { data: featureSetsData, isLoading: loadingSets } = useQuery<{ data: FeatureSet[] }>({
    queryKey: ['/api/feature-engineering/feature-sets']
  });

  const pruneMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/feature-engineering/prune'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-engineering/importance'] });
    }
  });

  const generateMutation = useMutation({
    mutationFn: (agentType: string) => 
      apiRequest('POST', `/api/feature-engineering/generate/${agentType}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-engineering/importance'] });
    }
  });

  const features = importanceData?.data || [];
  const featureSets = featureSetsData?.data || [];

  const topFeatures = features.slice(0, 15);
  const lowFeatures = features.slice(-10).reverse();

  const chartData = topFeatures.map(f => ({
    name: f.featureName.length > 15 ? f.featureName.substring(0, 15) + '...' : f.featureName,
    importance: Math.round(f.importance * 100),
    successRate: Math.round(f.correlationWithSuccess * 100)
  }));

  const getImportanceColor = (importance: number) => {
    if (importance > 0.7) return 'hsl(var(--chart-1))';
    if (importance > 0.4) return 'hsl(var(--chart-2))';
    return 'hsl(var(--chart-3))';
  };

  return (
    <div className="space-y-4" data-testid="feature-importance-dashboard">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-dashboard-title">Feature Engineering</h2>
          <p className="text-muted-foreground">AI-powered feature creation and importance tracking</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => generateMutation.mutate('BREAKOUT')}
            disabled={generateMutation.isPending}
            data-testid="button-generate-features"
          >
            <Plus className="w-4 h-4 mr-2" />
            Generate Features
          </Button>
          <Button
            variant="destructive"
            onClick={() => pruneMutation.mutate()}
            disabled={pruneMutation.isPending}
            data-testid="button-prune-features"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Prune Low-Value
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-features">{features.length}</p>
                <p className="text-sm text-muted-foreground">Total Features</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-high-value">
                  {features.filter(f => f.importance > 0.5).length}
                </p>
                <p className="text-sm text-muted-foreground">High Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-feature-sets">{featureSets.length}</p>
                <p className="text-sm text-muted-foreground">A/B Test Sets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-avg-importance">
                  {features.length > 0 ? 
                    Math.round(features.reduce((a, b) => a + b.importance, 0) / features.length * 100) : 0}%
                </p>
                <p className="text-sm text-muted-foreground">Avg Importance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="importance" data-testid="tab-importance">Feature Importance</TabsTrigger>
          <TabsTrigger value="chart" data-testid="tab-chart">Visualization</TabsTrigger>
          <TabsTrigger value="pruning" data-testid="tab-pruning">Pruning Candidates</TabsTrigger>
          <TabsTrigger value="ab-testing" data-testid="tab-ab-testing">A/B Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="importance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Features</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingImportance ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : (
                <div className="space-y-3">
                  {topFeatures.map((feature, idx) => (
                    <div key={feature.featureName} className="flex items-center gap-4" data-testid={`feature-row-${idx}`}>
                      <Badge variant="outline" className="w-8 justify-center">
                        {idx + 1}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{feature.featureName}</p>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>Usage: {feature.usageFrequency}</span>
                          <span>Success: {Math.round(feature.correlationWithSuccess * 100)}%</span>
                        </div>
                      </div>
                      <div className="w-32">
                        <Progress value={feature.importance * 100} className="h-2" />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">
                        {Math.round(feature.importance * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chart">
          <Card>
            <CardHeader>
              <CardTitle>Feature Importance Chart</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="importance" name="Importance %" radius={[0, 4, 4, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getImportanceColor(entry.importance / 100)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pruning">
          <Card>
            <CardHeader>
              <CardTitle>Low-Value Features (Pruning Candidates)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {lowFeatures.map((feature, idx) => (
                  <div key={feature.featureName} className="flex items-center gap-4 opacity-70" data-testid={`prune-row-${idx}`}>
                    <Badge variant="destructive" className="w-8 justify-center">
                      {features.length - idx}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{feature.featureName}</p>
                      <p className="text-xs text-muted-foreground">
                        Usage: {feature.usageFrequency} | Success: {Math.round(feature.correlationWithSuccess * 100)}%
                      </p>
                    </div>
                    <div className="w-32">
                      <Progress value={feature.importance * 100} className="h-2" />
                    </div>
                    <span className="text-sm font-medium w-12 text-right text-destructive">
                      {Math.round(feature.importance * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ab-testing">
          <Card>
            <CardHeader>
              <CardTitle>A/B Test Feature Sets</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSets ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : featureSets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No A/B tests configured yet. Create feature sets to compare agent performance.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {featureSets.map((set: any) => (
                    <Card key={set.id} data-testid={`ab-test-set-${set.id}`}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium">{set.id}</p>
                            <p className="text-sm text-muted-foreground">Agent: {set.agentId}</p>
                          </div>
                          <Badge variant="secondary">
                            {Object.keys(set.features || {}).length} features
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Signals</p>
                            <p className="font-medium">{set.performance?.totalSignals || 0}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Win Rate</p>
                            <p className="font-medium">
                              {set.performance?.totalSignals > 0 
                                ? Math.round((set.performance.successfulSignals / set.performance.totalSignals) * 100)
                                : 0}%
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Avg Return</p>
                            <p className="font-medium">{(set.performance?.avgReturn || 0).toFixed(2)}%</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default FeatureImportanceDashboard;
