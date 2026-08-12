# 2. URL routing for the authenticated app surface

Date: 2026-08-12
Status: Accepted

## Context

The entire authenticated app — 14 landlord views and 5 tenant views — lived at
one URL, `/dashboard`. Navigation was a `page` string in React state, switched
in `renderPage()`, with `selectedPropertyId`/`selectedTenantId` standing in for
detail routes.

A hand-rolled shim pushed `{page, propertyId, tenantId}` into
`history.pushState(state, "")` — an **empty URL** — so back/forward worked but
the address bar never changed.

The costs were concrete: nothing was linkable, reload always returned you to the
dashboard, "back" from a detail view was hardcoded to the list regardless of
entry point, and selecting a second tenant while already on a tenant page did
not push history at all. The deepest record views (a maintenance ticket with its
comment thread, a parking spot, a document) had no address whatsoever.

## Decision

Every view becomes a route file under `app/(app)/`, with the store hoisted into
a layout above them.

**Roles are a routing boundary.** `(landlord)` is a route group (invisible in
URLs) and tenants get `portal/`. Each has its own server guard. This replaced a
render-time `user.role` branch inside `renderPage()`.

**URLs name resources, not the UI's current label for them.** The nav says "To
Do List" and the tenant portal says "Maintenance" — one resource, one path,
`/maintenance`. The `contracts` table is served at `/leases` because that is the
domain word users see. Naming a durable identifier after a label means a copy
edit becomes a redirect.

**Params are raw UUIDs, routed through a seam.** Every href comes from
`lib/routes.js` and every param resolves through its `find*` helpers, so adding
slug columns later changes one file rather than ~20 call sites.

**The store stays client-side, in a layout.** Next does not re-render a shared
parent layout when navigating between its children, so `data` survives soft
navigation. Verified: zero Supabase requests across all 12 sidebar destinations.

## Consequences

**The store must stay client-side, and that is not a temporary compromise.**
Every query in `lib/dashboard/load.js` is an unfiltered `select("*")` scoped
only by RLS (`is_team_member(landlord_id)`). Moving reads into server components
using `lib/supabase/server.js` would silently drop team isolation, because that
client uses the service role key. `lib/supabase/server-anon.js` exists so
server-side reads that *are* added keep RLS. Any future per-route data fetching
must go through it.

**Post-mutation `refresh()` reloads everything and is invisible**, because the
cold gate only fires when the store is empty. That is deliberate. Adding
per-route `loading.js` files would surface a spinner for work that isn't
happening there — the pages are trivial client shells that resolve instantly,
while the real wait is provider-owned.

**The cold gate must stay inside the provider.** Writing
`{cold ? <Spinner/> : <AppProvider>…}` would remount the provider on every flip,
wiping the store and every optimistic update.

**Slugs are blocked on schema, not on routing.** Only `parking_spots` has a
human-readable unique key (`(property_id, label)`). `units` has no
`UNIQUE (property_id, unit_number)` at all, and the ops scripts already disagree
about whether unit numbers are globally unique.

**Bundle size did not improve, and was not expected to.** The four client files
form one import cycle, which is indivisible to a bundler, so every route ships
all of them. Measured before this work: 454 KB gz total, largest chunk 120 KB
gz. That number does not justify the ~2,000-line extraction it would take to
break the cycle, so it was not done. This ADR records the measurement so the
question isn't reopened on intuition.

**Adding a top-level segment now has a second step:** `APP_PREFIXES` in
`middleware.js`, or the route is not gated.

## Alternatives rejected

- **Keeping `/dashboard` as a prefix** (`/dashboard/properties`). Longer URLs
  for no benefit; route groups already give a shared guard without a segment.
- **A team-scoped prefix** (`/t/:team/...`). Would future-proof multi-team users
  but adds a segment to every URL and every link today, for a case that does not
  exist yet.
- **Server-component rewrite per route.** The genuine best-practice endpoint, but
  it breaks the optimistic-update hooks and runs straight into the service-role
  hazard above. The anon server client is the groundwork if this is revisited.
- **Intercepting/parallel routes for the modal record views.** Real complexity —
  parallel slots, a `default.js` per slot, a full-page fallback — for a slightly
  prettier URL than `?request=<id>`.
- **`router.back()` for detail-page back buttons.** After a delete, back returns
  you to a record that no longer exists; on a deep-linked page there is no
  in-app history at all. Explicit "up" links to the list are predictable.
