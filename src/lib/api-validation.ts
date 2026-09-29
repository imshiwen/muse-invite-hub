import { z } from 'zod';
import { ApiError } from './api-errors';

export const UUID = z.string().uuid();
export const managementToken = z.string().min(43).max(128).regex(/^[A-Za-z0-9_-]+$/);
export const codeValue = z.string().trim().min(1).max(64).refine(
  (value) => !/[\u0000-\u001f\u007f-\u009f<>]/u.test(value) && !/(?:https?:\/\/|www\.)/iu.test(value) && !value.includes('://'),
  'Enter a code without a URL, markup, or control characters.',
);
export const remainingValue = z.number().int().min(0).max(100000).nullable();

export async function readJson<T>(request: Request, schema: z.ZodType<T>, maximumBytes = 16 * 1024): Promise<T> {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maximumBytes) throw new ApiError('The request is too large.', 413, 'BODY_TOO_LARGE');
  if (!request.body) throw new ApiError('A JSON request body is required.', 400, 'INVALID_BODY');

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new ApiError('The request is too large.', 413, 'BODY_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  let payload: unknown;
  try {
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('The request body must be valid JSON.', 400, 'INVALID_JSON');
  }

  const result = schema.safeParse(payload);
  if (!result.success) throw new ApiError('Please check the submitted fields and try again.', 400, 'INVALID_FIELDS');
  return result.data;
}

export function parseUuid(value: string) {
  const result = UUID.safeParse(value);
  if (!result.success) throw new ApiError('This item was not found.', 404, 'NOT_FOUND');
  return result.data;
}
