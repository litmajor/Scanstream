import { TradingAgent, AgentPersonality, AgentSignal } from './TradingAgent';
import { computeFlowField, type FlowFieldPoint, type FlowFieldResult } from '../analytics/flowFieldEngine';
import { 
  generateModuleSignal, 
  type Signal, 
  type ModuleState,
  type ArmDetectionInput,
  slope
} from '../arm-template';

/**
 * FlowPhysicsAgent
 * - Wraps the Flow Field engine and exposes a simple analyze() and generateSignal()
 * - Designed to be used by the RPG agent system as a physics-based specialist
 * - Now includes ARM detection for flow asymmetry
 */
export class FlowPhysicsAgent extends TradingAgent {
  // ARM state tracking for flow pressure shifts
  private armState: ModuleState = { armTicks: 0 };

  constructor(name: string, personality: AgentPersonality = 'balanced') {
    super(name, 'PHYSICS_FLOW', personality);
    this.abilities.push('flow_field_analysis');
  }

  /**
   * Analyze a series of FlowFieldPoint data and return the raw FlowFieldResult
   */
  analyze(data: FlowFieldPoint[], config?: any): FlowFieldResult {
    return computeFlowField(data, config);
  }

  /**
   * Generate a trading signal based on flow field summary
   */
  generateSignal(data: FlowFieldPoint[]): AgentSignal {
    const result = this.analyze(data);

    // Derive confidence from averageForce / turbulence
    const forceScore = Math.min(1, Math.abs(result.averageForce) * 10);
    const turbulencePenalty = Math.min(1, result.turbulence * 1000);
    const baseConfidence = Math.max(0, forceScore - turbulencePenalty);

    const agentConfidence = Math.min(1, baseConfidence * (0.6 + this.skills.pattern_recognition * 0.04));

    let action: AgentSignal['action'] = 'HOLD';
    let reason = 'neutral flow';
    let entry = data[data.length - 1].price;
    let target = entry;
    let stop = entry;

    if (result.dominantDirection === 'bullish' && agentConfidence > 0.35) {
      action = 'BUY';
      reason = `flow bullish (dir=${result.dominantDirection})`;
      target = entry * (1 + Math.min(0.12, result.averageForce * 0.5));
      stop = entry * (1 - Math.min(0.05, result.turbulence * 2));
    } else if (result.dominantDirection === 'bearish' && agentConfidence > 0.35) {
      action = 'SELL';
      reason = `flow bearish (dir=${result.dominantDirection})`;
      target = entry * (1 - Math.min(0.12, result.averageForce * 0.5));
      stop = entry * (1 + Math.min(0.05, result.turbulence * 2));
    }

    return {
      action,
      confidence: agentConfidence,
      entry,
      target,
      stop,
      reason,
      agent_name: this.name,
      agent_level: this.level
    } as AgentSignal;
  }

  /**
   * ARM-based signal generation for flow physics
   * Detects flow field asymmetry (pressure shifts in momentum flow)
   */
  generateArmSignal(
    data: FlowFieldPoint[],
    volumeGate: boolean
  ): Signal {
    if (!data || data.length < 3) {
      return {
        type: 'HOLD',
        holdReason: 'INSUFFICIENT_DATA',
        confidence: 0.05,
        module: 'FlowPhysics'
      };
    }

    // Analyze flow field
    const result = this.analyze(data);

    // Extract force series for slope calculation
    const forceValues = data.map(point => Math.abs(point.force || 0));
    const forceSlope = slope(forceValues);

    // ARM detection input for flow analysis
    const armInput: ArmDetectionInput = {
      flowDirection: result.dominantDirection === 'bullish' ? 1 : result.dominantDirection === 'bearish' ? -1 : 0,
      flowStrength: result.averageForce,
      momentum: result.averageForce,
      atrSlope: forceSlope  // Use force slope as volatility proxy
    };

    // Generate ARM signal using template
    return generateModuleSignal({
      moduleName: 'FlowPhysics',
      data: armInput,
      state: this.armState,
      volumeGate,
      
      // Confirmation conditions for flow
      confirmLongCondition: (data) => {
        // Confirm if flow remains bullish with consistent force
        return (data.flowDirection ?? 0) > 0 && (data.flowStrength ?? 0) > 0.3;
      },
      confirmShortCondition: (data) => {
        // Confirm if flow remains bearish with consistent force
        return (data.flowDirection ?? 0) < 0 && (data.flowStrength ?? 0) > 0.3;
      },
      
      minArmTicks: 2,
      baseConfidence: 0.15,
      armConfidencePerTick: 0.07,
      confirmedConfidence: 0.55
    });
  }
}

export default FlowPhysicsAgent;
