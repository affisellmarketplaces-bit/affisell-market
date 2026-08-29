"use client"

import { SiteNav } from "@/components/site-nav"
import type { AffiliateNotificationInboxPayload } from "@/lib/affiliate-notification-inbox-types"

/** Session hydrated from root layout — SiteNav reads it via `useSession` without a client bootstrap fetch. */
export function AppHeader({
  initialRole,
  affiliateNotificationInbox,
}: {
  initialRole?: string | null
  affiliateNotificationInbox?: AffiliateNotificationInboxPayload | null
}) {
  return (
    <SiteNav
      initialRole={initialRole}
      affiliateNotificationInbox={affiliateNotificationInbox}
    />
  )
}
