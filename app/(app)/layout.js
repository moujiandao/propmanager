import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { AppProvider } from '@/components/app-store'

// Guard + store for the whole authenticated surface.
//
// This layout sits above every app route, so the client store it mounts is
// created once and survives soft navigation between routes — Next does not
// re-render a shared parent layout when moving between its children.
//
// It answers both "is there a session?" and "which surface does this user
// belong to?". The role probe used to run client-side in an effect, two
// sequential round trips deep, before any data could load.
export default async function AppLayout({ children }) {
  const user = await getCurrentUser()

  if (!user) redirect('/login?next=/dashboard')

  // Valid session but no landlord_members and no tenant_profiles row: there is
  // no surface to render. Previously the monolith detected this after mounting
  // and bounced with window.location.
  if (!user.role) redirect('/login?next=/dashboard')

  return <AppProvider initialUser={user}>{children}</AppProvider>
}
