import { createClient } from '@supabase/supabase-js'
import { requireLandlord, rejectMismatchedLandlord, requireTeamRecords } from '@/lib/auth/authorize'
import { createContract } from '../../../../lib/contracts/core.js'
import { createContractsAdapter } from '../../../../lib/contracts/adapter.js'

export async function POST(request) {
  const { landlordId, propertyId, unit, startDate, endDate, rentAmount, dueDay, tenantIds } = await request.json()

  const auth = await requireLandlord()
  if (auth.response) return auth.response
  const teamMismatch = rejectMismatchedLandlord(landlordId, auth.landlordId)
  if (teamMismatch) return teamMismatch

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const propertyAccess = await requireTeamRecords(supabase, { table: 'properties', ids: [propertyId], landlordId: auth.landlordId })
  if (propertyAccess.response) return propertyAccess.response
  const tenantAccess = await requireTeamRecords(supabase, { table: 'tenant_profiles', ids: Array.isArray(tenantIds) ? tenantIds : [], landlordId: auth.landlordId })
  if (tenantAccess.response) return tenantAccess.response

  try {
    // The session's team, never the body's `landlordId`, owns the new lease.
    const result = await createContract(createContractsAdapter(supabase), {
      landlordId: auth.landlordId, propertyId, unit, startDate, endDate, rentAmount, dueDay, tenantIds,
    })
    return Response.json({ success: true, contractId: result.contractId })
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to create lease.' }, { status: 400 })
  }
}
