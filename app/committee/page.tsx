import { Metadata } from 'next';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageViewTracker } from '@/components/PageViewTracker';
import { CommitteePageClient } from '@/components/CommitteePageClient';

export const metadata: Metadata = {
  title: 'Constitutional Committee — DRepScore',
  description:
    'Explore the Constitutional Committee members and their governance voting records on Cardano.',
};

export const dynamic = 'force-dynamic';

interface MemberAgg {
  ccHotId: string;
  voteCount: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  approvalRate: number;
}

export default async function CommitteePage() {
  const supabase = createClient();

  const { data: votes } = await supabase
    .from('cc_votes')
    .select('cc_hot_id, proposal_tx_hash, proposal_index, vote, block_time, epoch');

  const safeVotes = votes ?? [];

  const memberMap = new Map<string, { yes: number; no: number; abstain: number }>();
  for (const v of safeVotes) {
    const existing = memberMap.get(v.cc_hot_id) || { yes: 0, no: 0, abstain: 0 };
    if (v.vote === 'Yes') existing.yes++;
    else if (v.vote === 'No') existing.no++;
    else existing.abstain++;
    memberMap.set(v.cc_hot_id, existing);
  }

  const members: MemberAgg[] = Array.from(memberMap.entries())
    .map(([ccHotId, counts]) => {
      const total = counts.yes + counts.no + counts.abstain;
      return {
        ccHotId,
        voteCount: total,
        yesCount: counts.yes,
        noCount: counts.no,
        abstainCount: counts.abstain,
        approvalRate: total > 0 ? Math.round((counts.yes / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.voteCount - a.voteCount);

  const totalMembers = members.length;
  const totalVotes = safeVotes.length;

  const proposalVoteCounts = new Map<string, number>();
  for (const v of safeVotes) {
    const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
    proposalVoteCounts.set(key, (proposalVoteCounts.get(key) || 0) + 1);
  }
  const unanimousCount = [...proposalVoteCounts.values()].filter(
    (c) => c === totalMembers && totalMembers > 0,
  ).length;
  const unanimousRate =
    proposalVoteCounts.size > 0
      ? Math.round((unanimousCount / proposalVoteCounts.size) * 100)
      : 0;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageViewTracker event="committee_page_viewed" />

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Constitutional Committee</h1>
        <p className="text-sm text-muted-foreground">
          The Constitutional Committee ensures governance proposals align with the Cardano Constitution.
        </p>
      </div>

      {totalVotes === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-sm">
              No Constitutional Committee votes have been recorded yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Active Members</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totalMembers}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total Votes Cast</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totalVotes}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Unanimous Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{unanimousRate}%</p>
                <p className="text-xs text-muted-foreground">
                  {unanimousCount} of {proposalVoteCounts.size} proposals
                </p>
              </CardContent>
            </Card>
          </div>

          <CommitteePageClient members={members} votes={safeVotes} />
        </>
      )}
    </div>
  );
}
