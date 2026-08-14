import type { Session } from "next-auth"

import { ResellerBoutiqueBuyerChrome } from "@/components/boutique/reseller-boutique-buyer-chrome"
import { resolveBoutiqueMerchantNav } from "@/lib/boutique/boutique-merchant-header-shared"
import type { ResellerBoutiqueStoreContext } from "@/lib/boutique/load-reseller-storefront.server"
import { buildResellerBoutiquePath } from "@/lib/boutique/reseller-store-slug"
import type { StorefrontTrustSnapshot } from "@/lib/storefront-trust-shared"

/** Buyer-facing chrome on `/boutique/` — procedural skin + trust rail (not merchant dashboard nav). */
export function buildResellerBoutiqueHeader(
  storeContext: ResellerBoutiqueStoreContext,
  session: Session | null,
  trust: StorefrontTrustSnapshot | null
) {
  const userId = session?.user?.id
  const isOwner = Boolean(userId && userId === storeContext.ownerUserId)
  const nav = resolveBoutiqueMerchantNav("AFFILIATE", storeContext.storeSlug)

  return (
    <ResellerBoutiqueBuyerChrome
      storeName={storeContext.storeName}
      logoUrl={storeContext.logoUrl ?? storeContext.aiAvatarUrl}
      shopHomePath={buildResellerBoutiquePath(storeContext.storeSlug)}
      categoriesSlug={storeContext.storeSlug}
      trust={trust}
      ownerDashboardHref={isOwner ? nav.dashboard : null}
    />
  )
}
