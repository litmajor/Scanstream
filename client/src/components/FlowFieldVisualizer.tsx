/**
 * Flow Field Visualizer Component
 * 
 * D3.js-based visualization of market flow fields
 * Shows force vectors, pressure heatmap, and turbulence indicators
 */

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, TrendingDown, Wind } from 'lucide-react';

interface FlowFieldVector {
  timestamp: number;
  fx: number;
  fy: number;
  magnitude: number;
  angle: number;
}

interface FlowFieldData {
  latestForce: number;
  averageForce: number;
  maxForce: number;
  forceDirection: number;
  pressure: number;
  averagePressure: number;
  pressureTrend: 'rising' | 'falling' | 'stable';
  turbulence: number;
  turbulenceLevel: 'low' | 'medium' | 'high' | 'extreme';
  energyGradient: number;
  energyTrend: 'accelerating' | 'decelerating' | 'stable';
  forceVectors: FlowFieldVector[];
  dominantDirection: 'bullish' | 'bearish' | 'neutral';
}

interface FlowFieldVisualizerProps {
  data: FlowFieldData;
  symbol: string;
  width?: number;
  height?: number;
}

export default function FlowFieldVisualizer({
  data,
  symbol,
  width = 800,
  height = 500
}: FlowFieldVisualizerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredVector, setHoveredVector] = useState<FlowFieldVector | null>(null);

  useEffect(() => {
    if (!svgRef.current || !data || data.forceVectors.length === 0) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();

    const margin = { top: 40, right: 40, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const timestamps = data.forceVectors.map(v => v.timestamp);
    const xScale = d3.scaleTime()
      .domain([Math.min(...timestamps), Math.max(...timestamps)])
      .range([0, innerWidth]);

    const magnitudes = data.forceVectors.map(v => v.magnitude);
    const yScale = d3.scaleLinear()
      .domain([0, Math.max(...magnitudes) * 1.2])
      .range([innerHeight, 0]);

    // Color scale for force magnitude
    const colorScale = d3.scaleSequential(d3.interpolateRdYlGn)
      .domain([Math.max(...magnitudes), 0]);

    // Pressure background gradient
    const pressureGradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'pressure-gradient')
      .attr('x1', '0%')
      .attr('x2', '100%')
      .attr('y1', '0%')
      .attr('y2', '0%');

    pressureGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#dbeafe')
      .attr('stop-opacity', 0.3);

    pressureGradient.append('stop')
      .attr('offset', `${(data.pressure / data.maxForce) * 100}%`)
      .attr('stop-color', data.pressureTrend === 'rising' ? '#fca5a5' : '#86efac')
      .attr('stop-opacity', 0.5);

    pressureGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#dbeafe')
      .attr('stop-opacity', 0.3);

    // Background pressure rect
    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'url(#pressure-gradient)')
      .attr('rx', 8);

    // Grid lines
    const xAxis = d3.axisBottom(xScale).ticks(6);
    const yAxis = d3.axisLeft(yScale).ticks(5);

    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll('line')
      .attr('stroke', '#94a3b8')
      .attr('stroke-opacity', 0.2);

    g.append('g')
      .attr('class', 'grid')
      .call(yAxis)
      .selectAll('line')
      .attr('stroke', '#94a3b8')
      .attr('stroke-opacity', 0.2);

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', '#64748b')
      .attr('font-size', '12px');

    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .attr('fill', '#64748b')
      .attr('font-size', '12px');

    // Axis labels
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 45)
      .attr('text-anchor', 'middle')
      .attr('fill', '#475569')
      .attr('font-size', '14px')
      .text('Time');

    g.append('text')
      .attr('x', -innerHeight / 2)
      .attr('y', -45)
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('fill', '#475569')
      .attr('font-size', '14px')
      .text('Force Magnitude');

    // Force vectors as arrows
    const arrowSize = 15;
    const vectorGroup = g.append('g').attr('class', 'vectors');

    data.forceVectors.forEach((vector, i) => {
      const x = xScale(vector.timestamp);
      const y = yScale(vector.magnitude);
      
      // Arrow direction
      const arrowAngle = vector.angle;
      const arrowLength = Math.min(vector.magnitude * 500, arrowSize);
      
      const dx = Math.cos(arrowAngle) * arrowLength;
      const dy = -Math.sin(arrowAngle) * arrowLength; // Negative because SVG y-axis is inverted

      // Arrow line
      vectorGroup.append('line')
        .attr('x1', x)
        .attr('y1', y)
        .attr('x2', x + dx)
        .attr('y2', y + dy)
        .attr('stroke', colorScale(vector.magnitude))
        .attr('stroke-width', 2)
        .attr('stroke-linecap', 'round')
        .attr('opacity', 0.7);

      // Arrow head
      const headSize = 4;
      const headAngle = Math.PI / 6; // 30 degrees

      vectorGroup.append('path')
        .attr('d', () => {
          const tipX = x + dx;
          const tipY = y + dy;
          const leftX = tipX - Math.cos(arrowAngle - headAngle) * headSize;
          const leftY = tipY + Math.sin(arrowAngle - headAngle) * headSize;
          const rightX = tipX - Math.cos(arrowAngle + headAngle) * headSize;
          const rightY = tipY + Math.sin(arrowAngle + headAngle) * headSize;
          
          return `M ${tipX} ${tipY} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`;
        })
        .attr('fill', colorScale(vector.magnitude))
        .attr('opacity', 0.7);

      // Interactive circle for hover
      vectorGroup.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 5)
        .attr('fill', colorScale(vector.magnitude))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .attr('cursor', 'pointer')
        .attr('opacity', 0.9)
        .on('mouseenter', () => setHoveredVector(vector))
        .on('mouseleave', () => setHoveredVector(null));
    });

    // Title
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', -15)
      .attr('text-anchor', 'middle')
      .attr('fill', '#1e293b')
      .attr('font-size', '18px')
      .attr('font-weight', 'bold')
      .text(`${symbol} Flow Field`);

  }, [data, width, height, symbol]);

  // Turbulence color
  const turbulenceColor = {
    low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    extreme: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  }[data.turbulenceLevel];

  const directionIcon = data.dominantDirection === 'bullish' ? TrendingUp : 
                        data.dominantDirection === 'bearish' ? TrendingDown : Activity;

  return (
    <div className="space-y-4">
      {/* Metrics Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Force */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Force</span>
            {React.createElement(directionIcon, { className: 'w-4 h-4 text-gray-500' })}
          </div>
          <div className="text-2xl font-bold">
            {(data.latestForce * 100).toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Avg: {(data.averageForce * 100).toFixed(2)}%
          </div>
        </Card>

        {/* Pressure */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Pressure</span>
            <Badge variant={data.pressureTrend === 'rising' ? 'destructive' : 'default'}>
              {data.pressureTrend}
            </Badge>
          </div>
          <div className="text-2xl font-bold">
            {(data.pressure * 100).toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Avg: {(data.averagePressure * 100).toFixed(2)}
          </div>
        </Card>

        {/* Turbulence */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Turbulence</span>
            <Wind className="w-4 h-4 text-gray-500" />
          </div>
          <div className="text-2xl font-bold">
            {(data.turbulence * 10000).toFixed(2)}
          </div>
          <Badge className={`mt-2 ${turbulenceColor}`}>
            {data.turbulenceLevel}
          </Badge>
        </Card>

        {/* Energy */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Energy</span>
            <Badge variant={data.energyTrend === 'accelerating' ? 'default' : 'secondary'}>
              {data.energyTrend}
            </Badge>
          </div>
          <div className="text-2xl font-bold">
            {(data.energyGradient * 1000).toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Direction: {data.dominantDirection}
          </div>
        </Card>
      </div>

      {/* Vector Field Visualization */}
      <Card className="p-6">
        <svg ref={svgRef}></svg>
        
        {/* Hover Info */}
        {hoveredVector && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Time:</span>{' '}
                {new Date(hoveredVector.timestamp).toLocaleTimeString()}
              </div>
              <div>
                <span className="font-medium">Magnitude:</span>{' '}
                {(hoveredVector.magnitude * 100).toFixed(3)}
              </div>
              <div>
                <span className="font-medium">Direction:</span>{' '}
                {(hoveredVector.angle * 180 / Math.PI).toFixed(1)}°
              </div>
              <div>
                <span className="font-medium">Force X:</span>{' '}
                {(hoveredVector.fx * 100).toFixed(3)}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Legend */}
      <Card className="p-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <div className="font-medium mb-2">Vector Field Legend:</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-1 bg-green-500"></div>
              <span>Low Force</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-1 bg-yellow-500"></div>
              <span>Medium Force</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-1 bg-red-500"></div>
              <span>High Force</span>
            </div>
          </div>
          <div className="mt-2 text-xs">
            Arrow direction indicates market force direction. Arrow length shows relative magnitude.
          </div>
        </div>
      </Card>
    </div>
  );
}

