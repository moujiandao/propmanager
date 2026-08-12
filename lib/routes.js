// Every URL in the authenticated app, in one place.
//
// Two rules make this worth having:
//
// 1. Nothing builds a path by string concatenation at the call site. When the
//    shape of a URL changes, it changes here and nowhere else.
// 2. The id in a path goes through `idOf`, and reading it back goes through the
//    matching `find*`. Both accept an object or a bare id. Today they use the
//    UUID; adding a slug column later means editing `idOf` and the finders, not
//    the ~20 places that link to a record.
//
// URLs name resources, not the UI's current label for them. The sidebar says
// "To Do List" and the tenant portal says "Maintenance", but there is one
// resource and one path: /maintenance. Renaming a label must not need a
// redirect.

const idOf = (x) => (x && typeof x === 'object' ? (x.slug ?? x.id) : x);

export const routes = {
  // Landlord
  dashboard:        () => '/dashboard',
  properties:       () => '/properties',
  property:         (p) => `/properties/${idOf(p)}`,
  tenants:          () => '/tenants',
  tenant:           (t) => `/tenants/${idOf(t)}`,
  payments:         () => '/payments',
  maintenance:      () => '/maintenance',
  parking:          () => '/parking',
  leases:           () => '/leases',
  renewals:         () => '/renewals',
  documents:        () => '/documents',
  // Templates/Automations/Inbox are still tabs inside this page rather than
  // sibling routes; when they are split, add them here and the sidebar keeps
  // pointing at whichever one is the landing tab.
  email:            () => '/email',
  reminders:        () => '/settings/reminders',
  team:             () => '/settings/team',

  // Tenant portal. A tenant's "payments" means pay-my-rent; a landlord's means
  // the payment ledger — same word, different resource, so different namespace.
  portal:           () => '/portal',
  portalPayments:   () => '/portal/payments',
  portalHistory:    () => '/portal/payments/history',
  portalMaintenance:() => '/portal/maintenance',
  portalProfile:    () => '/portal/profile',
};

// Where a role belongs when it lands somewhere it shouldn't.
export const homeFor = (role) => (role === 'tenant' ? routes.portal() : routes.dashboard());

// Resolve a route param against the loaded store. Kept here, next to the
// builders, so the read and the write of a URL segment change together.
export const findProperty = (data, param) =>
  (data?.properties || []).find((p) => p.id === param);

export const findTenant = (data, param) =>
  (data?.tenants || []).find((t) => t.id === param);
