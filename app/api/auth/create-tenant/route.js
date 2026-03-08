import { createClient } from '../../../../lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
  const supabaseAdmin = await createClient()
  const { name, email, phone, propertyId, unit, landlordId } = await request.json()

  // Create the auth user in Supabase
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { role: 'tenant', name }
  })

  if (authError) return Response.json({ error: authError.message }, { status: 400 })

  // Create tenant profile row
  const { error: profileError } = await supabaseAdmin
    .from('tenant_profiles')
    .insert({
      id: authData.user.id,
      landlord_id: landlordId,
      name,
      email,
      phone,
      property_id: propertyId,
      unit,
      status: 'active'
    })

  if (profileError) return Response.json({ error: profileError.message }, { status: 400 })

  // Generate password reset link (this is how they set their first password)
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
  })

  if (linkError) return Response.json({ error: linkError.message }, { status: 400 })

  // Send welcome email via Resend
  await resend.emails.send({
    from: 'PropManager <noreply@yourdomain.com>',
    to: email,
    subject: 'Welcome — Set up your tenant account',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #0f172a;">Welcome, ${name}!</h2>
        <p>Your landlord has created a tenant account for you on PropManager.</p>
        <p>Click the button below to set your password and access your portal:</p>
        <a href="${linkData.properties.action_link}" 
           style="display: inline-block; background: #d97706; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
          Set My Password
        </a>
        <p style="color: #64748b; font-size: 13px;">This link expires in 24 hours. If you didn't expect this email, you can ignore it.</p>
      </div>
    `
  })

  return Response.json({ success: true, tenantId: authData.user.id })
}
