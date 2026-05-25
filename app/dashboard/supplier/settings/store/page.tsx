import { redirect } from "next/navigation"

import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { StoreProfileSettings } from "@/components/store-profile-settings"
import { auth } from "@/auth"

export default async function SupplierStoreSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard/supplier/settings/store")
  }
  const role = (session.user as { role?: string }).role
  if (role !== "SUPPLIER") {
    redirect("/dashboard/supplier")
  }

  return (
    <BentoShell>
      <BentoContainer maxWidth="5xl">
        <StoreProfileSettings
          backHref="/dashboard/supplier"
          backLabel="Supplier dashboard"
          brandStudioHref="/dashboard/supplier/storefront"
          brandStudioLabel="Storefront studio"
        />
      </BentoContainer>
    </BentoShell>
  )
}
