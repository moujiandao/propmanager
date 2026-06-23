import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Server-side auth guard for the application surface. Runs before the client
// monolith bundle renders, so unauthenticated visitors never see the app shell.
// This answers "is there a valid session?"; the monolith's onAuthStateChange
// effect still resolves *which* kind of user (landlord vs tenant).
export default async function DashboardLayout({ children }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/dashboard')
  }

  return children
}
