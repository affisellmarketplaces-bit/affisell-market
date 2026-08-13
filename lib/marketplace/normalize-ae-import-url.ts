import {
  canonicalAliExpressItemUrl,
  isAliExpressImportInput,
  parseAliExpressProductId,
} from "@/lib/aliexpress-product-id"

export type NormalizedAeImportUrl = {
  productId: string
  canonicalUrl: string
  rawUrl: string
}

/** Same extraction as verify-dropforge-ready.mjs — id + canonical PDP URL. */
export function normalizeAeImportUrl(input: string): NormalizedAeImportUrl | null {
  const rawUrl = input.trim()
  if (!rawUrl) return null
  if (!isAliExpressImportInput(rawUrl)) return null
  const productId = parseAliExpressProductId(rawUrl)
  if (!productId) return null
  return {
    productId,
    canonicalUrl: canonicalAliExpressItemUrl(productId),
    rawUrl,
  }
}
