/**
 * VFMD Physics Agent - Usage Examples
 * 
 * Quick-start guide for using the new VFMD early entry detection system
 */

// ============================================================================
// EXAMPLE 1: Direct Agent Usage
// ============================================================================

import VFMDPhysicsAgent from './server/services/rpg-agents/VFMDPhysicsAgent';
import type { MarketTick } from './server/services/vfmd/types';

async function example1_directUsage() {
  console.log('\n=== EXAMPLE 1: Direct VFMD Agent Usage ===\n');

  // Create agent
  const vfmd = new VFMDPhysicsAgent('EarlyBirdAgent', 'aggressive');
  console.log(`Agent: ${vfmd.name} (Level ${vfmd.level})`);

  // Mock market data (in production: fetch from storage)
  const mockTicks: MarketTick[] = generateMockData();

  // Generate signal
  const signal = vfmd.generateSignal(mockTicks);

  console.log('\nGenerated Signal:');
  console.log(`  Action: ${signal.action}`);
  console.log(`  Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
  console.log(`  Entry: $${signal.entry.toFixed(2)}`);
  console.log(`  Target: $${signal.target.toFixed(2)}`);
  console.log(`  Stop: $${signal.stop.toFixed(2)}`);
  console.log(`  Reason: ${signal.reason}`);
}

// ============================================================================
// EXAMPLE 2: Detailed UI Analysis
// ============================================================================

async function example2_uiAnalysis() {
  console.log('\n=== EXAMPLE 2: Detailed UI Analysis ===\n');

  const vfmd = new VFMDPhysicsAgent('AnalystAgent', 'balanced');
  const ticks = generateMockData();

  // Get UI-ready analysis with all metrics
  const analysis = vfmd.getAnalysisForUI(ticks);

  console.log('SIGNAL:');
  console.log(`  Type: ${analysis.signal.type}`);
  console.log(`  Confidence: ${analysis.signal.confidence}`);
  console.log(`  Recommendation: ${analysis.signal.recommendation}`);

  console.log('\nENTRY GUIDANCE:');
  console.log(`  Entry: $${analysis.entry_guidance.suggested_entry}`);
  console.log(`  Target: $${analysis.entry_guidance.profit_target}`);
  console.log(`  Stop: $${analysis.entry_guidance.stop_loss}`);
  console.log(`  Risk/Reward: ${analysis.entry_guidance.risk_reward}:1`);

  console.log('\nFIELD METRICS (Physics):');
  console.log(`  Coherence: ${analysis.field_metrics.coherence} (alignment)`);
  console.log(`  PEG Energy: ${analysis.field_metrics.peg_energy} (stored energy)`);
  console.log(`  Turbulence: ${analysis.field_metrics.turbulence_index} (chaos)`);
  console.log(`  Divergence: ${analysis.field_metrics.divergence} (accum/dist)`);

  console.log('\nMARKET STATE:');
  console.log(`  Volatility: ${analysis.market_state.volatility_regime}`);
  console.log(`  Imbalance: ${analysis.market_state.imbalance_score} (buy/sell pressure)`);
  console.log(`  Pressure Gradient: ${analysis.market_state.pressure_gradient} (acceleration)`);
  console.log(`  Flow Momentum: ${analysis.market_state.flow_momentum} (direction)`);

  console.log('\nKEY FACTORS:');
  analysis.factors.forEach((factor, i) => {
    console.log(`  ${i + 1}. ${factor}`);
  });
}

// ============================================================================
// EXAMPLE 3: API Endpoint Usage
// ============================================================================

async function example3_apiUsage() {
  console.log('\n=== EXAMPLE 3: API Endpoint Usage ===\n');

  const baseUrl = 'http://localhost:5000/api/agents/physics';

  // ENDPOINT 1: VFMD Analysis
  console.log('1. POST /vfmd-analyze');
  const vfmdResponse = await fetch(`${baseUrl}/vfmd-analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: 'BTC/USDT' })
  });
  const vfmdResult = await vfmdResponse.json();
  console.log('   Signal:', vfmdResult.analysis?.signal?.type);
  console.log('   Confidence:', vfmdResult.analysis?.signal?.confidence);

  // ENDPOINT 2: Flow Analysis
  console.log('\n2. POST /flow-analyze');
  const flowResponse = await fetch(`${baseUrl}/flow-analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: 'ETH/USDT' })
  });
  const flowResult = await flowResponse.json();
  console.log('   Direction:', flowResult.flowMetrics?.dominantDirection);
  console.log('   Pressure:', flowResult.flowMetrics?.pressure);

  // ENDPOINT 3: Compare Both Agents
  console.log('\n3. POST /compare');
  const compareResponse = await fetch(`${baseUrl}/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: 'SOL/USDT' })
  });
  const compareResult = await compareResponse.json();
  console.log('   Agents Agree:', compareResult.comparison?.consensus?.actions_agree);
  console.log('   VFMD Action:', compareResult.comparison?.consensus?.vfmd_action);
  console.log('   Flow Action:', compareResult.comparison?.consensus?.flow_action);

  // ENDPOINT 4: List Agents
  console.log('\n4. GET /agents');
  const agentsResponse = await fetch(`${baseUrl}/agents`);
  const agentsResult = await agentsResponse.json();
  console.log('   Agents Available:', agentsResult.agents.length);
  agentsResult.agents.forEach((agent: any) => {
    console.log(`     - ${agent.name} (${agent.type})`);
  });

  // ENDPOINT 5: Status Check
  console.log('\n5. GET /status');
  const statusResponse = await fetch(`${baseUrl}/status`);
  const statusResult = await statusResponse.json();
  console.log('   Status:', statusResult.status);
  console.log('   Agents Ready:', statusResult.agents.length);
}

// ============================================================================
// EXAMPLE 4: Integration with AgentSpawner
// ============================================================================

import { AgentSpawner } from './server/services/rpg-agents/AgentSpawner';
import { AgentArena } from './server/services/rpg-agents/AgentArena';

async function example4_agentSpawner() {
  console.log('\n=== EXAMPLE 4: Integration with AgentSpawner ===\n');

  const arena = new AgentArena();
  const spawner = new AgentSpawner(arena);

  // Spawner can auto-create PHYSICS_VFMD agents
  const decision = {
    shouldSpawn: true,
    agentType: 'PHYSICS_VFMD',
    reason: 'Strong early entry signals detected',
    priority: 9
  };

  console.log(`Spawning: ${decision.agentType}`);
  console.log(`Reason: ${decision.reason}`);

  const newAgent = spawner.spawnAgent(decision);

  console.log(`\n✨ Spawned: ${newAgent.name}`);
  console.log(`   Type: ${newAgent.agent_type}`);
  console.log(`   Level: ${newAgent.level}`);
  console.log(`   Abilities: ${newAgent.abilities.join(', ')}`);
}

// ============================================================================
// EXAMPLE 5: Real-time Backtesting
// ============================================================================

async function example5_backtesting() {
  console.log('\n=== EXAMPLE 5: Real-time Backtesting ===\n');

  import { storage } from './server/storage';

  // Fetch historical data
  console.log('Fetching historical data...');
  const frames = await storage.getMarketFrames('BTC/USDT', 500);

  // Convert to ticks
  const ticks: MarketTick[] = frames.map(f => ({
    timestamp: new Date(f.timestamp).getTime(),
    open: (f.price as any).open,
    high: (f.price as any).high,
    low: (f.price as any).low,
    close: (f.price as any).close,
    volume: f.volume
  }));

  console.log(`Loaded ${ticks.length} ticks`);

  // Backtest with rolling window
  const vfmd = new VFMDPhysicsAgent('BacktestAgent');
  let wins = 0;
  let losses = 0;
  const trades = [];

  // Use 200-bar windows, step by 10 bars
  for (let i = 200; i < ticks.length - 10; i += 10) {
    const window = ticks.slice(i - 200, i);
    const signal = vfmd.generateSignal(window);

    if (signal.action !== 'HOLD') {
      // Check if signal was correct (simplified)
      const futurePrice = ticks[i + 10].close;
      const correct =
        (signal.action === 'BUY' && futurePrice > signal.entry) ||
        (signal.action === 'SELL' && futurePrice < signal.entry);

      if (correct) {
        wins++;
      } else {
        losses++;
      }

      trades.push({
        time: i,
        signal: signal.action,
        price: signal.entry,
        correct
      });
    }
  }

  const winRate = wins / (wins + losses || 1);
  console.log(`\nBacktest Results:`);
  console.log(`  Trades: ${trades.length}`);
  console.log(`  Wins: ${wins}`);
  console.log(`  Losses: ${losses}`);
  console.log(`  Win Rate: ${(winRate * 100).toFixed(1)}%`);
}

// ============================================================================
// EXAMPLE 6: Tuning Field Parameters
// ============================================================================

import { FieldConstructor } from './server/services/vfmd/fieldConstructor';
import { PhysicsCalculator } from './server/services/vfmd/physicsCalculator';

function example6_fieldTuning() {
  console.log('\n=== EXAMPLE 6: Tuning Field Parameters ===\n');

  const prices = generateMockPrices(500);

  // DEFAULT: Balanced approach
  console.log('1. Default Constructor (balanced)');
  const defaults = new FieldConstructor(50, 100, 2.0);
  const defaultField = defaults.constructField(prices);
  const defaultMetrics = PhysicsCalculator.computeAllMetrics(defaultField);
  console.log(`   Coherence: ${(defaultMetrics.coherenceScore * 100).toFixed(1)}%`);
  console.log(`   Turbulence: ${defaultMetrics.turbulenceIndex.toFixed(2)}`);

  // LOW VOLATILITY ASSET: Higher granularity
  console.log('\n2. Low Volatility (high granularity)');
  const fineGrained = new FieldConstructor(100, 150, 1.5);
  const fineField = fineGrained.constructField(prices);
  const fineMetrics = PhysicsCalculator.computeAllMetrics(fineField);
  console.log(`   Coherence: ${(fineMetrics.coherenceScore * 100).toFixed(1)}%`);
  console.log(`   Turbulence: ${fineMetrics.turbulenceIndex.toFixed(2)}`);

  // HIGH VOLATILITY ASSET: Lower granularity
  console.log('\n3. High Volatility (robust)');
  const robust = new FieldConstructor(30, 80, 3.0);
  const robustField = robust.constructField(prices);
  const robustMetrics = PhysicsCalculator.computeAllMetrics(robustField);
  console.log(`   Coherence: ${(robustMetrics.coherenceScore * 100).toFixed(1)}%`);
  console.log(`   Turbulence: ${robustMetrics.turbulenceIndex.toFixed(2)}`);

  console.log('\nTuning Guide:');
  console.log('  High coherence + low turbulence = clean directional flow');
  console.log('  Increase spatial_bins for more price level detail');
  console.log('  Increase temporal_window for longer-term trends');
  console.log('  Increase smoothing_sigma to reduce noise');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateMockData(length = 200): MarketTick[] {
  const ticks: MarketTick[] = [];
  let price = 42000;
  let timestamp = Date.now() - length * 60000; // 1 minute candles

  for (let i = 0; i < length; i++) {
    const change = (Math.random() - 0.48) * 100; // Slight uptrend
    price += change;

    ticks.push({
      timestamp,
      open: price - 50,
      high: price + 100,
      low: price - 100,
      close: price,
      volume: 1000000 + Math.random() * 500000
    });

    timestamp += 60000;
  }

  return ticks;
}

function generateMockPrices(length = 500): number[] {
  const prices: number[] = [];
  let price = 42000;

  for (let i = 0; i < length; i++) {
    const change = (Math.random() - 0.48) * 100;
    price += change;
    prices.push(price);
  }

  return prices;
}

// ============================================================================
// Run Examples
// ============================================================================

async function runAllExamples() {
  try {
    await example1_directUsage();
    await example2_uiAnalysis();
    // await example3_apiUsage(); // Requires running server
    // await example4_agentSpawner(); // Requires AgentArena setup
    // await example5_backtesting(); // Requires storage
    example6_fieldTuning();

    console.log('\n✅ All examples completed!\n');
  } catch (err) {
    console.error('Error running examples:', err);
  }
}

// Uncomment to run:
// runAllExamples();

export {
  example1_directUsage,
  example2_uiAnalysis,
  example3_apiUsage,
  example4_agentSpawner,
  example5_backtesting,
  example6_fieldTuning,
  generateMockData,
  generateMockPrices
};
