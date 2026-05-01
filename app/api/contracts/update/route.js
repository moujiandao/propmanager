import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  const { contractId, propertyId, unit, startDate, endDate, rentAmount, dueDay, tenantIds } = await request.json()
  if (!contractId) return Response.json({ error: 'contractId is required.' }, { status: 400 })
  const tenantList = Array.isArray(tenantIds) ? tenantIds : []

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Capture existing tenants so we know which are newly assigned
  const { data: existingLinks } = await supabase
    .from('contract_tenants')
    .select('tenant_id')
    .eq('contract_id', contractId)
  const existingTenantIds = new Set((existingLinks || []).map(r => r.tenant_id))

  const { error: updateError } = await supabase
    .from('contracts')
    .update({
      property_id: propertyId || null,
      unit: unit || null,
      start_date: startDate || null,
      end_date: endDate || null,
      rent_amount: rentAmount ? +rentAmount : null,
      due_day: dueDay ? +dueDay : null,
    })
    .eq('id', contractId)
  if (updateError) return Response.json({ error: updateError.message }, { status: 400 })

  // Replace contract_tenants links
  const { error: delError } = await supabase
    .from('contract_tenants')
    .delete()
    .eq('contract_id', contractId)
  if (delError) return Response.json({ error: delError.message }, { status: 400 })

  if (tenantList.length > 0) {
    const { error: insError } = await supabase
      .from('contract_tenants')
      .insert(tenantList.map(tid => ({ contract_id: contractId, tenant_id: tid })))
    if (insError) return Response.json({ error: insError.message }, { status: 400 })
  }

  // Update move_in_date for newly added tenants when a startDate is provided
  const newTenantIds = tenantList.filter(tid => !existingTenantIds.has(tid))
  if (startDate && newTenantIds.length) {
    await supabase
      .from('tenant_profiles')
      .update({ move_in_date: startDate })
      .in('id', newTenantIds)
  }

  return Response.json({ success: true })
}
