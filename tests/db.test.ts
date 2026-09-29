import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { errorResponse } from '../src/lib/api-errors';
import { publicDatabaseError } from '../scripts/local-db';

let db: PGlite;
let tempDir: string;

type HubResult = Record<string, unknown>;
type CodeState = {
  id: string;
  status: string;
  moderation: string;
  retired_reason: string | null;
  remaining: number | null;
  work_count: number;
  fail_count: number;
  copy_count: number;
};

function unique(prefix: string): string {
  return `${prefix}${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
}

async function action(
  name: string,
  data: Record<string, unknown>,
  actor = unique('actor'),
  ip: string | null = null,
): Promise<HubResult> {
  const result = await db.query<{ result: HubResult }>(
    'SELECT hub_action($1, $2::jsonb, $3, $4) AS result',
    [name, JSON.stringify(data), actor, ip],
  );
  return result.rows[0].result;
}

async function submit(
  code = unique('CODE'),
  opts: { manageHash?: string; idempotencyKey?: string; actor?: string; ip?: string | null; remaining?: number | null } = {},
): Promise<{ id: string; manageHash: string; idempotencyKey: string; moderation: string }> {
  const manageHash = opts.manageHash ?? unique('manage-');
  const idempotencyKey = opts.idempotencyKey ?? randomUUID();
  const result = await action('submit', {
    manage_hash: manageHash,
    idempotency_key: idempotencyKey,
    code,
    remaining: opts.remaining ?? null,
  }, opts.actor ?? unique('actor-'), opts.ip ?? null);
  return { id: String(result.id), manageHash, idempotencyKey, moderation: String(result.moderation) };
}

async function state(id: string): Promise<CodeState> {
  const result = await db.query<CodeState>(
    `SELECT id, status, moderation, retired_reason, remaining, work_count, fail_count, copy_count
       FROM code_state WHERE id = $1`,
    [id],
  );
  assert.equal(result.rows.length, 1);
  return result.rows[0];
}

async function manage(name: string, code: { id: string; manageHash: string }, extra: Record<string, unknown> = {}): Promise<HubResult> {
  return action(name, { manage_hash: code.manageHash, id: code.id, ...extra }, 'owner-agent');
}

before(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'muse-invite-db-test-'));
  db = new PGlite(join(tempDir, 'pglite'));
  await db.waitReady;
  const migration = await readFile(resolve(process.cwd(), 'migrations/001_initial.sql'), 'utf8');
  await db.exec(migration);
  await db.exec(migration);
});

after(async () => {
  await db.close();
  await rm(tempDir, { recursive: true, force: true });
});

test('PGlite migration enforces the invitation state and management contract', async (t) => {
  await t.test('the local HTTP bridge exposes only allowlisted database errors', () => {
    for (const code of ['NOT_FOUND', 'DUPLICATE', 'CONFLICT', 'LOCKED', 'ZERO_QUOTA', 'INVALID_ACTION']) {
      assert.equal(publicDatabaseError({ message: code })?.code, code);
    }
    assert.deepEqual(publicDatabaseError({ code: '23505', message: 'duplicate value contains private input' }), {
      code: 'DUPLICATE',
      status: 409,
    });
    assert.equal(publicDatabaseError({ code: '23502', message: 'private query and values' }), null);
    assert.equal(publicDatabaseError({ message: 'NOT_FOUND with appended SQL detail' }), null);
  });

  await t.test('a new owner code is uncertain with no invented feedback, quota, or copies', async () => {
    const code = await submit(unique('OWNER'));
    const saved = await state(code.id);
    assert.equal(saved.status, 'uncertain');
    assert.equal(saved.moderation, 'approved');
    assert.equal(saved.remaining, null);
    assert.equal(saved.work_count, 0);
    assert.equal(saved.fail_count, 0);
    assert.equal(saved.copy_count, 0);
  });

  await t.test('submission retries are idempotent and parallel submissions from one IP review all but the first', async () => {
    const codeText = unique('IDEMP');
    const manageHash = unique('manage-');
    const idempotencyKey = randomUUID();
    const initial = await action('submit', { manage_hash: manageHash, idempotency_key: idempotencyKey, code: codeText, remaining: 2 }, 'same-actor', 'ip-idem');
    const retry = await action('submit', { manage_hash: manageHash, idempotency_key: idempotencyKey, code: codeText, remaining: 2 }, 'same-actor', 'ip-idem');
    assert.equal(retry.replayed, true);
    assert.equal(retry.id, initial.id);

    await db.query('UPDATE codes SET remaining=7 WHERE id=$1', [initial.id]);
    const retryAfterQuotaEdit = await action('submit', { manage_hash: manageHash, idempotency_key: idempotencyKey, code: codeText, remaining: 2 }, 'same-actor', 'ip-idem');
    assert.equal(retryAfterQuotaEdit.replayed, true);
    let conflict: unknown;
    try {
      await action('submit', { manage_hash: manageHash, idempotency_key: idempotencyKey, code: codeText, remaining: 3 }, 'same-actor', 'ip-idem');
    } catch (error) {
      conflict = error;
    }
    assert.match(String(conflict), /CONFLICT/);
    assert.equal(errorResponse(conflict).status, 409);

    await assert.rejects(
      action('submit', { manage_hash: manageHash, idempotency_key: randomUUID(), code: codeText, remaining: null }, 'same-actor', 'ip-idem'),
      /CONFLICT/,
    );

    const ip = unique('ip-concurrent-');
    const [first, second] = await Promise.all([
      submit(unique('PARALLEL'), { actor: unique('actor-'), ip }),
      submit(unique('PARALLEL'), { actor: unique('actor-'), ip }),
    ]);
    assert.deepEqual([first.moderation, second.moderation].sort(), ['approved', 'pending']);

    const raceCode = unique('RACE');
    const duplicateRace = await Promise.allSettled([
      submit(raceCode, { actor: unique('actor-'), ip: unique('ip-') }),
      submit(raceCode, { actor: unique('actor-'), ip: unique('ip-') }),
    ]);
    assert.equal(duplicateRace.filter((result) => result.status === 'fulfilled').length, 1);
    const count = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM codes WHERE code_key = $1', [raceCode]);
    assert.equal(count.rows[0].count, 1);
  });

  await t.test('success feedback is one current report and copy counting is rate limited', async () => {
    const code = await submit();
    const first = await action('report', { id: code.id, result: 'success' }, 'visitor-one', 'ip-one');
    const duplicate = await action('report', { id: code.id, result: 'success' }, 'visitor-one', 'ip-one');
    assert.equal(first.changed, true);
    assert.equal(duplicate.changed, false);
    assert.equal((await state(code.id)).status, 'active');
    assert.equal((await state(code.id)).work_count, 1);

    const copy1 = await action('copy', { id: code.id }, 'visitor-copy', 'ip-copy');
    const copy2 = await action('copy', { id: code.id }, 'visitor-copy', 'ip-copy');
    assert.equal(copy1.counted, true);
    assert.equal(copy2.counted, false);
    assert.equal((await state(code.id)).copy_count, 1);

    await action('report', { id: code.id, result: 'fail' }, 'visitor-one', 'ip-one');
    const changed = await state(code.id);
    assert.equal(changed.status, 'uncertain');
    assert.equal(changed.work_count, 0);
    assert.equal(changed.fail_count, 1);
  });

  await t.test('three failed reports only flag a code when they come from three distinct IP hashes', async () => {
    const sameIpCode = await submit();
    for (const actor of ['same-ip-a', 'same-ip-b', 'same-ip-c']) {
      await action('report', { id: sameIpCode.id, result: 'fail' }, actor, 'shared-ip');
    }
    assert.equal((await state(sameIpCode.id)).status, 'uncertain');

    const distinctIpCode = await submit();
    for (const [index, ip] of ['ip-a', 'ip-b', 'ip-c'].entries()) {
      await action('report', { id: distinctIpCode.id, result: 'fail' }, `actor-${index}`, ip);
    }
    assert.equal((await state(distinctIpCode.id)).fail_count, 3);
    assert.equal((await state(distinctIpCode.id)).status, 'likely_unavailable');

    const ineligibleCode = await submit();
    for (const [index, ip] of ['ineligible-a', 'ineligible-b', 'ineligible-c'].entries()) {
      await action('report', { id: ineligibleCode.id, result: 'fail', eligible: index === 0 }, `ineligible-${index}`, ip);
    }
    assert.equal((await state(ineligibleCode.id)).fail_count, 1);
    assert.equal((await state(ineligibleCode.id)).status, 'uncertain');
  });

  await t.test('owner pause and resume respect zero quota and administrator retirement', async () => {
    const code = await submit(unique('QUOTA'), { remaining: 2 });
    await manage('manage_pause', code);
    assert.equal((await state(code.id)).status, 'retired');
    await manage('manage_resume', code);
    assert.equal((await state(code.id)).status, 'uncertain');

    await manage('manage_quota', code, { remaining: 0 });
    assert.equal((await state(code.id)).status, 'retired');
    await assert.rejects(manage('manage_resume', code), /ZERO_QUOTA/);
    await manage('manage_quota', code, { remaining: 1 });
    await manage('manage_resume', code);
    assert.equal((await state(code.id)).status, 'uncertain');

    await action('admin_retire', { id: code.id, reason: 'review' }, 'admin');
    await assert.rejects(manage('manage_resume', code), /LOCKED/);
    await action('admin_restore', { id: code.id }, 'admin');
    assert.equal((await state(code.id)).retired_reason, null);
    assert.equal((await state(code.id)).moderation, 'approved');
  });

  await t.test('rotating the management hash revokes the old link immediately', async () => {
    const code = await submit();
    const nextHash = unique('manage-new-');
    const rotationKey = randomUUID();
    await manage('manage_rotate', code, { new_hash: nextHash, idempotency_key: rotationKey });
    const replay = await action('manage_rotate', {
      manage_hash: code.manageHash,
      new_hash: nextHash,
      idempotency_key: rotationKey,
    }, 'owner-agent');
    assert.equal(replay.replayed, true);
    await assert.rejects(manage('manage_pause', code), /NOT_FOUND/);
    const rotated = { ...code, manageHash: nextHash };
    await manage('manage_pause', rotated);
    assert.equal((await state(code.id)).status, 'retired');
  });

  await t.test('rejected moderation cannot be undone by the owner, while admin restore can', async () => {
    const code = await submit();
    await action('admin_reject', { id: code.id, reason: 'duplicate' }, 'admin');
    assert.equal((await state(code.id)).moderation, 'rejected');
    await assert.rejects(manage('manage_resume', code), /LOCKED/);
    await action('admin_restore', { id: code.id }, 'admin');
    assert.equal((await state(code.id)).moderation, 'approved');
    assert.equal((await state(code.id)).status, 'uncertain');
  });

  await t.test('code replacement creates a pending record without inheriting counters or feedback', async () => {
    const code = await submit(unique('REPLACEOLD'));
    await action('report', { id: code.id, result: 'success' }, 'replace-visitor', 'replace-ip');
    await action('copy', { id: code.id }, 'replace-copy', 'replace-copy-ip');
    const replacementText = unique('REPLACENEW');
    const replacement = await manage('manage_replace', code, { code: replacementText });
    const retry = await manage('manage_replace', code, { code: replacementText });
    assert.equal(retry.id, replacement.id);

    const [oldCode, newCode] = await Promise.all([state(code.id), state(String(replacement.id))]);
    assert.equal(oldCode.retired_reason, 'replaced');
    assert.equal(oldCode.copy_count, 1);
    assert.equal(newCode.moderation, 'pending');
    assert.equal(newCode.status, 'uncertain');
    assert.equal(newCode.work_count, 0);
    assert.equal(newCode.copy_count, 0);
    const publicCount = await db.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM code_state WHERE id = $1 AND moderation IN ('approved','needs_review') AND status <> 'retired'`,
      [replacement.id],
    );
    assert.equal(publicCount.rows[0].count, 0);
  });
});
