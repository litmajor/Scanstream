/**
 * Heavy Indicator Worker Pool
 * 
 * Offloads expensive indicator computations (Ichimoku, volumeProfile) to worker threads.
 * Supports async computation with priority queuing and result caching.
 */

import { Worker } from 'worker_threads';
import path from 'path';

export interface WorkerTask {
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
  priority: number; // 0 = low, 10 = high
  createdAt: number;
}

export interface WorkerResult {
  taskId: string;
  success: boolean;
  indicatorName: string;
  data?: any;
  error?: string;
  computationTimeMs: number;
}

export interface WorkerPoolOptions {
  /** Number of worker threads to maintain */
  poolSize?: number;
  /** Max tasks to queue before rejecting new ones */
  maxQueueSize?: number;
  /** Timeout in ms for each task */
  taskTimeoutMs?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Manages a pool of worker threads for offloading heavy indicator computations.
 * Tasks are queued and processed in priority order.
 */
export class HeavyIndicatorWorkerPool {
  private workers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private pendingTasks = new Map<string, { task: WorkerTask; resolve: Function; reject: Function; timeout?: NodeJS.Timeout }>();
  private taskIdCounter = 0;
  private readonly poolSize: number;
  private readonly maxQueueSize: number;
  private readonly taskTimeoutMs: number;
  private readonly debug: boolean;
  private stats = { completed: 0, failed: 0, queued: 0, avgTimeMs: 0 };

  constructor(opts?: WorkerPoolOptions) {
    this.poolSize = opts?.poolSize ?? 2;
    this.maxQueueSize = opts?.maxQueueSize ?? 100;
    this.taskTimeoutMs = opts?.taskTimeoutMs ?? 30_000;
    this.debug = opts?.debug ?? false;
    this.initializeWorkers();
  }

  /**
   * Initialize worker threads (lazy, only created when needed).
   */
  private initializeWorkers(): void {
    // Workers are created on-demand to avoid startup overhead
    if (this.debug) console.log(`[WorkerPool] Initialized (pool size: ${this.poolSize})`);
  }

  /**
   * Create a single worker thread.
   */
  private createWorker(): Worker {
    const workerScript = path.join(__dirname, 'heavy-indicator-worker.js');
    const worker = new Worker(workerScript);
    worker.on('message', (result: WorkerResult) => {
      this.handleWorkerResult(result);
    });
    worker.on('error', (err) => {
      console.error(`[WorkerPool] Worker error:`, err);
    });
    if (this.debug) console.log(`[WorkerPool] Created worker (total: ${this.workers.length + 1})`);
    return worker;
  }

  /**
   * Get a worker, creating one if needed and pool allows.
   */
  private getAvailableWorker(): Worker | undefined {
    // Try to find an idle worker (simplified: we use round-robin in practice)
    if (this.workers.length < this.poolSize) {
      const worker = this.createWorker();
      this.workers.push(worker);
      return worker;
    }
    // All workers busy; queue the task instead
    return undefined;
  }

  /**
   * Queue a task for computation or process immediately if workers available.
   */
  async computeIndicator(
    symbol: string,
    timeframe: string,
    indicatorName: string,
    frames: { closes: number[]; volumes: number[]; highs: number[]; lows: number[] },
    priority = 5
  ): Promise<WorkerResult> {
    if (this.pendingTasks.size + this.taskQueue.length >= this.maxQueueSize) {
      throw new Error(`Worker queue full: ${this.maxQueueSize} tasks`);
    }

    const taskId = `task_${++this.taskIdCounter}_${Date.now()}`;
    const task: WorkerTask = {
      id: taskId,
      symbol,
      timeframe,
      indicatorName,
      frameData: frames,
      priority,
      createdAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      this.pendingTasks.set(taskId, { task, resolve, reject });
      this.stats.queued++;

      // Try to process immediately
      this.processNextTask();

      // Set timeout for the task
      const timeout = setTimeout(() => {
        this.pendingTasks.delete(taskId);
        reject(new Error(`Task timeout: ${indicatorName} for ${symbol}/${timeframe}`));
        if (this.debug) console.log(`[WorkerPool] TIMEOUT: ${taskId}`);
      }, this.taskTimeoutMs);

      if (this.pendingTasks.has(taskId)) {
        this.pendingTasks.get(taskId)!.timeout = timeout;
      }
    });
  }

  /**
   * Process the next task from the queue.
   */
  private processNextTask(): void {
    if (this.taskQueue.length === 0) return;

    // Sort by priority (higher first) and FIFO within same priority
    this.taskQueue.sort((a, b) => b.priority - a.priority);
    const task = this.taskQueue.shift();

    if (!task) return;

    const worker = this.getAvailableWorker();
    if (!worker) {
      // Re-queue if no workers available
      this.taskQueue.push(task);
      return;
    }

    if (this.debug) console.log(`[WorkerPool] Processing: ${task.indicatorName} for ${task.symbol}/${task.timeframe}`);
    worker.postMessage(task);
  }

  /**
   * Handle result from worker.
   */
  private handleWorkerResult(result: WorkerResult): void {
    const pending = this.pendingTasks.get(result.taskId);
    if (!pending) {
      if (this.debug) console.log(`[WorkerPool] Received result for unknown task: ${result.taskId}`);
      return;
    }

    this.pendingTasks.delete(result.taskId);
    if (pending.timeout) clearTimeout(pending.timeout);

    if (result.success) {
      this.stats.completed++;
      this.stats.avgTimeMs = (this.stats.avgTimeMs + result.computationTimeMs) / 2;
      if (this.debug) console.log(`[WorkerPool] COMPLETED: ${result.indicatorName} in ${result.computationTimeMs.toFixed(0)}ms`);
      pending.resolve(result);
    } else {
      this.stats.failed++;
      if (this.debug) console.log(`[WorkerPool] FAILED: ${result.indicatorName} - ${result.error}`);
      pending.reject(new Error(result.error ?? 'Unknown error'));
    }

    // Process next task
    this.processNextTask();
  }

  /**
   * Manually enqueue a task without processing (batch mode).
   */
  enqueueTask(task: WorkerTask): void {
    if (this.taskQueue.length >= this.maxQueueSize) {
      throw new Error(`Task queue is full`);
    }
    this.taskQueue.push(task);
  }

  /**
   * Process all enqueued tasks.
   */
  processQueue(): void {
    while (this.taskQueue.length > 0 && this.workers.length < this.poolSize) {
      this.processNextTask();
    }
  }

  /**
   * Get worker pool statistics.
   */
  getStats() {
    return {
      ...this.stats,
      workersActive: this.workers.length,
      tasksQueued: this.taskQueue.length,
      tasksPending: this.pendingTasks.size,
      poolSize: this.poolSize
    };
  }

  /**
   * Shutdown all workers gracefully.
   */
  async shutdown(): Promise<void> {
    if (this.debug) console.log(`[WorkerPool] Shutting down...`);
    for (const worker of this.workers) {
      await worker.terminate();
    }
    this.workers = [];
    if (this.debug) console.log(`[WorkerPool] Shutdown complete`);
  }
}

export default HeavyIndicatorWorkerPool;
