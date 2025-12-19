/**
 * Heavy Indicator Worker Thread
 * 
 * Executes long-running indicator computations (Ichimoku, volumeProfile) in a separate thread.
 * Receives frame data via message, computes indicators, and returns results.
 */

import { parentPort } from 'worker_threads';
import * as indicators from './indicators';

interface WorkerTask {
  id: string;
  symbol: string;
  timeframe: string;
  indicatorName: string;
  frameData: {
    closes: number[];
    volumes: number[];
    highs: number[];
    lows: number[];
  };
  priority: number;
  createdAt: number;
}

interface WorkerResult {
  taskId: string;
  success: boolean;
  indicatorName: string;
  data?: any;
  error?: string;
  computationTimeMs: number;
}

/**
 * Compute heavy indicators.
 */
function computeHeavyIndicator(task: WorkerTask): WorkerResult {
  const startTime = performance.now();
  const { id, indicatorName, frameData } = task;
  const { closes, volumes, highs, lows } = frameData;

  try {
    let result: any;

    switch (indicatorName) {
      case 'ichimoku':
        result = indicators.ichimoku(highs, lows, closes);
        break;

      case 'volumeProfile':
        result = indicators.volumeProfile(closes, volumes, 50, 200);
        break;

      default:
        throw new Error(`Unknown heavy indicator: ${indicatorName}`);
    }

    const computationTimeMs = performance.now() - startTime;

    return {
      taskId: id,
      success: true,
      indicatorName,
      data: result,
      computationTimeMs
    };
  } catch (error) {
    const computationTimeMs = performance.now() - startTime;
    return {
      taskId: id,
      success: false,
      indicatorName,
      error: error instanceof Error ? error.message : String(error),
      computationTimeMs
    };
  }
}

/**
 * Message handler: receive tasks from main thread.
 */
if (parentPort) {
  parentPort.on('message', (task: WorkerTask) => {
    const result = computeHeavyIndicator(task);
    parentPort?.postMessage(result);
  });
}

export {};
