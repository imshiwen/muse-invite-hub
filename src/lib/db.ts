import { neon } from "@neondatabase/serverless";
import { isLocal } from "./config";
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (isLocal() && process.env.LOCAL_DB_URL) {
    const url = new URL(process.env.LOCAL_DB_URL);
    if (!["localhost", "127.0.0.1"].includes(url.hostname))
      throw new Error("Local database must use loopback");
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LOCAL_DB_KEY}`,
      },
      body: JSON.stringify({ text, params }),
      cache: "no-store",
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "DATABASE_ERROR");
    return data.rows as T[];
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_UNAVAILABLE");
  const sql = neon(process.env.DATABASE_URL);
  return (await sql.query(text, params)) as T[];
}
export async function action(
  kind: string,
  data: Record<string, unknown>,
  actor: string,
  ip: string | null,
) {
  const rows = await query<{ result: Record<string, unknown> }>(
    "SELECT hub_action($1,$2::jsonb,$3,$4) AS result",
    [kind, JSON.stringify(data), actor, ip],
  );
  return rows[0].result;
}
export async function rate(key: string, limit: number, seconds: number) {
  const [row] = await query<{ ok: boolean }>(
    "SELECT take_rate($1,$2,$3) AS ok",
    [key, limit, seconds],
  );
  return row.ok;
}
