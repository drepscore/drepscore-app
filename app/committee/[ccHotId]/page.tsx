import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageViewTracker } from '@/components/PageViewTracker';
import {
  ArrowLeft,
  Scale,
  BookOpen,
  Sparkles,
  Clock,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ ccHotId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ccHotId } = await params;
  const supabase = createClient();
  const { data: member } = await supabase
    .from('cc_members')
    .select('author_name')
    .eq('cc_hot_id', ccHotId)
    .maybeSingle();

  const name = member?.author_name ?? `CC Member ${ccHotId.slice(0, 12)}...`;
  return {
    title: `${name} — Constitutional Committee — Civica`,
    description: `Constitutional Committee member voting record, fidelity score, and rationale analysis.`,
  };
}

function fidelityGrade(score: number): { label: string; color: string; bg: string } {
  if (score >= 85)
    return { label: 'A', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/30' };
  if (score >= 70)
    return { label: 'B', color: 'text-cyan-500', bg: 'bg-cyan-500/10 border-cyan-500/30' };
  if (score >= 55)
    return { label: 'C', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/30' };
  if (score >= 40)
    return { label: 'D', color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/30' };
  return { label: 'F', color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/30' };
}

export default async function CCMemberProfilePage({ params }: PageProps) {
  const { ccHotId } = await params;
  const decodedId = decodeURIComponent(ccHotId);
  const supabase = createClient();

  // Fetch member data, votes, and rationales in parallel
  const [{ data: member }, { data: votes }, { data: rationales }, { data: alignmentRows }] =
    await Promise.all([
      supabase.from('cc_members').select('*').eq('cc_hot_id', decodedId).maybeSingle(),
      supabase
        .from('cc_votes')
        .select('proposal_tx_hash, proposal_index, vote, block_time, epoch, meta_url')
        .eq('cc_hot_id', decodedId)
        .order('block_time', { ascending: false }),
      supabase
        .from('cc_rationales')
        .select(
          'proposal_tx_hash, proposal_index, summary, cited_articles, author_name, internal_vote',
        )
        .eq('cc_hot_id', decodedId),
      supabase
        .from('inter_body_alignment')
        .select('proposal_tx_hash, proposal_index, drep_yes_pct, drep_no_pct'),
    ]);

  const safeVotes = votes ?? [];
  if (safeVotes.length === 0) notFound();

  // Get proposal details for votes
  const proposalKeys = safeVotes.map((v) => v.proposal_tx_hash);
  const { data: proposals } = await supabase
    .from('proposals')
    .select('tx_hash, index, title, proposal_type, block_time')
    .in('tx_hash', [...new Set(proposalKeys)]);

  const proposalMap = new Map<string, { title: string | null; type: string; blockTime: number }>();
  for (const p of proposals ?? []) {
    proposalMap.set(`${p.tx_hash}:${p.index}`, {
      title: p.title,
      type: p.proposal_type,
      blockTime: p.block_time,
    });
  }

  // Build rationale lookup
  const rationaleMap = new Map<
    string,
    { summary: string | null; citedArticles: string[]; internalVote: any }
  >();
  for (const r of rationales ?? []) {
    rationaleMap.set(`${r.proposal_tx_hash}:${r.proposal_index}`, {
      summary: r.summary,
      citedArticles: (r.cited_articles as string[]) ?? [],
      internalVote: r.internal_vote,
    });
  }

  // Build alignment lookup
  const drepMajorityMap = new Map<string, string>();
  for (const row of alignmentRows ?? []) {
    const key = `${row.proposal_tx_hash}:${row.proposal_index}`;
    drepMajorityMap.set(
      key,
      row.drep_yes_pct > row.drep_no_pct
        ? 'Yes'
        : row.drep_no_pct > row.drep_yes_pct
          ? 'No'
          : 'Abstain',
    );
  }

  // Stats
  const totalVotes = safeVotes.length;
  const yesCount = safeVotes.filter((v) => v.vote === 'Yes').length;
  const noCount = safeVotes.filter((v) => v.vote === 'No').length;
  const abstainCount = safeVotes.filter((v) => v.vote === 'Abstain').length;
  const withRationale = safeVotes.filter((v) => v.meta_url).length;
  const approvalRate = totalVotes > 0 ? Math.round((yesCount / totalVotes) * 100) : 0;

  // DRep alignment
  let drepAgree = 0;
  let drepCompare = 0;
  for (const v of safeVotes) {
    const majority = drepMajorityMap.get(`${v.proposal_tx_hash}:${v.proposal_index}`);
    if (majority && majority !== 'Abstain') {
      drepCompare++;
      if (v.vote === majority) drepAgree++;
    }
  }
  const drepAlignmentPct = drepCompare > 0 ? Math.round((drepAgree / drepCompare) * 100) : null;

  // Proposal type breakdown
  const typeBreakdown = new Map<string, { yes: number; no: number; abstain: number }>();
  for (const v of safeVotes) {
    const proposal = proposalMap.get(`${v.proposal_tx_hash}:${v.proposal_index}`);
    const type = proposal?.type ?? 'Unknown';
    const counts = typeBreakdown.get(type) ?? { yes: 0, no: 0, abstain: 0 };
    if (v.vote === 'Yes') counts.yes++;
    else if (v.vote === 'No') counts.no++;
    else counts.abstain++;
    typeBreakdown.set(type, counts);
  }

  const authorName = member?.author_name ?? rationales?.[0]?.author_name ?? null;
  const fidelityScore = member?.fidelity_score ?? null;
  const grade = fidelityScore != null ? fidelityGrade(fidelityScore) : null;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageViewTracker event="cc_member_profile_viewed" properties={{ cc_hot_id: decodedId }} />

      <Link href="/discover/committee">
        <Button variant="ghost" className="gap-2 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          All Committee Members
        </Button>
      </Link>

      {/* Hero */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 space-y-2">
            {authorName ? (
              <>
                <h1 className="text-2xl sm:text-3xl font-bold">{authorName}</h1>
                <p className="font-mono text-xs text-muted-foreground break-all">{decodedId}</p>
              </>
            ) : (
              <h1 className="text-xl sm:text-2xl font-bold font-mono break-all">{decodedId}</h1>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                Constitutional Committee
              </Badge>
              {member?.status && (
                <Badge
                  variant="outline"
                  className={
                    member.status === 'authorized'
                      ? 'text-emerald-500 border-emerald-500/40'
                      : 'text-muted-foreground'
                  }
                >
                  {member.status}
                </Badge>
              )}
              {member?.expiration_epoch && (
                <Badge variant="secondary" className="text-xs">
                  Expires epoch {member.expiration_epoch}
                </Badge>
              )}
            </div>
          </div>

          {/* Fidelity score card */}
          {fidelityScore != null && grade && (
            <Card className={`shrink-0 w-48 border ${grade.bg}`}>
              <CardContent className="py-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Constitutional Fidelity</p>
                <p className={`text-4xl font-bold ${grade.color}`}>{fidelityScore}</p>
                <p className={`text-lg font-bold ${grade.color}`}>Grade {grade.label}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Votes Cast</p>
            <p className="text-xl font-bold">{totalVotes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Approval Rate</p>
            <p className="text-xl font-bold">{approvalRate}%</p>
            <p className="text-[10px] text-muted-foreground">
              {yesCount}Y / {noCount}N / {abstainCount}A
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Rationales Provided</p>
            <p className="text-xl font-bold">
              {withRationale}/{totalVotes}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {totalVotes > 0 ? Math.round((withRationale / totalVotes) * 100) : 0}% provision rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">DRep Alignment</p>
            <p className="text-xl font-bold">{drepAlignmentPct ?? '—'}%</p>
            <p className="text-[10px] text-muted-foreground">
              {drepCompare > 0 ? `${drepAgree}/${drepCompare} matched` : 'No data'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Proposal Types</p>
            <p className="text-xl font-bold">{typeBreakdown.size}</p>
            <p className="text-[10px] text-muted-foreground">types voted on</p>
          </CardContent>
        </Card>
      </div>

      {/* Fidelity pillar breakdown */}
      {member && member.fidelity_score != null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Fidelity Score Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <PillarBar
                icon={<BookOpen className="h-3.5 w-3.5" />}
                label="Rationale Provision"
                weight="20%"
                score={member.rationale_provision_rate}
              />
              <PillarBar
                icon={<Sparkles className="h-3.5 w-3.5" />}
                label="Article Coverage"
                weight="30%"
                score={member.avg_article_coverage}
              />
              <PillarBar
                icon={<Scale className="h-3.5 w-3.5" />}
                label="Reasoning Quality"
                weight="30%"
                score={member.avg_reasoning_quality}
              />
              <PillarBar
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Consistency"
                weight="20%"
                score={member.consistency_score}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Proposal type breakdown */}
      {typeBreakdown.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Votes by Proposal Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from(typeBreakdown.entries())
                .sort((a, b) => {
                  const totalA = a[1].yes + a[1].no + a[1].abstain;
                  const totalB = b[1].yes + b[1].no + b[1].abstain;
                  return totalB - totalA;
                })
                .map(([type, counts]) => {
                  const total = counts.yes + counts.no + counts.abstain;
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-40 shrink-0 truncate">
                        {type}
                      </span>
                      <div className="flex-1 flex h-4 rounded-full overflow-hidden bg-muted">
                        {counts.yes > 0 && (
                          <div
                            className="bg-emerald-500/70 h-full"
                            style={{ width: `${(counts.yes / total) * 100}%` }}
                          />
                        )}
                        {counts.no > 0 && (
                          <div
                            className="bg-rose-500/70 h-full"
                            style={{ width: `${(counts.no / total) * 100}%` }}
                          />
                        )}
                        {counts.abstain > 0 && (
                          <div
                            className="bg-amber-500/70 h-full"
                            style={{ width: `${(counts.abstain / total) * 100}%` }}
                          />
                        )}
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground w-12 text-right">
                        {total}
                      </span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Voting record */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Voting Record</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left px-4 py-3 font-medium">Proposal</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Type</th>
                  <th className="text-center px-4 py-3 font-medium">Vote</th>
                  <th className="text-center px-4 py-3 font-medium hidden sm:table-cell">
                    DRep Majority
                  </th>
                  <th className="text-center px-4 py-3 font-medium hidden lg:table-cell">
                    Rationale
                  </th>
                  <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Epoch</th>
                </tr>
              </thead>
              <tbody>
                {safeVotes.map((v) => {
                  const pKey = `${v.proposal_tx_hash}:${v.proposal_index}`;
                  const proposal = proposalMap.get(pKey);
                  const rationale = rationaleMap.get(pKey);
                  const drepMajority = drepMajorityMap.get(pKey);
                  const isAligned = drepMajority ? v.vote === drepMajority : null;

                  return (
                    <tr
                      key={`${v.proposal_tx_hash}-${v.proposal_index}`}
                      className="border-b last:border-0 hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/proposal/${v.proposal_tx_hash}/${v.proposal_index}`}
                          className="hover:text-primary transition-colors"
                        >
                          {proposal?.title ? (
                            <span className="text-sm line-clamp-1">{proposal.title}</span>
                          ) : (
                            <span className="font-mono text-xs">
                              {v.proposal_tx_hash.slice(0, 12)}...
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge variant="secondary" className="text-[10px]">
                          {proposal?.type ?? '—'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={
                            v.vote === 'Yes'
                              ? 'text-emerald-500 border-emerald-500/40'
                              : v.vote === 'No'
                                ? 'text-rose-500 border-rose-500/40'
                                : 'text-amber-500 border-amber-500/40'
                          }
                        >
                          {v.vote}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        {drepMajority && drepMajority !== 'Abstain' ? (
                          <span
                            className={`text-xs ${isAligned ? 'text-emerald-500' : 'text-rose-500'}`}
                          >
                            {drepMajority} {isAligned ? '(aligned)' : '(diverged)'}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        {rationale ? (
                          <span
                            className="text-xs text-emerald-500"
                            title={rationale.summary ?? undefined}
                          >
                            {rationale.citedArticles.length > 0
                              ? `${rationale.citedArticles.length} articles`
                              : 'Provided'}
                          </span>
                        ) : v.meta_url ? (
                          <span className="text-xs text-amber-500">Pending parse</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell tabular-nums text-muted-foreground">
                        {v.epoch}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PillarBar({
  icon,
  label,
  weight,
  score,
}: {
  icon: React.ReactNode;
  label: string;
  weight: string;
  score: number | null;
}) {
  const displayScore = score != null ? Math.round(score) : null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium flex items-center gap-1">
          {icon}
          {label}
        </span>
        <span className="text-[10px] text-muted-foreground">{weight}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-cyan-500/80 transition-all"
          style={{ width: `${displayScore ?? 0}%` }}
        />
      </div>
      <p className="text-xs tabular-nums text-right text-muted-foreground">
        {displayScore != null ? `${displayScore}/100` : 'Pending'}
      </p>
    </div>
  );
}
