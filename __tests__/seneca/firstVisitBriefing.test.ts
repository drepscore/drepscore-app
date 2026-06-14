import { describe, expect, it } from 'vitest';
import { buildFirstVisitBriefing } from '@/lib/seneca/firstVisitBriefing';

describe('buildFirstVisitBriefing', () => {
  it('builds the approved newcomer-first opener', () => {
    const briefing = buildFirstVisitBriefing({ segment: 'anonymous' });

    expect(briefing.state).toBe('first_visit_anonymous');
    expect(briefing.moves.map((move) => move.id)).toEqual(['opener']);
    expect(briefing.moves.map((move) => move.text)).toEqual([
      "Cardano has a government — and if you hold ADA, you have a say in it. This is a live map of who's making the decisions. Where do you want to start?",
    ]);
  });

  it('uses the approved ELI5 onboarding pills with richer no-zoom queries', () => {
    const briefing = buildFirstVisitBriefing();

    expect(briefing.paths.map((path) => path.label)).toEqual([
      'What am I looking at?',
      'Why should I care?',
      "Who's making decisions?",
    ]);
    expect(briefing.paths.every((path) => path.action === 'conversation')).toBe(true);
    expect(briefing.paths[0].query).toContain('plain language');
    expect(briefing.paths[0].query).toContain('globe');
    expect(briefing.paths[1].query).toContain('ADA is a vote');
    expect(briefing.paths[1].query).toContain('treasury spending');
    expect(briefing.paths[2].query).toContain('most active DReps');
    expect(briefing.paths[2].query).toContain('without zooming');
    expect(briefing.paths.map((path) => path.globeHint)).toEqual([
      'proposals',
      'treasury',
      'participation',
    ]);
  });
});
