/**
 * API Handler Wrapper
 * Wraps v1 route handlers with auth, rate limiting, logging, and error handling.
 * Keeps individual route files thin and focused on data.
 */

import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { resolveApiKeyFromRequest, validateApiKey } from './keys';
import { checkRateLimit, rateLimitHeaders } from './rateLimit';
import { logApiRequest, trackFirstRequest } from './logging';
import { apiError, generateRequestId, normalizeEndpoint } from './response';
import type { ApiKeyRecord } from './keys';

export type ApiTier = 'anonymous' | 'public' | 'pro' | 'business' | 'enterprise';

const TIER_RANK: Record<ApiTier, number> = {
  anonymous: 0,
  public: 1,
  pro: 2,
  business: 3,
  enterprise: 4,
};

export interface ApiContext {
  requestId: string;
  tier: ApiTier;
  key: ApiKeyRecord | null;
  ipHash: string | null;
}

interface HandlerOptions {
  requiredTier?: ApiTier;
  skipRateLimit?: boolean;
}

type RouteHandler = (
  request: NextRequest,
  ctx: ApiContext,
  params?: Record<string, string>
) => Promise<Response>;

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

/**
 * Wrap an API v1 route handler with the full middleware chain.
 */
export function withApiHandler(handler: RouteHandler, options: HandlerOptions = {}) {
  return async (request: NextRequest, routeContext: { params: Promise<Record<string, string>> }) => {
    const startTime = Date.now();
    const requestId = generateRequestId();
    const endpoint = normalizeEndpoint(request.nextUrl.pathname);
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const ipHash = hashIp(ip);
    const userAgent = request.headers.get('user-agent') || null;

    // Resolve params from route context
    const params = routeContext?.params ? await routeContext.params : undefined;

    // --- Auth ---
    let tier: ApiTier = 'anonymous';
    let key: ApiKeyRecord | null = null;

    const rawKey = resolveApiKeyFromRequest(request);
    if (rawKey) {
      const validation = await validateApiKey(rawKey);
      if (!validation.valid) {
        const res = apiError(validation.errorCode!, {}, { requestId });
        logApiRequest({
          tier: 'anonymous', endpoint, method: request.method,
          statusCode: validation.errorCode === 'revoked_api_key' ? 401 : 401,
          ipHash, userAgent, errorCode: validation.errorCode,
        });
        return res;
      }
      key = validation.key!;
      tier = key.tier as ApiTier;
    }

    // --- Tier check ---
    if (options.requiredTier) {
      const required = TIER_RANK[options.requiredTier];
      const actual = TIER_RANK[tier];
      if (actual < required) {
        const res = apiError('tier_insufficient', {
          required_tier: options.requiredTier,
          current_tier: tier,
        }, { requestId });
        logApiRequest({
          keyId: key?.id, keyPrefix: key?.keyPrefix, tier, endpoint,
          method: request.method, statusCode: 403, ipHash, userAgent,
          errorCode: 'tier_insufficient',
        });
        return res;
      }
    }

    // --- Rate limiting ---
    if (!options.skipRateLimit) {
      const rlResult = await checkRateLimit({
        keyId: key?.id,
        ipHash,
        limit: key?.rateLimit,
        window: key?.rateWindow,
      });

      if (!rlResult.allowed) {
        const rlHeaders = rateLimitHeaders(rlResult);
        const res = apiError('rate_limit_exceeded', {
          used: rlResult.used,
          limit: rlResult.limit,
          window: rlResult.window,
          reset_time: new Date(rlResult.resetEpochSeconds * 1000).toISOString(),
        }, { requestId, rateLimitHeaders: rlHeaders });
        logApiRequest({
          keyId: key?.id, keyPrefix: key?.keyPrefix, tier, endpoint,
          method: request.method, statusCode: 429, ipHash, userAgent,
          errorCode: 'rate_limit_exceeded',
        });
        return res;
      }
    }

    // --- Execute handler ---
    const ctx: ApiContext = { requestId, tier, key, ipHash };

    try {
      const response = await handler(request, ctx, params);

      const responseMs = Date.now() - startTime;
      logApiRequest({
        keyId: key?.id, keyPrefix: key?.keyPrefix, tier, endpoint,
        method: request.method, statusCode: response.status,
        responseMs, ipHash, userAgent,
      });

      // Track first request for new keys
      if (key) {
        trackFirstRequest(key.id, key.keyPrefix, tier, endpoint);
      }

      // Inject rate limit headers into successful responses
      if (!options.skipRateLimit && key) {
        const rlResult = await checkRateLimit({
          keyId: key.id,
          limit: key.rateLimit,
          window: key.rateWindow,
        });
        const rlHeaders = rateLimitHeaders(rlResult);
        for (const [k, v] of Object.entries(rlHeaders)) {
          response.headers.set(k, v);
        }
      }

      return response;
    } catch (error: any) {
      const responseMs = Date.now() - startTime;
      console.error(`[API v1] ${endpoint} error:`, error.message);

      logApiRequest({
        keyId: key?.id, keyPrefix: key?.keyPrefix, tier, endpoint,
        method: request.method, statusCode: 500, responseMs,
        ipHash, userAgent, errorCode: 'internal_error',
      });

      return apiError('internal_error', {}, { requestId });
    }
  };
}
