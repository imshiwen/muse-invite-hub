import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { chmod, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const HOST = '127.0.0.1';
const PORT = 54329;
const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const SAFE_DATABASE_ERRORS = new Set(['NOT_FOUND', 'DUPLICATE', 'CONFLICT', 'LOCKED', 'ZERO_QUOTA', 'INVALID_ACTION']);

type QueryRequest = { text: string; params?: unknown[] };
type LocalDbOptions = { key: string; allowedOrigins?: string[] };

function originList(): string[] {
  const configured = process.env.LOCAL_DB_ALLOWED_ORIGINS;
  if (!configured) return DEFAULT_ORIGINS;
  return configured.split(',').map((origin) => origin.trim()).filter(Boolean);
}

function isAllowedOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
  return origin === undefined || allowedOrigins.includes(origin);
}

function matchesKey(header: string | undefined, expected: string): boolean {
  if (!header?.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(header.slice(7));
  const expectedBytes = Buffer.from(expected);
  return supplied.length === expectedBytes.length && timingSafeEqual(supplied, expectedBytes);
}

function sendJson(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  response.end(JSON.stringify(body));
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '300',
    Vary: 'Origin',
  };
}

export function publicDatabaseError(error: unknown): { code: string; status: number } | null {
  if (!error || typeof error !== 'object') return null;
  const databaseError = error as { code?: unknown; message?: unknown };
  if (databaseError.code === '23505') return { code: 'DUPLICATE', status: 409 };
  if (typeof databaseError.message !== 'string' || !SAFE_DATABASE_ERRORS.has(databaseError.message)) return null;
  const status = databaseError.message === 'NOT_FOUND'
    ? 404
    : databaseError.message === 'INVALID_ACTION'
      ? 400
      : 409;
  return { code: databaseError.message, status };
}

async function readJson(request: IncomingMessage): Promise<QueryRequest> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('BODY_TOO_LARGE'), { statusCode: 413 });
    chunks.push(bytes);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('INVALID_JSON'), { statusCode: 400 });
  }
  if (!parsed || typeof parsed !== 'object' || !('text' in parsed) || typeof parsed.text !== 'string' || !parsed.text.trim()) {
    throw Object.assign(new Error('INVALID_QUERY'), { statusCode: 400 });
  }
  const params = 'params' in parsed ? parsed.params : [];
  if (!Array.isArray(params) || params.length > 100) throw Object.assign(new Error('INVALID_QUERY'), { statusCode: 400 });
  return { text: parsed.text, params };
}

export function createLocalDbServer(db: PGlite, options: LocalDbOptions): Server {
  const allowedOrigins = options.allowedOrigins ?? originList();
  return createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (origin && !isAllowedOrigin(origin, allowedOrigins)) {
      sendJson(response, 403, { error: 'ORIGIN_NOT_ALLOWED' });
      return;
    }

    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'OPTIONS') {
      if (!origin || !allowedOrigins.includes(origin)) {
        sendJson(response, 403, { error: 'ORIGIN_NOT_ALLOWED' });
        return;
      }
      const requestedMethod = request.headers['access-control-request-method'];
      if (requestedMethod !== 'POST') {
        sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' });
        return;
      }
      const headers = corsHeaders(origin);
      if (request.headers['access-control-request-private-network'] === 'true') {
        headers['Access-Control-Allow-Private-Network'] = 'true';
      }
      response.writeHead(204, headers);
      response.end();
      return;
    }

    if (request.method !== 'POST' || request.url !== '/') {
      sendJson(response, 404, { error: 'NOT_FOUND' });
      return;
    }
    if (!matchesKey(request.headers.authorization, options.key)) {
      sendJson(response, 401, { error: 'UNAUTHORIZED' });
      return;
    }

    try {
      const input = await readJson(request);
      const result = await db.query(input.text, input.params);
      const headers = origin ? corsHeaders(origin) : {};
      sendJson(response, 200, { rows: result.rows }, headers);
    } catch (error) {
      const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number(error.statusCode)
        : 400;
      if (statusCode === 413) {
        sendJson(response, 413, { error: 'BODY_TOO_LARGE' });
        return;
      }
      if (statusCode === 400 && error instanceof Error && ['INVALID_JSON', 'INVALID_QUERY'].includes(error.message)) {
        sendJson(response, 400, { error: error.message });
        return;
      }
      const safeError = publicDatabaseError(error);
      if (safeError) {
        sendJson(response, safeError.status, { error: safeError.code }, origin ? corsHeaders(origin) : {});
        return;
      }
      // Do not echo SQL, parameter values, or unknown PGlite errors to a browser.
      sendJson(response, 500, { error: 'DATABASE_ERROR' }, origin ? corsHeaders(origin) : {});
    }
  });
}

async function migrateLocalDb(db: PGlite): Promise<void> {
  const migrationPath = resolve(process.cwd(), 'migrations/001_initial.sql');
  const migration = await readFile(migrationPath, 'utf8');
  // The initial migration is idempotent. Reapply it on each local start so
  // edits to this not-yet-released schema are picked up by the persistent DB.
  await db.exec(migration);
}

async function main(): Promise<void> {
  const key = process.env.LOCAL_DB_KEY;
  if (!key || Buffer.byteLength(key) < 32) throw new Error('LOCAL_DB_KEY must be a locally generated secret of at least 32 bytes.');
  const dataDir = resolve(process.cwd(), '.local/muse-invite-hub-db');
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  await chmod(resolve(process.cwd(), '.local'), 0o700).catch(() => undefined);
  await chmod(dataDir, 0o700).catch(() => undefined);

  const db = new PGlite(dataDir);
  await db.waitReady;
  await migrateLocalDb(db);

  const server = createLocalDbServer(db, { key });
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(PORT, HOST, () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });
  console.log(`Local PGlite HTTP bridge listening on http://${HOST}:${PORT} (persistent data: ${dataDir})`);

  const close = () => {
    server.close(() => void db.close().then(() => process.exit(0)));
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

if (process.argv[1]?.endsWith('local-db.ts')) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Local database startup failed.');
    process.exitCode = 1;
  });
}
