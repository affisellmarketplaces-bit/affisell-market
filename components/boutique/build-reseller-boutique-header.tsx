import { buildResellerBoutiqueStorefrontChrome } from "@/components/boutique/build-reseller-boutique-storefront-chrome"
import type { ResellerBoutiqueStoreContext } from "@/lib/boutique/load-reseller-storefront.server"
import type { StorefrontTrustSnapshot } from "@/lib/storefront-trust-shared"

/** @deprecated Prefer `buildResellerBoutiqueStorefrontChrome` — kept for call-site stability. */
export function buildResellerBoutiqueHeader(
  storeContext: ResellerBoutiqueStoreContext,
  trust: StorefrontTrustSnapshot | null
) {
  return buildResellerBoutiqueStorefrontChrome(storeContext, trust)
}
