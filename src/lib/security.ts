import { createRemoteJWKSet, jwtVerify } from 'jose';
import { headers } from 'next/headers';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isLocal, isProductionSite, SITE_URL } from './config';
import { ApiError } from './api-errors';
import { query } from './db';

const VISITOR_COOKIE = 'muse_visitor';
const ADMIN_COOKIE = 'muse_admin_session';
const VISITOR_MAX_AGE = 90 * 24 * 60 * 60;
const ADMIN_MAX_AGE = 8 * 60 * 60;
const encoder = new TextEncoder();
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function appSecret() {
  const secret = process.env.APP_HMAC_KEY;
  if (!secret || encoder.encode(secret).byteLength < 32) {
    throw new ApiError('Server security is not configured.', 503, 'SECURITY_NOT_CONFIGURED');
  }
  return secret;
}

async function hmacHex(purposeAndValue: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(appSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(purposeAndValue)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function tokenHash(token: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(token)) throw new ApiError('This management link is invalid or expired.', 404, 'INVALID_MANAGEMENT_LINK');
  return hmacHex(`manage:${token}`);
}

export async function actorHash(value: string) {
  return hmacHex(`actor:${value}`);
}

export async function ipHash(value: string) {
  return hmacHex(`ip:${value}`);
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;
  for (const item of cookie.split(';')) {
    const [key, ...parts] = item.trim().split('=');
    if (key === name) return parts.join('=') || null;
  }
  return null;
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function randomBase64Url(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function getVisitorId(request: Request): Promise<string | null> {
  const value = cookieValue(request, VISITOR_COOKIE);
  const parts = value?.split('.');
  if (parts?.length !== 3 || parts[0] !== 'v1' || !/^[A-Za-z0-9_-]{43}$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2])) return null;
  const expected = await hmacHex(`visitor-cookie:${parts[1]}`);
  return constantTimeEqual(expected, parts[2]) ? parts[1] : null;
}

export async function issueVisitorCookie(request: Request) {
  const current = await getVisitorId(request);
  if (current) return null;
  const nonce = randomBase64Url();
  const signature = await hmacHex(`visitor-cookie:${nonce}`);
  return `v1.${nonce}.${signature}`;
}

export function visitorCookieHeader(value: string, request: Request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${VISITOR_COOKIE}=${value}; Path=/; Max-Age=${VISITOR_MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}

export async function getActor(request: Request) {
  const visitor = await getVisitorId(request);
  if (visitor) return { actor: await actorHash(`visitor:${visitor}`), eligible: true };
  const ip = await getTrustedClientIp(request);
  if (ip) return { actor: await actorHash(`ip:${ip}`), eligible: true };
  return { actor: await actorHash(`untracked:${randomBase64Url()}`), eligible: false };
}

function requestHost(request: Request) {
  const host = request.headers.get('host');
  try {
    return host ? new URL(`http://${host}`).hostname.toLowerCase() : new URL(request.url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function isLoopbackRequest(request: Request) {
  const host = requestHost(request);
  const urlHost = new URL(request.url).hostname.toLowerCase();
  return ['localhost', '127.0.0.1', '::1'].includes(host) && ['localhost', '127.0.0.1', '::1'].includes(urlHost);
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) throw new ApiError('This request could not be verified. Refresh the page and try again.', 403, 'ORIGIN_REQUIRED');
  let originUrl: URL;
  let requestOrigin: string;
  try {
    originUrl = new URL(origin);
    const currentUrl = new URL(request.url);
    const hostHeader = request.headers.get('host');
    requestOrigin = hostHeader ? new URL(`${currentUrl.protocol}//${hostHeader}`).origin : currentUrl.origin;
  } catch {
    throw new ApiError('This request could not be verified. Refresh the page and try again.', 403, 'ORIGIN_REJECTED');
  }

  const expectedOrigin = isLocal() ? requestOrigin : isProductionSite() ? new URL(SITE_URL).origin : requestOrigin;
  const localHostsMatch = !isLocal() || (
    ['localhost', '127.0.0.1', '::1'].includes(originUrl.hostname.toLowerCase()) &&
    originUrl.protocol === new URL(request.url).protocol
  );
  if (!localHostsMatch || originUrl.origin !== expectedOrigin || requestOrigin !== expectedOrigin) {
    throw new ApiError('This request could not be verified. Refresh the page and try again.', 403, 'ORIGIN_REJECTED');
  }
}

type CloudflareContextLike = { cf?: Record<string, unknown> };
async function cloudflareContext(): Promise<CloudflareContextLike | null> {
  try {
    return await getCloudflareContext({ async: true }) as unknown as CloudflareContextLike;
  } catch {
    return null;
  }
}

function validCountry(value: unknown) {
  if (typeof value !== 'string') return null;
  const country = value.toUpperCase();
  return /^[A-Z]{2}$/.test(country) && country !== 'XX' ? country : null;
}

export async function getTrustedCountry() {
  if (isLocal()) return validCountry(process.env.LOCAL_TEST_COUNTRY);
  if (!isProductionSite()) return null;
  const context = await cloudflareContext();
  return context?.cf ? validCountry(context.cf.country) : null;
}

function validIpHeader(value: string | null) {
  if (!value || value.length > 45 || !/^[0-9a-fA-F:.]+$/.test(value)) return null;
  return value;
}

export async function getTrustedClientIp(request: Request): Promise<string | null> {
  if (isLocal()) return isLoopbackRequest(request) ? '127.0.0.1' : null;
  if (!isProductionSite()) return null;

  // Only accept Cloudflare's edge-owned header after the OpenNext request context
  // confirms this request is executing in a Cloudflare Worker. Node headers alone
  // are client controlled and never provide an IP fallback here.
  const context = await cloudflareContext();
  if (!context?.cf) return null;
  return validIpHeader(request.headers.get('cf-connecting-ip'));
}

export async function requireTrustedClient(request: Request) {
  const ip = await getTrustedClientIp(request);
  if (!ip) throw new ApiError('The request could not be verified. Please try again later.', 503, 'TRUSTED_NETWORK_UNAVAILABLE');
  return { ip, ipDigest: await ipHash(ip) };
}

export async function createLocalAdminSession(request: Request) {
  if (!isLocal() || !isLoopbackRequest(request)) throw new ApiError('Local admin login is available only on localhost.', 403, 'LOCAL_ONLY');
  const token = randomBase64Url();
  const sessionHash = await hmacHex(`admin-session:${token}`);
  await query('INSERT INTO admin_sessions(session_hash, actor, expires_at) VALUES($1,$2,now()+make_interval(secs=>$3))', [sessionHash, process.env.ADMIN_EMAIL || 'local-admin', ADMIN_MAX_AGE]);
  return token;
}

export async function revokeLocalAdminSession(request: Request) {
  const token = cookieValue(request, ADMIN_COOKIE);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
  const sessionHash = await hmacHex(`admin-session:${token}`);
  await query('UPDATE admin_sessions SET revoked_at=now() WHERE session_hash=$1 AND revoked_at IS NULL', [sessionHash]);
}

export function adminCookieHeader(token: string, request: Request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${ADMIN_COOKIE}=${token}; Path=/; Max-Age=${ADMIN_MAX_AGE}; HttpOnly; SameSite=Strict${secure}`;
}

export function clearedAdminCookieHeader(request: Request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${ADMIN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure}`;
}

export type AdminIdentity = { email: string; source: 'local-session' | 'cloudflare-access' };

async function requestFromCurrentHeaders() {
  const current = await headers();
  const host = current.get('host') || 'museinvitehub.org';
  const protocol = isLocal() ? 'http' : 'https';
  return new Request(`${protocol}://${host}/admin`, { headers: current });
}

function jwksForIssuer(issuer: string) {
  const existing = jwksCache.get(issuer);
  if (existing) return existing;
  const url = new URL(`${issuer.replace(/\/$/, '')}/cdn-cgi/access/certs`);
  const jwks = createRemoteJWKSet(url);
  jwksCache.set(issuer, jwks);
  return jwks;
}

async function cloudflareAdminIdentity(request: Request): Promise<AdminIdentity | null> {
  const issuer = process.env.CF_ACCESS_ISSUER?.replace(/\/$/, '');
  const audience = process.env.CF_ACCESS_AUD;
  const allowedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const assertion = request.headers.get('cf-access-jwt-assertion');
  const sourceEmail = request.headers.get('cf-access-authenticated-user-email')?.trim().toLowerCase();
  if (!issuer || !audience || !allowedEmail || !assertion) return null;

  const context = await cloudflareContext();
  if (!context?.cf) return null;
  try {
    const { payload } = await jwtVerify(assertion, jwksForIssuer(issuer), { issuer, audience, algorithms: ['RS256'] });
    const now = Date.now() / 1000;
    if (typeof payload.exp !== 'number' || payload.exp <= now || typeof payload.iat !== 'number' || payload.iat > now + 60) return null;
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    if (email !== allowedEmail || (sourceEmail && sourceEmail !== email)) return null;
    return { email, source: 'cloudflare-access' };
  } catch {
    return null;
  }
}

export async function getAdminIdentity(request?: Request): Promise<AdminIdentity | null> {
  const current = request || await requestFromCurrentHeaders();
  if (isLocal()) {
    if (!isLoopbackRequest(current)) return null;
    const token = cookieValue(current, ADMIN_COOKIE);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    try {
      const sessionHash = await hmacHex(`admin-session:${token}`);
      const rows = await query<{ actor: string }>('SELECT actor FROM admin_sessions WHERE session_hash=$1 AND revoked_at IS NULL AND expires_at>now()', [sessionHash]);
      return rows[0] ? { email: rows[0].actor, source: 'local-session' } : null;
    } catch {
      return null;
    }
  }
  if (!isProductionSite()) return null;
  return cloudflareAdminIdentity(current);
}

export async function isAdminRequest(request?: Request) {
  return Boolean(await getAdminIdentity(request));
}

export async function requireAdmin(request: Request) {
  const identity = await getAdminIdentity(request);
  if (!identity) throw new ApiError('Administrator access is required.', 401, 'ADMIN_REQUIRED');
  return identity;
}

export async function assertLocalAdminKey(request: Request, key: string) {
  if (!isLocal() || !isLoopbackRequest(request)) throw new ApiError('Local admin login is available only on localhost.', 403, 'LOCAL_ONLY');
  const expected = process.env.LOCAL_ADMIN_KEY;
  if (!expected || expected.length < 24) throw new ApiError('Local admin credentials are not configured.', 503, 'ADMIN_LOGIN_NOT_CONFIGURED');
  if (!constantTimeEqual(key, expected)) throw new ApiError('The admin key is incorrect.', 401, 'INVALID_ADMIN_KEY');
}

export function constantTimeSecretMatch(value: string, expected: string) {
  return constantTimeEqual(value, expected);
}

export async function verifyTurnstile(token: string, request: Request, action: 'submit' | 'abuse') {
  if (!token && isLocal() && process.env.LOCAL_TURNSTILE_BYPASS === 'true') return;
  if (!token) throw new ApiError('Please complete the security check and try again.', 400, 'TURNSTILE_REQUIRED');
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const hostname = process.env.TURNSTILE_HOSTNAME || (isLocal() ? requestHost(request) : '');
  if (!secret || !hostname) throw new ApiError('Submission verification is not configured yet.', 503, 'TURNSTILE_NOT_CONFIGURED');

  let response: Response;
  try {
    const form = new URLSearchParams({ secret, response: token });
    response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Submission verification is temporarily unavailable. Please try again.', 503, 'TURNSTILE_UNAVAILABLE');
  }
  if (!response.ok) throw new ApiError('Submission verification is temporarily unavailable. Please try again.', 503, 'TURNSTILE_UNAVAILABLE');

  const result = await response.json() as { success?: boolean; hostname?: string; action?: string };
  if (!result.success || result.hostname?.toLowerCase() !== hostname.toLowerCase() || result.action !== action) {
    throw new ApiError('Please complete the security check and try again.', 400, 'TURNSTILE_REJECTED');
  }
}

export function expectedAdminEmail() {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() || null;
}

export function isSameOriginLoopback(request: Request) {
  if (!isLoopbackRequest(request)) return false;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const hostHeader = request.headers.get('host');
    const requestOrigin = hostHeader ? new URL(`${requestUrl.protocol}//${hostHeader}`).origin : requestUrl.origin;
    return originUrl.protocol === requestUrl.protocol &&
      ['localhost', '127.0.0.1', '::1'].includes(originUrl.hostname.toLowerCase()) &&
      originUrl.origin === requestOrigin;
  } catch {
    return false;
  }
}
