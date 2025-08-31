import React, { useMemo, useState, useCallback, useEffect } from "react";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";

export interface ChartDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  rsi?: number | null;
  macd?: number | null;
  ema?: number | null;
}

interface TradingChartProps {
  data: ChartDataPoint[];
  showVolume?: boolean;
  showRSI?: boolean;
  showMACD?: boolean;
  showEMA?: boolean;
  showPatterns?: boolean;
  timeframe?: string;
  height?: number;
  maxCandles?: number;
  onError?: (error: Error) => void;
}

interface ChartConfig {
  colors: {
    upward: string;
    downward: string;
    ema: string;
    volume: string;
  };
  patterns: {
    enabled: boolean;
    labelColor: string;
    backgroundColor: string;
  };
  performance: {
    maxCandles: number;
    enableAnimations: boolean;
  };
}

// Pattern detection utilities with proper validation
class PatternDetector {
  static isDoji(point: ChartDataPoint): boolean {
    if (!PatternDetector.isValidPoint(point)) return false;
    const bodySize = Math.abs(point.open - point.close);
    const totalRange = point.high - point.low;
    return totalRange > 0 && bodySize <= totalRange * 0.1;
  }

  static isHammer(point: ChartDataPoint, prev: ChartDataPoint | null): boolean {
    if (!prev || !PatternDetector.isValidPoint(point) || !PatternDetector.isValidPoint(prev)) {
      return false;
    }
    
    const body = Math.abs(point.open - point.close);
    const lowerShadow = Math.min(point.open, point.close) - point.low;
    const upperShadow = point.high - Math.max(point.open, point.close);
    
    return (
      lowerShadow > 2 * body &&
      upperShadow < body * 0.5 &&
      point.close < prev.close &&
      body > 0
    );
  }

  static isBullishEngulfing(point: ChartDataPoint, prev: ChartDataPoint | null): boolean {
    if (!prev || !PatternDetector.isValidPoint(point) || !PatternDetector.isValidPoint(prev)) {
      return false;
    }
    
    return (
      prev.close < prev.open && // Previous candle is bearish
      point.close > point.open && // Current candle is bullish
      point.open < prev.close && // Opens below previous close
      point.close > prev.open // Closes above previous open
    );
  }

  static isBearishEngulfing(point: ChartDataPoint, prev: ChartDataPoint | null): boolean {
    if (!prev || !PatternDetector.isValidPoint(point) || !PatternDetector.isValidPoint(prev)) {
      return false;
    }
    
    return (
      prev.close > prev.open && // Previous candle is bullish
      point.close < point.open && // Current candle is bearish
      point.open > prev.close && // Opens above previous close
      point.close < prev.open // Closes below previous open
    );
  }

  private static isValidPoint(point: ChartDataPoint): boolean {
    return (
      point &&
      typeof point.timestamp === 'number' &&
      typeof point.open === 'number' &&
      typeof point.high === 'number' &&
      typeof point.low === 'number' &&
      typeof point.close === 'number' &&
      point.high >= point.low &&
      point.high >= Math.max(point.open, point.close) &&
      point.low <= Math.min(point.open, point.close) &&
      !isNaN(point.open) &&
      !isNaN(point.high) &&
      !isNaN(point.low) &&
      !isNaN(point.close)
    );
  }

  static detectPatterns(data: ChartDataPoint[]): Array<{
    x: number;
    y: number;
    marker: { size: number };
    label: {
      borderColor: string;
      style: { color: string; background: string };
      text: string;
      textAnchor: string;
    };
  }> {
    if (!Array.isArray(data) || data.length < 2) return [];

    return data
      .map((point, index) => {
        const prev = index > 0 ? data[index - 1] : null;
        let label = "";

        if (PatternDetector.isDoji(point)) label = "Doji";
        else if (PatternDetector.isHammer(point, prev)) label = "Hammer";
        else if (PatternDetector.isBullishEngulfing(point, prev)) label = "Bull Engulf";
        else if (PatternDetector.isBearishEngulfing(point, prev)) label = "Bear Engulf";

        if (label) {
          return {
            x: point.timestamp,
            y: point.high * 1.02, // Slightly above the high
            marker: { size: 0 },
            label: {
              borderColor: "#775DD0",
              style: { color: "#fff", background: "#775DD0" },
              text: label,
              textAnchor: "middle" as const,
            },
          };
        }
        return null;
      })
      .filter((annotation): annotation is NonNullable<typeof annotation> => annotation !== null);
  }
}

// Custom hook for chart data processing
const useChartData = (
  data: ChartDataPoint[],
  config: ChartConfig,
  showOptions: {
    showVolume: boolean;
    showRSI: boolean;
    showMACD: boolean;
    showEMA: boolean;
    showPatterns: boolean;
  }
) => {
  return useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return {
        series: [],
        annotations: [],
        hasValidData: false,
      };
    }

    // Limit data for performance
    const limitedData = data.slice(-config.performance.maxCandles);

    // Main candlestick series
    const series = [
      {
        name: "Candlestick",
        type: "candlestick",
        data: limitedData.map(d => ({
          x: d.timestamp,
          y: [d.open, d.high, d.low, d.close],
        })),
      },
    ];

    // EMA series
    if (showOptions.showEMA) {
      const emaData = limitedData
        .filter(d => d.ema !== undefined && d.ema !== null && !isNaN(d.ema))
        .map(d => ({ x: d.timestamp, y: [d.ema!] }));
      if (emaData.length > 0) {
        series.push({
          name: "EMA",
          type: "line",
          data: emaData,
        });
      }
    }

    // Volume series
    if (showOptions.showVolume) {
      const volumeData = limitedData
        .filter(d => d.volume !== undefined && d.volume !== null && !isNaN(d.volume))
        .map(d => ({ x: d.timestamp, y: [d.volume!] }));
      if (volumeData.length > 0) {
        series.push({
          name: "Volume",
          type: "column",
          data: volumeData,
        });
      }
    }

    // RSI data
    const rsiData = showOptions.showRSI
      ? limitedData
          .filter(d => d.rsi !== undefined && d.rsi !== null && !isNaN(d.rsi))
          .map(d => ({ x: d.timestamp, y: d.rsi! }))
      : [];

    // MACD data
    const macdData = showOptions.showMACD
      ? limitedData
          .filter(d => d.macd !== undefined && d.macd !== null && !isNaN(d.macd))
          .map(d => ({ x: d.timestamp, y: d.macd! }))
      : [];

    // Pattern annotations
    const annotations = showOptions.showPatterns
      ? PatternDetector.detectPatterns(limitedData)
      : [];

    return {
      series,
      rsiData,
      macdData,
      annotations,
      hasValidData: limitedData.length > 0,
    };
  }, [data, config, showOptions]);
};

// Error Boundary Component
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ChartErrorBoundary extends React.Component<
  React.PropsWithChildren<{ onError?: (error: Error) => void }>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{ onError?: (error: Error) => void }>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('TradingChart Error:', error);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full text-red-500 bg-red-50 rounded-lg border border-red-200">
          <div className="text-center">
            <div className="text-lg font-semibold">Chart Error</div>
            <div className="text-sm mt-1">Unable to render chart</div>
            <button
              className="mt-2 px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
              onClick={() => this.setState({ hasError: false })}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading Component
const ChartLoader: React.FC = () => (
  <div className="flex items-center justify-center h-full">
    <div className="flex items-center space-x-2">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      <span className="text-gray-600">Loading chart...</span>
    </div>
  </div>
);

// Main component
export const TradingChart: React.FC<TradingChartProps> = React.memo(({
  data,
  showVolume = true,
  showRSI = true,
  showMACD = true,
  showEMA = true,
  showPatterns = false,
  timeframe = "1d",
  height = 400,
  maxCandles = 100,
  onError,
}) => {
  const [chartReady, setChartReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Configuration
  const config: ChartConfig = useMemo(() => ({
    colors: {
      upward: "#00B746",
      downward: "#EF403C",
      ema: "#FF6B35",
      volume: "#E0E0E0",
    },
    patterns: {
      enabled: showPatterns,
      labelColor: "#fff",
      backgroundColor: "#775DD0",
    },
    performance: {
      maxCandles,
      enableAnimations: true,
    },
  }), [showPatterns, maxCandles]);

  // Process chart data
  const showOptions = useMemo(() => ({
    showVolume,
    showRSI,
    showMACD,
    showEMA,
    showPatterns,
  }), [showVolume, showRSI, showMACD, showEMA, showPatterns]);

  const {
    series,
    rsiData = [],
    macdData = [],
    annotations,
    hasValidData
  } = useChartData(
    data,
    config,
    showOptions
  );

  // Handle chart ready
  const handleChartMounted = useCallback(() => {
    setChartReady(true);
    setIsLoading(false);
  }, []);

  // Format timestamp based on timeframe
  const formatTimestamp = useCallback((val: number): string => {
    const date = new Date(val);
    switch (timeframe) {
      case "1m":
      case "5m":
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case "1h":
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case "1d":
      case "1w":
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      default:
        return date.toLocaleDateString();
    }
  }, [timeframe]);

  // Set loading timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!chartReady) {
        setIsLoading(false);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [chartReady]);

  // Validation
  if (!data || !Array.isArray(data)) {
    console.warn('TradingChart: Invalid data provided');
    return (
      <div className="flex items-center justify-center h-full text-gray-400 bg-gray-50 rounded-lg">
        Invalid chart data
      </div>
    );
  }

  if (!hasValidData) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 bg-gray-50 rounded-lg">
        No data available
      </div>
    );
  }

  if (isLoading) {
    return <ChartLoader />;
  }

  // Calculate heights
  const hasIndicators = showRSI || showMACD;
  const indicatorCount = (showRSI ? 1 : 0) + (showMACD ? 1 : 0);
  const mainChartHeight = hasIndicators ? height * 0.7 : height;
  const indicatorHeight = hasIndicators ? height * (0.3 / indicatorCount) : 0;

  // Main chart options
  const mainChartOptions: ApexOptions = {
    chart: {
      type: "candlestick",
      height: mainChartHeight,
      events: {
        mounted: handleChartMounted,
      },
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true,
        },
      },
      animations: {
        enabled: config.performance.enableAnimations,
        speed: 300,
      },
    },
    annotations: {
      points: annotations,
    },
    plotOptions: {
      candlestick: {
        colors: {
          upward: config.colors.upward,
          downward: config.colors.downward,
        },
      },
    },
    xaxis: {
      type: "datetime",
      labels: {
        formatter: (value: string, timestamp?: number) => {
          const val = typeof timestamp === 'number' ? timestamp : Number(value);
          return formatTimestamp(val);
        },
      },
    },
    yaxis: [
      {
        title: { text: "Price" },
        labels: { 
          align: "left",
          formatter: (val: number) => val.toFixed(2),
        },
      },
      ...(showVolume ? [{
        opposite: true,
        title: { text: "Volume" },
        labels: { 
          formatter: (val: number) => {
            if (val >= 1e9) return `${(val / 1e9).toFixed(1)}B`;
            if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
            if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
            return val.toString();
          }
        },
      }] : []),
    ],
    tooltip: {
      enabled: true,
      shared: true,
      custom: ({ seriesIndex, dataPointIndex, w }) => {
        const data = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
        if (seriesIndex === 0 && data?.y) { // Candlestick data
          const [open, high, low, close] = data.y;
          return `
            <div class="bg-white p-3 border rounded shadow-lg">
              <div class="font-semibold">${new Date(data.x).toLocaleString()}</div>
              <div class="mt-1 space-y-1 text-sm">
                <div>Open: <span class="font-medium">${open.toFixed(2)}</span></div>
                <div>High: <span class="font-medium">${high.toFixed(2)}</span></div>
                <div>Low: <span class="font-medium">${low.toFixed(2)}</span></div>
                <div>Close: <span class="font-medium">${close.toFixed(2)}</span></div>
              </div>
            </div>
          `;
        }
        return '';
      },
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
    },
    stroke: {
      width: [1, 2, 1], // Different widths for different series
    },
    colors: [config.colors.upward, config.colors.ema, config.colors.volume],
  };

  // RSI chart options
  const rsiChartOptions: ApexOptions = {
    ...mainChartOptions,
    chart: {
      ...mainChartOptions.chart,
      height: indicatorHeight,
      id: "rsi-chart",
    },
    yaxis: {
      title: { text: "RSI" },
      min: 0,
      max: 100,
      tickAmount: 4,
      labels: {
        formatter: (val: number) => val.toFixed(0),
      },
    },
    annotations: {
      yaxis: [
        { y: 70, strokeDashArray: 2, borderColor: "#FF4560", label: { text: "Overbought" } },
        { y: 30, strokeDashArray: 2, borderColor: "#00E396", label: { text: "Oversold" } },
      ],
    },
    colors: ["#FF6B35"],
  };

  // MACD chart options
  const macdChartOptions: ApexOptions = {
    ...mainChartOptions,
    chart: {
      ...mainChartOptions.chart,
      height: indicatorHeight,
      id: "macd-chart",
    },
    yaxis: {
      title: { text: "MACD" },
      labels: {
        formatter: (val: number) => val.toFixed(3),
      },
    },
    annotations: {
      yaxis: [
        { y: 0, strokeDashArray: 2, borderColor: "#666" },
      ],
    },
    colors: ["#9C27B0"],
  };

  return (
    <ChartErrorBoundary onError={onError}>
      <div style={{ height }} className="w-full">
        <Chart
          options={mainChartOptions}
          series={series}
          type="candlestick"
          height={mainChartHeight}
          data-testid="main-candlestick-chart"
        />
        
        {showRSI && rsiData.length > 0 && (
          <Chart
            options={rsiChartOptions}
            series={[{ name: "RSI", data: rsiData ?? [] }]}
            type="line"
            height={indicatorHeight}
            data-testid="rsi-subchart"
          />
        )}
        
        {showMACD && macdData.length > 0 && (
          <Chart
            options={macdChartOptions}
            series={[{ name: "MACD", data: macdData ?? [] }]}
            type="line"
            height={indicatorHeight}
            data-testid="macd-subchart"
          />
        )}
      </div>
    </ChartErrorBoundary>
  );
});

TradingChart.displayName = 'TradingChart';