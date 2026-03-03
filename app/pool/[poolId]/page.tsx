import { Metadata } from 'next';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageViewTracker } from '@/components/PageViewTracker';
import { PoolProfileClient } from '@/components/PoolProfileClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ poolId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { poolId } = await params;
  const short = poolId.slice(0, 12);
  return {
    title: `SPO ${short}… Governance Profile — DRepScore`,
    description: `Governance participation and voting record for stake pool ${short}… on Cardano.`,
  };
}

export default async function PoolProfilePage({ params }: PageProps) {
  const { poolId } = await params;
  const supabase = createClient();

  const { data: votes } = await supabase
    .from('spo_votes')
    .select('pool_id, proposal_tx_hash, proposal_index, vote, block_time, epoch')
    .eq('pool_id', poolId)
    .order('block_time', { ascending: false });

  const safeVotes = votes ?? [];

  let proposals: { tx_hash: string; proposal_index: number; title: string; proposal_type: string }[] = [];
  if (safeVotes.length > 0) {
    const txHashes = [...new Set(safeVotes.map((v) => v.proposal_tx_hash))];
    const { data } = await supabase
      .from('proposals')
      .select('tx_hash, proposal_index, title, proposal_type')
      .in('tx_hash', txHashes);
    proposals = data ?? [];
  }

  const yesCount = safeVotes.filter((v) => v.vote === 'Yes').length;
  const noCount = safeVotes.filter((v) => v.vote === 'No').length;
  const abstainCount = safeVotes.filter((v) => v.vote === 'Abstain').length;
  const totalVotes = safeVotes.length;

  const { count: totalProposals } = await supabase
    .from('proposals')
    .select('*', { count: 'exact', head: true });

  const participationRate =
    totalProposals && totalProposals > 0
      ? Math.round((totalVotes / totalProposals) * 100)
      : 0;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageViewTracker event="pool_profile_viewed" properties={{ pool_id: poolId }} />

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">SPO Governance Profile</h1>
        <p className="font-mono text-sm text-muted-foreground break-all">{poolId}</p>
      </div>

      {totalVotes === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-sm">
              This pool has no recorded governance votes yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total Votes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totalVotes}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Participation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{participationRate}%</p>
                <p className="text-xs text-muted-foreground">
                  {totalVotes} of {totalProposals ?? '?'} proposals
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Vote Split</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 text-sm">
                  <span className="text-green-500">{yesCount} Yes</span>
                  <span className="text-red-500">{noCount} No</span>
                  <span className="text-muted-foreground">{abstainCount} Abstain</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Most Active Epoch</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const epochCounts = new Map<number, number>();
                  for (const v of safeVotes) {
                    epochCounts.set(v.epoch, (epochCounts.get(v.epoch) || 0) + 1);
                  }
                  const top = [...epochCounts.entries()].sort((a, b) => b[1] - a[1])[0];
                  return top ? (
                    <p className="text-2xl font-bold">
                      Epoch {top[0]}{' '}
                      <span className="text-sm font-normal text-muted-foreground">
                        ({top[1]} votes)
                      </span>
                    </p>
                  ) : (
                    <p className="text-muted-foreground">—</p>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          <PoolProfileClient votes={safeVotes} proposals={proposals} />
        </>
      )}
    </div>
  );
}
