import { useState, useEffect } from 'react';
import { LineChartCore, BarChartCore } from './charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartDataPoint } from '@/types/chart';
import { Bar } from 'recharts';

interface BasicChartProps {
  symbol: string;
  data: ChartDataPoint[];
  height?: number;
  showVolume?: boolean;
  showMA?: boolean;
  chartType?: 'line' | 'bar';
}

export function BasicChart({ 
  symbol, 
  data, 
  height = 400, 
  showVolume = true,
  showMA = true,
  chartType = 'line'
}: BasicChartProps) {
  // normalize incoming ChartDataPoint to the small-chart shape
  const normalized = data.map(d => ({ time: new Date(d.timestamp).toISOString(), price: d.close, volume: d.volume, ma20: d.ema ?? undefined, ma50: undefined }));
  const [filteredData, setFilteredData] = useState<any[]>(normalized);

  useEffect(() => {
    setFilteredData(data.map((d: ChartDataPoint) => ({ time: new Date(d.timestamp).toISOString(), price: d.close, volume: d.volume, ma20: d.ema ?? undefined, ma50: undefined })));
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{symbol} - No Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No chart data available for {symbol}
          </div>
        </CardContent>
      </Card>
    );
  }

  const minPrice = Math.min(...data.map(d => d.close));
  const maxPrice = Math.max(...data.map(d => d.close));
  const priceRange = maxPrice - minPrice;
  const yAxisDomain = [
    Math.max(0, minPrice - priceRange * 0.1),
    maxPrice + priceRange * 0.1
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{symbol} Price Chart</CardTitle>
      </CardHeader>
      <CardContent>
        {chartType === 'line' ? (
          <LineChartCore
            data={filteredData}
            height={height}
            lines={[
              { key: 'price', color: '#3b82f6', name: `${symbol} Price` },
              ...(showMA ? [
                { key: 'ma20', color: '#10b981', name: 'MA20' },
                { key: 'ma50', color: '#f59e0b', name: 'MA50' }
              ] : [])
            ]}
            yDomain={yAxisDomain}
          />
        ) : (
          <BarChartCore
            data={filteredData}
            height={height}
          >
            {/* children will be rendered by BarChartCoreImpl via `children` prop */}
            <>
              <Bar dataKey="price" fill="#3b82f6" name={`${symbol} Price`} isAnimationActive={false} />
              {showVolume && (
                <Bar dataKey="volume" fill="#8b5cf6" name="Volume" isAnimationActive={false} opacity={0.5} />
              )}
            </>
          </BarChartCore>
        )}
      </CardContent>
    </Card>
  );
}
