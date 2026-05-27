import { redirect } from "next/navigation"
import { requireSupplierSession } from "@/lib/dashboard-session"

import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { StoreProfileSettings } from "@/components/store-profile-settings"

export default async function SupplierStoreSettingsPage() {
  const session = await requireSupplierSession("/dashboard/supplier/settings/store")

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
