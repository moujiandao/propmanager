# Changelog

## [2026-06-20]

### Added
- Email Automation human-review batch send ("Run now"). New `email_batches` table (`scripts/add-email-batches.sql`) plus `email_messages.batch_id`; the dedup unique index now excludes drafts (`status <> 'draft'`) so staged drafts never claim a send slot. New routes `app/api/email/batches` (run-now: stage everyone matching an automation's event + scope, idempotent/resumable draft batch), `app/api/email/batches/[id]` (PATCH per-recipient edit/add/remove), and `app/api/email/batches/[id]/send` (claim-before-send via atomic `draft→queued` compare-and-swap, then Resend). New `lib/email/audience.js` extracts `candidates`/`matchesScope` from the cron so both share one matcher (tests in `lib/email/audience.test.mjs`). New UI `email-automation-components.jsx → BatchSendModal`: preview → per-recipient review/edit → mandatory confirmation dialog → send, with 30 bilingual `T.en`/`T.zh` keys. Draft rows filtered out of `fetchAllData` so they never appear in the Inbox. No env kill-switch — the confirmation dialog is the send gate. Spec: `docs/superpowers/specs/2026-06-20-email-batch-review-send-design.md`.
- DocuSeal tenant lease-renewal workflow (v1). New `lease_renewals` table (`scripts/add-lease-renewals.sql`) with `is_team_member` RLS, serving as review queue + renewal chain + audit trail. New `lib/docuseal/` ESM module: `client.js` (create email-suppressed submission, release submitter to send, fetch signed PDF, HMAC-SHA256 webhook verification) and `renewal.js` (shared UTC term-derivation + original-lease-date chain selection). New routes `app/api/renewals/create`, `app/api/renewals/send`, `app/api/webhooks/docuseal`. New UI `renewal-components.jsx → RenewalsPage` (due queue within ~150 days of `end_date`, placeholder-email blocking, prepare → review → confirm-to-send gate, status badges), wired into the monolith (nav, `renderPage`, `mapLeaseRenewal`, `fetchAllData`, 43 bilingual `T.en`/`T.zh` keys). Unit tests in `lib/docuseal/*.test.mjs` (`npm test` glob widened). v1 excludes Phase 4 (Google Drive filing of the signed PDF + auto lease-term advance), deferred. Spec: `docs/docuseal-tenant-renewal-spec.md`.

### Changed
- Unified renewal term math: the create route and `RenewalsPage` now share `lib/docuseal/renewal.js` (UTC-based, end-of-month clamped) instead of duplicating logic; fixes a local-timezone off-by-one that the client-side version could produce in negative-UTC regions.

## [2026-06-19]

### Added
- Spec for the DocuSeal tenant lease-renewal workflow (`docs/docuseal-tenant-renewal-spec.md`): date-surfaced renewal review queue, DocuSeal-rendered draft with a confirm-to-send gate, tenants-then-landlord signing order, email-based match-back, and a new `lease_renewals` chain table. v1 excludes Phase 4 (Google Drive filing + auto lease-term advance), tracked as deferred.

## [2026-06-17]

### Added
- Tenant record audit timestamps: `updated_at` column on `tenant_profiles` (`scripts/add-tenant-timestamps.sql`) with a reusable `set_updated_at()` trigger that bumps it on every UPDATE. The Tenant Detail view (`phase2-components.jsx → TenantContactPage`) now shows "Account Created" and "Last Updated" rows; `mapTenant` exposes `createdAt`/`updatedAt`.
- Dashboard "new tenants" banner: surfaces tenants created within the last 7 days (by `created_at`) as clickable links to their detail page. Dismissible via "×"; dismissal persists per-tenant-id in `localStorage` (`propmanager_dismissed_new_tenants`), so the banner reappears for newly added tenants but stays hidden for acknowledged ones.
- Security deposit refund tracking: new `security_deposit_refunded` boolean on `tenant_profiles` (`scripts/add-deposit-refunded.sql`). The Tenants tab swaps its deposit column by filter — "Security Deposit" (amount / "Not received") for Current Tenants, an inline "Security Deposit Refunded" checkbox for Past Tenants (persists via new `app/api/auth/set-deposit-refunded` route with optimistic UI). Field also added to the Add/Edit tenant modals, the Tenant Detail page (`phase2-components.jsx`), `mapTenant`, and the create/update-tenant routes.

## [2026-06-12]

### Changed
- Figma-inspired theme refresh across all UI (`property-management-app.jsx`, `phase2-components.jsx`, `email-automation-components.jsx`): removed indigo brand accent in favor of neutral near-black (`#111`), neutralized slate grays, softened borders to 1px hairline (`#eaeaea`), standardized radii (buttons/inputs 8, cards/modals 12), flattened primary buttons (solid black), and added a `theme` token constant in `property-management-app.jsx`. Recolored `pending`/`in-progress` status badges from indigo to amber. Converted the three previously dark Phase 2 pages (property detail, documents, tenant contact) to the light theme; the sidebar and login remain dark (neutralized). Design spec: `docs/superpowers/specs/2026-06-12-figma-theme-design.md`.

### Added
- Tenants tab: persistent status filter ("Current Tenants" / "Past Tenants"). Defaults to Current Tenants (current + future statuses); Past Tenants shows previous tenants only. Selection persists across sessions via `localStorage` (`propmanager_tenant_status_filter`).

## [2026-06-11]

### Added
- Tenants tab: persistent property filter. Chips at the top toggle each property (and an "Unassigned" group) visible/hidden, with Show all / Hide all shortcuts. Selection persists across sessions via `localStorage` (`propmanager_tenant_hidden_props`, stores hidden ids so new properties show by default).
- Dashboard Unit Transitions: single Expand all / Collapse all toggle in the section header.

### Changed
- Tenants tab grouped view restructured into a property → unit → tenant hierarchy: each property is a top-level section with its units (and their current/future tenants) nested underneath, plus per-property unit/tenant counts and total monthly rent.
- Dashboard AI summary prompt now names the specific maintenance problem from the request description (e.g. "Kitchen: faucet leaking") instead of just the category, falling back to "<type> issue" when no description exists.

## [2026-06-01]

### Added
- Email Automation feature (new "Email Automation" nav item, separate from the existing payment-reminder page which is now labelled "Payment Reminders"). Lets landlords send tenants date-triggered reminder emails before move-out, move-in, lease-end, projected move-out, and rent-due events.
  - New tables (migration: `scripts/email-automation.sql` / `.mjs`): `email_templates` (named reusable templates with `{merge_tag}` placeholders), `email_automations` (event type + `offset_days[]` + template + scope + enabled), and `email_messages` (outbound send log + inbound replies + open/delivery/reply tracking). All landlord-scoped via `is_team_member` RLS; a partial unique index on `email_messages` guarantees idempotent automated sends.
  - Shared isomorphic module `lib/email/` (its own `package.json` marks it ESM): `format.js` (extracted `fmt`/`fmtDate` + `daysBetween`), `merge.js` (`MERGE_TAGS`, `buildContext`, `renderTemplate`), `events.js` (event-date resolution), `context.js` (server-side snake→camel loaders), `send.js` (Resend wrapper with From/Reply-To/List-Unsubscribe/multipart). Unit tests in `merge.test.mjs` (run via `npm test`).
  - New API routes: `app/api/email/test-send` (preview to a dummy address, logged `is_test`), `app/api/email/send-now` (manual send to a tenant), `app/api/cron/email-automations` (daily Vercel cron, `CRON_SECRET`-guarded, idempotent), `app/api/webhooks/resend` (Svix-verified delivery/open/bounce events + inbound reply correlation).
  - New UI in `email-automation-components.jsx` (`EmailAutomationPage`): Templates manager (merge-tag insertion + live preview), Automations manager (event/offsets/template/scope/enable + test send), and Inbox/Activity (sent emails with delivery/opened/replied status and reply threads). New bilingual `T` keys in `property-management-app.jsx`.
  - New `vercel.json` schedules the cron daily at 15:00 UTC.
  - Requires infra setup before live use: verified Resend sending domain + SPF/DKIM/DMARC (and MX for inbound replies), env vars `CRON_SECRET`, `RESEND_WEBHOOK_SECRET`, `RESEND_REPLY_DOMAIN`, and `RESEND_FROM_EMAIL` repointed to the verified domain.
- Threaded comments on maintenance requests. New `maintenance_comments` table (migration: `scripts/add-maintenance-comments.mjs`) with one level of reply nesting (`parent_comment_id`), cached Chinese translation (`body_zh`), author attribution (`author_type`/`author_id`/`author_name`), and soft-delete (`deleted_at`). RLS scopes reads/inserts to the landlord team (`is_team_member`) and the request's tenant; hard delete is restricted to the comment's own author.
- Shared `CommentThread` component in `property-management-app.jsx`, rendered on both the landlord `MaintenancePage` and the tenant `TenantMaintenancePage`. Supports posting, one-level replies, per-comment "Translate to Chinese" (reusing `/api/maintenance/translate`), and delete-own (hard-delete leaves, soft-hide parents with replies). Comments load via `fetchAllData` into `data.maintenanceComments`.
- Bilingual `T` keys for comment UI chrome (`commentsHeading`, `commentsShow`, `commentReply`, `commentPost`, `commentDelete`, `commentDeleted`, etc.); tenant portal uses inline English labels per its existing convention.

### Changed
- Property detail page unit cards now show each tenant's full name (first + last) instead of first name only.
- Dashboard Unit Transitions rows now show a hover background highlight to make them more obviously clickable.
- Payments tab filters to current tenants only.

## [2026-05-26]

### Changed
- Dashboard AI summary now caches the last generated text in `localStorage` keyed by user id, along with the active language and a fingerprint of every input field (tenants, payments, maintenance, properties, units, plus today's date). On reload, if the cached language and fingerprint still match, the cached summary is shown immediately and no LLM call fires. Regenerate always bypasses the cache.
- Auto-gen on dashboard mount is now gated on a new `langReady` flag in `App` so it can't fire with the default "zh" before the user's localStorage lang preference is restored.

### Added
- `app/api/dashboard/summary/route.js` — landlord dashboard AI summary endpoint. Fetches the team's tenants, contracts, payments, maintenance, properties, and units via the service-role Supabase client, derives a structured facts object (move-ins / move-outs in the next 30 days, units needing a tenant within 60 days, previous-month unpaid rent, cleanings to schedule, open maintenance), then calls Claude Haiku for a per-unit shorthand briefing. When the request lang is `zh`, a second Claude pass translates the English briefing into natural mainland-China Mandarin while preserving absolute dates and English tenant/property names.
- `LandlordDashboard`: new "What needs your attention" card at the top of the dashboard with a Generate/Regenerate button, loading/empty/error states, and a generated-at timestamp. Output is grouped per unit, sorted by earliest upcoming event date.
- Bilingual T keys for the summary UI chrome (`dashSummaryTitle`, `dashSummaryGenerate`, `dashSummaryRegenerate`, `dashSummaryLoading`, `dashSummaryEmpty`, `dashSummaryError`, `dashSummaryGeneratedAt`) and a `sparkles` icon.
- Language preference now persists in `localStorage` (`propmanager_lang`) so the chosen UI language survives reloads.

### Changed
- Unit Transitions section: each row is now collapsible (▸/▾) so the dashboard isn't dominated by transition detail by default.
- `dashGapUnresolved` label clarified to "Need to find new tenant(s)" / "需要寻找新租客" (was the vaguer "Unresolved" / "未确定").

## [2026-05-02]

### Added
- `landlord_members` table: maps `auth.users` rows to a shared `landlord_id`, enabling multiple auth users to manage the same team's properties, tenants, leases, and payments
- `is_team_member(uuid)` SQL helper used by RLS policies in place of `auth.uid() = landlord_id` checks
- `scripts/migrate-team-landlords.sql`: collapses three landlord_profiles into one canonical team id, repoints all data, and rewrites RLS policies to be membership-based
- `scripts/backup-tables.mjs`, `scripts/inventory-landlords.mjs`, `scripts/check-email.mjs`: pre-migration snapshot + diagnostic helpers
- `app/api/auth/register-landlord` now also inserts a self-membership row so newly-registered landlords can authenticate via the new lookup path

### Changed
- Login + session restore (`property-management-app.jsx`) resolve the landlord profile via `landlord_members` instead of looking up `landlord_profiles` directly by `auth.uid()`. This is what lets the secondary team auth users (techservices97, waynemar92) sign in and see the canonical landlord's data.

## [2026-05-01]

### Added
- `app/api/contracts/create/route.js` — service-role POST that inserts a contract plus its `contract_tenants` links, replacing the browser-side insert that RLS now blocks

### Fixed
- Add Lease modal: "Create Lease" silently failed because the browser-side `supabase.from("contracts").insert` was rejected by tightened RLS; now routes through the new API and surfaces inline errors
- Add Tenant modal: failures from `/api/auth/create-tenant` were silently swallowed; the modal now surfaces the server's error message inline
- `/api/auth/create-tenant` recovers from orphaned auth users left by prior failed attempts: if Supabase Auth says the email is already registered and that user has no `tenant_profiles` or `landlord_profiles` row, the orphan's auth id is reused for the new profile (password is updated if one was provided). On profile-insert failure for a freshly created auth user, that auth user is now deleted to prevent new orphans.

## [2026-04-30]

### Added
- Dashboard "Units to Rent Out" full-width panel: surfaces units where all current tenants have a move-out date within 6 months and no future tenant is lined up within that window

## [2026-04-29]

### Added
- `data/tenants-upload.csv` template and `scripts/import-tenants.mjs` for bulk tenant onboarding (creates auth user + profile, recomputes unit occupancy)
- Add Tenant modal: `Status` dropdown with picklist values `Current Tenant`, `Future Tenant`, `Previous Tenant`
- Add Tenant modal: `Create portal login` toggle making email/password optional (placeholder email used when the tenant has no portal account)

### Fixed
- Logout on page refresh: add `middleware.js` to refresh Supabase session tokens on every request, and replace manual `getSession()` with `onAuthStateChange` listener for reliable session restoration
- TenantsPage header count now filters by `status === "current tenant"` instead of counting every row in `tenant_profiles` (so future/previous tenants no longer inflate the "active tenants" total)
- Unit occupancy now follows the rule "occupied iff ≥1 tenant on the unit has `status = current tenant`": `create-tenant` and `update-tenant` API routes recompute on insert and on either `unit_id` *or* `status` changes
- `create-tenant` API now persists `unit_id` (resolved from explicit `unitId` or by matching `unit_number` within the property) so the Edit Tenant unit dropdown shows the correct selection after creation
- `scripts/backfill-tenant-units.mjs` and `scripts/recompute-occupancy.mjs` for one-off DB cleanup of legacy rows missing `unit_id` or with stale unit `status`

### Changed
- `PaymentsPage` table now has 4 fixed columns: Tenant (clickable → tenant detail), Zelle Name, Rent, Move-out date (green when populated, green row tint); followed by 12 monthly checkboxes
- `PaymentsPage` adds a bold "Total" row after each unit group showing summed rent
- `mapTenant` normalizes legacy `active` → `current tenant` and `inactive` → `previous tenant` so old records render with the new picklist
- `app/api/auth/create-tenant/route.js` accepts `status` from the client and defaults to `current tenant`

## [2026-04-17]

### Changed
- `PaymentsPage` shows last 12 months of rent checkboxes (up from 6); Save button always visible and disabled when there are no pending changes

### Added
- `LandlordDashboard` "Unpaid Rent — <month>" panel lists active tenants with no `completed` payment for the current calendar month (replaces generic "Tenant Payment Status" list)
- `LandlordDashboard` "Vacancies — Now & Next 6 Months" panel lists `units` with `status === "vacant"` plus tenants whose `moveOutDate` falls within the next 6 months (replaces the "Recent Maintenance" panel)
- `PropertyDetailPage` unit cards now render a per-tenant rent split (tenant name + that tenant's `monthlyRent`) below the unit total, replacing the comma-separated tenant names
- `zelleName` field on the tenants add/edit modals in `property-management-app.jsx`; create-tenant API (`app/api/auth/create-tenant/route.js`) now persists `zelle_name`

## [2026-04-04] (fixes)

### Added
- Tenant unit field replaced with dropdown of real units from `units` table (fix: text input no longer accepted)
- Unit selection auto-syncs `unit_id` + `unit` text field; saving a tenant recomputes occupancy for all units in that property
- `app/api/documents/process-lease/route.js` — auto-creates/updates tenant profiles and contract records from AI-parsed lease documents
- "Create Lease Records" button in `DocumentsPageV2` after parsing a lease; confirmation modal with property/unit selectors and result summary
- `docs/phase2-fixes.md` — spec document for Phase 2 bug fixes

## [2026-04-04]

### Added
- `TenantContactPage` component in `phase2-components.jsx` - rich profile view with Contact, Residence, Personal Info, Housemates, Documents, and Import from Document cards
- Tenant names in `TenantsPage` are now clickable links that navigate to the `tenant-detail` page
- `tenant-detail` route case in `renderPage()` wired to `TenantContactPage`
- Extended `mapTenant` with Phase 2 fields: `moveInDate`, `moveOutDate`, `hasCosigner`, `studentStatus`, `studentYear`, `zelleName`, `homeAddress`, `age`, `unitId`
- Extended `app/api/auth/update-tenant/route.js` to persist all new Phase 2 tenant profile fields

### Changed
- `TenantsPage` now accepts `setPage` and `setSelectedTenantId` props for navigation
- Auth callback route (`app/auth/callback/route.js`) for Supabase password recovery and magic link flows
- Password reset page (`app/reset-password/page.js`) for setting new password after recovery
- Phase 2 sprint plan (`docs/phase2-sprint-plan.md`) covering units, documents, AI parsing, and tenant contact pages
- `phase2-components.jsx` with `PropertyDetailPage` component - unit cards grid, add/edit unit modal, tenant linking
- `units` table support: `mapUnit` mapper, units fetched in `fetchAllData`, units state initialized
- Named exports on reusable UI components (`Icon`, `Badge`, `Modal`, `Inp`, `Sel`, `Btn`, `PageHeader`) for cross-file use

### Changed
- `PropertiesPage` cards are now clickable, navigate to `property-detail` page
- `PropertiesPage` stat changed from tenant count to occupied/total units
- `renderPage()` handles new `property-detail` case via `PropertyDetailPage`

## [2026-03-26]

### Added
- Begin tracking changes
