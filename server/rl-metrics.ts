// Lightweight Prometheus metrics wrapper for RL monitoring
// Uses `prom-client` if available, otherwise no-op functions are exported.
import * as os from 'os';

let enabled = false;
let Registry: any = null;
let Counter: any = null;
let Gauge: any = null;

let decisionCounter: any = null;
let fallbackCounter: any = null;
export let rlMetricsRegister: any = null;

interface CounterMetric {
  inc(labels?: Record<string, string>, value?: number): void;
}

interface ObservationMetric {
  observe(value: number): void;
}

interface GaugeMetric {
  set(labels: Record<string, string>, value: number): void;
}

let episodeCounter: CounterMetric | null = null;
let episodeRewardHistogram: ObservationMetric | null = null;
let episodeLengthSummary: ObservationMetric | null = null;
let domainRewardGauge: GaugeMetric | null = null;

try {
  // Lazy-load prom-client if installed
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const prom = require('prom-client');
  Registry = prom.Registry;
  Counter = prom.Counter;
  Gauge = prom.Gauge;

  const register = new Registry();
  register.setDefaultLabels({ service: 'scanstream', host: os.hostname() });

  decisionCounter = new Counter({
    name: 'rl_decision_total',
    help: 'Number of RL decisions made by domain',
    labelNames: ['domain', 'controlled']
  });

  fallbackCounter = new Counter({
    name: 'rl_fallback_total',
    help: 'Number of times RL fell back to defaults',
    labelNames: ['domain']
  });

  // Episode-level metrics
  episodeCounter = new Counter({
    name: 'rl_episodes_total',
    help: 'Number of RL episodes (closed trades) processed',
    labelNames: ['outcome']
  });

  episodeRewardHistogram = new prom.Histogram({
    name: 'rl_episode_reward',
    help: 'Distribution of episode (trade) rewards',
    buckets: [-10, -5, -2, -1, -0.5, 0, 0.5, 1, 2, 5, 10]
  });

  episodeLengthSummary = new prom.Summary({
    name: 'rl_episode_length',
    help: 'Distribution of episode lengths in bars',
    percentiles: [0.5, 0.9, 0.99]
  });

  domainRewardGauge = new prom.Gauge({
    name: 'rl_domain_reward',
    help: 'Most recent reward observed per RL domain',
    labelNames: ['domain']
  });

  // Register metrics
  register.registerMetric(decisionCounter);
  register.registerMetric(fallbackCounter);
  register.registerMetric(episodeCounter);
  register.registerMetric(episodeRewardHistogram);
  register.registerMetric(episodeLengthSummary);
  register.registerMetric(domainRewardGauge);


  // Expose the register for ESM consumers
  rlMetricsRegister = register;

  enabled = true;
} catch (err) {
  // prom-client not installed — metrics will be no-ops
  enabled = false;
}

export function initMetrics(): void {
  // noop — construction happens at import-time
}

export function incrementDecision(domain: string, isControlled: boolean): void {
  if (!enabled || !decisionCounter) return;
  decisionCounter.inc({ domain: domain.toUpperCase(), controlled: isControlled ? 'true' : 'false' }, 1);
}

export function incrementFallback(domain: string): void {
  if (!enabled || !fallbackCounter) return;
  fallbackCounter.inc({ domain: domain.toUpperCase() }, 1);
}

export function metricsEnabled(): boolean {
  return enabled;
}

// New helpers for episode-level instrumentation
export function recordEpisode(outcome: 'win' | 'loss' | 'neutral', reward: number, lengthBars: number): void {
  if (!enabled || !rlMetricsRegister) return;
  try {
    episodeCounter?.inc({ outcome }, 1);
    episodeRewardHistogram?.observe(reward);
    episodeLengthSummary?.observe(lengthBars);
  } catch (e) {
    // swallow metric errors
  }
}

export function recordDomainReward(domain: string, reward: number): void {
  if (!enabled || !rlMetricsRegister) return;
  try {
    domainRewardGauge?.set({ domain }, reward);
  } catch (e) {
    // swallow metric errors
  }
}

export default { initMetrics, incrementDecision, incrementFallback, metricsEnabled };
