/** Resolve buyer catalog card href — shared by static grid + ProductCard. */
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

  if (listingId && storeSlug) {
    return `/shops/${encodeURIComponent(storeSlug)}/product/${encodeURIComponent(listingId)}`
  }
  if (listingId) return `/marketplace/${encodeURIComponent(listingId)}`
  return "/#explorer"
}

export function normalizeHomeCatalogProduct(raw: unknown): {
  id: string
  title: string
  priceLabel: string
  image: string
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

  const images = o.images
  const imageFromArr = Array.isArray(images) && typeof images[0] === "string" ? images[0] : ""
  const image = String(o.image ?? imageFromArr ?? "").trim() || "/placeholder-product.jpg"

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
    href: homeCatalogProductHref(o),
  }
}
