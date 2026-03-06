/**
 * GET /api/briefs/latest — Returns the most recent governance brief for the authenticated user.
 */
import { NextRequest, NextResponse } from 'next/server';

import { getLatestBrief } from '@/lib/governanceBrief';
import { captureServerEvent } from '@/lib/posthog-server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (request: NextRequest, { userId, wallet }: RouteContext) => {
    const brief = await getLatestBrief(userId!);

    if (!brief) {
      return NextResponse.json({ brief: null, message: 'No briefs yet' });
    }

    captureServerEvent(
      'governance_brief_opened',
      {
        brief_id: brief.id,
        source: 'api',
      },
      wallet!,
    );

    return NextResponse.json({ brief });
  },
  { auth: 'required' },
);
