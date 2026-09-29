import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from '@neondatabase/serverless';

function option(name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requireRemoteTarget(): string {
  if (option('--target') !== 'neon' || !process.argv.includes('--confirm-remote')) {
    throw new Error('Remote migration refused. Review the database target, then pass --target neon --confirm-remote --expected-host <exact-host>.');
  }
  const urlValue = process.env.DATABASE_URL;
  const expectedHost = option('--expected-host');
  if (!urlValue || !expectedHost) throw new Error('DATABASE_URL and --expected-host are required for an explicit Neon target.');
  const databaseUrl = new URL(urlValue);
  if (!databaseUrl.hostname.endsWith('.neon.tech') || databaseUrl.hostname !== expectedHost) {
    throw new Error('DATABASE_URL host does not match the reviewed Neon --expected-host.');
  }
  return urlValue;
}

async function main(): Promise<void> {
  const databaseUrl = requireRemoteTarget();
  const migration = await readFile(resolve(process.cwd(), 'migrations/001_initial.sql'), 'utf8');
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const alreadyApplied = await client.query('SELECT name FROM schema_migrations WHERE name = $1', ['001_initial.sql']);
    if (alreadyApplied.rowCount) {
      await client.query('COMMIT');
      console.log('001_initial.sql is already recorded; no changes applied.');
      return;
    }
    await client.query(migration);
    await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', ['001_initial.sql']);
    await client.query('COMMIT');
    console.log('Applied 001_initial.sql to the explicitly selected Neon host.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1]?.endsWith('migrate.ts')) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Migration failed.');
    process.exitCode = 1;
  });
}
