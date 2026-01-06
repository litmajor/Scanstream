# Agent Abilities System - Quick Reference

## What is This?

Complete feature flag system that controls:
- **13 Specialist Agent Abilities** (breakout hunter, trend rider, etc.)
- **9 Leveled Abilities** (unlock as agents gain XP: level 3→25)
- **6 Core Agent Services** (arena, clustering, synergy, etc.)
- **Advanced Analysis Features** (physics validation, ML consensus, etc.)
- **RPG Systems** (commander approval, daily briefing, etc.)

## Quick Start

### Check Available Abilities
```bash
curl http://localhost:5000/api/agents/abilities
```

### Check What Abilities Unlock at Level 10
```bash
curl http://localhost:5000/api/agents/abilities/level/10
```

### Get Full Admin Report
```bash
curl http://localhost:5000/api/agents/abilities/report
```

### Enable an Ability (Dev Only)
```bash
curl -X POST http://localhost:5000/api/feature-flags/agent_ability_physics_vfmd/set \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

## All Specialist Abilities

| Ability | ID | Default | Purpose |
|---------|----|---------|---------| 
| Breakout Hunter | breakout_hunter | ✅ ON | Detect breakouts |
| Reversal Master | reversal_master | ✅ ON | Reversal patterns |
| Trend Rider | trend_rider | ✅ ON | Trend following |
| Support Sniper | support_sniper | ✅ ON | Support/resistance |
| Physics Flow | physics_flow | ❌ | Vector field physics |
| Physics VFMD | physics_vfmd | ❌ | VFMD trend prediction |
| ML Oracle | ml_oracle | ❌ | ML predictions |
| Market Oracle | market_oracle | ❌ | Market intelligence |
| Volume Verifier | volume_verifier | ❌ | Volume analysis |
| Exit Orchestrator | exit_orchestrator | ❌ | Exit coordination |
| Opposition Reader | opposition_reader | ❌ | Opposition levels |
| Microstructure | microstructure_specialist | ❌ | Microstructure |
| Feature Engineer | feature_engineer | ❌ | Feature creation |

## Level Progression (Leveled Abilities)

Agents unlock these abilities as they level up:

```
Level 3  → Dynamic Position Sizing       (300 XP)
Level 5  → Intelligent Exits             (500 XP)
Level 7  → Multi-Timeframe Confirmation  (700 XP)
Level 10 → Regime Adaptation             (1000 XP)
Level 12 → Velocity-Based Targets        (1200 XP)
Level 15 → Correlation Hedging           (1500 XP)
Level 18 → Pattern Discovery             (1800 XP)
Level 20 → Portfolio Optimization        (2000 XP)
Level 25 → Strategy Creation             (2500 XP) ← Can spawn sub-agents
```

## Core Agent Services

| Service | Flag | Default | Purpose |
|---------|------|---------|---------|
| Agent Arena | agent_arena | ✅ | Voting/consensus system |
| Agent Clustering | agent_clustering | ✅ | Specialist routing |
| Agent Synergy | agent_synergy | ❌ | Cooperative trading |
| Achievement System | agent_achievement_system | ❌ | XP/progression tracking |
| Portfolio Manager | agent_portfolio_manager | ❌ | Portfolio coordination |

## Common Operations

### Enable Multiple Experimental Abilities
```bash
# Physics-based abilities
curl -X POST http://localhost:5000/api/feature-flags/agent_ability_physics_vfmd/set \
  -d '{"enabled": true}'

# RPG system
curl -X POST http://localhost:5000/api/feature-flags/commander_approval/set \
  -d '{"enabled": true}'

# Advanced analysis
curl -X POST http://localhost:5000/api/feature-flags/online_learning_system/set \
  -d '{"enabled": true}'
```

### Environment Variables at Startup
```bash
FEATURE_FLAG_AGENT_ABILITY_PHYSICS_VFMD=true \
FEATURE_FLAG_COMMANDER_APPROVAL=true \
FEATURE_FLAG_AGENT_SYNERGY=true \
npm start
```

### Check Agent Category
```bash
# Get all specialist abilities
curl http://localhost:5000/api/agents/abilities/category/specialist

# Get all leveled abilities
curl http://localhost:5000/api/agents/abilities/category/leveled
```

## Integration Examples

### In Agent Code
```typescript
import { isAbilityAvailable, getLeveledAbilitiesByLevel } from '../services/agent-abilities-registry';

// Check if ability enabled before using
if (isAbilityAvailable('dynamic_position_sizing')) {
  // Calculate dynamic position size
  const posSize = calculateDynamicSize(...);
}

// On level-up, add new abilities
if (agent.level === 10) {
  const newAbilities = getLeveledAbilitiesByLevel(10);
  newAbilities.forEach(a => agent.abilities.push(a.id));
}
```

### In Routing Code
```typescript
import { getSpecialistAbilities } from '../services/agent-abilities-registry';

// Get all available specialists
const specialists = getSpecialistAbilities();

// Route to appropriate specialist based on signal type
if (signal.type === 'BREAKOUT' && specialists.find(a => a.id === 'breakout_hunter')) {
  return routeToBreakoutHunter(signal);
}
```

## File Locations

- **Flags Config:** `server/config/featureFlags.ts`
- **Abilities Registry:** `server/services/agent-abilities-registry.ts`
- **API Endpoints:** `server/routes/agent-abilities.ts`
- **Documentation:** `docs/feature-flags.md`, `AGENT_ABILITIES_SYSTEM.md`

## Troubleshooting

### Ability Returns Not Available
Check feature flag status:
```bash
curl http://localhost:5000/api/feature-flags/agent_ability_physics_vfmd
# Should show: "enabled": true
```

Enable if needed:
```bash
curl -X POST http://localhost:5000/api/feature-flags/agent_ability_physics_vfmd/set \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

### Reset All to Defaults
```bash
curl -X POST http://localhost:5000/api/feature-flags/reset
```

### Production Mode Restrictions
In production (`NODE_ENV=production`):
- ✅ GET endpoints work
- ❌ POST toggle/set endpoints return 403
- Use environment variables to configure

## Next Steps

1. Enable specialist abilities for your trading signals
2. Monitor which leveled abilities agents unlock
3. Test RPG system (commander approval, daily briefing)
4. Integrate physics abilities for advanced trading
5. Track ability usage metrics
