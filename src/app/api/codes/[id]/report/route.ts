import { z } from 'zod';
import { apiJson, errorResponse } from '@/lib/api-errors';
import { configuredLimit, enforceDualRateLimit } from '@/lib/api-common';
import { parseUuid, readJson } from '@/lib/api-validation';
import { action } from '@/lib/db';
import { assertSameOrigin, getActor, getTrustedClientIp, ipHash } from '@/lib/security';

const schema = z.object({ result: z.enum(['success', 'fail']) }).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const codeId = parseUuid(id);
    const body = await readJson(request, schema);
    const clientIp = await getTrustedClientIp(request);
    if (!clientIp) return apiJson({ error: 'The request could not be verified. Please try again later.' }, 503);
    const { actor } = await getActor(request);
    const actorRateKey = actor;
    const addressHash = await ipHash(clientIp);
    await enforceDualRateLimit(
      'feedback', actorRateKey, addressHash,
      configuredLimit('RATE_LIMIT_FEEDBACK_VISITOR_PER_10_MIN', 20),
      configuredLimit('RATE_LIMIT_FEEDBACK_IP_PER_10_MIN', 100),
      600,
    );
    const result = await action('report', { id: codeId, result: body.result, eligible: true }, actor, addressHash);
    return apiJson({ changed: result.changed === true });
  } catch (error) {
    return errorResponse(error);
  }
}
