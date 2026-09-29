"use client";
import { useEffect, useState } from "react";
import type { ManagedCode } from "@/lib/types";
import { api, message } from "@/lib/client";
type AdminData = {
  codes: ManagedCode[];
  reports: {
    id: string;
    code_id: string;
    reason: string;
    note: string;
    created_at: string;
    resolved_at?: string | null;
  }[];
  stats: Record<string, number>;
  codePagination: { limit: number; offset: number; total: number };
  local?: boolean;
};
export function AdminLogin({ local }: { local: boolean }) {
  const [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/admin/login", { key });
      location.reload();
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }
  return (
    <div className="form-card login-card">
      <span className="eyebrow">Site administration</span>
      <h1 style={{ fontSize: 30 }}>A space for keeping the pool useful.</h1>
      {local ? (
        <>
          <p className="local-badge">Local development only</p>
          <p>
            Use the local admin key from your environment file. This login is
            disabled on the public website.
          </p>
          <form onSubmit={login}>
            <label htmlFor="admin-key">Local admin key</label>
            <input
              type="password"
              id="admin-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button className="button full-width" disabled={busy}>
              {busy ? "Signing in…" : "Sign in locally"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p>
            This area requires the site owner’s Cloudflare Access session. If
            you’ve already signed in, check the Access application configuration
            and try again.
          </p>
          <a href="/admin" className="button">
            Try the protected admin page
          </a>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function AdminPanel({ local }: { local: boolean }) {
  const [data, setData] = useState<AdminData | null>(null),
    [filter, setFilter] = useState("all"),
    [draft, setDraft] = useState(""),
    [queryText, setQueryText] = useState(""),
    [offset, setOffset] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load(f = filter, q = queryText, start = offset) {
    try {
      const params = new URLSearchParams({
        limit: "50",
        offset: String(start),
      });
      if (q) params.set("q", q);
      if (f === "pending") params.set("moderation", "pending");
      if (f === "review") params.set("moderation", "needs_review");
      if (f === "retired") params.set("status", "retired");
      setData(await api<AdminData>("/api/admin?" + params));
      setOffset(start);
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }
  useEffect(() => {
    void api<AdminData>("/api/admin?limit=50")
      .then(setData)
      .catch((e) => setError(message(e)));
  }, []);
  async function act(action: string, id: string, reason: string) {
    setBusy(true);
    try {
      await api("/api/admin/actions", { action, id, reason });
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (local) {
      try {
        await api("/api/admin/logout", {});
        location.reload();
      } catch (e) {
        setError(message(e));
      }
    } else location.assign("/cdn-cgi/access/logout");
  }
  const codes = data?.codes || [];
  const filtered = codes;
  return (
    <>
      <div className="admin-toolbar">
        <div>
          <span className="eyebrow">Site administration</span>
          <h1>A useful pool starts here.</h1>
        </div>
        <button className="button button-outline" onClick={logout}>
          Sign out
        </button>
      </div>
      {local && (
        <p className="local-badge">
          Local environment — no changes to the live site
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-stats">
        {[
          ["Total codes", data?.stats.codes_total || 0],
          ["Waiting for review", data?.stats.pending || 0],
          ["Reported for review", data?.stats.needs_review || 0],
          ["Open reports", data?.stats.open_reports || 0],
        ].map(([label, n]) => (
          <div className="admin-stat" key={String(label)}>
            <strong>{n}</strong>
            {label}
          </div>
        ))}
      </div>
      <div className="admin-filter">
        {[
          ["all", "All codes"],
          ["pending", "Pending"],
          ["review", "Needs review"],
          ["retired", "Hidden"],
        ].map(([v, label]) => (
          <button
            key={v}
            aria-pressed={filter === v}
            onClick={() => {
              setFilter(v);
              void load(v, queryText, 0);
            }}
          >
            {label}
          </button>
        ))}
        <button onClick={() => load()}>Refresh</button>
      </div>
      <form
        className="inline-form admin-search"
        onSubmit={(e) => {
          e.preventDefault();
          setQueryText(draft.trim());
          void load(filter, draft.trim(), 0);
        }}
      >
        <div>
          <label htmlFor="admin-search">Find a code or record ID</label>
          <input
            id="admin-search"
            maxLength={64}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search all submissions"
          />
        </div>
        <button className="button button-small">Search</button>
      </form>
      {!data && !error && <p>Loading submissions…</p>}
      {data && filtered.length === 0 && (
        <div className="empty-pool">
          <h3>Nothing waiting here.</h3>
          <p>This queue is clear.</p>
        </div>
      )}
      {filtered.map((c) => (
        <AdminRow
          key={c.id}
          code={c}
          reports={
            data?.reports?.filter(
              (r) => r.code_id === c.id && !r.resolved_at,
            ) || []
          }
          busy={busy}
          act={act}
        />
      ))}
      <div className="pool-controls">
        <button
          className="button button-outline"
          disabled={offset === 0}
          onClick={() => load(filter, queryText, Math.max(0, offset - 50))}
        >
          Previous page
        </button>
        <p>{data?.codePagination.total || 0} matching codes</p>
        <button
          className="button button-outline"
          disabled={!data || offset + 50 >= data.codePagination.total}
          onClick={() => load(filter, queryText, offset + 50)}
        >
          Next page
        </button>
      </div>
    </>
  );
}
function AdminRow({
  code,
  reports,
  busy,
  act,
}: {
  code: ManagedCode;
  reports: AdminData["reports"];
  busy: boolean;
  act: (action: string, id: string, reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  function run(action: string) {
    if (["reject", "retire", "restore"].includes(action) && !reason.trim()) {
      alert("Please enter a brief reason for the audit log.");
      return;
    }
    void act(action, code.id, reason.trim());
  }
  return (
    <article className="admin-row">
      <div className="admin-row-top">
        <h3>{code.code}</h3>
        <div>
          <span className="pill">{code.moderation}</span>{" "}
          <span className="pill">{code.status}</span>
        </div>
      </div>
      <p>
        {code.copy_count} counted copies · {code.work_count} success reports ·{" "}
        {code.fail_count} recent failures
      </p>
      {code.review_note && <p>Owner-visible note: {code.review_note}</p>}
      {reports.map((r) => (
        <div className="callout" key={r.id}>
          <strong>{r.reason}</strong>
          {r.note && <p>{r.note}</p>}
          <p>{new Date(r.created_at).toLocaleString("en")}</p>
        </div>
      ))}
      <label htmlFor={"reason-" + code.id}>Reason / owner-visible note</label>
      <input
        id={"reason-" + code.id}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        placeholder="Required for reject, hide or restore"
      />
      <div className="management-actions">
        {code.moderation === "pending" && (
          <button
            disabled={busy}
            className="button button-small"
            onClick={() => run("approve")}
          >
            Approve
          </button>
        )}
        <button
          disabled={busy}
          className="button button-small button-outline"
          onClick={() => run("reject")}
        >
          Reject
        </button>
        <button
          disabled={busy}
          className="button button-small button-outline"
          onClick={() => run("retire")}
        >
          Hide
        </button>
        <button
          disabled={busy || code.retired_reason === "replaced"}
          className="button button-small button-outline"
          onClick={() => run("restore")}
        >
          Restore
        </button>
        {reports.length > 0 && (
          <button
            disabled={busy}
            className="button button-small button-outline"
            onClick={() => run("resolve")}
          >
            Resolve reports
          </button>
        )}
      </div>
    </article>
  );
}
