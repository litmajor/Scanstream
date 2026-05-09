/**
 * Scout Report Trading Integration Service
 * 
 * Service to handle execution of trades directly from Scout Reports.
 * Integrates with the existing trading system and order management.
 */

import type { TradeOpportunity } from '../types/scout-report-types';

export interface ExecutionRequest {
  symbol: string;
  opportunity: TradeOpportunity;
  entryStrategy: 'conservative' | 'optimal' | 'aggressive';
  entryPrice: number;
  stopLoss: number;
  target: number;
  positionSize?: number;
  orderId?: string;
}

export interface ExecutionResponse {
  success: boolean;
  orderId?: string;
  message: string;
  executedAt?: number;
  error?: string;
}

/**
 * Hook to handle trade execution from Scout Reports
 */
export const useScoutReportTrading = () => {
  /**
   * Execute a trade based on Scout Report opportunity
   */
  const executeTrade = async (
    request: ExecutionRequest,
    onProgress?: (message: string) => void
  ): Promise<ExecutionResponse> => {
    try {
      onProgress?.('Validating trade parameters...');

      // Validate request
      if (!request.symbol || !request.opportunity || !request.entryStrategy) {
        return {
          success: false,
          message: 'Invalid trade parameters',
          error: 'Missing required fields',
        };
      }

      onProgress?.('Calculating entry and exit levels...');

      // Calculate exact entry price based on strategy
      const entryPrice = calculateEntryPrice(request.opportunity, request.entryStrategy);

      // Validate entry price within zone
      if (
        entryPrice < request.opportunity.entryZone.low ||
        entryPrice > request.opportunity.entryZone.high
      ) {
        return {
          success: false,
          message: 'Entry price outside acceptable range',
          error: `Entry price ${entryPrice} outside range [${request.opportunity.entryZone.low}, ${request.opportunity.entryZone.high}]`,
        };
      }

      onProgress?.('Submitting order to trading system...');

      // Submit to backend API (use computed entryPrice)
      const response = await fetch('/api/trading/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: request.symbol,
          direction: request.opportunity.direction,
          entryPrice: entryPrice,
          stopLoss: request.stopLoss,
          target: request.target,
          positionSize: request.positionSize || calculatePositionSize(request.opportunity),
          opportunityId: request.opportunity.id,
          strategy: request.entryStrategy,
          opportunitySource: request.opportunity.supportingSources?.map(s => s.source) || [],
          confidence: request.opportunity.confidence,
          riskReward: request.opportunity.riskRewardRatio,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          message: 'Failed to execute trade',
          error: errorData.error || 'Trading system error',
        };
      }

      const data = await response.json();

      onProgress?.('Trade executed successfully!');

      return {
        success: true,
        orderId: data.orderId,
        message: `Trade executed at ${entryPrice.toFixed(2)}`,
        executedAt: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: 'Trade execution failed',
        error: errorMessage,
      };
    }
  };

  /**
   * Calculate exact entry price based on strategy
   */
  const calculateEntryPrice = (
    opportunity: TradeOpportunity,
    strategy: 'conservative' | 'optimal' | 'aggressive'
  ): number => {
    const { low, high, optimal } = opportunity.entryZone;

    switch (strategy) {
      case 'conservative':
        return opportunity.entryStrategy?.conservative?.price ?? high;
      case 'optimal':
        return opportunity.entryStrategy?.optimal?.price ?? optimal;
      case 'aggressive':
        return opportunity.entryStrategy?.aggressive?.price ?? low;
      default:
        return optimal;
    }
  };

  /**
   * Calculate position size based on risk and opportunity
   */
  const calculatePositionSize = (opportunity: TradeOpportunity): number => {
    // Default 1% risk per trade with opportunity quality adjustment
    const baseRisk = 0.01;
    const qualityMultiplier = opportunity.qualityScore / 10; // 0.1 to 1.0
    const confidenceBonus = opportunity.confidence > 0.8 ? 1.5 : 1.0;

    return baseRisk * qualityMultiplier * confidenceBonus;
  };

  /**
   * Validate trade before execution
   */
  const validateTrade = (
    opportunity: TradeOpportunity,
    entryPrice: number
  ): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Check minimum confidence
    if (opportunity.confidence < 0.5) {
      errors.push('Confidence below 50% - risky trade');
    }

    // Check risk/reward ratio
    if (opportunity.riskRewardRatio < 1) {
      errors.push('Risk/reward ratio less than 1:1 - unfavorable');
    }

    // Check entry price is within zone
    if (opportunity.entryZone && (entryPrice < opportunity.entryZone.low || entryPrice > opportunity.entryZone.high)) {
      errors.push('Entry price outside acceptable zone');
    }

    // Check probability threshold
    if (opportunity.probability < 0.45) {
      errors.push('Win probability below 45% - high risk');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  };

  return {
    executeTrade,
    calculateEntryPrice,
    calculatePositionSize,
    validateTrade,
  };
};

export default useScoutReportTrading;
