/**
 * AGENT CLUSTERING PANEL
 * 
 * UI Component for displaying agent clustering analysis and specialist routing
 */

import React, { useState, useEffect } from 'react';
import styles from './AgentClusteringPanel.module.css';
import Card from './Card';

interface ClusterMetrics {
  totalClusters: number;
  totalAgents: number;
  agentsPerCluster: number;
}

interface ImpactMetrics {
  returnImprovement: number;
  sharpeImprovement: number;
  drawdownReduction: number;
  winRateImprovement: number;
  routingAccuracy: number;
  clusterUtilization: number;
  specialistEfficacy: number;
}

interface SpecialistMetric {
  specialization: string;
  winRate: number;
  returnPercentage: number;
  effectiveness: number;
  utilizationRate: number;
}

interface RoutingPattern {
  regime: string;
  specialist: string;
  confidence: number;
  volume: number;
}

interface ClusterQuality {
  cohesion: number;
  separation: number;
  stability: number;
  overall: number;
}

interface BaselineMetrics {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
}

interface ClusteringReport {
  baseline: BaselineMetrics;
  clustering: ClusterMetrics;
  impact: ImpactMetrics;
  specialistPerformance: SpecialistMetric[];
  routingPatterns: RoutingPattern[];
  clusterQuality: ClusterQuality;
  recommendations: Array<{
    category: string;
    suggestion: string;
    expectedBenefit: string;
  }>;
}

interface Agent {
  id: string;
  name: string;
  specialization: string;
  winRate: string;
  successRate: string;
  avgReturn: string;
  confidence: string;
  marketRegimes: string[];
  assetPreferences: string[];
}

const AgentClusteringPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'routing' | 'quality' | 'recommendations'>('overview');
  const [report, setReport] = useState<ClusteringReport | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [comparison, setComparison] = useState<any>(null);

  // Fetch clustering analysis
  const handleRunAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/backtest/agent-clustering/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC/USDT',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          initialCapital: 10000,
          timeframe: '1h',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to run clustering analysis');
      }

      const data = await response.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch specialist vs general comparison
  const handleCompareRouting = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/backtest/agent-clustering/compare-routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC/USDT',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to compare routing');
      }

      const data = await response.json();
      setComparison(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch agent profiles
  const handleLoadAgents = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/backtest/agent-clustering/agents');
      if (!response.ok) {
        throw new Error('Failed to load agents');
      }

      const data = await response.json();
      setAgents(data.agents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleLoadAgents();
  }, []);

  return (
    <div className={styles.container}>
      <h2>🤖 Agent Clustering Analysis</h2>
      <p className={styles.description}>
        Measure impact of clustering agents by specialization and routing signals to optimal specialists.
        Expected improvement: +40-50% from specialist routing.
      </p>

      {error && <div className={styles.error}>Error: {error}</div>}

      <div className={styles.controls}>
        <button
          className={styles.button}
          onClick={handleRunAnalysis}
          disabled={loading}
        >
          {loading ? 'Running...' : '▶ Run Full Analysis'}
        </button>
        <button
          className={styles.button}
          onClick={handleCompareRouting}
          disabled={loading}
        >
          {loading ? 'Comparing...' : '⚖ Compare Routing'}
        </button>
      </div>

      {report && (
        <>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              📊 Overview
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'metrics' ? styles.active : ''}`}
              onClick={() => setActiveTab('metrics')}
            >
              📈 Impact Metrics
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'routing' ? styles.active : ''}`}
              onClick={() => setActiveTab('routing')}
            >
              🛣 Routing Patterns
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'quality' ? styles.active : ''}`}
              onClick={() => setActiveTab('quality')}
            >
              ✓ Quality Metrics
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'recommendations' ? styles.active : ''}`}
              onClick={() => setActiveTab('recommendations')}
            >
              💡 Recommendations
            </button>
          </div>

          <div className={styles.content}>
            {activeTab === 'overview' && (
              <>
                <Card>
                  <h3>Baseline Performance</h3>
                  <div className={styles.metrics}>
                    <div className={styles.metric}>
                      <span>Total Return</span>
                      <strong>{report.baseline.totalReturn.toFixed(1)}%</strong>
                    </div>
                    <div className={styles.metric}>
                      <span>Sharpe Ratio</span>
                      <strong>{report.baseline.sharpeRatio.toFixed(2)}</strong>
                    </div>
                    <div className={styles.metric}>
                      <span>Max Drawdown</span>
                      <strong>{(report.baseline.maxDrawdown * 100).toFixed(1)}%</strong>
                    </div>
                    <div className={styles.metric}>
                      <span>Win Rate</span>
                      <strong>{(report.baseline.winRate * 100).toFixed(0)}%</strong>
                    </div>
                    <div className={styles.metric}>
                      <span>Total Trades</span>
                      <strong>{report.baseline.totalTrades}</strong>
                    </div>
                  </div>
                </Card>

                <Card>
                  <h3>Clustering Configuration</h3>
                  <div className={styles.metrics}>
                    <div className={styles.metric}>
                      <span>Total Clusters</span>
                      <strong>{report.clustering.totalClusters}</strong>
                    </div>
                    <div className={styles.metric}>
                      <span>Total Agents</span>
                      <strong>{report.clustering.totalAgents}</strong>
                    </div>
                    <div className={styles.metric}>
                      <span>Agents per Cluster</span>
                      <strong>{report.clustering.agentsPerCluster.toFixed(1)}</strong>
                    </div>
                  </div>
                </Card>

                {comparison && (
                  <Card>
                    <h3>Specialist vs General Routing</h3>
                    <div className={styles.comparison}>
                      <div className={styles.comparisonCol}>
                        <h4>Specialist Routing</h4>
                        <div className={styles.metrics}>
                          <div className={styles.metric}>
                            <span>Return</span>
                            <strong>{comparison.specialist.metrics.returnImprovement.toFixed(1)}%</strong>
                          </div>
                          <div className={styles.metric}>
                            <span>Sharpe</span>
                            <strong>{comparison.specialist.metrics.sharpeImprovement.toFixed(1)}%</strong>
                          </div>
                          <div className={styles.metric}>
                            <span>Trades</span>
                            <strong>{comparison.specialist.tradesHandled}</strong>
                          </div>
                        </div>
                      </div>
                      <div className={styles.comparisonCol}>
                        <h4>General Routing</h4>
                        <div className={styles.metrics}>
                          <div className={styles.metric}>
                            <span>Return</span>
                            <strong>{comparison.general.metrics.returnImprovement.toFixed(1)}%</strong>
                          </div>
                          <div className={styles.metric}>
                            <span>Sharpe</span>
                            <strong>{comparison.general.metrics.sharpeImprovement.toFixed(1)}%</strong>
                          </div>
                          <div className={styles.metric}>
                            <span>Trades</span>
                            <strong>{comparison.general.tradesHandled}</strong>
                          </div>
                        </div>
                      </div>
                      <div className={styles.comparisonCol}>
                        <h4>Recommendation</h4>
                        <div className={`${styles.recommendation} ${styles[comparison.comparison.recommendation.replace(/ /g, '').toLowerCase()]}`}>
                          {comparison.comparison.recommendation}
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
              </>
            )}

            {activeTab === 'metrics' && (
              <>
                <Card>
                  <h3>Impact Metrics</h3>
                  <div className={styles.impactGrid}>
                    <div className={styles.impactCard}>
                      <div className={styles.impactValue}>{report.impact.returnImprovement.toFixed(1)}%</div>
                      <div className={styles.impactLabel}>Return Improvement</div>
                    </div>
                    <div className={styles.impactCard}>
                      <div className={styles.impactValue}>{report.impact.sharpeImprovement.toFixed(1)}%</div>
                      <div className={styles.impactLabel}>Sharpe Improvement</div>
                    </div>
                    <div className={styles.impactCard}>
                      <div className={styles.impactValue}>{report.impact.drawdownReduction.toFixed(1)}%</div>
                      <div className={styles.impactLabel}>Drawdown Reduction</div>
                    </div>
                    <div className={styles.impactCard}>
                      <div className={styles.impactValue}>{report.impact.winRateImprovement.toFixed(1)}%</div>
                      <div className={styles.impactLabel}>Win Rate Improvement</div>
                    </div>
                    <div className={styles.impactCard}>
                      <div className={styles.impactValue}>{(report.impact.routingAccuracy * 100).toFixed(0)}%</div>
                      <div className={styles.impactLabel}>Routing Accuracy</div>
                    </div>
                    <div className={styles.impactCard}>
                      <div className={styles.impactValue}>{(report.impact.clusterUtilization * 100).toFixed(0)}%</div>
                      <div className={styles.impactLabel}>Cluster Utilization</div>
                    </div>
                    <div className={styles.impactCard}>
                      <div className={styles.impactValue}>{(report.impact.specialistEfficacy * 100).toFixed(0)}%</div>
                      <div className={styles.impactLabel}>Specialist Efficacy</div>
                    </div>
                  </div>
                </Card>
                <Card>
                  <h3>Specialist Performance</h3>
                    <div className={styles.table}>
                    <div className={styles.tableHeader}>
                      <div>Specialization</div>
                      <div>Win Rate</div>
                      <div>Avg Return</div>
                      <div>Effectiveness</div>
                      <div>Utilization</div>
                    </div>
                    {report.specialistPerformance.map((spec) => (
                      <div key={spec.specialization} className={styles.tableRow}>
                        <div className={styles.specialization}>{spec.specialization}</div>
                        <div>{(spec.winRate * 100).toFixed(0)}%</div>
                        <div>{spec.returnPercentage.toFixed(2)}%</div>
                        <div>{(spec.effectiveness * 100).toFixed(0)}%</div>
                        <div>{(spec.utilizationRate * 100).toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            )}

            {activeTab === 'routing' && (
              <Card>
                <h3>Routing Patterns by Market Regime</h3>
                <div className={styles.table}>
                  <div className={styles.tableHeader}>
                    <div>Market Regime</div>
                    <div>Optimal Specialist</div>
                    <div>Routing Confidence</div>
                    <div>Signal Volume</div>
                  </div>
                  {report.routingPatterns.map((pattern) => (
                    <div key={`${pattern.regime}-${pattern.specialist}`} className={styles.tableRow}>
                      <div className={styles.regime}>{pattern.regime}</div>
                      <div>{pattern.specialist}</div>
                      <div>
                        <div className={styles.confidenceBar}>
                          <div
                            className={styles.confidenceFill}
                            style={{ width: `${pattern.confidence * 100}%` }}
                          />
                          <span>{(pattern.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                      <div>{pattern.volume}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {activeTab === 'quality' && (
              <Card>
                <h3>Cluster Quality Assessment</h3>
                <div className={styles.qualityGrid}>
                  <div className={styles.qualityCard}>
                    <div className={styles.qualityLabel}>Cohesion</div>
                    <div className={styles.qualityScore}>
                      <div className={styles.scoreBar}>
                        <div
                          className={styles.scoreFill}
                          style={{ width: `${report.clusterQuality.cohesion * 100}%` }}
                        />
                      </div>
                      <div className={styles.scoreValue}>
                        {report.clusterQuality.cohesion.toFixed(2)}
                      </div>
                    </div>
                    <div className={styles.scoreDescription}>
                      How well agents within clusters align
                    </div>
                  </div>

                  <div className={styles.qualityCard}>
                    <div className={styles.qualityLabel}>Separation</div>
                    <div className={styles.qualityScore}>
                      <div className={styles.scoreBar}>
                        <div
                          className={styles.scoreFill}
                          style={{ width: `${report.clusterQuality.separation * 100}%` }}
                        />
                      </div>
                      <div className={styles.scoreValue}>
                        {report.clusterQuality.separation.toFixed(2)}
                      </div>
                    </div>
                    <div className={styles.scoreDescription}>
                      How different clusters are from each other
                    </div>
                  </div>

                  <div className={styles.qualityCard}>
                    <div className={styles.qualityLabel}>Stability</div>
                    <div className={styles.qualityScore}>
                      <div className={styles.scoreBar}>
                        <div
                          className={styles.scoreFill}
                          style={{ width: `${report.clusterQuality.stability * 100}%` }}
                        />
                      </div>
                      <div className={styles.scoreValue}>
                        {report.clusterQuality.stability.toFixed(2)}
                      </div>
                    </div>
                    <div className={styles.scoreDescription}>
                      Consistency of cluster performance over time
                    </div>
                  </div>

                  <div className={styles.qualityCard}>
                    <div className={styles.qualityLabel}>Overall</div>
                    <div className={styles.qualityScore}>
                      <div className={styles.scoreBar}>
                        <div
                          className={styles.scoreFill}
                          style={{ width: `${report.clusterQuality.overall * 100}%` }}
                        />
                      </div>
                      <div className={styles.scoreValue}>
                        {report.clusterQuality.overall.toFixed(2)}
                      </div>
                    </div>
                    <div className={styles.scoreDescription}>
                      Composite quality metric (0-1)
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'recommendations' && (
              <div>
                {report.recommendations.map((rec, idx) => (
                  <Card key={idx}>
                    <h3>{rec.category}</h3>
                    <div className={styles.recommendation}>
                      <p className={styles.suggestion}>{rec.suggestion}</p>
                      <p className={styles.benefit}>Expected Benefit: {rec.expectedBenefit}</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      {agents.length > 0 && (
        <Card>
          <h3>Agent Profiles ({agents.length} agents)</h3>
          <div className={styles.agentGrid}>
            {agents.map((agent) => (
              <div key={agent.id} className={styles.agentCard}>
                <h4>{agent.name}</h4>
                <div className={styles.agentBadge}>{agent.specialization}</div>
                <div className={styles.agentMetrics}>
                  <div>Win Rate: {agent.winRate}</div>
                  <div>Success: {agent.successRate}</div>
                  <div>Avg Return: {agent.avgReturn}</div>
                  <div>Confidence: {agent.confidence}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default AgentClusteringPanel;
