import { NextRequest, NextResponse } from 'next/server';

const KOIOS_BASE_URL = process.env.NEXT_PUBLIC_KOIOS_BASE_URL || 'https://api.koios.rest/api/v1';
const KOIOS_API_KEY = process.env.KOIOS_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { stakeAddress } = await request.json();

    if (!stakeAddress || typeof stakeAddress !== 'string') {
      return NextResponse.json({ error: 'stakeAddress required' }, { status: 400 });
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(KOIOS_API_KEY && { Authorization: `Bearer ${KOIOS_API_KEY}` }),
    };

    const res = await fetch(`${KOIOS_BASE_URL}/account_info`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ _stake_addresses: [stakeAddress] }),
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ drepId: null });
    }

    const data = await res.json();
    const account = Array.isArray(data) ? data[0] : null;
    const drepId = account?.vote_delegation || account?.delegated_drep || null;

    return NextResponse.json({ drepId });
  } catch {
    return NextResponse.json({ drepId: null });
  }
}
