import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequest, parseJson } from '../helpers';

vi.mock('@/lib/nonce', () => ({
  createNonce: vi.fn().mockResolvedValue({
    nonce: 'Sign in to DRepScore\nTime: Jan 1, 2025\nSession: abc123',
    signature: 'signed.jwt.token',
    expiresAt: Date.now() + 300_000,
  }),
  verifyNonce: vi.fn(),
}));

vi.mock('@meshsdk/core', () => ({
  checkSignature: vi.fn(),
}));

vi.mock('@/lib/supabaseAuth', () => ({
  createSessionToken: vi.fn().mockResolvedValue('session.jwt.token'),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

import { GET as getNonce } from '@/app/api/auth/nonce/route';
import { POST as postWallet } from '@/app/api/auth/wallet/route';
import { verifyNonce } from '@/lib/nonce';
import { checkSignature } from '@meshsdk/core';

describe('GET /api/auth/nonce', () => {
  it('returns a nonce with signature and expiry', async () => {
    const res = await getNonce();
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.nonce).toContain('DRepScore');
    expect(body.signature).toBeTruthy();
    expect(body.expiresAt).toBeGreaterThan(Date.now());
  });
});

describe('POST /api/auth/wallet', () => {
  const validBody = {
    address: 'addr_test1qz...',
    nonce: 'Sign in to DRepScore\nTime: Jan 1, 2025\nSession: abc123',
    nonceSignature: 'signed.jwt.token',
    signature: 'wallet_sig_hex',
    key: 'wallet_key_hex',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when required fields are missing', async () => {
    const req = createRequest('/api/auth/wallet', {
      method: 'POST',
      body: { address: 'addr_test1qz...' },
    });
    const res = await postWallet(req);
    expect(res.status).toBe(400);
  });

  it('returns 401 when nonce verification fails', async () => {
    vi.mocked(verifyNonce).mockResolvedValue(false);

    const req = createRequest('/api/auth/wallet', { method: 'POST', body: validBody });
    const res = await postWallet(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when signature is invalid', async () => {
    vi.mocked(verifyNonce).mockResolvedValue(true);
    vi.mocked(checkSignature).mockResolvedValue(false);

    const req = createRequest('/api/auth/wallet', { method: 'POST', body: validBody });
    const res = await postWallet(req);
    expect(res.status).toBe(401);
  });

  it('returns session token on valid auth', async () => {
    vi.mocked(verifyNonce).mockResolvedValue(true);
    vi.mocked(checkSignature).mockResolvedValue(true);

    const req = createRequest('/api/auth/wallet', { method: 'POST', body: validBody });
    const res = await postWallet(req);
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.sessionToken).toBe('session.jwt.token');
    expect(body.address).toBe('addr_test1qz...');
  });
});
