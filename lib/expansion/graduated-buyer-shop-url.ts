import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"
import { marketplaceCatalogHref } from "@/lib/marketplace-catalog-url"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"

/** Buyer CTA after permanent country graduation — shipsTo pre-filtered catalog. */
export function resolveGraduatedBuyerShopUrl(countryIso2: string, appUrl = resolveAppUrl()): string {
  const base = appUrl.replace(/\/$/, "")
  const path = marketplaceCatalogHref(PUBLIC_MARKETPLACE_BROWSE_PATH, {
    shipsTo: countryIso2.toLowerCase(),
  })
  return `${base}${path}`
}
