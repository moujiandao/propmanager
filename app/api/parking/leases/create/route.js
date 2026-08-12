import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  const { landlordId, parkingSpotId, rate, startDate, endDate, tenantId, renterId, renter, carMake, carModel, carYear } = await request.json()

  if (!landlordId) return Response.json({ error: 'landlordId is required.' }, { status: 400 })
  if (!parkingSpotId) return Response.json({ error: 'parkingSpotId is required.' }, { status: 400 })
  if (!rate) return Response.json({ error: 'rate is required.' }, { status: 400 })
  if (!startDate) return Response.json({ error: 'startDate is required.' }, { status: 400 })

  const targets = [tenantId, renterId, renter].filter(Boolean)
  if (targets.length !== 1) {
    return Response.json({ error: 'Exactly one of tenantId, renterId, or renter is required.' }, { status: 400 })
  }
  if (renter && !renter.name?.trim()) {
    return Response.json({ error: 'Renter name is required.' }, { status: 400 })
  }

  // car_year is a smallint column. core.js already normalizes, but this route
  // is reachable directly, so coerce here too rather than letting a string or
  // NaN reach Postgres.
  const parsedCarYear = Number(carYear)
  const carColumns = {
    car_make: carMake?.trim() || null,
    car_model: carModel?.trim() || null,
    car_year: Number.isFinite(parsedCarYear) && parsedCarYear > 0 ? parsedCarYear : null,
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // A brand-new market renter has no tenant_profiles row and never will --
  // this insert is the only place a parking_renters row gets created, and it
  // never touches auth.users, so a market renter can never get portal access.
  let resolvedRenterId = renterId || null
  let createdRenterId = null
  if (!tenantId && !resolvedRenterId) {
    const { data: newRenter, error: renterError } = await supabase
      .from('parking_renters')
      .insert({
        landlord_id: landlordId,
        name: renter.name.trim(),
        email: renter.email?.trim() || null,
        phone: renter.phone?.trim() || null,
        notes: renter.notes?.trim() || null,
      })
      .select()
      .single()
    if (renterError) return Response.json({ error: renterError.message }, { status: 400 })
    resolvedRenterId = newRenter.id
    createdRenterId = newRenter.id
  }

  const { data: newLease, error: leaseError } = await supabase
    .from('parking_leases')
    .insert({
      landlord_id: landlordId,
      parking_spot_id: parkingSpotId,
      tenant_id: tenantId || null,
      renter_id: resolvedRenterId,
      rate: +rate,
      start_date: startDate,
      end_date: endDate || null,
      ...carColumns,
    })
    .select()
    .single()

  if (leaseError) {
    // Don't leave an orphan renter behind if the lease insert fails (e.g. the
    // overlapping-dates EXCLUDE constraint rejects it) -- same rollback shape
    // as app/api/contracts/create's contract + contract_tenants insert.
    if (createdRenterId) {
      await supabase.from('parking_renters').delete().eq('id', createdRenterId)
    }
    return Response.json({ error: leaseError.message }, { status: 400 })
  }

  return Response.json({ success: true, lease: newLease })
}
