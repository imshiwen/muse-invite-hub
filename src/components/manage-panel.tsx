"use client";
import { useState, useEffect } from "react";
import { Copy, Link2, RefreshCw } from "lucide-react";
import type { ManagedCode } from "@/lib/types";
import { Turnstile } from "./turnstile";
import {
  api,
  copyText,
  makeToken,
  message,
  temporaryGet,
  temporarySet,
  temporaryRemove,
} from "@/lib/client";
export function ManagePanel({
  token,
  initial,
}: {
  token: string;
  initial: ManagedCode[];
}) {
  const [codes, setCodes] = useState(initial),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [link, setLink] = useState("");
  useEffect(() => {
    queueMicrotask(() => setLink(location.origin + "/manage/" + token));
  }, [token]);
  async function refresh() {
    const data = await api<{ codes: ManagedCode[] }>(`/api/manage/${token}`);
    setCodes(data.codes);
  }
  async function act(data: Record<string, unknown>) {
    setBusy(true);
    setNotice("");
    try {
      await api(`/api/manage/${token}`, data);
      await refresh();
      setNotice("Your changes have been saved.");
    } catch (e) {
      setNotice(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await copyText(link);
      setNotice("Copied. Save your private link somewhere safe.");
    } catch {
      setNotice("Select and copy the complete management link above.");
    }
  }
  async function rotate() {
    if (
      !confirm(
        "Replace your private management link? The old link will stop working. Save the new link after this step.",
      )
    )
      return;
    setBusy(true);
    setNotice("");
    try {
      const key = "mih-rotate-" + token.slice(0, 12);
      let stored = JSON.parse(temporaryGet(key) || "null");
      if (!stored) {
        stored = { token: makeToken(), idempotencyKey: crypto.randomUUID() };
        temporarySet(key, JSON.stringify(stored));
      }
      const newToken = stored.token;
      try {
        await api(`/api/manage/${token}`, {
          action: "rotate_token",
          newToken,
          idempotencyKey: stored.idempotencyKey,
        });
      } catch (e) {
        const recovered = await api<{ codes: ManagedCode[] }>(
          `/api/manage/${newToken}`,
        ).catch(() => null);
        if (!recovered?.codes.length) throw e;
      }
      temporaryRemove(key);
      location.assign("/manage/" + newToken);
    } catch (e) {
      setNotice(message(e));
      setBusy(false);
    }
  }
  return (
    <>
      <div className="private-notice">
        <div>
          <Link2 size={24} />
          <h2>Save your private management link.</h2>
          <p>
            You’ll need it to edit or remove your code. Anyone with this link
            can manage this submission. If you lose it, we can’t automatically
            recover it.
          </p>
        </div>
        <div>
          <input
            aria-label="Your private management link"
            value={link}
            readOnly
            onFocus={(e) => e.target.select()}
          />
          <button className="button button-small full-width" onClick={copy}>
            <Copy size={16} />
            Copy management link
          </button>
        </div>
      </div>
      {notice && (
        <p className="callout" role="status">
          {notice}
        </p>
      )}
      <div className="management-grid">
        {codes.map((c) => (
          <ManageCard key={c.id} code={c} busy={busy} act={act} />
        ))}
      </div>
      <div className="private-bottom">
        <button
          className="text-button"
          onClick={() => refresh().catch((e) => setNotice(message(e)))}
        >
          <RefreshCw size={14} /> Refresh status
        </button>
        <button className="text-button" disabled={busy} onClick={rotate}>
          Replace management link
        </button>
        <a href="/contact">Need help?</a>
      </div>
    </>
  );
}
function ManageCard({
  code,
  busy,
  act,
}: {
  code: ManagedCode;
  busy: boolean;
  act: (v: Record<string, unknown>) => Promise<void>;
}) {
  const [remaining, setRemaining] = useState(
      code.remaining === null ? "" : String(code.remaining),
    ),
    [replacement, setReplacement] = useState(""),
    [captcha, setCaptcha] = useState(""),
    [replaceOpen, setReplaceOpen] = useState(false),
    [agreed, setAgreed] = useState(false),
    [reset, setReset] = useState(0);
  const locked =
    code.retired_reason === "admin" ||
    code.retired_reason === "replaced" ||
    code.moderation === "rejected";
  return (
    <article className="management-card">
      <h2>{code.code}</h2>
      <span className="pill">
        {code.moderation === "approved"
          ? "Published"
          : code.moderation === "needs_review"
            ? "Under review"
            : code.moderation === "pending"
              ? "Pending review"
              : "Not approved"}
      </span>
      <span className="pill">
        {code.status === "retired"
          ? "Paused / hidden"
          : code.status.replaceAll("_", " ")}
      </span>
      {code.review_note && <p className="form-error">{code.review_note}</p>}
      <div className="management-stats">
        <span>
          <strong>{code.copy_count}</strong>Counted copies
        </span>
        <span>
          <strong>{code.work_count}</strong>Success reports
        </span>
      </div>
      <p className="field-help">
        Copies and feedback are not confirmed redemptions. We can’t see live
        availability in Muse.
      </p>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          void act({
            action: "quota",
            id: code.id,
            remaining: remaining === "" ? null : Number(remaining),
          });
        }}
      >
        <div>
          <label htmlFor={"quota-" + code.id}>
            Your estimate of remaining redemptions
          </label>
          <input
            id={"quota-" + code.id}
            type="number"
            min="0"
            max="100000"
            value={remaining}
            onChange={(e) => setRemaining(e.target.value)}
            placeholder="Unknown"
          />
        </div>
        <button className="button button-small" disabled={busy}>
          Save estimate
        </button>
      </form>
      <div className="management-actions">
        {code.status !== "retired" ? (
          <button
            className="button button-outline"
            disabled={busy || locked}
            onClick={() => act({ action: "pause", id: code.id })}
          >
            Pause display
          </button>
        ) : (
          <button
            className="button button-outline"
            disabled={busy || locked || code.moderation === "pending"}
            onClick={() => act({ action: "resume", id: code.id })}
          >
            Resume display
          </button>
        )}
      </div>
      {locked && (
        <p className="field-help">
          This record cannot be restored here. Contact support if you need help.
        </p>
      )}
      {!locked && (
        <details
          className="manage-extra"
          onToggle={(e) => setReplaceOpen(e.currentTarget.open)}
        >
          <summary>Replace this code</summary>
          <p>
            This pauses the old code and submits a new one for review. Old
            feedback won’t carry over.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (confirm("Replace this code and send the new one for review?"))
                void act({
                  action: "replace",
                  id: code.id,
                  code: replacement.trim(),
                  turnstileToken: captcha,
                  agreed,
                }).finally(() => {
                  setCaptcha("");
                  setReset((n) => n + 1);
                });
            }}
          >
            <label htmlFor={"replace-" + code.id}>New code</label>
            <input
              id={"replace-" + code.id}
              required
              maxLength={64}
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              autoComplete="off"
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                required
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span>
                I have the right to share this replacement code for free.
              </span>
            </label>
            <div style={{ marginTop: 12 }}>
              {replaceOpen && (
                <Turnstile action="submit" onToken={setCaptcha} reset={reset} />
              )}
            </div>
            <button
              className="button button-small"
              disabled={busy}
              style={{ marginTop: 12 }}
            >
              Submit replacement
            </button>
          </form>
        </details>
      )}
    </article>
  );
}
