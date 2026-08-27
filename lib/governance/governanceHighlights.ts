import { getAllDReps } from '@/lib/data';
import { getCitizenSentimentOpportunities } from '@/lib/governance/sentimentOpportunities';
import { executeShowControversy } from '@/lib/intelligence/advisor-discovery-tools';
import type { GlobeCommand } from '@/lib/globe/types';
import { logger } from '@/lib/logger';
import { cached } from '@/lib/redis';
import type { GovernanceProposalSignal } from '@/types/cinematic';

export type GovernanceHighlightKind = 'open_proposals' | 'contested_vote' | 'active_representative';

export interface GovernanceHighlight {
  id: string;
  kind: GovernanceHighlightKind;
  label: string;
  body: string;
  href?: string;
  globeCommand?: GlobeCommand;
}

interface ContestedVoteHighlightSource {
  title: string;
  txHash: string;
  proposalIndex: number;
}

type DRepSummary = Awaited<ReturnType<typeof getAllDReps>>['allDReps'][number];

const GOVERNANCE_HIGHLIGHTS_CACHE_KEY = 'governance-highlights:anon';
const GOVERNANCE_HIGHLIGHTS_TTL_SECONDS = 300;

export async function getGovernanceHighlights(now = new Date()): Promise<GovernanceHighlight[]> {
  // Cached under a single static key for all anonymous visitors (5-min TTL). `now` flows
  // to the proposal read for forward-compatibility but does NOT vary the cache key — callers
  // within the TTL window share one result, so `now` is not a per-request freshness lever.
  try {
    return await cached(GOVERNANCE_HIGHLIGHTS_CACHE_KEY, GOVERNANCE_HIGHLIGHTS_TTL_SECONDS, () =>
      getGovernanceHighlightsUncached(now),
    );
  } catch (error) {
    logger.warn('[governance/highlights] Cache wrapper failed', { error });
    return getFallbackHighlights();
  }
}

async function getGovernanceHighlightsUncached(now: Date): Promise<GovernanceHighlight[]> {
  const [openProposals, contestedVote, activeRepresentative] = await Promise.all([
    readOpenProposals(now),
    readContestedVote(),
    readMostActiveRepresentative(),
  ]);

  return [
    buildOpenProposalsHighlight(openProposals),
    buildContestedVoteHighlight(contestedVote),
    buildActiveRepresentativeHighlight(activeRepresentative),
  ];
}

async function readOpenProposals(now: Date): Promise<GovernanceProposalSignal[]> {
  try {
    return await getCitizenSentimentOpportunities(now);
  } catch (error) {
    logger.warn('[governance/highlights] Open proposal read failed', { error });
    return [];
  }
}

async function readContestedVote(): Promise<ContestedVoteHighlightSource | null> {
  try {
    const result = await executeShowControversy();
    return parseControversyResult(result.result, result.globeCommands);
  } catch (error) {
    logger.warn('[governance/highlights] Contested vote read failed', { error });
    return null;
  }
}

async function readMostActiveRepresentative(): Promise<DRepSummary | null> {
  try {
    const { allDReps } = await getAllDReps();
    return [...allDReps]
      .filter((drep) => drep.isActive !== false)
      .sort((a, b) => {
        const voteTimeDelta = (b.lastVoteTime ?? 0) - (a.lastVoteTime ?? 0);
        if (voteTimeDelta !== 0) return voteTimeDelta;

        const totalVotesDelta = (b.totalVotes ?? 0) - (a.totalVotes ?? 0);
        if (totalVotesDelta !== 0) return totalVotesDelta;

        return (b.drepScore ?? 0) - (a.drepScore ?? 0);
      })[0];
  } catch (error) {
    logger.warn('[governance/highlights] Active representative read failed', { error });
    return null;
  }
}

function buildOpenProposalsHighlight(proposals: GovernanceProposalSignal[]): GovernanceHighlight {
  if (proposals.length === 0) {
    return {
      id: 'open-proposals',
      kind: 'open_proposals',
      label: 'Proposal feed updating now',
      body: 'Seneca is checking the live proposal list so newcomers can see what is open.',
      href: '/governance/proposals',
    };
  }

  const firstTitle = proposals[0]?.title?.trim();
  const plural = proposals.length === 1 ? 'proposal' : 'proposals';

  return {
    id: 'open-proposals',
    kind: 'open_proposals',
    label: `${proposals.length} ${plural} open now`,
    body: firstTitle
      ? `${firstTitle} is one of the live decisions ADA holders can follow.`
      : 'Active proposals are live across Cardano governance right now.',
    href: '/governance/proposals',
  };
}

function buildContestedVoteHighlight(
  contestedVote: ContestedVoteHighlightSource | null,
): GovernanceHighlight {
  if (!contestedVote) {
    return {
      id: 'contested-vote',
      kind: 'contested_vote',
      label: 'Hottest vote: checking live splits',
      body: 'Seneca is checking where DReps and stake pools disagree most.',
      href: '/governance/proposals',
      globeCommand: { type: 'warmTopic', topic: 'proposals' },
    };
  }

  return {
    id: 'contested-vote',
    kind: 'contested_vote',
    label: `Hottest vote: ${contestedVote.title}`,
    body: 'DReps and stake pools are split enough for this vote to stand out.',
    href: `/proposal/${contestedVote.txHash}/${contestedVote.proposalIndex}`,
    globeCommand: { type: 'warmTopic', topic: 'proposals' },
  };
}

function buildActiveRepresentativeHighlight(activeDRep: DRepSummary | null): GovernanceHighlight {
  if (!activeDRep) {
    return {
      id: 'active-representative',
      kind: 'active_representative',
      label: 'Most active this epoch: checking activity',
      body: 'Seneca is checking recent representative votes before naming one.',
      href: '/governance/representatives',
      globeCommand: { type: 'warmTopic', topic: 'participation' },
    };
  }

  const name = getDRepDisplayName(activeDRep);

  return {
    id: 'active-representative',
    kind: 'active_representative',
    label: `Most active this epoch: ${name}`,
    body: 'This representative has recent voting activity on live governance work.',
    href: `/drep/${encodeURIComponent(activeDRep.drepId)}`,
    globeCommand: {
      type: 'narrowTo',
      nodeIds: [`drep_${activeDRep.drepId}`],
      fly: false,
    },
  };
}

function getDRepDisplayName(drep: DRepSummary): string {
  return drep.name?.trim() || drep.handle?.trim() || drep.drepId.slice(0, 16);
}

function parseControversyResult(
  result: string,
  globeCommands: GlobeCommand[] = [],
): ContestedVoteHighlightSource | null {
  const line = result
    .split(/\r?\n/u)
    .map((part) => part.trim())
    .find((part) => /^1\./u.test(part));
  if (!line) return null;

  const match = line.match(/"([^"]+)"[\s\S]*\|\s*([^#\s]+)#(\d+)/u);
  if (!match) return null;

  const proposalIndex = Number.parseInt(match[3], 10);
  if (!Number.isFinite(proposalIndex)) return null;

  // The "1. ..." text line only carries a truncated display hash (hash.slice(0, 12)),
  // which would build a broken /proposal/<short-hash> link. Trust the structured
  // showControversy globe-command id (a full tx hash); fall back to the text hash only
  // if it is itself a full 64-char tx hash. Otherwise return null so the contested-vote
  // card degrades to its safe fallback instead of emitting a dead link.
  const fullProposalRef = getControversyProposalRef(globeCommands);
  const textHash = match[2];
  const txHash = fullProposalRef?.txHash ?? (isFullTxHash(textHash) ? textHash : null);
  if (!txHash) return null;

  return {
    title: match[1],
    txHash,
    proposalIndex: fullProposalRef?.proposalIndex ?? proposalIndex,
  };
}

function isFullTxHash(value: string): boolean {
  return /^[0-9a-f]{64}$/iu.test(value);
}

function getControversyProposalRef(
  globeCommands: GlobeCommand[],
): Pick<ContestedVoteHighlightSource, 'txHash' | 'proposalIndex'> | null {
  const command = globeCommands.find(
    (candidate): candidate is Extract<GlobeCommand, { type: 'showControversy' }> =>
      candidate.type === 'showControversy',
  );
  if (!command) return null;

  const separatorIndex = command.proposalId.lastIndexOf('_');
  if (separatorIndex <= 0) return null;

  const txHash = command.proposalId.slice(0, separatorIndex);
  const proposalIndex = Number.parseInt(command.proposalId.slice(separatorIndex + 1), 10);
  if (!txHash || !Number.isFinite(proposalIndex)) return null;

  return { txHash, proposalIndex };
}

function getFallbackHighlights(): GovernanceHighlight[] {
  return [
    buildOpenProposalsHighlight([]),
    buildContestedVoteHighlight(null),
    buildActiveRepresentativeHighlight(null),
  ];
}
