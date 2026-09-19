import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { SupplierShippingProfileEditor } from "@/components/supplier/supplier-shipping-profile-editor"
import { requireSupplierSession } from "@/lib/dashboard-session"
import { loadSupplierShopShippingOffers } from "@/lib/shipping/supplier-shipping-profile.server"

export const dynamic = "force-dynamic"

export default async function SupplierShippingSettingsPage() {
  const session = await requireSupplierSession("/dashboard/supplier/settings/shipping")
  const offers = await loadSupplierShopShippingOffers(session.user.id)

  return (
    <BentoShell>
      <BentoContainer maxWidth="5xl">
        <SupplierShippingProfileEditor initialOffers={offers} />
      </BentoContainer>
    </BentoShell>
  )
}
