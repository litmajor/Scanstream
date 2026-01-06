import fs from 'fs';
import path from 'path';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file path - rotate daily
const getLogFilePath = () => {
  const date = new Date().toISOString().split('T')[0];
  return path.join(logsDir, `server-${date}.log`);
};

// Write stream for logs
let writeStream: fs.WriteStream | null = null;

const getWriteStream = () => {
  if (!writeStream) {
    writeStream = fs.createWriteStream(getLogFilePath(), { flags: 'a' });
  }
  return writeStream;
};

/**
 * Log messages to both console and file
 */
export function logToFile(level: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] ${message}${data ? '\n  ' + JSON.stringify(data) : ''}`;
  
  // Write to file
  try {
    getWriteStream().write(logEntry + '\n');
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

/**
 * Intercept console.log/error/warn to write to file
 */
export function setupConsoleLogging() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args: any[]) => {
    const message = args.map(a => 
      typeof a === 'object' ? JSON.stringify(a) : String(a)
    ).join(' ');
    
    logToFile('INFO', message);
    originalLog(...args);
  };

  console.error = (...args: any[]) => {
    const message = args.map(a => 
      typeof a === 'object' ? JSON.stringify(a) : String(a)
    ).join(' ');
    
    logToFile('ERROR', message);
    originalError(...args);
  };

  console.warn = (...args: any[]) => {
    const message = args.map(a => 
      typeof a === 'object' ? JSON.stringify(a) : String(a)
    ).join(' ');
    
    logToFile('WARN', message);
    originalWarn(...args);
  };
}

/**
 * Get path to current log file
 */
export function getLogPath() {
  return getLogFilePath();
}

/**
 * Close the write stream gracefully
 */
export function closeLogger() {
  if (writeStream) {
    writeStream.end();
  }
}
