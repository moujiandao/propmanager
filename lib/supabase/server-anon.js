import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server-side Supabase client using the ANON key, so RLS still applies.
//
// Use this for any server-side READ of application tables — layouts, guards,
// server components. Its sibling lib/supabase/server.js uses the SERVICE ROLE
// key and bypasses RLS entirely; that one is for admin operations in API routes
// (creating auth users, cross-team reads a route has already authorized).
//
// Getting this backwards is not a subtle bug: every query in the app is an
// unfiltered `select("*")` scoped only by `is_team_member(landlord_id)`, so a
// service-role read of, say, tenant_profiles returns every team's tenants.
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          // Called from a Server Component during render, where cookies are
          // read-only. Middleware refreshes the session, so dropping the write
          // here is safe.
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
          catch {}
        },
      },
    }
  )
}
