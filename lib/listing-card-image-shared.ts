import {
  isDisplayableListingImageUrl,
  PRODUCT_CARD_IMAGE_FALLBACK,
} from "@/lib/affiliate-listing-display"

export const LISTING_CARD_IMAGE_API_PREFIX = "/api/listing-card-image/"

/** `unstable_cache` tag — must match `revalidateListingCardImage`. */
export function listingCardImageCacheTag(listingId: string): string {
  const id = listingId.trim()
  return `listing-card-image:${id}`
}

/** Same-origin thumbnail route — keeps base64 blobs out of catalog JSON. */
export function listingCardImageProxyUrl(listingId: string): string {
  const id = listingId.trim()
  if (!id) return PRODUCT_CARD_IMAGE_FALLBACK
  return `${LISTING_CARD_IMAGE_API_PREFIX}${encodeURIComponent(id)}`
}

export function isListingCardImageProxyUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith(LISTING_CARD_IMAGE_API_PREFIX)
}

/** Remote CDN path when available; otherwise on-demand card thumbnail API. */
export function resolveListingCardImageHref(
  remote: string | null | undefined,
  listingId: string
): string {
  if (remote && isDisplayableListingImageUrl(remote)) return remote.trim()
  const id = listingId.trim()
  if (id) return listingCardImageProxyUrl(id)
  return PRODUCT_CARD_IMAGE_FALLBACK
}
