
import { TradingAgent } from './TradingAgent';

export interface ComboBonus {
  win_rate?: number;
  position_size?: number;
  confidence?: number;
  profit_target?: number;
  trailing_stop?: boolean;
  inverse_trade?: boolean;
}

export interface SynergyCombo {
  name: string;
  agents: string[];
  condition: string;
  min_combined_level: number;
  bonuses: ComboBonus;
  activation_count: number;
  historical_performance: {
    win_rate: number;
    profit_factor: number;
    avg_profit: number;
  };
}

export class AgentSynergyDetector {
  private combos: Map<string, SynergyCombo> = new Map();

  constructor() {
    this.initializeCombos();
  }

  private initializeCombos(): void {
    const combos: SynergyCombo[] = [
      {
        name: 'triple_bottom_hunter',
        agents: ['SUPPORT_SNIPER', 'REVERSAL_MASTER', 'ML_ORACLE'],
        condition: 'all_agree_buy_at_support',
        min_combined_level: 30,
        bonuses: {
          win_rate: 0.15,
          position_size: 1.3,
          confidence: 0.10
        },
        activation_count: 0,
        historical_performance: {
          win_rate: 0.72,
          profit_factor: 2.8,
          avg_profit: 2.4
        }
      },
      {
        name: 'tsunami',
        agents: ['BREAKOUT_HUNTER', 'TREND_RIDER', 'ML_ORACLE'],
        condition: 'breakout_with_strong_trend',
        min_combined_level: 30,
        bonuses: {
          profit_target: 1.5,
          trailing_stop: true,
          confidence: 0.20
        },
        activation_count: 0,
        historical_performance: {
          win_rate: 0.68,
          profit_factor: 3.2,
          avg_profit: 3.8
        }
      },
      {
        name: 'the_trap',
        agents: ['BREAKOUT_HUNTER', 'REVERSAL_MASTER', 'TREND_RIDER'],
        condition: 'failed_breakout_detected',
        min_combined_level: 45,
        bonuses: {
          inverse_trade: true,
          confidence: 0.25,
          position_size: 1.5
        },
        activation_count: 0,
        historical_performance: {
          win_rate: 0.65,
          profit_factor: 2.6,
          avg_profit: 2.1
        }
      },
      {
        name: 'perfect_storm',
        agents: ['BREAKOUT_HUNTER', 'TREND_RIDER', 'ML_ORACLE', 'SUPPORT_SNIPER'],
        condition: 'all_4_agents_align',
        min_combined_level: 50,
        bonuses: {
          position_size: 2.0,
          confidence: 0.35,
          profit_target: 2.0
        },
        activation_count: 0,
        historical_performance: {
          win_rate: 0.82,
          profit_factor: 4.5,
          avg_profit: 5.2
        }
      }
    ];

    combos.forEach(combo => {
      this.combos.set(combo.name, combo);
    });
  }

  /**
   * Check if agents form a synergy combo
   */
  checkForCombos(
    activeAgents: TradingAgent[],
    signal: any
  ): SynergyCombo[] {
    const activatedCombos: SynergyCombo[] = [];

    for (const [comboName, comboData] of this.combos) {
      // Check if required agents are present and active
      const requiredAgentNames = comboData.agents;
      const presentAgents = activeAgents.filter(agent =>
        requiredAgentNames.includes(agent.name)
      );

      if (presentAgents.length < requiredAgentNames.length) {
        continue;
      }

      // Check combined level requirement
      const combinedLevel = presentAgents.reduce((sum, agent) => sum + agent.level, 0);
      if (combinedLevel < comboData.min_combined_level) {
        continue;
      }

      // Check condition
      if (this.checkCondition(comboData.condition, presentAgents, signal)) {
        comboData.activation_count += 1;
        activatedCombos.push(comboData);

        console.log(`🎊 COMBO ACTIVATED: ${comboName}`);
        console.log(`Agents: ${presentAgents.map(a => `${a.name} (L${a.level})`).join(', ')}`);
        console.log(`Historical: ${(comboData.historical_performance.win_rate * 100).toFixed(0)}% WR, ${comboData.historical_performance.profit_factor.toFixed(1)} PF`);
      }
    }

    return activatedCombos;
  }

  private checkCondition(
    condition: string,
    agents: TradingAgent[],
    signal: any
  ): boolean {
    switch (condition) {
      case 'all_agree_buy_at_support':
        return (
          signal.pattern?.includes('SUPPORT') &&
          signal.action === 'BUY' &&
          agents.every(a => a.confidence > 0.6)
        );

      case 'breakout_with_strong_trend':
        return (
          signal.pattern?.includes('BREAKOUT') &&
          signal.regime === 'BULL_TRENDING' &&
          signal.trend_strength === 'STRONG'
        );

      case 'failed_breakout_detected':
        return (
          signal.pattern?.includes('BREAKOUT') &&
          signal.volume_confirmation === false &&
          signal.price_action === 'REJECTION'
        );

      case 'all_4_agents_align':
        return agents.every(a => a.confidence > 0.75);

      default:
        return false;
    }
  }

  /**
   * Apply combo bonuses to a signal
   */
  applyBonuses(signal: any, combos: SynergyCombo[]): any {
    const enhancedSignal = { ...signal };

    for (const combo of combos) {
      if (combo.bonuses.confidence) {
        enhancedSignal.confidence = Math.min(
          1.0,
          (enhancedSignal.confidence || 0.5) * (1 + combo.bonuses.confidence)
        );
      }

      if (combo.bonuses.position_size) {
        enhancedSignal.position_multiplier =
          (enhancedSignal.position_multiplier || 1.0) * combo.bonuses.position_size;
      }

      if (combo.bonuses.profit_target) {
        enhancedSignal.profit_target_multiplier =
          (enhancedSignal.profit_target_multiplier || 1.0) * combo.bonuses.profit_target;
      }

      if (combo.bonuses.trailing_stop) {
        enhancedSignal.use_trailing_stop = true;
      }

      if (combo.bonuses.inverse_trade) {
        enhancedSignal.action = enhancedSignal.action === 'BUY' ? 'SELL' : 'BUY';
        enhancedSignal.inverse_trade = true;
      }

      enhancedSignal.active_combos = enhancedSignal.active_combos || [];
      enhancedSignal.active_combos.push({
        name: combo.name,
        bonuses: combo.bonuses
      });
    }

    return enhancedSignal;
  }

  getCombos(): SynergyCombo[] {
    return Array.from(this.combos.values());
  }

  getComboStats(): any {
    const stats: any = {};
    for (const [name, combo] of this.combos) {
      stats[name] = {
        activations: combo.activation_count,
        historical: combo.historical_performance
      };
    }
    return stats;
  }
}
