import { z } from 'zod';
import { apiJson, errorResponse, ApiError } from '@/lib/api-errors';
import { configuredLimit, enforceDualRateLimit } from '@/lib/api-common';
import { codeValue, managementToken, parseUuid, readJson, remainingValue } from '@/lib/api-validation';
import { action } from '@/lib/db';
import { getManaged } from '@/lib/codes';
import { actorHash, assertSameOrigin, getTrustedClientIp, ipHash, tokenHash, verifyTurnstile } from '@/lib/security';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('quota'), id: z.string().uuid(), remaining: remainingValue }),
  z.object({ action: z.literal('pause'), id: z.string().uuid() }),
  z.object({ action: z.literal('resume'), id: z.string().uuid() }),
  z.object({ action: z.literal('replace'), id: z.string().uuid(), code: codeValue, agreed: z.literal(true), turnstileToken: z.string().max(2048) }),
  z.object({ action: z.literal('rotate_token'), newToken: managementToken, idempotencyKey: z.string().uuid() }),
]);

export async function GET(_request: Request, context: { params: Promise<{ manageToken: string }> }) {
  try {
    const { manageToken } = await context.params;
    const hash = await tokenHash(manageToken);
    const codes = await getManaged(hash);
    if (!codes.length) throw new ApiError('This management link is invalid or expired.', 404, 'INVALID_MANAGEMENT_LINK');
    return apiJson({ codes });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ manageToken: string }> }) {
  try {
    assertSameOrigin(request);
    const { manageToken } = await context.params;
    const manageHash = await tokenHash(manageToken);
    const body = await readJson(request, schema);
    const ip = await getTrustedClientIp(request);
    if (!ip) return apiJson({ error: 'The request could not be verified. Please try again later.' }, 503);
    const actor = await actorHash(`manage:${manageHash}`);
    const addressHash = await ipHash(ip);

    if (body.action === 'replace') {
      await verifyTurnstile(body.turnstileToken, request, 'submit');
      await enforceDualRateLimit(
        'submit', actor, addressHash,
        configuredLimit('RATE_LIMIT_SUBMIT_VISITOR_PER_HOUR', 5),
        configuredLimit('RATE_LIMIT_SUBMIT_IP_PER_HOUR', 20),
        3600,
      );
      const result = await action('manage_replace', { manage_hash: manageHash, id: parseUuid(body.id), code: body.code }, actor, addressHash);
      return apiJson({ ok: true, id: result.id, moderation: 'pending' });
    }

    if (body.action === 'rotate_token') {
      const result = await action('manage_rotate', {
        manage_hash: manageHash,
        new_hash: await tokenHash(body.newToken),
        idempotency_key: body.idempotencyKey,
      }, actor, addressHash);
      return apiJson({ ok: result.ok === true });
    }

    const actionName = body.action === 'quota'
      ? 'manage_quota'
      : body.action === 'pause'
        ? 'manage_pause'
        : 'manage_resume';
    const result = await action(actionName, {
      manage_hash: manageHash,
      id: parseUuid(body.id),
      ...(body.action === 'quota' ? { remaining: body.remaining } : {}),
    }, actor, addressHash);
    return apiJson({ ok: result.ok === true, id: result.id });
  } catch (error) {
    return errorResponse(error);
  }
}
