import { NextRequest, NextResponse } from 'next/server';
import { MILESTONES, getAchievedMilestones, checkAndAwardMilestones } from '@/lib/milestones';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });

  try {
    const achieved = await getAchievedMilestones(drepId);
    const achievedKeys = new Set(achieved.map((a) => a.milestoneKey));

    const milestones = MILESTONES.map((m) => ({
      ...m,
      achieved: achievedKeys.has(m.key),
      achievedAt: achieved.find((a) => a.milestoneKey === m.key)?.achievedAt || null,
    }));

    return NextResponse.json({
      milestones,
      achievedCount: achieved.length,
      totalCount: MILESTONES.length,
    });
  } catch (err) {
    logger.error('Error', { context: 'milestones-api', error: err });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { drepId } = await request.json();
    if (!drepId) return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });

    const newMilestones = await checkAndAwardMilestones(drepId);

    captureServerEvent(
      'milestone_updated',
      { drep_id: drepId, new_milestones: newMilestones.length },
      drepId,
    );

    return NextResponse.json({ newMilestones });
  } catch (err) {
    logger.error('Error', { context: 'milestones-post', error: err });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
