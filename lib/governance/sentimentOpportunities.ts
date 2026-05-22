import { applyStatusFilter } from '@/lib/governance/proposalList';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { GovernanceProposalSignal } from '@/types/cinematic';

interface SentimentOpportunityRow {
  tx_hash: string | null;
  proposal_index: number | null;
  title: string | null;
  proposal_type: string | null;
  expiration_epoch: number | null;
  block_time: number | null;
}

function opportunityId(row: Pick<SentimentOpportunityRow, 'tx_hash' | 'proposal_index'>): string {
  return `proposal:${row.tx_hash}:${row.proposal_index}`;
}

export function proposalToSentimentOpportunity(
  row: SentimentOpportunityRow,
): GovernanceProposalSignal | null {
  if (!row.tx_hash || typeof row.proposal_index !== 'number') return null;

  return {
    id: opportunityId(row),
    title: row.title,
    proposalType: row.proposal_type,
    txHash: row.tx_hash,
    proposalIndex: row.proposal_index,
    expirationEpoch: row.expiration_epoch,
  };
}

export async function getCitizenSentimentOpportunities(
  _now = new Date(),
): Promise<GovernanceProposalSignal[]> {
  let query = getSupabaseAdmin()
    .from('proposals')
    .select('tx_hash, proposal_index, title, proposal_type, expiration_epoch, block_time');

  query = applyStatusFilter(query, 'active');

  const { data, error } = await query
    .order('expiration_epoch', { ascending: true, nullsFirst: false })
    .order('block_time', { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to read citizen sentiment opportunities: ${error.message}`);
  }

  return ((data ?? []) as SentimentOpportunityRow[])
    .map(proposalToSentimentOpportunity)
    .filter((signal): signal is GovernanceProposalSignal => signal !== null);
}
