import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  const { propertyId, address, city, state, zip, units, type, status, driveLink, inProduction } = await request.json()

  if (!propertyId) {
    return Response.json({ error: 'propertyId is required.' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await supabase
    .from('properties')
    .update({
      address,
      city,
      state,
      zip,
      units: units != null ? +units : undefined,
      type,
      status,
      drive_link: driveLink?.trim() || null,
      // Matches the `units` pattern above: undefined is dropped by JSON.stringify, so a
      // caller that omits inProduction leaves the column untouched rather than resetting it.
      in_production: typeof inProduction === 'boolean' ? inProduction : undefined,
    })
    .eq('id', propertyId)

  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ success: true })
}
