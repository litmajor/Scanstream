
export type ChannelType = 
  | 'momentum'
  | 'reversion'
  | 'trend'
  | 'ml_prediction'
  | 'support_resistance'
  | 'gap'
  | 'volume_profile'
  | 'orderflow';

export interface ChannelData {
  type: ChannelType;
  timestamp: Date;
  symbol: string;
  data: any;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class InformationChannelSystem {
  private channels: Map<ChannelType, ChannelData[]> = new Map();
  private subscribers: Map<ChannelType, Set<string>> = new Map();

  constructor() {
    this.initializeChannels();
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
