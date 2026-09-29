import { apiJson, errorResponse } from '@/lib/api-errors';
import { assertSameOrigin, issueVisitorCookie, visitorCookieHeader } from '@/lib/security';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const cookie = await issueVisitorCookie(request);
    return apiJson({ ok: true }, 200, cookie ? { 'Set-Cookie': visitorCookieHeader(cookie, request) } : undefined);
  } catch (error) {
    return errorResponse(error);
  }
}
