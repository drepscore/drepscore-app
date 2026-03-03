'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

interface MemberData {
  ccHotId: string;
  voteCount: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  approvalRate: number;
}

function CommitteeSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg border p-4"
        >
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 space-y-3">
      <p className="text-muted-foreground text-sm">
        No Constitutional Committee votes recorded yet.
      </p>
      <p className="text-xs text-muted-foreground/70">
        CC members will appear here once they participate in on-chain governance.
      </p>
    </div>
  );
}

export function CommitteeDiscovery() {
  const [members, setMembers] = useState<MemberData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/governance/committee')
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((data) => setMembers(data.members || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CommitteeSkeleton />;
  if (members.length === 0) return <EmptyState />;

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <Link key={member.ccHotId} href={`/committee#${member.ccHotId.slice(0, 12)}`}>
          <div className="flex items-center justify-between rounded-lg border p-4 hover:border-purple-500/40 transition-colors cursor-pointer">
            <span className="font-mono text-sm truncate max-w-[200px]">
              {member.ccHotId.slice(0, 20)}…
            </span>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-purple-500 border-purple-500/40">
                {member.voteCount} votes
              </Badge>
              <span className="text-xs text-muted-foreground">
                {member.approvalRate}% approval
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
