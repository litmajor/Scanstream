
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdvancedAgentDashboard() {
  // Market Sage queries
  const { data: patterns } = useQuery({
    queryKey: ['market-sage-patterns'],
    queryFn: async () => {
      const res = await fetch('/api/rpg-agents/market-sage/patterns');
      return res.json();
    },
    refetchInterval: 30000
  });

  const discoverMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/rpg-agents/market-sage/discover', { method: 'POST' });
      return res.json();
    }
  });

  // Portfolio Manager queries
  const { data: portfolio } = useQuery({
    queryKey: ['portfolio-metrics'],
    queryFn: async () => {
      const res = await fetch('/api/rpg-agents/portfolio/metrics');
      return res.json();
    },
    refetchInterval: 10000
  });

  const { data: allocations } = useQuery({
    queryKey: ['portfolio-allocations'],
    queryFn: async () => {
      const res = await fetch('/api/rpg-agents/portfolio/allocations');
      return res.json();
    },
    refetchInterval: 30000
  });

  const rebalanceMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/rpg-agents/portfolio/rebalance', { method: 'POST' });
      return res.json();
    }
  });

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">🧠 Advanced Agent Intelligence</h2>

      <Tabs defaultValue="market-sage" className="w-full">
        <TabsList>
          <TabsTrigger value="market-sage">Market Sage</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio Manager</TabsTrigger>
          <TabsTrigger value="learning">Online Learning</TabsTrigger>
        </TabsList>

        {/* Market Sage Tab */}
        <TabsContent value="market-sage" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold">Strategy Discovery Engine</h3>
              <p className="text-sm text-muted-foreground">AI-powered pattern mining and strategy evolution</p>
            </div>
            <Button onClick={() => discoverMutation.mutate()}>
              🔬 Discover New Patterns
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {patterns?.patterns?.map((pattern: any) => (
              <Card key={pattern.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{pattern.name}</CardTitle>
                    <Badge variant={pattern.validation_status === 'VALIDATED' ? 'default' : 'outline'}>
                      {pattern.validation_status}
                    </Badge>
                  </div>
                  <CardDescription>{pattern.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Win Rate</span>
                      <span className="font-semibold">{(pattern.expected_performance.win_rate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Profit Factor</span>
                      <span className="font-semibold">{pattern.expected_performance.profit_factor.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Confidence</span>
                      <span className="font-semibold">{(pattern.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Sample Size</span>
                      <span className="font-semibold">{pattern.expected_performance.sample_size} trades</span>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">
                        Discovered from: {pattern.discovered_from.join(', ')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Portfolio Manager Tab */}
        <TabsContent value="portfolio" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold">Capital Allocation</h3>
              <p className="text-sm text-muted-foreground">Kelly Criterion + Risk Parity optimization</p>
            </div>
            <Button onClick={() => rebalanceMutation.mutate()}>
              🔄 Rebalance Portfolio
            </Button>
          </div>

          {portfolio?.metrics && (
            <Card>
              <CardHeader>
                <CardTitle>Portfolio Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Capital</p>
                    <p className="text-2xl font-bold">${portfolio.metrics.total_capital.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Allocated</p>
                    <p className="text-2xl font-bold">${portfolio.metrics.allocated_capital.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Portfolio Sharpe</p>
                    <p className="text-2xl font-bold">{portfolio.metrics.portfolio_sharpe.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Diversification</p>
                    <p className="text-2xl font-bold">{(portfolio.metrics.diversification_score * 100).toFixed(0)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            <h4 className="font-semibold">Agent Allocations</h4>
            {allocations?.allocations?.map((alloc: any) => (
              <Card key={alloc.agent_name}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{alloc.agent_name}</h4>
                    <span className="text-lg font-bold">${alloc.capital_allocated.toLocaleString()}</span>
                  </div>
                  <Progress value={alloc.allocation_percentage * 100} className="mb-2" />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{(alloc.allocation_percentage * 100).toFixed(1)}% of portfolio</span>
                    <span>Max position: ${alloc.max_position_size.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{alloc.reason}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Online Learning Tab */}
        <TabsContent value="learning" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Continuous Learning System</CardTitle>
              <CardDescription>Real-time adaptation and Q-learning optimization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                  <div>
                    <p className="font-semibold">Experience Replay</p>
                    <p className="text-sm text-muted-foreground">Learning from past trades</p>
                  </div>
                  <Button variant="outline" onClick={() => fetch('/api/rpg-agents/learning/replay', { method: 'POST' })}>
                    Replay Batch
                  </Button>
                </div>
                <div className="text-center p-6 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Select an agent to view detailed learning metrics</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
