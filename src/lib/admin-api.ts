import { z } from 'zod';
import { apiJson, errorResponse } from './api-errors';
import { parseUuid, readJson } from './api-validation';
import { action } from './db';
import { assertSameOrigin, requireAdmin } from './security';

const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'retire', 'restore', 'resolve']),
  id: z.string().uuid(),
  reason: z.string().trim().max(500).optional().default(''),
}).strict();

export async function handleAdminAction(request: Request) {
  try {
    assertSameOrigin(request);
    const identity = await requireAdmin(request);
    const body = await readJson(request, actionSchema);
    if (['reject', 'retire', 'restore'].includes(body.action) && body.reason.length < 3) {
      return apiJson({ error: 'A short reason is required for this action.' }, 400);
    }
    const result = await action(`admin_${body.action}`, { id: parseUuid(body.id), reason: body.reason }, identity.email, null);
    return apiJson({ ok: result.ok === true });
  } catch (error) {
    return errorResponse(error);
  }
}
