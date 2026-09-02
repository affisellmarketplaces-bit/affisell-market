import type { ProductListingSeoInput } from "@/lib/product-listing-seo"
import { buildProductOfferJsonLd } from "@/lib/product-listing-seo"

export type ParasiteProductJsonLdInput = ProductListingSeoInput & {
  sellerName: string
  pageUrl: string
}

/** Product JSON-LD for /s/[affiliate]/[product] — seller = affiliate shop. */
export function buildParasiteProductJsonLd(input: ParasiteProductJsonLdInput): Record<string, unknown> {
  const base = buildProductOfferJsonLd({ ...input, customerFacing: true })
  const offers = base.offers
  const offerObj =
    offers && typeof offers === "object" && !Array.isArray(offers)
      ? (offers as Record<string, unknown>)
      : {}

  return {
    ...base,
    offers: {
      ...offerObj,
      url: input.pageUrl,
      seller: {
        "@type": "Organization",
        name: input.sellerName,
      },
    },
  }
}
