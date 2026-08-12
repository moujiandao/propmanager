# Changelog

## [2026-08-12]

### Changed
- **A parking spot is no longer labelled "Tenant Priority" or "Open Market" — its second badge is derived from whoever holds the live lease.** The stored `market_status` column was toggled by hand and had drifted exactly the way stored status always does in this app: spots sat labelled "Open Market" while their active lease was to a tenant. `leaseParty(lease)` in `lib/parking/status.js` reads it off the lease instead, whose CHECK already guarantees exactly one of `tenant_id`/`renter_id`, so the label can only be wrong when the lease is wrong. Occupied spots now read Occupied + Tenant / Market Renter; vacant spots carry one badge and no toggle button. `setMarketStatus` and the toggle are gone. Column drop (run after deploy): `scripts/drop-parking-spot-market-status.sql`. **Deliberately given up:** a vacant spot has no lease, so there's no longer a way to record that one is *offered* to the market before somebody takes it — that wants its own `listed` field, not a status describing a letting that doesn't exist.

### Added
- **Maintenance requests are editable and deletable.** The To Do detail modal gains Edit Request (description, type, priority, unit) and Delete Request. Status stays on its own control, since `setStatus` owns it together with `closed_at`; tenant and property aren't editable because re-pointing a request at a different home is a different request. Editing clears `description_zh` — it's a cached translation *of* the description, so leaving it would leave the Chinese confidently describing something the English no longer says. Delete is a hard delete: comments and attachment rows cascade in the database, and the attachment **files** are removed from storage separately since those don't cascade. The confirm counts the attachments going with it.
- **Payment records are editable and deletable.** The Payments page keeps its 3-month completed-only checkbox grid and gains a full record list beneath it — previously a pending payment, an older one, or a wrong amount had no view at all, let alone a way to fix it. Per-record edit covers amount, due date, paid date, status and type. `tenant_id`/`contract_id` aren't editable (re-pointing a payment rewrites two ledgers rather than correcting one) and neither is `ach_status` (Stripe's webhook owns it, so a hand-edit would be silently overwritten).
- `lib/payments/` (`core.js` + `adapter.js` + `fake.js` + `mappers.js` + `status.js` + `core.test.mjs`) — the seventh per-entity data-access seam. `mapPayment` moved out of `fetchAllData`. The delete routes through the pre-existing `app/api/payments/delete` endpoint the grid's uncheck already used, so there's one server-side delete path; `deletePayment` checks the row count that route reports back, so a delete that silently matched nothing is reported as a failure rather than as success.

### Fixed
- The gender mark didn't render on the Parking page. `partyForLease` built its occupant name as a plain string, so the mark had nowhere to attach; the party now carries `gender` for the JSX call sites and a pre-suffixed `nameText` for the two string-only ones (the diagram's SVG `<title>`, the delete confirm).

## [2026-08-11]

### Changed
- **The vehicle and the rate moved from the parking spot to the parking lease.** `car_make`/`car_model`/`car_year` are now columns on `parking_leases`, so a car arrives with a lease and leaves with it instead of sitting on the spot until someone cleared it by hand. `parking_spots.monthly_rate` was dropped outright rather than moved — `parking_leases.rate` already existed and was `NOT NULL`, so the spot column was a duplicate acting as an asking rate. Consequence taken knowingly: there is no asking-rate concept now, so a vacant spot shows no price and the new-lease form no longer prefills. Two migrations, expand then contract: `scripts/add-parking-lease-vehicle.sql` (add + backfill onto each spot's currently-active lease) and `scripts/drop-parking-spot-vehicle.sql`. Car data on a spot with no active lease, and every `monthly_rate` value, were discarded.
- The Add/Edit Parking Spot modal is down to property, label, and type. `createSpot`/`updateSpot` no longer accept a rate or a vehicle, and `mapParkingSpot` no longer returns them.

### Added
- **Edit Parking Lease** modal (rate, end date, vehicle), reachable from the occupied spot card and the lot-diagram detail modal. Backed by a new `updateLease` op in `lib/parking/core.js`. Until now a lease could only be created and ended, so a mistyped rate or a renter's new car had no fix short of ending the lease.

### Fixed
- **A parking lease created in the evening was invisible until the next day.** `ParkingPage`'s `todayStr()` built its `YYYY-MM-DD` from `toISOString()` (UTC) while every comparison it feeds runs through `daysBetween` in `lib/format`, which normalizes to *local* midnight. After ~5pm Pacific the two disagree by a day: a lease created at 8:12pm PDT got `start_date` tomorrow, `isActiveLease` read it as not yet started, and the spot rendered vacant immediately after being leased. End Lease had the mirror bug, writing tomorrow's date and leaving the lease running an extra day. Pre-existing, found while verifying the vehicle move in the browser. The same `toISOString()` pattern remains at two unrelated call sites (the dashboard's transition window, the payments `paid_date`), both with different semantics and deliberately untouched.
- **Creating a parking lease could not succeed.** `lib/parking/core.js`'s `createLease` built a snake_case payload (`landlord_id`, `parking_spot_id`, `start_date`, …) which `adapter.js` POSTs verbatim to `/api/parking/leases/create`, but that route destructures camelCase — every field except `rate` and `renter` arrived `undefined` and the route returned `400 landlordId is required`. The tests missed it because `fake.js` mirrored the core's payload rather than the route's contract, so the fake and the real adapter disagreed and only the fake was exercised. Route-backed adapter ops now send camelCase (routes speak camelCase, direct table writes speak snake_case), the fake validates the same required fields the route does, and a regression test pins the payload's key set.

## [2026-08-05]

### Added
- **Delete a tenant from their detail page**, not just from the Tenants table. `TenantContactPage` had Edit but no delete, so the only way to remove a record was to navigate back to the list and find the row again. It reuses the same modal (see below) and navigates back before refreshing, since the page renders off the tenant that just stopped existing.
- `blockersFromData(data, tenantId)` in `lib/tenant/deletion.js` (+ tests) — the same blocker question answered from the client's already-loaded `data`, so the confirm modal says what's in the way **before** offering the red Delete button instead of after the server refuses. Each entry in `TENANT_DELETE_BLOCKERS` now also declares its client `collection` and a `countIn` matcher, keeping one list behind both paths; a test asserts every blocker declares both, so a relation can't be counted server-side yet silently missing from the warning. Advisory only, exactly like the unit delete guard: the snapshot can be stale or RLS-narrowed, so it can undercount and the route stays the authority — a 409 still overrides the local list with what the server found.

### Changed
- The tenant delete confirm modal is now one exported `TenantDeleteModal` component rather than state and JSX inlined in `TenantsPage`. Exported from `property-management-app.jsx` for the same reason `useUnitMutations` is: the second caller lives in `phase2-components.jsx`. Duplicating it would have meant two copies of the blocker rendering, which is the substance of that screen.

### Fixed
- **Tenant delete reported nothing when it refused.** The feature already existed end to end (Tenants page → Actions → trash icon), but `confirmDelete` discarded the response, so a refused delete was indistinguishable from a successful one — modal closed, refresh ran, tenant reappeared unexplained. New `lib/tenant/deletion.js` (+ tests) holds `TENANT_DELETE_BLOCKERS`, the one list of relations that stand in the way; `app/api/auth/delete-tenant` counts them before touching anything and returns 409 with the counts, and the modal renders them. Three of the five FKs (`documents`, `payments`, `maintenance_requests`) would have rejected the delete anyway but as an opaque constraint error; the other two (`contract_tenants`, `parking_leases`) cascade and would have vanished silently — counting first turns both into one answer. Blocking rather than cascading is deliberate: a tenant's payment history is the books, and "previous tenant" already serves as the archive, so hard delete is for test rows and mistakes.
- Deleting a tenant created **without a portal login** returned 400 after the profile row was already deleted — `supabase.auth.admin.deleteUser` errors when there's no `auth.users` row, so the route reported failure for a delete that had in fact happened. Now logged and swallowed.
- The tenant confirm modal's "Are you sure you want to delete X?" was hardcoded English; translated along with the new strings.

## [2026-08-03]

### Added
- `lib/units/` (`core.js` + `adapter.js` + `fake.js` + `mappers.js` + `core.test.mjs`) — the sixth per-entity data-access seam, covering unit create/edit/delete. `PropertyDetailPage` previously wrote `supabase.from("units")` inline, the pattern the seam replaced everywhere else. Called through a `useUnitMutations()` hook exported from `property-management-app.jsx` (exported, unusually, because the only caller lives in `phase2-components.jsx` — the hook stays the single write path even though the UI is next door). `mapUnit` moved out of `fetchAllData` into `lib/units/mappers.js`.
- **Unit deletion** (`phase2-components.jsx`) — the property detail page had no delete at all. Guarded: `deleteUnit` blocks while **any** tenant references the unit, current or previous, and reports the count. Blocking rather than nulling `unit_id` is deliberate — a previous tenant's `unit_id` is what the Unit Transitions dashboard and housemate detection read, so unlinking to allow a delete would lose history silently. The guard re-reads the tenant count through the adapter instead of trusting the caller's already-loaded `data.tenants`: that client state can be minutes stale, and a stale zero would delete a unit someone has since been moved into. The confirm dialog's count is advisory only.
- `maintenance_requests.closed_at` (`scripts/add-maintenance-closed-at.sql`) — when a To Do List ticket was closed, shown as a chip on the kanban card and in the ticket detail modal. The rule lives in `nextClosedAt` in `lib/maintenance/status.js` (the Status vocabulary's home) so the board drag and the detail-modal dropdown can't disagree: stamp on the transition *into* closed, preserve an existing timestamp when an already-closed ticket is re-closed, clear on reopen. Status and `closed_at` are written in one update, so a request is never observed closed-without-a-date. **Not backfilled** — `updated_at` says when a row last changed, not when it was closed, and inventing a close date the landlord never recorded is worse than showing nothing; pre-existing closed tickets render without one until re-closed.
- `tenant_profiles.move_in_acked_at` / `move_out_acked_at` (`scripts/add-tenant-transition-ack.sql`) — landlord confirmation that a move actually happened, with "Tenant(s) have moved in / out" buttons on each dashboard Unit Transitions row. Because status is derived from dates, a transition used to dismiss itself: an incoming tenant vanished the moment their move-in date arrived, whether or not they showed up. `awaitingMoveInAck` / `awaitingMoveOutAck` in `lib/tenant/status.js` keep it listed until confirmed; `acknowledgeMoveIn` / `acknowledgeMoveOut` in `lib/tenant/core.js` are the writes (idempotent — a second click keeps the first timestamp). One-way by design: if a move-in didn't happen the fix is to change the date, which is the single source of truth every other status rule already reads.

### Changed
- The To Do List kanban card now shows the Chinese translation under the description when one has been generated, clamped to two lines like the original so a long request can't tower over its column. Shown regardless of UI language — the point is that a bilingual landlord can read the card without opening it.
- `PropertyDetailPage`'s units section is now bilingual (`t.unit*` keys in both `T.en` and `T.zh`), where the whole of `phase2-components.jsx` had been hardcoded English. Scoped to the units UI; the file's document and tenant-contact sections are still untranslated. Note the `t` map variable inside the unit card was renamed to `ten` — it shadowed the new translation prop.

### Removed
- The **Status** dropdown from the add/edit unit modal. It was dead: `fetchAllData` recomputes every unit's `status` from tenant occupancy on load, so a status chosen here was silently overwritten. `createUnit`/`updateUnit` never write the column; the DB default keeps it non-null for external SQL.

### Migrations to run
`scripts/add-maintenance-closed-at.sql` and `scripts/add-tenant-transition-ack.sql` — neither has been applied. The second **must** be run with its backfill: "unacknowledged" is the null default, so without it every tenant who ever moved in becomes an unacknowledged move-in and the dashboard fills with years of history.

## [2026-07-27]

### Added
- `parking_spots.type` (`scripts/add-parking-spot-type.sql`) — which part of the lot a spot sits in and how it's oriented. Chosen from a fixed picklist: `right side (diagonal)`, `back side (straight)`, `left side (straight)`. The vocabulary lives in `SPOT_TYPES` in `lib/parking/status.js` and is shared by the UI dropdown and the core's write validation, so the two can't drift — same pattern as `lib/maintenance/status.js`. Enforced in JS rather than as a DB `CHECK`: adding a fourth layout stays a one-line change instead of a migration, and `createSpot`/`updateSpot` reject an off-list value for *every* caller (seed scripts and future API routes included), not just the dropdown.
- `parking_spots.car_make` / `car_model` / `car_year` (`scripts/add-parking-spot-car.sql`) — the vehicle parked in a spot, shown on the card as e.g. `2019 Honda Civic`. `car_year` is a `SMALLINT`; a non-numeric entry becomes null rather than letting `NaN` reach the database. **Deliberate tradeoff:** these live on the spot, not the lease, so the vehicle is attached to the concrete rather than the occupant — when a lease ends the previous renter's car stays listed until someone clears it, and there's no history of which vehicle occupied a spot when. Chosen for simplicity (one place to look, one modal to edit) over the lease-scoped alternative.
- Parking spot **editing** (`property-management-app.jsx`), which the page previously had no path for — label, type, rate, and vehicle were fixed at creation, so a typo meant deleting and recreating the spot, and only while it was unleased. One modal serves both add and edit, keyed on an `editingSpot` state. New `updateSpot` op in `lib/parking/core.js` + `iconBtn` (neutral sibling of `dangerIconBtnStyle`).
- `scripts/seed-ridge-rd-parking.mjs` — creates the 14 Ridge Rd spots with their types. Resolves the property by address rather than a hardcoded UUID, and is idempotent (reads existing labels first, inserts only what's missing, reports rather than overwrites a type mismatch).
- `lib/parking/layout.js` (+ `layout.test.mjs`) — pure, React-free lot geometry. Given a list of spots it returns `{ width, height, outline, stalls, unplaced }`, positioned SVG polygons the component only has to draw; the layout math is therefore unit-testable in isolation, the same split by which `lib/parking/status.js` keeps the lease-active rule out of rendering. **Placement is derived from the spot's `type`, not stored**: the three `SPOT_TYPES` map 1:1 onto three zones of the lot — `right side (diagonal)` → right column as slanted parallelograms, `back side (straight)` → a short row centered at the top, `left side (straight)` → left column — sorted numerically by label within each zone. No geometry column and no hardcoded label→coordinate map; this is what the type picklist was built for, so a correctly-typed spot places itself and the diagram needs no second source of truth to keep in sync. A spot with no type can't be placed and is reported back as `unplaced` rather than silently dropped. Lot shape confirmed against the landlord's hand sketch, including the right column running descending (7 at top → 1 at bottom) while the left runs ascending — that matches the physical lot and is not an oversight.
- `ParkingLotDiagram` (`property-management-app.jsx`) — interactive SVG lot plan rendered above the spot cards. Each stall is clickable and opens a new spot-detail modal: type, vehicle, and rate, plus — when occupied — who is renting it, whether they're a tenant or a market renter, **their email and phone**, and the lease rate with start *and* end dates. Those contact details and the lease end date aren't surfaced anywhere else in the UI today (the spot card shows only occupant name and start date), so the diagram is the deepest view of a spot rather than a prettier duplicate of the card. Proportions are held by the SVG's `viewBox` + `preserveAspectRatio` with `width: 100%; height: auto`, so it scales to the container without distorting the stalls. The diagram renders for a property only when at least one of its spots has a type — today that's Ridge Rd alone, but gated on the data rather than a property name that would break on rename.

### Changed
- `updateSpot` deliberately does **not** accept a property: moving a spot between properties would strand its lease history against a lot it no longer belongs to, and could collide with the unique `(property_id, label)` constraint on arrival. The edit modal renders property read-only, and a test asserts a `property_id` passed in is ignored. Editing stays available on leased spots (renaming doesn't invalidate a lease); deleting remains gated on the spot being free.
- `occupantFor` in `ParkingPage` (`property-management-app.jsx`) now returns the underlying tenant or market-renter record and which of the two it is, alongside the existing `{ lease, name }`. The spot-detail modal needs the occupant's email and phone, and the only honest source is the record the name was already resolved from — widening the one lookup that knows how to find it beats a second lookup in the modal that could disagree with the card about who occupies a spot.
- Parking agreements are now called **"parking lease"** throughout the UI, not the bare "lease" (`property-management-app.jsx`, `T.en` + `T.zh`). The Parking page's buttons read "Add Lease"/"End Lease" while the sidebar has a separate "Leases" page for residential `contracts` — the same word for two different agreements, one screen apart, and worse in Chinese where residential is 合同 but parking used the generic 租约. The spot-detail modal also gains a "Parking Lease" heading separating the occupant's contact details from the lease terms, which are properties of the agreement rather than the person. Text only — no schema or behavior change.

### Documentation
- `CONTEXT.md` — new glossary entries for **Lease**, **Parking Lease**, and **Market Renter**. Records that a parking lease is a *different record* from a residential lease with no foreign key between them, and why that separation is deliberate rather than an oversight: a spot can be rented by a non-tenant with no residential lease to attach to, parking terms run independently of the residential term, one tenant can hold two spots, and a lease has several responsible parties where a spot has exactly one. Also names the three consequences that fall out of it — a tenant's move-out doesn't end their parking lease, renewals don't carry parking forward, and parking rent isn't billed — plus the shape of the fix if they ever need to connect (a nullable `parking_leases.contract_id`).
- `CLAUDE.md` and the `scripts/add-parking.sql` header both described `parking_leases` as "the contract for a spot" — wording that collided with the actual `contracts` table and caused exactly the confusion above. Reworded to name it the parking lease and state the separation. The SQL change is comment-only; the migration's statements are untouched.

## [2026-07-26]

### Added
- `lib/tenant/status.js` — the home for the tenant Status vocabulary, mirroring `lib/maintenance/status.js`. Tenant status is now **derived** from `move_in_date`/`move_out_date` rather than stored and read: `statusFor()` (camelCase), `statusForRow()` (raw snake_case rows), `isCurrentRow()` (the occupancy predicate), plus the `FUTURE`/`CURRENT`/`PREVIOUS` constants. Rule: move-out already past → previous; move-in still ahead → future; otherwise current. A tenant stays current through the whole of their move-out day and becomes current on their move-in day; a null move-in means already resident. Built on `daysBetween` from `lib/format` so the YYYY-MM-DD local-midnight rule doesn't drift. Unit-tested (10 cases) via `npm test`.
- `scripts/backfill-tenant-status-dates.sql` — one-time backfill for the change. Stamps `move_out_date = updated_at::date` on rows stored as `previous tenant`/`inactive` with a null move-out date, which would otherwise derive as current and reappear in active lists. SELECT-first; the UPDATE is commented out until reviewed. Also reports `future tenant` rows with a null move-in date, which need a manual date (no honest value can be inferred).

### Changed
- Tenant status is no longer a landlord-editable field. The status `<Sel>` is gone from the add and edit tenant modals (`property-management-app.jsx`), replaced by a read-only `DerivedStatusField` showing what the entered dates resolve to, live. `status` is no longer sent in the create/update payloads or held in form state, and `TenantContactPage` (`phase2-components.jsx`) no longer carries the dead field. New `T.en`/`T.zh` key `tenStatusDerived`.
- `tenant_profiles.status` is now a **write-only legacy column**: still written on create/update so external SQL and the ops scripts don't see nulls, but never read back by the app. `mapTenant` (`lib/tenant/mappers.js`) and `mapTenantRow` (`lib/email/context.js`) both derive instead, which also removes the duplicated legacy `active`/`inactive` normalize expression that let the cron and the UI disagree.
- Occupancy is no longer filtered in Postgres. The `.eq('status', 'current tenant')` predicate in `create-tenant`, `update-tenant`, `delete-tenant`, and `delete-user` is replaced by selecting the two date columns and filtering through `isCurrentRow` — a derived status can't be expressed in SQL, and a Postgres `GENERATED` column can't help because the value has to change at midnight without a write. Same change in the client-side occupancy computation in `fetchAllData`, and in `scripts/recompute-occupancy.mjs`, `scripts/import-tenants.mjs`, `scripts/upsert-tenants.mjs`.
- `update-tenant` recomputes occupancy when the *derived* status changes (comparing the incoming dates against the stored ones) rather than when a submitted status field differs.
- `app/api/dashboard/summary/route.js` derives status once at the top of `buildFacts`, so its nine `t.status === ...` comparisons agree with what the UI shows for the same tenant.
- `lib/email/audience.js`: the `move_in` automation no longer gates on `status === 'future tenant'`. Under derived status a tenant flips to current at midnight on their move-in day, so an offset-0 move-in reminder would have found nobody by the time the 15:00 UTC cron ran. Now gated on `status !== 'previous tenant'`; `offsetsDueToday()` already selects the correct day. The other event types use the shared status constants.
- `scripts/recompute-occupancy.mjs` step 1 now resyncs the legacy `status` column to the derived value for every row that disagrees, replacing the old one-way `active`→`current tenant` normalize.

### Fixed
- Dashboard "Unpaid Rent" no longer flags tenants whose move-in date is in the future (`property-management-app.jsx`). The filter checked status only, while its server-side twin `wasActiveLastMonth` in `app/api/dashboard/summary/route.js` also guarded on move-in date; the add-tenant form's `current tenant` default made the gap visible for anyone added ahead of their move-in.

### Added
- Property filter on the Payments page, matching the Tenants page (`property-management-app.jsx`). Extracted the shared chip row into a `PropertyFilterBar` component used by both, rather than duplicating the markup. Persists to its own `propmanager_payment_hidden_props` key so narrowing the payment view doesn't narrow the tenant roster. Reuses the existing `tenFilterProperties`/`tenShowAll`/`tenHideAll`/`tenNoProperty` strings, so no new translation entries.
- `properties.in_production` flag (`scripts/add-property-in-production.sql`, `BOOLEAN NOT NULL DEFAULT TRUE`). Unchecking it on a property retires it from active tracking: its tenants (and their maintenance requests) drop out of the dashboard, Tenants page, Payments page, and To Do List board, without deleting any data. The property itself still shows on the Properties page — where the flag lives, in both the add and edit modals as an "In Production" checkbox, plus a red "Not in Production" chip on the card when unchecked. `mapProperty` (`lib/property/mappers.js`) exposes it as `inProduction` (defaults true so pre-migration rows and nulls don't silently exclude anyone); `createProperty` (`lib/property/core.js`) writes it explicitly rather than relying on the column default; `app/api/properties/update/route.js` follows the existing `units`-field pattern where an omitted value leaves the column untouched instead of resetting it. New shared helper `nonProductionPropertyIds()` in `property-management-app.jsx`, consumed by `LandlordDashboard` (via local `tenants`/`payments`/`maintenance`/`units` shadowing the `data.*` names, so the ~250 lines of existing dashboard logic didn't need touching), `TenantsPage`, `PaymentsPage`, and `MaintenancePage` (the To Do List board, gated on the request's own `propertyId` rather than going through its tenant). `app/api/dashboard/summary/route.js`'s AI briefing gets the same exclusion server-side. New `T.en`/`T.zh` keys `inProduction`/`inProductionHint`/`propNotInProduction`. Unit-tested (`lib/property/core.test.mjs`, `mappers.js` coverage) via `npm test`.

### Changed
- `PaymentsPage`'s tenant-by-unit grouping (`property-management-app.jsx`) converts from a manual `useMemo` to a plain `const` — once its body needed to reference the new `excludedPropertyIds` Set, the React Compiler could no longer preserve the memoization (see CLAUDE.md: manual `useMemo`/`useCallback` triggers this; plain consts are auto-memoized). No behavior change.

## [2026-07-07]

### Changed
- Conservative, behavior-preserving simplification pass across the four UI files (`property-management-app.jsx`, `phase2-components.jsx`, `email-automation-components.jsx`, `renewal-components.jsx`) — 28 edits, +90/−77. Removed dead code (unused `daysUntilStart`, `setData` props on `ContractsPage`/`PropertiesPage`, unused `Badge`/`buildContext` imports, duplicate `T.en`/`T.zh` keys `st_failed`/`saving`, unread `due.end` field); collapsed no-op `cond ? "#111111" : "#111111"` ternaries and a needless template literal; hoisted repeated inline-style objects to file-level consts (`dangerIconBtnStyle`, `PRIORITY_COLORS`, `emptyCard`, `dangerBtn`, `iconBtn`, `footerRow`, `errText`, `docTypeBadgeColor`, `emptyState`, `sectionHeading`, `redChip`, etc.); extracted small local helpers (`fullName`, `nl2br`, `isActiveTenant`); replaced two local currency formatters in `phase2-components.jsx` with `import { fmt } from 'lib/format'`. No behavior change. Verified: `npm test` 72/72, `npm run build` clean, lint delta zero vs `main`. Writeup in `docs/simplification-pass-2026-07.md`.

### Documentation
- `CLAUDE.md` Key Conventions: added the inline-style dedupe convention (hoist repeated style objects to file-level consts; note that `<Btn style>` is silently dropped).

## [2026-06-28]

### Added
- `AGENTS.md` — thin pointer to `CLAUDE.md` so `AGENTS.md`-aware tools (e.g. Codex) load the same project guide. Replaces a stale standalone copy that had drifted from `CLAUDE.md`; the two are now single-sourced. Documented the convention in `CLAUDE.md` Architecture.

## [2026-06-26]

### Added
- `lib/format/` — canonical isomorphic formatting module (`fmt`, `fmtDate`, `daysBetween`), unit-tested via `npm test`. The one home for the currency/date formatters that were previously duplicated.
- `lib/maintenance/` — isomorphic ESM module that is the persistence seam for the maintenance aggregate (request + comments + attachments + types). `core.js` (React-free write ops + the soft/hard-delete rule, adapter-injected), `adapter.js` (real adapter over the anon Supabase client + maintenance routes), `fake.js` (in-memory adapter for tests), `mappers.js` (the one home for the aggregate's camelCase shape). Unit-tested via `npm test`.
- `lib/property/` — persistence seam for property writes (fourth entity slice). `core.js` (`createProperty`/`deleteProperty`/`setDriveLink`, React-free, adapter-injected), `adapter.js`/`fake.js`, `mappers.js` (`mapProperty`). The three direct `properties` writes (PropertiesPage add + delete, DocumentsPage drive-link save) now go through a `usePropertyMutations()` hook; edit + image-upload stay in their server routes. No direct `properties` writes remain in the monolith. Unit-tested.
- `lib/payment-reminders/` — persistence seam for the older `email_settings` "Payment Reminders" feature (third entity slice; distinct from `lib/email` automation). `constants.js` (default settings shape + the camelCase-field→snake_case-column map that was the hardcoded `KEY_MAP` in `EmailPage`), `mappers.js` (`mapEmailSettings`), `core.js` (`setReminderField`/`saveTemplates`, React-free, adapter-injected), `adapter.js`/`fake.js`. `EmailPage` now writes through a `useEmailSettingsMutations()` hook (toggle is optimistic with rollback); no `KEY_MAP` or direct `email_settings` writes remain in the monolith. Unit-tested.
- `lib/tenant/` — persistence seam for tenant self-service profile writes (second entity slice). `core.js` (`setRecurringPayment`, `setBankConnected`, `updateDisplayName`, React-free, adapter-injected), `adapter.js` (real `updateProfile` over the anon client), `fake.js`, `mappers.js` (`mapTenant` — the one home for the tenant read-shape, the app's highest-touchpoint mapper; `fetchAllData` imports it). The tenant portal's three direct `tenant_profiles` writes now go through a `useTenantMutations()` hook → the core; no direct tenant writes remain in the monolith. Unit-tested.
- `lib/maintenance/status.js` — the home for the maintenance Status vocabulary (`WRITE_STATUSES`, `COLUMNS`, `columnOf`, `isOpen`, `isWritableStatus`, `normalizeWriteStatus`), React-free + isomorphic. The board's column mapping, the dashboard "open requests" counts (landlord + tenant), and the server create route now all consume it so they can't drift; the create route validates/normalizes the incoming status instead of accepting any string (architecture review candidate 3). Unit-tested.

### Changed
- `property-management-app.jsx`: the ~10 scattered direct `supabase.from(...)` maintenance writes (status, comment add/translate/soft+hard-delete, type add, tenant submit, request translate, create) now go through a `useMaintenanceMutations(setData)` hook that wraps the core and owns optimistic update + **rollback** (previously absent — a failed status drag left the card in the wrong column silently; rollback now restores the touched slice). `fetchAllData` imports the four maintenance mappers from `lib/maintenance/mappers` instead of defining them inline. No behavior change for callers beyond the added rollback. First slice of a per-entity data-access seam (architecture review candidate 1).

### Changed
- Landlord "Maintenance" page reskinned as a Trello-style **To Do List** kanban board (`property-management-app.jsx`). Three columns (New / In Progress / Closed) over the existing `maintenance_requests`; drag a card between columns to set its status (reuses the optimistic `updateStatus`). No schema change — stored status values (`new`/`in-progress`/`closed`, plus legacy `resolved`/`open`) are unchanged; `resolved`/`closed` and any unknown status map to the Closed/New columns respectively. Cards open a detail modal carrying the full description, metadata, attachments, status dropdown, the per-request "Translate to Chinese" action (moved off the card face), and the existing `CommentThread`.
- Split the shared `navMaintenance` nav label: landlord nav now reads "To Do List" (`navTodo`), tenant portal keeps "Maintenance". Tenant maintenance page is unchanged (still a submit-and-track list).

### Added
- Dependency `@dnd-kit/core` + `@dnd-kit/utilities` for the kanban drag-and-drop (first runtime UI dep in the monolith; see `docs/adr/0001-dnd-kit-kanban-board.md`).
- `CONTEXT.md` (domain glossary) and `docs/adr/` (first ADR).
- Bilingual strings: `navTodo`, `todoDetailTitle`, `todoEmptyColumn` (`T.en`/`T.zh`).

### Changed
- Consolidated the duplicated `fmtDate` (byte-identical in three places, incl. the subtle YYYY-MM-DD timezone rule) and the monolith's `fmt` into `lib/format`. `property-management-app.jsx` and `renewal-components.jsx` now import from it; `lib/email/format.js` re-exports from it so the email module's existing imports are unchanged. Renewals keeps its `fmtMoney` (returns "—" for null) and `daysBetween(Date, Date)` (different signature) locally — deliberately not merged, since their contracts differ from the canonical versions.

## [2026-06-22]

### Added
- Commercialization Phase 1 — public marketing site + auth restructure. New App Router route groups: `(marketing)` (`/` home with hero, faux product preview, four feature sections, and CTA band; `/pricing` with Free/Pro/Business flat tiers, "Most popular" highlight), `(auth)` (`/login`, a unified form that resolves landlord-vs-tenant role before navigating; `/signup` that registers a free-tier landlord then auto-signs-in and lands on `/dashboard`), and `(app)` (the existing monolith mounted at `/dashboard` behind a server-side auth guard in `app/(app)/dashboard/layout.js` that redirects unauthenticated visitors to `/login?next=/dashboard`). New shared modules: `lib/theme.js` (palette/tokens/`btnStyle`, importable by server + client without dragging in the monolith), `app/_brand.jsx` (`Logo`), `app/(auth)/_form.jsx` (form primitives). Fonts moved to `next/font` Inter + `app/globals.css` in the root layout (new surfaces only; the monolith keeps its inline `@import` for now).
- `landlord_profiles` plan/billing columns (`scripts/add-landlord-plan.sql`): `plan` (text, default `'free'`, CHECK in free/pro/business) plus nullable `subscription_status`, `stripe_customer_id`, `stripe_subscription_id` placeholders for Phase 2 Stripe billing. Existing `is_team_member(id)` RLS covers them; unique partial index on `stripe_customer_id`.
- Marketing-surface polish: pricing FAQ section; responsive header (secondary nav links collapse under 640px so the bar never overflows on mobile); opacity-based hover affordances on buttons/nav links via `app/globals.css` classes (`.pm-btn`/`.pm-navlink`); smooth in-page scrolling with `scroll-margin-top` so the sticky header doesn't cover anchored sections; reduced-motion respected.

### Changed
- `property-management-app.jsx`: removed the in-app dark `LoginPage` (login/signup now live on public routes); the `!user` branch is a client-side redirect fallback to `/login`; logout signs out and navigates to `/`. Internal state-driven nav and `onAuthStateChange` session resolution unchanged.
- `app/layout.js` now wires `next/font` Inter and imports `app/globals.css`; `app/page.js` removed (replaced by `app/(marketing)/page.js`).
- `app/api/auth/register-landlord/route.js`: omits `plan` on insert and relies on the column default (`'free'`), decoupling the code deploy from the migration timing.

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
