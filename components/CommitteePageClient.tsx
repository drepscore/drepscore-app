'use client';

import { useState } from 'react';
import { FeatureGate } from '@/components/FeatureGate';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface MemberAgg {
  ccHotId: string;
  voteCount: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  approvalRate: number;
}

interface Vote {
  cc_hot_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  vote: string;
  block_time: number;
  epoch: number;
}

interface CommitteePageClientProps {
  members: MemberAgg[];
  votes: Vote[];
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

function MemberRow({ member, votes }: { member: MemberAgg; votes: Vote[] }) {
  const [expanded, setExpanded] = useState(false);
  const memberVotes = votes
    .filter((v) => v.cc_hot_id === member.ccHotId)
    .sort((a, b) => b.block_time - a.block_time);

  return (
    <Card>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-mono text-sm truncate max-w-[240px]">
              {member.ccHotId.slice(0, 24)}…
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-purple-500 border-purple-500/40">
              {member.voteCount} votes
            </Badge>
            <span className="text-xs text-muted-foreground">{member.approvalRate}% approval</span>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span className="text-green-500">{member.yesCount}Y</span>
              <span className="text-red-500">{member.noCount}N</span>
              <span>{member.abstainCount}A</span>
            </div>
          </div>
        </CardContent>
      </button>
      {expanded && memberVotes.length > 0 && (
        <div className="border-t px-6 pb-4">
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="border-b text-left text-muted-foreground text-xs">
                <th className="pb-2 pr-4">Proposal</th>
                <th className="pb-2 pr-4">Vote</th>
                <th className="pb-2">Epoch</th>
              </tr>
            </thead>
            <tbody>
              {memberVotes.map((v) => (
                <tr
                  key={`${v.proposal_tx_hash}-${v.proposal_index}`}
                  className="border-b border-border/30"
                >
                  <td className="py-2 pr-4 font-mono text-xs">
                    {v.proposal_tx_hash.slice(0, 12)}…#{v.proposal_index}
                  </td>
                  <td className="py-2 pr-4">
                    <Badge variant="outline" className={voteBadgeClass(v.vote)}>
                      {v.vote}
                    </Badge>
                  </td>
                  <td className="py-2 text-muted-foreground">{v.epoch}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function CommitteePageClient({ members, votes }: CommitteePageClientProps) {
  return (
    <FeatureGate flag="cc_page">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Members</h2>
        {members.map((member) => (
          <MemberRow key={member.ccHotId} member={member} votes={votes} />
        ))}
      </div>
    </FeatureGate>
  );
}
