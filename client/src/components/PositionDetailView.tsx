import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { X, TrendingUp, TrendingDown, Clock, Zap, AlertCircle, Copy } from 'lucide-react';

interface PositionDetailViewProps {
  isOpen: boolean;
  onClose: () => void;
  onClose: () => void;
  position: {
    id: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    currentPrice: number;
    quantity: number;
    entryTime: number;
    pnl: number;
    pnlPercent: number;
    stopLoss: number;
    takeProfit: number;
    status: 'OPEN' | 'CLOSED';
    closedTime?: number;
    agentSignals: string[];
  };
  priceHistory?: Array<{ time: number; price: number }>;
  onClosePosition: (positionId: string, exitPrice: number) => void;
}

export default function PositionDetailView({
  isOpen,
  onClose,
  position,
  priceHistory = [],
  onClosePosition
}: PositionDetailViewProps) {
  const [exitPrice, setExitPrice] = useState<string>(position.currentPrice.toFixed(2));
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const holdTime = Date.now() - position.entryTime;
  const holdDays = Math.floor(holdTime / (1000 * 60 * 60 * 24));
  const holdHours = Math.floor((holdTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const holdMinutes = Math.floor((holdTime % (1000 * 60 * 60)) / (1000 * 60));

  const stopLossDistance = position.side === 'LONG'
    ? position.currentPrice - position.stopLoss
    : position.stopLoss - position.currentPrice;

  const stopLossPercent = (stopLossDistance / position.currentPrice) * 100;

  const takeProfitDistance = position.side === 'LONG'
    ? position.takeProfit - position.currentPrice
    : position.currentPrice - position.takeProfit;

  const takeProfitPercent = (takeProfitDistance / position.currentPrice) * 100;

  const distanceToStop = Math.abs(stopLossDistance);
  const distanceToTP = Math.abs(takeProfitDistance);

  const handleClosePosition = () => {
    onClosePosition(position.id, parseFloat(exitPrice));
    setShowCloseConfirm(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-slate-900 border-slate-800 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <DialogTitle className="text-2xl">
                {position.side === 'LONG' ? '📈' : '📉'} {position.symbol} Position
              </DialogTitle>
              <DialogDescription>
                {position.status === 'OPEN' ? 'Active since' : 'Closed at'}{' '}
                {new Date(position.entryTime).toLocaleString()}
              </DialogDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Price Overview */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-sm text-slate-400 mb-1">Entry Price</div>
                <div className="text-2xl font-bold">${position.entryPrice.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-sm text-slate-400 mb-1">Current Price</div>
                <div className="text-2xl font-bold text-blue-400">${position.currentPrice.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className={`bg-slate-800 border-slate-700 ${position.pnl > 0 ? 'border-green-500/30' : 'border-red-500/30'}`}>
              <CardContent className="pt-6">
                <div className="text-sm text-slate-400 mb-1">P&L</div>
                <div className={`text-2xl font-bold ${position.pnl > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {position.pnl > 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                </div>
                <div className={`text-sm ${position.pnl > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {position.pnl > 0 ? '+' : ''}${position.pnl.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Price Chart */}
          {priceHistory.length > 0 && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-lg">Price History</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={priceHistory}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="time"
                      stroke="#94a3b8"
                      tickFormatter={(time) => new Date(time).toLocaleTimeString()}
                    />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                      formatter={(value) => `$${value.toFixed(2)}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorPrice)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Stops and Targets */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-red-500/10 border-red-500/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  Stop Loss
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <div className="text-sm text-slate-400">Price Level</div>
                  <div className="text-lg font-bold text-red-400">${position.stopLoss.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-400">Distance</div>
                  <div className="text-sm">
                    ${distanceToStop.toFixed(2)} ({stopLossPercent.toFixed(2)}%)
                  </div>
                </div>
                <div className="pt-2 border-t border-red-500/20">
                  <div className="text-xs text-slate-400">Max Loss</div>
                  <div className="text-sm font-semibold text-red-400">
                    ${(position.quantity * distanceToStop).toFixed(2)}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-500/10 border-green-500/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-green-400">
                  <TrendingUp className="w-4 h-4" />
                  Take Profit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <div className="text-sm text-slate-400">Price Level</div>
                  <div className="text-lg font-bold text-green-400">${position.takeProfit.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-400">Distance</div>
                  <div className="text-sm">
                    ${distanceToTP.toFixed(2)} ({takeProfitPercent.toFixed(2)}%)
                  </div>
                </div>
                <div className="pt-2 border-t border-green-500/20">
                  <div className="text-xs text-slate-400">Max Gain</div>
                  <div className="text-sm font-semibold text-green-400">
                    ${(position.quantity * distanceToTP).toFixed(2)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Position Details */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-sm text-slate-400 mb-1 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Quantity
                </div>
                <div className="text-lg font-bold">{position.quantity.toFixed(4)} {position.symbol}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-sm text-slate-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Hold Time
                </div>
                <div className="text-lg font-bold">
                  {holdDays > 0 ? `${holdDays}d ` : ''}
                  {holdHours}h {holdMinutes}m
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-sm text-slate-400 mb-1">Position Value</div>
                <div className="text-lg font-bold">${(position.quantity * position.currentPrice).toFixed(2)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Agent Signals at Entry */}
          {position.agentSignals.length > 0 && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-base">Agent Signals at Entry</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {position.agentSignals.map((agent) => (
                    <Badge key={agent} variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                      {agent}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Close Position Section */}
          {position.status === 'OPEN' && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-base">Close Position</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-2 block">Exit Price</label>
                  <input
                    type="number"
                    value={exitPrice}
                    onChange={(e) => setExitPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                    step="0.01"
                  />
                  <div className="text-xs text-slate-400 mt-1">
                    Current: ${position.currentPrice.toFixed(2)}
                  </div>
                </div>

                {showCloseConfirm && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-300 mb-3">Close position at ${parseFloat(exitPrice).toFixed(2)}?</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCloseConfirm(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-red-600 hover:bg-red-700"
                        onClick={handleClosePosition}
                      >
                        Confirm Close
                      </Button>
                    </div>
                  </div>
                )}

                {!showCloseConfirm && (
                  <Button
                    onClick={() => setShowCloseConfirm(true)}
                    className="w-full bg-orange-600 hover:bg-orange-700"
                  >
                    Close Position
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Closed Position Info */}
          {position.status === 'CLOSED' && position.closedTime && (
            <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
              <div className="text-sm text-slate-400">
                Position closed at {new Date(position.closedTime).toLocaleString()}
              </div>
              <div className={`text-lg font-bold mt-2 ${position.pnl > 0 ? 'text-green-400' : 'text-red-400'}`}>
                Final P&L: {position.pnl > 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}% (${position.pnl.toFixed(2)})
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
