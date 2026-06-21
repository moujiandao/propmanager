// Audience selection for email automations: given an event type and a landlord's
// dataset, return the candidate tenants before offset/scope filtering, and a
// scope predicate. Extracted from the cron engine so both the cron route and the
// UI can target the same tenants without the logic drifting.

import { contractForTenant } from "./context.js";

// Candidate tenants for an automation's event type, before offset/scope filtering.
export function candidates(eventType, { tenants, contracts }) {
  switch (eventType) {
    case 'move_out':
      return tenants.filter(t => t.status === 'current tenant' && t.moveOutDate)
    case 'projected_move_out':
      return tenants.filter(t => t.status === 'current tenant' && (t.moveOutDate || contractForTenant(contracts, t.id)?.endDate))
    case 'move_in':
      return tenants.filter(t => t.status === 'future tenant' && t.moveInDate)
    case 'lease_end':
      return tenants.filter(t => contractForTenant(contracts, t.id)?.endDate)
    case 'rent_due':
      return tenants.filter(t => t.status === 'current tenant' && contractForTenant(contracts, t.id)?.dueDay)
    default:
      return []
  }
}

export function matchesScope(tenant, scope) {
  if (!scope) return true
  if (scope.propertyId && tenant.propertyId !== scope.propertyId) return false
  if (scope.status && tenant.status !== scope.status) return false
  return true
}
