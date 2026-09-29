import { apiJson, errorResponse } from '@/lib/api-errors';
import { getPublicCode } from '@/lib/codes';
import { parseUuid } from '@/lib/api-validation';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const code = await getPublicCode(parseUuid(id));
    if (!code) return apiJson({ error: 'This code is not available.' }, 404);
    return apiJson({ code });
  } catch (error) {
    return errorResponse(error);
  }
}
