import * as jose from 'jose';

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET not configured');
  return new TextEncoder().encode(secret);
}

export async function createNonce(): Promise<{ nonce: string; signature: string; expiresAt: number }> {
  const timestamp = Date.now();
  const random = crypto.randomUUID();
  const nonce = `${timestamp}:${random}`;

  const signature = await new jose.SignJWT({ nonce })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(Math.floor((timestamp + NONCE_TTL_MS) / 1000))
    .sign(getSecretKey());

  return { nonce, signature, expiresAt: timestamp + NONCE_TTL_MS };
}

export async function verifyNonce(nonce: string, signature: string): Promise<boolean> {
  try {
    const { payload } = await jose.jwtVerify(signature, getSecretKey());
    return payload.nonce === nonce;
  } catch {
    return false;
  }
}
