import { createClient } from '@supabase/supabase-js'

// Minimal endpoint for the inline "Security Deposit Refunded" checkbox on the
// Tenants tab. Updates ONLY that boolean — the full update-tenant route expects
// the entire form payload and would null out other fields if sent a partial body.
export async function POST(request) {
  const { tenantId, refunded } = await request.json()

  if (!tenantId) {
    return Response.json({ error: 'tenantId is required.' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await supabase
    .from('tenant_profiles')
    .update({ security_deposit_refunded: !!refunded })
    .eq('id', tenantId)

  if (error) {
    return Response.json({ error: error.message }, { status: 400 })
  }

  return Response.json({ success: true })
}
