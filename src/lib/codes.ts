import { query } from "./db";
import type { PublicCode, CodePage, ManagedCode } from "./types";
const fields =
  "id,code,status,source,remaining,remaining_at,created_at,last_success,work_count,copy_count";
export async function getCodes(
  group = "main",
  limit = 8,
  cursor?: string,
): Promise<CodePage> {
  let parsed: { slot: number; offset: number };
  try {
    if (cursor && !/^[A-Za-z0-9_-]{1,512}$/.test(cursor))
      throw new Error("INVALID_CURSOR");
    parsed = cursor
      ? JSON.parse(Buffer.from(cursor, "base64url").toString())
      : { slot: Math.floor(Date.now() / 300000), offset: 0 };
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("INVALID_CURSOR");
  } catch {
    throw new Error("INVALID_CURSOR");
  }
  if (
    !Number.isSafeInteger(parsed.slot) ||
    !Number.isSafeInteger(parsed.offset) ||
    parsed.offset < 0 ||
    parsed.offset > 10000 ||
    Math.abs(parsed.slot - Math.floor(Date.now() / 300000)) > 12
  )
    throw new Error("INVALID_CURSOR");
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
            JSON.stringify({
              slot: parsed.slot,
              offset: parsed.offset + limit,
            }),
          ).toString("base64url")
        : null,
  };
}
export async function initialCodes(): Promise<CodePage> {
  try {
    return await getCodes();
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
