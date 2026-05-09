/**
 * ML Consensus Widget
 * 
 * Displays multi-timeframe ML predictions with consensus direction,
 * confidence breakdown by timeframe, and alignment with scanner signals.
 * 
 * Features:
 * - Real-time consensus direction (BULLISH/BEARISH/NEUTRAL)
 * - Confidence by timeframe with visual indicators
 * - Alignment check with scanner signal
 * - Risk assessment visualization
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';

interface TimeframeConfidence {
  timeframe: string;
  direction: string;
  confidence: number;
  strength: number;
  probability: number;
  riskScore: number;
  volatility: number;
  weight: number;
}

interface MLConsensusData {
  symbol: string;
  timestamp: number;
  consensus: {
    direction: string;
    confidence: number;
    strength: number;
    timeframesAgree: number;
    totalTimeframes: number;
  };
  timeframes: TimeframeConfidence[];
  aggregatedMetrics: {
    avgRiskScore: number;
    maxVolatility: number;
    shortestRegimeDuration: string;
    velocityConfidenceAvg: number;
  };
}

interface MLConsensusWidgetProps {
  symbol: string;
  scannerDirection?: string;
  onAlignmentChange?: (aligned: boolean, confidence: number) => void;
}

/**
 * Color coding for directions
 */
const getDirectionColor = (direction: string): string => {
  switch (direction) {
    case 'BULLISH':
      return '#10b981'; // green
    case 'BEARISH':
      return '#ef4444'; // red
    case 'NEUTRAL':
      return '#f59e0b'; // amber
    default:
      return '#6b7280'; // gray
  }
};

/**
 * Risk level classification
 */
const getRiskLevel = (score: number): { level: string; color: string } => {
  if (score < 30) return { level: 'LOW', color: '#10b981' };
  if (score < 50) return { level: 'MODERATE', color: '#f59e0b' };
  if (score < 70) return { level: 'HIGH', color: '#f97316' };
  return { level: 'CRITICAL', color: '#ef4444' };
};

export const MLConsensusWidget: React.FC<MLConsensusWidgetProps> = ({
  symbol,
  scannerDirection,
  onAlignmentChange,
}) => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const navigate = useNavigate();

  // Fetch ML predictions
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ml-consensus', symbol],
    queryFn: () =>
      fetch(`/api/ml/mtf/predictions/${symbol}`)
        .then(r => {
          if (!r.ok) throw new Error('Failed to fetch predictions');
          return r.json();
        })
        .catch(err => {
          console.error('ML consensus fetch error:', err);
          return null;
        }),
    refetchInterval: autoRefresh ? 60000 : false, // 60 seconds
    enabled: !!symbol,
  });

  // Auto-refresh on mount
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        refetch();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refetch]);

  // Check alignment with scanner signal
  useEffect(() => {
    if (data && scannerDirection && onAlignmentChange) {
      const aligned = data.consensus.direction.includes(scannerDirection.toUpperCase());
      onAlignmentChange(aligned, data.consensus.confidence);
    }
  }, [data, scannerDirection, onAlignmentChange]);

  if (isLoading) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-300 rounded"></div>
            <div className="h-3 bg-gray-300 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-50 rounded-lg border border-red-200">
        <p className="text-red-700 font-semibold">ML predictions unavailable</p>
        <p className="text-red-600 text-sm mt-1">No trained model for {symbol}</p>
      </div>
    );
  }

  const consensus = data.consensus;
  const metrics = data.aggregatedMetrics;
  const directionColor = getDirectionColor(consensus.direction);
  const riskLevel = getRiskLevel(metrics.avgRiskScore);

  // Prepare timeframe data for chart
  const timeframeChartData = data.timeframes.map((tf: TimeframeConfidence) => ({
    timeframe: tf.timeframe,
    confidence: tf.confidence * 100,
    strength: tf.strength,
    riskScore: tf.riskScore,
  }));

  // Consensus alignment with scanner
  const isAligned = scannerDirection && consensus.direction.includes(scannerDirection.toUpperCase());

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg border border-gray-200 shadow-lg">
      {/* Header with consensus direction */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-800">ML Consensus</h3>
          <p className="text-sm text-gray-500 mt-1">{symbol}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/scout-report/${symbol}`)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
            title="View detailed Scout Report for this symbol"
          >
            <span>📊</span>
            View Scout Report
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              autoRefresh
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {autoRefresh ? '🔄 Live' : '⏸ Manual'}
          </button>
        </div>
      </div>

      {/* Main consensus display */}
      <div className="grid grid-cols-4 gap-4">
        {/* Direction */}
        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
          <p className="text-xs text-gray-600 font-semibold uppercase mb-2">Direction</p>
          <div style={{ color: directionColor }} className="text-2xl font-bold">
            {consensus.direction}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {consensus.timeframesAgree}/{consensus.totalTimeframes} timeframes agree
          </p>
        </div>

        {/* Confidence */}
        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
          <p className="text-xs text-gray-600 font-semibold uppercase mb-2">Confidence</p>
          <div className="text-2xl font-bold text-blue-600">
            {(consensus.confidence * 100).toFixed(0)}%
          </div>
          <div className="mt-2 bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all"
              style={{ width: `${consensus.confidence * 100}%` }}
            />
          </div>
        </div>

        {/* Strength */}
        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
          <p className="text-xs text-gray-600 font-semibold uppercase mb-2">Strength</p>
          <div className="text-2xl font-bold" style={{ color: directionColor }}>
            {consensus.strength.toFixed(1)}
          </div>
          <p className="text-xs text-gray-500 mt-2">0-100 scale</p>
        </div>

        {/* Avg Risk */}
        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
          <p className="text-xs text-gray-600 font-semibold uppercase mb-2">Risk</p>
          <div style={{ color: riskLevel.color }} className="text-2xl font-bold">
            {metrics.avgRiskScore.toFixed(0)}
          </div>
          <p className="text-xs font-medium mt-2" style={{ color: riskLevel.color }}>
            {riskLevel.level}
          </p>
        </div>
      </div>

      {/* Scanner alignment indicator */}
      {scannerDirection && (
        <div
          className={`p-4 rounded-lg border-2 flex items-center justify-between ${
            isAligned
              ? 'bg-green-50 border-green-300'
              : 'bg-orange-50 border-orange-300'
          }`}
        >
          <div>
            <p className="font-semibold" style={{ color: isAligned ? '#10b981' : '#f97316' }}>
              {isAligned ? '✓ Aligned with Scanner' : '⚠ Conflicting with Scanner'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Scanner: {scannerDirection} | ML: {consensus.direction}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold" style={{ color: isAligned ? '#10b981' : '#f97316' }}>
              {isAligned ? 'STRONG' : 'CAUTION'}
            </p>
          </div>
        </div>
      )}

      {/* Confidence by timeframe chart */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-700">Confidence by Timeframe</h4>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={timeframeChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="timeframe" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
              formatter={(value: any) => value.toFixed(1)}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="confidence" fill="#3b82f6" name="Confidence %" />
            <Bar yAxisId="right" dataKey="riskScore" fill="#f59e0b" name="Risk Score" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Timeframe details table */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-700">Timeframe Details</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-3 py-2 font-semibold text-gray-700">TF</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-700">Direction</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-700">Conf.</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-700">Risk</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-700">Vol.</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-700">Weight</th>
              </tr>
            </thead>
            <tbody>
              {data.timeframes.map((tf: TimeframeConfidence) => (
                <tr key={tf.timeframe} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800">{tf.timeframe}</td>
                  <td className="px-3 py-2">
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: getDirectionColor(tf.direction) + '20',
                        color: getDirectionColor(tf.direction),
                      }}
                    >
                      {tf.direction}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700 font-medium">
                    {(tf.confidence * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span style={{ color: getRiskLevel(tf.riskScore).color }} className="font-medium">
                      {tf.riskScore.toFixed(0)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">
                    {(tf.volatility * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700 font-medium">
                    {(tf.weight * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Aggregated metrics */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div>
          <p className="text-xs text-gray-600 font-semibold uppercase mb-1">Max Volatility</p>
          <p className="text-lg font-bold text-gray-800">{(metrics.maxVolatility * 100).toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 font-semibold uppercase mb-1">Regime Duration</p>
          <p className="text-lg font-bold text-gray-800">{metrics.shortestRegimeDuration}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 font-semibold uppercase mb-1">Velocity Confidence</p>
          <p className="text-lg font-bold text-gray-800">{(metrics.velocityConfidenceAvg * 100).toFixed(0)}%</p>
        </div>
      </div>

      {/* Refresh indicator */}
      <p className="text-xs text-gray-500 text-center">
        Last updated: {new Date(data.timestamp).toLocaleTimeString()}
      </p>
    </div>
  );
};

export default MLConsensusWidget;
