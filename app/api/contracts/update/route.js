import { createClient } from '@supabase/supabase-js'
import { requireLandlord, requireTeamRecord, requireTeamRecords } from '@/lib/auth/authorize'
import { updateContract } from '../../../../lib/contracts/core.js'
import { createContractsAdapter } from '../../../../lib/contracts/adapter.js'

export async function POST(request) {
  const { contractId, propertyId, unit, startDate, endDate, rentAmount, dueDay, tenantIds } = await request.json()
  if (!contractId) return Response.json({ error: 'contractId is required.' }, { status: 400 })

  const auth = await requireLandlord()
  if (auth.response) return auth.response

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const access = await requireTeamRecord(supabase, { table: 'contracts', id: contractId, landlordId: auth.landlordId })
  if (access.response) return access.response
  const propertyAccess = await requireTeamRecords(supabase, { table: 'properties', ids: [propertyId], landlordId: auth.landlordId })
  if (propertyAccess.response) return propertyAccess.response
  const tenantAccess = await requireTeamRecords(supabase, { table: 'tenant_profiles', ids: Array.isArray(tenantIds) ? tenantIds : [], landlordId: auth.landlordId })
  if (tenantAccess.response) return tenantAccess.response

  // Capture the current parties. The RPC re-verifies the owner before it
  // replaces a single row, so links cannot be lost when an insert fails.
  const { data: existingLinks, error: linksError } = await supabase
    .from('contract_tenants')
    .select('tenant_id')
    .eq('contract_id', contractId)
  if (linksError) return Response.json({ error: linksError.message }, { status: 400 })
  const existingTenantIds = new Set((existingLinks || []).map(r => r.tenant_id))

  try {
    await updateContract(createContractsAdapter(supabase), {
      contractId,
      landlordId: auth.landlordId,
      propertyId,
      unit,
      startDate,
      endDate,
      rentAmount,
      dueDay,
      tenantIds,
    })
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to update lease.' }, { status: 400 })
  }

  // Update move_in_date for newly added tenants when a startDate is provided
  const newTenantIds = (Array.isArray(tenantIds) ? tenantIds : []).filter(tid => !existingTenantIds.has(tid))
  if (startDate && newTenantIds.length) {
    await supabase
      .from('tenant_profiles')
      .update({ move_in_date: startDate })
      .in('id', newTenantIds)
  }

  return Response.json({ success: true })
}
