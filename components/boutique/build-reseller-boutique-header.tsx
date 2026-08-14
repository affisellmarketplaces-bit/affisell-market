import type { Session } from "next-auth"

import { ResellerBoutiqueMerchantHeader } from "@/components/boutique/reseller-boutique-merchant-header"
import { ResellerBoutiquePublicHeader } from "@/components/boutique/reseller-boutique-public-header"
import type { ResellerBoutiqueStoreContext } from "@/lib/boutique/load-reseller-storefront.server"
import type { BoutiqueMerchantRole } from "@/lib/boutique/boutique-merchant-header-shared"

export function buildResellerBoutiqueHeader(
  storeContext: ResellerBoutiqueStoreContext,
  session: Session | null
) {
  const userId = session?.user?.id
  const role = session?.user?.role
  const isOwner = Boolean(userId && userId === storeContext.ownerUserId)
  const merchantRole: BoutiqueMerchantRole = role === "SUPPLIER" ? "SUPPLIER" : "AFFILIATE"
  const showMerchantNav =
    isOwner && (role === "AFFILIATE" || role === "SUPPLIER")

  if (showMerchantNav) {
    return (
      <ResellerBoutiqueMerchantHeader
        storeSlug={storeContext.storeSlug}
        storeName={storeContext.storeName}
        logoUrl={storeContext.logoUrl}
        aiAvatarUrl={storeContext.aiAvatarUrl}
        role={merchantRole}
        isOwner
      />
    )
  }

  return <ResellerBoutiquePublicHeader />
}
