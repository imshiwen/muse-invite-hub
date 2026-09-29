import { NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code?: string,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const apiHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

export function apiJson(data: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(data, {
    status,
    headers: { ...apiHeaders, ...Object.fromEntries(new Headers(headers).entries()) },
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    const headers = error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : undefined;
    return apiJson({ error: error.message, ...(error.code ? { code: error.code } : {}) }, error.status, headers);
  }

  const message = error instanceof Error ? error.message : '';
  if (message.includes('INVALID_CURSOR')) return apiJson({ error: 'That page cursor is invalid. Refresh and try again.' }, 400);
  if (message.includes('DUPLICATE') || message.includes('23505') || message.toLowerCase().includes('unique constraint')) {
    return apiJson({ error: 'That code is already listed.' }, 409, { 'Cache-Control': 'private, no-store, max-age=0' });
  }
  if (message.includes('CONFLICT')) return apiJson({ error: 'This request conflicts with an existing submission.' }, 409);
  if (message.includes('ZERO_QUOTA')) return apiJson({ error: 'A code with zero reported remaining uses cannot be resumed.' }, 409);
  if (message.includes('LOCKED')) return apiJson({ error: 'This submission cannot be changed in its current state.' }, 409);
  if (message.includes('NOT_FOUND')) return apiJson({ error: 'This item was not found or is no longer available.' }, 404);
  if (message.includes('INVALID_ACTION')) return apiJson({ error: 'That action is not supported.' }, 400);

  // Database and platform errors may contain submitted values. Never return them to clients.
  return apiJson({ error: 'The service could not complete this request. Please try again.' }, 500);
}
