import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { assertSameOrigin, getVisitorId, issueVisitorCookie } from '../src/lib/security';

let db: PGlite;
let tempDir: string;
const previousEnv = { appEnv: process.env.APP_ENV, hmacKey: process.env.APP_HMAC_KEY };

type HubResult = Record<string, unknown>;
type CodeState = { id: string; status: string; moderation: string; work_count: number; fail_count: number; retired_reason: string | null };

function unique(prefix: string) {
  return `${prefix}${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}

async function action(name: string, data: Record<string, unknown>, actor = unique('actor-'), ip: string | null = null): Promise<HubResult> {
  const result = await db.query<{ result: HubResult }>(
    'SELECT hub_action($1, $2::jsonb, $3, $4) AS result',
    [name, JSON.stringify(data), actor, ip],
  );
  return result.rows[0].result;
}

async function submit(code = unique('CODE-')) {
  const result = await action('submit', {
    manage_hash: unique('manage-'),
    idempotency_key: randomUUID(),
    code,
    remaining: null,
  });
  return String(result.id);
}

async function state(id: string) {
  const result = await db.query<CodeState>(
    'SELECT id,status,moderation,work_count,fail_count,retired_reason FROM code_state WHERE id=$1',
    [id],
  );
  assert.equal(result.rows.length, 1);
  return result.rows[0];
}

before(async () => {
  process.env.APP_ENV = 'local';
  process.env.APP_HMAC_KEY = 'backend-tests-only-secret-value-32-bytes';
  tempDir = await mkdtemp(join(tmpdir(), 'muse-invite-backend-test-'));
  db = new PGlite(join(tempDir, 'pglite'));
  await db.waitReady;
  await db.exec(await readFile(resolve(process.cwd(), 'migrations/001_initial.sql'), 'utf8'));
});

after(async () => {
  await db.close();
  await rm(tempDir, { recursive: true, force: true });
  if (previousEnv.appEnv === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = previousEnv.appEnv;
  if (previousEnv.hmacKey === undefined) delete process.env.APP_HMAC_KEY;
  else process.env.APP_HMAC_KEY = previousEnv.hmacKey;
});

test('status windows and delayed requests preserve the moderation state machine', async (t) => {
  await t.test('a success older than 24 hours returns to uncertain', async () => {
    const id = await submit();
    await action('report', { id, result: 'success' }, 'success-owner', 'ip-success');
    await db.query("UPDATE feedback SET observed_at=now()-interval '24 hours 1 second' WHERE code_id=$1", [id]);
    const saved = await state(id);
    assert.equal(saved.status, 'uncertain');
    assert.equal(saved.work_count, 1);
  });

  await t.test('an expired group of fail reports no longer lowers a code', async () => {
    const id = await submit();
    for (const [index, ip] of ['ip-fail-a', 'ip-fail-b', 'ip-fail-c'].entries()) {
      await action('report', { id, result: 'fail' }, `fail-actor-${index}`, ip);
    }
    assert.equal((await state(id)).status, 'likely_unavailable');
    await db.query("UPDATE feedback SET observed_at=now()-interval '24 hours 1 second' WHERE code_id=$1", [id]);
    const saved = await state(id);
    assert.equal(saved.status, 'uncertain');
    assert.equal(saved.fail_count, 0);
  });

  await t.test('a later success supersedes previous failures', async () => {
    const id = await submit();
    for (const [index, ip] of ['late-fail-a', 'late-fail-b', 'late-fail-c'].entries()) {
      await action('report', { id, result: 'fail' }, `late-fail-${index}`, ip);
    }
    assert.equal((await state(id)).status, 'likely_unavailable');
    await action('report', { id, result: 'success' }, 'late-success', 'late-success-ip');
    const saved = await state(id);
    assert.equal(saved.status, 'active');
    assert.equal(saved.fail_count, 0);
    assert.equal(saved.work_count, 1);
  });

  await t.test('a delayed report cannot recover an owner-retired code', async () => {
    const id = await submit();
    const owner = await db.query<{ manage_hash: string }>('SELECT manage_hash FROM submissions WHERE id=(SELECT submission_id FROM codes WHERE id=$1)', [id]);
    await action('manage_pause', { manage_hash: owner.rows[0].manage_hash, id }, 'owner');
    await assert.rejects(action('report', { id, result: 'success' }, 'late-visitor', 'late-ip'), /NOT_FOUND/);
    const saved = await state(id);
    assert.equal(saved.status, 'retired');
    assert.equal(saved.work_count, 0);
  });

  await t.test('abuse reports request review without changing redemption status', async () => {
    const id = await submit();
    for (const [index, ip] of ['abuse-ip-a', 'abuse-ip-b', 'abuse-ip-c', 'abuse-ip-d', 'abuse-ip-e'].entries()) {
      await action('abuse', { id, reason: 'other', note: '' }, `abuse-actor-${index}`, ip);
    }
    const saved = await state(id);
    assert.equal(saved.moderation, 'needs_review');
    assert.equal(saved.status, 'uncertain');
    assert.equal(saved.fail_count, 0);
  });
});

test('visitor cookies and write origins reject forged or cross-site requests', async () => {
  const forged = `v1.${'A'.repeat(43)}.${'0'.repeat(64)}`;
  const forgedRequest = new Request('http://localhost:3000/api/visitor', { headers: { cookie: `muse_visitor=${forged}` } });
  assert.equal(await getVisitorId(forgedRequest), null);

  const issued = await issueVisitorCookie(forgedRequest);
  assert.ok(issued);
  const validRequest = new Request('http://localhost:3000/api/visitor', { headers: { cookie: `muse_visitor=${issued}` } });
  assert.equal(await getVisitorId(validRequest), issued.split('.')[1]);

  const allowedLoopback = new Request('http://localhost:3000/api/visitor', {
    headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' },
  });
  assert.doesNotThrow(() => assertSameOrigin(allowedLoopback));

  const foreignOrigin = new Request('http://localhost:3000/api/visitor', {
    headers: { host: '127.0.0.1:3000', origin: 'https://attacker.example' },
  });
  assert.throws(() => assertSameOrigin(foreignOrigin), /request could not be verified/i);
});
