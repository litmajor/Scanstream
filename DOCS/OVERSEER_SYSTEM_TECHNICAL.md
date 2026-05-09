# 🎮 Overseer System - Technical Implementation

**Date**: December 10, 2025  
**Focus**: API endpoints, decision framework, autonomy levels

---

## 🔧 Decision Approval System Architecture

```
┌─────────────────────────────────────────┐
│      INCOMING DECISION PROPOSAL           │
│  (Agent wants to trade / spawn / evolve)  │
└────────────┬────────────────────────────┘
             │
             ▼
    ┌─────────────────────┐
    │ Check Autonomy Level │
    └─────────┬───────────┘
              │
    ┌─────────┴──────────┐
    │                    │
    ▼                    ▼
AUTO-APPROVED      REQUIRES APPROVAL
(Execute)          (Queue for review)
    │                    │
    ▼                    ▼
EXECUTE           NOTIFY COMMANDER
                  (Daily brief or alert)
                        │
                        ▼
                   COMMANDER REVIEW
                   ├─ Approve
                   ├─ Reject
                   ├─ Modify
                   └─ Learn from decision
```

---

## 📋 Decision Categories & Thresholds

### **Category 1: Auto-Approved Trades**

```typescript
interface AutoApprovedTrade {
  type: 'TRADE_EXECUTION';
  criteria: {
    withinRiskLimit: boolean;           // Current exposure < max
    withinPositionSizeLimit: boolean;   // Size <= agent allocation
    stopLossSet: boolean;               // Always has SL
    takeProfitSet: boolean;             // Good to have
    withinDailyLossCap: boolean;       // Not exceeded max daily loss
  };
  requiredApprovals: 0;                 // Auto-execute
  confidenceThreshold: 0.60;             // Can trade at 60%+
}
```

**Example:**
```json
{
  "agent": "TrendRider",
  "symbol": "BTC/USDT",
  "action": "LONG",
  "size": 1000,
  "stopLoss": 41200,
  "takeProfit": 42850,
  "confidence": 0.78,
  "reason": "4h trend intact, volume confirmed",
  "approval": "AUTO-APPROVED"
}
```

### **Category 2: Commander Review (Daily Brief)**

```typescript
interface CommanderReviewDecision {
  type: 'AGENT_PROPOSAL';
  subtypes: [
    'SPAWN_NEW_AGENT',
    'RETIRE_AGENT',
    'EVOLVE_AGENT',
    'HIBERNATION_REQUEST',
    'CAPITAL_REALLOCATION',
    'STRATEGY_CHANGE',
    'MARKET_EXPANSION'
  ];
  notificationTime: 'NEXT_DAILY_BRIEF';
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  requiredApprovals: 1;              // Just you
  timeToDecide: '24-48 hours';       // Not urgent
  autoExecuteIfNoDecision: false;    // Waits for you
}
```

**Example 1: New Agent Proposal**
```json
{
  "type": "SPAWN_NEW_AGENT",
  "proposedAgent": {
    "name": "GAPFADER_ZETA",
    "strategy": "Gap filling overnight",
    "backtest": {
      "winRate": 0.76,
      "profitFactor": 2.1,
      "expectedMonthlyPnL": "$1,200-$1,800"
    },
    "capitalRequired": 8000,
    "parentAgent": "MARKET_SAGE",
    "reasoning": "Detected 73% success rate in 2h overnight gaps"
  },
  "proposal": {
    "approve": true,
    "reason": "System discovered new profitable pattern",
    "timestamp": "2025-12-10T14:32:00Z"
  },
  "yourDecision": "PENDING"
}
```

**Example 2: Agent Evolution**
```json
{
  "type": "EVOLVE_AGENT",
  "agent": "TrendRider",
  "currentLevel": 5,
  "proposedLevel": 6,
  "newCapabilities": [
    "Duration Mastery: Hold winning trades 20% longer"
  ],
  "expectedImpact": {
    "profitability": "+15% on trend trades",
    "winRate": "87% → 89%"
  },
  "reasoning": "Completed 50 consecutive profitable trades (level up criteria)",
  "yourDecision": "PENDING"
}
```

**Example 3: Hibernation Request**
```json
{
  "type": "HIBERNATION_REQUEST",
  "agent": "SupportSniper",
  "reason": "3 losses in row, confidence dropped to 52%",
  "duration": "7 days",
  "system": {
    "recommendation": "Let AI learn from losses before re-deploying",
    "alternativeOption": "Evolve with new technique"
  },
  "yourDecision": "PENDING"
}
```

### **Category 3: Immediate Escalation (Alerts)**

```typescript
interface ImmediateEscalation {
  type: 'ALERT_REQUIRES_IMMEDIATE_DECISION';
  subtypes: [
    'DRAWDOWN_THRESHOLD_EXCEEDED',
    'AGENT_ANOMALY_DETECTED',
    'CONFLICT_BETWEEN_AGENTS',
    'SYSTEM_BEHAVIOR_ANOMALY',
    'CAPITAL_LIMIT_APPROACHING'
  ];
  notificationMethod: 'ALERT' | 'EMAIL' | 'SMS';
  urgency: 'CRITICAL';
  requiredApprovals: 1;              // Just you, immediately
  timeToDecide: 'IMMEDIATE';         // Need decision now
  autoExecuteIfNoDecision: false;    // Waits for you
  suggestedActions: string[];        // What you can do
}
```

**Example 1: Drawdown Alert**
```json
{
  "type": "ALERT_REQUIRES_IMMEDIATE_DECISION",
  "alert": "DRAWDOWN_THRESHOLD_EXCEEDED",
  "currentDrawdown": "-8.2%",
  "threshold": "-8.0%",
  "suggestedActions": [
    "CONTINUE (trust system)",
    "REDUCE_RISK (scale down positions)",
    "HIBERNATE_RISKY_AGENTS (pause aggressive strategies)",
    "FULL_PAUSE (stop all trading until you review)"
  ],
  "agentAnalysis": {
    "iAgents": "SupportSniper is dragging team down (58% accuracy)",
    "recommendation": "Hibernate SupportSniper + resume others"
  },
  "yourDecision": "REQUIRED_NOW"
}
```

**Example 2: System Anomaly**
```json
{
  "type": "ALERT_REQUIRES_IMMEDIATE_DECISION",
  "alert": "SYSTEM_BEHAVIOR_ANOMALY",
  "anomaly": "Two agents proposing contradictory trades for same symbol",
  "details": {
    "symbol": "ETH/USDT",
    "agent1": "TrendRider (LONG)",
    "agent2": "ReversalMaster (SHORT)",
    "bothConfidentAbove": 0.75
  },
  "suggestedResolution": [
    "LET_BOTH_TRADE (diversify)",
    "GIVE_PRIORITY_TO_TRENDIDER (has higher historical accuracy)",
    "GIVE_PRIORITY_TO_REVERSALMASTER",
    "WAIT_FOR_MORE_DATA (pause both until consensus)"
  ],
  "yourDecision": "REQUIRED_NOW"
}
```

---

## 🎯 Approval API Endpoints

### **1. Get Pending Decisions**

```typescript
GET /api/commander/decisions/pending

Response:
{
  "total": 3,
  "daily": [
    {
      "id": "decision_001",
      "type": "SPAWN_NEW_AGENT",
      "agent": "GAPFADER_ZETA",
      "status": "AWAITING_APPROVAL",
      "createdAt": "2025-12-10T14:32:00Z",
      "expiresAt": "2025-12-12T14:32:00Z"  // 48 hour window
    }
  ],
  "alerts": [
    {
      "id": "alert_001",
      "type": "DRAWDOWN_THRESHOLD_EXCEEDED",
      "status": "CRITICAL",
      "createdAt": "2025-12-10T15:45:00Z"
    }
  ]
}
```

### **2. Get Daily Briefing**

```typescript
GET /api/commander/briefing/daily

Response:
{
  "date": "2025-12-10",
  "summary": {
    "pnl": "+$3,240",
    "trades": 12,
    "winRate": 0.72,
    "agents": { "active": 5, "hibernating": 2 }
  },
  "activityFeed": [
    {
      "time": "14:32",
      "agent": "TrendRider",
      "action": "LONG BTC/USDT",
      "size": "$1,500",
      "reason": "4h trend intact"
    }
  ],
  "agentHealth": {
    "TrendRider": { "score": 8.2, "confidence": 0.87 },
    "BreakoutHunter": { "score": 8.9, "confidence": 0.89 }
  },
  "pendingApprovals": [
    {
      "id": "decision_001",
      "type": "SPAWN_NEW_AGENT",
      "agent": "GAPFADER_ZETA",
      "expectedMonthlyPnL": "$1,200-$1,800"
    }
  ]
}
```

### **3. Approve/Reject Decision**

```typescript
POST /api/commander/decisions/:decisionId/approve

Request:
{
  "decision": "APPROVE",  // or "REJECT", "MODIFY"
  "notes": "Looks good, let's test it",
  "modifiedParameters": {  // Optional, only if MODIFY
    "capitalAllocation": 6000  // Was 8000
  }
}

Response:
{
  "success": true,
  "decision": "APPROVED",
  "executedAt": "2025-12-10T15:48:00Z",
  "nextSteps": "Agent will spawn in next market cycle"
}
```

### **4. Respond to Alert**

```typescript
POST /api/commander/alerts/:alertId/respond

Request:
{
  "action": "HIBERNATE_RISKY_AGENTS",
  "reason": "SupportSniper dragging team down",
  "duration": "7 days"
}

Response:
{
  "success": true,
  "executed": {
    "hibernatedAgents": ["SupportSniper"],
    "activeAgents": ["TrendRider", "BreakoutHunter", "ReversalMaster", "ML_Oracle"]
  },
  "impact": {
    "estimatedDailyPnL": "$450 (was $320 with SupportSniper)"
  }
}
```

### **5. Manual Trade Execution**

```typescript
POST /api/commander/manual-trade

Request:
{
  "symbol": "BTC/USDT",
  "side": "LONG",
  "price": 42100,
  "size": 1500,
  "stopLoss": 41200,
  "takeProfit": 42850,
  "reason": "I see confluence of support + volume"
}

Response:
{
  "success": true,
  "trade": {
    "id": "trade_123",
    "agent": "COMMANDER_MANUAL",
    "status": "OPEN",
    "entry": 42100
  }
}
```

### **6. Set Strategic Direction**

```typescript
POST /api/commander/strategy/direction

Request:
{
  "direction": "FOCUS_ON_BREAKOUTS",
  "parameters": {
    "primaryStrategy": "BREAKOUT_TRADING",
    "capitalAllocationAdjustment": {
      "BreakoutHunter": 0.40,     // 40% of capital
      "TrendRider": 0.25,          // 25%
      "ReversalMaster": 0.15,      // 15% (reduce)
      "Others": 0.20               // 20%
    },
    "hibernateAgents": ["SupportSniper"],
    "duration": "1 month"
  }
}

Response:
{
  "success": true,
  "newAllocation": { ... },
  "estimatedImpact": "System will focus on high-probability breakouts",
  "nextReview": "2025-01-10"
}
```

### **7. Emergency Controls**

```typescript
POST /api/commander/emergency/pause-all

Request: { "reason": "Portfolio stress" }
Response: { "success": true, "status": "ALL_TRADING_PAUSED" }

POST /api/commander/emergency/wake-agent

Request: { "agent": "ReversalMaster" }
Response: { "success": true, "agent": "ACTIVE" }

POST /api/commander/emergency/close-all-positions

Request: { "reason": "System review needed" }
Response: { "success": true, "positions": 0 }
```

---

## 🎮 Autonomy Level Configuration

### **Default: Hybrid/Recommended**

```typescript
interface AutonomyLevel {
  tradeExecution: {
    autonomy: 'FULL',              // Auto-approve all trades
    threshold: 0.60,                // >60% confidence
    maxPosition: 2000,              // Max size per trade
    dailyMaxLoss: -5000             // Stop if down $5k
  },
  
  agentProposal: {
    autonomy: 'COMMANDER_REVIEW',   // Your approval needed
    notification: 'DAILY_BRIEF',
    timeWindow: '48 hours',
    autoExecuteIfExpired: false      // Expires unsigned
  },
  
  strategyChange: {
    autonomy: 'COMMANDER_REVIEW',   // Your approval needed
    notification: 'ALERT',
    timeWindow: 'IMMEDIATE',
    autoExecuteIfExpired: false
  },
  
  emergencyResponse: {
    autonomy: 'FULL',               // Auto-respond to risk limits
    drawdownLimit: -8.0,            // Pause if down 8%
    conflictResolution: 'ESCALATE', // Notify you
    anomalyResponse: 'ALERT'        // Alert you immediately
  }
}
```

### **Alternative 1: Full Autonomy**

```typescript
{
  tradeExecution: { autonomy: 'FULL' },
  agentProposal: { autonomy: 'FULL' },
  strategyChange: { autonomy: 'FULL' },
  emergencyResponse: { autonomy: 'FULL' }
  // Result: System runs 100% without you
  // Your role: Monthly review only
}
```

### **Alternative 2: Full Manual Control**

```typescript
{
  tradeExecution: { autonomy: 'NONE', requiresApproval: true },
  agentProposal: { autonomy: 'NONE', requiresApproval: true },
  strategyChange: { autonomy: 'NONE', requiresApproval: true },
  emergencyResponse: { autonomy: 'NONE', requiresApproval: true }
  // Result: You approve everything
  // Your role: Active trader + manager (exhausting)
}
```

---

## 📊 Decision Logging & Learning

### **Every decision gets recorded:**

```typescript
interface ApprovalDecision {
  id: string;
  timestamp: Date;
  type: string;                    // APPROVE, REJECT, MODIFY
  proposedChange: any;
  yourDecision: any;
  notes?: string;
  outcome?: {
    pnl: number;
    trades: number;
    winRate: number;
    status: 'SUCCESS' | 'LEARNING' | 'FAILURE'
  }
}
```

### **System learns from your patterns:**

```
After 50 decisions, system notices:
├─ You approve 85% of high-confidence proposals
├─ You reject risky agent proposals
├─ You prefer diversification over concentration
└─ System adapts to your preferences

Result: Better proposals that match your style
```

---

## 🎯 Implementation Roadmap

### **Week 1: Approval Framework**
- [ ] Decision model + database schema
- [ ] Autonomy configuration system
- [ ] Basic approve/reject endpoints
- [ ] Decision history logging

### **Week 2: Daily Briefing**
- [ ] Briefing generation logic
- [ ] Activity feed collection
- [ ] Agent health calculations
- [ ] Pending decisions summary

### **Week 3: Alert System**
- [ ] Alert detection (drawdown, anomaly, etc)
- [ ] Notification routing
- [ ] Emergency response handling
- [ ] Immediate escalation API

### **Week 4: Dashboard UI**
- [ ] Daily briefing display
- [ ] Pending decisions interface
- [ ] Manual trade execution form
- [ ] Emergency controls panel
- [ ] Agent health visualization

---

## 🎯 The Approval Loop

```
┌─ DECISION PROPOSED ─────────────────────┐
│                                          │
├─ Check Autonomy Level ──────────────────┤
│  ├─ Threshold met? → AUTO-APPROVE      │
│  └─ Threshold not met? → QUEUE FOR YOU  │
│                                          │
├─ NOTIFICATION ──────────────────────────┤
│  ├─ Auto-approved: Execute              │
│  ├─ Needs approval: Daily brief + alert │
│  └─ Emergency: Immediate notification   │
│                                          │
├─ YOU DECIDE ─────────────────────────────┤
│  ├─ APPROVE: Execute immediately        │
│  ├─ REJECT: Log and move on             │
│  ├─ MODIFY: Adjust parameters + execute │
│  └─ LEARN: System notes your preference │
│                                          │
├─ EXECUTE & MONITOR ──────────────────────┤
│  ├─ Track outcome                        │
│  ├─ Record performance                  │
│  └─ Feed back to system learning        │
│                                          │
└─ NEXT DECISION ──────────────────────────┘
```

**Result:** You're not overwhelmed with decisions, but you're always in command.
