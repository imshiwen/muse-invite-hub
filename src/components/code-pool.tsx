"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  Flag,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Clock3,
} from "lucide-react";
import type { CodePage, PublicCode } from "@/lib/types";
import { api, ensureVisitor, copyText, message } from "@/lib/client";
import { track } from "./consent";
import { Turnstile } from "./turnstile";
export function JourneyPicker() {
  const [choice, setChoice] = useState("");
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem("mih-journey") || "null");
      if (v?.expires > Date.now()) queueMicrotask(() => setChoice(v.value));
    } catch {}
  }, []);
  function select(value: string) {
    setChoice(value);
    try {
      localStorage.setItem(
        "mih-journey",
        JSON.stringify({ value, expires: Date.now() + 30 * 86400000 }),
      );
    } catch {}
  }
  return (
    <>
      <div className="journey-grid">
        <a
          className={choice === "new" ? "journey selected" : "journey"}
          href="/how-to-register"
          onClick={() => select("new")}
        >
          <span className="journey-icon">↗</span>
          <div>
            <strong>I’m new to Muse</strong>
            <span>Start with joining. No reward code needed.</span>
          </div>
          <ArrowUpRight size={17} />
        </a>
        <a
          className={choice === "ready" ? "journey selected" : "journey"}
          href="#codes"
          onClick={() => select("ready")}
        >
          <span className="journey-icon">✳</span>
          <div>
            <strong>I’m ready to redeem</strong>
            <span>Already joined? Find a community code.</span>
          </div>
          <ArrowUpRight size={17} />
        </a>
        <button
          className={choice === "done" ? "journey selected" : "journey"}
          onClick={() => select("done")}
        >
          <span className="journey-icon">✓</span>
          <div>
            <strong>I’ve already redeemed</strong>
            <span>You can still pass your own code along.</span>
          </div>
          <ArrowUpRight size={17} />
        </button>
      </div>
      {choice === "done" && (
        <p className="journey-response">
          Community reports describe one invite reward per recipient. You don’t
          need another code. <a href="/share">Share your own instead.</a>
        </p>
      )}
    </>
  );
}
function when(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}
function CodeCard({ code }: { code: PublicCode }) {
  const [copied, setCopied] = useState(false),
    [feedback, setFeedback] = useState(""),
    [notice, setNotice] = useState(""),
    [pending, setPending] = useState(false),
    [reporting, setReporting] = useState(false),
    [reason, setReason] = useState("selling"),
    [token, setToken] = useState(""),
    [reset, setReset] = useState(0);
  const full = code.code;

  useEffect(() => {
    const returned = () => {
      try {
        const v = JSON.parse(
          sessionStorage.getItem("mih-recent-copy") || "null",
        );
        if (v?.id === code.id && v.expires > Date.now() && !v.dismissed)
          setCopied(true);
      } catch {}
    };
    window.addEventListener("focus", returned);
    return () => window.removeEventListener("focus", returned);
  }, [code.id]);

  async function copy() {
    try {
      await copyText(full);
      setCopied(true);
      setNotice("");
      try {
        sessionStorage.setItem(
          "mih-recent-copy",
          JSON.stringify({ id: code.id, expires: Date.now() + 86400000 }),
        );
      } catch {}
      track("code_copy");
      void ensureVisitor()
        .then(() => api("/api/codes/" + code.id + "/copy", {}))
        .catch(() => {});
    } catch (e) {
      setNotice(message(e));
    }
  }

  async function report(result: "success" | "fail") {
    setPending(true);
    try {
      await ensureVisitor();
      const data = await api<{ changed: boolean }>(
        "/api/codes/" + code.id + "/report",
        { result },
      );
      setFeedback(result);
      try {
        sessionStorage.removeItem("mih-recent-copy");
      } catch {}
      if (data.changed) track("code_feedback", { result });
      setNotice("Thanks. Your feedback helps the next person.");
    } catch (e) {
      setNotice(message(e));
    } finally {
      setPending(false);
    }
  }

  function dismiss() {
    setCopied(false);
    try {
      sessionStorage.setItem(
        "mih-recent-copy",
        JSON.stringify({ id: code.id, dismissed: true }),
      );
    } catch {}
  }

  async function abuse(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await ensureVisitor();
      await api("/api/codes/" + code.id + "/report-abuse", {
        reason,
        turnstileToken: token,
      });
      setReporting(false);
      setNotice("Report received. We’ll review it.");
    } catch (e) {
      setNotice(message(e));
    } finally {
      setPending(false);
      setToken("");
      setReset((v) => v + 1);
    }
  }

  return (
    <article
      className={
        "code-row code-card " +
        (code.status === "likely_unavailable" ? "code-issues" : "")
      }
    >
      <div className="code-row-main">
        <div className="code-identity">
          <code className="code-text code-full">{full}</code>
          <span className="source-code">
            {code.source === "owner"
              ? "Site owner"
              : code.source === "community"
                ? "Community-sourced"
                : "Community submission"}
          </span>
        </div>
        <div className="code-state">
          <span className={"status status-" + code.status}>
            <span />
            {code.status === "active"
              ? "Recently reported working"
              : code.status === "likely_unavailable"
                ? "Recent reports of issues"
                : code.last_success
                  ? "No recent success reports"
                  : "Not yet confirmed"}
          </span>
          <span className="code-date">
            <Clock3 size={13} /> Shared {when(code.created_at)}
          </span>
          {code.remaining !== null && (
            <span className="code-remaining">
              {code.remaining} sharer-reported remaining
              {code.remaining_at ? " on " + when(code.remaining_at) : ""}; not
              live availability
            </span>
          )}
        </div>
        <div className="code-row-actions">
          <button
            type="button"
            className={"button copy-button " + (copied ? "button-copied" : "")}
            onClick={copy}
          >
            {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
            {copied ? "Copied" : "Copy code"}
          </button>
          <button
            type="button"
            className="icon-button"
            title="Report this code"
            aria-label="Report this code"
            aria-expanded={reporting}
            onClick={() => setReporting(!reporting)}
          >
            <Flag size={15} />
          </button>
        </div>
      </div>
      {copied && (
        <div className="feedback-box">
          <div className="feedback-heading">
            <strong>
              {feedback
                ? "Want to correct your feedback?"
                : "Redeem in Muse, then let us know."}
            </strong>
            <button className="text-button" onClick={dismiss}>
              {feedback ? "Close" : "Not yet"}
            </button>
          </div>
          <p>
            In Muse, look for the invite-code option in Settings.{" "}
            <a href="/redeem">See the steps</a>
          </p>
          <div className="feedback-actions">
            <button
              aria-pressed={feedback === "success"}
              disabled={pending}
              onClick={() => report("success")}
            >
              <ThumbsUp size={15} />
              Worked
            </button>
            <button
              aria-pressed={feedback === "fail"}
              disabled={pending}
              onClick={() => report("fail")}
            >
              <ThumbsDown size={15} />
              Didn’t work
            </button>
          </div>
        </div>
      )}
      {reporting && (
        <form
          id={"abuse-form-" + code.id}
          className="report-form"
          onSubmit={abuse}
        >
          <label htmlFor={"report-" + code.id}>What should we review?</label>
          <select
            id={"report-" + code.id}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="selling">Selling or charging for a code</option>
            <option value="misleading">Misleading or suspicious</option>
            <option value="other">Another issue</option>
          </select>
          <Turnstile action="abuse" onToken={setToken} reset={reset} />
          <button className="button button-small" disabled={pending}>
            Send report
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => setReporting(false)}
          >
            Cancel
          </button>
        </form>
      )}
      {notice && (
        <p className="inline-notice" role="status">
          {notice}
        </p>
      )}
    </article>
  );
}

export function CodePool({ initial }: { initial: CodePage }) {
  const [data, setData] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [issues, setIssues] = useState<CodePage | null>(null),
    [showIssues, setShowIssues] = useState(false);

  async function loadCodes(group = "main", reset = false) {
    setBusy(true);
    setError("");
    try {
      const current = group === "issues" ? issues : data;
      const params = new URLSearchParams({ limit: "8" });
      if (group === "issues") params.set("group", "issues");
      if (!reset && current?.cursor) params.set("cursor", current.cursor);
      const page = await api<CodePage>("/api/codes?" + params.toString());
      if (group === "issues") {
        setIssues((previous) =>
          reset || !previous ? page : appendPage(previous, page),
        );
      } else {
        setData((previous) => (reset ? page : appendPage(previous, page)));
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleIssues() {
    const nextShowIssues = !showIssues;
    setShowIssues(nextShowIssues);
    if (nextShowIssues && !issues) await loadCodes("issues");
  }

  return (
    <>
      <div className="code-list" aria-label="Available invite codes">
        <div className="pool-toolbar" aria-live="polite">
          <strong>Pick a code. It’s yours to copy.</strong>
          <span className="pool-count">
            {data.total === null
              ? "Code count unavailable"
              : `${data.total} shared ${data.total === 1 ? "code" : "codes"}`}
          </span>
        </div>
        {data.codes.map((code) => (
          <CodeCard key={code.id} code={code} />
        ))}
        {data.codes.length === 0 && (
          <div className="pool-empty">
            <p>
              {data.unavailable
                ? "The code list couldn’t load just now."
                : "No codes are available to show right now."}
            </p>
            <a href="/share" className="text-button">
              Share a code
            </a>
          </div>
        )}
      </div>
      <div className="pool-controls">
        {data.cursor ? (
          <button
            className="button button-small button-outline"
            disabled={busy}
            onClick={() => loadCodes()}
          >
            {busy ? "Loading…" : "Show more codes"}
          </button>
        ) : data.codes.length > 0 ? (
          <p className="pool-end">You’ve reached the end of this list.</p>
        ) : null}
        <button
          className="button button-small button-outline"
          disabled={busy}
          onClick={() => loadCodes("main", true)}
        >
          <RefreshCw size={15} /> Refresh list
        </button>
        <button
          className="button button-small button-outline"
          onClick={toggleIssues}
          disabled={busy}
        >
          {showIssues
            ? "Hide codes with reported issues"
            : "Show codes with recent issues"}
        </button>
      </div>
      {showIssues && (
        <div className="issues-section">
          <p>
            These codes have recent failure reports. That doesn’t necessarily
            mean they are full.
          </p>
          <div className="code-list" aria-label="Codes with recent issues">
            {issues?.codes.map((code) => (
              <CodeCard key={code.id} code={code} />
            ))}
            {issues?.codes.length === 0 && (
              <p className="pool-empty">No codes with recent issues to show.</p>
            )}
            {!issues && busy && (
              <p className="pool-empty">Loading codes with recent issues…</p>
            )}
          </div>
          {issues?.cursor ? (
            <button
              className="button button-small button-outline"
              disabled={busy}
              onClick={() => loadCodes("issues")}
            >
              {busy ? "Loading…" : "Show more reported codes"}
            </button>
          ) : issues?.codes.length ? (
            <p className="pool-end">You’ve reached the end of this list.</p>
          ) : null}
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function appendPage(current: CodePage, next: CodePage): CodePage {
  const seen = new Set(current.codes.map((code) => code.id));
  const codes = [...current.codes];
  for (const code of next.codes) {
    if (seen.has(code.id)) continue;
    seen.add(code.id);
    codes.push(code);
  }
  return { ...next, codes };
}
