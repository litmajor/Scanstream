import { db } from '../db-storage';
import { modelDriftDetector } from './model-drift-detector';
import { auditLogger } from './audit-logger';
import { rlGuard } from '../rl-guard';
import { storage } from '../storage';
import { retrainManager } from './retrain-manager';

type AdaptiveStatus = {
  lastRun: number | null;
  staleModels: string[];
  weakAgents: { agentId: string; score: number }[];
  drawdown: number | null;
  rlFrozen: boolean;
  mode: 'normal' | 'conservative' | 'isolation';
};

type ModelMetricSummary = {
  modelName?: string;
  isStale?: boolean;
  driftScore?: number;
  accuracy?: number;
  dataPoints?: number;
};

class AdaptiveController {
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private status: AdaptiveStatus = { lastRun: null, staleModels: [], weakAgents: [], drawdown: null, rlFrozen: false, mode: 'normal' };

  constructor(intervalMs = 30_000) {
    this.intervalMs = intervalMs;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.run().catch((e) => console.warn('[AdaptiveController] run error', e)), this.intervalMs);
    // run immediately
    this.run().catch((e) => console.warn('[AdaptiveController] startup run error', e));
  }

  stop() {
    if (this.timer) clearInterval(this.timer as any);
    this.timer = null;
  }

  async run() {
    const now = Date.now();
    this.status.lastRun = now;

    // 1) Check model metrics for staleness
    const staleModels: string[] = [];
    let metrics: ModelMetricSummary[] = [];
    try {
      if (typeof (db as any).getLatestModelMetrics === 'function') {
        try { metrics = await (db as any).getLatestModelMetrics(undefined, 20); } catch (_) { metrics = []; }
      }
      for (const m of metrics || []) {
        if (m.isStale) staleModels.push(m.modelName || 'unknown');
      }
    } catch (e) { console.warn('[AdaptiveController] model metrics error', e); }

    // 2) Aggregate recent decisionSnapshots to compute simple agent scores
    const weakAgents: { agentId: string; score: number }[] = [];
    try {
      // naive heuristic: examine last 200 decision snapshots and score agents by contribution->outcome
      let snaps: any[] | null = null;
      if (typeof (db as any).getRecentDecisionSnapshots === 'function') {
        try { snaps = await (db as any).getRecentDecisionSnapshots(200); } catch (_) { snaps = null; }
      }
      if (snaps && snaps.length) {
        const scores = new Map<string, { hits: number; total: number }>();
        for (const s of snaps) {
          const agents = (s.agents || []) as string[];
          const outcome = (s.extra && s.extra.outcome) ? s.extra.outcome : null;
          for (const a of agents) {
            const cur = scores.get(a) || { hits: 0, total: 0 };
            cur.total += 1;
            if (outcome === 'WIN' || outcome === 'POSITIVE') cur.hits += 1;
            scores.set(a, cur);
          }
        }
        for (const [k, v] of scores.entries()) {
          const score = v.total > 0 ? v.hits / v.total : 0;
          if (score < 0.4) weakAgents.push({ agentId: k, score });
        }
      }
    } catch (e) { console.warn('[AdaptiveController] decision snapshot aggregation error', e); }

    // 3) Drawdown check (use portfolio summary heuristics)
    let drawdown: number | null = null;
    try {
      let summary: any = null;
      if (typeof (db as any).getPortfolioSummary === 'function') {
        try { summary = await (db as any).getPortfolioSummary(); } catch (_) { summary = null; }
      }
      if (summary && typeof summary.dayChangePercent === 'number') drawdown = -summary.dayChangePercent; // placeholder
    } catch (e) { console.warn('[AdaptiveController] portfolio summary error', e); }

    // 4) RL frozen status
    const rlFrozen = !!(rlGuard && rlGuard.isFrozen && rlGuard.isFrozen());

    // Update status
    this.status = { lastRun: now, staleModels, weakAgents, drawdown, rlFrozen, mode: this.status.mode };

    // Decide and act: simple policies
    try {
      if (staleModels.length > 0) {
        // record decision event: models stale
        await db.createDecisionEvent?.({ correlationId: null, phase: 'ADAPTIVE', domain: 'Model', actionPayload: { staleModels }, metrics: { count: staleModels.length }, timestamp: new Date() }).catch(() => {});
        // notify audit
        const staleModel = metrics.find(m => m.isStale);
        await auditLogger.logModelDrift('adaptive-controller', {
          driftScore: staleModel?.driftScore ?? 1,
          accuracy: staleModel?.accuracy ?? 0,
          dataPoints: staleModel?.dataPoints ?? 0,
          isStale: true,
        }).catch(() => {});

        // Create a retrain ticket (human-in-the-loop) and optionally start shadow retrain
        try {
          let sampleSnap: any = null;
          if (typeof (db as any).getRecentDecisionSnapshots === 'function') {
            try { const recent = await (db as any).getRecentDecisionSnapshots(1); if (recent && recent.length) sampleSnap = recent[0]; } catch (_) { sampleSnap = null; }
          }
          await retrainManager.createTicket({ traceId: null, reason: 'stale_models', snapshot: sampleSnap ?? undefined, autoShadow: process.env.ADAPTIVE_AUTO_SHADOW_RETRAIN === 'true', createdBy: 'adaptive-controller' });
        } catch (e) { console.warn('[AdaptiveController] failed to create retrain ticket', e); }
      }

      if (weakAgents.length > 0) {
        // reduce weight for weakest agent by 20% (emit event only; integration with agent weights left as manual step)
        const effected = weakAgents.slice(0, 3).map(w => w.agentId);
        await db.createDecisionEvent?.({ correlationId: null, phase: 'ADAPTIVE', domain: 'Agent', actionPayload: { action: 'reduce_weight', agents: effected, factor: 0.8 }, metrics: { weakCount: weakAgents.length }, timestamp: new Date() }).catch(() => {});
      }

      if (drawdown && drawdown > 5) {
        // escalate to conservative mode
        this.status.mode = 'conservative';
        await db.createDecisionEvent?.({ correlationId: null, phase: 'ADAPTIVE', domain: 'Risk', actionPayload: { action: 'set_mode', mode: 'conservative' }, metrics: { drawdown }, timestamp: new Date() }).catch(() => {});
      }

      // RL guard action: if frozen, emit adaptive event
      if (rlFrozen) {
        await db.createDecisionEvent?.({ correlationId: null, phase: 'ADAPTIVE', domain: 'RL', actionPayload: { action: 'freeze_learning' }, metrics: { variance: rlGuard.variance, samples: rlGuard.sampleCount }, timestamp: new Date() }).catch(() => {});
      }
    } catch (e) {
      console.warn('[AdaptiveController] action emission error', e);
    }
  }

  getStatus(): AdaptiveStatus { return this.status; }

  // admin actions
  forceUnfreezeRL() { rlGuard.forceUnfreeze(); this.status.rlFrozen = false; }
  setMode(m: AdaptiveStatus['mode']) { this.status.mode = m; }
}

export const adaptiveController = new AdaptiveController();
export default adaptiveController;
