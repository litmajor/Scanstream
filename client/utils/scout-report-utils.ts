/**
 * SCOUT REPORT UTILITY FUNCTIONS
 * 
 * Helper functions for filtering, sorting, and processing Scout Report data
 * All decimal formatting uses global formatToDP() helper from formatting.ts
 */

import type {
  TradeOpportunity,
  ScoutReport,
  MLSourceAnalysis,
  ScannerSourceAnalysis,
  AgentSourceAnalysis,
  PriceActionAnalysis,
  ConsensusData,
  ExecutiveSummary,
  AlternativeView,
  RiskAssessment
} from "../types/scout-report-types";
import {
  formatToDP,
  formatMetric,
  formatPercent,
  formatPrice,
  formatRiskReward,
  formatDuration,
  formatChange,
  formatConfidenceWithColor,
  formatRiskScore
} from "./formatting";

// Helper: parse estimated duration strings to minutes (e.g. "30m", "1.5h", "2h 30m")
function parseEstimatedMinutes(duration: string | undefined): number {
  if (!duration) return 0;
  const s = String(duration).trim().toLowerCase();
  // handle patterns like "2h 30m" or "1.5h" or "45m"
  const hoursMatch = s.match(/(\d+(?:\.\d+)?)h(?:\s*(\d+)?m?)?/);
  if (hoursMatch) {
    const hours = parseFloat(hoursMatch[1]) || 0;
    const mins = hoursMatch[2] ? parseInt(hoursMatch[2], 10) : 0;
    return Math.round(hours * 60 + mins);
  }
  const minsMatch = s.match(/(\d+(?:\.\d+)?)m/);
  if (minsMatch) return Math.round(parseFloat(minsMatch[1]));
  const asNum = parseFloat(s);
  return Number.isFinite(asNum) ? Math.round(asNum) : 0;
}
// ============================================================================
// FILTERING FUNCTIONS
// ============================================================================

/**
 * Filter opportunities by type
 * @param opportunities - Array of opportunities
 * @param type - SCALP, DAY, SWING, POSITION, or ALL
 */
export function filterOpportunitiesByType(
  opportunities: TradeOpportunity[],
  type: string
): TradeOpportunity[] {
  if (type === "ALL" || !type) {
    return opportunities;
  }
  return opportunities.filter((opp) => opp.type === type.toUpperCase());
}

/**
 * Filter opportunities by minimum confidence
 * @param opportunities - Array of opportunities
 * @param minConfidence - Minimum confidence threshold (0-1)
 */
export function filterOpportunitiesByConfidence(
  opportunities: TradeOpportunity[],
  minConfidence: number
): TradeOpportunity[] {
  if (!minConfidence || minConfidence < 0) {
    return opportunities;
  }
  return opportunities.filter((opp) => opp.confidence >= minConfidence);
}

/**
 * Filter opportunities by minimum risk/reward ratio
 * @param opportunities - Array of opportunities
 * @param minRiskReward - Minimum R:R ratio (e.g., 2 for 1:2)
 */
export function filterOpportunitiesByRiskReward(
  opportunities: TradeOpportunity[],
  minRiskReward: number
): TradeOpportunity[] {
  if (!minRiskReward || minRiskReward <= 0) {
    return opportunities;
  }
  return opportunities.filter((opp) => {
    const ratio = (opp.riskRewardRatio || 0) / 1;
    return ratio >= minRiskReward;
  });
}

/**
 * Filter opportunities by minimum probability
 * @param opportunities - Array of opportunities
 * @param minProbability - Minimum probability (0-1)
 */
export function filterOpportunitiesByProbability(
  opportunities: TradeOpportunity[],
  minProbability: number
): TradeOpportunity[] {
  if (!minProbability || minProbability < 0) {
    return opportunities;
  }
  return opportunities.filter((opp) => opp.probability >= minProbability);
}

/**
 * Filter opportunities by minimum quality score
 * @param opportunities - Array of opportunities
 * @param minQuality - Minimum quality (0-100)
 */
export function filterOpportunitiesByQuality(
  opportunities: TradeOpportunity[],
  minQuality: number
): TradeOpportunity[] {
  if (!minQuality || minQuality < 0) {
    return opportunities;
  }
  return opportunities.filter((opp) => {
    const quality = calculateOpportunityQuality(opp);
    return quality >= minQuality;
  });
}

/**
 * Combined filter function - apply multiple filters at once
 */
export function filterOpportunities(
  opportunities: TradeOpportunity[],
  filters: {
    type?: string;
    minConfidence?: number;
    minRiskReward?: number;
    minProbability?: number;
    minQuality?: number;
  }
): TradeOpportunity[] {
  let result = opportunities;

  if (filters.type) {
    result = filterOpportunitiesByType(result, filters.type);
  }
  if (filters.minConfidence) {
    result = filterOpportunitiesByConfidence(result, filters.minConfidence);
  }
  if (filters.minRiskReward) {
    result = filterOpportunitiesByRiskReward(result, filters.minRiskReward);
  }
  if (filters.minProbability) {
    result = filterOpportunitiesByProbability(result, filters.minProbability);
  }
  if (filters.minQuality) {
    result = filterOpportunitiesByQuality(result, filters.minQuality);
  }

  return result;
}

// ============================================================================
// SORTING FUNCTIONS
// ============================================================================

/**
 * Sort opportunities by risk/reward ratio (descending)
 */
export function sortByRiskReward(opportunities: TradeOpportunity[]): TradeOpportunity[] {
  return [...opportunities].sort((a, b) => (b.riskRewardRatio || 0) - (a.riskRewardRatio || 0));
}

/**
 * Sort opportunities by confidence (descending)
 */
export function sortByConfidence(opportunities: TradeOpportunity[]): TradeOpportunity[] {
  return [...opportunities].sort((a, b) => b.confidence - a.confidence);
}

/**
 * Sort opportunities by probability (descending)
 */
export function sortByProbability(opportunities: TradeOpportunity[]): TradeOpportunity[] {
  return [...opportunities].sort((a, b) => b.probability - a.probability);
}

/**
 * Sort opportunities by quality score (descending)
 */
export function sortByQuality(opportunities: TradeOpportunity[]): TradeOpportunity[] {
  const withQuality = opportunities.map((opp) => ({
    opp,
    quality: calculateOpportunityQuality(opp)
  }));
  return withQuality.sort((a, b) => b.quality - a.quality).map((item) => item.opp);
}

/**
 * Sort opportunities by expected value (descending)
 */
export function sortByExpectedValue(opportunities: TradeOpportunity[]): TradeOpportunity[] {
  const withEV = opportunities.map((opp) => ({
    opp,
    ev: calculateExpectedValue(opp)
  }));
  return withEV.sort((a, b) => b.ev - a.ev).map((item) => item.opp);
}

/**
 * Sort opportunities by duration (ascending - faster first)
 */
export function sortByDuration(opportunities: TradeOpportunity[]): TradeOpportunity[] {
  return [...opportunities].sort((a, b) => parseEstimatedMinutes(a.estimatedDuration) - parseEstimatedMinutes(b.estimatedDuration));
}

/**
 * Combined sort function - apply single sort metric
 */
export function sortOpportunities(
  opportunities: TradeOpportunity[],
  sortBy: "riskReward" | "confidence" | "probability" | "quality" | "ev" | "duration"
): TradeOpportunity[] {
  switch (sortBy) {
    case "riskReward":
      return sortByRiskReward(opportunities);
    case "confidence":
      return sortByConfidence(opportunities);
    case "probability":
      return sortByProbability(opportunities);
    case "quality":
      return sortByQuality(opportunities);
    case "ev":
      return sortByExpectedValue(opportunities);
    case "duration":
      return sortByDuration(opportunities);
    default:
      return sortByRiskReward(opportunities);
  }
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate expected value for an opportunity
 * EV = (Win% * Avg Win) - (Loss% * Avg Loss)
 * Or: EV = (Probability * Reward) - ((1 - Probability) * Risk)
 */
export function calculateExpectedValue(opportunity: TradeOpportunity): number {
  if (!opportunity.probability || !opportunity.riskRewardRatio) {
    return 0;
  }

  const winProb = opportunity.probability;
  const lossProb = 1 - winProb;

  // Normalize by risk unit
  const expectedWin = winProb * (opportunity.riskRewardRatio || 0);
  const expectedLoss = lossProb * 1; // 1 unit of risk

  return expectedWin - expectedLoss;
}

/**
 * Calculate opportunity quality score (0-100)
 * Composite of: confidence (40%), risk/reward (30%), probability (20%), conviction (10%)
 */
export function calculateOpportunityQuality(opportunity: TradeOpportunity): number {
  const confidenceScore = opportunity.confidence * 100 * 0.4; // 40% weight
  const rrScore = Math.min((opportunity.riskRewardRatio || 0) * 25, 100) * 0.3; // 30% weight (normalize to 0-100)
  const probScore = opportunity.probability * 100 * 0.2; // 20% weight
  // TradeOpportunity doesn't include a boolean conviction; use qualityScore as proxy
  const convictionScore = (opportunity.qualityScore && opportunity.qualityScore > 75 ? 25 : 0) * 0.1; // 10% weight

  return Math.round(confidenceScore + rrScore + probScore + convictionScore);
}

/**
 * Calculate agreement percentage from consensus
 * Returns the % of sources that agree with primary direction
 */
export function calculateAgreement(consensus: ConsensusData): number {
  if (!consensus || !consensus.sourceAgreement) return 0;
  const total = consensus.totalSources || consensus.sourceAgreement.length;
  if (total === 0) return 0;
  const agreeCount = consensus.sourceAgreement.filter((s) => !!s.agrees).length;
  return agreeCount / total;
}

/**
 * Calculate average confidence across all sources
 */
export function calculateAverageConfidence(report: ScoutReport): number {
  const confidences: number[] = [];

  if (report.sourcesAnalysis?.ml?.consensus?.confidence) {
    confidences.push(report.sourcesAnalysis.ml.consensus.confidence);
  }
  if (report.sourcesAnalysis?.scanner?.signal?.confidence) {
    confidences.push(report.sourcesAnalysis.scanner.signal.confidence);
  }
  if (report.sourcesAnalysis?.agents?.consensus?.confidence) {
    confidences.push(report.sourcesAnalysis.agents.consensus.confidence);
  }
  if (report.sourcesAnalysis?.priceAction?.momentum?.score) {
    confidences.push(Math.min(1, (report.sourcesAnalysis.priceAction.momentum.score || 0) / 100));
  }

  if (confidences.length === 0) return 0;
  return confidences.reduce((a, b) => a + b, 0) / confidences.length;
}

/**
 * Calculate signal strength (1-10 scale)
 * Based on consensus agreement and confidence
 */
export function calculateSignalStrength(report: ScoutReport): number {
  const agreement = calculateAgreement(report.consensus);
  const confidence = calculateAverageConfidence(report);

  // Combine: (agreement * 0.6 + confidence * 0.4) * 10
  const strength = (agreement * 0.6 + confidence * 0.4) * 10;
  return Math.round(strength * 10) / 10; // Round to 1 decimal
}

/**
 * Calculate urgency level
 * HIGH if confidence > 0.8 and agreement > 0.7
 * MEDIUM if confidence > 0.6 and agreement > 0.5
 * LOW otherwise
 */
export function calculateUrgency(report: ScoutReport): "HIGH" | "MEDIUM" | "LOW" {
  const agreement = calculateAgreement(report.consensus);
  const confidence = calculateAverageConfidence(report);

  if (confidence > 0.8 && agreement > 0.7) return "HIGH";
  if (confidence > 0.6 && agreement > 0.5) return "MEDIUM";
  return "LOW";
}

/**
 * Calculate risk exposure (0-100)
 * Based on risk assessment scores
 */
export function calculateRiskExposure(risk: RiskAssessment): number {
  const score = (risk && (risk.overallRiskScore ?? 50)) as number;
  // 1-10 scale to 0-100
  return Math.round((score / 10) * 100);
}

// ============================================================================
// FORMATTING HELPERS USING GLOBAL FORMATTERS
// ============================================================================

/**
 * Format opportunity for display
 * Returns a display object with all formatted values
 */
export function formatOpportunityForDisplay(opp: TradeOpportunity) {
  return {
    ...opp,
    formattedConfidence: formatMetric(opp.confidence * 100),
    formattedRiskReward: formatRiskReward(1, opp.riskRewardRatio || 0),
    formattedProbability: formatMetric(opp.probability * 100),
    formattedQuality: formatMetric(calculateOpportunityQuality(opp)),
    formattedDuration: formatDuration(parseEstimatedMinutes(opp.estimatedDuration)),
    formattedEntry: formatPrice(opp.entryZone.optimal),
    formattedEV: formatMetric(calculateExpectedValue(opp))
  };
}

/**
 * Format opportunity list with all formatted values
 */
export function formatOpportunitiesForDisplay(opportunities: TradeOpportunity[]) {
  return opportunities.map(formatOpportunityForDisplay);
}

/**
 * Format consensus for display
 */
export function formatConsensusForDisplay(consensus: ConsensusData) {
  return {
    ...consensus,
    formattedAgreement: formatMetric(calculateAgreement(consensus) * 100),
    agreementPercent: Math.round(calculateAgreement(consensus) * 100)
  };
}

// ============================================================================
// ANALYSIS HELPERS
// ============================================================================

/**
 * Find best opportunity in list
 * Uses quality score as metric
 */
export function findBestOpportunity(opportunities: TradeOpportunity[]): TradeOpportunity | null {
  if (opportunities.length === 0) return null;

  return opportunities.reduce((best, current) => {
    const bestQuality = calculateOpportunityQuality(best);
    const currentQuality = calculateOpportunityQuality(current);
    return currentQuality > bestQuality ? current : best;
  });
}

/**
 * Find highest confidence opportunity
 */
export function findHighestConfidenceOpportunity(opportunities: TradeOpportunity[]): TradeOpportunity | null {
  if (opportunities.length === 0) return null;
  return opportunities.reduce((max, curr) => (curr.confidence > max.confidence ? curr : max));
}

/**
 * Find best risk/reward opportunity
 */
export function findBestRiskRewardOpportunity(opportunities: TradeOpportunity[]): TradeOpportunity | null {
  if (opportunities.length === 0) return null;
  return opportunities.reduce((max, curr) => ((curr.riskRewardRatio || 0) > (max.riskRewardRatio || 0) ? curr : max));
}

/**
 * Get opportunities by source reliability
 * High reliability: ALL sources agree
 * Medium reliability: 3+ sources agree
 * Low reliability: 1-2 sources
 */
export function getOpportunitiesByReliability(
  opportunities: TradeOpportunity[],
  reliability: "high" | "medium" | "low"
): TradeOpportunity[] {
  return opportunities.filter((opp) => {
    const sourceCount = (opp.supportingSources || []).length;

    if (reliability === "high") return sourceCount >= 4;
    if (reliability === "medium") return sourceCount >= 2;
    return sourceCount >= 1;
  });
}

/**
 * Get opportunities by trade type
 */
export function getOpportunitiesByType(
  opportunities: TradeOpportunity[],
  type: "SCALP" | "DAY" | "SWING" | "POSITION"
): TradeOpportunity[] {
  return opportunities.filter((opp) => opp.type === type);
}

/**
 * Get top N opportunities
 */
export function getTopOpportunities(opportunities: TradeOpportunity[], limit: number): TradeOpportunity[] {
  return opportunities.slice(0, Math.max(1, limit));
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if opportunity is high quality
 * Quality > 75
 */
export function isHighQualityOpportunity(opp: TradeOpportunity): boolean {
  return calculateOpportunityQuality(opp) > 75;
}

/**
 * Check if opportunity has good risk/reward
 * R:R > 1.5
 */
export function hasGoodRiskReward(opp: TradeOpportunity): boolean {
  return (opp.riskRewardRatio || 0) > 1.5;
}

/**
 * Check if opportunity is high probability
 * Probability > 60%
 */
export function isHighProbability(opp: TradeOpportunity): boolean {
  return opp.probability > 0.6;
}

/**
 * Check if report has strong consensus
 * Agreement > 70% and confidence > 75%
 */
export function hasStrongConsensus(report: ScoutReport): boolean {
  const agreement = calculateAgreement(report.consensus);
  const confidence = calculateAverageConfidence(report);

  return agreement > 0.7 && confidence > 0.75;
}

/**
 * Check if report has significant dissent
 * More than 1 source disagrees with primary direction
 */
export function hasSignificantDissent(report: ScoutReport): boolean {
  const dissents = report.alternatives || [];
  return dissents.length > 1;
}
