
import { useState, useEffect } from 'react';
import { Filter, X, Save, RefreshCw, Star, Trash2, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useToast } from '@/hooks/use-toast';

export interface SignalFilterCriteria {
  signalType: string;
  minStrength: number;
  maxStrength: number;
  trendDirection: string;
  exchanges: string[];
  sources: string[];
  minPrice?: number;
  maxPrice?: number;
  minChange?: number;
  maxChange?: number;
  timeframe: string;
  minRSI?: number;
  maxRSI?: number;
  hasStopLoss: boolean;
  hasTakeProfit: boolean;
}

export interface FilterPreset {
  id: string;
  name: string;
  criteria: SignalFilterCriteria;
  isFavorite: boolean;
  createdAt: number;
}

const defaultCriteria: SignalFilterCriteria = {
  signalType: 'all',
  minStrength: 0,
  maxStrength: 100,
  trendDirection: 'all',
  exchanges: [],
  sources: [],
  timeframe: 'all',
  hasStopLoss: false,
  hasTakeProfit: false,
};

const builtInPresets: FilterPreset[] = [
  {
    id: 'high-conviction',
    name: 'High Conviction',
    criteria: {
      ...defaultCriteria,
      minStrength: 80,
      signalType: 'all',
      sources: ['ml', 'rl'],
    },
    isFavorite: true,
    createdAt: Date.now(),
  },
  {
    id: 'scalping',
    name: 'Scalping Signals',
    criteria: {
      ...defaultCriteria,
      minStrength: 60,
      timeframe: '1m',
      minChange: 0.5,
    },
    isFavorite: false,
    createdAt: Date.now(),
  },
  {
    id: 'swing-trading',
    name: 'Swing Trading',
    criteria: {
      ...defaultCriteria,
      minStrength: 70,
      timeframe: '4h',
      trendDirection: 'up',
      hasStopLoss: true,
      hasTakeProfit: true,
    },
    isFavorite: false,
    createdAt: Date.now(),
  },
  {
    id: 'oversold',
    name: 'Oversold Bounces',
    criteria: {
      ...defaultCriteria,
      signalType: 'BUY',
      minStrength: 65,
      maxRSI: 30,
      minChange: -5,
    },
    isFavorite: false,
    createdAt: Date.now(),
  },
];

interface AdvancedSignalFiltersProps {
  onFilterChange: (criteria: SignalFilterCriteria) => void;
  currentCriteria: SignalFilterCriteria;
}

export function AdvancedSignalFilters({ onFilterChange, currentCriteria }: AdvancedSignalFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localCriteria, setLocalCriteria] = useState(currentCriteria);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [presetName, setPresetName] = useState('');
  const { toast } = useToast();

  // Load presets from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('signal-filter-presets');
    if (saved) {
      try {
        const userPresets = JSON.parse(saved);
        setPresets([...builtInPresets, ...userPresets]);
      } catch (error) {
        setPresets(builtInPresets);
      }
    } else {
      setPresets(builtInPresets);
    }
  }, []);

  const savePresets = (newPresets: FilterPreset[]) => {
    const userPresets = newPresets.filter(p => !builtInPresets.find(bp => bp.id === p.id));
    localStorage.setItem('signal-filter-presets', JSON.stringify(userPresets));
    setPresets(newPresets);
  };

  const handleApply = () => {
    onFilterChange(localCriteria);
    setIsOpen(false);
    toast({
      title: 'Filters Applied',
      description: `${getActiveFilterCount()} active filters`,
    });
  };

  const handleReset = () => {
    setLocalCriteria(defaultCriteria);
    onFilterChange(defaultCriteria);
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a preset name',
        variant: 'destructive',
      });
      return;
    }

    const newPreset: FilterPreset = {
      id: `user-${Date.now()}`,
      name: presetName,
      criteria: localCriteria,
      isFavorite: false,
      createdAt: Date.now(),
    };

    const updated = [...presets, newPreset];
    savePresets(updated);
    setPresetName('');
    setShowSaveDialog(false);
    toast({
      title: 'Preset Saved',
      description: `"${presetName}" saved successfully`,
    });
  };

  const handleLoadPreset = (preset: FilterPreset) => {
    setLocalCriteria(preset.criteria);
    onFilterChange(preset.criteria);
    toast({
      title: 'Preset Loaded',
      description: `"${preset.name}" filters applied`,
    });
  };

  const handleDeletePreset = (presetId: string) => {
    if (builtInPresets.find(p => p.id === presetId)) {
      toast({
        title: 'Cannot Delete',
        description: 'Built-in presets cannot be deleted',
        variant: 'destructive',
      });
      return;
    }

    const updated = presets.filter(p => p.id !== presetId);
    savePresets(updated);
    toast({
      title: 'Preset Deleted',
      description: 'Filter preset removed',
    });
  };

  const toggleFavorite = (presetId: string) => {
    const updated = presets.map(p =>
      p.id === presetId ? { ...p, isFavorite: !p.isFavorite } : p
    );
    savePresets(updated);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (localCriteria.signalType !== 'all') count++;
    if (localCriteria.minStrength > 0) count++;
    if (localCriteria.maxStrength < 100) count++;
    if (localCriteria.trendDirection !== 'all') count++;
    if (localCriteria.exchanges.length > 0) count++;
    if (localCriteria.sources.length > 0) count++;
    if (localCriteria.timeframe !== 'all') count++;
    if (localCriteria.minRSI !== undefined) count++;
    if (localCriteria.maxRSI !== undefined) count++;
    if (localCriteria.minPrice !== undefined) count++;
    if (localCriteria.maxPrice !== undefined) count++;
    if (localCriteria.minChange !== undefined) count++;
    if (localCriteria.maxChange !== undefined) count++;
    if (localCriteria.hasStopLoss) count++;
    if (localCriteria.hasTakeProfit) count++;
    return count;
  };

  const activeCount = getActiveFilterCount();
  const favoritePresets = presets.filter(p => p.isFavorite);

  return (
    <div className="space-y-3">
      {/* Quick Filter Chips - Favorite Presets */}
      {favoritePresets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {favoritePresets.map(preset => (
            <Button
              key={preset.id}
              variant="outline"
              size="sm"
              onClick={() => handleLoadPreset(preset)}
              className="gap-2 bg-slate-800/50 hover:bg-slate-700 border-slate-600"
            >
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              {preset.name}
            </Button>
          ))}
        </div>
      )}

      {/* Main Filter Button */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          Advanced Filters
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
              {activeCount}
            </Badge>
          )}
        </Button>

        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </Button>
        )}
      </div>

      {/* Advanced Filter Panel */}
      {isOpen && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Advanced Signal Filters
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSaveDialog(true)}
                  className="gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Preset
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-slate-800">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
                <TabsTrigger value="presets">Presets</TabsTrigger>
              </TabsList>

              {/* Basic Filters */}
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-slate-400 mb-2 block">Signal Type</Label>
                    <Select
                      value={localCriteria.signalType}
                      onValueChange={(value) =>
                        setLocalCriteria({ ...localCriteria, signalType: value })
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

                  <div>
                    <Label className="text-sm text-slate-400 mb-2 block">Trend Direction</Label>
                    <Select
                      value={localCriteria.trendDirection}
                      onValueChange={(value) =>
                        setLocalCriteria({ ...localCriteria, trendDirection: value })
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
                </div>

                <div>
                  <Label className="text-sm text-slate-400 mb-2 block">
                    Signal Strength: {localCriteria.minStrength}% - {localCriteria.maxStrength}%
                  </Label>
                  <div className="space-y-2">
                    <Slider
                      value={[localCriteria.minStrength, localCriteria.maxStrength]}
                      onValueChange={(value) =>
                        setLocalCriteria({
                          ...localCriteria,
                          minStrength: value[0],
                          maxStrength: value[1],
                        })
                      }
                      max={100}
                      step={5}
                      className="py-4"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-slate-400 mb-2 block">Timeframe</Label>
                  <Select
                    value={localCriteria.timeframe}
                    onValueChange={(value) =>
                      setLocalCriteria({ ...localCriteria, timeframe: value })
                    }
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Timeframes</SelectItem>
                      <SelectItem value="1m">1 Minute</SelectItem>
                      <SelectItem value="5m">5 Minutes</SelectItem>
                      <SelectItem value="15m">15 Minutes</SelectItem>
                      <SelectItem value="1h">1 Hour</SelectItem>
                      <SelectItem value="4h">4 Hours</SelectItem>
                      <SelectItem value="1d">1 Day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              {/* Advanced Filters */}
              <TabsContent value="advanced" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-slate-400 mb-2 block">Min Price ($)</Label>
                    <Input
                      type="number"
                      placeholder="No minimum"
                      value={localCriteria.minPrice || ''}
                      onChange={(e) =>
                        setLocalCriteria({
                          ...localCriteria,
                          minPrice: e.target.value ? parseFloat(e.target.value) : undefined,
                        })
                      }
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>

                  <div>
                    <Label className="text-sm text-slate-400 mb-2 block">Max Price ($)</Label>
                    <Input
                      type="number"
                      placeholder="No maximum"
                      value={localCriteria.maxPrice || ''}
                      onChange={(e) =>
                        setLocalCriteria({
                          ...localCriteria,
                          maxPrice: e.target.value ? parseFloat(e.target.value) : undefined,
                        })
                      }
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-slate-400 mb-2 block">Min 24h Change (%)</Label>
                    <Input
                      type="number"
                      placeholder="No minimum"
                      value={localCriteria.minChange || ''}
                      onChange={(e) =>
                        setLocalCriteria({
                          ...localCriteria,
                          minChange: e.target.value ? parseFloat(e.target.value) : undefined,
                        })
                      }
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>

                  <div>
                    <Label className="text-sm text-slate-400 mb-2 block">Max 24h Change (%)</Label>
                    <Input
                      type="number"
                      placeholder="No maximum"
                      value={localCriteria.maxChange || ''}
                      onChange={(e) =>
                        setLocalCriteria({
                          ...localCriteria,
                          maxChange: e.target.value ? parseFloat(e.target.value) : undefined,
                        })
                      }
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-slate-400 mb-2 block">Min RSI</Label>
                    <Input
                      type="number"
                      placeholder="No minimum"
                      min="0"
                      max="100"
                      value={localCriteria.minRSI || ''}
                      onChange={(e) =>
                        setLocalCriteria({
                          ...localCriteria,
                          minRSI: e.target.value ? parseFloat(e.target.value) : undefined,
                        })
                      }
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>

                  <div>
                    <Label className="text-sm text-slate-400 mb-2 block">Max RSI</Label>
                    <Input
                      type="number"
                      placeholder="No maximum"
                      min="0"
                      max="100"
                      value={localCriteria.maxRSI || ''}
                      onChange={(e) =>
                        setLocalCriteria({
                          ...localCriteria,
                          maxRSI: e.target.value ? parseFloat(e.target.value) : undefined,
                        })
                      }
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <Label className="text-sm text-slate-300">Require Stop Loss</Label>
                    <input
                      type="checkbox"
                      checked={localCriteria.hasStopLoss}
                      onChange={(e) =>
                        setLocalCriteria({ ...localCriteria, hasStopLoss: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <Label className="text-sm text-slate-300">Require Take Profit</Label>
                    <input
                      type="checkbox"
                      checked={localCriteria.hasTakeProfit}
                      onChange={(e) =>
                        setLocalCriteria({ ...localCriteria, hasTakeProfit: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Presets */}
              <TabsContent value="presets" className="mt-4">
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleFavorite(preset.id)}
                          className="text-slate-400 hover:text-yellow-400"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              preset.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''
                            }`}
                          />
                        </button>
                        <div>
                          <div className="font-medium text-white">{preset.name}</div>
                          <div className="text-xs text-slate-400">
                            {new Date(preset.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleLoadPreset(preset)}
                          className="bg-blue-600 hover:bg-blue-500"
                        >
                          Load
                        </Button>
                        {!builtInPresets.find(p => p.id === preset.id) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeletePreset(preset.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="flex gap-2 pt-4 mt-4 border-t border-slate-700">
              <Button
                variant="outline"
                onClick={handleReset}
                className="flex-1"
              >
                Reset All
              </Button>
              <Button
                onClick={handleApply}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Apply Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Preset Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Save Filter Preset</DialogTitle>
            <DialogDescription className="text-slate-400">
              Save your current filter configuration for quick access later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Preset Name</Label>
              <Input
                placeholder="e.g., My Favorite Setup"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="mt-2 bg-slate-800 border-slate-700"
              />
            </div>

            <div className="bg-slate-800/50 p-3 rounded-lg">
              <div className="text-xs text-slate-400 mb-2">Active Filters:</div>
              <div className="text-sm text-slate-300">{activeCount} criteria set</div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePreset} className="bg-blue-600 hover:bg-blue-500">
              <Save className="w-4 h-4 mr-2" />
              Save Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
