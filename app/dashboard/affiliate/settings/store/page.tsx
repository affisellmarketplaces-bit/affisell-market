import { redirect } from "next/navigation"

import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { StoreProfileSettings } from "@/components/store-profile-settings"
import { auth } from "@/auth"

export default async function AffiliateStoreSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login/affiliate?callbackUrl=/dashboard/affiliate/settings/store")
  }
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
