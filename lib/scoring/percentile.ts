/**
 * Generic percentile normalization for scoring pillars.
 * Converts raw scores to percentile ranks (0-100) across all DReps.
 */

/**
 * Percentile-normalize a set of raw scores across all entries.
 * Tied scores get the average rank. Single entry gets 50.
 * Returns a new Map with the same keys and percentile values (0-100).
 */
export function percentileNormalize(rawScores: Map<string, number>): Map<string, number> {
  const entries = [...rawScores.entries()];
  const n = entries.length;

  if (n === 0) return new Map();
  if (n === 1) return new Map([[entries[0][0], 50]]);

  const sorted = entries
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => a.value - b.value);

  const percentiles = new Map<string, number>();
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j].value === sorted[i].value) j++;

    const avgRank = (i + j - 1) / 2;
    const percentile = Math.round((avgRank / (n - 1)) * 100);

    for (let k = i; k < j; k++) {
      percentiles.set(sorted[k].id, percentile);
    }
    i = j;
  }

  return percentiles;
}
