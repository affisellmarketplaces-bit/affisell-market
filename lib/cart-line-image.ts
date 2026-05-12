import { listingPrimaryImageUrl } from "@/lib/affiliate-listing-display"
import {
  comparableImageUrl,
  findColorImageRowForName,
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

  const row = findColorImageRowForName(merged, raw)
  if (row?.image?.trim()) return row.image.trim()

  const normalized = normalizeColorQueryForLookup(raw)
  if (normalized !== raw) {
    const row2 = findColorImageRowForName(merged, normalized)
    if (row2?.image?.trim()) return row2.image.trim()
  }

  const rl = raw.toLowerCase()
  const idx = colorNames.findIndex((name) => name.trim().toLowerCase() === rl)
  if (idx >= 0 && idx < slotGallery.length) return slotGallery[idx]!.trim()
  const rln = normalized.toLowerCase()
  const idx2 = colorNames.findIndex((name) => name.trim().toLowerCase() === rln)
  if (idx2 >= 0 && idx2 < slotGallery.length) return slotGallery[idx2]!.trim()

  return fallback
}
