import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { createRequest, parseJson } from '../helpers';

const insertSenecaOutputMock = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();
const mockGetRedis = vi.fn();
const mockLimit = vi.fn();

vi.mock('@/lib/redis', () => ({
  getRedis: () => mockGetRedis(),
}));

vi.mock('@upstash/ratelimit', () => {
  const Ratelimit = vi.fn().mockImplementation(() => ({
    limit: (...args: unknown[]) => mockLimit(...args),
  }));
  Object.assign(Ratelimit, { slidingWindow: vi.fn().mockReturnValue('window') });
  return { Ratelimit };
});

vi.mock('@/lib/logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

// auth: 'optional' — an unauthenticated request must still reach the handler.
vi.mock('@/lib/supabaseAuth', () => ({
  requireAuth: vi.fn(async () => NextResponse.json({ error: 'unauthorized' }, { status: 401 })),
}));

vi.mock('@/lib/seneca/outputLog', () => ({
  insertSenecaOutput: (...args: unknown[]) => insertSenecaOutputMock(...args),
}));

const validBody = {
  intent: 'observational',
  outputText: 'A quiet briefing for the citizen.',
  source: 'idle_briefing',
};

describe('POST /api/seneca/output-log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRedis.mockReturnValue({});
    mockLimit.mockResolvedValue({ success: true, remaining: 59 });
  });

  it('returns 200 with the row id when the output is persisted', async () => {
    insertSenecaOutputMock.mockResolvedValue({ ok: true, id: 'row-123' });
    const { POST } = await import('@/app/api/seneca/output-log/route');

    const res = await POST(
      createRequest('/api/seneca/output-log', { method: 'POST', body: validBody }),
    );

    expect(res.status).toBe(200);
    await expect(parseJson(res)).resolves.toEqual({ ok: true, id: 'row-123' });
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it('degrades to 202 (not 500) and logs the cause when persistence fails', async () => {
    insertSenecaOutputMock.mockResolvedValue({
      ok: false,
      error: 'relation "public.seneca_outputs" does not exist',
    });
    const { POST } = await import('@/app/api/seneca/output-log/route');

    const res = await POST(
      createRequest('/api/seneca/output-log', { method: 'POST', body: validBody }),
    );

    expect(res.status).toBe(202);
    await expect(parseJson(res)).resolves.toEqual({ ok: false, persisted: false });
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Seneca output log not persisted',
      expect.objectContaining({
        source: 'idle_briefing',
        error: 'relation "public.seneca_outputs" does not exist',
      }),
    );
  });
});
