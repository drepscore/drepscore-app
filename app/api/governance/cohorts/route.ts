import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function authenticateRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const session = await validateSessionToken(token);
  return session?.walletAddress ?? null;
}

interface CohortResult {
  userCohort: string;
  cohortStats: {
    memberCount: number;
    label: string;
    description: string;
  };
}

const COHORT_DEFS: Record<string, { label: string; description: string }> = {
  'Treasury Skeptic': {
    label: 'Treasury Skeptic',
    description: 'tend to vote against treasury withdrawals, prioritizing fiscal conservatism',
  },
  'Treasury Advocate': {
    label: 'Treasury Advocate',
    description: 'tend to support treasury withdrawals, prioritizing ecosystem funding',
  },
  'Balanced Voter': {
    label: 'Balanced Voter',
    description: 'vote across both sides of treasury proposals, weighing each on its merits',
  },
};

function classifyVoter(treasuryYes: number, treasuryNo: number): string {
  const total = treasuryYes + treasuryNo;
  if (total === 0) return 'Balanced Voter';
  if (treasuryNo / total > 0.5) return 'Treasury Skeptic';
  if (treasuryYes / total > 0.5) return 'Treasury Advocate';
  return 'Balanced Voter';
}

export async function GET(request: NextRequest) {
  const walletAddress = await authenticateRequest(request);
  if (!walletAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const { count: totalVoters } = await supabase
      .from('poll_responses')
      .select('wallet_address', { count: 'exact', head: true })
      .limit(1);

    const distinctCount = totalVoters ?? 0;
    if (distinctCount < 50) {
      return NextResponse.json({ cohort: null });
    }

    const treasuryTypes = ['TreasuryWithdrawals', 'Treasury'];

    // Fetch user's poll votes joined with proposal type
    const { data: userVotes } = await supabase
      .from('poll_responses')
      .select('vote, proposal_tx_hash, proposal_index')
      .eq('wallet_address', walletAddress);

    if (!userVotes || userVotes.length === 0) {
      return NextResponse.json({ cohort: null });
    }

    const txHashes = [...new Set(userVotes.map((v) => v.proposal_tx_hash))];
    const { data: proposals } = await supabase
      .from('proposals')
      .select('tx_hash, proposal_index, proposal_type')
      .in('tx_hash', txHashes);

    const proposalTypeMap = new Map<string, string>();
    for (const p of proposals || []) {
      proposalTypeMap.set(`${p.tx_hash}-${p.proposal_index}`, p.proposal_type || '');
    }

    let treasuryYes = 0;
    let treasuryNo = 0;
    for (const v of userVotes) {
      const pType = proposalTypeMap.get(`${v.proposal_tx_hash}-${v.proposal_index}`) || '';
      if (!treasuryTypes.some((t) => pType.includes(t))) continue;
      const normalized = v.vote?.charAt(0).toUpperCase() + v.vote?.slice(1).toLowerCase();
      if (normalized === 'Yes') treasuryYes++;
      if (normalized === 'No') treasuryNo++;
    }

    const userCohort = classifyVoter(treasuryYes, treasuryNo);

    // Count cohort members by classifying all voters
    const { data: allVotes } = await supabase
      .from('poll_responses')
      .select('wallet_address, vote, proposal_tx_hash, proposal_index');

    const voterTreasury = new Map<string, { yes: number; no: number }>();
    for (const v of allVotes || []) {
      const pType = proposalTypeMap.get(`${v.proposal_tx_hash}-${v.proposal_index}`) || '';
      if (!treasuryTypes.some((t) => pType.includes(t))) continue;
      const normalized = v.vote?.charAt(0).toUpperCase() + v.vote?.slice(1).toLowerCase();
      if (normalized !== 'Yes' && normalized !== 'No') continue;
      const existing = voterTreasury.get(v.wallet_address) || { yes: 0, no: 0 };
      if (normalized === 'Yes') existing.yes++;
      else existing.no++;
      voterTreasury.set(v.wallet_address, existing);
    }

    let memberCount = 0;
    for (const [, counts] of voterTreasury) {
      if (classifyVoter(counts.yes, counts.no) === userCohort) memberCount++;
    }
    memberCount = Math.max(memberCount, 1);

    const def = COHORT_DEFS[userCohort] || COHORT_DEFS['Balanced Voter'];

    const result: CohortResult = {
      userCohort,
      cohortStats: {
        memberCount,
        label: def.label,
        description: def.description,
      },
    };

    return NextResponse.json({ cohort: result });
  } catch (error) {
    console.error('[Cohorts API] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
