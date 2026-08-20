import React from 'react';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from 'recharts';

interface AreaChartCoreProps {
  data: Record<string, unknown>[];
  dataKey: string;
  height?: number;
  gradientId?: string;
  stroke?: string;
  fill?: string;
  yFormatter?: (v: number) => string;
  xFormatter?: (v: string | number) => string;
  children?: React.ReactNode;
  xDataKey?: string;
  hideXAxis?: boolean;
  hideYAxis?: boolean;
  yDomain?: [number | 'auto', number | 'auto'];
  referenceLines?: Array<Record<string, unknown>>;
}

export default function AreaChartCoreImpl({
  data,
  dataKey,
  height = 200,
  gradientId = 'areaGradient',
  stroke = '#3b82f6',
  fill = '#3b82f6',
  yFormatter,
  xFormatter,
  children,
  xDataKey = 'timestamp',
  hideXAxis,
  hideYAxis,
  yDomain,
  referenceLines,
}: AreaChartCoreProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={fill} stopOpacity={0.8} />
            <stop offset="95%" stopColor={fill} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey={xDataKey} stroke="#94a3b8" tickFormatter={xFormatter} hide={hideXAxis} />
        <YAxis stroke="#94a3b8" tickFormatter={yFormatter} hide={hideYAxis} domain={yDomain} />
        <Tooltip />
        <Area type="monotone" dataKey={dataKey} stroke={stroke} fill={`url(#${gradientId})`} />
        {referenceLines && referenceLines.map((r, i) => (
          <ReferenceLine key={i} {...r} />
        ))}
        {children}
      </AreaChart>
    </ResponsiveContainer>
  );
}
