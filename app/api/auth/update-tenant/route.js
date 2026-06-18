import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  const { tenantId, name, lastName, email, phone, propertyId, unit, status, monthlyRent, password, moveInDate, moveOutDate, hasCosigner, studentStatus, studentYear, zelleName, homeAddress, age, unitId, notes, securityDeposit, securityDepositRefunded } = await request.json()

  if (!tenantId) {
    return Response.json({ error: 'tenantId is required.' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Capture the tenant's previous unit_id and status so we can recompute occupancy when either changes
  const { data: prevTenant } = await supabase
    .from('tenant_profiles')
    .select('unit_id, property_id, status')
    .eq('id', tenantId)
    .single()

  // Verify the tenant exists before updating
  const { count, error: checkError } = await supabase
    .from('tenant_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('id', tenantId)

  if (checkError || count === 0) {
    return Response.json({ error: `No tenant found with id ${tenantId}` }, { status: 404 })
  }

  // Update profile fields
  const profileUpdate = {
    name,
    last_name: lastName !== undefined ? (lastName || null) : undefined,
    phone,
    property_id: propertyId || null,
    unit,
    status,
    monthly_rent: monthlyRent ? +monthlyRent : null,
    move_in_date: moveInDate || null,
    move_out_date: moveOutDate || null,
    has_cosigner: hasCosigner || false,
    student_status: studentStatus || null,
    student_year: studentYear || null,
    zelle_name: zelleName || null,
    home_address: homeAddress || null,
    age: age || null,
    unit_id: unitId || null,
    notes: notes !== undefined ? (notes || null) : undefined,
    security_deposit: securityDeposit !== undefined ? (securityDeposit === null || securityDeposit === '' ? null : +securityDeposit) : undefined,
    security_deposit_refunded: securityDepositRefunded !== undefined ? !!securityDepositRefunded : undefined,
  }
  const trimmedEmail = typeof email === 'string' ? email.trim() : undefined
  if (trimmedEmail !== undefined && trimmedEmail !== '') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return Response.json({ error: 'Invalid email format.' }, { status: 400 })
    }
    profileUpdate.email = trimmedEmail
  }

  const { error: profileError } = await supabase
    .from('tenant_profiles')
    .update(profileUpdate)
    .eq('id', tenantId)

  if (profileError) {
    return Response.json({ error: profileError.message }, { status: 400 })
  }

  // Mirror email change to the auth user so the tenant can still log in
  if (profileUpdate.email) {
    const { error: authEmailError } = await supabase.auth.admin.updateUserById(tenantId, { email: profileUpdate.email })
    if (authEmailError) {
      return Response.json({ error: `Profile updated but auth email change failed: ${authEmailError.message}` }, { status: 400 })
    }
  }

  // Update password if provided
  if (password) {
    if (password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }
    const { error: pwError } = await supabase.auth.admin.updateUserById(tenantId, { password })
    if (pwError) {
      return Response.json({ error: pwError.message }, { status: 400 })
    }
  }

  // Recompute occupancy when either the assigned unit or the tenant's status changes —
  // a tenant flipping current → previous should free the unit even if unit_id stays the same.
  const affectedPropertyId = propertyId || prevTenant?.property_id
  const unitIdChanged = unitId !== undefined && unitId !== prevTenant?.unit_id
  const statusChanged = status !== undefined && status !== prevTenant?.status

  if ((unitIdChanged || statusChanged) && affectedPropertyId) {
    const { data: propertyUnits } = await supabase
      .from('units')
      .select('id')
      .eq('property_id', affectedPropertyId)

    if (propertyUnits && propertyUnits.length > 0) {
      const unitIds = propertyUnits.map(u => u.id)
      // Only "current tenant" rows count toward occupancy
      const { data: occupiedTenants } = await supabase
        .from('tenant_profiles')
        .select('unit_id')
        .in('unit_id', unitIds)
        .eq('status', 'current tenant')

      const occupiedUnitIds = new Set((occupiedTenants || []).map(t => t.unit_id))

      for (const unit of propertyUnits) {
        const newStatus = occupiedUnitIds.has(unit.id) ? 'occupied' : 'vacant'
        await supabase.from('units').update({ status: newStatus }).eq('id', unit.id)
      }
    }
  }

  return Response.json({ success: true })
}
