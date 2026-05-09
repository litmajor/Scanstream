#!/usr/bin/env node

/**
 * Log Management CLI Utility
 * Usage: node scripts/logs-cli.js [command] [options]
 * 
 * Commands:
 *   list              List all log files in current session
 *   stats             Show log statistics
 *   tail [file] [n]   Show last N lines of a log file
 *   search [pattern]  Search logs for a pattern
 *   follow [file]     Watch a log file for new content
 *   export [file]     Export a log file
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const logsDir = path.join(process.cwd(), 'logs');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function findLatestSession() {
  if (!fs.existsSync(logsDir)) {
    return null;
  }

  const sessions = fs.readdirSync(logsDir)
    .filter(f => fs.statSync(path.join(logsDir, f)).isDirectory())
    .sort()
    .reverse();

  return sessions[0] ? path.join(logsDir, sessions[0]) : null;
}

function findLogFile(sessionDir, filename) {
  const files = fs.readdirSync(sessionDir)
    .filter(f => f.endsWith('.log'));

  if (filename) {
    return files.find(f => f.includes(filename));
  }
  return files.sort().pop(); // Return latest chunk
}

function listLogs() {
  const sessionDir = findLatestSession();
  if (!sessionDir) {
    console.error('❌ No log files found');
    return;
  }

  const sessionId = path.basename(sessionDir);
  const files = fs.readdirSync(sessionDir)
    .filter(f => f.endsWith('.log'))
    .sort();

  console.log(`\n${colors.cyan}📁 Session: ${colors.bright}${sessionId}${colors.reset}`);
  console.log(`${colors.cyan}📂 Location: ${colors.bright}${sessionDir}${colors.reset}\n`);

  let totalSize = 0;
  files.forEach((file, i) => {
    const filePath = path.join(sessionDir, file);
    const stat = fs.statSync(filePath);
    totalSize += stat.size;
    const sizeStr = formatSize(stat.size).padStart(10);
    const number = `[${i + 1}/${files.length}]`.padEnd(8);
    console.log(`  ${number} ${sizeStr} ${colors.cyan}${file}${colors.reset}`);
  });

  console.log(
    `\n  ${colors.bright}Total:${colors.reset} ${files.length} files, ${formatSize(totalSize)}\n`
  );
}

function showStats() {
  const sessionDir = findLatestSession();
  if (!sessionDir) {
    console.error('❌ No log files found');
    return;
  }

  const sessionId = path.basename(sessionDir);
  const files = fs.readdirSync(sessionDir)
    .filter(f => f.endsWith('.log'))
    .sort();

  let totalSize = 0;
  let totalLines = 0;

  files.forEach(file => {
    const filePath = path.join(sessionDir, file);
    const stat = fs.statSync(filePath);
    totalSize += stat.size;

    const content = fs.readFileSync(filePath, 'utf-8');
    totalLines += content.split('\n').length - 1;
  });

  console.log(`\n${colors.cyan}${colors.bright}📊 Log Statistics${colors.reset}`);
  console.log(`${'='.repeat(50)}`);
  console.log(`  Session ID:     ${colors.cyan}${sessionId}${colors.reset}`);
  console.log(`  Total Chunks:   ${colors.bright}${files.length}${colors.reset}`);
  console.log(`  Total Size:     ${colors.bright}${formatSize(totalSize)}${colors.reset}`);
  console.log(`  Total Lines:    ${colors.bright}${totalLines.toLocaleString()}${colors.reset}`);
  console.log(`  Logs Directory: ${colors.cyan}${sessionDir}${colors.reset}`);
  console.log(`${'='.repeat(50)}\n`);
}

function tailLogs(filename, lines = 20) {
  const sessionDir = findLatestSession();
  if (!sessionDir) {
    console.error('❌ No log files found');
    return;
  }

  const logFile = findLogFile(sessionDir, filename);
  if (!logFile) {
    console.error(`❌ Log file not found: ${filename}`);
    return;
  }

  const filePath = path.join(sessionDir, logFile);
  const content = fs.readFileSync(filePath, 'utf-8');
  const allLines = content.split('\n').filter(l => l.length > 0);
  const tail = allLines.slice(Math.max(0, allLines.length - lines));

  console.log(`\n${colors.cyan}📄 ${colors.bright}${logFile}${colors.reset}`);
  console.log(`${colors.dim}Last ${lines} lines:${colors.reset}\n`);

  tail.forEach(line => {
    // Color-code log levels
    if (line.includes('[ERROR]')) {
      console.log(colors.red + line + colors.reset);
    } else if (line.includes('[WARN]')) {
      console.log(colors.yellow + line + colors.reset);
    } else if (line.includes('[INFO]')) {
      console.log(line);
    } else if (line.includes('[DEBUG]')) {
      console.log(colors.dim + line + colors.reset);
    } else {
      console.log(line);
    }
  });

  console.log();
}

function searchLogs(pattern, caseSensitive = false) {
  const sessionDir = findLatestSession();
  if (!sessionDir) {
    console.error('❌ No log files found');
    return;
  }

  const searchRegex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
  const files = fs.readdirSync(sessionDir)
    .filter(f => f.endsWith('.log'))
    .sort();

  let totalMatches = 0;

  console.log(`\n${colors.cyan}🔍 Search Results${colors.reset}`);
  console.log(`Pattern: ${colors.bright}${pattern}${colors.reset}`);
  console.log(`Files: ${files.length}\n`);

  files.forEach(file => {
    const filePath = path.join(sessionDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const matches = [];
    lines.forEach((line, i) => {
      if (searchRegex.test(line)) {
        matches.push({ line: i + 1, content: line });
      }
    });

    if (matches.length > 0) {
      totalMatches += matches.length;
      console.log(`${colors.cyan}📄 ${file}${colors.reset} (${colors.bright}${matches.length} matches${colors.reset})`);

      matches.slice(0, 5).forEach(match => {
        const lineStr = `[${match.line}]`.padEnd(8);
        if (match.content.includes('[ERROR]')) {
          console.log(`  ${lineStr} ${colors.red}${match.content}${colors.reset}`);
        } else if (match.content.includes('[WARN]')) {
          console.log(`  ${lineStr} ${colors.yellow}${match.content}${colors.reset}`);
        } else {
          console.log(`  ${lineStr} ${match.content}`);
        }
      });

      if (matches.length > 5) {
        console.log(`  ${colors.dim}... and ${matches.length - 5} more matches${colors.reset}`);
      }
      console.log();
    }
  });

  console.log(`${colors.bright}Total matches: ${totalMatches}${colors.reset}\n`);
}

function followLogs(filename) {
  const sessionDir = findLatestSession();
  if (!sessionDir) {
    console.error('❌ No log files found');
    return;
  }

  const logFile = findLogFile(sessionDir, filename);
  if (!logFile) {
    console.error(`❌ Log file not found: ${filename}`);
    return;
  }

  const filePath = path.join(sessionDir, logFile);
  let lastSize = fs.statSync(filePath).size;

  console.log(`${colors.cyan}👁️ Following: ${colors.bright}${logFile}${colors.reset}`);
  console.log(`${colors.dim}Press Ctrl+C to exit\n${colors.reset}`);

  setInterval(() => {
    const stat = fs.statSync(filePath);
    if (stat.size > lastSize) {
      const stream = fs.createReadStream(filePath, {
        start: lastSize,
        encoding: 'utf-8',
      });

      stream.on('data', chunk => {
        process.stdout.write(chunk);
      });

      lastSize = stat.size;
    }
  }, 1000);
}

// Main CLI
const command = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

switch (command) {
  case 'list':
    listLogs();
    break;

  case 'stats':
    showStats();
    break;

  case 'tail':
    tailLogs(arg1, parseInt(arg2) || 20);
    break;

  case 'search':
    if (!arg1) {
      console.error('Usage: logs-cli.js search <pattern> [--case-sensitive]');
      process.exit(1);
    }
    searchLogs(arg1, arg2 === '--case-sensitive');
    break;

  case 'follow':
    followLogs(arg1);
    break;

  case 'help':
  case '--help':
  case '-h':
    console.log(`
${colors.bright}📋 Log Management CLI${colors.reset}

Usage: node scripts/logs-cli.js [command] [options]

Commands:
  ${colors.cyan}list${colors.reset}              List all log files in current session
  ${colors.cyan}stats${colors.reset}             Show log statistics
  ${colors.cyan}tail${colors.reset} [file] [n]   Show last N lines of a log file
  ${colors.cyan}search${colors.reset} [pattern]  Search logs for a pattern
  ${colors.cyan}follow${colors.reset} [file]     Watch a log file for new content
  ${colors.cyan}help${colors.reset}              Show this help message

Examples:
  node scripts/logs-cli.js list
  node scripts/logs-cli.js stats
  node scripts/logs-cli.js tail chunk-000 50
  node scripts/logs-cli.js search ERROR
  node scripts/logs-cli.js search "connection failed" --case-sensitive
  node scripts/logs-cli.js follow chunk-000
    `);
    break;

  default:
    console.error(`Unknown command: ${command}`);
    console.error(`Try: node scripts/logs-cli.js --help`);
    process.exit(1);
}
