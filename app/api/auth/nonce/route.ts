import { NextResponse } from 'next/server';
import { createNonce } from '@/lib/nonce';

export async function GET() {
  const nonceData = await createNonce();
  return NextResponse.json(nonceData);
}
