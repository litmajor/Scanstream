import React from 'react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Cell } from 'recharts';

export interface BarSeries {
  dataKey: string;
  stackId?: string | number;
  fill?: string;
  radius?: number | [number, number, number, number];
}

interface BarChartCoreProps {
  data: Record<string, unknown>[];
  dataKey: string;
  layout?: 'vertical' | 'horizontal';
  height?: number;
  children?: React.ReactNode;
  barSeries?: BarSeries[];
  cellColors?: string[];
  barProps?: Record<string, unknown>;
  xAxisProps?: Record<string, unknown>;
  yAxisProps?: Record<string, unknown>;
  gridProps?: Record<string, unknown>;
  tooltipProps?: Record<string, unknown>;
  legendProps?: Record<string, unknown>;
}

export default function BarChartCoreImpl({
  data,
  dataKey,
  layout = 'horizontal',
  height = 200,
  children,
  barSeries,
  cellColors,
  barProps,
  xAxisProps,
  yAxisProps,
  gridProps,
  tooltipProps,
  legendProps,
}: BarChartCoreProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout={layout}>
        <CartesianGrid {...(gridProps || { strokeDasharray: '3 3', stroke: '#334155' })} />
        <XAxis {...(xAxisProps || { dataKey: layout === 'vertical' ? undefined : 'timestamp', stroke: '#94a3b8' })} />
        <YAxis {...(yAxisProps || { stroke: '#94a3b8' })} />
        <Tooltip {...(tooltipProps || {})} />
        <Legend {...(legendProps || {})} />
        {children ?? (
          barSeries && barSeries.length > 0
            ? barSeries.map((series) => <Bar key={series.dataKey} {...series} />)
            : (
              <Bar dataKey={dataKey} fill="#3b82f6" {...barProps}>
                {cellColors && cellColors.length > 0 && cellColors.map((c, i) => <Cell key={i} fill={c} />)}
              </Bar>
            )
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
