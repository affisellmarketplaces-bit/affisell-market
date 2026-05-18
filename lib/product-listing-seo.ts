import type { Metadata } from "next"

export type ProductListingSeoInput = {
  name: string
  description?: string | null
  imageUrl?: string | null
  priceCents: number
  currency?: string
  inStock?: boolean
  /** When true, omit any merchant-only terms from titles/descriptions. */
  customerFacing?: boolean
}

const MERCHANT_TERMS = /\b(marge|margin|commission|wholesale|base\s*price|coût\s*fournisseur)\b/gi

function stripMerchantTerms(text: string): string {
  return text
    .replace(MERCHANT_TERMS, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([|·,])/g, "$1")
    .trim()
}

export function buildProductListingMetadata(input: ProductListingSeoInput): Metadata {
  const titleBase = input.customerFacing ? stripMerchantTerms(input.name) : input.name
  const title = titleBase.slice(0, 60)
  const rawDesc =
    input.description?.trim() ||
    `${titleBase} — disponible sur Affisell. Livraison et retours selon conditions du vendeur.`
  const description = (input.customerFacing ? stripMerchantTerms(rawDesc) : rawDesc).slice(0, 160)

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(input.imageUrl ? { images: [{ url: input.imageUrl, alt: titleBase }] } : {}),
    },
  }
}

export function buildProductOfferJsonLd(input: ProductListingSeoInput): Record<string, unknown> {
  const price = (input.priceCents / 100).toFixed(2)
  const currency = input.currency ?? "EUR"
  const name = input.customerFacing ? stripMerchantTerms(input.name) : input.name

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    ...(input.imageUrl ? { image: [input.imageUrl] } : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: currency,
      price,
      availability:
        input.inStock === false
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
      url: undefined,
    },
  }
}
