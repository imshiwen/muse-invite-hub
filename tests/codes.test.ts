import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { getCodes, initialCodes } from '../src/lib/codes';

const localDbKey = 'codes-test-key-with-at-least-32-bytes-long';
let db: PGlite;
let previousFetch: typeof fetch;
let previousAppEnv: string | undefined;
let previousLocalDbUrl: string | undefined;
let previousLocalDbKey: string | undefined;
let databaseAvailable = true;

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
