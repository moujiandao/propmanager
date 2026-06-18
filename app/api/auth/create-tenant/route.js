import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { name, lastName, email, phone, propertyId, unit, unitId, landlordId, password, zelleName, status, moveInDate, moveOutDate, notes, securityDeposit, securityDepositRefunded } = await request.json()

  // Use provided email or generate a placeholder so auth user can be created without one
  const authEmail = email?.trim() || `${name.trim().toLowerCase().replace(/\s+/g, '.')}.${Date.now()}@placeholder.local`

  const createPayload = {
    email: authEmail,
    email_confirm: true,
    user_metadata: { role: 'tenant', name },
  }
  if (password) createPayload.password = password

  let authUserId
  let createdAuthUser = false
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser(createPayload)

  if (authError) {
    // Recover from orphaned auth users left behind by prior failures: if an auth row
    // exists for this email but no profile references it, reuse its id.
    const alreadyRegistered = /already.*registered|already.*been.*registered/i.test(authError.message || '')
    if (!alreadyRegistered || !email?.trim()) {
      return Response.json({ error: authError.message }, { status: 400 })
    }

    const lowerEmail = email.trim().toLowerCase()
    const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (listError) return Response.json({ error: authError.message }, { status: 400 })
    const existing = list?.users?.find(u => u.email?.toLowerCase() === lowerEmail)
    if (!existing) return Response.json({ error: authError.message }, { status: 400 })

    const [tenantCheck, landlordCheck] = await Promise.all([
      supabaseAdmin.from('tenant_profiles').select('id').eq('id', existing.id).maybeSingle(),
      supabaseAdmin.from('landlord_profiles').select('id').eq('id', existing.id).maybeSingle(),
    ])
    // Refuse to reuse the auth id if we can't confirm it's an orphan: a transient query
    // error must not be treated the same as "no profile found".
    if (tenantCheck.error || landlordCheck.error) {
      return Response.json({ error: authError.message }, { status: 400 })
    }
    if (tenantCheck.data || landlordCheck.data) {
      return Response.json({ error: 'This email is already registered to another account.' }, { status: 400 })
    }

    authUserId = existing.id
    if (password) {
      const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, { password })
      if (pwError) return Response.json({ error: pwError.message }, { status: 400 })
    }
  } else {
    authUserId = authData.user.id
    createdAuthUser = true
  }

  // Resolve unit_id: prefer the explicit unitId from the client; otherwise look it up by
  // (property_id, unit_number) so the unit dropdown stays in sync with the text field.
  let resolvedUnitId = unitId || null
  if (!resolvedUnitId && propertyId && unit) {
    const { data: matchedUnit } = await supabaseAdmin
      .from('units')
      .select('id')
      .eq('property_id', propertyId)
      .eq('unit_number', String(unit))
      .maybeSingle()
    resolvedUnitId = matchedUnit?.id || null
  }

  const tenantStatus = status || 'current tenant'

  const { error: profileError } = await supabaseAdmin
    .from('tenant_profiles')
    .insert({
      id: authUserId,
      landlord_id: landlordId,
      name,
      last_name: lastName || null,
      email: email?.trim() || authEmail,
      phone,
      property_id: propertyId,
      unit,
      unit_id: resolvedUnitId,
      zelle_name: zelleName?.trim() || null,
      status: tenantStatus,
      move_in_date: moveInDate || null,
      move_out_date: moveOutDate || null,
      notes: notes?.trim() || null,
      security_deposit: securityDeposit === null || securityDeposit === undefined || securityDeposit === '' ? null : +securityDeposit,
      security_deposit_refunded: !!securityDepositRefunded,
    })

  if (profileError) {
    // Don't leave an orphan: clean up the auth user we just created so a retry isn't blocked.
    if (createdAuthUser) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId)
    }
    return Response.json({ error: profileError.message }, { status: 400 })
  }

  // If the new tenant occupies a unit, recompute occupancy for the entire property
  if (resolvedUnitId && tenantStatus === 'current tenant' && propertyId) {
    const { data: propertyUnits } = await supabaseAdmin
      .from('units')
      .select('id')
      .eq('property_id', propertyId)

    if (propertyUnits?.length) {
      const unitIds = propertyUnits.map(u => u.id)
      const { data: occupiedTenants } = await supabaseAdmin
        .from('tenant_profiles')
        .select('unit_id')
        .in('unit_id', unitIds)
        .eq('status', 'current tenant')

      const occupiedUnitIds = new Set((occupiedTenants || []).map(t => t.unit_id))
      for (const u of propertyUnits) {
        const newStatus = occupiedUnitIds.has(u.id) ? 'occupied' : 'vacant'
        await supabaseAdmin.from('units').update({ status: newStatus }).eq('id', u.id)
      }
    }
  }

  // Welcome emails temporarily disabled
  if (false && email?.trim()) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

    let emailHtml
    if (password) {
      emailHtml = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #0f172a;">Welcome, ${name}!</h2>
          <p>Your landlord has created a tenant account for you on PropManager.</p>
          <p>Use the details below to log in:</p>
          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 6px;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 0;"><strong>Password:</strong> ${password}</p>
          </div>
          <a href="${appUrl}" style="display: inline-block; background: #d97706; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
            Log In to Your Portal
          </a>
          <p style="color: #64748b; font-size: 13px;">We recommend changing your password after your first login.</p>
        </div>
      `
    } else {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email })
      if (linkError) return Response.json({ error: linkError.message }, { status: 400 })
      emailHtml = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #0f172a;">Welcome, ${name}!</h2>
          <p>Your landlord has created a tenant account for you on PropManager.</p>
          <p>Click the button below to set your password and access your portal:</p>
          <a href="${linkData.properties.action_link}" style="display: inline-block; background: #d97706; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
            Set My Password
          </a>
          <p style="color: #64748b; font-size: 13px;">This link expires in 24 hours. If you didn't expect this email, you can ignore it.</p>
        </div>
      `
    }

    await resend.emails.send({
      from: `PropManager <${fromEmail}>`,
      to: email,
      subject: 'Welcome — Your tenant account is ready',
      html: emailHtml,
    })
  }

  return Response.json({ success: true, tenantId: authUserId })
}
