import { query } from "./db";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isProductionSite, SITE_URL } from "./config";
import type { PublicCode, CodePage, ManagedCode } from "./types";
const fields =
  "id,code,status,source,remaining,remaining_at,created_at,last_success,work_count,copy_count";
const SNAPSHOT_VERSION = 1;
const SNAPSHOT_TTL_SECONDS = 900;
const SNAPSHOT_TTL_MS = SNAPSHOT_TTL_SECONDS * 1000;
const publicStatuses = ["active", "uncertain", "likely_unavailable"] as const;

type ParsedCursor = { slot: number; offset: number };
type PublicSnapshot = {
  version: number;
  slot: number;
  generatedAt: number;
  main: PublicCode[];
  issues: PublicCode[];
};
export type CodeCacheStatus = "HIT" | "MISS" | "BYPASS";
export type CodeCacheDiagnostic = {
  status: CodeCacheStatus;
  ageSeconds?: number;
};
export type PublicCodeCache = {
  match(key: Request): Promise<Response | undefined | null>;
  put(key: Request, response: Response): Promise<void>;
};
type PublicCodesOptions = {
  beforeLoad?: () => Promise<void>;
  /** Injection point for deterministic tests. Runtime callers should omit this. */
  cache?: PublicCodeCache | null;
  now?: () => number;
};

const inFlightSnapshots = new WeakMap<PublicCodeCache, Promise<PublicSnapshot>>();

function parseCursorShape(cursor?: string): ParsedCursor | undefined {
  if (!cursor) return undefined;
  try {
    if (!/^[A-Za-z0-9_-]{1,512}$/.test(cursor)) throw new Error("INVALID_CURSOR");
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString()) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("INVALID_CURSOR");
    const value = parsed as Record<string, unknown>;
    if (
      !Number.isSafeInteger(value.slot) ||
      !Number.isSafeInteger(value.offset) ||
      (value.offset as number) < 0 ||
      (value.offset as number) > 10000
    ) throw new Error("INVALID_CURSOR");
    return { slot: value.slot as number, offset: value.offset as number };
  } catch {
    throw new Error("INVALID_CURSOR");
  }
}

function parseRealtimeCursor(cursor?: string, now = Date.now()): ParsedCursor {
  const parsed = parseCursorShape(cursor) ?? {
    slot: Math.floor(now / 300000),
    offset: 0,
  };
  if (
    Math.abs(parsed.slot - Math.floor(now / 300000)) > 12
  )
    throw new Error("INVALID_CURSOR");
  return parsed;
}

function parseSnapshotCursor(cursor?: string, now = Date.now()): ParsedCursor | undefined {
  const parsed = parseCursorShape(cursor);
  if (!parsed) return undefined;
  if (parsed.slot > now + 60_000 || now - parsed.slot > SNAPSHOT_TTL_MS)
    throw new Error("INVALID_CURSOR");
  return parsed;
}

async function getRuntimeCache(): Promise<PublicCodeCache | null> {
  if (!isProductionSite()) return null;
  try {
    // Require OpenNext's request context so Node's or a browser-like CacheStorage
    // implementation can never accidentally turn on this production-only path.
    const context = await getCloudflareContext({ async: true });
    if (!context?.ctx || typeof context.ctx.waitUntil !== "function") return null;
    const defaultCache = (globalThis as typeof globalThis & {
      caches?: { default?: PublicCodeCache };
    }).caches?.default;
    return defaultCache && typeof defaultCache.match === "function" &&
      typeof defaultCache.put === "function" ? defaultCache : null;
  } catch {
    return null;
  }
}

function cacheKey(): Request {
  const canonicalHost = new URL(SITE_URL).host.toLowerCase();
  // Use a canonical, versioned key; never incorporate request identity or filters.
  const url = new URL(
    `/__internal/cache/v${SNAPSHOT_VERSION}/${encodeURIComponent(canonicalHost)}/public-code-snapshot`,
    SITE_URL,
  );
  return new Request(url, { method: "GET" });
}

function projectPublicCode(value: unknown): PublicCode {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_PUBLIC_SNAPSHOT");
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.code !== "string" ||
    typeof row.status !== "string" ||
    !publicStatuses.includes(row.status as (typeof publicStatuses)[number]) ||
    typeof row.source !== "string" ||
    (row.remaining !== null && typeof row.remaining !== "number") ||
    (row.remaining_at !== null && typeof row.remaining_at !== "string") ||
    typeof row.created_at !== "string" ||
    (row.last_success !== null && typeof row.last_success !== "string") ||
    typeof row.work_count !== "number" ||
    typeof row.copy_count !== "number"
  ) throw new Error("INVALID_PUBLIC_SNAPSHOT");

  // Explicit projection prevents private columns added to SQL/cache data from
  // ever being forwarded to the public page or API.
  return {
    id: row.id,
    code: row.code,
    status: row.status as PublicCode["status"],
    source: row.source,
    remaining: row.remaining,
    remaining_at: row.remaining_at,
    created_at: row.created_at,
    last_success: row.last_success,
    work_count: row.work_count,
    copy_count: row.copy_count,
  };
}

function parseSnapshot(value: unknown, now: number): PublicSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    const snapshot = value as Record<string, unknown>;
    if (
      snapshot.version !== SNAPSHOT_VERSION ||
      !Number.isSafeInteger(snapshot.slot) ||
      !Number.isSafeInteger(snapshot.generatedAt) ||
      snapshot.slot !== snapshot.generatedAt ||
      (snapshot.slot as number) > now + 60_000 ||
      now - (snapshot.generatedAt as number) >= SNAPSHOT_TTL_MS ||
      !Array.isArray(snapshot.main) ||
      !Array.isArray(snapshot.issues)
    ) return null;
    const main = snapshot.main.map(projectPublicCode);
    const issues = snapshot.issues.map(projectPublicCode);
    if (
      main.some((code) => code.status === "likely_unavailable") ||
      issues.some((code) => code.status !== "likely_unavailable")
    ) return null;
    return {
      version: SNAPSHOT_VERSION,
      slot: snapshot.slot as number,
      generatedAt: snapshot.generatedAt as number,
      main,
      issues,
    };
  } catch {
    return null;
  }
}

function pageFromSnapshot(
  snapshot: PublicSnapshot,
  group: string,
  limit: number,
  cursor?: ParsedCursor,
): CodePage {
  if (cursor && cursor.slot !== snapshot.slot) throw new Error("INVALID_CURSOR");
  const codes = group === "issues" ? snapshot.issues : snapshot.main;
  const offset = cursor?.offset ?? 0;
  const pageCodes = codes.slice(offset, offset + limit);
  const hasMore = offset + pageCodes.length < codes.length;
  return {
    codes: pageCodes,
    total: codes.length,
    cursor: hasMore
      ? Buffer.from(JSON.stringify({ slot: snapshot.slot, offset: offset + limit })).toString("base64url")
      : null,
  };
}

async function loadSnapshot(now: number): Promise<PublicSnapshot> {
  const rows = await query<{ codes: unknown }>(
    `/* public-code-snapshot:v1 */
     SELECT COALESCE(
       json_agg(
         to_jsonb(pool)
         ORDER BY CASE pool.status WHEN 'active' THEN 0 ELSE 1 END,
           md5(pool.id::text || $1), pool.id
       ),
       '[]'::json
     ) AS codes
     FROM (
       SELECT ${fields}
       FROM code_state
       WHERE moderation IN ('approved','needs_review')
         AND status = ANY($2::text[])
     ) AS pool`,
    [String(now), [...publicStatuses]],
  );
  if (!rows[0] || !Array.isArray(rows[0].codes)) throw new Error("DATABASE_ERROR");
  const projected = rows[0].codes.map(projectPublicCode);
  const snapshot: PublicSnapshot = {
    version: SNAPSHOT_VERSION,
    slot: now,
    generatedAt: now,
    main: projected.filter((code) => code.status === "active" || code.status === "uncertain"),
    issues: projected.filter((code) => code.status === "likely_unavailable"),
  };
  return snapshot;
}

async function loadOrJoinSnapshot(
  cache: PublicCodeCache,
  beforeLoad: (() => Promise<void>) | undefined,
  now: () => number,
): Promise<PublicSnapshot> {
  const existing = inFlightSnapshots.get(cache);
  if (existing) return existing;

  const key = cacheKey();
  const pending = (async () => {
    await beforeLoad?.();
    const snapshot = await loadSnapshot(now());
    try {
      await cache.put(
        key,
        new Response(JSON.stringify(snapshot), {
          headers: {
            "Cache-Control": `public, max-age=${SNAPSHOT_TTL_SECONDS}`,
            "Content-Type": "application/json; charset=utf-8",
          },
        }),
      );
    } catch {
      // Cache storage is optional. Database errors above still propagate.
    }
    return snapshot;
  })();
  inFlightSnapshots.set(cache, pending);
  try {
    return await pending;
  } finally {
    if (inFlightSnapshots.get(cache) === pending) inFlightSnapshots.delete(cache);
  }
}

export async function getCodesWithCache(
  group = "main",
  limit = 8,
  cursor?: string,
  options: PublicCodesOptions = {},
): Promise<{ page: CodePage; cache: CodeCacheDiagnostic }> {
  const now = options.now ?? Date.now;
  parseCursorShape(cursor);
  const cache = Object.prototype.hasOwnProperty.call(options, "cache")
    ? options.cache ?? null
    : await getRuntimeCache();

  if (!cache) {
    // Validate before the caller's rate-limit callback so invalid cursors do
    // not touch the database through either the limiter or list query.
    const parsed = parseRealtimeCursor(cursor, now());
    await options.beforeLoad?.();
    return {
      page: await getCodesRealtime(group, limit, parsed),
      cache: { status: "BYPASS" },
    };
  }

  const cursorData = parseSnapshotCursor(cursor, now());
  let cached: PublicSnapshot | null = null;
  try {
    const response = await cache.match(cacheKey());
    if (response) cached = parseSnapshot(await response.json(), now());
  } catch {
    // A failed cache read behaves as a miss. The live loader below still
    // applies its limiter, and database errors propagate to the caller.
  }
  if (cached) {
    return {
      page: pageFromSnapshot(cached, group, limit, cursorData),
      cache: { status: "HIT", ageSeconds: Math.max(0, Math.floor((now() - cached.generatedAt) / 1000)) },
    };
  }

  const snapshot = await loadOrJoinSnapshot(cache, options.beforeLoad, now);
  return {
    page: pageFromSnapshot(snapshot, group, limit, cursorData),
    cache: { status: "MISS" },
  };
}

export async function getCodes(
  group = "main",
  limit = 8,
  cursor?: string,
): Promise<CodePage> {
  const parsed = parseRealtimeCursor(cursor);
  return getCodesRealtime(group, limit, parsed);
}

async function getCodesRealtime(
  group: string,
  limit: number,
  parsed: ParsedCursor,
): Promise<CodePage> {
  const rows = await query<{
    total: number;
    codes: PublicCode[];
    has_more: boolean;
  }>(
    `WITH filtered AS MATERIALIZED (
       SELECT ${fields}
       FROM code_state
       WHERE moderation IN ('approved','needs_review') AND status = ANY($1::text[])
     ), page AS MATERIALIZED (
       SELECT * FROM filtered
       ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, md5(id::text || $2), id
       LIMIT $3 OFFSET $4
     ), page_result AS (
       SELECT
         COALESCE(
           json_agg(
             to_jsonb(page)
             ORDER BY CASE page.status WHEN 'active' THEN 0 ELSE 1 END,
               md5(page.id::text || $2), page.id
           ) FILTER (WHERE page.id IS NOT NULL),
           '[]'::json
         ) AS codes,
         COUNT(page.id)::int > $5::int AS has_more
       FROM (SELECT 1) AS anchor
       LEFT JOIN page ON true
     )
     SELECT (SELECT COUNT(*)::int FROM filtered) AS total, page_result.codes, page_result.has_more
     FROM page_result`,
    [
      group === "issues" ? ["likely_unavailable"] : ["active", "uncertain"],
      String(parsed.slot),
      limit + 1,
      parsed.offset,
      limit,
    ],
  );
  const page = rows[0];
  if (!page) throw new Error("DATABASE_ERROR");
  const codes = page.codes;
  return {
    codes: codes.slice(0, limit),
    total: page.total,
    cursor:
      page.has_more
        ? Buffer.from(
            JSON.stringify({ slot: parsed.slot, offset: parsed.offset + limit }),
          ).toString("base64url")
        : null,
  };
}
export async function initialCodes(): Promise<CodePage> {
  try {
    return (await getCodesWithCache()).page;
  } catch {
    return { codes: [], cursor: null, total: null, unavailable: true };
  }
}
export async function getPublicCode(id: string) {
  const rows = await query<PublicCode>(
    `SELECT ${fields} FROM code_state WHERE id=$1 AND moderation IN ('approved','needs_review') AND status<>'retired'`,
    [id],
  );
  return rows[0];
}
export async function getManaged(hash: string) {
  return query<ManagedCode>(
    `SELECT ${fields
      .split(",")
      .map((x) => "c." + x)
      .join(
        ",",
      )},c.moderation,c.retired_reason,c.review_note,c.fail_count FROM code_state c JOIN submissions s ON c.submission_id=s.id WHERE s.manage_hash=$1 ORDER BY c.created_at DESC`,
    [hash],
  );
}
