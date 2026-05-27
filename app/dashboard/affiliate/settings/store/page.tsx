import { redirect } from "next/navigation"
import { requireAffiliateSession } from "@/lib/dashboard-session"

import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { StoreProfileSettings } from "@/components/store-profile-settings"

export default async function AffiliateStoreSettingsPage() {
  const session = await requireAffiliateSession("/dashboard/affiliate/settings/store")

  const role = (session.user as { role?: string }).role
  if (role !== "AFFILIATE") {
    redirect("/dashboard/affiliate")
  }

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl">
        <StoreProfileSettings
          backHref="/dashboard/affiliate"
          backLabel="Affiliate dashboard"
          brandStudioHref="/dashboard/affiliate/brand-studio"
          brandStudioLabel="Brand Studio"
        />
      </BentoContainer>
    </BentoShell>
  )
}
