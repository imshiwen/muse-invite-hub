import { z } from 'zod';
import { apiJson, errorResponse } from '@/lib/api-errors';
import { configuredLimit, enforceDualRateLimit } from '@/lib/api-common';
import { parseUuid, readJson } from '@/lib/api-validation';
import { action } from '@/lib/db';
import { actorHash, assertSameOrigin, getActor, getTrustedClientIp, ipHash, verifyTurnstile } from '@/lib/security';

const schema = z.object({
  reason: z.enum(['selling', 'misleading', 'other']),
  note: z.string().trim().max(500).default(''),
  turnstileToken: z.string().max(2048),
}).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const codeId = parseUuid(id);
    const body = await readJson(request, schema);
    await verifyTurnstile(body.turnstileToken, request, 'abuse');
    const ip = await getTrustedClientIp(request);
    if (!ip) return apiJson({ error: 'The request could not be verified. Please try again later.' }, 503);
    const visitor = await getActor(request);
    const addressHash = await ipHash(ip);
    const abuseActor = visitor.eligible ? visitor.actor : await actorHash(`ip:${ip}`);
    await enforceDualRateLimit(
      'abuse', abuseActor, addressHash,
      configuredLimit('RATE_LIMIT_ABUSE_VISITOR_PER_HOUR', 5),
      configuredLimit('RATE_LIMIT_ABUSE_IP_PER_HOUR', 20),
      3600,
    );
    const result = await action('abuse', { id: codeId, reason: body.reason, note: body.note }, abuseActor, addressHash);
    return apiJson({ changed: result.changed === true });
  } catch (error) {
    return errorResponse(error);
  }
}
