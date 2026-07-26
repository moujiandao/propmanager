// Audience selection for email automations: given an event type and a landlord's
// dataset, return the candidate tenants before offset/scope filtering, and a
// scope predicate. Extracted from the cron engine so both the cron route and the
// UI can target the same tenants without the logic drifting.

import { contractForTenant } from "./context.js";
import { CURRENT, PREVIOUS } from "../tenant/status.js";

// Candidate tenants for an automation's event type, before offset/scope filtering.
export function candidates(eventType, { tenants, contracts }) {
  switch (eventType) {
    case 'move_out':
      return tenants.filter(t => t.status === CURRENT && t.moveOutDate)
    case 'projected_move_out':
      return tenants.filter(t => t.status === CURRENT && (t.moveOutDate || contractForTenant(contracts, t.id)?.endDate))
    case 'move_in':
      // Deliberately NOT gated on "future tenant". Status derives from the dates, so a
      // tenant flips to current at midnight on their move-in day — an offset-0 reminder
      // would find nobody by the time the daily cron runs. offsetsDueToday() already
      // picks the right day; this only has to exclude people who have since left.
      return tenants.filter(t => t.status !== PREVIOUS && t.moveInDate)
    case 'lease_end':
      return tenants.filter(t => contractForTenant(contracts, t.id)?.endDate)
    case 'rent_due':
      return tenants.filter(t => t.status === CURRENT && contractForTenant(contracts, t.id)?.dueDay)
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
