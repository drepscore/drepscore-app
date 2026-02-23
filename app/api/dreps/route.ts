/**
 * DRep Data API Route
 * Serves full DRep data from Supabase cache with Koios fallback
 * Avoids Next.js 128KB server component prop limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllDReps, getDRepById } from '@/lib/data';

// Force dynamic rendering (no static generation)
export const dynamic = 'force-dynamic';

// Revalidate every 15 minutes (900 seconds)
export const revalidate = 900;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const checkId = searchParams.get('id');

    // Lightweight existence check for DRep ID verification
    if (checkId && searchParams.get('check') === '1') {
      const drep = await getDRepById(checkId);
      return NextResponse.json({ exists: drep !== null });
    }

    const { dreps, allDReps, error, totalAvailable } = await getAllDReps();
    
    return NextResponse.json({
      dreps,
      allDReps,
      error,
      totalAvailable,
    });
  } catch (error) {
    console.error('[API] Error fetching DReps:', error);
    return NextResponse.json(
      { error: 'Failed to fetch DReps' },
      { status: 500 }
    );
  }
}
