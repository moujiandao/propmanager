'use client'
import { EmailPage } from '@/property-management-app'
import { useLandlordPageProps } from '@/components/route-props'

// Payment Reminders (the email_settings feature) lives under /settings, not
// under /email — it is a different feature over a different table from Email
// Automation, and filing it there would imply it is a fourth automation tab.
export default function Page() {
  return <EmailPage {...useLandlordPageProps()} />
}
