import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Filter, Calendar, TrendingUp, TrendingDown } from 'lucide-react';

interface Trade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  agentSignals: string[];
  reason: string;
}

interface TradeExportProps {
  trades: Trade[];
}

export default function TradeExport({ trades }: TradeExportProps) {
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [sideFilter, setSideFilter] = useState<'all' | 'LONG' | 'SHORT'>('all');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'xlsx'>('csv');

  // Filter trades
  const now = Date.now();
  const dateRangeMs = {
    'all': Infinity,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000
  };

  const filtered = trades.filter(t => {
    const inRange = now - t.exitTime <= dateRangeMs[dateFilter];
    const sideMatch = sideFilter === 'all' || t.side === sideFilter;
    return inRange && sideMatch;
  });

  // Calculate statistics
  const stats = {
    totalTrades: filtered.length,
    winningTrades: filtered.filter(t => t.pnl > 0).length,
    losingTrades: filtered.filter(t => t.pnl < 0).length,
    totalPnL: filtered.reduce((sum, t) => sum + t.pnl, 0),
    avgPnL: filtered.length > 0 ? filtered.reduce((sum, t) => sum + t.pnl, 0) / filtered.length : 0,
    winRate: filtered.length > 0 ? (filtered.filter(t => t.pnl > 0).length / filtered.length) * 100 : 0,
    longTrades: filtered.filter(t => t.side === 'LONG').length,
    shortTrades: filtered.filter(t => t.side === 'SHORT').length
  };

  // Export functions
  const exportToCSV = () => {
    const headers = ['Symbol', 'Side', 'Entry Price', 'Exit Price', 'Quantity', 'Entry Time', 'Exit Time', 'PnL', 'PnL %', 'Agents', 'Reason'];
    const rows = filtered.map(t => [
      t.symbol,
      t.side,
      t.entryPrice.toFixed(2),
      t.exitPrice.toFixed(2),
      t.quantity.toFixed(4),
      new Date(t.entryTime).toISOString(),
      new Date(t.exitTime).toISOString(),
      t.pnl.toFixed(2),
      t.pnlPercent.toFixed(2),
      t.agentSignals.join('; '),
      t.reason
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    downloadFile(csv, `trades_export_${Date.now()}.csv`, 'text/csv');
  };

  const exportToJSON = () => {
    const json = JSON.stringify({
      exportDate: new Date().toISOString(),
      statistics: stats,
      trades: filtered
    }, null, 2);

    downloadFile(json, `trades_export_${Date.now()}.json`, 'application/json');
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Trade Export & Analysis</h2>
        <p className="text-slate-400">Export your trading history for analysis or backup</p>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter Trades
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Filter */}
          <div>
            <label className="text-sm font-semibold block mb-2">Time Period</label>
            <div className="flex gap-2">
              {(['all', '7d', '30d', '90d'] as const).map((period) => (
                <Button
                  key={period}
                  variant={dateFilter === period ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter(period)}
                  className="text-xs"
                >
                  {period === 'all' ? 'All Time' : period.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>

          {/* Side Filter */}
          <div>
            <label className="text-sm font-semibold block mb-2">Position Type</label>
            <div className="flex gap-2">
              <Button
                variant={sideFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSideFilter('all')}
                className="text-xs flex-1"
              >
                All ({filtered.length})
              </Button>
              <Button
                variant={sideFilter === 'LONG' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSideFilter('LONG')}
                className="text-xs flex-1"
              >
                Long ({stats.longTrades})
              </Button>
              <Button
                variant={sideFilter === 'SHORT' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSideFilter('SHORT')}
                className="text-xs flex-1"
              >
                Short ({stats.shortTrades})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-sm text-slate-400 mb-1">Total Trades</div>
            <div className="text-2xl font-bold">{stats.totalTrades}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="pt-6">
            <div className="text-sm text-slate-400 mb-1">Win Rate</div>
            <div className="text-2xl font-bold text-green-400">{stats.winRate.toFixed(1)}%</div>
            <div className="text-xs text-slate-400">{stats.winningTrades}W / {stats.losingTrades}L</div>
          </CardContent>
        </Card>
        <Card className={`${stats.totalPnL > 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <CardContent className="pt-6">
            <div className="text-sm text-slate-400 mb-1">Total PnL</div>
            <div className={`text-2xl font-bold ${stats.totalPnL > 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${stats.totalPnL.toFixed(0)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-sm text-slate-400 mb-1">Avg Trade</div>
            <div className={`text-2xl font-bold ${stats.avgPnL > 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${stats.avgPnL.toFixed(0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Options */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Trades
          </CardTitle>
          <CardDescription>
            Download {filtered.length} trade{filtered.length !== 1 ? 's' : ''} in your preferred format
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Format Selection */}
          <div>
            <label className="text-sm font-semibold block mb-2">Export Format</label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={exportFormat === 'csv' ? 'default' : 'outline'}
                onClick={() => setExportFormat('csv')}
                className="text-sm"
              >
                CSV
              </Button>
              <Button
                variant={exportFormat === 'json' ? 'default' : 'outline'}
                onClick={() => setExportFormat('json')}
                className="text-sm"
              >
                JSON
              </Button>
              <Button
                variant={exportFormat === 'xlsx' ? 'default' : 'outline'}
                onClick={() => setExportFormat('xlsx')}
                className="text-sm"
                disabled
              >
                Excel (Soon)
              </Button>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-2 pt-4">
            {exportFormat === 'csv' && (
              <Button
                onClick={exportToCSV}
                disabled={filtered.length === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Export as CSV
              </Button>
            )}
            {exportFormat === 'json' && (
              <Button
                onClick={exportToJSON}
                disabled={filtered.length === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Export as JSON
              </Button>
            )}
          </div>

          {filtered.length === 0 && (
            <p className="text-sm text-slate-400 text-center">No trades match the current filter</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Trades Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-base">Recent Trades</CardTitle>
          <CardDescription>Showing latest {Math.min(10, filtered.length)} trades</CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-700">
                  <tr>
                    <th className="text-left py-3 px-4">Symbol</th>
                    <th className="text-left py-3 px-4">Side</th>
                    <th className="text-left py-3 px-4">Entry</th>
                    <th className="text-left py-3 px-4">Exit</th>
                    <th className="text-left py-3 px-4">PnL</th>
                    <th className="text-left py-3 px-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(-10).reverse().map((trade) => (
                    <tr key={trade.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-3 px-4 font-semibold">{trade.symbol}</td>
                      <td className="py-3 px-4">
                        <Badge className={trade.side === 'LONG' ? 'bg-green-500/30 text-green-400' : 'bg-red-500/30 text-red-400'}>
                          {trade.side}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">${trade.entryPrice.toFixed(2)}</td>
                      <td className="py-3 px-4">${trade.exitPrice.toFixed(2)}</td>
                      <td className={`py-3 px-4 font-semibold ${trade.pnl > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {trade.pnl > 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs">
                        {new Date(trade.exitTime).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              No trades to display
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
