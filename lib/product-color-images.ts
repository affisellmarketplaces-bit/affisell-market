import { trimColorSwatchImageForStore } from "@/lib/color-swatch-store"
import { isUsableProductImageUrl, resolveUsableProductImageUrl } from "@/lib/product-image-url"
import { resolveColorSwatchMeta } from "@/lib/color-name-hex"
import { variantColorsMatch } from "@/lib/fulfillment/variant-color-match"
import { parseVariantsPayload } from "@/lib/product-variants"

/** Stored on `Product.colorImages` — `hex` resolved from name when absent */
export type ProductColorImageRow = {
  color: string
  hex: string
  image: string
}

export function parseProductColorImagesFromDb(raw: unknown): ProductColorImageRow[] | null {
  if (raw == null) return null
  if (!Array.isArray(raw)) return null
  const rows: ProductColorImageRow[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const color = typeof o.color === "string" ? o.color.trim() : ""
    const hex = typeof o.hex === "string" ? o.hex.trim() : ""
    const image = typeof o.image === "string" ? o.image.trim() : ""
    if (!color) continue
    rows.push({
      color,
      hex: resolveColorSwatchMeta(color, hex).hex,
      image,
    })
  }
  return rows.length ? rows : null
}

/** API / client submit: drop blob URLs, cap length */
export function parseProductColorImagesFromBody(raw: unknown): ProductColorImageRow[] | null {
  if (raw == null) return null
  if (!Array.isArray(raw)) return null
  const rows: ProductColorImageRow[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const color = typeof o.color === "string" ? o.color.trim() : ""
    let image = typeof o.image === "string" ? o.image.trim() : ""
    const hex = typeof o.hex === "string" ? o.hex.trim() : ""
    if (!color) continue
    if (image.startsWith("blob:")) image = ""
    rows.push({
      color,
      hex: resolveColorSwatchMeta(color, hex).hex,
      image: trimColorSwatchImageForStore(image),
    })
  }
  return rows.length ? rows.slice(0, 40) : null
}

/** Resolve key in imageByColor map with case-insensitive fallback. */
function lookupImageByColor(ibc: Record<string, string> | undefined, color: string): string {
  if (!ibc) return ""
  const direct = ibc[color]
  if (typeof direct === "string" && direct.trim()) return direct
  const want = color.trim().toLowerCase()
  const key = Object.keys(ibc).find((k) => k.trim().toLowerCase() === want)
  const v = key ? ibc[key] : ""
  return typeof v === "string" ? v : ""
}

/** Migrate `variants.imageByColor` (+ advanced `variantRows[].image`) into rows when `colorImages` is empty */
export function buildColorImagesFromLegacy(
  colors: string[],
  variantsRaw: unknown
): ProductColorImageRow[] {
  if (!colors.length) return []
  const v = parseVariantsPayload(variantsRaw)
  const ibc = v?.imageByColor as Record<string, string> | undefined
  const variantRows = v?.variantRows ?? []
  return colors.map((c) => {
    const raw = lookupImageByColor(ibc, c)
    let image = raw && !raw.startsWith("blob:") ? raw.trim() : ""
    if (!image && variantRows.length > 0) {
      const lc = c.trim().toLowerCase()
      const vr = variantRows.find(
        (r) => Boolean(r.image?.trim()) && r.name.trim().toLowerCase().includes(lc)
      )
      if (vr?.image?.trim()) image = vr.image.trim()
    }
    return { color: c, hex: resolveColorSwatchMeta(c).hex, image }
  })
}

/** Compare image URLs loosely (ignore query string / trailing slash). */
export function comparableImageUrl(url: string): string {
  const t = url.trim()
  if (!t) return ""
  if (t.startsWith("data:")) return t.toLowerCase()
  try {
    const u = new URL(t, "https://placeholder.local")
    return `${u.pathname}${u.hash}`.toLowerCase()
  } catch {
    return t.split("?")[0]!.toLowerCase()
  }
}

export function galleryIndexForImageUrl(url: string, images: string[]): number {
  return urlIndexInGallery(url, images)
}

/** Match supplier color name to a row (exact, then case-insensitive trim). */
export function findColorImageRowForName(
  rows: ProductColorImageRow[],
  colorName: string
): ProductColorImageRow | undefined {
  const want = colorName.trim()
  if (!want) return undefined
  const exact = rows.find((r) => r.color === want)
  if (exact) return exact
  const wl = want.toLowerCase()
  const caseInsensitive = rows.find((r) => r.color.trim().toLowerCase() === wl)
  if (caseInsensitive) return caseInsensitive
  return rows.find((r) => variantColorsMatch(r.color, want))
}

function colorNameIndex(colorNames: string[], color: string): number {
  const want = color.trim().toLowerCase()
  if (!want) return -1
  const exact = colorNames.findIndex((c) => c.trim().toLowerCase() === want)
  if (exact >= 0) return exact
  return colorNames.findIndex((c) => variantColorsMatch(c, color))
}

function urlIndexInGallery(url: string, images: string[]): number {
  const key = comparableImageUrl(url)
  if (!key) return -1
  return images.findIndex((u) => comparableImageUrl(u) === key)
}

/** Which color name owns this image URL in `colorImages` (first match). */
function colorIndexForGalleryUrl(
  url: string,
  colorNames: string[],
  colorImages: ProductColorImageRow[]
): number {
  const key = comparableImageUrl(url)
  if (!key) return -1
  for (let i = 0; i < colorNames.length; i++) {
    const row = findColorImageRowForName(colorImages, colorNames[i]!)
    const direct = row?.image?.trim()
    if (direct && comparableImageUrl(direct) === key) return i
  }
  return -1
}

/**
 * Gallery index from color order (handles one leading lifestyle image when gallery is longer).
 */
function positionalGalleryIndexForColor(
  colorIdx: number,
  color: string,
  colorNames: string[],
  colorImages: ProductColorImageRow[],
  images: string[]
): number | null {
  if (colorIdx < 0) return null
  const row = findColorImageRowForName(colorImages, color)
  const direct = row?.image?.trim()
  const urlIdx = direct ? urlIndexInGallery(direct, images) : -1

  const offsets = images.length > colorNames.length ? [0, 1] : [0]
  let fallback: number | null = null

  for (const offset of offsets) {
    const posIdx = colorIdx + offset
    if (posIdx < 0 || posIdx >= images.length) continue
    if (fallback == null) fallback = posIdx
    if (urlIdx >= 0 && urlIdx === posIdx) return posIdx
  }

  return fallback
}

function usableColorImage(url: string | undefined): string {
  const t = url?.trim() ?? ""
  return t && isUsableProductImageUrl(t) ? t : ""
}

/** Pick gallery index for a color — prefers the supplier's per-color image URL when set. */
export function imageIndexForColor(
  color: string | null,
  colorNames: string[],
  colorImages: ProductColorImageRow[],
  images: string[]
): number {
  if (!images.length) return 0
  if (!color) return 0

  const row = findColorImageRowForName(colorImages, color)
  const direct = usableColorImage(row?.image)

  if (direct) {
    const urlIdx = urlIndexInGallery(direct, images)
    if (urlIdx >= 0) {
      const colorIdx = colorNameIndex(colorNames, color)
      const posIdx = positionalGalleryIndexForColor(colorIdx, color, colorNames, colorImages, images)
      if (posIdx != null && urlIdx === posIdx) return urlIdx

      if (posIdx != null && urlIdx !== posIdx) {
        const urlOwnerIdx = colorIndexForGalleryUrl(direct, colorNames, colorImages)
        if (urlOwnerIdx >= 0 && urlOwnerIdx !== colorIdx) return posIdx
        if (urlOwnerIdx === colorIdx) return urlIdx
        return posIdx
      }

      return urlIdx
    }
  }

  const colorIdx = colorNameIndex(colorNames, color)
  const posIdx = positionalGalleryIndexForColor(colorIdx, color, colorNames, colorImages, images)
  if (posIdx != null) return posIdx
  return 0
}

/** Hero image for a selected color — uses supplier `colorImages` URL first. */
export function resolveColorHeroImageUrl(
  color: string | null,
  colorNames: string[],
  colorImages: ProductColorImageRow[],
  images: string[]
): string {
  if (!color) {
    return resolveUsableProductImageUrl(images[0], images)
  }

  const row = findColorImageRowForName(colorImages, color)
  const direct = row?.image?.trim() ?? ""
  const idx = imageIndexForColor(color, colorNames, colorImages, images)

  return resolveUsableProductImageUrl(direct, [
    images[idx],
    ...colorNames.map((name) => findColorImageRowForName(colorImages, name)?.image),
    ...images,
  ])
}

/** Append variant color hero URLs missing from the main gallery (PDP sync on swatch click). */
export function enrichGalleryWithColorHeroImages(
  gallery: string[],
  colorNames: string[],
  colorImages: ProductColorImageRow[]
): string[] {
  if (colorNames.length === 0 || colorImages.length === 0) return gallery
  const out = [...gallery]
  const seen = new Set(out.map(comparableImageUrl))
  for (const colorName of colorNames) {
    const row = findColorImageRowForName(colorImages, colorName)
    const img = usableColorImage(row?.image)
    if (!img) continue
    const key = comparableImageUrl(img)
    if (!key || seen.has(key)) continue
    out.push(img)
    seen.add(key)
  }
  return out
}

/** Reverse lookup: gallery index → supplier color name when the image maps to a variant. */
export function colorForImageIndex(
  index: number,
  colorNames: string[],
  colorImages: ProductColorImageRow[],
  images: string[]
): string | null {
  if (index < 0 || index >= images.length || colorNames.length === 0) return null
  const urlKey = comparableImageUrl(images[index]!)

  for (const colorName of colorNames) {
    const row = findColorImageRowForName(colorImages, colorName)
    const direct = row?.image?.trim()
    if (direct && comparableImageUrl(direct) === urlKey) return colorName
  }

  for (const colorName of colorNames) {
    if (imageIndexForColor(colorName, colorNames, colorImages, images) === index) {
      return colorName
    }
  }

  return null
}

/** One row per supplier color: prefer `colorImages` JSON, then legacy `variants.imageByColor`. */
export function mergeColorImagesForProduct(
  colors: string[],
  colorImagesJson: unknown,
  variantsRaw: unknown
): ProductColorImageRow[] {
  if (!colors.length) return []
  const parsed = parseProductColorImagesFromDb(colorImagesJson)
  const legacy = buildColorImagesFromLegacy(colors, variantsRaw)
  return colors.map((color) => {
    const rowP = parsed ? findColorImageRowForName(parsed, color) : undefined
    const rowL = legacy.find((r) => r.color === color)
    const image = usableColorImage(rowP?.image?.trim() || rowL?.image?.trim() || "")
    return {
      color,
      hex: resolveColorSwatchMeta(color, rowP?.hex || rowL?.hex).hex,
      image,
    }
  })
}
