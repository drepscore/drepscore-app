import { NextRequest, NextResponse } from 'next/server';
import { getScoreHistory } from '@/lib/data';

export async function GET(request: NextRequest) {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) {
    return NextResponse.json([], { status: 400 });
  }

  const history = await getScoreHistory(drepId);
  return NextResponse.json(history);
}
