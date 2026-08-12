import { cache } from 'react'
import { createClient } from '@/lib/supabase/server-anon'

// Resolve the signed-in user and which surface they belong to.
//
// This is the same probe the monolith used to run client-side in an effect
// (two sequential round trips before any data could load) and that the login
// page runs and then throws away. Doing it on the server removes both from the
// critical path and lets the role be a routing boundary.
//
// `cache()` dedupes it within a single request, so a parent layout and a nested
// role guard that both call this hit the database once.
//
// IMPORTANT — the id/authId split is load-bearing:
//   landlord: `id` is the TEAM id (landlord_profiles.id), `authId` is the auth
//             user. They differ; several auth users can share one team.
//   tenant:   `id` === `authId` === tenant_profiles.id === auth.users.id.
// Anything writing `landlord_id` must use `id`, never `authId`.
//
// This is a UX/routing boundary, NOT a security boundary. RLS is the security
// boundary: a forged role reaches an empty shell, not another team's data.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const { data: membership } = await supabase
    .from('landlord_members')
    .select('landlord_id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()

  if (membership) {
    const { data: landlord } = await supabase
      .from('landlord_profiles')
      .select('id, name')
      .eq('id', membership.landlord_id)
      .maybeSingle()
    if (landlord) {
      return {
        id: landlord.id,
        authId: authUser.id,
        role: 'landlord',
        email: authUser.email,
        name: landlord.name || authUser.email?.split('@')[0],
      }
    }
  }

  const { data: tenant } = await supabase
    .from('tenant_profiles')
    .select('id, name')
    .eq('id', authUser.id)
    .maybeSingle()

  if (tenant) {
    return {
      id: tenant.id,
      authId: authUser.id,
      role: 'tenant',
      email: authUser.email,
      name: tenant.name || authUser.email?.split('@')[0],
    }
  }

  // Valid session, no profile row on either side. The caller decides — the
  // dashboard layout bounces these back to login rather than rendering a shell
  // with no surface to show.
  return { id: null, authId: authUser.id, role: null, email: authUser.email, name: null }
})
