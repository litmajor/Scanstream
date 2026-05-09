/**
 * Volume Agent Integration Module
 * 
 * Coordinates VolumeMechanicalVerifierAgent with the wider system:
 * - Feeds volume data pipeline to agent
 * - Routes agent signals to consensus voting
 * - Integrates volume insights with exit orchestration
 * - Manages volume-based combo activations
 */

import { VolumeMechanicalVerifierAgent, type VolumeAnalysisInput } from './rpg-agents/VolumeMechanicalVerifierAgent';
import { VolumePipeline, type VolumeData } from './volume-data-pipeline';
import { IntelligentExitManager, type VolumeExitSignal } from './rpg-agents/intelligent-exit-manager';
import type { AgentSignal } from './rpg-agents/TradingAgent';

export interface VolumeAgentIntegrationConfig {
  // Data feeding
  enableVolumePipeline: boolean;
  volumePipelineUpdateInterval: number; // ms

  // Consensus voting
  volumeAgentVotingWeight: number; // 0-1, relative weight in consensus
  requiredConfidenceForSignal: number; // Min confidence to generate signal

  // Combo detection
  enableVolumeCombos: boolean;
  volumeComboThreshold: number; // Confidence threshold for combo activation

  // Exit integration
  enableVolumeExitInsights: boolean;
  exitSignalWeight: number; // How much to weight volume exit signals

  // Logging
  verboseLogging: boolean;
}

export class VolumeAgentIntegration {
  private volumeAgent: VolumeMechanicalVerifierAgent;
  private volumePipeline: VolumePipeline;
  private config: VolumeAgentIntegrationConfig;
  
  private lastSignal: AgentSignal | null = null;
  private signalHistory: AgentSignal[] = [];
  private maxHistorySize: number = 100;

  // Combo tracking
  private lastVolumeComboActivated: string | null = null;
  private comboActivationCount: number = 0;

  constructor(
    volumeAgent: VolumeMechanicalVerifierAgent,
    volumePipeline: VolumePipeline,
    config: Partial<VolumeAgentIntegrationConfig> = {}
  ) {
    this.volumeAgent = volumeAgent;
    this.volumePipeline = volumePipeline;
    this.config = {
      enableVolumePipeline: true,
      volumePipelineUpdateInterval: 100,
      volumeAgentVotingWeight: 0.9, // High weight - volume is critical
      requiredConfidenceForSignal: 0.55,
      enableVolumeCombos: true,
      volumeComboThreshold: 0.70,
      enableVolumeExitInsights: true,
      exitSignalWeight: 0.85,
      verboseLogging: false,
      ...config
    };
  }

  /**
   * Process new candle data through the entire volume integration pipeline
   */
  async processCandle(candle: {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }): Promise<{
    agentSignal: AgentSignal | null;
    volumeData: VolumeData;
    comboActivated?: string;
  }> {
    // Step 1: Update volume pipeline with new candle
    const volumeData = this.volumePipeline.processCandle(candle);

    if (this.config.verboseLogging) {
      console.log(`[VolumeIntegration] Processed candle: ${candle.close} (vol: ${candle.volume})`);
    }

    // Step 2: Generate agent signal from volume analysis
    const agentSignal = this.volumeAgent.generateSignal(volumeData as any as VolumeAnalysisInput);

    if (agentSignal) {
      this.lastSignal = agentSignal;
      this.signalHistory.push(agentSignal);
      if (this.signalHistory.length > this.maxHistorySize) {
        this.signalHistory.shift();
      }

      if (this.config.verboseLogging) {
        console.log(`[VolumeIntegration] Agent signal: ${agentSignal.action} (${(agentSignal.confidence * 100).toFixed(0)}%)`);
      }
    }

    // Step 3: Check for combo activation (optional)
    let comboActivated: string | undefined;
    if (this.config.enableVolumeCombos && agentSignal && agentSignal.confidence > this.config.volumeComboThreshold) {
      const combo = this.detectComboOpportunity(agentSignal);
      if (combo) {
        comboActivated = combo;
        this.lastVolumeComboActivated = combo;
        this.comboActivationCount++;

        if (this.config.verboseLogging) {
          console.log(`[VolumeIntegration] Combo activated: ${combo}`);
        }
      }
    }

    return {
      agentSignal,
      volumeData,
      comboActivated
    };
  }

  /**
   * Detect which volume combo should activate based on signal
   */
  private detectComboOpportunity(signal: AgentSignal): string | null {
    const patterns = (signal.metadata?.patterns as string[]) || [];
    const analysis = this.volumeAgent.getLastAnalysis();

    if (!analysis) return null;

    // Volume Validated Breakout
    if (patterns.includes('VALIDATED_BREAKOUT')) {
      return 'Volume Validated Breakout';
    }

    // Climax Reversal
    if (patterns.includes('BUYING_CLIMAX') || patterns.includes('SELLING_CLIMAX')) {
      return 'Climax Reversal';
    }

    // Smart Money Flow
    if (analysis.smartMoneySignal !== 'NEUTRAL') {
      return 'Smart Money Flow';
    }

    // Volume Conviction Buy/Sell
    if (analysis.convictionScore > 75) {
      return signal.action === 'BUY' ? 'Volume Conviction Buy' : 'Volume Conviction Sell';
    }

    // Fakeout Guard (detects and avoids)
    if (patterns.includes('FAKEOUT_TRAP')) {
      return 'Fakeout Guard';
    }

    return null;
  }

  /**
   * Get volume exit signals for exit orchestration
   * Returns actionable exit signals based on volume analysis
   */
  getVolumeExitSignals(exitManager: IntelligentExitManager): VolumeExitSignal[] {
    if (!this.config.enableVolumeExitInsights) {
      return [];
    }

    const analysis = this.volumeAgent.getLastAnalysis();
    if (!analysis) return [];

    const exitSignals: VolumeExitSignal[] = [];

    // Signal 1: Climax exhaustion
    if (analysis.climaxDetection.event !== 'NONE') {
      const climaxSignal = exitManager.detectClimaxExhaustion(
        analysis.climaxDetection.event,
        analysis.convictionScore
      );
      if (climaxSignal) {
        exitSignals.push(climaxSignal);
      }
    }

    // Signal 2: Distribution pattern at resistance
    if (analysis.significantEvent === 'DISTRIBUTION') {
      const distSignal = exitManager.detectDistributionPattern(
        analysis.smartMoneySignal,
        false, // Would need live price data
        1.0    // Would need volume ratio
      );
      if (distSignal) {
        exitSignals.push(distSignal);
      }
    }

    return exitSignals;
  }

  /**
   * Get current agent status for monitoring/display
   */
  getStatus(): {
    lastSignal: AgentSignal | null;
    signalCount: number;
    lastCombo: string | null;
    comboActivationCount: number;
    agentHealth: string;
  } {
    const agentStatus = this.volumeAgent.getStatus();

    return {
      lastSignal: this.lastSignal,
      signalCount: this.signalHistory.length,
      lastCombo: this.lastVolumeComboActivated,
      comboActivationCount: this.comboActivationCount,
      agentHealth: `L${agentStatus.level} ${agentStatus.rank} (${(agentStatus.stats.win_rate * 100).toFixed(1)}% WR)`
    };
  }

  /**
   * Get volume analysis summary for UI/logging
   */
  getAnalysisSummary(): string {
    const analysis = this.volumeAgent.getLastAnalysis();
    if (!analysis) return 'No analysis available';

    return this.volumeAgent.formatAnalysis();
  }

  /**
   * Record trade result for agent learning
   */
  recordTradeResult(result: { win: boolean; profit: number }): void {
    this.volumeAgent.recordTrade(result);
  }

  /**
   * Get signal history for analysis/backtesting
   */
  getSignalHistory(limit?: number): AgentSignal[] {
    if (!limit) return [...this.signalHistory];
    return this.signalHistory.slice(-limit);
  }

  /**
   * Update structural levels (support/resistance) for volume pipeline
   */
  updateStructuralLevels(supportLevels: number[], resistanceLevels: number[]): void {
    this.volumePipeline.updateStructuralLevels(supportLevels, resistanceLevels);
  }

  /**
   * Get current volume metrics
   */
  getCurrentVolumeMetrics() {
    return this.volumePipeline.getCurrentMetrics();
  }

  /**
   * Reset agent and pipeline state
   */
  reset(): void {
    this.volumePipeline.reset();
    this.lastSignal = null;
    this.signalHistory = [];
    this.lastVolumeComboActivated = null;
    this.comboActivationCount = 0;
  }

  /**
   * Get agent voting weight for consensus
   */
  getVotingWeight(): number {
    return this.config.volumeAgentVotingWeight;
  }

  /**
   * Check if signal meets confidence threshold for participation
   */
  meetsVotingThreshold(signal: AgentSignal): boolean {
    return signal.confidence >= this.config.requiredConfidenceForSignal;
  }
}

export default VolumeAgentIntegration;
