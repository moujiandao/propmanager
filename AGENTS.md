# PropManager Agent Guide

This is the active repository guide for Codex. `CLAUDE.md` is the detailed legacy architecture record and decision log. Read the relevant section of `CLAUDE.md` before changing a subsystem with non-obvious behavior. If this file and `CLAUDE.md` disagree, follow this file and verify the current code.

## Project Snapshot

PropManager is a property-management web application for landlords and tenants.

- Next.js 16, App Router, Turbopack
- React 19
- Supabase PostgreSQL, Auth, and Storage
- Stripe ACH payments
- Resend email
- Inline styles for the authenticated application
- English and Chinese landlord UI

## Commands

- Install: `npm install`
- Develop: `npm run dev` (http://localhost:3000)
- Test: `npm test`
- Lint: `npm run lint`
- Production build: `npm run build`

Run tests and lint after code changes. Run the production build when a change affects routing, server/client boundaries, configuration, or bundling.

## Repository Map

- `app/(marketing)/`: public server-rendered pages
- `app/(auth)/`: login and signup
- `app/(app)/`: authenticated landlord and tenant routes
- `app/api/`: API routes, auth operations, payments, webhooks, email, and document operations
- `components/app-store.jsx`: client store for `data`, `user`, `lang`, and `refresh`
- `components/route-props.js`: shared route-to-page props
- `components/sidebar.jsx`: authenticated navigation
- `property-management-app.jsx`: component library for landlord and tenant views, not a page and not a navigation controller
- `phase2-components.jsx`, `email-automation-components.jsx`, `renewal-components.jsx`: additional feature component libraries
- `lib/routes.js`: route builders and route-param lookup helpers
- `lib/i18n/strings.js`: landlord UI translations
- `lib/dashboard/load.js`: RLS-protected dashboard read path
- `lib/<entity>/`: isomorphic entity seams, usually `core.js`, `adapter.js`, `fake.js`, `mappers.js`, and tests
- `scripts/`: database migrations and operational SQL

## Architecture Rules

### Routing and layouts

- Every view has a real URL. Do not reintroduce `page` state, `setPage` props, or a monolithic view switcher.
- Use `<Link>` for navigation when possible. Build every href through `lib/routes.js`, never by string concatenation at the call site.
- Resolve route params with the `find*` helpers in `lib/routes.js`, not inline `.find()` calls.
- Landlord routes live in the `(landlord)` route group, which does not add a URL segment. Tenant routes live below `/portal`.
- `app/(app)/layout.js` owns the authenticated guard and mounts `AppProvider`. `middleware.js` refreshes the Supabase session cookie and recognizes authenticated URL prefixes, but it is not the authorization gate.
- When adding a top-level authenticated route, add it to `APP_PREFIXES` in `middleware.js`.
- Keep the app store in the shared layout so it survives route navigation. Keep the cold-store loading gate inside `AppProvider`; moving the conditional outside remounts the provider and discards optimistic state.

### Supabase and authorization

- Client-side and RLS-protected server reads use an anon client. `lib/dashboard/load.js` must receive a session-carrying anon client because its unfiltered queries rely on RLS.
- `lib/supabase/server-anon.js` is the server anon client for app-table reads.
- `lib/supabase/server.js` uses the service role and bypasses RLS. Use it only for admin operations in API routes, such as managing auth users. Never use it for ordinary app-table reads.
- A landlord is a team. `landlord_profiles` has one row per team and `landlord_members` maps `auth.users` to the team.
- In the client app, `user.id` is the team's `landlord_id`; `user.authId` is `auth.uid()`. Writes to `landlord_id` use `user.id`. Never assume `auth.uid() === landlord_id`.
- RLS policies use `is_team_member(landlord_id)`.

### Entity data-access seams

The seamed entities are `maintenance`, `tenant`, `property`, `payment-reminders`, `parking`, `units`, and `payments`.

- New writes for a seamed entity go through `lib/<entity>/core.js`, an injected adapter, and the entity's `use<Entity>Mutations()` hook. Do not add direct `supabase.from(...)` writes to the component monolith.
- Put each seamed entity's snake_case-to-camelCase mapping in its `mappers.js`. Do not duplicate mappers in UI code.
- Add or update tests against `fake.js` for core behavior. A fake represents the real dependency's contract, not merely its caller's current payload.
- Route-backed operations send camelCase JSON. Direct table writes use snake_case column names.
- Mutation hooks use plain constants. Do not add manual `useMemo` or `useCallback` to satisfy a performance hunch. The React Compiler is not enabled, and the hooks lint rule currently rejects these manual memoizations.
- To seam a new entity, mirror `lib/maintenance/` and add its test glob to `package.json`.

### UI and translations

- Add every new landlord-visible string to both `T.en` and `T.zh` in `lib/i18n/strings.js`, then reference `t.keyName`. This includes headings, labels, buttons, modals, confirmations, empty states, errors, toasts, badges, placeholders, and tooltips.
- Dynamic database values, brand names, and output already produced by `fmt` or `fmtDate` are exempt from translation entries.
- Translate the landlord UI you touch. Some older tenant and Phase 2 UI is still English-only.
- Reuse existing primitives such as `Modal`, `Inp`, `Sel`, `Btn`, `Badge`, `Icon`, `PageHeader`, `StatCard`, and `Toggle`.
- Authenticated UI styling is inline. Hoist repeated style objects to a file-level constant in the same component file. Do not create a cross-file shared-style module for this monolith.
- `Btn` does not forward a `style` prop. Use its supported variants or change the primitive intentionally.
- Public marketing and auth pages should remain server components when possible. Reuse `lib/theme.js` and `app/_brand.jsx`.

## Domain Invariants

### Derived state

- Tenant status is derived by `lib/tenant/status.js` from `move_in_date` and `move_out_date`. The `tenant_profiles.status` column is write-only legacy. Never read it, filter on it, or add a manual status control.
- `isCurrentRow`, `statusForRow`, and transition predicates accept `today` as their second argument. In array filters, wrap them as `row => isCurrentRow(row)` so the array index is not passed as the date.
- Unit status is derived on read from current tenant occupancy. Do not write `units.status` or add a status UI control.
- Parking occupancy and the tenant/renter party are derived from parking leases. Do not store a second occupancy or market-status field.
- Parking lot SVG geometry is derived by `lib/parking/layout.js` from `parking_spots.type`. Untyped spots remain unplaced rather than guessed.
- Property `in_production === false` hides that property's tenants and their dependent maintenance/payment data from operational views. It does not hide the property. Use the shared `nonProductionPropertyIds(properties)` predicate rather than reimplementing the rule.

### Parking

- A parking spot describes physical reality: property, label, and type.
- Vehicle fields and the agreed rate belong to `parking_leases`, not `parking_spots`.
- A parking lease has exactly one of `tenant_id` or `renter_id`. Market renters have no auth-user link.
- `updateSpot` cannot move a spot between properties. A leased spot may be renamed but cannot be deleted.
- `SPOT_TYPES` in `lib/parking/status.js` is the single JS-enforced picklist. Do not add a database CHECK for it without revisiting the documented design decision.

### Maintenance, payments, and email

- Closing a maintenance request sets `status` and `closed_at` together through `nextClosedAt`. Re-closing preserves the original timestamp; reopening clears it.
- Move-in and move-out dashboard transitions remain visible until the landlord acknowledges them. Acknowledgement is one-way; changing the underlying date is the correction path.
- Stripe owns `payments.ach_status`. Ordinary payment edits must not modify it.
- `email_settings` is the older Payment Reminders feature. `email_templates`, `email_automations`, `email_messages`, and `email_batches` power the separate Email Automation feature. Do not combine them.
- Human-reviewed email batches use draft messages and an atomic `draft -> queued` claim before sending. Preserve idempotency and the explicit confirmation gate.
- Use `lib/format` for `fmt`, `fmtDate`, and `daysBetween`. Do not duplicate formatters.

## Common Change Recipes

### Add an authenticated view

1. Export the view component from the appropriate component library.
2. Add a `page.js` under `app/(app)/(landlord)/` or `app/(app)/portal/`.
3. Use `useLandlordPageProps()` for landlord pages where applicable.
4. Add its route builder to `lib/routes.js`.
5. Add navigation in `components/sidebar.jsx` with both translations in `lib/i18n/strings.js`.
6. Add a new top-level segment to `APP_PREFIXES` in `middleware.js`.

### Add or change a seamed write

1. Implement the operation in `lib/<entity>/core.js` against the injected adapter.
2. Make the real adapter and `fake.js` honor the same contract.
3. Add focused unit tests.
4. Expose the operation through `use<Entity>Mutations()` for optimistic update and rollback.
5. Call the hook from the component.

### Add a data entity

Add the Supabase table and RLS, mapper, dashboard load, store entry, write seam or API route, and tests. Preserve legacy text columns when adding `unit_id` foreign keys unless a migration explicitly retires them.

## Verification Checklist

For code changes:

1. Run the focused test while iterating.
2. Run `npm test`.
3. Run `npm run lint`.
4. For landlord UI changes, inspect the diff for hardcoded visible English and add matching English and Chinese entries.
5. Run `npm run build` when the change can affect Next.js routing, rendering boundaries, configuration, or bundling.

Do not commit code that fails tests, lint, type checks, or relevant builds. Do not bypass pre-commit hooks.
