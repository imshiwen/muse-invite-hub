"use client";
import { useEffect, useRef } from "react";
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}
export function Turnstile({
  action,
  onToken,
  reset = 0,
}: {
  action: string;
  onToken: (token: string) => void;
  reset?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  useEffect(() => {
    cb.current = onToken;
  }, [onToken]);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let widget: string | undefined;
    let disposed = false;
    function render() {
      if (disposed || !window.turnstile || !ref.current) return;
      widget = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        action,
        theme: "light",
        callback: (token: string) => cb.current(token),
        "expired-callback": () => cb.current(""),
        "error-callback": () => cb.current(""),
      });
    }
    if (window.turnstile) render();
    else {
      let script = document.getElementById(
        "turnstile-script",
      ) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = "turnstile-script";
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render, { once: true });
    }
    return () => {
      disposed = true;
      if (widget) window.turnstile?.remove(widget);
    };
  }, [siteKey, action, reset]);
  return <div ref={ref} className="turnstile-container" />;
}
