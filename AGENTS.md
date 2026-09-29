# Muse Invite Hub

- Follow `/Users/vincent/AGENTS.md`.
- Canonical spec: `/Users/vincent/ShiWen/做站与跑站/MuseInviteHub/开发规格-Spec-v1.2.md`.
- Stack approved: Next.js + TypeScript, pnpm, Cloudflare Workers / OpenNext, Neon PostgreSQL.
- English public website. No AdSense. GA4 with regional consent. No analytics on management/admin.
- Never publish management tokens, IP/visitor hashes, admin email or private configuration in public APIs or analytics.
- No remote DB mutation, provisioning, auth changes or deployment without the specific authorization required by the global rules.
- Local PostgreSQL-compatible test database is PGlite, not a production database replacement. No fake successful redemptions.
- Use `pnpm check`, `pnpm test`, `pnpm build:worker` and browser verification before delivery; report unavailable external validation honestly.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
