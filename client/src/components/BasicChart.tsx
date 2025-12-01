import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChartDataPoint {
  time: string;
  price: number;
  volume?: number;
  ma20?: number;
  ma50?: number;
}

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
  const [filteredData, setFilteredData] = useState<ChartDataPoint[]>(data);

  useEffect(() => {
    setFilteredData(data);
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

  const minPrice = Math.min(...data.map(d => d.price));
  const maxPrice = Math.max(...data.map(d => d.price));
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
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={yAxisDomain} />
              <Tooltip 
                formatter={(value) => typeof value === 'number' ? value.toFixed(2) : value}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="#3b82f6" 
                dot={false}
                isAnimationActive={false}
                name={`${symbol} Price`}
              />
              {showMA && (
                <>
                  <Line 
                    type="monotone" 
                    dataKey="ma20" 
                    stroke="#10b981" 
                    dot={false}
                    isAnimationActive={false}
                    name="MA20"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ma50" 
                    stroke="#f59e0b" 
                    dot={false}
                    isAnimationActive={false}
                    name="MA50"
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis yAxisId="left" domain={yAxisDomain} />
              {showVolume && <YAxis yAxisId="right" orientation="right" />}
              <Tooltip 
                formatter={(value) => typeof value === 'number' ? value.toFixed(2) : value}
              />
              <Legend />
              <Bar 
                yAxisId="left"
                dataKey="price" 
                fill="#3b82f6" 
                name={`${symbol} Price`}
                isAnimationActive={false}
              />
              {showVolume && (
                <Bar 
                  yAxisId="right"
                  dataKey="volume" 
                  fill="#8b5cf6" 
                  name="Volume"
                  isAnimationActive={false}
                  opacity={0.5}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
