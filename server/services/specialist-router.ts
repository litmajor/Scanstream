/**
 * SPECIALIST ROUTER SERVICE
 * 
 * Routes trading signals to specialized agents based on market conditions
 * Uses intelligent rules and fallback mechanisms for optimal performance
 */

import { AgentSpecialization } from './agent-clustering-backtest';

// ============================================================================
// INTERFACES
// ============================================================================

interface MarketContext {
  regime: 'trending' | 'ranging' | 'volatile';
  volatility: number; // 0-100
  momentum: number; // -100 to 100
  volume: number; // relative to average
  trend: number; // -100 to 100
}

interface RoutingDecision {
  primarySpecialist: AgentSpecialization;
  alternativeSpecialists: AgentSpecialization[];
  confidence: number; // 0-1
  reasoning: string;
  conditions: string[];
  fallbackChain: AgentSpecialization[];
}

interface RoutingMetrics {
  routesProcessed: number;
  accurateRoutes: number; // routes that resulted in profit
  successRate: number; // accurate / processed
  avgConfidence: number;
  specialistUtilization: { [specialist: string]: number }; // % of routes
  regimeDistribution: { [regime: string]: number }; // % of time in each regime
}

interface SpecialistProfile {
  specialization: AgentSpecialization;
  strength: number; // 0-1
  matchedRegimes: string[];
  profitability: number; // % wins
  avgReturnPerTrade: number;
  totalTradesHandled: number;
}

// ============================================================================
// SPECIALIST ROUTER
// ============================================================================

export class SpecialistRouter {
  private routingMetrics: RoutingMetrics = {
    routesProcessed: 0,
    accurateRoutes: 0,
    successRate: 0,
    avgConfidence: 0,
    specialistUtilization: {},
    regimeDistribution: { trending: 0, ranging: 0, volatile: 0 },
  };

  private specialistProfiles: Map<AgentSpecialization, SpecialistProfile> = new Map();

  constructor() {
    this.initializeSpecialistProfiles();
  }

  /**
   * Initialize specialist profile definitions
   */
  private initializeSpecialistProfiles(): void {
    const profiles: { [key in AgentSpecialization]: SpecialistProfile } = {
      [AgentSpecialization.MOMENTUM]: {
        specialization: AgentSpecialization.MOMENTUM,
        strength: 0.95,
        matchedRegimes: ['trending', 'strong-directional'],
        profitability: 0.62,
        avgReturnPerTrade: 2.3,
        totalTradesHandled: 0,
      },
      [AgentSpecialization.MEAN_REVERSION]: {
        specialization: AgentSpecialization.MEAN_REVERSION,
        strength: 0.92,
        matchedRegimes: ['ranging', 'consolidation'],
        profitability: 0.68,
        avgReturnPerTrade: 1.5,
        totalTradesHandled: 0,
      },
      [AgentSpecialization.VOLATILITY]: {
        specialization: AgentSpecialization.VOLATILITY,
        strength: 0.85,
        matchedRegimes: ['volatile', 'high-uncertainty'],
        profitability: 0.55,
        avgReturnPerTrade: 3.1,
        totalTradesHandled: 0,
      },
      [AgentSpecialization.RANGE_BOUND]: {
        specialization: AgentSpecialization.RANGE_BOUND,
        strength: 0.88,
        matchedRegimes: ['ranging', 'sideways'],
        profitability: 0.65,
        avgReturnPerTrade: 1.2,
        totalTradesHandled: 0,
      },
      [AgentSpecialization.BREAKOUT]: {
        specialization: AgentSpecialization.BREAKOUT,
        strength: 0.80,
        matchedRegimes: ['breakout', 'key-level-break'],
        profitability: 0.52,
        avgReturnPerTrade: 2.8,
        totalTradesHandled: 0,
      },
      [AgentSpecialization.TREND_FOLLOWING]: {
        specialization: AgentSpecialization.TREND_FOLLOWING,
        strength: 0.90,
        matchedRegimes: ['trending', 'sustained-move'],
        profitability: 0.60,
        avgReturnPerTrade: 2.1,
        totalTradesHandled: 0,
      },
      [AgentSpecialization.GENERAL]: {
        specialization: AgentSpecialization.GENERAL,
        strength: 0.70,
        matchedRegimes: ['any'],
        profitability: 0.50,
        avgReturnPerTrade: 1.0,
        totalTradesHandled: 0,
      },
    };

    for (const [spec, profile] of Object.entries(profiles)) {
      this.specialistProfiles.set(spec as AgentSpecialization, profile);
    }
  }

  /**
   * Route signal based on market context
   */
  route(context: MarketContext, signalType: string): RoutingDecision {
    const conditions: string[] = [];
    const candidates: { specialist: AgentSpecialization; score: number }[] = [];

    // Evaluate each specialist
    for (const [specialist, profile] of this.specialistProfiles) {
      let score = 0;

      // Market regime matching
      if (context.regime === 'trending') {
        if (profile.matchedRegimes.includes('trending')) {
          score += 30;
          conditions.push(`${specialist} good for trending: +30`);
        }
        if (context.momentum > 30) {
          score += 15;
          conditions.push(`${specialist} strong momentum detected: +15`);
        }
      }

      // Ranging market
      if (context.regime === 'ranging') {
        if (profile.matchedRegimes.includes('ranging')) {
          score += 30;
          conditions.push(`${specialist} good for ranging: +30`);
        }
        if (Math.abs(context.momentum) < 20) {
          score += 15;
          conditions.push(`${specialist} low momentum suitable: +15`);
        }
      }

      // Volatile market
      if (context.regime === 'volatile') {
        if (profile.matchedRegimes.includes('volatile')) {
          score += 25;
          conditions.push(`${specialist} designed for volatility: +25`);
        }
        if (context.volatility > 30) {
          score += 20;
          conditions.push(`${specialist} high volatility environment: +20`);
        }
      }

      // Volume analysis
      if (context.volume > 1.5) {
        if ([AgentSpecialization.BREAKOUT, AgentSpecialization.MOMENTUM].includes(specialist)) {
          score += 15;
          conditions.push(`${specialist} high volume signal: +15`);
        }
      }

      // Signal type matching
      if (signalType === 'momentum' && specialist === AgentSpecialization.MOMENTUM) {
        score += 25;
        conditions.push(`${specialist} direct momentum signal match: +25`);
      }
      if (signalType === 'mean-reversion' && specialist === AgentSpecialization.MEAN_REVERSION) {
        score += 25;
        conditions.push(`${specialist} direct mean-reversion signal match: +25`);
      }
      if (signalType === 'breakout' && specialist === AgentSpecialization.BREAKOUT) {
        score += 25;
        conditions.push(`${specialist} direct breakout signal match: +25`);
      }

      // Apply specialist strength modifier
      score *= profile.strength;

      if (score > 0) {
        candidates.push({ specialist, score });
      }
    }

    // Sort by score
    candidates.sort((a, b) => b.score - a.score);

    // Build fallback chain
    const fallbackChain = candidates.map((c) => c.specialization);
    if (fallbackChain.length === 0 || candidates[0].score < 20) {
      fallbackChain.unshift(AgentSpecialization.GENERAL);
    }

    // Primary specialist
    const primary = candidates.length > 0 ? candidates[0].specialist : AgentSpecialization.GENERAL;
    const primaryConfidence = Math.min(1, (candidates[0]?.score || 20) / 100);

    // Alternatives
    const alternatives = candidates
      .slice(1, 3)
      .filter((c) => c.specialist !== primary)
      .map((c) => c.specialist);

    if (alternatives.length < 2) {
      alternatives.push(AgentSpecialization.GENERAL);
    }

    // Generate reasoning
    const reasoning = this.generateRoutingReasoning(context, primary, candidates);

    // Update metrics
    this.updateRoutingMetrics(primary, context.regime, primaryConfidence);

    return {
      primarySpecialist: primary,
      alternativeSpecialists: alternatives.slice(0, 2),
      confidence: Math.round(primaryConfidence * 100) / 100,
      reasoning,
      conditions,
      fallbackChain,
    };
  }

  /**
   * Generate human-readable routing reasoning
   */
  private generateRoutingReasoning(context: MarketContext, selected: AgentSpecialization, candidates: any[]): string {
    const profile = this.specialistProfiles.get(selected);

    if (!profile) {
      return 'Fallback to general agent';
    }

    const topScore = candidates[0]?.score || 0;

    if (context.regime === 'trending' && selected === AgentSpecialization.MOMENTUM) {
      return `Trending market detected. Momentum specialist selected (${Math.round(topScore / 100 * 100)}% confidence)`;
    }
    if (context.regime === 'ranging' && selected === AgentSpecialization.MEAN_REVERSION) {
      return `Ranging market detected. Mean reversion specialist selected (${Math.round(topScore / 100 * 100)}% confidence)`;
    }
    if (context.regime === 'volatile' && selected === AgentSpecialization.VOLATILITY) {
      return `Volatile conditions. Volatility specialist selected (${Math.round(topScore / 100 * 100)}% confidence)`;
    }

    return `Best match: ${selected} specialist (${Math.round(topScore / 100 * 100)}% confidence)`;
  }

  /**
   * Update routing metrics
   */
  private updateRoutingMetrics(specialist: AgentSpecialization, regime: string, confidence: number): void {
    this.routingMetrics.routesProcessed++;

    // Update specialist utilization
    if (!this.routingMetrics.specialistUtilization[specialist]) {
      this.routingMetrics.specialistUtilization[specialist] = 0;
    }
    this.routingMetrics.specialistUtilization[specialist]++;

    // Update regime distribution
    this.routingMetrics.regimeDistribution[regime]++;

    // Update average confidence
    this.routingMetrics.avgConfidence =
      (this.routingMetrics.avgConfidence * (this.routingMetrics.routesProcessed - 1) + confidence) / this.routingMetrics.routesProcessed;
  }

  /**
   * Mark route as successful (resulted in profit)
   */
  markRouteSuccessful(specialist: AgentSpecialization): void {
    this.routingMetrics.accurateRoutes++;
    this.routingMetrics.successRate = this.routingMetrics.accurateRoutes / this.routingMetrics.routesProcessed;

    // Update specialist profile
    const profile = this.specialistProfiles.get(specialist);
    if (profile) {
      profile.totalTradesHandled++;
    }
  }

  /**
   * Get current routing metrics
   */
  getMetrics(): RoutingMetrics {
    const normalized: RoutingMetrics = {
      routesProcessed: this.routingMetrics.routesProcessed,
      accurateRoutes: this.routingMetrics.accurateRoutes,
      successRate: Math.round(this.routingMetrics.successRate * 100) / 100,
      avgConfidence: Math.round(this.routingMetrics.avgConfidence * 100) / 100,
      specialistUtilization: {},
      regimeDistribution: {},
    };

    // Normalize specialist utilization to percentages
    for (const [specialist, count] of Object.entries(this.routingMetrics.specialistUtilization)) {
      normalized.specialistUtilization[specialist] = Math.round((count / this.routingMetrics.routesProcessed) * 10000) / 100;
    }

    // Normalize regime distribution to percentages
    for (const [regime, count] of Object.entries(this.routingMetrics.regimeDistribution)) {
      normalized.regimeDistribution[regime] = Math.round((count / this.routingMetrics.routesProcessed) * 10000) / 100;
    }

    return normalized;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.routingMetrics = {
      routesProcessed: 0,
      accurateRoutes: 0,
      successRate: 0,
      avgConfidence: 0,
      specialistUtilization: {},
      regimeDistribution: { trending: 0, ranging: 0, volatile: 0 },
    };
  }

  /**
   * Get specialist profiles
   */
  getSpecialistProfiles(): Map<AgentSpecialization, SpecialistProfile> {
    return this.specialistProfiles;
  }

  /**
   * Calculate optimal routing for a set of market conditions
   */
  calculateOptimalRouting(contexts: MarketContext[]): { specialist: AgentSpecialization; frequency: number }[] {
    const routeMap = new Map<AgentSpecialization, number>();

    for (const context of contexts) {
      const decision = this.route(context, 'signal');
      const count = (routeMap.get(decision.primarySpecialist) || 0) + 1;
      routeMap.set(decision.primarySpecialist, count);
    }

    const results: { specialist: AgentSpecialization; frequency: number }[] = [];
    for (const [specialist, count] of routeMap) {
      results.push({
        specialist,
        frequency: Math.round((count / contexts.length) * 10000) / 100,
      });
    }

    return results.sort((a, b) => b.frequency - a.frequency);
  }
}

export default SpecialistRouter;
