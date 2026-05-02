import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  const { landlordId, propertyId, unit, startDate, endDate, rentAmount, dueDay, tenantIds } = await request.json()

  if (!landlordId) return Response.json({ error: 'landlordId is required.' }, { status: 400 })
  if (!rentAmount) return Response.json({ error: 'rentAmount is required.' }, { status: 400 })
  const tenantList = Array.isArray(tenantIds) ? tenantIds.filter(Boolean) : []
  if (tenantList.length === 0) return Response.json({ error: 'At least one tenant is required.' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: newContract, error: insertError } = await supabase
    .from('contracts')
    .insert({
      landlord_id: landlordId,
      property_id: propertyId || null,
      unit: unit || null,
      start_date: startDate || null,
      end_date: endDate || null,
      rent_amount: +rentAmount,
      due_day: dueDay ? +dueDay : null,
      status: 'active',
    })
    .select()
    .single()

  if (insertError) return Response.json({ error: insertError.message }, { status: 400 })

  const { error: linkError } = await supabase
    .from('contract_tenants')
    .insert(tenantList.map(tid => ({ contract_id: newContract.id, tenant_id: tid })))

  if (linkError) {
    await supabase.from('contracts').delete().eq('id', newContract.id)
    return Response.json({ error: linkError.message }, { status: 400 })
  }

  return Response.json({ success: true, contractId: newContract.id })
}
