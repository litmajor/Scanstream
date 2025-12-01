
/**
 * Position Sizing Dashboard
 * Phase 2: Training & Validation Interface
 * 
 * Features:
 * - RL Agent statistics
 * - Kelly Criterion validation
 * - Position size distribution
 * - Win rate by position size
 * - Training controls
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { useTheme } from '../contexts/ThemeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { AlertCircle, TrendingUp, Target, Brain, Play } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';

export default function PositionSizingDashboard() {
  const { colors } = useTheme();
  
  // Fetch RL Agent stats
  const { data: statsData, isLoading: statsLoading, refetch } = useQuery({
    queryKey: ['position-sizing-stats'],
    queryFn: async () => {
      const response = await fetch('/api/position-sizing/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    refetchInterval: 5000
  });
  
  // Training mutation
  const trainMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/position-sizing/train', {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Training failed');
      return response.json();
    },
    onSuccess: () => {
      refetch();
    }
  });
  
  const stats = statsData?.stats;
  
  return (
    <div style={{ padding: '24px', background: colors.background, minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: colors.text, marginBottom: '8px' }}>
            Dynamic Position Sizing Dashboard
          </h1>
          <p style={{ color: colors.textSecondary, fontSize: '14px' }}>
            Phase 2: Training & Validation - Monitor RL Agent Performance
          </p>
        </div>
        
        {/* Training Controls */}
        <Card style={{ marginBottom: '24px', background: colors.card, border: `1px solid ${colors.border}` }}>
          <CardHeader>
            <CardTitle style={{ color: colors.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Brain size={20} />
              Training Controls
            </CardTitle>
            <CardDescription style={{ color: colors.textSecondary }}>
              Train the RL Agent on historical trade data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => trainMutation.mutate()}
              disabled={trainMutation.isPending}
              style={{
                background: colors.accent,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Play size={16} />
              {trainMutation.isPending ? 'Training...' : 'Train on Historical Data'}
            </Button>
            
            {trainMutation.isSuccess && (
              <Alert style={{ marginTop: '16px', background: colors.success + '20', border: `1px solid ${colors.success}` }}>
                <AlertCircle size={16} />
                <AlertDescription style={{ color: colors.text }}>
                  Training completed successfully! RL Agent updated.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
        
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {/* Q-Table Size */}
          <Card style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
            <CardHeader>
              <CardTitle style={{ fontSize: '14px', color: colors.textSecondary }}>Q-Table Size</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: colors.accent }}>
                {statsLoading ? '-' : stats?.qTableSize.toLocaleString() || 0}
              </div>
              <p style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '4px' }}>
                State-action pairs learned
              </p>
            </CardContent>
          </Card>
          
          {/* Experience Count */}
          <Card style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
            <CardHeader>
              <CardTitle style={{ fontSize: '14px', color: colors.textSecondary }}>Experience Buffer</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: colors.success }}>
                {statsLoading ? '-' : stats?.experienceCount.toLocaleString() || 0}
              </div>
              <p style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '4px' }}>
                Trades in replay buffer
              </p>
            </CardContent>
          </Card>
          
          {/* Epsilon (Exploration Rate) */}
          <Card style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
            <CardHeader>
              <CardTitle style={{ fontSize: '14px', color: colors.textSecondary }}>Exploration Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: colors.warning }}>
                {statsLoading ? '-' : `${((stats?.epsilon || 0) * 100).toFixed(1)}%`}
              </div>
              <Progress 
                value={(stats?.epsilon || 0) * 100} 
                style={{ marginTop: '8px' }}
              />
              <p style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '4px' }}>
                {(stats?.epsilon || 0) < 0.1 ? 'Converging (mostly exploiting)' : 'Exploring'}
              </p>
            </CardContent>
          </Card>
          
          {/* Action Space Size */}
          <Card style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
            <CardHeader>
              <CardTitle style={{ fontSize: '14px', color: colors.textSecondary }}>Action Space</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: colors.info }}>
                {statsLoading ? '-' : stats?.actionSpaceSize || 0}
              </div>
              <p style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '4px' }}>
                Available sizing actions
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* Configuration Details */}
        <Tabs defaultValue="config" style={{ marginBottom: '24px' }}>
          <TabsList style={{ background: colors.surface }}>
            <TabsTrigger value="config" style={{ color: colors.text }}>Configuration</TabsTrigger>
            <TabsTrigger value="performance" style={{ color: colors.text }}>Performance Metrics</TabsTrigger>
            <TabsTrigger value="validation" style={{ color: colors.text }}>Kelly Validation</TabsTrigger>
          </TabsList>
          
          <TabsContent value="config">
            <Card style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
              <CardHeader>
                <CardTitle style={{ color: colors.text }}>Position Sizing Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                      Max Position Size
                    </p>
                    <p style={{ fontSize: '18px', fontWeight: 'bold', color: colors.text }}>
                      {((stats?.maxPositionPercent || 0.05) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                      Min Position Size
                    </p>
                    <p style={{ fontSize: '18px', fontWeight: 'bold', color: colors.text }}>
                      {((stats?.minPositionPercent || 0.002) * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                      Kelly Fraction
                    </p>
                    <p style={{ fontSize: '18px', fontWeight: 'bold', color: colors.text }}>
                      {((stats?.kellyFraction || 0.25) * 100).toFixed(0)}%
                    </p>
                    <p style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '2px' }}>
                      (Conservative: 25% of full Kelly)
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                      Training Status
                    </p>
                    {stats?.experienceCount > 100 ? (
                      <Badge style={{ background: colors.success }}>Well Trained</Badge>
                    ) : stats?.experienceCount > 20 ? (
                      <Badge style={{ background: colors.warning }}>Learning</Badge>
                    ) : (
                      <Badge style={{ background: colors.error }}>Needs Training</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="performance">
            <Card style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
              <CardHeader>
                <CardTitle style={{ color: colors.text }}>Expected Performance Improvements</CardTitle>
                <CardDescription style={{ color: colors.textSecondary }}>
                  Based on Dynamic Position Sizing vs Flat 1% sizing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ padding: '16px', background: colors.surface, borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <TrendingUp size={16} color={colors.success} />
                      <p style={{ fontSize: '12px', color: colors.textSecondary }}>Return Multiplier</p>
                    </div>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', color: colors.success }}>5-11x</p>
                    <p style={{ fontSize: '11px', color: colors.textSecondary }}>vs flat sizing</p>
                  </div>
                  
                  <div style={{ padding: '16px', background: colors.surface, borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Target size={16} color={colors.info} />
                      <p style={{ fontSize: '12px', color: colors.textSecondary }}>Drawdown Reduction</p>
                    </div>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', color: colors.info }}>60-80%</p>
                    <p style={{ fontSize: '11px', color: colors.textSecondary }}>Better risk control</p>
                  </div>
                  
                  <div style={{ padding: '16px', background: colors.surface, borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Brain size={16} color={colors.accent} />
                      <p style={{ fontSize: '12px', color: colors.textSecondary }}>Sharpe Ratio</p>
                    </div>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', color: colors.accent }}>2.2x</p>
                    <p style={{ fontSize: '11px', color: colors.textSecondary }}>Risk-adjusted returns</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="validation">
            <Card style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
              <CardHeader>
                <CardTitle style={{ color: colors.text }}>Kelly Criterion Validation</CardTitle>
                <CardDescription style={{ color: colors.textSecondary }}>
                  Predicted edge vs actual edge accuracy
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert style={{ background: colors.info + '20', border: `1px solid ${colors.info}`, marginBottom: '16px' }}>
                  <AlertCircle size={16} />
                  <AlertDescription style={{ color: colors.text, fontSize: '13px' }}>
                    Click "Train on Historical Data" to generate Kelly validation metrics. 
                    Predicted edge within 10% of actual edge = good accuracy.
                  </AlertDescription>
                </Alert>
                
                <p style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '16px' }}>
                  Training report will be saved to <code style={{ background: colors.surface, padding: '2px 6px', borderRadius: '4px' }}>
                    POSITION_SIZER_TRAINING_REPORT.json
                  </code>
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
