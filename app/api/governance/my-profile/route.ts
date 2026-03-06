/**
 * User governance profile API.
 * Returns the user's alignment scores, personality label, confidence, and votes used.
 * Creates/updates the profile on first access if it doesn't exist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { updateUserProfile } from '@/lib/matching/userProfile';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const supabase = createClient();

    const { data: existing } = await supabase
      .from('user_governance_profiles')
      .select('alignment_scores, personality_label, votes_used, confidence, updated_at')
      .eq('user_id', userId!)
      .single();

    if (existing) {
      return NextResponse.json({
        alignmentScores: existing.alignment_scores,
        personalityLabel: existing.personality_label,
        votesUsed: existing.votes_used,
        confidence: Math.round((existing.confidence ?? 0) * 100),
        updatedAt: existing.updated_at,
      });
    }

    const profile = await updateUserProfile(userId!);
    if (!profile) {
      return NextResponse.json({
        alignmentScores: null,
        personalityLabel: null,
        votesUsed: 0,
        confidence: 0,
        updatedAt: null,
      });
    }

    return NextResponse.json({
      alignmentScores: profile.alignmentScores,
      personalityLabel: profile.personalityLabel,
      votesUsed: profile.votesUsed,
      confidence: profile.confidence,
      updatedAt: new Date().toISOString(),
    });
  },
  { auth: 'required' },
);
