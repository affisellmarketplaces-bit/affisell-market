import type { CatalogAffiliateListingRow } from "@/lib/affiliate-catalog-listing-state"
import { suggestedSellingPriceCents } from "@/lib/affiliate-catalog-margin-display"

export type QuickAddCatalogProduct = {
  id: string
  basePriceCents: number
  affiliateProducts?: CatalogAffiliateListingRow[]
}

export type QuickAddAffiliateListingResponse = {
  id: string
  sellingPriceCents: number
  isListed: boolean
  created: boolean
  published: boolean
  publishBlocked: "no_profile" | "pending" | "rejected" | "needs_info" | null
}

export function optimisticAffiliateListingRow(
  product: QuickAddCatalogProduct,
  listingId: string
): CatalogAffiliateListingRow {
  return {
    id: listingId,
    isListed: false,
    sellingPriceCents: suggestedSellingPriceCents(product.basePriceCents),
    clicks: 0,
    conversions: 0,
  }
}

export function patchCatalogProductListing<T extends QuickAddCatalogProduct>(
  products: T[],
  productId: string,
  listing: CatalogAffiliateListingRow | null
): T[] {
  return products.map((p) =>
    p.id === productId ? { ...p, affiliateProducts: listing ? [listing] : [] } : p
  )
}

export async function requestQuickAddAffiliateListing(
  productId: string
): Promise<QuickAddAffiliateListingResponse> {
  const res = await fetch("/api/affiliate/products/quick-add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ productId }),
  })
  const data = (await res.json()) as {
    error?: string
    id?: string
    sellingPriceCents?: number
    isListed?: boolean
    created?: boolean
    published?: boolean
    publishBlocked?: QuickAddAffiliateListingResponse["publishBlocked"]
  }
  if (!res.ok || !data.id || typeof data.sellingPriceCents !== "number") {
    throw new Error(data.error ?? "Quick add failed")
  }
  return {
    id: data.id,
    sellingPriceCents: data.sellingPriceCents,
    isListed: data.isListed === true,
    created: data.created === true,
    published: data.published === true,
    publishBlocked: data.publishBlocked ?? null,
  }
}

export async function requestPublishAffiliateListing(listingId: string): Promise<{
  isListed: boolean
  publishBlocked?: QuickAddAffiliateListingResponse["publishBlocked"]
}> {
  const res = await fetch(`/api/affiliate/listings/${encodeURIComponent(listingId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isListed: true }),
  })
  const data = (await res.json()) as {
    error?: string
    reason?: QuickAddAffiliateListingResponse["publishBlocked"]
    isListed?: boolean
  }
  if (res.status === 403 && data.error === "merchant_verification_pending") {
    return { isListed: false, publishBlocked: data.reason ?? "pending" }
  }
  if (!res.ok) {
    throw new Error(data.error ?? "Publish failed")
  }
  return { isListed: data.isListed === true }
}

export function quickAddResultToast(
  row: Pick<QuickAddAffiliateListingResponse, "created" | "published" | "publishBlocked">,
  locale: "fr" | "en"
): string {
  if (row.published) {
    return locale === "fr" ? "En ligne sur votre vitrine !" : "Live on your storefront!"
  }
  if (row.publishBlocked === "no_profile") {
    return locale === "fr"
      ? "Brouillon enregistré — complétez la vérification pour publier"
      : "Saved as draft — complete verification to go live"
  }
  if (row.publishBlocked === "rejected") {
    return locale === "fr"
      ? "Brouillon enregistré — vérifiez votre dossier KYC"
      : "Saved as draft — fix your verification profile"
  }
  return locale === "fr"
    ? "Brouillon enregistré — validation KYC en cours"
    : "Saved as draft — verification pending"
}

export function publishBlockedToast(
  reason: QuickAddAffiliateListingResponse["publishBlocked"],
  locale: "fr" | "en"
): string {
  if (reason === "no_profile") {
    return locale === "fr"
      ? "Complétez votre vérification pour publier en vitrine"
      : "Complete verification to publish on your storefront"
  }
  if (reason === "rejected") {
    return locale === "fr" ? "Vérification refusée — corrigez votre dossier" : "Verification rejected — update your profile"
  }
  return locale === "fr" ? "Validation KYC en cours — publication bientôt possible" : "Verification pending — publish unlocks after approval"
}
