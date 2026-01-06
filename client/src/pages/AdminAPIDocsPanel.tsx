import React, { useState, useEffect } from 'react';
import './AdminAPIDocsPanel.css';

interface EndpointStats {
  method: string;
  path: string;
  requests: number;
  uptime: number;
  avgLatency: number;
}

interface PerformanceData {
  slowEndpoints: Array<{
    method: string;
    path: string;
    avgLatencyMs: number;
    maxLatencyMs: number;
    requestCount: number;
  }>;
  unhealthyEndpoints: Array<{
    method: string;
    path: string;
    errorRate: number;
    failedRequests: number;
    totalRequests: number;
    lastError?: string;
  }>;
}

interface HealthData {
  overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
}

interface StatsData {
  summary: {
    totalEndpoints: number;
    activeEndpoints: number;
    deprecatedEndpoints: number;
    totalRequests: number;
    errorRate: number;
    totalErrors: number;
    avgLatency: number;
    avgUptime: number;
  };
  topEndpoints: EndpointStats[];
}

const AdminAPIDocsPanel: React.FC = () => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [perf, setPerf] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  const loadDashboard = async () => {
    try {
      const [statsRes, healthRes, perfRes] = await Promise.all([
        fetch('/api/docs/stats').then(r => r.json()),
        fetch('/api/docs/health').then(r => r.json()),
        fetch('/api/docs/performance?hours=1').then(r => r.json()),
      ]);

      setStats(statsRes);
      setHealth(healthRes);
      setPerf(perfRes);
      setLoading(false);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="admin-api-docs-panel">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading API Dashboard...</p>
        </div>
      </div>
    );
  }

  const s = stats?.summary;
  const h = health?.overallHealth || 'UNKNOWN';

  return (
    <div className="admin-api-docs-panel">
      <header className="dashboard-header">
        <h1>📊 API Documentation Dashboard</h1>
        <p className="subtitle">Real-time monitoring of all API endpoints</p>
        <p className="refresh-time">Last updated: {lastRefresh}</p>
      </header>

      {/* Alerts */}
      <div className="alerts-container">
        {h === 'CRITICAL' && (
          <div className="alert alert-error">🚨 API Health is CRITICAL</div>
        )}
        {h === 'DEGRADED' && (
          <div className="alert alert-warning">⚠️ API Health is DEGRADED</div>
        )}
        {perf && perf.slowEndpoints.length > 0 && (
          <div className="alert alert-warning">
            ⚠️ {perf.slowEndpoints.length} slow endpoints detected
          </div>
        )}
        {perf && perf.unhealthyEndpoints.length > 0 && (
          <div className="alert alert-error">
            🔴 {perf.unhealthyEndpoints.length} endpoints have high error rates
          </div>
        )}
        {h === 'HEALTHY' && (!perf || (perf.slowEndpoints.length === 0 && perf.unhealthyEndpoints.length === 0)) && (
          <div className="alert alert-success">
            ✓ No critical issues detected
          </div>
        )}
      </div>

      {/* Overview Cards */}
      <div className="dashboard-grid">
        <div className="card">
          <div className="card-title">Total Endpoints</div>
          <div className="card-value">{s?.totalEndpoints || '-'}</div>
          <div className="card-subtitle">
            {s?.activeEndpoints || 0} active, {s?.deprecatedEndpoints || 0} deprecated
          </div>
        </div>

        <div className="card">
          <div className="card-title">Total Requests</div>
          <div className="card-value">{(s?.totalRequests || 0).toLocaleString()}</div>
          <div className="card-subtitle">
            {s ? Math.round(s.totalRequests / 24).toLocaleString() : 0} per hour
          </div>
        </div>

        <div className="card">
          <div className="card-title">Error Rate</div>
          <div className="card-value">{(s?.errorRate || 0).toFixed(2)}%</div>
          <div className="card-subtitle">{(s?.totalErrors || 0).toLocaleString()} failures</div>
        </div>

        <div className="card">
          <div className="card-title">Average Latency</div>
          <div className="card-value">{Math.round(s?.avgLatency || 0)}</div>
          <div className="card-subtitle">milliseconds</div>
        </div>

        <div className="card">
          <div className="card-title">API Health</div>
          <div className="card-value">{h}</div>
          <div className={`status-badge status-${h.toLowerCase()}`}>{h}</div>
        </div>

        <div className="card">
          <div className="card-title">Uptime</div>
          <div className="card-value">{(s?.avgUptime || 0).toFixed(2)}%</div>
          <div className="card-subtitle">overall average</div>
        </div>
      </div>

      {/* Top Endpoints */}
      <div className="section">
        <h2 className="section-title">🔥 Top Endpoints by Traffic</h2>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Requests</th>
                <th>Uptime</th>
                <th>Avg Latency</th>
                <th>Health</th>
              </tr>
            </thead>
            <tbody>
              {stats?.topEndpoints.map((ep, idx) => (
                <tr key={idx}>
                  <td>
                    <span className="endpoint-path">
                      {ep.method} {ep.path}
                    </span>
                  </td>
                  <td>{ep.requests.toLocaleString()}</td>
                  <td>{ep.uptime.toFixed(1)}%</td>
                  <td>{Math.round(ep.avgLatency)}ms</td>
                  <td>
                    <span
                      className={`status-badge status-${
                        ep.uptime > 99 ? 'excellent' : ep.uptime > 95 ? 'good' : 'poor'
                      }`}
                    >
                      {ep.uptime > 99 ? 'EXCELLENT' : ep.uptime > 95 ? 'GOOD' : 'POOR'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slow Endpoints */}
      <div className="section">
        <h2 className="section-title">🐢 Slow Endpoints (&gt;1000ms)</h2>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Avg Latency</th>
                <th>Max Latency</th>
                <th>Requests</th>
              </tr>
            </thead>
            <tbody>
              {perf && perf.slowEndpoints.length > 0 ? (
                perf.slowEndpoints.map((ep, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className="endpoint-path">
                        {ep.method} {ep.path}
                      </span>
                    </td>
                    <td>
                      <strong>{ep.avgLatencyMs.toFixed(0)}ms</strong>
                    </td>
                    <td>{ep.maxLatencyMs.toFixed(0)}ms</td>
                    <td>{ep.requestCount.toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="empty-state">
                    ✓ No slow endpoints detected
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unhealthy Endpoints */}
      <div className="section">
        <h2 className="section-title">🔴 Unhealthy Endpoints</h2>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Error Rate</th>
                <th>Failed / Total</th>
                <th>Last Error</th>
              </tr>
            </thead>
            <tbody>
              {perf && perf.unhealthyEndpoints.length > 0 ? (
                perf.unhealthyEndpoints.map((ep, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className="endpoint-path">
                        {ep.method} {ep.path}
                      </span>
                    </td>
                    <td>
                      <strong>{ep.errorRate}%</strong>
                    </td>
                    <td>
                      {ep.failedRequests} / {ep.totalRequests}
                    </td>
                    <td className="error-text">{ep.lastError || 'N/A'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="empty-state">
                    ✓ All endpoints healthy
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminAPIDocsPanel;
