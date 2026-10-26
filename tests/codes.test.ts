import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { getCodes, initialCodes, getCodesWithCache, type PublicCodeCache } from '../src/lib/codes';

const localDbKey = 'codes-test-key-with-at-least-32-bytes-long';
let db: PGlite;
let previousFetch: typeof fetch;
let previousAppEnv: string | undefined;
let previousLocalDbUrl: string | undefined;
let previousLocalDbKey: string | undefined;
let databaseAvailable = true;
let queries = 0;

type FixtureCode = {
  id: string;
  code: string;
};

async function addCode(
  moderation: 'approved' | 'needs_review' | 'pending' | 'rejected' = 'approved',
  options: { remaining?: number | null; successful?: boolean; failures?: number } = {},
): Promise<FixtureCode> {
  const id = randomUUID();
  const submissionId = randomUUID();
  const code = `CODE-${id.slice(0, 8)}`;
  await db.query(
    `INSERT INTO submissions(id, manage_hash, submit_idempotency_key, actor_hash)
     VALUES ($1, $2, $3, $4)`,
    [submissionId, `manage-${id}`, randomUUID(), `owner-${id}`],
  );
  await db.query(
    `INSERT INTO codes(id, submission_id, code, code_key, moderation, remaining, source)
     VALUES ($1, $2, $3, $3, $4, $5, 'community')`,
    [id, submissionId, code, moderation, options.remaining ?? null],
  );

  if (options.successful) {
    await db.query(
      `INSERT INTO feedback(code_id, actor_hash, result, eligible_for_status)
       VALUES ($1, $2, 'success', true)`,
      [id, `success-${id}`],
    );
  }
  for (let i = 0; i < (options.failures ?? 0); i += 1) {
    await db.query(
      `INSERT INTO feedback(code_id, actor_hash, result, ip_hash, eligible_for_status)
       VALUES ($1, $2, 'fail', $3, true)`,
      [id, `failure-${id}-${i}`, `ip-${id}-${i}`],
    );
  }

  return { id, code };
}

before(async () => {
  previousAppEnv = process.env.APP_ENV;
  previousLocalDbUrl = process.env.LOCAL_DB_URL;
  previousLocalDbKey = process.env.LOCAL_DB_KEY;
  previousFetch = globalThis.fetch;
  process.env.APP_ENV = 'local';
  process.env.LOCAL_DB_URL = 'http://127.0.0.1:54329';
  process.env.LOCAL_DB_KEY = localDbKey;

  db = new PGlite();
  await db.waitReady;
  await db.exec(await readFile(resolve(process.cwd(), 'migrations/001_initial.sql'), 'utf8'));
  globalThis.fetch = async (_input, init) => {
    queries++;
    if (!databaseAvailable) throw new Error('DATABASE_UNAVAILABLE');
    const request = JSON.parse(String(init?.body)) as { text: string; params: unknown[] };
    const result = await db.query(request.text, request.params);
    return Response.json({ rows: result.rows });
  };
});

after(async () => {
  await db.close();
  globalThis.fetch = previousFetch;
  if (previousAppEnv === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = previousAppEnv;
  if (previousLocalDbUrl === undefined) delete process.env.LOCAL_DB_URL;
  else process.env.LOCAL_DB_URL = previousLocalDbUrl;
  if (previousLocalDbKey === undefined) delete process.env.LOCAL_DB_KEY;
  else process.env.LOCAL_DB_KEY = previousLocalDbKey;
});

test('public code totals match filters across pages and out-of-range cursors', async () => {
  const mainCodes: FixtureCode[] = [];
  for (let i = 0; i < 10; i += 1) mainCodes.push(await addCode());
  const activeCode = await addCode('needs_review', { successful: true });
  mainCodes.push(activeCode);

  const hiddenPending = await addCode('pending', { successful: true });
  const hiddenRejected = await addCode('rejected');
  const hiddenRetired = await addCode('approved', { remaining: 0 });

  const issueCodes = [
    await addCode('approved', { failures: 3 }),
    await addCode('needs_review', { failures: 3 }),
  ];
  await addCode('pending', { failures: 3 });
  await addCode('rejected', { failures: 3 });

  const firstPage = await getCodes('main', 8);
  assert.equal(firstPage.total, mainCodes.length);
  assert.equal(firstPage.codes.length, 8);
  assert(firstPage.cursor);

  const secondPage = await getCodes('main', 8, firstPage.cursor);
  assert.equal(secondPage.total, mainCodes.length);
  assert.equal(secondPage.codes.length, 3);
  assert.equal(secondPage.cursor, null);
  assert.equal(new Set([...firstPage.codes, ...secondPage.codes].map(({ id }) => id)).size, 11);

  const pastEndCursor = Buffer.from(
    JSON.stringify({ slot: Math.floor(Date.now() / 300000), offset: 99 }),
  ).toString('base64url');
  const emptyPage = await getCodes('main', 8, pastEndCursor);
  assert.deepEqual(emptyPage.codes, []);
  assert.equal(emptyPage.total, mainCodes.length);
  assert.equal(emptyPage.cursor, null);

  const issues = await getCodes('issues', 8);
  assert.equal(issues.total, issueCodes.length);
  assert.deepEqual(new Set(issues.codes.map(({ id }) => id)), new Set(issueCodes.map(({ id }) => id)));
  assert.equal(issues.codes.length, issueCodes.length);

  const returnedIds = new Set([
    ...firstPage.codes.map(({ id }) => id),
    ...secondPage.codes.map(({ id }) => id),
    ...issues.codes.map(({ id }) => id),
  ]);
  for (const hidden of [hiddenPending, hiddenRejected, hiddenRetired]) {
    assert.equal(returnedIds.has(hidden.id), false);
  }
});

test('initial code load represents an unknown total as null when the database is unavailable', async () => {
  databaseAvailable = false;
  const initial = await initialCodes();
  assert.equal(initial.unavailable, true);
  assert.equal(initial.total, null);
});

class MemoryCache implements PublicCodeCache {
  entries = new Map<string, Response>();
  async match(key: Request) { return this.entries.get(key.url)?.clone(); }
  async put(key: Request, response: Response) { this.entries.set(key.url, response.clone()); }
}

test('public snapshot shares one load across pagination, filters and concurrent requests; expires after 900 seconds', async () => {
  databaseAvailable = true;
  const cache = new MemoryCache();
  let time = Date.now();
  let limits = 0;
  const options = { cache, now: () => time, beforeLoad: async () => { limits++; } };
  const start = queries;
  const [first, concurrent] = await Promise.all([
    getCodesWithCache('main', 8, undefined, options),
    getCodesWithCache('issues', 1, undefined, options),
  ]);
  assert.equal(queries - start, 1);
  assert.equal(limits, 1);
  assert.equal(first.page.total, 11);
  assert.equal(concurrent.page.total, 2);
  assert.equal(first.page.codes.length, 8);
  assert.equal(first.cache.status, 'MISS');
  const next = await getCodesWithCache('main', 8, first.page.cursor!, options);
  assert.equal(next.cache.status, 'HIT');
  assert.equal(next.page.codes.length, 3);
  assert.equal(next.page.total, 11);
  await getCodesWithCache('main', 1, undefined, options);
  assert.equal(queries - start, 1);
  assert.equal(limits, 1);
  assert.equal(cache.entries.size, 1);
  const stored = await [...cache.entries.values()][0].clone().json();
  assert(!JSON.stringify(stored).includes('manage_hash'));
  assert(!JSON.stringify(stored).includes('ip_hash'));
  stored.main[0].manage_hash = 'must-not-leak';
  const key = [...cache.entries.keys()][0];
  cache.entries.set(key, Response.json(stored));
  const projected = await getCodesWithCache('main', 8, undefined, options);
  assert(!JSON.stringify(projected).includes('must-not-leak'));
  time += 899_000;
  assert.equal((await getCodesWithCache('main', 8, undefined, options)).cache.status, 'HIT');
  time += 1000;
  assert.equal((await getCodesWithCache('main', 8, undefined, options)).cache.status, 'MISS');
  assert.equal(queries - start, 2);
  await assert.rejects(getCodesWithCache('main', 8, first.page.cursor!, options), /INVALID_CURSOR/);
  assert.equal(queries - start, 2);
});

test('invalid cursors do not query; failures are not cached; unavailable cache keeps realtime limiter', async () => {
  databaseAvailable = true;
  const cache = new MemoryCache();
  const start = queries;
  let limits = 0;
  const beforeLoad = async () => { limits++; };
  await assert.rejects(getCodesWithCache('main', 8, 'bad!', {cache, beforeLoad}), /INVALID_CURSOR/);
  assert.equal(queries, start); assert.equal(limits, 0);
  databaseAvailable = false;
  await assert.rejects(getCodesWithCache('main', 8, undefined, {cache, beforeLoad}), /DATABASE_UNAVAILABLE/);
  assert.equal(cache.entries.size, 0);
  databaseAvailable = true;
  assert.equal((await getCodesWithCache('main', 8, undefined, {cache, beforeLoad})).page.total, 11);
  const afterFill = queries;
  const bypass = await getCodesWithCache('main', 8, undefined, {cache:null, beforeLoad});
  assert.equal(bypass.cache.status, 'BYPASS');
  assert.equal(queries, afterFill + 1);
  assert.equal(limits, 3);
});

test('a legitimately empty public pool is cached and cache read/write failures do not hide database errors', async () => {
  databaseAvailable = true;
  await db.exec('BEGIN');
  try {
    await db.exec("UPDATE codes SET moderation='rejected'");
    const cache = new MemoryCache();
    const start = queries;
    const first = await getCodesWithCache('main', 8, undefined, {cache});
    assert.equal(first.page.total, 0);
    assert.deepEqual(first.page.codes, []);
    assert.equal((await getCodesWithCache('issues', 8, undefined, {cache})).cache.status, 'HIT');
    assert.equal(queries, start + 1);
    let limits = 0;
    const broken: PublicCodeCache = {
      match: async () => { throw new Error('cache unavailable'); },
      put: async () => { throw new Error('cache unavailable'); },
    };
    const result = await getCodesWithCache('main', 8, undefined, {cache:broken,beforeLoad:async()=>{limits++;}});
    assert.equal(result.page.total, 0);
    assert.equal(limits, 1);
    databaseAvailable = false;
    await assert.rejects(getCodesWithCache('main', 8, undefined, {cache:broken}), /DATABASE_UNAVAILABLE/);
  } finally {
    databaseAvailable = true;
    await db.exec('ROLLBACK');
  }
});
