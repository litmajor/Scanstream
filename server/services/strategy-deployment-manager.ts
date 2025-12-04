import { liveTradingEngine } from '../live-trading-engine';
import { paperTradingEngine } from '../paper-trading-engine';
import type { Signal } from '@shared/schema';

type DeploymentMode = 'backtest' | 'paper' | 'live';
type StrategyStatus = 'inactive' | 'paper' | 'live';

interface StrategyDeployment {
  strategyId: string;
  mode: DeploymentMode;
  status: StrategyStatus;
  isActive: boolean;
  lastUpdated: Date;
  performance: {
    totalTrades: number;
    winRate: number;
    totalPnL: number;
    sharpeRatio: number;
  };
}

export class StrategyDeploymentManager {
  private deployments: Map<string, StrategyDeployment> = new Map();
  
  /**
   * Deploy a strategy
   */
  async deployStrategy(
    strategyId: string,
    mode: DeploymentMode
  ): Promise<{ success: boolean; message: string }> {
    // Safety check: prevent live deployment without explicit confirmation
    if (mode === 'live') {
      const liveTradingStatus = liveTradingEngine.getStatus();
      if (!liveTradingStatus.testMode) {
        return {
          success: false,
          message: 'Live trading requires testMode to be disabled first. Use /api/live-trading/config endpoint.'
        };
      }
    }

    const deployment: StrategyDeployment = {
      strategyId,
      mode,
      status: mode === 'backtest' ? 'inactive' : mode === 'paper' ? 'paper' : 'live',
      isActive: mode !== 'backtest',
      lastUpdated: new Date(),
      performance: {
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
        sharpeRatio: 0
      }
    };

    this.deployments.set(strategyId, deployment);

    // Start appropriate engine
    if (mode === 'live') {
      if (!liveTradingEngine.getStatus().isRunning) {
        await liveTradingEngine.start();
      }
    } else if (mode === 'paper') {
      if (!paperTradingEngine.getStatus().isRunning) {
        await paperTradingEngine.start();
      }
    }

    return {
      success: true,
      message: `Strategy ${strategyId} deployed in ${mode} mode`
    };
  }

  /**
   * Stop a strategy deployment
   */
  stopStrategy(strategyId: string): { success: boolean; message: string } {
    const deployment = this.deployments.get(strategyId);
    
    if (!deployment) {
      return {
        success: false,
        message: 'Strategy not found'
      };
    }

    deployment.isActive = false;
    deployment.status = 'inactive';
    deployment.lastUpdated = new Date();

    return {
      success: true,
      message: `Strategy ${strategyId} stopped`
    };
  }

  /**
   * Execute signal based on strategy deployment mode
   */
  async executeSignal(strategyId: string, signal: Signal): Promise<boolean> {
    const deployment = this.deployments.get(strategyId);
    
    if (!deployment || !deployment.isActive) {
      console.log(`[Deployment] Strategy ${strategyId} not active, skipping signal`);
      return false;
    }

    try {
      switch (deployment.mode) {
        case 'live':
          const liveOrder = await liveTradingEngine.executeSignal(signal);
          if (liveOrder) {
            this.updatePerformance(strategyId, 'trade_executed');
            return true;
          }
          return false;

        case 'paper':
          const paperOrder = await paperTradingEngine.executeSignal(signal);
          if (paperOrder) {
            this.updatePerformance(strategyId, 'trade_executed');
            return true;
          }
          return false;

        case 'backtest':
          console.log(`[Deployment] Strategy ${strategyId} in backtest mode, not executing`);
          return false;

        default:
          return false;
      }
    } catch (error) {
      console.error(`[Deployment] Error executing signal for ${strategyId}:`, error);
      return false;
    }
  }

  /**
   * Update strategy performance metrics
   */
  private updatePerformance(strategyId: string, event: 'trade_executed' | 'trade_closed'): void {
    const deployment = this.deployments.get(strategyId);
    if (!deployment) return;

    if (event === 'trade_executed') {
      deployment.performance.totalTrades++;
    }

    deployment.lastUpdated = new Date();
  }

  /**
   * Get deployment status for a strategy
   */
  getDeploymentStatus(strategyId: string): StrategyDeployment | null {
    return this.deployments.get(strategyId) || null;
  }

  /**
   * Get all deployments
   */
  getAllDeployments(): StrategyDeployment[] {
    return Array.from(this.deployments.values());
  }

  /**
   * Get deployments by mode
   */
  getDeploymentsByMode(mode: DeploymentMode): StrategyDeployment[] {
    return Array.from(this.deployments.values()).filter(d => d.mode === mode);
  }
}

// Export singleton
export const strategyDeploymentManager = new StrategyDeploymentManager();