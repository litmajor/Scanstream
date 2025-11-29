
import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';

interface SignalFiltersProps {
  onFilterChange: (filters: {
    signalType: string;
    minConfidence: number;
    trendDirection: string;
  }) => void;
  currentFilters: {
    signalType: string;
    minConfidence: number;
    trendDirection: string;
  };
}

export function SignalFilters({ onFilterChange, currentFilters }: SignalFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState(currentFilters);

  const handleApply = () => {
    onFilterChange(localFilters);
    setIsOpen(false);
  };

  const handleReset = () => {
    const resetFilters = {
      signalType: 'all',
      minConfidence: 0,
      trendDirection: 'all'
    };
    setLocalFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  const activeFilterCount = [
    localFilters.signalType !== 'all',
    localFilters.minConfidence > 0,
    localFilters.trendDirection !== 'all'
  ].filter(Boolean).length;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2"
      >
        <Filter className="w-4 h-4" />
        Filters
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
            {activeFilterCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-4 z-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Signal Filters</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-slate-800 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Signal Type */}
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Signal Type</label>
              <Select
                value={localFilters.signalType}
                onValueChange={(value) =>
                  setLocalFilters({ ...localFilters, signalType: value })
                }
              >
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Signals</SelectItem>
                  <SelectItem value="BUY">Buy Only</SelectItem>
                  <SelectItem value="SELL">Sell Only</SelectItem>
                  <SelectItem value="HOLD">Hold Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Min Confidence */}
            <div>
              <label className="text-sm text-slate-400 mb-2 block">
                Min Confidence: {localFilters.minConfidence}%
              </label>
              <Slider
                value={[localFilters.minConfidence]}
                onValueChange={(value) =>
                  setLocalFilters({ ...localFilters, minConfidence: value[0] })
                }
                max={100}
                step={5}
                className="py-4"
              />
            </div>

            {/* Trend Direction */}
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Trend Direction</label>
              <Select
                value={localFilters.trendDirection}
                onValueChange={(value) =>
                  setLocalFilters({ ...localFilters, trendDirection: value })
                }
              >
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Trends</SelectItem>
                  <SelectItem value="up">Uptrend</SelectItem>
                  <SelectItem value="down">Downtrend</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="flex-1"
              >
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
