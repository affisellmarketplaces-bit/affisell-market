import { trimColorSwatchImageForStore } from "@/lib/color-swatch-image"
import { COLORS } from "@/lib/product-catalog-constants"
import { parseVariantsPayload } from "@/lib/product-variants"

/** Stored on `Product.colorImages` — English UI; `hex` matches catalog when possible */
export type ProductColorImageRow = {
  color: string
  hex: string
  image: string
}

export function catalogHexForColorName(name: string): string {
  const c = COLORS.find((x) => x.name === name)
  if (!c) return "#94a3b8"
  if (c.hex === "multicolor" || c.multicolor) return "multicolor"
  return c.hex
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
      hex: hex || catalogHexForColorName(color),
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
      hex: hex || catalogHexForColorName(color),
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
    return { color: c, hex: catalogHexForColorName(c), image }
  })
}

/** Compare image URLs loosely (ignore query string / trailing slash). */
export function comparableImageUrl(url: string): string {
  const t = url.trim()
  if (!t) return ""
  try {
    const u = new URL(t, "https://placeholder.local")
    return `${u.pathname}${u.hash}`.toLowerCase()
  } catch {
    return t.split("?")[0]!.toLowerCase()
  }
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
  return rows.find((r) => r.color.trim().toLowerCase() === wl)
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
    const image = (rowP?.image?.trim() || rowL?.image?.trim() || "")
    return {
      color,
      hex: rowP?.hex || rowL?.hex || catalogHexForColorName(color),
      image,
    }
  })
}
