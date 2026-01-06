/**
 * Phase 2 Diagnostic - Debug why BTC has no trades
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MarketTick {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

class SimpleFoRCalculator {
  readonly hostileRanges = [
    { pct: 0.5, score: -15 },
    { pct: 1.0, score: -10 },
    { pct: 2.0, score: -5 },
    { pct: 5.0, score: -2 },
  ];

  calculate(closes: number[], window = 20): number[] {
    const scores: number[] = [];
    const baseScore = 50;

    for (let i = window; i < closes.length; i++) {
      const windowClose = closes.slice(Math.max(0, i - window), i);
      const recentHigh = Math.max(...windowClose);
      const currentClose = closes[i];
      
      let score = baseScore;
      
      for (const range of this.hostileRanges) {
        const bounceThreshold = recentHigh * (1 - range.pct / 100);
        if (currentClose < bounceThreshold) {
          score += range.score;
        }
      }

      if (currentClose > recentHigh * 1.005) {
        score += 15;
      }

      scores.push(Math.max(0, Math.min(100, score)));
    }

    return scores;
  }
}

class SurvivalFilterLite {
  async validate(
    closes: number[],
    forScores: number[],
    deploymentBar: number,
    survivalWindow = 5
  ): Promise<boolean> {
    if (deploymentBar + survivalWindow >= closes.length) {
      return false;
    }

    const entryClose = closes[deploymentBar];
    for (let i = 1; i <= survivalWindow; i++) {
      if (closes[deploymentBar + i] < entryClose * 0.99) {
        return false;
      }
    }

    return true;
  }
}

async function diagnose() {
  const dataDir = path.join(__dirname, '../../data/cache');
  const btcRaw = JSON.parse(fs.readFileSync(path.join(dataDir, 'BTCUSDT_1h_365d.json'), 'utf-8')) as any;
  const btcData = (Array.isArray(btcRaw) ? btcRaw : btcRaw.data) as MarketTick[];

  const closes = btcData.map(tick => tick.close);

  console.log('🔍 PHASE 2 DIAGNOSTIC');
  console.log('='.repeat(60));
  console.log(`Data points: ${closes.length}`);

  // Calculate FoR
  const forCalc = new SimpleFoRCalculator();
  const forScores = forCalc.calculate(closes, 20);

  console.log(`FoR scores calculated: ${forScores.length}`);
  console.log(`Max FoR score: ${Math.max(...forScores)}`);
  console.log(`Min FoR score: ${Math.min(...forScores)}`);

  // Find deployments at threshold 60
  const potentialDeploys: number[] = [];
  for (let i = 0; i < forScores.length; i++) {
    if (forScores[i] > 60) {
      potentialDeploys.push(i);
    }
  }

  console.log(`\nSignals with FoR > 60: ${potentialDeploys.length}`);
  if (potentialDeploys.length > 0) {
    console.log(`First 10 deployment bars: ${potentialDeploys.slice(0, 10).join(', ')}`);
  }

  // Test survival filter
  const filter = new SurvivalFilterLite();
  const validDeploys: number[] = [];
  let failCount = 0;

  for (const deployBar of potentialDeploys) {
    const survived = await filter.validate(closes, forScores, deployBar, 5);
    if (survived) {
      validDeploys.push(deployBar);
    } else {
      failCount++;
    }
  }

  console.log(`\nSurvival filter results:`);
  console.log(`  Passed survival: ${validDeploys.length}`);
  console.log(`  Failed survival: ${failCount}`);
  console.log(`  Survival rate: ${((validDeploys.length / potentialDeploys.length) * 100).toFixed(1)}%`);

  if (validDeploys.length > 0) {
    console.log(`\nFirst 10 valid deployments: ${validDeploys.slice(0, 10).join(', ')}`);

    // Test one deployment with ATR sizing
    const testBar = validDeploys[0];
    const entryPrice = closes[testBar];
    console.log(`\nTest deployment at bar ${testBar}:`);
    console.log(`  Entry price: $${entryPrice.toFixed(2)}`);

    // Calculate ATR
    const atrs: number[] = [];
    for (let i = 0; i < btcData.length; i++) {
      if (i === 0) {
        atrs.push(0);
        continue;
      }
      const curr = btcData[i];
      const prev = btcData[i - 1];
      const tr = Math.max(
        curr.high - curr.low,
        Math.abs(curr.high - prev.close),
        Math.abs(curr.low - prev.close)
      );

      if (i < 14) {
        atrs.push(tr);
      } else {
        const prevATR = atrs[i - 1];
        const newATR = (prevATR * 13 + tr) / 14;
        atrs.push(newATR);
      }
    }

    const currentATR = atrs[testBar] || 0.01;
    console.log(`  ATR(14): ${currentATR.toFixed(2)}`);

    const riskDollars = 10000 * 0.03; // 3% risk
    const stopLoss = entryPrice * 0.01; // 1% stop
    const positionSize = Math.floor(riskDollars / stopLoss);

    console.log(`\n  Risk calculation (3% account risk):`);
    console.log(`    Risk dollars: $${riskDollars.toFixed(2)}`);
    console.log(`    Stop loss: $${stopLoss.toFixed(2)} (1% from entry)`);
    console.log(`    Position size: ${positionSize} units`);

    if (positionSize === 0) {
      console.log(`  ⚠️  Position size is 0 - this causes no trades!`);
    }
  } else {
    console.log('\n⚠️  No deployments survived the 5-bar survival filter!');
  }
}

diagnose().catch(console.error);
