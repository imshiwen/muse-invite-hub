import { z } from 'zod';
import { apiJson, errorResponse } from '@/lib/api-errors';
import { configuredLimit, enforceDualRateLimit } from '@/lib/api-common';
import { codeValue, managementToken, readJson, remainingValue } from '@/lib/api-validation';
import { action } from '@/lib/db';
import { assertSameOrigin, getActor, getTrustedClientIp, ipHash, tokenHash, verifyTurnstile } from '@/lib/security';

const schema = z.object({
  code: codeValue,
  remaining: remainingValue.optional().default(null),
  manageToken: managementToken,
  idempotencyKey: z.string().uuid(),
  turnstileToken: z.string().max(2048),
  agreed: z.literal(true),
}).strict();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request, schema);
    await verifyTurnstile(body.turnstileToken, request, 'submit');
    const ip = await getTrustedClientIp(request);
    if (!ip) return apiJson({ error: 'The request could not be verified. Please try again later.' }, 503);
    const { actor } = await getActor(request);
    const addressHash = await ipHash(ip);
    await enforceDualRateLimit(
      'submit', actor, addressHash,
      configuredLimit('RATE_LIMIT_SUBMIT_VISITOR_PER_HOUR', 5),
      configuredLimit('RATE_LIMIT_SUBMIT_IP_PER_HOUR', 20),
      3600,
    );
    const manageHash = await tokenHash(body.manageToken);
    const result = await action('submit', {
      code: body.code,
      remaining: body.remaining,
      manage_hash: manageHash,
      idempotency_key: body.idempotencyKey,
    }, actor, addressHash);
    return apiJson({ id: result.id, moderation: result.moderation, replayed: result.replayed === true }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
