/**
 * Export Service - Handles exporting backtest results in multiple formats
 * Supports: CSV, JSON, PDF, HTML
 */

interface BacktestMetrics {
  totalReturn?: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  winRate?: number;
  profitFactor?: number;
  sortinoRatio?: number;
  annualizedReturn?: number;
  calmarRatio?: number;
  totalTrades?: number;
  avgWin?: number;
  avgLoss?: number;
}

interface BacktestResult {
  id: string;
  name?: string;
  symbol?: string;
  timeframe?: string;
  period?: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalCapital: number;
  metrics: BacktestMetrics;
  equityCurve?: Array<{ timestamp: string; value: number }>;
  trades?: Array<{ entryTime: string; exitTime: string; entryPrice: number; exitPrice: number; pnl: number; returnPercent: number }>;
  monthlyReturns?: Array<{ month: string; return: number }>;
  parameters?: any;
}

interface MetricComparison {
  metric: string;
  label: string;
  result1Value: number;
  result2Value: number;
  result3Value?: number;
  result4Value?: number;
  difference12: number;
  percentChange12: number;
  winner: string;
}

interface ExportOptions {
  format: 'csv' | 'json' | 'pdf' | 'html';
  includeCharts?: boolean;
  includeMetrics?: boolean;
  includeTrades?: boolean;
  includeParameters?: boolean;
}

/**
 * Export single result to specified format
 */
export async function exportResult(result: BacktestResult, options: ExportOptions): Promise<Blob> {
  switch (options.format) {
    case 'csv':
      return exportToCSV(result, options);
    case 'json':
      return exportToJSON(result, options);
    case 'pdf':
      return exportToPDF(result, options);
    case 'html':
      return exportToHTML(result, options);
    default:
      throw new Error(`Unsupported format: ${options.format}`);
  }
}

/**
 * Export comparison results
 */
export async function exportComparison(
  results: BacktestResult[],
  comparisons: MetricComparison[],
  options: ExportOptions
): Promise<Blob> {
  switch (options.format) {
    case 'csv':
      return exportComparisonToCSV(results, comparisons, options);
    case 'json':
      return exportComparisonToJSON(results, comparisons, options);
    case 'pdf':
      return exportComparisonToPDF(results, comparisons, options);
    case 'html':
      return exportComparisonToHTML(results, comparisons, options);
    default:
      throw new Error(`Unsupported format: ${options.format}`);
  }
}

/**
 * Export batch results
 */
export async function exportBatch(results: BacktestResult[], options: ExportOptions): Promise<Blob> {
  switch (options.format) {
    case 'csv':
      return exportBatchToCSV(results, options);
    case 'json':
      return exportBatchToJSON(results, options);
    case 'html':
      return exportBatchToHTML(results, options);
    default:
      throw new Error(`Unsupported format: ${options.format}`);
  }
}

/**
 * CSV EXPORT FUNCTIONS
 */

function exportToCSV(result: BacktestResult, options: ExportOptions): Blob {
  let csv = '';

  // Header section
  csv += 'BACKTEST REPORT\n';
  csv += `Export Date,${new Date().toISOString()}\n`;
  csv += `Asset,${result.symbol || 'N/A'}\n`;
  csv += `Period,"${result.startDate} to ${result.endDate}"\n`;
  csv += `Initial Capital,${formatNumber(result.initialCapital)}\n`;
  csv += `Final Capital,${formatNumber(result.finalCapital)}\n\n`;

  // Metrics section
  if (options.includeMetrics !== false) {
    csv += 'PERFORMANCE METRICS\n';
    csv += 'Metric,Value\n';

    const metrics = [
      ['Total Return %', ((result.metrics.totalReturn ?? 0) * 100).toFixed(2)],
      ['Annualized Return %', ((result.metrics.annualizedReturn ?? 0) * 100).toFixed(2)],
      ['Sharpe Ratio', (result.metrics.sharpeRatio ?? 0).toFixed(2)],
      ['Sortino Ratio', (result.metrics.sortinoRatio ?? 0).toFixed(2)],
      ['Calmar Ratio', (result.metrics.calmarRatio ?? 0).toFixed(2)],
      ['Max Drawdown %', ((result.metrics.maxDrawdown ?? 0) * 100).toFixed(2)],
      ['Win Rate %', ((result.metrics.winRate ?? 0) * 100).toFixed(2)],
      ['Profit Factor', (result.metrics.profitFactor ?? 0).toFixed(2)],
      ['Total Trades', (result.metrics.totalTrades ?? 0).toFixed(0)],
      ['Avg Win %', ((result.metrics.avgWin ?? 0) * 100).toFixed(2)],
      ['Avg Loss %', ((result.metrics.avgLoss ?? 0) * 100).toFixed(2)],
    ];

    metrics.forEach(([key, value]) => {
      csv += `${key},"${value}"\n`;
    });
    csv += '\n';
  }

  // Monthly returns section
  if (options.includeCharts !== false && result.monthlyReturns) {
    csv += 'MONTHLY RETURNS\n';
    csv += 'Month,Return %\n';
    result.monthlyReturns.forEach((month) => {
      csv += `${month.month},"${(month.return * 100).toFixed(2)}"\n`;
    });
    csv += '\n';
  }

  // Trades section
  if (options.includeTrades !== false && result.trades) {
    csv += 'TRADES\n';
    csv += 'Trade #,Entry Time,Exit Time,Entry Price,Exit Price,P&L,Return %\n';
    result.trades.forEach((trade, idx) => {
      csv += `${idx + 1},"${trade.entryTime}","${trade.exitTime}",${trade.entryPrice.toFixed(2)},${trade.exitPrice.toFixed(2)},${trade.pnl.toFixed(2)},"${(trade.returnPercent * 100).toFixed(2)}"\n`;
    });
    csv += '\n';
  }

  // Parameters section
  if (options.includeParameters !== false && result.parameters) {
    csv += 'TRADING PARAMETERS\n';
    csv += 'Parameter,Value\n';
    Object.entries(result.parameters).forEach(([key, value]) => {
      csv += `${key},"${value}"\n`;
    });
  }

  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}

function exportComparisonToCSV(
  results: BacktestResult[],
  comparisons: MetricComparison[],
  options: ExportOptions
): Blob {
  let csv = '';

  // Header
  csv += 'COMPARISON REPORT\n';
  csv += `Export Date,${new Date().toISOString()}\n`;
  csv += `Results Compared,${results.length}\n\n`;

  // Summary section
  csv += 'SUMMARY\n';
  csv += 'Asset,Total Return %,Sharpe Ratio,Max Drawdown %,Win Rate %,Total Trades\n';
  results.forEach((result) => {
    csv += `"${result.symbol || result.name || 'Result'}","${((result.metrics.totalReturn ?? 0) * 100).toFixed(2)}","${(result.metrics.sharpeRatio ?? 0).toFixed(2)}","${((result.metrics.maxDrawdown ?? 0) * 100).toFixed(2)}","${((result.metrics.winRate ?? 0) * 100).toFixed(2)}","${(result.metrics.totalTrades ?? 0).toFixed(0)}"\n`;
  });
  csv += '\n';

  // Detailed comparison
  csv += 'DETAILED COMPARISON\n';
  csv += 'Metric';
  results.forEach((_, idx) => {
    csv += `,Result ${idx + 1}`;
  });
  csv += ',Winner\n';

  comparisons.forEach((comp) => {
    csv += `"${comp.label}"`;
    csv += `,"${comp.result1Value.toFixed(2)}"`;
    if (comp.result2Value !== undefined) csv += `,"${comp.result2Value.toFixed(2)}"`;
    if (comp.result3Value !== undefined) csv += `,"${comp.result3Value.toFixed(2)}"`;
    if (comp.result4Value !== undefined) csv += `,"${comp.result4Value.toFixed(2)}"`;
    csv += `,"${comp.winner}"\n`;
  });

  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}

function exportBatchToCSV(results: BacktestResult[], options: ExportOptions): Blob {
  let csv = '';

  csv += 'BATCH RESULTS REPORT\n';
  csv += `Export Date,${new Date().toISOString()}\n`;
  csv += `Total Results,${results.length}\n\n`;

  csv += 'RESULTS MATRIX\n';
  csv += 'Asset,Total Return %,Sharpe Ratio,Max Drawdown %,Win Rate %,Profit Factor,Total Trades\n';

  results.forEach((result) => {
    csv += `"${result.symbol || result.name || 'Result'}","${((result.metrics.totalReturn ?? 0) * 100).toFixed(2)}","${(result.metrics.sharpeRatio ?? 0).toFixed(2)}","${((result.metrics.maxDrawdown ?? 0) * 100).toFixed(2)}","${((result.metrics.winRate ?? 0) * 100).toFixed(2)}","${(result.metrics.profitFactor ?? 0).toFixed(2)}","${(result.metrics.totalTrades ?? 0).toFixed(0)}"\n`;
  });

  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}

/**
 * JSON EXPORT FUNCTIONS
 */

function exportToJSON(result: BacktestResult, options: ExportOptions): Blob {
  const exportData: any = {
    exportedAt: new Date().toISOString(),
    result: {
      id: result.id,
      name: result.name,
      symbol: result.symbol,
      timeframe: result.timeframe,
      period: result.period,
      startDate: result.startDate,
      endDate: result.endDate,
      initialCapital: result.initialCapital,
      finalCapital: result.finalCapital,
    },
  };

  if (options.includeMetrics !== false) {
    exportData.metrics = result.metrics;
  }

  if (options.includeCharts !== false) {
    exportData.equityCurve = result.equityCurve;
    exportData.monthlyReturns = result.monthlyReturns;
  }

  if (options.includeTrades !== false) {
    exportData.trades = result.trades;
  }

  if (options.includeParameters !== false) {
    exportData.parameters = result.parameters;
  }

  const json = JSON.stringify(exportData, null, 2);
  return new Blob([json], { type: 'application/json;charset=utf-8;' });
}

function exportComparisonToJSON(
  results: BacktestResult[],
  comparisons: MetricComparison[],
  options: ExportOptions
): Blob {
  const exportData = {
    exportedAt: new Date().toISOString(),
    resultCount: results.length,
    results: results.map((r) => ({
      id: r.id,
      name: r.name,
      symbol: r.symbol,
      metrics: r.metrics,
    })),
    comparisons: comparisons,
  };

  const json = JSON.stringify(exportData, null, 2);
  return new Blob([json], { type: 'application/json;charset=utf-8;' });
}

function exportBatchToJSON(results: BacktestResult[], options: ExportOptions): Blob {
  const exportData = {
    exportedAt: new Date().toISOString(),
    totalResults: results.length,
    results: results.map((r) => ({
      id: r.id,
      name: r.name,
      symbol: r.symbol,
      metrics: r.metrics,
    })),
  };

  const json = JSON.stringify(exportData, null, 2);
  return new Blob([json], { type: 'application/json;charset=utf-8;' });
}

/**
 * PDF EXPORT FUNCTIONS (placeholder - requires html2pdf library)
 */

function exportToPDF(result: BacktestResult, options: ExportOptions): Blob {
  // Note: Full PDF export requires html2pdf library installation
  // For now, export as text-based document
  let content = '';

  content += '═══════════════════════════════════════════\n';
  content += '          BACKTEST REPORT\n';
  content += '═══════════════════════════════════════════\n\n';

  content += `Asset: ${result.symbol || 'N/A'}\n`;
  content += `Period: ${result.startDate} to ${result.endDate}\n`;
  content += `Initial Capital: $${formatNumber(result.initialCapital)}\n`;
  content += `Final Capital: $${formatNumber(result.finalCapital)}\n`;
  content += `Total Return: ${((result.metrics.totalReturn ?? 0) * 100).toFixed(2)}%\n\n`;

  content += '───────────────────────────────────────────\n';
  content += 'PERFORMANCE METRICS\n';
  content += '───────────────────────────────────────────\n';

  const metrics = [
    [`Annualized Return`, ((result.metrics.annualizedReturn ?? 0) * 100).toFixed(2) + '%`],
    [`Sharpe Ratio`, (result.metrics.sharpeRatio ?? 0).toFixed(2)],
    [`Sortino Ratio`, (result.metrics.sortinoRatio ?? 0).toFixed(2)],
    [`Calmar Ratio`, (result.metrics.calmarRatio ?? 0).toFixed(2)],
    [`Max Drawdown`, ((result.metrics.maxDrawdown ?? 0) * 100).toFixed(2) + '%`],
    [`Win Rate`, ((result.metrics.winRate ?? 0) * 100).toFixed(2) + '%`],
    [`Profit Factor`, (result.metrics.profitFactor ?? 0).toFixed(2)],
    [`Total Trades`, (result.metrics.totalTrades ?? 0).toFixed(0)],
  ];

  metrics.forEach(([key, value]) => {
    content += `${key.padEnd(25)}: ${value}\n`;
  });

  if (result.trades) {
    content += '\n───────────────────────────────────────────\n';
    content += `TRADES (${result.trades.length} total)\n`;
    content += '───────────────────────────────────────────\n';
    result.trades.slice(0, 20).forEach((trade, idx) => {
      content += `Trade ${idx + 1}: ${trade.entryTime} → ${trade.exitTime} | P&L: $${trade.pnl.toFixed(2)} (${(trade.returnPercent * 100).toFixed(2)}%)\n`;
    });
    if (result.trades.length > 20) {
      content += `... and ${result.trades.length - 20} more trades\n`;
    }
  }

  content += '\n═══════════════════════════════════════════\n';
  content += `Generated: ${new Date().toISOString()}\n`;
  content += '═══════════════════════════════════════════\n';

  return new Blob([content], { type: 'text/plain;charset=utf-8;' });
}

function exportComparisonToPDF(
  results: BacktestResult[],
  comparisons: MetricComparison[],
  options: ExportOptions
): Blob {
  let content = '';

  content += '═══════════════════════════════════════════\n';
  content += '      COMPARISON REPORT\n';
  content += '═══════════════════════════════════════════\n\n';

  content += `Results Compared: ${results.length}\n`;
  content += `Generated: ${new Date().toISOString()}\n\n`;

  content += '───────────────────────────────────────────\n';
  content += 'SUMMARY\n';
  content += '───────────────────────────────────────────\n';

  results.forEach((result, idx) => {
    content += `\n[Result ${idx + 1}] ${result.symbol || result.name || 'Result'}\n`;
    content += `Total Return: ${((result.metrics.totalReturn ?? 0) * 100).toFixed(2)}%\n`;
    content += `Sharpe Ratio: ${(result.metrics.sharpeRatio ?? 0).toFixed(2)}\n`;
    content += `Max Drawdown: ${((result.metrics.maxDrawdown ?? 0) * 100).toFixed(2)}%\n`;
    content += `Win Rate: ${((result.metrics.winRate ?? 0) * 100).toFixed(2)}%\n`;
  });

  content += '\n───────────────────────────────────────────\n';
  content += 'METRIC COMPARISON\n';
  content += '───────────────────────────────────────────\n';

  comparisons.forEach((comp) => {
    content += `\n${comp.label}\n`;
    content += `  Result 1: ${comp.result1Value.toFixed(2)}\n`;
    content += `  Result 2: ${comp.result2Value.toFixed(2)}\n`;
    content += `  Difference: ${comp.difference12.toFixed(2)} (${comp.percentChange12.toFixed(2)}%)\n`;
    content += `  Winner: ${comp.winner}\n`;
  });

  content += '\n═══════════════════════════════════════════\n';

  return new Blob([content], { type: 'text/plain;charset=utf-8;' });
}

/**
 * HTML EXPORT FUNCTIONS
 */

function exportToHTML(result: BacktestResult, options: ExportOptions): Blob {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Backtest Report - ${result.symbol || 'Result'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f3f4f6;
      color: #1f2937;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      padding: 40px;
    }
    h1, h2 {
      color: #111827;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 10px;
    }
    h1 {
      margin-top: 0;
    }
    .header-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .metric-card {
      background: #f9fafb;
      padding: 15px;
      border-radius: 6px;
      border-left: 4px solid #3b82f6;
    }
    .metric-card-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 5px;
    }
    .metric-card-value {
      font-size: 24px;
      font-weight: bold;
      color: #1f2937;
    }
    .metric-card.positive .metric-card-value {
      color: #059669;
    }
    .metric-card.negative .metric-card-value {
      color: #dc2626;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th {
      background: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #e5e7eb;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:hover {
      background: #f9fafb;
    }
    .positive {
      color: #059669;
    }
    .negative {
      color: #dc2626;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
    @media print {
      body {
        background: white;
      }
      .container {
        box-shadow: none;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Backtest Report</h1>
    <p><strong>Asset:</strong> ${result.symbol || 'N/A'} | <strong>Period:</strong> ${result.startDate} to ${result.endDate}</p>
    
    <h2>Summary</h2>
    <div class="header-grid">
      <div class="metric-card ${(result.metrics.totalReturn ?? 0) >= 0 ? 'positive' : 'negative'}">
        <div class="metric-card-label">Total Return</div>
        <div class="metric-card-value">${((result.metrics.totalReturn ?? 0) * 100).toFixed(2)}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-card-label">Initial Capital</div>
        <div class="metric-card-value">$${formatNumber(result.initialCapital)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-card-label">Final Capital</div>
        <div class="metric-card-value">$${formatNumber(result.finalCapital)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-card-label">Sharpe Ratio</div>
        <div class="metric-card-value">${(result.metrics.sharpeRatio ?? 0).toFixed(2)}</div>
      </div>
    </div>

    <h2>Performance Metrics</h2>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Annualized Return</td>
          <td>${((result.metrics.annualizedReturn ?? 0) * 100).toFixed(2)}%</td>
        </tr>
        <tr>
          <td>Max Drawdown</td>
          <td class="negative">${((result.metrics.maxDrawdown ?? 0) * 100).toFixed(2)}%</td>
        </tr>
        <tr>
          <td>Sharpe Ratio</td>
          <td>${(result.metrics.sharpeRatio ?? 0).toFixed(2)}</td>
        </tr>
        <tr>
          <td>Sortino Ratio</td>
          <td>${(result.metrics.sortinoRatio ?? 0).toFixed(2)}</td>
        </tr>
        <tr>
          <td>Calmar Ratio</td>
          <td>${(result.metrics.calmarRatio ?? 0).toFixed(2)}</td>
        </tr>
        <tr>
          <td>Win Rate</td>
          <td class="positive">${((result.metrics.winRate ?? 0) * 100).toFixed(2)}%</td>
        </tr>
        <tr>
          <td>Profit Factor</td>
          <td>${(result.metrics.profitFactor ?? 0).toFixed(2)}</td>
        </tr>
        <tr>
          <td>Total Trades</td>
          <td>${(result.metrics.totalTrades ?? 0).toFixed(0)}</td>
        </tr>
      </tbody>
    </table>

    ${
      result.trades && result.trades.length > 0
        ? `
    <h2>Top Trades</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Entry</th>
          <th>Exit</th>
          <th>Entry Price</th>
          <th>Exit Price</th>
          <th>P&L</th>
          <th>Return</th>
        </tr>
      </thead>
      <tbody>
        ${result.trades
          .slice(0, 10)
          .map(
            (trade, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${trade.entryTime}</td>
          <td>${trade.exitTime}</td>
          <td>$${trade.entryPrice.toFixed(2)}</td>
          <td>$${trade.exitPrice.toFixed(2)}</td>
          <td class="${trade.pnl >= 0 ? 'positive' : 'negative'}">$${trade.pnl.toFixed(2)}</td>
          <td class="${trade.returnPercent >= 0 ? 'positive' : 'negative'}">${(trade.returnPercent * 100).toFixed(2)}%</td>
        </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
    ${result.trades.length > 10 ? `<p><em>... and ${result.trades.length - 10} more trades</em></p>` : ''}
    `
        : ''
    }

    <div class="footer">
      <p>Generated on ${new Date().toLocaleString()}</p>
      <p>This report was auto-generated by Scanstream Backtest System</p>
    </div>
  </div>
</body>
</html>
  `;

  return new Blob([html], { type: 'text/html;charset=utf-8;' });
}

function exportComparisonToHTML(
  results: BacktestResult[],
  comparisons: MetricComparison[],
  options: ExportOptions
): Blob {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comparison Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f3f4f6;
      color: #1f2937;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      padding: 40px;
    }
    h1, h2 {
      color: #111827;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 10px;
    }
    .comparison-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .result-card {
      background: #f9fafb;
      padding: 20px;
      border-radius: 6px;
      border-left: 4px solid #3b82f6;
    }
    .result-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 15px;
      color: #1f2937;
    }
    .metric-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .metric-row:last-child {
      border-bottom: none;
    }
    .metric-label {
      font-size: 12px;
      color: #6b7280;
    }
    .metric-value {
      font-weight: 600;
      color: #1f2937;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th {
      background: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #e5e7eb;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    .winner {
      background: #d1fae5;
      color: #065f46;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Backtest Comparison Report</h1>
    <p><strong>Results Compared:</strong> ${results.length} | <strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    
    <h2>Summary</h2>
    <div class="comparison-grid">
      ${results
        .map(
          (result, idx) => `
      <div class="result-card">
        <div class="result-title">${result.symbol || result.name || `Result ${idx + 1}`}</div>
        <div class="metric-row">
          <span class="metric-label">Total Return</span>
          <span class="metric-value">${((result.metrics.totalReturn ?? 0) * 100).toFixed(2)}%</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Sharpe Ratio</span>
          <span class="metric-value">${(result.metrics.sharpeRatio ?? 0).toFixed(2)}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Max Drawdown</span>
          <span class="metric-value">${((result.metrics.maxDrawdown ?? 0) * 100).toFixed(2)}%</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Win Rate</span>
          <span class="metric-value">${((result.metrics.winRate ?? 0) * 100).toFixed(2)}%</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Total Trades</span>
          <span class="metric-value">${(result.metrics.totalTrades ?? 0).toFixed(0)}</span>
        </div>
      </div>
      `
        )
        .join('')}
    </div>

    <h2>Metric Comparison</h2>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          ${results.map((_, idx) => `<th>Result ${idx + 1}</th>`).join('')}
          <th>Winner</th>
        </tr>
      </thead>
      <tbody>
        ${comparisons
          .map(
            (comp) => `
        <tr>
          <td><strong>${comp.label}</strong></td>
          <td>${comp.result1Value.toFixed(2)}</td>
          ${comp.result2Value !== undefined ? `<td>${comp.result2Value.toFixed(2)}</td>` : ''}
          ${comp.result3Value !== undefined ? `<td>${comp.result3Value.toFixed(2)}</td>` : ''}
          ${comp.result4Value !== undefined ? `<td>${comp.result4Value.toFixed(2)}</td>` : ''}
          <td><span class="winner">${comp.winner}</span></td>
        </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    <div class="footer">
      <p>Generated on ${new Date().toLocaleString()}</p>
      <p>This report was auto-generated by Scanstream Backtest System</p>
    </div>
  </div>
</body>
</html>
  `;

  return new Blob([html], { type: 'text/html;charset=utf-8;' });
}

function exportBatchToHTML(results: BacktestResult[], options: ExportOptions): Blob {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Batch Results Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f3f4f6;
      color: #1f2937;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      padding: 40px;
    }
    h1, h2 {
      color: #111827;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th {
      background: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #e5e7eb;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:hover {
      background: #f9fafb;
    }
    .positive {
      color: #059669;
      font-weight: 600;
    }
    .negative {
      color: #dc2626;
      font-weight: 600;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Batch Results Report</h1>
    <p><strong>Total Results:</strong> ${results.length} | <strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    
    <h2>Results Matrix</h2>
    <table>
      <thead>
        <tr>
          <th>Asset</th>
          <th>Total Return</th>
          <th>Sharpe Ratio</th>
          <th>Max Drawdown</th>
          <th>Win Rate</th>
          <th>Profit Factor</th>
          <th>Total Trades</th>
        </tr>
      </thead>
      <tbody>
        ${results
          .map(
            (result) => `
        <tr>
          <td><strong>${result.symbol || result.name || 'Result'}</strong></td>
          <td class="${(result.metrics.totalReturn ?? 0) >= 0 ? 'positive' : 'negative'}">
            ${((result.metrics.totalReturn ?? 0) * 100).toFixed(2)}%
          </td>
          <td>${(result.metrics.sharpeRatio ?? 0).toFixed(2)}</td>
          <td class="negative">${((result.metrics.maxDrawdown ?? 0) * 100).toFixed(2)}%</td>
          <td>${((result.metrics.winRate ?? 0) * 100).toFixed(2)}%</td>
          <td>${(result.metrics.profitFactor ?? 0).toFixed(2)}</td>
          <td>${(result.metrics.totalTrades ?? 0).toFixed(0)}</td>
        </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    <div class="footer">
      <p>Generated on ${new Date().toLocaleString()}</p>
      <p>This report was auto-generated by Scanstream Backtest System</p>
    </div>
  </div>
</body>
</html>
  `;

  return new Blob([html], { type: 'text/html;charset=utf-8;' });
}

/**
 * Utility Functions
 */

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Download helper
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
