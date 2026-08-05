import { createClient } from '@supabase/supabase-js'
import { isCurrentRow } from '@/lib/tenant/status'
import { TENANT_DELETE_BLOCKERS, summarizeBlockers } from '@/lib/tenant/deletion'

export async function POST(request) {
  const { tenantId } = await request.json()
  if (!tenantId) return Response.json({ error: 'tenantId is required.' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Capture unit/property before deleting so we can recompute occupancy
  const { data: tenant } = await supabase
    .from('tenant_profiles')
    .select('unit_id, property_id')
    .eq('id', tenantId)
    .single()

  // Refuse while anything still points at this tenant, and say what. Several of
  // these FKs would reject the delete anyway, but as an opaque Postgres
  // constraint error; the rest (contract_tenants, parking_leases) cascade and
  // would disappear silently. Counting first turns both into one clear answer.
  const counts = {}
  for (const b of TENANT_DELETE_BLOCKERS) {
    const { count, error } = await supabase
      .from(b.table)
      .select('*', { count: 'exact', head: true })
      .eq(b.column, tenantId)
    // A relation we can't count is left out rather than guessed at — a phantom
    // blocker would make a deletable tenant permanently undeletable.
    if (!error) counts[b.key] = count || 0
  }
  const blockers = summarizeBlockers(counts)
  if (blockers.length > 0) {
    return Response.json({ error: 'Tenant still has linked records.', blockers }, { status: 409 })
  }

  // Delete profile first (FK references auth.users)
  const { error: profileError } = await supabase
    .from('tenant_profiles')
    .delete()
    .eq('id', tenantId)

  if (profileError) return Response.json({ error: profileError.message }, { status: 400 })

  // Delete the auth user, if there is one. Tenants created without a portal
  // login have no auth.users row, so this errors for them — and the profile is
  // already gone by now, making the delete a success from every caller's point
  // of view. Reporting a failure here would be a lie that also hides the real
  // outcome, so it's logged and swallowed.
  const { error: authError } = await supabase.auth.admin.deleteUser(tenantId)
  if (authError) console.warn('[delete-tenant] auth user not removed:', authError.message)

  // Recompute occupancy for the affected property
  if (tenant?.property_id) {
    const { data: propertyUnits } = await supabase
      .from('units')
      .select('id')
      .eq('property_id', tenant.property_id)

    if (propertyUnits?.length) {
      const unitIds = propertyUnits.map(u => u.id)
      // Status is derived, so occupancy can't be filtered in SQL — pull the dates back and
      // apply isCurrentRow here. NB: `t => isCurrentRow(t)`, not a bare reference, or filter
      // would pass the array index as the `today` argument.
      const { data: remaining } = await supabase
        .from('tenant_profiles')
        .select('unit_id, move_in_date, move_out_date')
        .in('unit_id', unitIds)

      const occupiedIds = new Set((remaining || []).filter(t => isCurrentRow(t)).map(t => t.unit_id))
      for (const u of propertyUnits) {
        await supabase.from('units').update({ status: occupiedIds.has(u.id) ? 'occupied' : 'vacant' }).eq('id', u.id)
      }
    }
  }

  return Response.json({ success: true })
}
