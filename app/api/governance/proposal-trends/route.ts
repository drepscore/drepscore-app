import { NextResponse } from 'next/server';
import { detectProposalTrends } from '@/lib/proposalTrends';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET() {
  try {
    const trends = await detectProposalTrends();
    return NextResponse.json(trends);
  } catch (err) {
    logger.error('Error', { context: 'proposaltrends', error: err });
    return NextResponse.json({ trends: [], epochRange: { start: 0, end: 0 }, totalProposals: 0 });
  }
}
