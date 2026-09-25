import { createClient } from '@supabase/supabase-js'
import { requireLandlord, requireTeamRecord } from '@/lib/auth/authorize'

export async function POST(request) {
  const { contractId } = await request.json()
  if (!contractId) return Response.json({ error: 'contractId is required.' }, { status: 400 })

  const auth = await requireLandlord()
  if (auth.response) return auth.response

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const access = await requireTeamRecord(supabase, { table: 'contracts', id: contractId, landlordId: auth.landlordId })
  if (access.response) return access.response

  // Detach payments so they aren't cascade-deleted with the contract
  const { error: payErr } = await supabase
    .from('payments')
    .update({ contract_id: null })
    .eq('contract_id', contractId)
  if (payErr) return Response.json({ error: payErr.message }, { status: 400 })

  // Drop tenant links
  const { error: linkErr } = await supabase
    .from('contract_tenants')
    .delete()
    .eq('contract_id', contractId)
  if (linkErr) return Response.json({ error: linkErr.message }, { status: 400 })

  // Delete the lease itself
  const { error: delErr } = await supabase
    .from('contracts')
    .delete()
    .eq('id', contractId)
  if (delErr) return Response.json({ error: delErr.message }, { status: 400 })

  return Response.json({ success: true })
}
