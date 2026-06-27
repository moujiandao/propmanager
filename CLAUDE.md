# PropManager

## What This Is
A property management web application built with Next.js and Supabase. Provides landlords tools for managing rental properties, units, tenants, leases, payments, maintenance, and documents. Tenants get a separate portal for payments, maintenance requests, and profile management.

## Architecture
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Database & Auth**: Supabase (PostgreSQL + Auth + Storage)
- **Payments**: Stripe (ACH)
- **Email**: Resend
- **Styling**: Inline styles, **Inter** font (the in-app monolith loads it via inline `@import`; the public marketing/auth surfaces use `next/font` Inter + `app/globals.css`). The in-app palette is the `theme` object at the top of `property-management-app.jsx`; the public surfaces mirror it via `lib/theme.js` (`palette`/`btnStyle`)
- **Routing & public surface**: App Router **route groups** organize three surfaces (groups don't appear in URLs). `(marketing)` = public site: `/` (home) and `/pricing` (Free/Pro/Business flat tiers), light-themed server components. `(auth)` = `/login` (landlord/tenant role tabs; resolves role before navigating) and `/signup` (registers a free-tier landlord, auto-signs-in, lands on `/dashboard`). `(app)` = the monolith mounted at `/dashboard`, gated by a server-side auth guard in `app/(app)/dashboard/layout.js` (redirects to `/login?next=/dashboard` if no session). Shared brand mark in `app/_brand.jsx`, auth form primitives in `app/(auth)/_form.jsx`. `middleware.js` only refreshes the session cookie — gating lives in the dashboard layout, not middleware.
- **UI monolith**: `property-management-app.jsx` contains all landlord and tenant UI components. Mounted only at `/dashboard` and assumes an authed user (the login/signup screens were removed when the public auth routes were added). Navigation inside the dashboard is state-driven (`page` state), not URL-driven
- **Phase 2 components**: `phase2-components.jsx` (planned) will hold PropertyDetailPage, TenantContactPage, DocumentsPageV2
- **Email Automation components**: `email-automation-components.jsx` holds `EmailAutomationPage` (Templates / Automations / Inbox tabs) and `BatchSendModal` (the "Run now" human-review batch send: preview → per-recipient review/edit → mandatory confirm dialog → send, backed by the `/api/email/batches` routes). Imports shared UI from `property-management-app.jsx` (circular import, same pattern as phase2-components)
- **Maintenance module**: `lib/maintenance/` is an isomorphic ESM module (own `package.json`) that is the persistence seam for the maintenance aggregate: `core.js` (React-free write ops + soft/hard-delete rule, takes an injected adapter), `adapter.js` (real adapter over the anon Supabase client + maintenance routes; `fake.js` is the in-memory test double), `mappers.js` (the one home for the aggregate's snake→camel shape — `fetchAllData` imports these). The monolith calls it through a `useMaintenanceMutations(setData)` hook that owns optimistic update + rollback. `status.js` is the home for the Status vocabulary (`columnOf` board mapping, `isOpen` for "open requests" counts, `normalizeWriteStatus` server validation) — shared by the board, the dashboard counts, and the create route so they can't drift. Unit-tested via `npm test`. First slice of a per-entity data-access seam; other entities still write directly.
- **Email module**: `lib/email/` is an isomorphic ESM module (own `package.json` with `"type":"module"`) shared by the UI and server: `format.js`, `merge.js` (merge-tag rendering), `events.js` (event-date resolution), `context.js` (server snake→camel loaders), `audience.js` (`candidates`/`matchesScope` recipient matching, shared by the cron and the batch route so they never drift), `send.js` (Resend wrapper). Unit-tested via `npm test`
- **Email batch send (human review)**: `app/api/email/batches/` routes stage and send a reviewed batch from an automation. `route.js` (POST run-now: stage everyone matching the automation's event + scope as draft `email_messages` under one `email_batches` row, idempotent/resumable), `[id]/route.js` (PATCH per-recipient edits/adds/removes), `[id]/send/route.js` (POST: atomic `draft→queued` claim before each Resend send to prevent duplicates, no env kill-switch — the confirm dialog is the gate). The daily cron (`app/api/cron/email-automations`) stays the automatic path; this is the manual, human-gated path.
- **Lease-renewal (DocuSeal) feature**: `renewal-components.jsx` holds `RenewalsPage` (due queue → prepare → review gate → confirm-to-send), same circular-import pattern as the other component files. `lib/docuseal/` is an isomorphic ESM module (own `package.json`): `client.js` (DocuSeal API: create suppressed submission, release submitter, fetch signed PDF, HMAC webhook verify) and `renewal.js` (shared UTC term-derivation + original-lease-date selection, used by both the create route and the UI so they never drift). Unit-tested via `npm test`. Routes: `app/api/renewals/create`, `app/api/renewals/send`, `app/api/webhooks/docuseal`. Spec: `docs/docuseal-tenant-renewal-spec.md`. v1 excludes Phase 4 (Drive filing + auto lease-advance).
- **API routes**: `app/api/` for auth, payments, webhooks, and document operations
- **Supabase clients**: `lib/supabase/server.js` (service role), `lib/supabase/client.js` (anon key)
- **Auth callback**: `app/auth/callback/route.js` handles Supabase recovery/magic link flows

## Database Tables
- `landlord_profiles` - landlord accounts; one row per **team**, not per auth user. Carries commercialization plan state: `plan` (default `'free'`, CHECK free/pro/business) + nullable `subscription_status`/`stripe_customer_id`/`stripe_subscription_id` placeholders for Phase 2 Stripe subscription billing (`scripts/add-landlord-plan.sql`). Billing logic + plan gating are not built yet (Phase 2/3)
- `landlord_members` - maps `auth.users` to a `landlord_id` (a team). Multiple auth users can be members of the same team. Login resolves the active landlord_id via this table; **do not** assume `auth.uid() === landlord_id`. Use the SQL helper `is_team_member(landlord_id)` in RLS policies.
- `tenant_profiles` - tenant accounts linked to landlords, properties, and units
- `properties` - rental properties with address, type, unit count, Google Drive link
- `contracts` - lease agreements between tenants and properties
- `payments` - payment records with Stripe integration
- `maintenance_requests` - tenant-submitted maintenance requests. The landlord views these as the **To Do List** kanban board (Trello-style, 3 columns New/In Progress/Closed via `@dnd-kit`); drag-to-move writes `status`. Stored status values are unchanged (`new`/`in-progress`/`closed` + legacy `resolved`/`open`); the board maps them onto columns. The tenant portal still shows a plain submit-and-track list. Nav label is split: landlord = `navTodo` ("To Do List"), tenant = `navMaintenance` ("Maintenance")
- `email_settings` - landlord email automation config
- `units` (Phase 2) - individual units per property with bed/bath/rent
- `documents` (Phase 2) - uploaded files with AI-extracted metadata
- `email_templates` - named, reusable email templates with `{merge_tag}` placeholders
- `email_automations` - date-triggered rules: `event_type`, `offset_days[]`, `template_id`, `scope`, `enabled`
- `email_messages` - outbound send log + inbound replies; tracks delivery/open/reply status. Partial unique index `(automation_id, tenant_id, event_type, event_date, offset_days)` makes the cron idempotent (the index excludes `status='draft'` rows so batch drafts don't claim a send slot). `batch_id` links a row to a review batch
- `email_batches` - one row per "Run now" human-review send (`scripts/add-email-batches.sql`). Parent of draft `email_messages` rows; `status` (draft|sent|cancelled). The resumable review batch + audit record. RLS gated on `is_team_member(landlord_id)`
- `lease_renewals` - one row per renewal attempt (DocuSeal workflow). Serves as the review queue, the renewal chain, and the audit trail. Holds `original_lease_date` (immutable "X date" pinned at the chain root), derived new term, carried rent, `status` (draft|pending_review|sent|signed|countersigned|declined|blocked), `docuseal_submission_id`, and `signers` jsonb. RLS gated on `is_team_member(landlord_id)`

Note: `email_settings` (payment reminders) is a separate, older feature — the "Payment Reminders" nav item. The new "Email Automation" nav item is the `email_templates`/`email_automations`/`email_messages` system above. Keep them distinct.

## Key Conventions
- Naming: Next.js App Router conventions (page.js, layout.js, route.js)
- Files: pages in `app/`, API routes in `app/api/`, shared code in `lib/`
- Data mappers convert snake_case (Supabase) to camelCase (UI) in `property-management-app.jsx`
- Reusable UI components: Modal, Inp, Sel, Btn, Badge, Icon, PageHeader, StatCard, Toggle
- Bilingual support: English and Chinese via T object (landlord UI only)
- **Translation rule**: Every user-facing string in landlord UI JSX must be added to both `T.en` and `T.zh` in the T object at the top of `property-management-app.jsx` before use. Reference it as `t.keyName` — never hardcode visible text directly in JSX. When adding a new page or feature, add all its strings to both language blocks as the first step. This applies to **every** visible string the landlord can see: page titles, table headers, button labels, modal titles and bodies, confirmation prompts, empty-state messages, error/toast messages, badge text, placeholders, and tooltips. The only exceptions are dynamic data values from the database, brand names, and currency/date output already shaped by `fmt` / `fmtDate`.
- Run dev server: `npm run dev` (localhost:3000)

## Non-Obvious Decisions
- **Two routing models, by surface.** The public surfaces (marketing + auth, in route groups `(marketing)`/`(auth)`) are real Next.js route files with URL routing. The authed app is the opposite: the entire landlord/tenant UI lives in one JSX file (`property-management-app.jsx`), mounted at `/dashboard`, with **state-driven** navigation (`page` state variable), not per-view URLs. So "add a public page" = new route file; "add a dashboard view" = new case in `renderPage()`.
- `lib/supabase/server.js` uses the service role key (not anon key) for admin operations like creating/updating auth users.
- Google Drive links are stored per-property in `properties.drive_link` and embedded as iframes. Phase 2 adds Supabase Storage for direct file uploads.
- Tenant accounts are created by landlords via API (not self-service signup).
- **Landlord teams**: `user.id` in the client app is the **team's `landlord_id`**, not the auth user's id. `user.authId` holds the actual `auth.uid()`. Login resolves the team via `landlord_members`. Inserts that set `landlord_id` should always use `user.id`, never `user.authId`. RLS uses `is_team_member(landlord_id)`.

## Common Tasks
- **Run locally**: `npm install && npm run dev`
- **Add a dashboard view**: Add a case to `renderPage()` in `property-management-app.jsx` and a nav entry in `Sidebar`
- **Add a public (marketing/auth) page**: Create a route file under `app/(marketing)/` or `app/(auth)/`; reuse tokens from `lib/theme.js` and the `Logo` from `app/_brand.jsx` (keep marketing pages as server components so they don't pull in the client monolith)
- **Add an API route**: Create `app/api/<route>/route.js`
- **Add a data entity**: Add Supabase table, mapper function, fetch in `fetchAllData()`, and entry in `data` state

## Do Not
- Do not create separate Next.js page files for **authed app views** - use the state-driven navigation pattern in the monolith (mounted at `/dashboard`). This does NOT apply to the public marketing/auth surfaces, which are intentionally real route files.
- Do not use the anon key in server-side API routes that need admin access (use service role key via `lib/supabase/server.js`)
- Do not drop existing `unit` text columns when adding `unit_id` foreign keys - keep both for backward compatibility
- Do not hardcode visible strings in JSX - always add to T.en and T.zh first, then reference via `t.keyName`. Before reporting any landlord-UI change complete, grep your diff for hardcoded English strings (quoted text inside JSX, including `title=`, `placeholder=`, modal copy, error messages, and confirm dialogs). If you find any, add matching entries to both `T.en` and `T.zh` and replace the literals with `t.keyName`.
