import { createClient } from '../../../../lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
  const supabaseAdmin = await createClient()
  const { name, email, phone, propertyId, unit, landlordId, password } = await request.json()

  // Create the auth user in Supabase
  const createPayload = {
    email,
    email_confirm: true,
    user_metadata: { role: 'tenant', name },
  }
  if (password) createPayload.password = password

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser(createPayload)

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

  let emailHtml
  if (password) {
    // Tenant has a password — they can log in directly
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
    // No password set — send a "Set My Password" link
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

  return Response.json({ success: true, tenantId: authData.user.id })
}
