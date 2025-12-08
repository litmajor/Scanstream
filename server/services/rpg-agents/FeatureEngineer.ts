/**
 * Feature Engineer Service
 * Creates new features on-the-fly by combining existing indicators
 * Tracks feature importance and enables automatic pruning
 */

export interface FeatureDefinition {
  name: string;
  formula: string;
  sourceFeatures: string[];
  combineMethod: 'multiply' | 'divide' | 'add' | 'subtract' | 'ratio' | 'zscore' | 'cross';
  weight: number;
  importance: number;
  usageCount: number;
  successRate: number;
  createdAt: Date;
  lastUsed: Date;
}

export interface FeatureSet {
  id: string;
  features: Map<string, FeatureDefinition>;
  performance: FeatureSetPerformance;
  agentId: string;
}

export interface FeatureSetPerformance {
  totalSignals: number;
  successfulSignals: number;
  avgReturn: number;
  sharpeRatio: number;
  lastUpdated: Date;
}

export interface FeatureImportance {
  featureName: string;
  importance: number;
  correlationWithSuccess: number;
  usageFrequency: number;
  avgContribution: number;
}

export class FeatureEngineer {
  private engineeredFeatures: Map<string, FeatureDefinition> = new Map();
  private featureSets: Map<string, FeatureSet> = new Map();
  private featureHistory: Map<string, number[]> = new Map();
  private pruneThreshold: number = 0.1;
  private maxFeatures: number = 50;

  constructor() {
    this.initializeBaseFeatures();
  }

  private initializeBaseFeatures(): void {
    const baseFeatures = [
      'rsi', 'macd', 'macdSignal', 'macdHistogram', 'bbUpper', 'bbLower', 'bbMiddle',
      'ema20', 'ema50', 'sma20', 'sma50', 'adx', 'atr', 'volume', 'volumeRatio',
      'momentum', 'roc', 'stochK', 'stochD', 'obv', 'vwap', 'support', 'resistance'
    ];

    baseFeatures.forEach(name => {
      this.engineeredFeatures.set(name, {
        name,
        formula: name,
        sourceFeatures: [name],
        combineMethod: 'multiply',
        weight: 1.0,
        importance: 0.5,
        usageCount: 0,
        successRate: 0.5,
        createdAt: new Date(),
        lastUsed: new Date()
      });
    });
  }

  /**
   * Create a new engineered feature by combining existing ones
   */
  createFeature(
    name: string,
    sourceFeatures: string[],
    combineMethod: FeatureDefinition['combineMethod']
  ): FeatureDefinition {
    const formula = this.generateFormula(sourceFeatures, combineMethod);
    
    const newFeature: FeatureDefinition = {
      name,
      formula,
      sourceFeatures,
      combineMethod,
      weight: 0.5,
      importance: 0.3,
      usageCount: 0,
      successRate: 0.5,
      createdAt: new Date(),
      lastUsed: new Date()
    };

    this.engineeredFeatures.set(name, newFeature);
    return newFeature;
  }

  private generateFormula(sourceFeatures: string[], method: string): string {
    switch (method) {
      case 'multiply':
        return sourceFeatures.join(' * ');
      case 'divide':
        return sourceFeatures.join(' / ');
      case 'add':
        return sourceFeatures.join(' + ');
      case 'subtract':
        return sourceFeatures.join(' - ');
      case 'ratio':
        return `(${sourceFeatures[0]} / ${sourceFeatures[1]})`;
      case 'zscore':
        return `zscore(${sourceFeatures[0]})`;
      case 'cross':
        return `cross(${sourceFeatures.join(', ')})`;
      default:
        return sourceFeatures.join(' ? ');
    }
  }

  /**
   * Calculate engineered feature value from market data
   */
  calculateFeature(featureName: string, marketData: Record<string, number>): number {
    const feature = this.engineeredFeatures.get(featureName);
    if (!feature) return 0;

    feature.usageCount++;
    feature.lastUsed = new Date();

    const values = feature.sourceFeatures.map(sf => marketData[sf] || 0);
    
    switch (feature.combineMethod) {
      case 'multiply':
        return values.reduce((a, b) => a * b, 1);
      case 'divide':
        return values[1] !== 0 ? values[0] / values[1] : 0;
      case 'add':
        return values.reduce((a, b) => a + b, 0);
      case 'subtract':
        return values.reduce((a, b) => a - b);
      case 'ratio':
        return values[1] !== 0 ? values[0] / values[1] : 0;
      case 'zscore':
        return this.calculateZScore(featureName, values[0]);
      case 'cross':
        return values[0] > values[1] ? 1 : values[0] < values[1] ? -1 : 0;
      default:
        return values[0];
    }
  }

  private calculateZScore(featureName: string, value: number): number {
    const history = this.featureHistory.get(featureName) || [];
    history.push(value);
    if (history.length > 100) history.shift();
    this.featureHistory.set(featureName, history);

    if (history.length < 10) return 0;

    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const variance = history.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / history.length;
    const std = Math.sqrt(variance);
    
    return std > 0 ? (value - mean) / std : 0;
  }

  /**
   * Auto-generate feature combinations for an agent
   */
  generateFeatureCombinations(agentType: string): FeatureDefinition[] {
    const combinations: FeatureDefinition[] = [];
    const methods: FeatureDefinition['combineMethod'][] = ['ratio', 'multiply', 'cross', 'zscore'];

    const featurePairs: [string, string][] = [
      ['rsi', 'volumeRatio'],
      ['macd', 'momentum'],
      ['ema20', 'ema50'],
      ['adx', 'atr'],
      ['stochK', 'stochD'],
      ['support', 'resistance'],
      ['bbUpper', 'bbLower']
    ];

    featurePairs.forEach(([f1, f2]) => {
      methods.forEach(method => {
        const name = `${agentType}_${f1}_${method}_${f2}`;
        if (!this.engineeredFeatures.has(name)) {
          combinations.push(this.createFeature(name, [f1, f2], method));
        }
      });
    });

    return combinations;
  }

  /**
   * Update feature importance based on signal outcome
   */
  updateFeatureImportance(
    featureName: string,
    signalSuccess: boolean,
    contribution: number
  ): void {
    const feature = this.engineeredFeatures.get(featureName);
    if (!feature) return;

    const successWeight = signalSuccess ? 1 : 0;
    const alpha = 0.1;

    feature.successRate = feature.successRate * (1 - alpha) + successWeight * alpha;
    feature.importance = feature.importance * (1 - alpha) + Math.abs(contribution) * alpha;
    feature.weight = feature.successRate * feature.importance;
  }

  /**
   * Prune low-value features automatically
   */
  pruneFeatures(): string[] {
    const prunedFeatures: string[] = [];
    const sortedFeatures = Array.from(this.engineeredFeatures.entries())
      .filter(([name]) => !this.isBaseFeature(name))
      .sort((a, b) => a[1].weight - b[1].weight);

    for (const [name, feature] of sortedFeatures) {
      if (feature.weight < this.pruneThreshold && feature.usageCount > 10) {
        this.engineeredFeatures.delete(name);
        prunedFeatures.push(name);
      }

      if (this.engineeredFeatures.size <= this.maxFeatures) break;
    }

    return prunedFeatures;
  }

  private isBaseFeature(name: string): boolean {
    return !name.includes('_');
  }

  /**
   * Get feature importance rankings
   */
  getFeatureImportance(): FeatureImportance[] {
    return Array.from(this.engineeredFeatures.values())
      .map(f => ({
        featureName: f.name,
        importance: f.importance,
        correlationWithSuccess: f.successRate,
        usageFrequency: f.usageCount,
        avgContribution: f.weight
      }))
      .sort((a, b) => b.importance - a.importance);
  }

  /**
   * Create a feature set for A/B testing
   */
  createFeatureSet(agentId: string, featureNames: string[]): FeatureSet {
    const features = new Map<string, FeatureDefinition>();
    
    featureNames.forEach(name => {
      const feature = this.engineeredFeatures.get(name);
      if (feature) {
        features.set(name, { ...feature });
      }
    });

    const featureSet: FeatureSet = {
      id: `fs_${agentId}_${Date.now()}`,
      features,
      performance: {
        totalSignals: 0,
        successfulSignals: 0,
        avgReturn: 0,
        sharpeRatio: 0,
        lastUpdated: new Date()
      },
      agentId
    };

    this.featureSets.set(featureSet.id, featureSet);
    return featureSet;
  }

  /**
   * Update feature set performance for A/B comparison
   */
  updateFeatureSetPerformance(
    featureSetId: string,
    returnPct: number,
    success: boolean
  ): void {
    const featureSet = this.featureSets.get(featureSetId);
    if (!featureSet) return;

    featureSet.performance.totalSignals++;
    if (success) featureSet.performance.successfulSignals++;
    
    const alpha = 0.1;
    featureSet.performance.avgReturn = 
      featureSet.performance.avgReturn * (1 - alpha) + returnPct * alpha;
    featureSet.performance.lastUpdated = new Date();
  }

  /**
   * Compare two feature sets for A/B testing
   */
  compareFeatureSets(setIdA: string, setIdB: string): {
    winner: string;
    comparison: Record<string, any>;
  } {
    const setA = this.featureSets.get(setIdA);
    const setB = this.featureSets.get(setIdB);

    if (!setA || !setB) {
      return { winner: 'unknown', comparison: {} };
    }

    const winRateA = setA.performance.successfulSignals / Math.max(1, setA.performance.totalSignals);
    const winRateB = setB.performance.successfulSignals / Math.max(1, setB.performance.totalSignals);

    return {
      winner: winRateA > winRateB ? setIdA : setIdB,
      comparison: {
        setA: {
          id: setIdA,
          winRate: winRateA,
          avgReturn: setA.performance.avgReturn,
          totalSignals: setA.performance.totalSignals,
          featureCount: setA.features.size
        },
        setB: {
          id: setIdB,
          winRate: winRateB,
          avgReturn: setB.performance.avgReturn,
          totalSignals: setB.performance.totalSignals,
          featureCount: setB.features.size
        }
      }
    };
  }

  getAllFeatures(): FeatureDefinition[] {
    return Array.from(this.engineeredFeatures.values());
  }

  getFeatureSet(id: string): FeatureSet | undefined {
    return this.featureSets.get(id);
  }

  getAllFeatureSets(): any[] {
    return Array.from(this.featureSets.values()).map(set => ({
      ...set,
      features: Object.fromEntries(set.features)
    }));
  }

  getFeatureSetSerialized(id: string): any | undefined {
    const set = this.featureSets.get(id);
    if (!set) return undefined;
    return {
      ...set,
      features: Object.fromEntries(set.features)
    };
  }
}

export const featureEngineer = new FeatureEngineer();
