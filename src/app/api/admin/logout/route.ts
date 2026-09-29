import { apiJson, errorResponse } from '@/lib/api-errors';
import { assertSameOrigin, clearedAdminCookieHeader, isLoopbackRequest, revokeLocalAdminSession } from '@/lib/security';
import { ApiError } from '@/lib/api-errors';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!isLoopbackRequest(request)) throw new ApiError('This logout endpoint is for local admin sessions.', 403, 'LOCAL_ONLY');
    await revokeLocalAdminSession(request);
    return apiJson({ ok: true }, 200, { 'Set-Cookie': clearedAdminCookieHeader(request) });
  } catch (error) {
    return errorResponse(error);
  }
}
