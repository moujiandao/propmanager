import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { homeFor } from '@/lib/routes'
import { AppShell } from '@/components/app-shell'

// Role boundary for the landlord surface. `(landlord)` is a route group, so it
// adds nothing to the URL — /properties, not /landlord/properties.
//
// getCurrentUser is React-cache()d, so this and the parent (app) layout resolve
// the user once per request rather than twice.
//
// This is a routing boundary, not a security boundary. RLS is the security
// boundary: a tenant who forced their way past this would get an empty shell,
// not another team's data.
export default async function LandlordLayout({ children }) {
  const user = await getCurrentUser()
  if (user?.role !== 'landlord') redirect(homeFor(user?.role))

  return <AppShell>{children}</AppShell>
}
