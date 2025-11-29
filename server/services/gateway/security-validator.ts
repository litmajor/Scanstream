
import { ExchangeAggregator } from './exchange-aggregator';
import { LiquidityMonitor } from './liquidity-monitor';

export interface SecurityCheck {
  passed: boolean;
  riskScore: number; // 0-100, higher = riskier
  warnings: string[];
  checks: {
    priceDeviation: boolean;
    liquidity: boolean;
    volumeAnomaly: boolean;
    priceRange: boolean;
  };
  recommendation: 'SAFE' | 'CAUTION' | 'RISKY' | 'DANGEROUS';
}

export class SecurityValidator {
  private aggregator: ExchangeAggregator;
  private liquidityMonitor: LiquidityMonitor;

  constructor(aggregator: ExchangeAggregator, liquidityMonitor: LiquidityMonitor) {
    this.aggregator = aggregator;
    this.liquidityMonitor = liquidityMonitor;
  }

  /**
   * Validate trading operation safety
   */
  async validateOperation(
    symbol: string,
    amount: number,
    operation: 'buy' | 'sell'
  ): Promise<SecurityCheck> {
    const warnings: string[] = [];
    let riskScore = 0;
    const checks = {
      priceDeviation: false,
      liquidity: false,
      volumeAnomaly: false,
      priceRange: false
    };

    // 1. Price Deviation Check
    const priceData = await this.aggregator.getAggregatedPrice(symbol);
    
    if (priceData.deviation > 2) {
      warnings.push(`High price deviation: ${priceData.deviation.toFixed(2)}%`);
      riskScore += 30;
    } else if (priceData.deviation > 0.5) {
      warnings.push(`Moderate price deviation: ${priceData.deviation.toFixed(2)}%`);
      riskScore += 10;
    } else {
      checks.priceDeviation = true;
    }

    // 2. Liquidity Check
    const liquidity = await this.liquidityMonitor.checkLiquidity(symbol, amount);
    
    if (!liquidity.healthy) {
      warnings.push(`Low liquidity score: ${liquidity.liquidityScore.toFixed(0)}/100`);
      riskScore += 25;
    } else {
      checks.liquidity = true;
    }
    
    if (liquidity.spreadPercent > 0.01) {
      warnings.push(`Wide spread: ${(liquidity.spreadPercent * 100).toFixed(2)}%`);
      riskScore += 15;
    }

    // 3. Volume Anomaly Check
    const ohlcv = await this.aggregator.getOHLCV(symbol, '1h', 24);
    const recentVolume = ohlcv.slice(-1)[0]?.volume || 0;
    const avgVolume = ohlcv.reduce((sum, c) => sum + c.volume, 0) / ohlcv.length;
    
    if (recentVolume < avgVolume * 0.3) {
      warnings.push(`Unusually low volume: ${((recentVolume / avgVolume) * 100).toFixed(0)}% of average`);
      riskScore += 20;
    } else if (recentVolume > avgVolume * 3) {
      warnings.push(`Unusually high volume: ${((recentVolume / avgVolume) * 100).toFixed(0)}% of average`);
      riskScore += 10;
    } else {
      checks.volumeAnomaly = true;
    }

    // 4. Price Range Check (flash crash detection)
    const prices = ohlcv.map(c => c.close);
    const currentPrice = prices[prices.length - 1];
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    
    if (currentPrice < avgPrice * 0.5 || currentPrice > avgPrice * 2) {
      warnings.push('Price outside normal range - possible anomaly');
      riskScore += 40;
    } else {
      checks.priceRange = true;
    }

    // 5. Confidence Check
    if (priceData.confidence < 70) {
      warnings.push(`Low price confidence: ${priceData.confidence.toFixed(0)}%`);
      riskScore += 15;
    }

    // Determine recommendation
    let recommendation: SecurityCheck['recommendation'];
    if (riskScore < 20) {
      recommendation = 'SAFE';
    } else if (riskScore < 40) {
      recommendation = 'CAUTION';
    } else if (riskScore < 70) {
      recommendation = 'RISKY';
    } else {
      recommendation = 'DANGEROUS';
    }

    return {
      passed: riskScore < 40,
      riskScore,
      warnings,
      checks,
      recommendation
    };
  }

  /**
   * Validate price sanity
   */
  validatePrice(currentPrice: number, lastPrice: number): boolean {
    // Reject if price changed more than 50% (likely bad data)
    const change = Math.abs(currentPrice - lastPrice) / lastPrice;
    return change < 0.5;
  }
}
