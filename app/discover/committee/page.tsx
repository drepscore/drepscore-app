import { Metadata } from 'next';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageViewTracker } from '@/components/PageViewTracker';
import Link from 'next/link';
import { ArrowLeft, Users, ShieldCheck, Activity, Scale, BookOpen, Info } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Constitutional Committee — Civica',
  description:
    'Explore Constitutional Committee members, fidelity scores, and governance voting records on Cardano.',
};

export const dynamic = 'force-dynamic';

interface MemberRow {
  cc_hot_id: string;
  author_name: string | null;
  status: string | null;
  fidelity_score: number | null;
  rationale_provision_rate: number | null;
  avg_article_coverage: number | null;
  avg_reasoning_quality: number | null;
  consistency_score: number | null;
}

interface AlignmentTensionProposal {
  txHash: string;
  proposalIndex: number;
  title: string | null;
  drepMajority: string;
  ccVote: string;
}

function fidelityColor(score: number | null): string {
  if (score == null) return 'text-muted-foreground';
  if (score >= 85) return 'text-emerald-500';
  if (score >= 70) return 'text-cyan-500';
  if (score >= 55) return 'text-amber-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-rose-500';
}

function fidelityBarColor(score: number | null): string {
  if (score == null) return 'bg-muted';
  if (score >= 85) return 'bg-emerald-500/80';
  if (score >= 70) return 'bg-cyan-500/80';
  if (score >= 55) return 'bg-amber-500/80';
  if (score >= 40) return 'bg-orange-500/80';
  return 'bg-rose-500/80';
}

export default async function CommitteeFidelityPage() {
  const supabase = createClient();

  const [{ data: members }, { data: votes }, { data: alignmentRows }, { data: proposals }] =
    await Promise.all([
      supabase
        .from('cc_members')
        .select(
          'cc_hot_id, author_name, status, fidelity_score, rationale_provision_rate, avg_article_coverage, avg_reasoning_quality, consistency_score',
        ),
      supabase.from('cc_votes').select('cc_hot_id, proposal_tx_hash, proposal_index, vote'),
      supabase
        .from('inter_body_alignment')
        .select('proposal_tx_hash, proposal_index, drep_yes_pct, drep_no_pct'),
      supabase.from('proposals').select('tx_hash, index, title'),
    ]);

  const safeMembers: MemberRow[] = (members ?? []) as MemberRow[];
  const safeVotes = votes ?? [];

  // Build alignment map
  const alignmentMap = new Map<string, { drepMajority: string }>();
  for (const row of alignmentRows ?? []) {
    const key = `${row.proposal_tx_hash}-${row.proposal_index}`;
    const drepMajority =
      row.drep_yes_pct > row.drep_no_pct
        ? 'Yes'
        : row.drep_no_pct > row.drep_yes_pct
          ? 'No'
          : 'Abstain';
    alignmentMap.set(key, { drepMajority });
  }

  // Build proposal title map
  const proposalTitleMap = new Map<string, string>();
  for (const p of proposals ?? []) {
    proposalTitleMap.set(`${p.tx_hash}-${p.index}`, p.title ?? '');
  }

  // Build vote counts from cc_votes for members without cc_members entries
  const memberVoteCounts = new Map<string, number>();
  for (const v of safeVotes) {
    memberVoteCounts.set(v.cc_hot_id, (memberVoteCounts.get(v.cc_hot_id) ?? 0) + 1);
  }

  // Merge: prefer cc_members data, fill gaps from cc_votes
  const memberIds = new Set([
    ...safeMembers.map((m) => m.cc_hot_id),
    ...Array.from(memberVoteCounts.keys()),
  ]);

  const memberLookup = new Map(safeMembers.map((m) => [m.cc_hot_id, m]));

  const sortedMembers = Array.from(memberIds)
    .map((id) => {
      const m = memberLookup.get(id);
      return {
        ccHotId: id,
        authorName: m?.author_name ?? null,
        status: m?.status ?? null,
        fidelityScore: m?.fidelity_score ?? null,
        rationaleProvision: m?.rationale_provision_rate ?? null,
        articleCoverage: m?.avg_article_coverage ?? null,
        reasoningQuality: m?.avg_reasoning_quality ?? null,
        consistency: m?.consistency_score ?? null,
        voteCount: memberVoteCounts.get(id) ?? 0,
      };
    })
    .sort((a, b) => (b.fidelityScore ?? -1) - (a.fidelityScore ?? -1));

  const totalMembers = sortedMembers.length;
  const totalVotes = safeVotes.length;

  // Unanimous + tension
  const proposalVoteCounts = new Map<string, Map<string, string>>();
  for (const v of safeVotes) {
    const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
    const voteMap = proposalVoteCounts.get(key) ?? new Map<string, string>();
    voteMap.set(v.cc_hot_id, v.vote);
    proposalVoteCounts.set(key, voteMap);
  }

  let unanimousCount = 0;
  const tensionProposals: AlignmentTensionProposal[] = [];

  for (const [proposalKey, voteMap] of proposalVoteCounts) {
    const allVotes = Array.from(voteMap.values());
    if (allVotes.length < totalMembers || totalMembers === 0) continue;
    const firstVote = allVotes[0];
    const isUnanimous = allVotes.every((v) => v === firstVote);
    if (isUnanimous) {
      unanimousCount++;
      const alignment = alignmentMap.get(proposalKey);
      if (
        alignment &&
        alignment.drepMajority !== 'Abstain' &&
        firstVote !== alignment.drepMajority
      ) {
        const [txHash, idxStr] = proposalKey.split(/-(?=\d+$)/);
        const proposalIndex = parseInt(idxStr ?? '0', 10);
        tensionProposals.push({
          txHash,
          proposalIndex,
          title: proposalTitleMap.get(proposalKey) || null,
          drepMajority: alignment.drepMajority,
          ccVote: firstVote,
        });
      }
    }
  }

  const unanimousRate =
    proposalVoteCounts.size > 0 ? Math.round((unanimousCount / proposalVoteCounts.size) * 100) : 0;

  // Average fidelity
  const scoredMembers = sortedMembers.filter((m) => m.fidelityScore != null);
  const avgFidelity =
    scoredMembers.length > 0
      ? Math.round(
          scoredMembers.reduce((sum, m) => sum + (m.fidelityScore ?? 0), 0) / scoredMembers.length,
        )
      : null;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageViewTracker event="civica_committee_page_viewed" />

      <Link
        href="/discover"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Discover
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Constitutional Committee</h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          The Constitutional Committee ensures governance proposals align with the Cardano
          Constitution. Fidelity scores measure rationale quality, article citations, reasoning
          depth, and consistency.
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
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Active Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totalMembers}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Total Votes Cast
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totalVotes.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Unanimous Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{unanimousRate}%</p>
                <p className="text-xs text-muted-foreground">
                  {unanimousCount} of {proposalVoteCounts.size} proposals
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Avg Fidelity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${fidelityColor(avgFidelity)}`}>
                  {avgFidelity ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {scoredMembers.length} of {totalMembers} scored
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Members table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Member Constitutional Fidelity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left px-4 py-3 font-medium">Member</th>
                      <th className="text-right px-4 py-3 font-medium">Votes</th>
                      <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">
                        Rationale
                      </th>
                      <th className="text-right px-4 py-3 font-medium hidden md:table-cell">
                        Articles
                      </th>
                      <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">
                        Reasoning
                      </th>
                      <th className="px-4 py-3 font-medium w-44">Fidelity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMembers.map((m) => (
                      <tr
                        key={m.ccHotId}
                        className="border-b last:border-0 hover:bg-muted/40 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/committee/${encodeURIComponent(m.ccHotId)}`}
                            className="hover:text-primary transition-colors"
                          >
                            {m.authorName ? (
                              <span className="text-sm font-medium">{m.authorName}</span>
                            ) : (
                              <span className="font-mono text-xs text-foreground/80">
                                {m.ccHotId.slice(0, 12)}...{m.ccHotId.slice(-6)}
                              </span>
                            )}
                          </Link>
                          {m.status && (
                            <Badge
                              variant="outline"
                              className={`ml-2 text-[10px] ${m.status === 'authorized' ? 'text-emerald-500 border-emerald-500/40' : 'text-muted-foreground'}`}
                            >
                              {m.status}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{m.voteCount}</td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell tabular-nums">
                          {m.rationaleProvision != null
                            ? `${Math.round(m.rationaleProvision)}%`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell tabular-nums">
                          {m.articleCoverage != null ? `${Math.round(m.articleCoverage)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell tabular-nums">
                          {m.reasoningQuality != null ? `${Math.round(m.reasoningQuality)}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full ${fidelityBarColor(m.fidelityScore)}`}
                                style={{ width: `${m.fidelityScore ?? 0}%` }}
                              />
                            </div>
                            <span
                              className={`text-sm font-mono tabular-nums w-8 text-right ${fidelityColor(m.fidelityScore)}`}
                            >
                              {m.fidelityScore ?? '—'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Alignment Tension */}
          {tensionProposals.length > 0 && (
            <Card className="border-amber-500/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Alignment Tension
                  <Badge variant="outline" className="text-amber-500 border-amber-500/40 text-xs">
                    {tensionProposals.length}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {tensionProposals.length} proposal
                  {tensionProposals.length !== 1 ? 's' : ''} where the CC voted unanimously opposite
                  the DRep majority position.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left px-4 py-3 font-medium">Proposal</th>
                        <th className="text-right px-4 py-3 font-medium">DRep Majority</th>
                        <th className="text-right px-4 py-3 font-medium">CC Vote</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tensionProposals.map((t) => (
                        <tr
                          key={`${t.txHash}-${t.proposalIndex}`}
                          className="border-b last:border-0 hover:bg-muted/40 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <Link
                              href={`/proposal/${t.txHash}/${t.proposalIndex}`}
                              className="hover:text-primary transition-colors"
                            >
                              {t.title ? (
                                <span className="text-sm line-clamp-1">{t.title}</span>
                              ) : (
                                <span className="font-mono text-xs text-foreground/80">
                                  {t.txHash.slice(0, 12)}...{t.txHash.slice(-6)}
                                  <span className="text-muted-foreground ml-1">
                                    #{t.proposalIndex}
                                  </span>
                                </span>
                              )}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Badge
                              variant="outline"
                              className={
                                t.drepMajority === 'Yes'
                                  ? 'text-emerald-500 border-emerald-500/40'
                                  : 'text-rose-500 border-rose-500/40'
                              }
                            >
                              {t.drepMajority}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Badge
                              variant="outline"
                              className={
                                t.ccVote === 'Yes'
                                  ? 'text-emerald-500 border-emerald-500/40'
                                  : 'text-rose-500 border-rose-500/40'
                              }
                            >
                              {t.ccVote}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Methodology */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
                Scoring Methodology
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs text-muted-foreground">
                <div>
                  <p className="font-medium text-foreground">Rationale Provision (20%)</p>
                  <p>Percentage of votes accompanied by a CIP-136 rationale document.</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Article Coverage (30%)</p>
                  <p>
                    How well cited constitutional articles match the expected articles for each
                    proposal type.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Reasoning Quality (30%)</p>
                  <p>
                    Depth of analysis: summary, rationale statement, precedent discussion, and
                    counterarguments.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Consistency (20%)</p>
                  <p>
                    Independent judgment (bell curve peaking at moderate DRep alignment) plus vote
                    responsiveness.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
