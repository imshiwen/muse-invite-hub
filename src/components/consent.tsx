"use client";
import { useEffect, useRef, useState } from "react";
import { publicPaths, SITE_URL } from "@/lib/config";
type Choice = { allowed: boolean; expires: number; version: 1 };
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
    hubAnalyticsReady?: boolean;
  }
}
const key = "mih-analytics-choice";
const needsConsent = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HU",
  "IE",
  "IS",
  "IT",
  "LI",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
  "GB",
  "CH",
]);
function readChoice(): Choice | null {
  try {
    const c = JSON.parse(localStorage.getItem(key) || "null");
    return c?.version === 1 &&
      c.expires > Date.now() &&
      typeof c.allowed === "boolean"
      ? c
      : null;
  } catch {
    return null;
  }
}
function cleanReferrer() {
  try {
    const r = new URL(document.referrer);
    return r.origin === SITE_URL && publicPaths.includes(r.pathname)
      ? r.origin + r.pathname
      : "";
  } catch {
    return "";
  }
}
export function track(name: string, params: Record<string, string> = {}) {
  if (!window.hubAnalyticsReady || !publicPaths.includes(location.pathname))
    return;
  const allowed = [
    "code_copy",
    "code_feedback",
    "code_submit",
    "official_join_click",
  ];
  if (!allowed.includes(name)) return;
  window.gtag?.("event", name, {
    ...params,
    page_location: SITE_URL + location.pathname,
    page_referrer: cleanReferrer(),
  });
}
export function CookieSettings() {
  return (
    <button
      className="text-button"
      onClick={() => window.dispatchEvent(new Event("hub-cookie-settings"))}
    >
      Cookie settings
    </button>
  );
}
export function Consent({
  measurementId,
  enabled,
}: {
  measurementId?: string;
  enabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState<string | null>(null);
  const latestChoice = useRef<Choice | null>(null);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("hub-cookie-settings", show);
    const officialClick = (event: MouseEvent) => {
      const anchor =
        event.target instanceof Element ? event.target.closest("a") : null;
      if (anchor && new URL(anchor.href).origin === "https://muse.ai")
        track("official_join_click");
    };
    document.addEventListener("click", officialClick);
    let disposed = false;
    if (enabled && measurementId && /^G-[A-Z0-9]+$/.test(measurementId)) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        // eslint-disable-next-line prefer-rest-params -- Official gtag queue shape.
        window.dataLayer.push(arguments);
      }; // Google's queue expects an arguments object.
      window.gtag("consent", "default", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        wait_for_update: 500,
      });
      window.gtag("set", "ads_data_redaction", true);
      window.gtag("set", "url_passthrough", false);
      const init = async () => {
        let country: string | null = null;
        try {
          const res = await fetch("/api/geo", {
            cache: "no-store",
            signal: AbortSignal.timeout(2500),
          });
          if (res.ok) {
            const data = await res.json();
            country = typeof data.country === "string" ? data.country : null;
          }
        } catch {}
        if (disposed) return;
        const saved = latestChoice.current ?? readChoice();
        setRegion(country);
        const requires = country !== null && needsConsent.has(country);
        const allow = saved ? saved.allowed : country !== null && !requires;
        window.gtag?.("consent", "update", {
          analytics_storage: allow ? "granted" : "denied",
        });
        if (requires && !saved) setOpen(true);
        window.gtag?.("js", new Date());
        window.gtag?.("config", measurementId, {
          send_page_view: false,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
          page_location: SITE_URL + location.pathname,
          page_referrer: cleanReferrer(),
        });
        window.gtag?.("event", "page_view", {
          page_location: SITE_URL + location.pathname,
          page_referrer: cleanReferrer(),
        });
        window.hubAnalyticsReady = true;
        const script = document.createElement("script");
        script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
        script.async = true;
        script.id = "hub-ga";
        document.head.appendChild(script);
      };
      void init();
    }
    return () => {
      disposed = true;
      window.removeEventListener("hub-cookie-settings", show);
      document.removeEventListener("click", officialClick);
    };
  }, [enabled, measurementId]);
  function choose(allowed: boolean) {
    const value: Choice = {
      allowed,
      expires: Date.now() + 180 * 86400000,
      version: 1,
    };
    latestChoice.current = value;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
    window.gtag?.("consent", "update", {
      analytics_storage: allowed ? "granted" : "denied",
    });
    setOpen(false);
  }
  if (!open) return null;
  return (
    <aside className="consent-banner" aria-label="Analytics cookie settings">
      <div>
        <strong>A little help understanding what works.</strong>
        <p>
          {enabled && measurementId
            ? "We use Google Analytics. Rejecting analytics cookies still allows limited, cookieless measurement."
            : "Analytics is not active in this environment. You can save your preference for this browser."}{" "}
          <a href="/privacy">Privacy details</a>
          {region === null && enabled && measurementId
            ? " Cookies stay off until you choose."
            : ""}
        </p>
      </div>
      <div className="consent-actions">
        <button className="button button-small" onClick={() => choose(true)}>
          Accept analytics cookies
        </button>
        <button
          className="button button-small button-outline"
          onClick={() => choose(false)}
        >
          Reject
        </button>
      </div>
    </aside>
  );
}
