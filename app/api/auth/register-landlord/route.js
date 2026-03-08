import { createClient } from '../../../../lib/supabase/server'

export async function POST(request) {
  const { name, email, password } = await request.json()

  if (!name || !email || !password) {
    return Response.json({ error: 'Name, email, and password are required.' }, { status: 400 })
  }
  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const supabase = await createClient()

  // Create the auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'landlord', name },
  })

  if (authError) {
    const message = authError.message.toLowerCase().includes('already registered')
      ? 'An account with this email already exists.'
      : authError.message
    return Response.json({ error: message }, { status: 400 })
  }

  // Create landlord profile row
  const { error: profileError } = await supabase
    .from('landlord_profiles')
    .insert({ id: authData.user.id, name, email })

  if (profileError) {
    // Roll back the auth user so the DB and auth stay in sync
    await supabase.auth.admin.deleteUser(authData.user.id)
    return Response.json({ error: profileError.message }, { status: 400 })
  }

  return Response.json({ success: true })
}
