async function createSessionClient() {
  const { createClient } = await import('../supabase/server-anon.js')
  return createClient()
}

// API routes that use the service-role client must establish the caller's team
// before reading or writing application data. A body `landlordId` is useful for
// backwards-compatible client payloads, but is never an authorization claim.
export async function requireSignedIn({ createSession = createSessionClient } = {}) {
  const supabase = await createSession()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth?.user) {
    return { response: Response.json({ error: 'Sign in is required.' }, { status: 401 }) }
  }
  return { authId: auth.user.id, supabase }
}

export async function requireLandlord({ createSession = createSessionClient } = {}) {
  const signedIn = await requireSignedIn({ createSession })
  if (signedIn.response) return signedIn
  const { authId, supabase } = signedIn

  const { data: membership, error: membershipError } = await supabase
    .from('landlord_members')
    .select('landlord_id')
    .eq('auth_user_id', authId)
    .maybeSingle()

  if (membershipError) {
    return { response: Response.json({ error: 'Unable to verify team membership.' }, { status: 503 }) }
  }
  if (!membership?.landlord_id) {
    return { response: Response.json({ error: 'Landlord access is required.' }, { status: 403 }) }
  }

  return { landlordId: membership.landlord_id, authId }
}

export function rejectMismatchedLandlord(requestedLandlordId, landlordId) {
  if (requestedLandlordId && requestedLandlordId !== landlordId) {
    return Response.json({ error: 'The requested team does not match your session.' }, { status: 403 })
  }
  return null
}

// Checks an existing row before a service-role mutation. The returned `row` is
// intentionally small so a caller cannot accidentally start relying on a broad
// cross-team query.
export async function requireTeamRecord(supabase, { table, id, landlordId, select = 'id, landlord_id' }) {
  const { data: row, error } = await supabase
    .from(table)
    .select(select)
    .eq('id', id)
    .maybeSingle()

  if (error) return { response: Response.json({ error: error.message }, { status: 400 }) }
  if (!row) return { response: Response.json({ error: 'Resource not found.' }, { status: 404 }) }
  if (row.landlord_id !== landlordId) {
    return { response: Response.json({ error: 'You do not have access to this resource.' }, { status: 403 }) }
  }
  return { row }
}

export async function requireTeamRecords(supabase, { table, ids, landlordId }) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))]
  if (uniqueIds.length === 0) return { rows: [] }

  const { data: rows, error } = await supabase
    .from(table)
    .select('id, landlord_id')
    .in('id', uniqueIds)

  if (error) return { response: Response.json({ error: error.message }, { status: 400 }) }
  const found = rows || []
  if (found.length !== uniqueIds.length || found.some(row => row.landlord_id !== landlordId)) {
    return { response: Response.json({ error: 'One or more referenced resources are unavailable to this team.' }, { status: 403 }) }
  }
  return { rows: found }
}
