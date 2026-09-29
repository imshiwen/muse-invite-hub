import { apiJson, errorResponse, ApiError } from '@/lib/api-errors';
import { query } from '@/lib/db';
import { constantTimeSecretMatch } from '@/lib/security';

export async function POST(request: Request) {
  try {
    const expected = process.env.MAINTENANCE_SECRET;
    if (!expected || expected.length < 32) throw new ApiError('This endpoint is not enabled.', 404, 'NOT_FOUND');
    const authorization = request.headers.get('authorization') || '';
    const provided = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!constantTimeSecretMatch(provided, expected)) throw new ApiError('This endpoint is not enabled.', 404, 'NOT_FOUND');
    await query('SELECT hub_cleanup()');
    return apiJson({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
