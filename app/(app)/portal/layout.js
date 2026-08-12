import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { homeFor } from '@/lib/routes'
import { AppShell } from '@/components/app-shell'

// Role boundary for the tenant surface. A tenant's "payments" means pay-my-rent
// and a landlord's means the payment ledger — same word, different resource, so
// they get different namespaces rather than one path that renders two different
// pages depending on who is looking.
export default async function PortalLayout({ children }) {
  const user = await getCurrentUser()
  if (user?.role !== 'tenant') redirect(homeFor(user?.role))

  return <AppShell>{children}</AppShell>
}
