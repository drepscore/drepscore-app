/**
 * Classification-Based Proposal Similarity
 * Uses cosine similarity on 6D classification vectors from proposal_classifications.
 */

import { getSupabaseAdmin, createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface SimilarProposalResult {
  txHash: string;
  index: number;
  title: string;
  proposalType: string;
  similarityScore: number;
}

interface ClassificationVector {
  txHash: string;
  index: number;
  vector: number[];
}

const DIMENSIONS = [
  'dim_treasury_conservative',
  'dim_treasury_growth',
  'dim_decentralization',
  'dim_security',
  'dim_innovation',
  'dim_transparency',
] as const;

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

function isNonZeroVector(v: number[]): boolean {
  return v.some((x) => x !== 0);
}

/**
 * Compute similarity between two proposals using their classification vectors.
 */
export function computeProposalSimilarity(vecA: number[], vecB: number[]): number {
  if (!isNonZeroVector(vecA) || !isNonZeroVector(vecB)) return 0;
  return cosineSimilarity(vecA, vecB);
}

/**
 * Find top-N similar proposals to a given proposal by classification vector.
 */
export async function findSimilarByClassification(
  txHash: string,
  index: number,
  limit = 5,
): Promise<SimilarProposalResult[]> {
  const supabase = createClient();

  const { data: source } = await supabase
    .from('proposal_classifications')
    .select('*')
    .eq('proposal_tx_hash', txHash)
    .eq('proposal_index', index)
    .single();

  if (!source) return [];

  const sourceRow = source as unknown as Record<string, number | string>;
  const sourceVec = DIMENSIONS.map((d) => Number(sourceRow[d]) || 0);
  if (!isNonZeroVector(sourceVec)) return [];

  const { data: allClassifications } = await supabase.from('proposal_classifications').select('*');

  if (!allClassifications) return [];

  const allRows = (allClassifications || []) as unknown as Array<Record<string, number | string>>;
  const scored = allRows
    .filter((c) => !(c.proposal_tx_hash === txHash && c.proposal_index === index))
    .map((c) => {
      const vec = DIMENSIONS.map((d) => Number(c[d]) || 0);
      return {
        txHash: c.proposal_tx_hash as string,
        index: c.proposal_index as number,
        score: computeProposalSimilarity(sourceVec, vec),
      };
    })
    .filter((s) => s.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (scored.length === 0) return [];

  const { data: proposals } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, title, proposal_type')
    .in(
      'tx_hash',
      scored.map((s) => s.txHash),
    );

  const proposalMap = new Map(
    (proposals || []).map((p) => [`${p.tx_hash}-${p.proposal_index}`, p]),
  );

  return scored.map((s) => {
    const p = proposalMap.get(`${s.txHash}-${s.index}`);
    return {
      txHash: s.txHash,
      index: s.index,
      title: p?.title || 'Untitled',
      proposalType: p?.proposal_type || 'Unknown',
      similarityScore: Math.round(s.score * 100) / 100,
    };
  });
}

/**
 * Precompute top-5 similar proposals for each classified proposal.
 * Stores results in proposal_similarity_cache.
 */
export async function precomputeSimilarityCache(): Promise<number> {
  const supabase = getSupabaseAdmin();

  const { data: rawClassifications } = await supabase.from('proposal_classifications').select('*');

  const allClassifications = (rawClassifications || []) as unknown as Array<
    Record<string, number | string>
  >;
  if (allClassifications.length < 2) return 0;

  const vectors: ClassificationVector[] = allClassifications
    .map((c) => ({
      txHash: c.proposal_tx_hash as string,
      index: c.proposal_index as number,
      vector: DIMENSIONS.map((d) => Number(c[d]) || 0),
    }))
    .filter((v) => isNonZeroVector(v.vector));

  if (vectors.length < 2) return 0;

  const rows: Array<{
    proposal_tx_hash: string;
    proposal_index: number;
    similar_tx_hash: string;
    similar_index: number;
    similarity_score: number;
    computed_at: string;
  }> = [];

  const now = new Date().toISOString();

  for (const source of vectors) {
    const similarities = vectors
      .filter((t) => !(t.txHash === source.txHash && t.index === source.index))
      .map((target) => ({
        target,
        score: computeProposalSimilarity(source.vector, target.vector),
      }))
      .filter((s) => s.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    for (const { target, score } of similarities) {
      rows.push({
        proposal_tx_hash: source.txHash,
        proposal_index: source.index,
        similar_tx_hash: target.txHash,
        similar_index: target.index,
        similarity_score: Math.round(score * 1000) / 1000,
        computed_at: now,
      });
    }
  }

  if (rows.length === 0) return 0;

  const BATCH_SIZE = 200;
  let upserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('proposal_similarity_cache').upsert(batch, {
      onConflict: 'proposal_tx_hash,proposal_index,similar_tx_hash,similar_index',
    });
    if (!error) upserted += batch.length;
    else logger.error('[proposalSimilarity] Batch upsert error', { error: error.message });
  }

  return upserted;
}
