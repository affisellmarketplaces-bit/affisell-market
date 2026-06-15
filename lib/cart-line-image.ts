import { listingPrimaryImageUrl } from "@/lib/affiliate-listing-display"
import { parseCartVariantSignature } from "@/lib/cart-variant"
import {
  comparableImageUrl,
  findColorImageRowForName,
  imageIndexForColor,
  mergeColorImagesForProduct,
  parseProductColorImagesFromDb,
} from "@/lib/product-color-images"

type ResolveArgs = {
  customImages: string[] | null | undefined
  productImages: string[] | null | undefined
  productColors: string[] | null | undefined
  colorImagesJson: unknown
  variantsJson: unknown
  selectedColor?: string | null
}

/** Common supplier typos → catalog color name (for image map keys). */
function normalizeColorQueryForLookup(raw: string): string {
  const t = raw.trim()
  if (!t) return t
  const typos: Record<string, string> = {
    grenn: "Green",
    grean: "Green",
    greeb: "Green",
    greeen: "Green",
    purpule: "Purple",
    purpel: "Purple",
    balck: "Black",
    blak: "Black",
  }
  const k = t.toLowerCase()
  return typos[k] ?? t
}

/** Distinct image URLs in array order (for color-index fallback). */
function productImageSlotsForColorOrder(urls: string[] | null | undefined): string[] {
  const raw = urls?.filter((u): u is string => typeof u === "string" && Boolean(u.trim())) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of raw) {
    const t = u.trim()
    const key = comparableImageUrl(t)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

function colorOrderImageSlots(
  customImages: string[] | null | undefined,
  productImages: string[] | null | undefined,
  colorCount: number
): string[] {
  const productSlots = productImageSlotsForColorOrder(productImages)
  const customSlots = productImageSlotsForColorOrder(customImages)
  if (colorCount <= 0) return productSlots.length ? productSlots : customSlots
  if (productSlots.length >= colorCount) return productSlots
  if (customSlots.length >= colorCount) return customSlots
  return productSlots.length ? productSlots : customSlots
}

/**
 * Hero image for a cart line: per-color URL from `colorImages` / `variants.imageByColor`,
 * else gallery slot aligned with color order, else listing primary image.
 */
export function resolveCartLineImageUrl(args: ResolveArgs): string {
  const colorNames = Array.isArray(args.productColors)
    ? args.productColors.filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
    : []
  const slotGallery = colorOrderImageSlots(args.customImages, args.productImages, colorNames.length)
  const fallback =
    listingPrimaryImageUrl(args.customImages, args.productImages) || slotGallery[0] || ""

  const raw = typeof args.selectedColor === "string" ? args.selectedColor.trim() : ""
  if (!raw) return fallback

  const merged =
    colorNames.length > 0
      ? mergeColorImagesForProduct(colorNames, args.colorImagesJson, args.variantsJson)
      : (parseProductColorImagesFromDb(args.colorImagesJson) ?? [])

  const normalized = normalizeColorQueryForLookup(raw)
  const lookupColor = normalized !== raw ? normalized : raw
  const galleryIdx = imageIndexForColor(lookupColor, colorNames, merged, slotGallery)
  if (galleryIdx >= 0 && galleryIdx < slotGallery.length) {
    return slotGallery[galleryIdx]!.trim()
  }

  const row = findColorImageRowForName(merged, raw)
  if (row?.image?.trim()) return row.image.trim()

  if (normalized !== raw) {
    const row2 = findColorImageRowForName(merged, normalized)
    if (row2?.image?.trim()) return row2.image.trim()
  }

  return fallback
}

export function colorNameFromVariantLabel(variantLabel: string | null | undefined): string | null {
  const raw = typeof variantLabel === "string" ? variantLabel.trim() : ""
  if (!raw) return null
  const first = raw.split("·")[0]?.trim()
  return first || null
}

type MarketplaceListingForImage = {
  customImages: string[] | null | undefined
  product: {
    images: string[]
    colors: string[]
    colorImages: unknown
    variants: unknown
  }
}

/** Snapshot image for a paid marketplace line (colorway from checkout). */
export function resolveMarketplaceOrderLineImageUrl(
  listing: MarketplaceListingForImage,
  variantLabel: string | null | undefined,
  variantSignature?: string | null
): string {
  const parsed = parseCartVariantSignature(typeof variantSignature === "string" ? variantSignature : "")
  const color = parsed.color || colorNameFromVariantLabel(variantLabel)
  return resolveCartLineImageUrl({
    customImages: listing.customImages,
    productImages: listing.product.images,
    productColors: listing.product.colors,
    colorImagesJson: listing.product.colorImages,
    variantsJson: listing.product.variants,
    selectedColor: color,
  })
}
