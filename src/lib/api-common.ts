import { ApiError } from './api-errors';
import { rate } from './db';

export function configuredLimit(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100000) {
    throw new ApiError('Server rate limits are not configured correctly.', 503, 'RATE_LIMIT_CONFIG_INVALID');
  }
  return parsed;
}

export async function enforceRateLimit(key: string, limit: number, seconds: number) {
  if (!await rate(key, limit, seconds)) {
    throw new ApiError('Too many requests. Please wait and try again.', 429, 'RATE_LIMITED', seconds);
  }
}

export async function enforceDualRateLimit(
  action: string,
  visitor: string,
  ip: string,
  visitorLimit: number,
  ipLimit: number,
  windowSeconds: number,
) {
  await enforceRateLimit(`rl:${action}:visitor:${visitor}`, visitorLimit, windowSeconds);
  await enforceRateLimit(`rl:${action}:ip:${ip}`, ipLimit, windowSeconds);
}
