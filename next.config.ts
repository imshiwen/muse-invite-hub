import type { NextConfig } from "next";
const security = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.google-analytics.com https://*.googletagmanager.com; font-src 'self'; connect-src 'self' https://challenges.cloudflare.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  },
];
const privateHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
];
const config: NextConfig = {
  poweredByHeader: false,
  logging: { incomingRequests: false },
  images: { unoptimized: true },
  async headers() {
    return [
      { source: "/:path*", headers: security },
      { source: "/manage/:path*", headers: privateHeaders },
      { source: "/admin/:path*", headers: privateHeaders },
      { source: "/api/:path*", headers: privateHeaders },
    ];
  },
};
export default config;
