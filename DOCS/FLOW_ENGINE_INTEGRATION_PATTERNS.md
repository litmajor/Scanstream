/**
 * FLOW ENGINE + PHYSICS AGENTS - Integration Patterns
 * 
 * Real-world usage patterns and integration scenarios
 */

// ============================================================================
// PATTERN 1: LIVE TRADING SIGNAL STREAM
// ============================================================================

import { EventEmitter } from 'events';
import FlowPhysicsAgent from './server/services/rpg-agents/FlowPhysicsAgent';

class LiveTradingStream extends EventEmitter {
  private agents: FlowPhysicsAgent[] = [];
  private lastSignals = new Map<string, any>();

  constructor(symbols: string[]) {
    super();
    // Create one agent per symbol
    symbols.forEach(symbol => {
      this.agents.push(new FlowPhysicsAgent(`Flow-${symbol}`, 'balanced'));
    });
  }

  // Called on each price update (e.g., every tick or bar)
  async onPriceUpdate(symbol: string, flowData: any[]) {
    const agent = this.agents.find(a => a.name.includes(symbol));
    if (!agent) return;

    const signal = agent.generateSignal(flowData);

    // Track state changes
    const prevSignal = this.lastSignals.get(symbol);
    const hasStateChange = !prevSignal || prevSignal.action !== signal.action;

    if (hasStateChange) {
      this.emit('signal_changed', {
        symbol,
        timestamp: Date.now(),
        signal,
        severity: signal.confidence,
      });

      this.lastSignals.set(symbol, signal);
    }

    // Also emit all signals (for monitoring/logging)
    this.emit('signal_update', {
      symbol,
      timestamp: Date.now(),
      signal,
    });
  }
}

// Usage:
const stream = new LiveTradingStream(['BTC/USDT', 'ETH/USDT']);

stream.on('signal_changed', ({ symbol, signal }) => {
  console.log(`[${symbol}] Signal changed: ${signal.action}`);
  console.log(`  Entry: $${signal.entry.toFixed(2)}`);
  console.log(`  Target: $${signal.target.toFixed(2)}`);
  console.log(`  Stop: $${signal.stop.toFixed(2)}`);
  console.log(`  Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
});

// ============================================================================
// PATTERN 2: MULTI-AGENT VOTING SYSTEM
// ============================================================================

class AgentVotingSystem {
  private agents: Map<string, FlowPhysicsAgent> = new Map();

  constructor() {
    // Create agents with different personalities
    this.agents.set('aggressive', new FlowPhysicsAgent('Rocket', 'aggressive'));
    this.agents.set('balanced', new FlowPhysicsAgent('Captain', 'balanced'));
    this.agents.set('conservative', new FlowPhysicsAgent('Sage', 'conservative'));
  }

  vote(flowData: any[]) {
    const votes = {
      BUY: 0,
      SELL: 0,
      HOLD: 0,
    };

    const signals = [];

    for (const [personality, agent] of this.agents.entries()) {
      const signal = agent.generateSignal(flowData);
      votes[signal.action]++;
      signals.push({ personality, signal });
    }

    // Consensus decision
    let decision = 'HOLD';
    if (votes.BUY > votes.SELL) decision = 'BUY';
    if (votes.SELL > votes.BUY) decision = 'SELL';

    // Only trade if consensus (2+ agents agree)
    const consensusStrength = Math.max(votes.BUY, votes.SELL);

    return {
      decision,
      confidence: consensusStrength / this.agents.size,
      votes,
      signals,
      shouldTrade: consensusStrength >= 2,
    };
  }
}

// Usage:
const voting = new AgentVotingSystem();
const result = voting.vote(flowData);

if (result.shouldTrade) {
  console.log(`Consensus: ${result.decision} (${result.consensusStrength}/3 agents)`);
}

// ============================================================================
// PATTERN 3: DYNAMIC PARAMETER TUNING
// ============================================================================

class AdaptiveFlowAgent {
  private agent: FlowPhysicsAgent;
  private marketRegime: 'trending' | 'ranging' | 'volatile' = 'balanced';
  private volatility = 0.5;

  constructor() {
    this.agent = new FlowPhysicsAgent('Adaptive', 'balanced');
  }

  // Analyze market regime from flow metrics
  analyzeRegime(flowResult: any): 'trending' | 'ranging' | 'volatile' {
    if (flowResult.turbulenceLevel === 'extreme') {
      return 'volatile';
    }

    if (
      flowResult.pressureTrend === 'rising' &&
      flowResult.energyTrend === 'accelerating'
    ) {
      return 'trending';
    }

    if (flowResult.averageForce < 0.005 && flowResult.pressure < 0.2) {
      return 'ranging';
    }

    return 'trending';
  }

  // Adjust agent personality based on regime
  adapPersonality(regime: string) {
    switch (regime) {
      case 'trending':
        // Aggressive in trends - take full risk
        this.agent.skill_levels['pattern_recognition'] = 5;
        this.volatility = 0.8;
        break;

      case 'ranging':
        // Conservative in ranges - smaller targets
        this.agent.skill_levels['pattern_recognition'] = 2;
        this.volatility = 0.3;
        break;

      case 'volatile':
        // Balanced in chop - wait for clarity
        this.agent.skill_levels['pattern_recognition'] = 3;
        this.volatility = 0.4;
        break;
    }
  }

  generateAdaptiveSignal(flowData: any[], flowMetrics: any) {
    const regime = this.analyzeRegime(flowMetrics);
    this.adapPersonality(regime);

    const signal = this.agent.generateSignal(flowData);

    // Scale position size by regime
    const positionSizeMultiplier =
      regime === 'trending' ? 1.0 :
      regime === 'ranging' ? 0.5 :
      0.3; // volatile

    return {
      ...signal,
      position_size_multiplier: positionSizeMultiplier,
      regime,
    };
  }
}

// ============================================================================
// PATTERN 4: BACKTESTING HARNESS
// ============================================================================

class BacktestHarness {
  private agent: FlowPhysicsAgent;
  private trades: any[] = [];
  private stats = {
    total_trades: 0,
    winning_trades: 0,
    losing_trades: 0,
    total_pnl: 0,
    max_drawdown: 0,
    win_rate: 0,
    sharpe_ratio: 0,
  };

  constructor(agentName: string = 'BacktestAgent') {
    this.agent = new FlowPhysicsAgent(agentName, 'balanced');
  }

  // Run backtest on historical data
  async backtest(historicalData: any[], tradeExecutor: any) {
    console.log(`Starting backtest on ${historicalData.length} candles...`);

    let position = null;

    for (let i = 100; i < historicalData.length; i++) {
      const window = historicalData.slice(Math.max(0, i - 100), i + 1);

      const signal = this.agent.generateSignal(window);

      // Entry
      if (position === null && signal.action !== 'HOLD') {
        position = {
          entry_price: signal.entry,
          entry_time: historicalData[i].timestamp,
          target: signal.target,
          stop: signal.stop,
          type: signal.action,
          entry_confidence: signal.confidence,
        };

        console.log(
          `[${position.entry_time}] Entry ${position.type} @ ${position.entry_price.toFixed(2)}`
        );
      }

      // Exit
      if (position) {
        const currentPrice = historicalData[i].close;

        // Hit target
        if (
          (position.type === 'BUY' && currentPrice >= position.target) ||
          (position.type === 'SELL' && currentPrice <= position.target)
        ) {
          const pnl =
            position.type === 'BUY'
              ? position.target - position.entry_price
              : position.entry_price - position.target;

          this.recordTrade({
            ...position,
            exit_price: position.target,
            exit_time: historicalData[i].timestamp,
            exit_reason: 'target_hit',
            pnl,
          });

          position = null;
        }

        // Hit stop
        if (
          (position.type === 'BUY' && currentPrice <= position.stop) ||
          (position.type === 'SELL' && currentPrice >= position.stop)
        ) {
          const pnl =
            position.type === 'BUY'
              ? position.stop - position.entry_price
              : position.entry_price - position.stop;

          this.recordTrade({
            ...position,
            exit_price: position.stop,
            exit_time: historicalData[i].timestamp,
            exit_reason: 'stop_hit',
            pnl,
          });

          position = null;
        }
      }
    }

    this.calculateStats();
    return this.getReport();
  }

  private recordTrade(trade: any) {
    this.trades.push(trade);
    this.stats.total_trades++;

    if (trade.pnl > 0) {
      this.stats.winning_trades++;
    } else {
      this.stats.losing_trades++;
    }

    this.stats.total_pnl += trade.pnl;
  }

  private calculateStats() {
    if (this.stats.total_trades === 0) return;

    this.stats.win_rate =
      this.stats.winning_trades / this.stats.total_trades;

    // Update agent with results
    this.trades.forEach(trade => {
      this.agent.updatePerformance({
        profit: trade.pnl,
        profit_pct: (trade.pnl / 42500) * 100, // Assume 42500 position
        market_difficulty: 1.0,
        execution_quality: 0.9,
        regime: 'backtest',
        duration_hours: 4,
      });
    });
  }

  getReport() {
    return {
      agent: this.agent.name,
      stats: this.stats,
      agent_status: this.agent.getStatus(),
      trades: this.trades,
    };
  }
}

// Usage:
const backtest = new BacktestHarness('MyFlowAgent');
const report = await backtest.backtest(historicalData, tradeExecutor);

console.log(`\n📊 Backtest Report:`);
console.log(`   Trades: ${report.stats.total_trades}`);
console.log(`   Win Rate: ${(report.stats.win_rate * 100).toFixed(1)}%`);
console.log(`   Total P&L: $${report.stats.total_pnl.toFixed(2)}`);
console.log(`   Agent Level: ${report.agent_status.level}`);

// ============================================================================
// PATTERN 5: REAL-TIME ALERTING
// ============================================================================

class AlertSystem {
  private agent: FlowPhysicsAgent;
  private webhooks: string[] = [];

  constructor(webhookUrl: string) {
    this.agent = new FlowPhysicsAgent('AlertAgent');
    this.webhooks.push(webhookUrl);
  }

  async onSignal(symbol: string, signal: any) {
    // Check alert criteria
    const shouldAlert =
      signal.action !== 'HOLD' && signal.confidence > 0.65;

    if (shouldAlert) {
      await this.sendAlerts({
        symbol,
        action: signal.action,
        entry: signal.entry,
        target: signal.target,
        stop: signal.stop,
        confidence: (signal.confidence * 100).toFixed(0),
        timestamp: new Date().toISOString(),
        reason: signal.reason,
      });
    }
  }

  private async sendAlerts(data: any) {
    // Discord webhook
    await fetch(this.webhooks[0], {
      method: 'POST',
      body: JSON.stringify({
        embeds: [
          {
            title: `🚀 ${data.action} Signal - ${data.symbol}`,
            fields: [
              { name: 'Entry', value: `$${data.entry.toFixed(2)}`, inline: true },
              { name: 'Target', value: `$${data.target.toFixed(2)}`, inline: true },
              { name: 'Stop', value: `$${data.stop.toFixed(2)}`, inline: true },
              { name: 'Confidence', value: `${data.confidence}%`, inline: true },
              { name: 'Reason', value: data.reason, inline: false },
            ],
            color: data.action === 'BUY' ? 3066993 : 15158332,
            timestamp: data.timestamp,
          },
        ],
      }),
    });

    // Telegram
    // await sendTelegramMessage(data);

    // Email
    // await sendEmailAlert(data);
  }
}

// ============================================================================
// PATTERN 6: A/B TESTING AGENTS
// ============================================================================

class ABTestingFramework {
  private agentA: FlowPhysicsAgent;
  private agentB: FlowPhysicsAgent;
  private results = {
    a: { trades: 0, wins: 0, pnl: 0 },
    b: { trades: 0, wins: 0, pnl: 0 },
  };

  constructor() {
    this.agentA = new FlowPhysicsAgent('AgentA-Aggressive', 'aggressive');
    this.agentB = new FlowPhysicsAgent('AgentB-Conservative', 'conservative');
  }

  // Route trades to each agent 50/50
  decideAgent(symbol: string): 'a' | 'b' {
    const hash = symbol.split('').reduce((h, c) => h + c.charCodeAt(0), 0);
    return hash % 2 === 0 ? 'a' : 'b';
  }

  generateSignal(symbol: string, flowData: any[]) {
    const agent = this.decideAgent(symbol) === 'a' ? this.agentA : this.agentB;
    return agent.generateSignal(flowData);
  }

  recordOutcome(symbol: string, outcome: 'win' | 'loss', pnl: number) {
    const agent = this.decideAgent(symbol);
    this.results[agent].trades++;
    if (outcome === 'win') this.results[agent].wins++;
    this.results[agent].pnl += pnl;
  }

  getWinnerReport() {
    const aWinRate = this.results.a.wins / this.results.a.trades;
    const bWinRate = this.results.b.wins / this.results.b.trades;
    const winner = aWinRate > bWinRate ? 'A' : 'B';

    return {
      winner,
      aStats: this.results.a,
      bStats: this.results.b,
      recommendation: `Agent ${winner} has ${Math.abs((aWinRate - bWinRate) * 100).toFixed(1)}% higher win rate`,
    };
  }
}

// ============================================================================
// PATTERN 7: PORTFOLIO-WIDE COORDINATION
// ============================================================================

class PortfolioManager {
  private agents = new Map<string, FlowPhysicsAgent>();
  private positions = new Map<string, any>();
  private maxRisk = 0.05; // 5% portfolio risk

  addSymbol(symbol: string) {
    this.agents.set(symbol, new FlowPhysicsAgent(`Flow-${symbol}`));
  }

  // Generate coordinated signals for entire portfolio
  async generatePortfolioSignals(data: Map<string, any[]>) {
    const signals = [];
    let totalRisk = 0;

    for (const [symbol, flowData] of data.entries()) {
      const agent = this.agents.get(symbol);
      if (!agent) continue;

      const signal = agent.generateSignal(flowData);

      // Calculate position size based on available risk
      const riskAmount = (signal.entry - signal.stop) * 1; // 1 contract
      const riskPercent = riskAmount / 100000; // assume 100k portfolio

      // Don't open if it exceeds max risk
      if (totalRisk + riskPercent > this.maxRisk) {
        signal.action = 'HOLD';
        signal.reason = `Portfolio risk limit reached (${((totalRisk + riskPercent) * 100).toFixed(2)}%)`;
      }

      totalRisk += riskPercent;
      signals.push({ symbol, signal, risk_percent: riskPercent });
    }

    return {
      signals,
      total_portfolio_risk: totalRisk,
      can_add_more: totalRisk < this.maxRisk,
    };
  }
}

// ============================================================================
// PATTERN 8: CONFIDENCE WEIGHTING
// ============================================================================

class WeightedSignalAnalyzer {
  // Combine multiple data sources with confidence weighting
  analyzeWithWeighting(
    flowSignal: any,
    vfmdSignal: any,
    technicalSignal: any
  ) {
    // Each signal has confidence 0-1
    const weights = {
      flow: flowSignal.confidence,
      vfmd: vfmdSignal.confidence,
      technical: technicalSignal.confidence,
    };

    const totalWeight =
      weights.flow + weights.vfmd + weights.technical;

    // Normalize weights
    weights.flow /= totalWeight;
    weights.vfmd /= totalWeight;
    weights.technical /= totalWeight;

    // Count votes
    const buyVotes =
      (flowSignal.action === 'BUY' ? weights.flow : 0) +
      (vfmdSignal.action === 'BUY' ? weights.vfmd : 0) +
      (technicalSignal.action === 'BUY' ? weights.technical : 0);

    const sellVotes =
      (flowSignal.action === 'SELL' ? weights.flow : 0) +
      (vfmdSignal.action === 'SELL' ? weights.vfmd : 0) +
      (technicalSignal.action === 'SELL' ? weights.technical : 0);

    // Weighted entry price
    const avgEntry =
      (flowSignal.entry * weights.flow +
        vfmdSignal.entry * weights.vfmd +
        technicalSignal.entry * weights.technical) /
      totalWeight;

    const decision = buyVotes > sellVotes ? 'BUY' : 'SELL';
    const confidence = Math.max(buyVotes, sellVotes);

    return {
      decision,
      confidence,
      entry: avgEntry,
      weights,
      sources: {
        flow: flowSignal,
        vfmd: vfmdSignal,
        technical: technicalSignal,
      },
    };
  }
}

export {
  LiveTradingStream,
  AgentVotingSystem,
  AdaptiveFlowAgent,
  BacktestHarness,
  AlertSystem,
  ABTestingFramework,
  PortfolioManager,
  WeightedSignalAnalyzer,
};
