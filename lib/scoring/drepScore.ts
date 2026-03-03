/**
 * DRep Score V3 — Composite calculator + momentum.
 * Combines 4 percentile-normalized pillars with configurable weights.
 * Momentum is computed from score history via simple linear regression.
 */

import { PILLAR_WEIGHTS, type DRepScoreResult } from './types';
import { percentileNormalize } from './percentile';

/**
 * Compute final DRep Scores for all DReps from raw pillar scores.
 * Percentile-normalizes each pillar, computes weighted composite, and momentum.
 *
 * @param rawEngagement Map<drepId, raw 0-100>
 * @param rawParticipation Map<drepId, raw 0-100>
 * @param rawReliability Map<drepId, raw 0-100>
 * @param rawIdentity Map<drepId, raw 0-100>
 * @param scoreHistory Map<drepId, recent daily scores> (for momentum)
 */
export function computeDRepScores(
  rawEngagement: Map<string, number>,
  rawParticipation: Map<string, number>,
  rawReliability: Map<string, number>,
  rawIdentity: Map<string, number>,
  scoreHistory: Map<string, { date: string; score: number }[]>,
): Map<string, DRepScoreResult> {
  // Percentile-normalize each pillar
  const pctEngagement = percentileNormalize(rawEngagement);
  const pctParticipation = percentileNormalize(rawParticipation);
  const pctReliability = percentileNormalize(rawReliability);
  const pctIdentity = percentileNormalize(rawIdentity);

  const results = new Map<string, DRepScoreResult>();

  // Collect all DRep IDs from any pillar
  const allDrepIds = new Set<string>([
    ...rawEngagement.keys(),
    ...rawParticipation.keys(),
    ...rawReliability.keys(),
    ...rawIdentity.keys(),
  ]);

  for (const drepId of allDrepIds) {
    const eqPct = pctEngagement.get(drepId) ?? 0;
    const epPct = pctParticipation.get(drepId) ?? 0;
    const rlPct = pctReliability.get(drepId) ?? 0;
    const giPct = pctIdentity.get(drepId) ?? 0;

    const composite = Math.round(
      eqPct * PILLAR_WEIGHTS.engagementQuality +
        epPct * PILLAR_WEIGHTS.effectiveParticipation +
        rlPct * PILLAR_WEIGHTS.reliability +
        giPct * PILLAR_WEIGHTS.governanceIdentity,
    );

    const history = scoreHistory.get(drepId);
    const momentum = history ? computeMomentum(history) : null;

    results.set(drepId, {
      composite: clamp(composite),
      engagementQualityRaw: rawEngagement.get(drepId) ?? 0,
      engagementQualityPercentile: eqPct,
      effectiveParticipationRaw: rawParticipation.get(drepId) ?? 0,
      effectiveParticipationPercentile: epPct,
      reliabilityRaw: rawReliability.get(drepId) ?? 0,
      reliabilityPercentile: rlPct,
      governanceIdentityRaw: rawIdentity.get(drepId) ?? 0,
      governanceIdentityPercentile: giPct,
      momentum,
    });
  }

  return results;
}

/**
 * Simple linear regression slope from recent score history.
 * Returns points-per-day trend. Positive = improving, negative = declining.
 * Requires at least 2 data points within the last 14 days.
 */
function computeMomentum(
  history: { date: string; score: number }[],
): number | null {
  if (history.length < 2) return null;

  // Use last 14 days of history
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const recent = history.filter((h) => h.date >= cutoffStr);
  if (recent.length < 2) return null;

  // Convert dates to day offsets for regression
  const baseDate = new Date(recent[0].date).getTime();
  const points = recent.map((h) => ({
    x: (new Date(h.date).getTime() - baseDate) / 86400000, // days from base
    y: h.score,
  }));

  const n = points.length;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  return Math.round(slope * 100) / 100; // 2 decimal places
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
