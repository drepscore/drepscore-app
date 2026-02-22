/**
 * DRep Data API Route
 * Serves full DRep data from Supabase cache with Koios fallback
 * Avoids Next.js 128KB server component prop limit
 */

import { NextResponse } from 'next/server';
import { getAllDReps } from '@/lib/data';

// Force dynamic rendering (no static generation)
export const dynamic = 'force-dynamic';

// Revalidate every 15 minutes (900 seconds)
export const revalidate = 900;

export async function GET() {
  try {
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
