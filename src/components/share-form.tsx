"use client";
import { useState } from "react";
import { ArrowUpRight, Check, Copy, Link2 } from "lucide-react";
import {
  api,
  ensureVisitor,
  makeToken,
  copyText,
  message,
  temporaryGet,
  temporarySet,
  temporaryRemove,
} from "@/lib/client";
import { Turnstile } from "./turnstile";
import { track } from "./consent";
export function ShareForm() {
  const [code, setCode] = useState(""),
    [remaining, setRemaining] = useState(""),
    [agreed, setAgreed] = useState(false),
    [token, setToken] = useState(""),
    [reset, setReset] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<{ link: string; moderation: string } | null>(
      null,
    ),
    [copied, setCopied] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await ensureVisitor();
      let management: string;
      let idempotencyKey: string;
      let saved = null;
      try {
        saved = JSON.parse(temporaryGet("mih-pending-submit") || "null");
      } catch {}
      if (
        saved?.code === code.trim() &&
        saved?.remaining === remaining &&
        saved?.token &&
        saved?.idempotencyKey
      ) {
        management = saved.token;
        idempotencyKey = saved.idempotencyKey;
      } else {
        management = makeToken();
        idempotencyKey = crypto.randomUUID();
        temporarySet(
          "mih-pending-submit",
          JSON.stringify({
            code: code.trim(),
            remaining,
            token: management,
            idempotencyKey,
          }),
        );
      }
      const data = await api<{ moderation: string; replayed?: boolean }>(
        "/api/codes/submit",
        {
          code: code.trim(),
          remaining: remaining === "" ? null : Number(remaining),
          manageToken: management,
          idempotencyKey,
          turnstileToken: token,
          agreed,
        },
      );
      setResult({
        link: location.origin + "/manage/" + management,
        moderation: data.moderation,
      });
      temporaryRemove("mih-pending-submit");
      if (!data.replayed)
        track("code_submit", {
          status: data.moderation === "approved" ? "published" : "pending",
        });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
      setToken("");
      setReset((n) => n + 1);
    }
  }
  async function copy() {
    if (!result) return;
    try {
      await copyText(result.link);
      setCopied(true);
    } catch {
      setError("Select and copy the private link below.");
    }
  }
  if (result)
    return (
      <section className="form-card success-card">
        <span className="success-symbol">
          <Check />
        </span>
        <h2>
          {result.moderation === "approved"
            ? "A little possibility, passed on."
            : "Your code is in the review queue."}
        </h2>
        <p>
          {result.moderation === "approved"
            ? "Your code has been added to the community pool."
            : "We received your code. It will appear after review; you can check its status using your private link."}
        </p>
        <div className="save-link-box">
          <Link2 />
          <h3>Save your private management link.</h3>
          <p>
            You’ll need it to edit or remove your code. Anyone with this link
            can manage it. If you lose it, we can’t automatically recover it.
          </p>
          <input
            aria-label="Your private management link"
            readOnly
            value={result.link}
            onFocus={(e) => e.target.select()}
          />
          <button className="button" onClick={copy}>
            <Copy size={16} />
            {copied
              ? "Copied — save it somewhere safe"
              : "Copy management link"}
          </button>
        </div>
        <a
          className="button button-outline"
          href={result.link}
          onClick={() => temporaryRemove("mih-pending-submit")}
        >
          Open my management page <ArrowUpRight size={17} />
        </a>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </section>
    );
  return (
    <form className="form-card" onSubmit={submit}>
      <div className="form-card-heading">
        <span className="mini-logo">✳</span>
        <h2>Your next share starts here.</h2>
        <p>Just the code. We’ll take care of the rest.</p>
      </div>
      <label htmlFor="invite-code">Your Muse invite code</label>
      <input
        id="invite-code"
        name="code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
        maxLength={64}
        autoComplete="off"
        spellCheck={false}
        placeholder="Enter your code"
        className="code-input"
      />
      <p className="field-help">
        Copy it exactly as shown in Muse. Letter case is preserved.
      </p>
      <label htmlFor="remaining">
        Remaining redemptions <span className="optional">Optional</span>
      </label>
      <input
        id="remaining"
        type="number"
        min="0"
        max="100000"
        value={remaining}
        onChange={(e) => setRemaining(e.target.value)}
        placeholder="Leave blank if you’re not sure"
      />
      <p className="field-help">
        Shown as your estimate, never as guaranteed availability. Entering 0
        pauses the code.
      </p>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          required
        />
        <span>
          I have the right to share this code, and I’m offering it for free. I
          agree to the <a href="/terms">sharing rules</a>.
        </span>
      </label>
      <Turnstile action="submit" onToken={setToken} reset={reset} />
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button
        disabled={busy || !agreed}
        className="button full-width"
        type="submit"
      >
        {busy ? "Sharing your code…" : "Share my code"}
        <ArrowUpRight size={18} />
      </button>
      <p className="form-fineprint">
        You may receive tokens when someone redeems your code. Rewards and
        eligibility are determined by Muse.
      </p>
    </form>
  );
}
