# Changelog

## [2026-05-26]

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
