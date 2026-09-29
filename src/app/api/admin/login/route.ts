import { z } from 'zod';
import { apiJson, errorResponse } from '@/lib/api-errors';
import { configuredLimit, enforceRateLimit } from '@/lib/api-common';
import { readJson } from '@/lib/api-validation';
import { assertLocalAdminKey, createLocalAdminSession, adminCookieHeader, getTrustedClientIp, ipHash, isSameOriginLoopback } from '@/lib/security';
import { ApiError } from '@/lib/api-errors';

const schema = z.object({ key: z.string().min(1).max(256) }).strict();

export async function POST(request: Request) {
  try {
    if (!isSameOriginLoopback(request)) throw new ApiError('Local admin login is available only on localhost.', 403, 'LOCAL_ONLY');
    const body = await readJson(request, schema);
    const ip = await getTrustedClientIp(request);
    if (!ip) throw new ApiError('The request could not be verified.', 403, 'UNTRUSTED_REQUEST');
    const addressHash = await ipHash(ip);
    await enforceRateLimit(`rl:admin-login:${addressHash}`, configuredLimit('RATE_LIMIT_ADMIN_LOGIN_PER_10_MIN', 5), 600);
    await assertLocalAdminKey(request, body.key);
    const token = await createLocalAdminSession(request);
    return apiJson({ ok: true }, 200, { 'Set-Cookie': adminCookieHeader(token, request) });
  } catch (error) {
    return errorResponse(error);
  }
}
