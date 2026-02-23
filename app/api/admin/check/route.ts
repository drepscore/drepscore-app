import { NextRequest, NextResponse } from 'next/server';

/**
 * Check if a given wallet address is an admin wallet.
 * Uses ADMIN_WALLETS env var (comma-separated stake/payment addresses).
 */
export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();
    if (!address || typeof address !== 'string') {
      return NextResponse.json({ isAdmin: false });
    }

    const adminWallets = (process.env.ADMIN_WALLETS || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    const isAdmin = adminWallets.includes(address.toLowerCase());
    return NextResponse.json({ isAdmin });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
