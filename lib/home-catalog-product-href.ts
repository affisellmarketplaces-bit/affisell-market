/** Resolve buyer catalog card href — shared by static grid + ProductCard. */
import {
  isDisplayableListingImageUrl,
  listingPrimaryImageUrl,
  pickListingCardImageUrl,
} from "@/lib/affiliate-listing-display"
import { shopListingPath } from "@/lib/affiliate-routes"
import { resolveListingCardImageHref } from "@/lib/listing-card-image-shared"

export function homeCatalogProductHref(product: Record<string, unknown>): string {
  const listingRaw = product.listingId ?? product.id
  const listingId =
    typeof listingRaw === "string"
      ? listingRaw
      : listingRaw != null && listingRaw !== ""
        ? String(listingRaw)
        : ""
  const storeSlugRaw = product.storeSlug
  const storeSlug =
    typeof storeSlugRaw === "string" && storeSlugRaw.trim() ? storeSlugRaw.trim() : null
  const customSlugRaw = product.customSlug
  const customSlug =
    typeof customSlugRaw === "string" && customSlugRaw.trim() ? customSlugRaw.trim() : null

  if (listingId && storeSlug) {
    return shopListingPath(storeSlug, listingId, customSlug)
  }
  if (listingId) return `/marketplace/${encodeURIComponent(listingId)}`
  return "/#explorer"
}

export function normalizeHomeCatalogProduct(raw: unknown): {
  id: string
  title: string
  priceLabel: string
  image: string
  fallbackImage: string | null
  href: string
} | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const listingRaw = o.listingId ?? o.id
  const id =
    typeof listingRaw === "string"
      ? listingRaw
      : listingRaw != null && listingRaw !== ""
        ? String(listingRaw)
        : ""
  if (!id) return null

  const title = String(o.title ?? o.name ?? "").trim() || "Product"
  const priceRaw = o.price ?? o.sellingPriceCents
  let price = typeof priceRaw === "number" && Number.isFinite(priceRaw) ? priceRaw : Number(priceRaw)
  if (!Number.isFinite(price) && typeof o.sellingPriceCents === "number") {
    price = o.sellingPriceCents / 100
  }
  if (!Number.isFinite(price)) price = 0

  const customImages = Array.isArray(o.customImages)
    ? o.customImages.filter((u): u is string => typeof u === "string")
    : []
  const productImages = Array.isArray(o.images)
    ? o.images.filter((u): u is string => typeof u === "string")
    : []
  const image = resolveListingCardImageHref(
    pickListingCardImageUrl(customImages, productImages) ??
      (typeof o.image === "string" && isDisplayableListingImageUrl(o.image)
        ? o.image.trim()
        : null),
    id
  )
  const fallbackImage =
    listingPrimaryImageUrl(customImages, productImages) || null

  const priceLabel = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(price)

  return {
    id,
    title,
    priceLabel,
    image,
    fallbackImage:
      fallbackImage && fallbackImage !== image ? fallbackImage : null,
    href: homeCatalogProductHref(o),
  }
}
