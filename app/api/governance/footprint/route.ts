import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { buildGovernanceFootprint } from '@/lib/governanceFootprint';
import { getFeatureFlag } from '@/lib/featureFlags';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const enabled = await getFeatureFlag('governance_footprint', false);
    if (!enabled) {
      return NextResponse.json({ error: 'Feature not available' }, { status: 404 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const session = await validateSessionToken(token);
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const stakeAddress = request.nextUrl.searchParams.get('stakeAddress');

    const footprint = await buildGovernanceFootprint(session.walletAddress, stakeAddress);

    return NextResponse.json(footprint, {
      headers: { 'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    logger.error('Error', { context: 'governance/footprint', error: error });
    return NextResponse.json({ error: 'Failed to build governance footprint' }, { status: 500 });
  }
}
