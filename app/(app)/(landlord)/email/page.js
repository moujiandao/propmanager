'use client'
import { EmailAutomationPage } from '@/email-automation-components'
import { useLandlordPageProps } from '@/components/route-props'

// Templates / Automations / Inbox are still internal tab state here. Splitting
// them into sibling routes under a shared layout is a follow-up — it needs the
// three tab components exported out of email-automation-components first.
export default function Page() {
  return <EmailAutomationPage {...useLandlordPageProps()} />
}
