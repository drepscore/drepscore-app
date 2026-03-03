/**
 * Governance Identity pillar (15% of DRep Score).
 * Two sub-components: Profile Quality (60%) and Community Presence (40%).
 * Replaces the old binary profile completeness check.
 */

import { isValidatedSocialLink } from '@/utils/display';
import type { DRepProfileData } from './types';

const SUB_WEIGHTS = { profileQuality: 0.6, communityPresence: 0.4 };

/**
 * Compute raw Governance Identity scores (0-100) for all DReps.
 *
 * @param profiles Per-DRep profile data (metadata, delegator count, hash verified)
 * @param allDelegatorCounts All DReps' delegator counts (for percentile ranking)
 */
export function computeGovernanceIdentity(
  profiles: Map<string, DRepProfileData>,
  allDelegatorCounts: number[],
): Map<string, number> {
  const scores = new Map<string, number>();

  // Pre-sort delegator counts for percentile computation
  const sortedCounts = [...allDelegatorCounts].sort((a, b) => a - b);

  for (const [drepId, profile] of profiles) {
    const profileScore = computeProfileQuality(profile);
    const communityScore = computeCommunityPresence(
      profile.delegatorCount,
      sortedCounts,
    );

    const raw =
      profileScore * SUB_WEIGHTS.profileQuality +
      communityScore * SUB_WEIGHTS.communityPresence;

    scores.set(drepId, clamp(Math.round(raw)));
  }

  return scores;
}

/**
 * Profile Quality (60% of pillar).
 * Quality-tiered field scoring instead of binary has/hasn't.
 * Max raw: name(15) + objectives(20) + motivations(15) + qualifications(10)
 *        + bio(10) + social(30) + hashVerified(5) = 105, clamped to 100.
 */
function computeProfileQuality(profile: DRepProfileData): number {
  const meta = profile.metadata;
  if (!meta) return 0;

  let score = 0;

  // Name: binary (it's a name, quality tiers don't apply)
  if (extractString(meta.givenName) || extractString(meta.name)) score += 15;

  // Objectives: quality-tiered by length
  score += tierScore(extractString(meta.objectives), [
    { minLen: 200, pts: 20 },
    { minLen: 50, pts: 15 },
    { minLen: 1, pts: 5 },
  ]);

  // Motivations
  score += tierScore(extractString(meta.motivations), [
    { minLen: 200, pts: 15 },
    { minLen: 50, pts: 10 },
    { minLen: 1, pts: 3 },
  ]);

  // Qualifications
  score += tierScore(extractString(meta.qualifications), [
    { minLen: 100, pts: 10 },
    { minLen: 30, pts: 7 },
    { minLen: 1, pts: 3 },
  ]);

  // Bio
  score += tierScore(extractString(meta.bio), [
    { minLen: 100, pts: 10 },
    { minLen: 30, pts: 7 },
    { minLen: 1, pts: 3 },
  ]);

  // Social links: keep existing validation logic
  const references = meta.references;
  if (Array.isArray(references)) {
    let validCount = 0;
    const seenUris = new Set<string>();
    for (const ref of references) {
      if (ref && typeof ref === 'object' && 'uri' in ref) {
        const { uri, label } = ref as { uri: string; label?: string };
        if (!uri || seenUris.has(uri)) continue;
        seenUris.add(uri);
        if (isValidatedSocialLink(uri, label)) {
          if (profile.brokenUris?.has(uri)) continue;
          validCount++;
        }
      }
    }
    if (validCount >= 2) score += 30;
    else if (validCount >= 1) score += 25;
  }

  // Hash verification bonus
  if (profile.metadataHashVerified) score += 5;

  return Math.min(100, score);
}

/**
 * Community Presence (40% of pillar).
 * Delegator count percentile: where does this DRep rank by number of delegators?
 * Count-based (not ADA-based) to measure trust breadth.
 */
function computeCommunityPresence(
  delegatorCount: number,
  sortedCounts: number[],
): number {
  if (sortedCounts.length === 0) return 0;
  if (sortedCounts.length === 1) return 50;

  // Find position in sorted array (average rank for ties)
  let lo = 0;
  let hi = sortedCounts.length - 1;

  // Binary search for first occurrence
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedCounts[mid] < delegatorCount) lo = mid + 1;
    else hi = mid;
  }

  // Find range of ties
  let first = lo;
  let last = lo;
  while (first > 0 && sortedCounts[first - 1] === delegatorCount) first--;
  while (last < sortedCounts.length - 1 && sortedCounts[last + 1] === delegatorCount) last++;

  const avgRank = (first + last) / 2;
  return Math.round((avgRank / (sortedCounts.length - 1)) * 100);
}

// --- Helpers ---

interface Tier {
  minLen: number;
  pts: number;
}

function tierScore(text: string | null, tiers: Tier[]): number {
  if (!text) return 0;
  // Tiers are sorted highest-first
  for (const tier of tiers) {
    if (text.length >= tier.minLen) return tier.pts;
  }
  return 0;
}

function extractString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (value && typeof value === 'object' && '@value' in (value as object)) {
    const inner = (value as Record<string, unknown>)['@value'];
    if (typeof inner === 'string') return inner.trim() || null;
  }
  return null;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
