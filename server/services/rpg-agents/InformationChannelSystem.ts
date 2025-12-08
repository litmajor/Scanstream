
export type ChannelType = 
  | 'momentum'
  | 'reversion'
  | 'trend'
  | 'ml_prediction'
  | 'support_resistance'
  | 'gap'
  | 'volume_profile'
  | 'orderflow';

// 67 dataframe features mapped to categories
export type DataframeFeature = 
  // Price & Volume
  | 'close' | 'volume' | 'volumeRatio' | 'volumeTrend'
  // Momentum
  | 'rsi' | 'macd' | 'macdHistogram' | 'momentum' | 'roc' | 'cmo'
  // Trend
  | 'ema20' | 'ema50' | 'sma200' | 'adx' | 'trendStrength'
  // Volatility
  | 'atr' | 'volatility' | 'bbPosition' | 'bbWidth'
  // Order Flow
  | 'bidAskRatio' | 'spread' | 'orderImbalance'
  // Support/Resistance
  | 'support' | 'resistance' | 'priceToSupport' | 'priceToResistance';

export interface ChannelData {
  type: ChannelType;
  timestamp: Date;
  symbol: string;
  data: any;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface FeatureSubscription {
  agentName: string;
  feature: DataframeFeature;
  weight: number; // 0-1, how important this feature is to this agent
  channelType: ChannelType;
  performanceHistory: number[]; // Track correlation with successful trades
  lastUpdated: Date;
}

export interface FeatureImportance {
  feature: DataframeFeature;
  globalImportance: number; // How important globally
  regimeSpecific: Map<string, number>; // Importance per regime (BULL, BEAR, RANGING)
  topPerformers: string[]; // Which agents use this best
}

export class InformationChannelSystem {
  private channels: Map<ChannelType, ChannelData[]> = new Map();
  private subscribers: Map<ChannelType, Set<string>> = new Map();
  
  // NEW: Feature-level subscriptions
  private featureSubscriptions: Map<string, FeatureSubscription[]> = new Map(); // agentName -> subscriptions
  private featureImportance: Map<DataframeFeature, FeatureImportance> = new Map();
  private featureCorrelations: Map<DataframeFeature, Map<DataframeFeature, number>> = new Map();

  constructor() {
    this.initializeChannels();
    this.initializeFeatureImportance();
  }

  private initializeChannels(): void {
    const channelTypes: ChannelType[] = [
      'momentum',
      'reversion',
      'trend',
      'ml_prediction',
      'support_resistance',
      'gap',
      'volume_profile',
      'orderflow'
    ];

    channelTypes.forEach(type => {
      this.channels.set(type, []);
      this.subscribers.set(type, new Set());
    });
  }

  /**
   * Subscribe an agent to a channel
   */
  subscribe(agentName: string, channelType: ChannelType): void {
    const subs = this.subscribers.get(channelType);
    if (subs) {
      subs.add(agentName);
      console.log(`📡 ${agentName} subscribed to ${channelType} channel`);
    }
  }

  /**
   * Unsubscribe an agent from a channel
   */
  unsubscribe(agentName: string, channelType: ChannelType): void {
    const subs = this.subscribers.get(channelType);
    if (subs) {
      subs.delete(agentName);
      console.log(`📴 ${agentName} unsubscribed from ${channelType} channel`);
    }
  }

  /**
   * Broadcast data to a channel
   */
  broadcast(channelType: ChannelType, data: Omit<ChannelData, 'type'>): void {
    const channelData: ChannelData = {
      type: channelType,
      ...data
    };

    const channel = this.channels.get(channelType);
    if (channel) {
      channel.push(channelData);

      // Keep only last 100 messages per channel
      if (channel.length > 100) {
        channel.shift();
      }

      const subscriberCount = this.subscribers.get(channelType)?.size || 0;
      if (data.priority === 'CRITICAL') {
        console.log(`🚨 [${channelType}] CRITICAL broadcast to ${subscriberCount} agents`);
      }
    }
  }

  /**
   * Get recent data from a channel
   */
  getChannelData(channelType: ChannelType, limit: number = 10): ChannelData[] {
    const channel = this.channels.get(channelType);
    if (!channel) return [];

    return channel.slice(-limit);
  }

  /**
   * Get all channels an agent is subscribed to
   */
  getAgentSubscriptions(agentName: string): ChannelType[] {
    const subscriptions: ChannelType[] = [];

    for (const [channelType, subs] of this.subscribers) {
      if (subs.has(agentName)) {
        subscriptions.push(channelType);
      }
    }

    return subscriptions;
  }

  /**
   * Process raw market data and route to appropriate channels
   */
  processMarketData(marketData: any): void {
    const { symbol, price, volume, regime, indicators } = marketData;

    // Route to momentum channel
    if (indicators?.rsi > 70 || indicators?.rsi < 30) {
      this.broadcast('momentum', {
        timestamp: new Date(),
        symbol,
        data: { rsi: indicators.rsi, momentum: indicators.momentum },
        priority: 'HIGH'
      });
    }

    // Route to reversion channel
    if (regime === 'SIDEWAYS' && indicators?.bb_position) {
      this.broadcast('reversion', {
        timestamp: new Date(),
        symbol,
        data: { bb_position: indicators.bb_position, mean_distance: indicators.mean_distance },
        priority: 'MEDIUM'
      });
    }

    // Route to trend channel
    if (regime?.includes('TRENDING')) {
      this.broadcast('trend', {
        timestamp: new Date(),
        symbol,
        data: { trend_strength: indicators?.adx, ema_alignment: indicators?.ema_aligned },
        priority: 'HIGH'
      });
    }

    // Route to gap channel
    if (indicators?.gap_size > 2.0) {
      this.broadcast('gap', {
        timestamp: new Date(),
        symbol,
        data: { gap_size: indicators.gap_size, gap_direction: indicators.gap_direction },
        priority: 'CRITICAL'
      });
    }
  }

  /**
   * Initialize feature importance tracking
   */
  private initializeFeatureImportance(): void {
    const features: DataframeFeature[] = [
      'close', 'volume', 'volumeRatio', 'rsi', 'macd', 'momentum',
      'ema20', 'ema50', 'adx', 'trendStrength', 'atr', 'volatility',
      'bbPosition', 'bidAskRatio', 'spread', 'support', 'resistance'
    ];

    features.forEach(feature => {
      this.featureImportance.set(feature, {
        feature,
        globalImportance: 0.5,
        regimeSpecific: new Map([
          ['BULL', 0.5],
          ['BEAR', 0.5],
          ['RANGING', 0.5],
          ['VOLATILE', 0.5]
        ]),
        topPerformers: []
      });
    });
  }

  /**
   * Subscribe agent to specific features with weights
   */
  subscribeToFeatures(
    agentName: string,
    features: Array<{ feature: DataframeFeature; weight: number; channelType: ChannelType }>
  ): void {
    const subscriptions: FeatureSubscription[] = features.map(f => ({
      agentName,
      feature: f.feature,
      weight: f.weight,
      channelType: f.channelType,
      performanceHistory: [],
      lastUpdated: new Date()
    }));

    this.featureSubscriptions.set(agentName, subscriptions);
    
    // Also subscribe to the channels
    features.forEach(f => this.subscribe(agentName, f.channelType));

    console.log(`📡 ${agentName} subscribed to ${features.length} features`);
  }

  /**
   * Get relevant features for agent based on market regime
   */
  getRelevantFeatures(agentName: string, regime: string): DataframeFeature[] {
    const subs = this.featureSubscriptions.get(agentName) || [];
    
    return subs
      .filter(sub => {
        const importance = this.featureImportance.get(sub.feature);
        const regimeScore = importance?.regimeSpecific.get(regime) || 0.5;
        return regimeScore * sub.weight > 0.3; // Threshold for relevance
      })
      .sort((a, b) => b.weight - a.weight)
      .map(sub => sub.feature);
  }

  /**
   * Update feature performance after trade
   */
  updateFeaturePerformance(
    agentName: string,
    features: DataframeFeature[],
    tradeProfit: number,
    regime: string
  ): void {
    const subs = this.featureSubscriptions.get(agentName);
    if (!subs) return;

    features.forEach(feature => {
      const sub = subs.find(s => s.feature === feature);
      if (sub) {
        // Track performance (normalized to -1 to 1)
        const normalizedProfit = Math.max(-1, Math.min(1, tradeProfit / 100));
        sub.performanceHistory.push(normalizedProfit);

        // Keep last 50 trades
        if (sub.performanceHistory.length > 50) {
          sub.performanceHistory.shift();
        }

        // Update global importance
        const importance = this.featureImportance.get(feature);
        if (importance && sub.performanceHistory.length >= 10) {
          const avgPerformance = sub.performanceHistory.reduce((a, b) => a + b, 0) / sub.performanceHistory.length;
          
          // Update regime-specific importance
          const currentRegimeScore = importance.regimeSpecific.get(regime) || 0.5;
          const newScore = currentRegimeScore * 0.9 + avgPerformance * 0.1;
          importance.regimeSpecific.set(regime, Math.max(0, Math.min(1, newScore)));

          // Update top performers
          if (avgPerformance > 0.6 && !importance.topPerformers.includes(agentName)) {
            importance.topPerformers.push(agentName);
            console.log(`⭐ ${agentName} is now a top performer with ${feature}`);
          }
        }
      }
    });
  }

  /**
   * Get feature recommendations for agent based on regime and top performers
   */
  getFeatureRecommendations(agentName: string, regime: string): Array<{ feature: DataframeFeature; reason: string; score: number }> {
    const recommendations: Array<{ feature: DataframeFeature; reason: string; score: number }> = [];
    const currentSubs = this.featureSubscriptions.get(agentName) || [];
    const currentFeatures = new Set(currentSubs.map(s => s.feature));

    this.featureImportance.forEach((importance, feature) => {
      if (currentFeatures.has(feature)) return; // Already subscribed

      const regimeScore = importance.regimeSpecific.get(regime) || 0.5;
      const topPerformerBonus = importance.topPerformers.length > 0 ? 0.2 : 0;
      const score = regimeScore + topPerformerBonus;

      if (score > 0.7) {
        const topPerformer = importance.topPerformers[0];
        recommendations.push({
          feature,
          reason: topPerformer 
            ? `${topPerformer} achieved ${(regimeScore * 100).toFixed(0)}% success in ${regime} regime`
            : `High performance in ${regime} regime`,
          score
        });
      }
    });

    return recommendations.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  /**
   * Calculate feature correlations
   */
  calculateFeatureCorrelations(dataframes: any[]): void {
    if (dataframes.length < 20) return;

    const features: DataframeFeature[] = ['rsi', 'macd', 'momentum', 'bbPosition', 'adx', 'volatility'];
    
    features.forEach(f1 => {
      const corrs = new Map<DataframeFeature, number>();
      
      features.forEach(f2 => {
        if (f1 === f2) return;
        
        const values1 = dataframes.map(d => d[f1] || 0);
        const values2 = dataframes.map(d => d[f2] || 0);
        const correlation = this.pearsonCorrelation(values1, values2);
        
        if (Math.abs(correlation) > 0.7) {
          corrs.set(f2, correlation);
        }
      });
      
      this.featureCorrelations.set(f1, corrs);
    });
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Get feature insights for debugging/monitoring
   */
  getFeatureInsights() {
    const insights: any = {};

    this.featureImportance.forEach((importance, feature) => {
      insights[feature] = {
        globalImportance: importance.globalImportance,
        regimeScores: Object.fromEntries(importance.regimeSpecific),
        topPerformers: importance.topPerformers,
        correlatedWith: Array.from(this.featureCorrelations.get(feature)?.entries() || [])
          .map(([f, corr]) => ({ feature: f, correlation: corr }))
      };
    });

    return insights;
  }

  /**
   * Get channel statistics
   */
  getChannelStats(): any {
    const stats: any = {};

    for (const [channelType, channel] of this.channels) {
      const subscriberCount = this.subscribers.get(channelType)?.size || 0;
      stats[channelType] = {
        messages: channel.length,
        subscribers: subscriberCount,
        last_broadcast: channel.length > 0 ? channel[channel.length - 1].timestamp : null
      };
    }

    return stats;
  }
}
