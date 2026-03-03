'use client';

import { FeatureGate } from '@/components/FeatureGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface Vote {
  pool_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  vote: string;
  block_time: number;
  epoch: number;
}

interface Proposal {
  tx_hash: string;
  proposal_index: number;
  title: string;
  proposal_type: string;
}

interface PoolProfileClientProps {
  votes: Vote[];
  proposals: Proposal[];
}

function voteBadgeClass(vote: string) {
  switch (vote) {
    case 'Yes':
      return 'text-green-500 border-green-500/40';
    case 'No':
      return 'text-red-500 border-red-500/40';
    default:
      return 'text-muted-foreground border-muted-foreground/40';
  }
}

export function PoolProfileClient({ votes, proposals }: PoolProfileClientProps) {
  const proposalMap = new Map(proposals.map((p) => [`${p.tx_hash}-${p.proposal_index}`, p]));

  return (
    <FeatureGate flag="spo_profiles">
      <Card>
        <CardHeader>
          <CardTitle>Voting Record</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Proposal</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Vote</th>
                  <th className="pb-2 pr-4">Epoch</th>
                </tr>
              </thead>
              <tbody>
                {votes.map((v) => {
                  const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
                  const proposal = proposalMap.get(key);
                  return (
                    <tr key={key} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/proposals/${v.proposal_tx_hash}-${v.proposal_index}`}
                          className="hover:text-cyan-500 transition-colors"
                        >
                          {proposal?.title || (
                            <span className="font-mono text-xs">
                              {v.proposal_tx_hash.slice(0, 12)}…#{v.proposal_index}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-xs text-muted-foreground">
                          {proposal?.proposal_type || '—'}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className={voteBadgeClass(v.vote)}>
                          {v.vote}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{v.epoch}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </FeatureGate>
  );
}
