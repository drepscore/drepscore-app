import { NextRequest, NextResponse } from 'next/server';
import { getVotingPowerSummary } from '@/lib/data';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const txHash = searchParams.get('txHash');
  const index = searchParams.get('index');
  const proposalType = searchParams.get('type');

  if (!txHash || index == null || !proposalType) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const data = await getVotingPowerSummary(txHash, parseInt(index, 10), proposalType);
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
