import { createClient } from '../../../../lib/supabase/server'

export async function POST(request) {
  const { tenantId, name, phone, propertyId, unit, status, monthlyRent, password, moveInDate, moveOutDate, hasCosigner, studentStatus, studentYear, zelleName, homeAddress, age, unitId } = await request.json()

  if (!tenantId) {
    return Response.json({ error: 'tenantId is required.' }, { status: 400 })
  }

  const supabase = await createClient()

  // Capture the tenant's previous unit_id before updating, so we can recompute occupancy for the old unit too
  const { data: prevTenant } = await supabase
    .from('tenant_profiles')
    .select('unit_id, property_id')
    .eq('id', tenantId)
    .single()

  // Update profile fields
  const { error: profileError } = await supabase
    .from('tenant_profiles')
    .update({
      name,
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
    })
    .eq('id', tenantId)

  if (profileError) {
    return Response.json({ error: profileError.message }, { status: 400 })
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

  // Recompute unit occupancy if unitId changed (or if a property is set)
  // Determine which property to recompute for — use the updated propertyId, falling back to prev
  const affectedPropertyId = propertyId || prevTenant?.property_id
  const unitIdChanged = unitId !== undefined && unitId !== prevTenant?.unit_id

  if (unitIdChanged && affectedPropertyId) {
    // Fetch all units for this property
    const { data: propertyUnits } = await supabase
      .from('units')
      .select('id')
      .eq('property_id', affectedPropertyId)

    if (propertyUnits && propertyUnits.length > 0) {
      // Fetch all tenants that have a unit_id pointing to one of these units
      const unitIds = propertyUnits.map(u => u.id)
      const { data: occupiedTenants } = await supabase
        .from('tenant_profiles')
        .select('unit_id')
        .in('unit_id', unitIds)

      const occupiedUnitIds = new Set((occupiedTenants || []).map(t => t.unit_id))

      // Update each unit's status based on whether any tenant is assigned to it
      for (const unit of propertyUnits) {
        const newStatus = occupiedUnitIds.has(unit.id) ? 'occupied' : 'vacant'
        await supabase.from('units').update({ status: newStatus }).eq('id', unit.id)
      }
    }
  }

  return Response.json({ success: true })
}
