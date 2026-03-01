'use client';

import { useState, useCallback } from 'react';
import { posthog } from '@/lib/posthog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Share2, Download, Copy, Check, Image, Loader2 } from 'lucide-react';

interface DRepReportCardProps {
  drepId: string;
  name: string;
  score: number;
  rank: number | null;
  delegators: number;
  participation: number;
  rationale: number;
  reliability: number;
  profile: number;
}

export function DRepReportCard({
  drepId, name, score, rank, delegators, participation, rationale, reliability, profile,
}: DRepReportCardProps) {
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateCard = useCallback(async () => {
    setGenerating(true);
    try {
      // Use the OG image route which already generates DRep cards
      const url = `/api/og/drep/${encodeURIComponent(drepId)}`;
      setImageUrl(url);
      posthog.capture('report_card_generated', { drep_id: drepId, score });
    } finally {
      setGenerating(false);
    }
  }, [drepId, score]);

  const shareOnX = useCallback(() => {
    const text = `My DRepScore: ${score}/100\n\nParticipation: ${participation}%\nRationale: ${rationale}%\nReliability: ${reliability}%\n${rank ? `Ranked #${rank}` : ''}\n\n${delegators} delegators trust my governance.\n\nCheck your DRep's score:`;
    const shareUrl = `https://drepscore.io/drep/${encodeURIComponent(drepId)}`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
    posthog.capture('report_card_shared', { drep_id: drepId, platform: 'x' });
  }, [drepId, score, rank, delegators, participation, rationale, reliability]);

  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(`https://drepscore.io/drep/${encodeURIComponent(drepId)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    posthog.capture('report_card_shared', { drep_id: drepId, platform: 'copy' });
  }, [drepId]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Share2 className="h-4 w-4" />
          Share Your Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Preview card */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{name}</p>
              <p className="text-xs text-muted-foreground">DRepScore</p>
            </div>
            <div className="text-right">
              <span className={`text-2xl font-bold tabular-nums ${score >= 80 ? 'text-green-600 dark:text-green-400' : score >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                {score}
              </span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>Participation: <span className="font-medium">{participation}%</span></div>
            <div>Rationale: <span className="font-medium">{rationale}%</span></div>
            <div>Reliability: <span className="font-medium">{reliability}%</span></div>
            <div>Profile: <span className="font-medium">{profile}%</span></div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {rank && <Badge variant="secondary" className="text-[10px]">#{rank}</Badge>}
            <span>{delegators} delegators</span>
          </div>
        </div>

        {/* Share buttons */}
        <div className="flex gap-2">
          <Button variant="default" size="sm" className="flex-1 gap-1.5 text-xs" onClick={shareOnX}>
            Share on X
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={copyLink}>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
