# Musicosy DevPortal — Worklog

---
Task ID: auth-phase-1+2
Agent: main
Task: Supabase + Prisma auth/dashboard foundation

Work Log:
- Located Supabase creds in upload/MusicosyCREDS.md, deleted the file + gitignored /upload/
- Installed @supabase/ssr + @supabase/supabase-js
- Replaced Prisma schema with app-data models (ApiKey, ApiKeyEvent, UsageDaily, Webhook, WebhookDelivery, DeveloperProfile, AuditLog) — no User model (auth handled by Supabase)
- Created src/lib/supabase/{env,client,server,middleware,admin,index}.ts — four client shapes (browser/server/middleware/admin)
- Added src/middleware.ts — refreshes session, guards /dashboard/*, bounces logged-in users away from /signin
- Created src/lib/session.ts — getCurrentUser / requireUser / ensureDeveloperProfile helpers
- Created src/lib/api-keys.ts — generateApiKey + hashApiKey (sha-256) + findApiKeyByRawSecret
- Ported signin page from repos/landing-home → src/app/signin/page.tsx, restyled with Musicosy tokens (border/foreground/label-mono)
- Added src/app/auth/callback/route.ts for OAuth code exchange
- Built /dashboard layout (sidebar with Keys/Usage/Webhooks/Settings nav, sign-out button)
- Built /dashboard/page.tsx overview with key/webhook count stats
- Built /dashboard/keys with full create/list/reveal-once/revoke/roll flow + API routes
- Stubbed /dashboard/usage, /dashboard/webhooks, /dashboard/settings for Phase 3
- API routes: GET/POST /api/dashboard/keys, POST /api/dashboard/keys/[id]/{revoke,roll}
- Updated GetKeyCta + landing CTA to point at /signin?next=/dashboard/keys
- Ran `npx supabase init` + `npx supabase link --project-ref kcvjdxerjttjhrzygtrp`
- Ran `npx prisma db push` — all 7 tables created in Supabase Postgres
- Fixed export name mismatch (createClient vs createBrowserClient/createServerClient)

Phase 1 + 2 complete. Auth flow:
  /signin → Supabase auth → /dashboard (middleware-protected)

Stage Summary:
- 7 Prisma tables live in Supabase Postgres (api_keys, api_key_events, usage_daily, webhooks, webhook_deliveries, developer_profiles, audit_logs)
- 4 Supabase client shapes wired (browser/server/middleware/admin)
- Full API key lifecycle: create (reveal once) → list → roll (rotate secret) → revoke (soft delete)
- Audit log on every key action
- /dashboard/* fully auth-gated, redirects to /signin?next=<path> when unauthenticated

Known issues addressed in follow-up:
- Initial signin only had signInWithPassword — no sign-up flow. Fixed by adding mode toggle (signin/signup) with auto-fallback: if sign-in fails with "invalid credentials", tries sign-up automatically (and vice versa for "user already registered")
- Google/Apple OAuth not enabled in Supabase project — buttons now show clearer error pointing user to Supabase dashboard
- Email magic link button added as alternative that works out-of-box (no OAuth config needed)
- Email confirmation on by default in Supabase — UI now shows "check your inbox" message after sign-up if confirmation is required
