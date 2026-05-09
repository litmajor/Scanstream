# 🎮 Agent Arena Visualization & Card System Guide

## Overview

The Agent Arena is a comprehensive real-time visualization system for viewing all agents in your trading ecosystem, their individual performance, abilities, and most importantly **how they interact** during decision-making.

This system transforms your agents from abstract backend logic into visual, interactive cards with:
- **Agent Cards**: Individual agent profiles with stats, skills, and achievements
- **Interaction Dashboard**: Real-time consensus voting and decision flows
- **Network Visualization**: Agent ecosystem topology and relationships
- **Leaderboard**: Performance rankings across all metrics
- **Activity Feed**: Real-time logs of agent decisions and trades

---

## Components Overview

### 1. Agent Arena Hub (`agent-arena-hub.tsx`)

The main dashboard showing all agents as interactive cards.

#### Features:
- **Cards View**: Visual representation of each agent
- **Network View**: Shows agent ecosystem structure (Entry, Exit, Combat agents)
- **Leaderboard View**: Ranked by Sharpe ratio, win rate, profit factor

#### Agent Card Layout:
```
┌─────────────────────────────┐
│ 🌀 Agent Name               │
│    AGENT_TYPE          Lv15 │
├─────────────────────────────┤
│ 🎯 ⚖️                        │  ← Mood & Personality
├─────────────────────────────┤
│ XP Progress    7500/10000    │  ← Level progression
│ ████████░                    │
├─────────────────────────────┤
│ Win Rate: 66.6% Trades: 284  │
│ PF: 2.34    Sharpe: 1.89     │
├─────────────────────────────┤
│ Skills                       │
│ 🎯 divergence_detection 8    │
│ 📊 accumulation_sensing 7    │
├─────────────────────────────┤
│ Abilities (3)                │
│ ✨ Early Vector Detection    │
├─────────────────────────────┤
│ [  Train  ] [  Inspect  ]    │
└─────────────────────────────┘
```

#### Stats Grid:
- **Win Rate**: Percentage of winning trades
- **Total Trades**: Number of trades executed
- **Profit Factor**: Gross profit / Gross loss
- **Sharpe Ratio**: Risk-adjusted returns

#### Color Coding:
```typescript
const AGENT_CONFIG = {
  BREAKOUT: { color: '#FF6B6B', emoji: '💥' },      // Red
  REVERSAL: { color: '#4ECDC4', emoji: '🔄' },      // Cyan
  ML_PREDICTION: { color: '#95E1D3', emoji: '🧠' },  // Mint
  PHYSICS_FLOW: { color: '#264653', emoji: '🌀' },   // Dark Blue
  PHYSICS_VFMD: { color: '#D62828', emoji: '👁️' },  // Dark Red
  EXIT_ORCHESTRATOR: { color: '#06A77D', emoji: '🎬' },  // Green
  OPPOSITION_READER: { color: '#D62828', emoji: '🚧' },  // Red
  MICROSTRUCTURE: { color: '#8338EC', emoji: '🌊' },  // Purple
};
```

#### Available Modes:
1. **Cards View** - Grid of agent cards with quick stats
2. **Network View** - Categorized agent groups (Entry, Exit, Combat)
3. **Leaderboard** - Table sorted by performance metrics

#### Filtering:
- **All** - Show all agents
- **Entry** - Only physics-based entry agents (VFMD, Flow)
- **Exit** - Only exit specialists (Orchestrator, Opposition, Microstructure)
- **Combat** - Other strategy agents (Breakout, Reversal, ML, etc.)

#### Agent Detail Modal:
Click any card to open detailed view showing:
- Full statistics breakdown
- Skill levels with progress bars
- Achievements unlocked
- Personality and rank info

---

### 2. Agent Interactions Dashboard (`agent-interactions.tsx`)

Real-time visualization of how agents make decisions together.

#### Core Views:

**A. Interaction Flow**
Shows current decision-making process:

```
Exit Agent (Green)
  ├─ Stage: PROFIT_LOCK
  ├─ Confidence: 85%
  └─ Reason: Price +2% above entry, locking gains

Opposition Agent (Orange)
  ├─ Near Support: No ✓
  ├─ Near Resistance: Yes ⚠️
  └─ Breakout Risk: 62%

Microstructure Agent (Purple)
  ├─ Spread Alert: No ✓
  ├─ Depth Warning: No ✓
  └─ Volume Anomaly: Yes ⚠️

Decision Logic:
  → Exit Agent determines optimal exit stage
  → Opposition Agent validates levels
  → Microstructure Agent checks liquidity
  → Consensus reached: 2/3 must agree
```

**B. Consensus Voting**

Shows how all 3 exit agents voted on a decision:

```
┌─────────────────────────────┐
│  ETH/USDT                   │
│  STRONG EXIT (78%)          │
├─────────────────────────────┤
│ Vote Distribution: 2EXIT/1HOLD
│ █████████████ 67% EXIT      │
│ ██████ 33% HOLD             │
├─────────────────────────────┤
│ Consensus Strength: 85%     │
│ ████████████████░           │
│ Exit Urgency: EXIT_STANDARD │
└─────────────────────────────┘

Exit Votes (Red Cards):
┌──────────────────┐
│ ExitOrchestrator │ ← EXIT (95% confidence)
│ Reason: Profit   │    Stage: PROFIT_LOCK
│ lock at peak     │
└──────────────────┘

┌──────────────────┐
│ Opposition       │ ← EXIT (72% confidence)
│ Reading          │    Approaching resistance
└──────────────────┘

Hold Votes (Green Cards):
┌──────────────────┐
│ Microstructure   │ ← HOLD (68% confidence)
│ Specialist       │    Still strong liquidity
└──────────────────┘
```

**C. Activity Feed**

Real-time log of agent actions:
- Agent votes cast
- Consensus reached
- Trades executed
- Errors/warnings

#### Vote Logic:

```
Consensus Decision Flow:
1. Each of 3 exit agents independently analyzes trade
2. Each votes: EXIT or HOLD
3. Calculate consensus:
   - 3/3 EXIT = 100% confidence (STRONG EXIT)
   - 2/3 EXIT = 67% confidence (EXIT)
   - 1/3 EXIT = 33% confidence (HOLD)
   - 0/3 EXIT = 0% confidence (HOLD)
4. If 2+ agents vote EXIT → Execute exit
5. Final confidence = (exitVotes / 3)
```

---

## Backend API Endpoints

### Agent Arena Endpoints

#### GET `/api/agents/interactions/agent-cards`
Fetch data for all agent cards.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "VectorForce",
      "agent_type": "PHYSICS_VFMD",
      "level": 15,
      "xp": 7500,
      "xp_to_next_level": 10000,
      "mood": "focused",
      "personality": "aggressive",
      "stats": {
        "total_trades": 284,
        "wins": 189,
        "win_rate": 0.666,
        "profit_factor": 2.34,
        "sharpe_ratio": 1.89,
        "max_drawdown": -0.082
      },
      "skill_levels": {
        "divergence_detection": 8,
        "accumulation_sensing": 7,
        "early_entry_timing": 9,
        "momentum_confirmation": 8
      },
      "abilities": [
        "Early Vector Detection",
        "Accumulation Zone Mapping",
        "Divergence Exploitation"
      ],
      "achievements": [
        {
          "name": "100 Win Streak",
          "description": "Won 100 consecutive trades",
          "unlockedAt": "2024-01-15"
        }
      ],
      "rank": "Gold"
    }
  ]
}
```

#### GET `/api/agents/interactions/consensus-history`
Get recent consensus votes.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "symbol": "ETH/USDT",
      "timestamp": "2024-01-20T15:45:30Z",
      "votes": [
        {
          "agentName": "ExitOrchestratorAgent",
          "agentType": "EXIT_ORCHESTRATOR",
          "vote": "EXIT",
          "confidence": 0.95,
          "reasoning": "Reached profit lock stage at +2%",
          "timestamp": "2024-01-20T15:45:28Z"
        },
        {
          "agentName": "OppositionResistanceAgent",
          "agentType": "OPPOSITION_READER",
          "vote": "EXIT",
          "confidence": 0.72,
          "reasoning": "Approaching strong resistance zone",
          "timestamp": "2024-01-20T15:45:29Z"
        },
        {
          "agentName": "MicrostructureSpecialistAgent",
          "agentType": "MICROSTRUCTURE_SPECIALIST",
          "vote": "HOLD",
          "confidence": 0.68,
          "reasoning": "Order book depth still strong",
          "timestamp": "2024-01-20T15:45:30Z"
        }
      ],
      "consensus": "EXIT",
      "confidence": 0.78,
      "exitUrgency": "EXIT_STANDARD"
    }
  ]
}
```

#### GET `/api/agents/interactions/interaction-flow`
Get current agent interaction state.

**Response:**
```json
{
  "success": true,
  "data": {
    "exitAgent": {
      "stage": "PROFIT_LOCK",
      "reason": "Price reached 2% above entry, locking in gains with 1% trail",
      "confidence": 0.85
    },
    "oppositionAgent": {
      "nearSupport": false,
      "nearResistance": true,
      "breakoutRisk": 0.62
    },
    "microstructureAgent": {
      "spreadAlert": false,
      "depthWarning": false,
      "volumeAnomaly": true
    }
  }
}
```

#### GET `/api/agents/interactions/activity-log`
Get agent activity feed.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2024-01-20T15:45:30Z",
      "type": "consensus",
      "message": "Consensus reached for ETH/USDT",
      "details": "Exit decision with 78% confidence"
    },
    {
      "timestamp": "2024-01-20T15:45:15Z",
      "type": "vote",
      "message": "VectorForce: vote_cast",
      "details": "{\"vote\":\"EXIT\",\"confidence\":0.95}"
    }
  ]
}
```

#### GET `/api/agents/interactions/interaction-graph`
Get network topology for visualization.

**Response:**
```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "exit-orchestrator",
        "label": "Exit Orchestrator",
        "type": "exit",
        "level": 12
      },
      {
        "id": "vector-force",
        "label": "Vector Force",
        "type": "entry",
        "level": 15
      }
    ],
    "edges": [
      {
        "source": "vector-force",
        "target": "exit-orchestrator",
        "weight": 0.9,
        "type": "signal"
      }
    ]
  }
}
```

### Recording Endpoints

#### POST `/api/agents/interactions/record-vote`
Record a consensus vote (called internally when voting happens).

**Body:**
```json
{
  "symbol": "ETH/USDT",
  "votes": [
    {
      "agentName": "ExitOrchestratorAgent",
      "agentType": "EXIT_ORCHESTRATOR",
      "vote": "EXIT",
      "confidence": 0.95,
      "reasoning": "Profit lock stage reached",
      "timestamp": "2024-01-20T15:45:28Z"
    }
  ],
  "consensus": "EXIT",
  "confidence": 0.78,
  "exitUrgency": "EXIT_STANDARD"
}
```

#### POST `/api/agents/interactions/record-activity`
Record any agent activity.

**Body:**
```json
{
  "type": "trade",
  "message": "VectorForce executed entry",
  "details": "BUY 0.5 ETH at 2450"
}
```

#### POST `/api/agents/interactions/agent-event`
Record specific agent event.

**Body:**
```json
{
  "agentName": "VectorForce",
  "eventType": "level_up",
  "data": {
    "oldLevel": 14,
    "newLevel": 15,
    "xpGained": 500
  }
}
```

---

## Integration with Existing Systems

### How to Connect to Your Trading Pipeline

#### 1. Record Consensus Votes

When agents reach consensus in `exit-agents.ts`:

```typescript
// Inside consensus voting endpoint
const voteData = {
  symbol: tradeState.symbol,
  votes: [
    {
      agentName: 'ExitOrchestratorAgent',
      agentType: 'EXIT_ORCHESTRATOR',
      vote: decision.exit ? 'EXIT' : 'HOLD',
      confidence: 0.95,
      reasoning: 'Profit lock stage reached',
      timestamp: new Date().toISOString()
    },
    // ... other agents
  ],
  consensus: majorityVote,
  confidence: consensusConfidence,
  exitUrgency: microstructureAgent.urgency
};

// Record for visualization
await fetch('/api/agents/interactions/record-vote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(voteData)
});
```

#### 2. Record Agent Activities

When agents level up, unlock abilities, or complete trades:

```typescript
// Agent levels up
await fetch('/api/agents/interactions/record-activity', {
  method: 'POST',
  body: JSON.stringify({
    type: 'trade',
    message: `${agent.name} leveled up to ${agent.level}`,
    details: `+${xpGained} XP from successful trade`
  })
});

// Agent unlocks achievement
await fetch('/api/agents/interactions/record-activity', {
  method: 'POST',
  body: JSON.stringify({
    type: 'achievement',
    message: `${agent.name} unlocked "${achievement.name}"`,
    details: achievement.description
  })
});
```

#### 3. Track Agent Performance Metrics

Update agent stats after each trade:

```typescript
const updatedStats = {
  total_trades: agent.stats.total_trades + 1,
  wins: agent.stats.wins + (profitable ? 1 : 0),
  win_rate: (agent.stats.wins + (profitable ? 1 : 0)) / (agent.stats.total_trades + 1),
  profit_factor: calculateProfitFactor(trades),
  sharpe_ratio: calculateSharpeRatio(returns),
  max_drawdown: calculateMaxDrawdown(trades)
};
```

---

## Mood & Personality System

### Moods
- **focused** 🎯 - Agent making confident decisions
- **cautious** ⚠️ - Agent being conservative, wants confirmation
- **aggressive** 🔥 - Agent pushing for action
- **tilted** 😤 - Agent has recent losses, taking riskier moves

### Personalities
- **aggressive** 🚀 - Quick entry/exit, high risk tolerance
- **balanced** ⚖️ - Moderate approach, wait for confirmation
- **conservative** 🛡️ - Slow, defensive, protective stops

### Ranks (by achievement level)
- Bronze - New agent
- Silver - Reaching level 8-12
- Gold - Reaching level 13-17
- Platinum - Level 18+
- Diamond - Rare/special agents
- Master - Legendary performance

---

## Real-Time Updates with WebSocket

### Setup

To enable real-time updates, add WebSocket support:

```typescript
// client/src/pages/agent-arena-hub.tsx

useEffect(() => {
  // WebSocket connection for real-time updates
  const ws = new WebSocket('ws://localhost:5000/ws/agents');
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'agent_update') {
      setAgents(agents => 
        agents.map(a => a.name === data.agent.name ? data.agent : a)
      );
    } else if (data.type === 'consensus_vote') {
      // Update interaction dashboard
      recordVote(data.vote);
    }
  };
  
  return () => ws.close();
}, []);
```

---

## Usage Examples

### Example 1: View All Agents
```
1. Navigate to Agent Arena Hub
2. Switch to "Cards View"
3. All 5 agents visible with stats
4. Click any card to see detailed breakdown
```

### Example 2: Watch Consensus Voting
```
1. Navigate to Agent Interactions Dashboard
2. View "Interaction Flow" section
3. See Exit Agent → Opposition Agent → Microstructure Agent analysis
4. Watch vote cards appear as agents vote
5. Consensus decision shows in green/red with confidence
```

### Example 3: Track Agent Performance
```
1. Switch to "Leaderboard View" in Agent Arena
2. Sorted by Sharpe ratio (best risk-adjusted returns)
3. Top agents: VectorForce (15), FlowMomentum (13), ExitMaster (12)
4. Click to see achievement history
```

### Example 4: Monitor Network Topology
```
1. Switch to "Network View"
2. See 3 categories:
   - Entry Specialists (VectorForce, FlowMomentum)
   - Exit Specialists (ExitMaster, ResistanceReader, LiquidityHunter)
   - Combat Specialists (Others)
3. Hover edges to see communication weight (0-1)
```

---

## Advanced Features

### Agent Card Customization

Extend agent cards with custom attributes:

```typescript
interface Agent {
  // ... existing fields ...
  customMetrics?: {
    bestTimeframe?: string;
    favoriteSymbols?: string[];
    preferredEntryPattern?: string;
    riskProfile?: 'low' | 'medium' | 'high';
  };
  
  teamRole?: 'scout' | 'executor' | 'guardian' | 'profit_seeker';
  synergies?: {
    worksBestWith?: string[]; // Other agent names
    conflictsWith?: string[];
  };
}
```

### Vote Weighting

Different agents can have different voting weights:

```typescript
const voteWeights: Record<AgentType, number> = {
  EXIT_ORCHESTRATOR: 1.0,        // Full weight
  OPPOSITION_READER: 0.9,        // 90% weight
  MICROSTRUCTURE_SPECIALIST: 0.8 // 80% weight
};

// When calculating consensus
const weightedExitVotes = votes.reduce((sum, v) => 
  sum + (v.vote === 'EXIT' ? voteWeights[v.agentType] : 0), 
  0
);
```

### Performance Metrics

Track over time:
```typescript
interface AgentMetrics {
  date: string;
  winRate: number;
  sharpeRatio: number;
  profitFactor: number;
  maxDrawdown: number;
  level: number;
  achievements: number;
}

// Store historical data for charting
const metricsHistory: AgentMetrics[] = [];
```

---

## Troubleshooting

### Cards Not Loading
1. Check `/api/agents/interactions/agent-cards` endpoint
2. Verify agent data structure matches TypeScript interface
3. Check browser console for CORS errors

### Consensus Votes Not Showing
1. Verify `/api/agents/interactions/consensus-history` returns data
2. Check that votes are being recorded via `/api/agents/interactions/record-vote`
3. Ensure WebSocket connection is active

### Activity Feed Empty
1. Make sure agents are recording activities
2. Call `/api/agents/interactions/record-activity` after agent actions
3. Check `/api/agents/interactions/activity-log` directly

### Performance Slow
1. Limit agent cards displayed (pagination)
2. Use virtual scrolling for long lists
3. Reduce WebSocket update frequency to 1-2 seconds
4. Cache agent stats instead of fetching every 5 seconds

---

## Summary

The Agent Arena visualization system provides:

✅ **Visual Agent Cards** - See each agent's stats, skills, personality  
✅ **Real-Time Interactions** - Watch agents vote on exit decisions  
✅ **Consensus Voting** - See how agents reach agreement  
✅ **Network Topology** - Understand agent relationships  
✅ **Performance Leaderboard** - Rank agents by results  
✅ **Activity Feed** - Track agent actions in real-time  
✅ **Mood & Personality** - Dynamic agent behaviors  
✅ **Achievement System** - Unlock special abilities  

This creates a **living, breathing** agent ecosystem where you can see exactly what's happening, why decisions are being made, and how agents are learning and improving over time.
