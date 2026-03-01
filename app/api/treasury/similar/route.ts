import { NextRequest, NextResponse } from 'next/server';
import { findSimilarProposals } from '@/lib/treasury';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title') || '';
    const amount = parseFloat(searchParams.get('amount') || '0');
    const tier = searchParams.get('tier') || null;
    const excludeTx = searchParams.get('exclude') || undefined;

    const similar = await findSimilarProposals(title, amount, tier, excludeTx);

    return NextResponse.json({ similar });
  } catch (error) {
    console.error('[treasury/similar] Error:', error);
    return NextResponse.json({ error: 'Failed to find similar proposals' }, { status: 500 });
  }
}
