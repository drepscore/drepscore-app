import type { UserCinematicContext } from '@/types/cinematic';
import { logSenecaOutput, type SenecaOutputLogger } from '@/lib/seneca/outputLog';

export type BriefingMoveId = 'opener';
export type BriefingPathId = 'a' | 'b' | 'c';

export interface BriefingMove {
  id: BriefingMoveId;
  text: string;
}

export interface BriefingPath {
  id: BriefingPathId;
  label: string;
  action: 'conversation' | 'match';
  query: string;
  globeHint?: string;
}

export interface BriefingPayload {
  state: 'first_visit_anonymous';
  segment: UserCinematicContext['segment'];
  moves: BriefingMove[];
  paths: BriefingPath[];
}

export const FIRST_VISIT_BRIEFING_MOVES: readonly BriefingMove[] = [
  {
    id: 'opener',
    text: "Cardano has a government — and if you hold ADA, you have a say in it. This is a live map of who's making the decisions. Where do you want to start?",
  },
];

export const FIRST_VISIT_BRIEFING_PATHS: readonly BriefingPath[] = [
  {
    id: 'a',
    label: 'What am I looking at?',
    action: 'conversation',
    query:
      'Explain this Cardano governance constellation in plain language and narrate what I am seeing on the globe: representatives, proposals, and citizens. Do not move or zoom the camera.',
    globeHint: 'proposals',
  },
  {
    id: 'b',
    label: 'Why should I care?',
    action: 'conversation',
    query:
      "Explain Cardano governance like I'm new here: my ADA is a vote, governance decides treasury spending, fees, and protocol changes, and those decisions affect the network I use.",
    globeHint: 'treasury',
  },
  {
    id: 'c',
    label: "Who's making decisions?",
    action: 'conversation',
    query:
      'Show me the most active DReps making governance decisions right now, explain why activity matters, and highlight them on the globe without zooming.',
    globeHint: 'participation',
  },
];

export function buildFirstVisitBriefing(
  userContext: Pick<UserCinematicContext, 'segment'> = { segment: 'anonymous' },
): BriefingPayload {
  return {
    state: 'first_visit_anonymous',
    segment: userContext.segment,
    moves: [...FIRST_VISIT_BRIEFING_MOVES],
    paths: [...FIRST_VISIT_BRIEFING_PATHS],
  };
}

export async function logFirstVisitBriefing(
  briefing: BriefingPayload,
  {
    userContextIdentifier,
    logger = logSenecaOutput,
  }: {
    userContextIdentifier?: string | null;
    logger?: SenecaOutputLogger;
  } = {},
): Promise<void> {
  await Promise.all(
    briefing.moves.map((move) =>
      logger({
        intent: 'observational',
        outputText: move.text,
        source: 'idle_briefing',
        userContextIdentifier,
        cinematicState: briefing.state,
      }),
    ),
  );
}
