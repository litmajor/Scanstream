import { Signal } from '../pages/trading-terminal';

export type AttentionItem = {
  id: string;
  label: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  symbol?: string;
  score?: number;
  meta?: any;
};

type Inputs = {
  signals?: Signal[];
  notifications?: any[];
  mdlRetryInfo?: { attempt?: number; delay?: number } | null;
};

// Simple heuristic scorer: combines recency, confidence, and notification severity.
export function getTopItems({ signals = [], notifications = [], mdlRetryInfo = null }: Inputs, limit = 3): AttentionItem[] {
  const items: AttentionItem[] = [];

  // Normalize notifications into AttentionItems with explicit severity
  (notifications || []).forEach((n: any, idx: number) => {
    const level = (n?.severity || n?.level || n?.priority || 'info').toString().toLowerCase();
    let severity: AttentionItem['severity'] = 'low';
    if (level === 'critical' || level === 'urgent' || level === 'fatal') severity = 'critical';
    else if (level === 'high' || level === 'error' || level === 'warning') severity = 'high';
    else if (level === 'medium' || level === 'notice') severity = 'medium';
    items.push({ id: `notif_${idx}`, label: n.title || n.message || 'Notification', severity, meta: n });
  });

  // Score signals in a backend-independent way.
  // Factors: confidence (0..1), strength (0..1), riskReward (higher -> higher priority), recency decay.
  const now = Date.now();
  (signals || []).slice(0, 500).forEach((s: Signal, i: number) => {
    const confidence = Math.max(0, Math.min(1, typeof s.confidence === 'number' ? s.confidence : (s.signalStrengthScore ?? 0.5)));
    const strength = Math.max(0, Math.min(1, typeof s.strength === 'number' ? s.strength : (s.signalStrengthScore ?? 0.5)));
    const rr = typeof s.riskReward === 'number' ? Math.min(3, Math.max(0, s.riskReward)) : 1; // clamp
    const ageMs = Math.max(0, now - (s.timestamp || now));
    const ageDecay = Math.exp(-ageMs / (1000 * 60 * 10)); // 10 minute half-life-ish decay

    // type weight: BUY/SELL are treated equally here; can be tuned per user preference
    const typeWeight = s.type === 'BUY' || s.type === 'SELL' ? 1.0 : 0.6;

    // final score 0..1 (approx)
    const raw = (0.5 * confidence + 0.3 * strength * (rr / 2) * 0.5 + 0.2 * ageDecay) * typeWeight;
    const score = Math.max(0, Math.min(1, raw));

    // severity mapping based on score and riskReward
    let severity: AttentionItem['severity'] = score > 0.85 || rr > 2 ? 'high' : (score > 0.6 ? 'medium' : 'low');
    if (s.reasoning && s.reasoning.includes('system') && score > 0.75) severity = 'high';

    const labelScore = Math.round(score * 100);
    const label = `${s.type} ${s.symbol} ${labelScore}%`;

    items.push({ id: `sig_${s.id}_${i}`, label, severity, symbol: s.symbol, score, meta: s });
  });

  // Surface MDL retry info prominently when it exists
  if (mdlRetryInfo && mdlRetryInfo.attempt && mdlRetryInfo.attempt > 0) {
    const severity: AttentionItem['severity'] = mdlRetryInfo.attempt > 3 ? 'critical' : 'high';
    items.push({ id: `mdl_retry`, label: `Feed unstable (retry #${mdlRetryInfo.attempt})`, severity, meta: mdlRetryInfo });
  }

  // Sort items first by severity, then by score (if present), then by recent notifications order
  const severityRank: Record<string, number> = { critical: 1000, high: 750, medium: 500, low: 250 };
  items.sort((a, b) => {
    const sa = severityRank[a.severity] || 0;
    const sb = severityRank[b.severity] || 0;
    if (sa !== sb) return sb - sa;
    const da = (a.score ?? 0);
    const db = (b.score ?? 0);
    if (db !== da) return db - da;
    // fallback: preserve insertion order for deterministic results
    return 0;
  });

  return items.slice(0, limit);
}

export default { getTopItems };
