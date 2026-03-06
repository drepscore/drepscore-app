import { NextRequest, NextResponse } from 'next/server';
import { buildGovernanceFootprint } from '@/lib/governanceFootprint';
import { getFeatureFlag } from '@/lib/featureFlags';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const enabled = await getFeatureFlag('governance_footprint', false);
    if (!enabled) {
      return NextResponse.json({ error: 'Feature not available' }, { status: 404 });
    }

    const stakeAddress = request.nextUrl.searchParams.get('stakeAddress');

    const footprint = await buildGovernanceFootprint(userId!, stakeAddress);

    return NextResponse.json(footprint, {
      headers: { 'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600' },
    });
  },
  { auth: 'required' },
);
