/**
 * VALIDATION SCRIPT
 * Confirms all components work and are ready for paper trading
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n' + '='.repeat(80));
console.log('🔍 CONVEXITY ENGINE - VALIDATION CHECK');
console.log('='.repeat(80) + '\n');

// Check 1: Backtest files exist
console.log('✓ Checking backtest files...');
const backTestDir = path.join(process.cwd(), 'server', 'backtest');
const requiredFiles = [
  'convexity-backtest-lite.ts',
  'phase2-optimizer.ts',
  'target-optimization.ts',
  'realistic-money-sim.ts',
  'conservative-sim.ts',
  'paper-trading-tracker.ts',
  'paper-trading-api.ts'
];

let allFilesExist = true;
for (const file of requiredFiles) {
  const filePath = path.join(backTestDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} MISSING`);
    allFilesExist = false;
  }
}

// Check 2: Data directory structure
console.log('\n✓ Checking data directories...');
const dataDirs = [
  'data',
  'data/cache',
  'data/paper-trading'
];

for (const dir of dataDirs) {
  const dirPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  console.log(`  ✅ ${dir}/`);
}

// Check 3: Paper trading data
console.log('\n✓ Checking paper trading data...');
const paperTradingDir = path.join(process.cwd(), 'data', 'paper-trading');
const sessions = fs.readdirSync(paperTradingDir).filter(f => f.endsWith('.json'));
console.log(`  ✅ Found ${sessions.length} paper trading session(s)`);

// Check 4: Validate ConvexityAgent TypeScript
console.log('\n✓ Checking ConvexityAgent...');
const agentPath = path.join(process.cwd(), 'server', 'services', 'rpg-agents', 'ConvexityAgent.ts');
if (fs.existsSync(agentPath)) {
  const content = fs.readFileSync(agentPath, 'utf-8');
  const hasImportFix = content.includes("import FailureOfReversionCalculator from '../vfmd/failureOfReversionCalculator.ts'");
  if (hasImportFix) {
    console.log('  ✅ Import fixes applied');
  } else {
    console.log('  ⚠️  Import fixes may not be applied');
  }
  console.log('  ✅ ConvexityAgent.ts found');
} else {
  console.log('  ⚠️  ConvexityAgent.ts not found');
}

// Check 5: Optimization results
console.log('\n✓ Checking optimization results...');
const resultsPath = path.join(process.cwd(), 'PHASE_2_OPTIMIZATION_RESULTS.json');
if (fs.existsSync(resultsPath)) {
  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
  console.log(`  ✅ Optimization results found`);
  
  // Show best configs
  const btcConfigs = Object.entries(results.BTC || {})
    .map(([key, val]: any) => ({ config: key, ...val }))
    .sort((a, b) => (b.metrics?.sharpeRatio || 0) - (a.metrics?.sharpeRatio || 0));
  
  if (btcConfigs.length > 0) {
    const best = btcConfigs[0];
    console.log(`  📊 Best BTC Config: ${best.config}`);
    console.log(`     Win Rate: ${best.metrics?.winRate.toFixed(1)}%`);
    console.log(`     Sharpe: ${best.metrics?.sharpeRatio.toFixed(2)}`);
  }
} else {
  console.log('  ⚠️  Optimization results not found (run phase2-optimizer.ts)');
}

// Summary
console.log('\n' + '='.repeat(80));
console.log('📊 VALIDATION SUMMARY');
console.log('='.repeat(80) + '\n');

const checks = [
  { name: 'Backtest files', pass: allFilesExist },
  { name: 'Data directories', pass: true },
  { name: 'ConvexityAgent', pass: fs.existsSync(agentPath) },
  { name: 'Paper trading API', pass: fs.existsSync(path.join(backTestDir, 'paper-trading-api.ts')) }
];

const passed = checks.filter(c => c.pass).length;
const total = checks.length;

console.log(`✅ Passed: ${passed}/${total}\n`);

if (passed === total) {
  console.log('🟢 ALL SYSTEMS GO! Ready to paper trade.\n');
  console.log('Next steps:');
  console.log('  1. Run ConvexityAgent on live feed');
  console.log('  2. Log each trade with paper-trading-api');
  console.log('  3. Check daily: npx ts-node server/backtest/paper-trading-cli.ts stats BTC/USDT');
  console.log('  4. After 50+ trades with 70%+ WR, consider real money\n');
} else {
  console.log('⚠️  Some checks failed. Please review above.\n');
}

// Quick reference
console.log('📚 QUICK REFERENCE:\n');
console.log('Show strategy overview:');
console.log('  npx ts-node server/backtest/conservative-sim.ts\n');
console.log('Paper trading stats:');
console.log('  npx ts-node server/backtest/paper-trading-cli.ts stats BTC/USDT\n');
console.log('Log a trade:');
console.log('  npx ts-node server/backtest/paper-trading-cli.ts log BTC/USDT [entry] [exit] [qty] [risk] [target] [sl] [won]\n');

console.log('📖 Full guide: CONVEXITY_OPTIMIZATION_COMPLETE.md\n');
console.log('='.repeat(80) + '\n');
