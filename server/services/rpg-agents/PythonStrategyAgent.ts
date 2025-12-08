
/**
 * Python Strategy Agent - RPG Agent with Python Strategy DNA
 * 
 * Inherits traits from Python strategies:
 * - Gradient Trend Filter → Trend detection ability
 * - UT Bot → Trailing stop mastery
 * - Mean Reversion → Oversold/overbought sensing
 * - Volume Profile → Institutional level detection
 * - Market Structure → Pattern recognition
 */

import { TradingAgent } from './TradingAgent';
import { spawn } from 'child_process';

export interface PythonStrategyTrait {
  strategy_name: string;
  specialty: string;
  signal_type: 'TREND' | 'REVERSAL' | 'VOLUME' | 'STRUCTURE';
  python_module: string;
}

export class PythonStrategyAgent extends TradingAgent {
  private pythonTrait: PythonStrategyTrait;
  
  constructor(name: string, trait: PythonStrategyTrait) {
    super(name);
    this.pythonTrait = trait;
    
    // Inherit specialty as agent ability
    this.specialty = trait.specialty;
    
    console.log(`🐍 ${name} inherited trait from ${trait.strategy_name}!`);
  }
  
  /**
   * Process signal using Python strategy logic
   */
  async processSignal(marketData: any): Promise<any> {
    try {
      // Call Python strategy via bridge
      const pythonResult = await this.callPythonStrategy(marketData);
      
      if (!pythonResult || pythonResult.signal === 'HOLD') {
        return null;
      }
      
      // Convert Python signal to RPG agent format
      const confidence = pythonResult.confidence || 0.5;
      const action = pythonResult.signal === 'BUY' ? 'BUY' : 'SELL';
      
      // Apply agent-specific skill bonuses
      const skillBonus = this.skills.pattern_recognition / 100;
      const finalConfidence = Math.min(1.0, confidence * (1 + skillBonus * 0.2));
      
      return {
        action,
        confidence: finalConfidence,
        reason: `${this.pythonTrait.strategy_name}: ${pythonResult.reason || 'Signal detected'}`,
        entry_price: marketData.price,
        python_metadata: pythonResult
      };
    } catch (error) {
      console.error(`[${this.name}] Python strategy error:`, error);
      return null;
    }
  }
  
  /**
   * Call Python strategy module
   */
  private callPythonStrategy(marketData: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', [
        '-c',
        `
import sys
import json
from strategies.${this.pythonTrait.python_module} import evaluate_signal

data = json.loads(sys.argv[1])
result = evaluate_signal(data)
print(json.dumps(result))
        `,
        JSON.stringify(marketData)
      ]);
      
      let output = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        console.error(`Python error: ${data}`);
      });
      
      python.on('close', (code) => {
        if (code === 0 && output) {
          try {
            resolve(JSON.parse(output));
          } catch (e) {
            reject(new Error('Invalid JSON from Python'));
          }
        } else {
          reject(new Error(`Python exited with code ${code}`));
        }
      });
    });
  }
}

// Factory: Create RPG agents from Python strategies
export function createAgentFromPythonStrategy(strategyName: string): PythonStrategyAgent {
  const traits: Record<string, PythonStrategyTrait> = {
    'gradient_trend': {
      strategy_name: 'Gradient Trend Filter',
      specialty: 'Trend Detection',
      signal_type: 'TREND',
      python_module: 'gradient_trend_filter'
    },
    'ut_bot': {
      strategy_name: 'UT Bot',
      specialty: 'Trailing Stop Mastery',
      signal_type: 'TREND',
      python_module: 'ut_bot'
    },
    'mean_reversion': {
      strategy_name: 'Mean Reversion Engine',
      specialty: 'Reversal Detection',
      signal_type: 'REVERSAL',
      python_module: 'mean_reversion'
    },
    'volume_profile': {
      strategy_name: 'Volume Profile Engine',
      specialty: 'Institutional Level Detection',
      signal_type: 'VOLUME',
      python_module: 'volume_profile'
    }
  };
  
  const trait = traits[strategyName];
  if (!trait) {
    throw new Error(`Unknown strategy: ${strategyName}`);
  }
  
  return new PythonStrategyAgent(
    `${trait.strategy_name.toUpperCase().replace(/ /g, '_')}_AGENT`,
    trait
  );
}
