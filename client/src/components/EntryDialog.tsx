import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, TrendingUp, TrendingDown, DollarSign, Target, Shield } from 'lucide-react';

interface EntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (entry: PositionEntry) => void;
  asset: {
    symbol: string;
    currentPrice: number;
    consensusSignal: 'BUY' | 'SELL' | 'HOLD';
    avgConfidence: number;
    riskScore: 'LOW' | 'MEDIUM' | 'HIGH';
    suggestedStopLoss?: number;
    suggestedTakeProfit?: number;
  };
  accountBalance: number;
  side: 'LONG' | 'SHORT';
}

export interface PositionEntry {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  positionSize: number;
  stopLoss: number;
  takeProfit: number;
  riskAmount: number;
  riskRewardRatio: number;
}

export default function EntryDialog({
  isOpen,
  onClose,
  onConfirm,
  asset,
  accountBalance,
  side
}: EntryDialogProps) {
  const [riskPercent, setRiskPercent] = useState(1); // 1% default
  const [customStopLoss, setCustomStopLoss] = useState<number | null>(null);
  const [customTakeProfit, setCustomTakeProfit] = useState<number | null>(null);
  const [leverage, setLeverage] = useState(1);

  // Calculate position size based on risk percentage
  const riskAmount = (accountBalance * riskPercent) / 100;
  const stopDistance = side === 'LONG' 
    ? asset.currentPrice - (customStopLoss || asset.suggestedStopLoss || asset.currentPrice * 0.98)
    : (customStopLoss || asset.suggestedStopLoss || asset.currentPrice * 1.02) - asset.currentPrice;

  const quantity = stopDistance > 0 ? riskAmount / stopDistance : 0;
  const positionSize = quantity * asset.currentPrice * leverage;

  // Risk/Reward calculation
  const tpDistance = side === 'LONG'
    ? (customTakeProfit || asset.suggestedTakeProfit || asset.currentPrice * 1.08) - asset.currentPrice
    : asset.currentPrice - (customTakeProfit || asset.suggestedTakeProfit || asset.currentPrice * 0.92);

  const riskRewardRatio = tpDistance > 0 ? tpDistance / stopDistance : 0;

  const finalStopLoss = customStopLoss || asset.suggestedStopLoss || (side === 'LONG' ? asset.currentPrice * 0.98 : asset.currentPrice * 1.02);
  const finalTakeProfit = customTakeProfit || asset.suggestedTakeProfit || (side === 'LONG' ? asset.currentPrice * 1.08 : asset.currentPrice * 0.92);

  const handleConfirm = () => {
    const entry: PositionEntry = {
      symbol: asset.symbol,
      side,
      entryPrice: asset.currentPrice,
      quantity,
      positionSize,
      stopLoss: finalStopLoss,
      takeProfit: finalTakeProfit,
      riskAmount,
      riskRewardRatio
    };
    onConfirm(entry);
    onClose();
  };

  const insufficientBalance = positionSize > accountBalance;
  const poorRiskReward = riskRewardRatio < 1.5;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-slate-900 border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {side === 'LONG' ? '📈' : '📉'} Open {side} Position
          </DialogTitle>
          <DialogDescription>
            {asset.symbol} @ ${asset.currentPrice.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Asset Info Card */}
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Signal</div>
                  <Badge
                    className={`text-sm font-bold border-0 ${
                      asset.consensusSignal === 'BUY'
                        ? 'bg-green-500/30 text-green-400'
                        : asset.consensusSignal === 'SELL'
                        ? 'bg-red-500/30 text-red-400'
                        : 'bg-yellow-500/30 text-yellow-400'
                    }`}
                  >
                    {asset.consensusSignal}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Confidence</div>
                  <div className="text-xl font-bold text-blue-400">{asset.avgConfidence.toFixed(0)}%</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Risk Level</div>
                  <Badge
                    className={`text-sm border-0 ${
                      asset.riskScore === 'LOW'
                        ? 'bg-green-500/30 text-green-400'
                        : asset.riskScore === 'MEDIUM'
                        ? 'bg-yellow-500/30 text-yellow-400'
                        : 'bg-red-500/30 text-red-400'
                    }`}
                  >
                    {asset.riskScore}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Account</div>
                  <div className="text-xl font-bold text-green-400">${accountBalance.toFixed(0)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Risk Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Risk Per Trade</label>
              <div className="text-2xl font-bold text-orange-400">{riskPercent}%</div>
            </div>
            <Slider
              value={[riskPercent]}
              onValueChange={(val) => setRiskPercent(val[0])}
              min={0.1}
              max={5}
              step={0.1}
              className="w-full"
            />
            <div className="text-xs text-slate-400">Risk amount: ${riskAmount.toFixed(2)}</div>
            {riskPercent > 2 && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-yellow-300">High risk per trade. Consider reducing to 1-2%.</p>
              </div>
            )}
          </div>

          {/* Stop Loss Settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Stop Loss
              </label>
              <div className="text-sm text-slate-400">
                Suggested: ${(asset.suggestedStopLoss || asset.currentPrice * 0.98).toFixed(2)}
              </div>
            </div>
            <Input
              type="number"
              placeholder="Enter stop loss price"
              value={customStopLoss || ''}
              onChange={(e) => setCustomStopLoss(e.target.value ? parseFloat(e.target.value) : null)}
              className="bg-slate-800 border-slate-700"
              step="0.01"
            />
            <div className="text-xs text-slate-400">
              Stop distance: ${stopDistance.toFixed(2)} ({((stopDistance / asset.currentPrice) * 100).toFixed(2)}%)
            </div>
          </div>

          {/* Take Profit Settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Target className="w-4 h-4" />
                Take Profit
              </label>
              <div className="text-sm text-slate-400">
                Suggested: ${(asset.suggestedTakeProfit || asset.currentPrice * 1.08).toFixed(2)}
              </div>
            </div>
            <Input
              type="number"
              placeholder="Enter take profit price"
              value={customTakeProfit || ''}
              onChange={(e) => setCustomTakeProfit(e.target.value ? parseFloat(e.target.value) : null)}
              className="bg-slate-800 border-slate-700"
              step="0.01"
            />
            <div className="text-xs text-slate-400">
              TP distance: ${tpDistance.toFixed(2)} ({((tpDistance / asset.currentPrice) * 100).toFixed(2)}%)
            </div>
          </div>

          {/* Leverage (if applicable) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Leverage</label>
              <div className="text-xl font-bold">{leverage}x</div>
            </div>
            <Slider
              value={[leverage]}
              onValueChange={(val) => setLeverage(val[0])}
              min={1}
              max={5}
              step={0.5}
              className="w-full"
            />
            <div className="text-xs text-slate-400">
              Position size: ${positionSize.toFixed(2)} ({((positionSize / accountBalance) * 100).toFixed(1)}% of account)
            </div>
          </div>

          {/* Risk/Reward Summary */}
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-slate-400 mb-1">Risk Amount</div>
                <div className="text-lg font-bold text-red-400">${riskAmount.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Potential Reward</div>
                <div className="text-lg font-bold text-green-400">${(riskAmount * riskRewardRatio).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Risk/Reward</div>
                <div className={`text-lg font-bold ${riskRewardRatio >= 1.5 ? 'text-green-400' : 'text-yellow-400'}`}>
                  1:{riskRewardRatio.toFixed(2)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warnings */}
          {insufficientBalance && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-300">Position size exceeds available balance. Reduce risk or leverage.</p>
            </div>
          )}
          {poorRiskReward && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-yellow-300">Risk/Reward below 1.5. Consider better entry or exit points.</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={insufficientBalance || quantity === 0}
              className={`flex-1 ${
                side === 'LONG'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Confirm {side} Entry
            </Button>
          </div>

          {/* Info Text */}
          <p className="text-xs text-slate-400 text-center">
            Position will be created in paper trading with these parameters
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
