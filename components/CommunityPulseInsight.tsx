import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

interface CommunityPulseInsightProps {
  communityYes: number;
  communityNo: number;
  communityAbstain: number;
  communityTotal: number;
  drepYesCount: number;
  drepNoCount: number;
  drepAbstainCount: number;
  drepTotal: number;
}

function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

export function CommunityPulseInsight({
  communityYes,
  communityNo,
  communityAbstain,
  communityTotal,
  drepYesCount,
  drepNoCount,
  drepAbstainCount,
  drepTotal,
}: CommunityPulseInsightProps) {
  if (communityTotal < 3) return null;

  const cYes = pct(communityYes, communityTotal);
  const cNo = pct(communityNo, communityTotal);
  const cAbstain = pct(communityAbstain, communityTotal);

  const dYes = pct(drepYesCount, drepTotal);
  const dNo = pct(drepNoCount, drepTotal);
  const dAbstain = pct(drepAbstainCount, drepTotal);

  const gap = Math.abs(cYes - dYes);
  const hasTension = gap > 15;

  let narrative: string;
  if (gap <= 10) {
    narrative = `Community and DReps are aligned: ~${cYes}% Yes across both.`;
  } else {
    narrative = `${cYes}% of polled delegators support this proposal, but only ${dYes}% of DReps voted Yes — a ${gap}-point gap.`;
  }

  return (
    <Card className={hasTension ? 'border-amber-500/50' : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Community vs DRep Sentiment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{narrative}</p>

        <div className="grid grid-cols-2 gap-4">
          <SegmentBar
            label="Community"
            yes={cYes}
            no={cNo}
            abstain={cAbstain}
            yesCount={communityYes}
            noCount={communityNo}
            abstainCount={communityAbstain}
            total={communityTotal}
          />
          <SegmentBar
            label="DReps"
            yes={dYes}
            no={dNo}
            abstain={dAbstain}
            yesCount={drepYesCount}
            noCount={drepNoCount}
            abstainCount={drepAbstainCount}
            total={drepTotal}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SegmentBar({
  label,
  yes,
  no,
  abstain,
  yesCount,
  noCount,
  abstainCount,
  total,
}: {
  label: string;
  yes: number;
  no: number;
  abstain: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  total: number;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium">{label}</p>
      <div className="flex h-3 rounded-full overflow-hidden bg-muted">
        {yes > 0 && (
          <div className="bg-green-500 transition-all" style={{ width: `${yes}%` }} />
        )}
        {no > 0 && (
          <div className="bg-red-500 transition-all" style={{ width: `${no}%` }} />
        )}
        {abstain > 0 && (
          <div className="bg-gray-400 transition-all" style={{ width: `${abstain}%` }} />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{yesCount} yes · {noCount} no · {abstainCount} abstain</span>
        <span>{total}</span>
      </div>
    </div>
  );
}
