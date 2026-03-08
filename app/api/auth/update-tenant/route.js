import { createClient } from '../../../../lib/supabase/server'

export async function POST(request) {
  const { tenantId, name, phone, propertyId, unit, status, monthlyRent, password } = await request.json()

  if (!tenantId) {
    return Response.json({ error: 'tenantId is required.' }, { status: 400 })
  }

  const supabase = await createClient()

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

  return Response.json({ success: true })
}
