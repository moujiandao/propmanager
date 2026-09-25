import { createClient } from '@supabase/supabase-js'
import { requireLandlord, rejectMismatchedLandlord, requireTeamRecords } from '@/lib/auth/authorize'

export async function POST(request) {
  const { landlordId, propertyId, unit, startDate, endDate, rentAmount, dueDay, tenantIds } = await request.json()

  const auth = await requireLandlord()
  if (auth.response) return auth.response
  const teamMismatch = rejectMismatchedLandlord(landlordId, auth.landlordId)
  if (teamMismatch) return teamMismatch
  if (!rentAmount) return Response.json({ error: 'rentAmount is required.' }, { status: 400 })
  const tenantList = Array.isArray(tenantIds) ? tenantIds.filter(Boolean) : []
  if (tenantList.length === 0) return Response.json({ error: 'At least one tenant is required.' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const propertyAccess = await requireTeamRecords(supabase, { table: 'properties', ids: [propertyId], landlordId: auth.landlordId })
  if (propertyAccess.response) return propertyAccess.response
  const tenantAccess = await requireTeamRecords(supabase, { table: 'tenant_profiles', ids: tenantList, landlordId: auth.landlordId })
  if (tenantAccess.response) return tenantAccess.response

  const { data: newContract, error: insertError } = await supabase
    .from('contracts')
    .insert({
      landlord_id: auth.landlordId,
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
