import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from '@neondatabase/serverless';

const OWNER_CODE = 'CJ5FU3';
const BOOTSTRAP_CODES_FILE = resolve(process.cwd(), 'data/bootstrap-codes.json');
const LOCAL_LINK_FILE = resolve(process.cwd(), '.local/owner-link.txt');
const REMOTE_LINK_FILE = resolve(process.cwd(), '.local/production-owner-link.txt');

type BootstrapCode = {
  code: string;
  source: 'owner' | 'community';
};

type Queryable = {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: Row[] }>;
};

function option(name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function managementHash(token: string, key: string): string {
  return createHmac('sha256', key).update(`manage:${token}`).digest('hex');
}

function actorHash(key: string): string {
  return createHmac('sha256', key).update('actor:local-owner-seed').digest('hex');
}

function curatedActorHash(code: string, key: string): string {
  return createHmac('sha256', key).update(`actor:curated-bootstrap:${code}`).digest('hex');
}

async function loadBootstrapCodes(): Promise<BootstrapCode[]> {
  const parsed: unknown = JSON.parse(await readFile(BOOTSTRAP_CODES_FILE, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error('data/bootstrap-codes.json must contain an array.');

  const codes = parsed.map((entry): BootstrapCode => {
    if (!entry || typeof entry !== 'object' || !('code' in entry) || !('source' in entry)) {
      throw new Error('Every bootstrap code must include code and source.');
    }
    const { code, source } = entry as { code: unknown; source: unknown };
    if (typeof code !== 'string' || !code || code !== code.trim()) {
      throw new Error('Bootstrap codes must be non-empty strings without surrounding whitespace.');
    }
    if (source !== 'owner' && source !== 'community') {
      throw new Error(`Unsupported bootstrap source for ${code}.`);
    }
    return { code, source };
  });

  const ownerCodes = codes.filter((entry) => entry.source === 'owner');
  if (codes.length !== 5 || ownerCodes.length !== 1 || ownerCodes[0].code !== OWNER_CODE) {
    throw new Error(`Bootstrap data must contain exactly five codes and owner code ${OWNER_CODE}.`);
  }
  if (new Set(codes.map((entry) => entry.code)).size !== codes.length) {
    throw new Error('Bootstrap data contains duplicate codes.');
  }
  return codes;
}

function validToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value) && Buffer.from(value, 'base64url').length === 32;
}

async function getOrCreateToken(path: string): Promise<string> {
  try {
    const saved = (await readFile(path, 'utf8')).trim();
    const token = saved.split('/manage/').at(-1) ?? '';
    if (!validToken(token)) throw new Error(`Saved owner link at ${path} is malformed; it was left untouched.`);
    return token;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return randomBytes(32).toString('base64url');
}

async function saveOwnerLink(path: string, origin: string, token: string): Promise<void> {
  await mkdir(resolve(process.cwd(), '.local'), { recursive: true, mode: 0o700 });
  await chmod(resolve(process.cwd(), '.local'), 0o700).catch(() => undefined);
  await writeFile(path, `${origin}/manage/${token}\n`, { mode: 0o600, flag: 'wx' }).catch(async (error: NodeJS.ErrnoException) => {
    if (error.code !== 'EEXIST') throw error;
    // The file is a credential. Never replace an existing link during a seed retry.
  });
  await chmod(path, 0o600).catch(() => undefined);
}

async function ensureSavedLinkMatches(path: string, token: string): Promise<void> {
  try {
    const saved = (await readFile(path, 'utf8')).trim();
    if ((saved.split('/manage/').at(-1) ?? '') !== token) {
      throw new Error(`The owner link at ${path} belongs to a different token; seed stopped without replacing it.`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

async function seedOwnerCode(db: Queryable, code: string, tokenHash: string, ownerActorHash: string): Promise<'inserted' | 'existing'> {
  await db.query('BEGIN');
  try {
    const existing = await db.query<{
      id: string;
      submission_id: string;
      source: string;
      manage_hash: string;
    }>(
      `SELECT c.id, c.submission_id, c.source, s.manage_hash
         FROM codes c JOIN submissions s ON s.id = c.submission_id
        WHERE c.code_key = $1 FOR UPDATE`,
      [code],
    );
    if (existing.rows.length) {
      const row = existing.rows[0];
      if (row.source !== 'owner' || row.manage_hash !== tokenHash) {
        throw new Error(`${code} already exists with a different owner or management link; seed stopped without changing it.`);
      }
      await db.query('COMMIT');
      return 'existing';
    }

    const submission = await db.query<{ id: string }>(
      'INSERT INTO submissions(manage_hash, submit_idempotency_key, actor_hash, ip_hash) VALUES ($1, $2, $3, NULL) RETURNING id',
      [tokenHash, randomUUID(), ownerActorHash],
    );
    await db.query(
      `INSERT INTO codes(submission_id, code, code_key, moderation, remaining, source, copy_count)
       VALUES ($1, $2, $2, 'approved', NULL, 'owner', 0)`,
      [submission.rows[0].id, code],
    );
    await db.query('COMMIT');
    return 'inserted';
  } catch (error) {
    await db.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

async function seedCommunityCode(db: Queryable, code: string, hmacKey: string): Promise<'inserted' | 'existing'> {
  await db.query('BEGIN');
  try {
    const existing = await db.query<{ id: string; source: string }>(
      `SELECT c.id, c.source
         FROM codes c JOIN submissions s ON s.id = c.submission_id
        WHERE c.code_key = $1 FOR UPDATE`,
      [code],
    );
    if (existing.rows.length) {
      if (existing.rows[0].source !== 'community') {
        throw new Error(`${code} already exists with source ${existing.rows[0].source}; seed stopped without changing or taking it over.`);
      }
      await db.query('COMMIT');
      return 'existing';
    }

    // This random management capability is intentionally discarded after its keyed digest is stored.
    // Curated records are managed by the admin console and do not impersonate their unknown sharers.
    const capability = randomBytes(32).toString('base64url');
    const submission = await db.query<{ id: string }>(
      'INSERT INTO submissions(manage_hash, submit_idempotency_key, actor_hash, ip_hash) VALUES ($1, $2, $3, NULL) RETURNING id',
      [managementHash(capability, hmacKey), randomUUID(), curatedActorHash(code, hmacKey)],
    );
    await db.query(
      `INSERT INTO codes(submission_id, code, code_key, moderation, remaining, source, copy_count)
       VALUES ($1, $2, $2, 'approved', NULL, 'community', 0)`,
      [submission.rows[0].id, code],
    );
    await db.query('COMMIT');
    return 'inserted';
  } catch (error) {
    await db.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

async function seedCommunityCodes(db: Queryable, codes: BootstrapCode[], hmacKey: string): Promise<{ inserted: number; existing: number }> {
  let inserted = 0;
  let existing = 0;
  for (const entry of codes) {
    if (entry.source !== 'community') continue;
    const outcome = await seedCommunityCode(db, entry.code, hmacKey);
    if (outcome === 'inserted') inserted += 1;
    else existing += 1;
  }
  return { inserted, existing };
}

async function seedLocal(token: string, hmacKey: string, codes: BootstrapCode[]): Promise<void> {
  if (process.env.APP_ENV !== 'local') throw new Error('Local seed requires APP_ENV=local.');
  const localUrl = process.env.LOCAL_DB_URL;
  const dbKey = process.env.LOCAL_DB_KEY;
  if (!localUrl || !dbKey) throw new Error('LOCAL_DB_URL and LOCAL_DB_KEY are required. Start scripts/local-db.ts first.');
  const url = new URL(localUrl);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error('Local seed only connects to a loopback LOCAL_DB_URL.');
  }

  const db: Queryable = {
    async query<Row extends Record<string, unknown> = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<{ rows: Row[] }> {
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${dbKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, params }),
      });
      if (!response.ok) throw new Error(`Local database request failed (${response.status}).`);
      return await response.json() as { rows: Row[] };
    },
  };
  const owner = codes.find((entry) => entry.source === 'owner');
  if (!owner) throw new Error('Bootstrap data has no owner code.');
  const ownerOutcome = await seedOwnerCode(db, owner.code, managementHash(token, hmacKey), actorHash(hmacKey));
  await saveOwnerLink(LOCAL_LINK_FILE, 'http://localhost:3000', token);
  const community = await seedCommunityCodes(db, codes, hmacKey);
  console.log(`Local bootstrap seed complete: owner=${ownerOutcome}; community inserted=${community.inserted}, existing=${community.existing}. Inspect the private owner link at ${LOCAL_LINK_FILE}.`);
}

async function seedNeon(token: string, hmacKey: string, codes: BootstrapCode[]): Promise<void> {
  if (option('--target') !== 'neon' || !process.argv.includes('--confirm-remote')) {
    throw new Error('Remote seed refused. Review the database target, then pass --target neon --confirm-remote --expected-host <exact-host>.');
  }
  const databaseUrl = process.env.DATABASE_URL;
  const expectedHost = option('--expected-host');
  if (!databaseUrl || !expectedHost) throw new Error('DATABASE_URL and --expected-host are required for an explicit Neon target.');
  const database = new URL(databaseUrl);
  if (!database.hostname.endsWith('.neon.tech') || database.hostname !== expectedHost) {
    throw new Error('DATABASE_URL host does not match the reviewed Neon --expected-host.');
  }
  await ensureSavedLinkMatches(REMOTE_LINK_FILE, token);

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    const owner = codes.find((entry) => entry.source === 'owner');
    if (!owner) throw new Error('Bootstrap data has no owner code.');
    const ownerOutcome = await seedOwnerCode(client, owner.code, managementHash(token, hmacKey), actorHash(hmacKey));
    await saveOwnerLink(REMOTE_LINK_FILE, 'https://museinvitehub.org', token);
    const community = await seedCommunityCodes(client, codes, hmacKey);
    console.log(`Neon bootstrap seed complete: owner=${ownerOutcome}; community inserted=${community.inserted}, existing=${community.existing}. Inspect the private owner link at ${REMOTE_LINK_FILE}.`);
  } finally {
    client.release();
    await pool.end();
  }
}

async function main(): Promise<void> {
  const target = option('--target');
  const codes = await loadBootstrapCodes();
  const hmacKey = process.env.APP_HMAC_KEY;
  if (!hmacKey || Buffer.byteLength(hmacKey) < 32) throw new Error('APP_HMAC_KEY must be at least 32 bytes and match the selected app environment.');
  if (target === 'local') {
    const token = await getOrCreateToken(LOCAL_LINK_FILE);
    await seedLocal(token, hmacKey, codes);
    return;
  }
  if (target === 'neon') {
    if (!process.argv.includes('--confirm-remote')) throw new Error('Remote seed refused; add --confirm-remote only after reviewing the Neon host and branch.');
    const token = process.env.MUSE_OWNER_MANAGE_TOKEN;
    if (!token || !validToken(token)) throw new Error('Remote seed requires a 32-byte base64url MUSE_OWNER_MANAGE_TOKEN supplied through the process environment.');
    await seedNeon(token, hmacKey, codes);
    return;
  }
  throw new Error('Choose an explicit target: --target local or --target neon.');
}

if (process.argv[1]?.endsWith('seed.ts')) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Seed failed.');
    process.exitCode = 1;
  });
}
