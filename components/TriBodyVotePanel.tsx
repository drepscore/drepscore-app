'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TriBodyVoteBar } from '@/components/TriBodyVoteBar';
import { Users, Server, ShieldCheck, TrendingUp, TrendingDown, Equal } from 'lucide-react';
import type { TriBodyVotes } from '@/lib/data';

interface TriBodyVotePanelProps {
  triBody: TriBodyVotes;
  txHash: string;
  proposalIndex: number;
}

interface AlignmentData {
  alignmentScore: number;
  drep: { yes: number; no: number; abstain: number; total: number; yesPct: number };
  spo: { yes: number; no: number; abstain: number; total: number; yesPct: number };
  cc: { yes: number; no: number; abstain: number; total: number; yesPct: number };
}

function BodyColumn({
  label,
  icon: Icon,
  color,
  votes,
}: {
  label: string;
  icon: typeof Users;
  color: string;
  votes: { yes: number; no: number; abstain: number };
}) {
  const total = votes.yes + votes.no + votes.abstain;
  if (total === 0) {
    return (
      <div className="flex-1 text-center p-4 rounded-lg bg-muted/30">
        <div className="flex items-center justify-center gap-1.5 mb-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <p className="text-xs text-muted-foreground">No votes yet</p>
      </div>
    );
  }

  return (
    <div className="flex-1 text-center p-4 rounded-lg bg-muted/30">
      <div className="flex items-center justify-center gap-1.5 mb-3">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-green-600 dark:text-green-400">Yes</span>
          <span className="tabular-nums font-medium">{votes.yes}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-red-600 dark:text-red-400">No</span>
          <span className="tabular-nums font-medium">{votes.no}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Abstain</span>
          <span className="tabular-nums font-medium">{votes.abstain}</span>
        </div>
        <div className="border-t pt-1.5 flex justify-between font-medium">
          <span>Total</span>
          <span className="tabular-nums">{total}</span>
        </div>
      </div>
    </div>
  );
}

export function TriBodyVotePanel({ triBody, txHash, proposalIndex }: TriBodyVotePanelProps) {
  const [alignment, setAlignment] = useState<AlignmentData | null>(null);

  useEffect(() => {
    fetch(`/api/governance/inter-body?proposal=${txHash}-${proposalIndex}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.alignmentScore != null) setAlignment(data);
      })
      .catch(() => {});
  }, [txHash, proposalIndex]);

  const hasSpo = triBody.spo.yes + triBody.spo.no + triBody.spo.abstain > 0;
  const hasCc = triBody.cc.yes + triBody.cc.no + triBody.cc.abstain > 0;

  const drepMajority =
    triBody.drep.yes >= triBody.drep.no && triBody.drep.yes >= triBody.drep.abstain
      ? 'Yes'
      : triBody.drep.no >= triBody.drep.abstain
        ? 'No'
        : 'Abstain';
  const spoMajority = hasSpo
    ? triBody.spo.yes >= triBody.spo.no && triBody.spo.yes >= triBody.spo.abstain
      ? 'Yes'
      : triBody.spo.no >= triBody.spo.abstain
        ? 'No'
        : 'Abstain'
    : null;

  let alignmentCallout: string | null = null;
  if (hasSpo && spoMajority) {
    if (drepMajority === spoMajority) {
      alignmentCallout = `DReps and SPOs agreed on this proposal — both majority voted ${drepMajority}.`;
    } else {
      alignmentCallout = `DReps and SPOs diverged — DReps voted ${drepMajority} while SPOs voted ${spoMajority}.`;
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Tri-Body Governance Votes</CardTitle>
          {alignment && (
            <Badge
              variant="outline"
              className={
                alignment.alignmentScore >= 80
                  ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30'
                  : alignment.alignmentScore >= 50
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                    : 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30'
              }
            >
              {alignment.alignmentScore >= 80 ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : alignment.alignmentScore >= 50 ? (
                <Equal className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {alignment.alignmentScore}% alignment
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <TriBodyVoteBar
          size="lg"
          drep={triBody.drep}
          spo={hasSpo ? triBody.spo : undefined}
          cc={hasCc ? triBody.cc : undefined}
        />

        <div className="grid grid-cols-3 gap-3">
          <BodyColumn
            label="DReps"
            icon={Users}
            color="text-primary"
            votes={triBody.drep}
          />
          <BodyColumn
            label="SPOs"
            icon={Server}
            color="text-cyan-500"
            votes={triBody.spo}
          />
          <BodyColumn
            label="CC"
            icon={ShieldCheck}
            color="text-amber-500"
            votes={triBody.cc}
          />
        </div>

        {alignmentCallout && (
          <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Inter-body alignment:</span>{' '}
            {alignmentCallout}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
