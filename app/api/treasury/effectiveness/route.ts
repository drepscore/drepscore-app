import { NextResponse } from 'next/server';
import { getSpendingEffectiveness } from '@/lib/treasury';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const effectiveness = await getSpendingEffectiveness();

    return NextResponse.json(effectiveness, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    logger.error('Error', { context: 'treasury/effectiveness', error: error });
    return NextResponse.json({ error: 'Failed to fetch spending effectiveness' }, { status: 500 });
  }
}
