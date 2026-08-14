import type { Session } from "next-auth"

import { ResellerBoutiqueMerchantHeader } from "@/components/boutique/reseller-boutique-merchant-header"
import type { ResellerBoutiqueStoreContext } from "@/lib/boutique/load-reseller-storefront.server"

export function buildResellerBoutiqueHeader(
  storeContext: ResellerBoutiqueStoreContext,
  session: Session | null
) {
  const userId = session?.user?.id
  const isOwner = Boolean(userId && userId === storeContext.ownerUserId)

  return (
    <ResellerBoutiqueMerchantHeader
      storeSlug={storeContext.storeSlug}
      storeName={storeContext.storeName}
      logoUrl={storeContext.logoUrl}
      aiAvatarUrl={storeContext.aiAvatarUrl}
      isOwner={isOwner}
    />
  )
}
