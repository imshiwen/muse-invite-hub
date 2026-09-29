import { z } from 'zod';
import { apiJson, errorResponse } from '@/lib/api-errors';
import { parseUuid, readJson } from '@/lib/api-validation';
import { action } from '@/lib/db';
import { assertSameOrigin, getActor, getTrustedClientIp, ipHash } from '@/lib/security';

const emptyBody = z.object({}).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const codeId = parseUuid(id);
    if (request.body) await readJson(request, emptyBody);
    const { actor, eligible } = await getActor(request);
    const ip = await getTrustedClientIp(request);
    if (!eligible) return apiJson({ counted: false });
    const result = await action('copy', { id: codeId }, actor, ip ? await ipHash(ip) : null);
    return apiJson({ counted: result.counted === true });
  } catch (error) {
    return errorResponse(error);
  }
}
