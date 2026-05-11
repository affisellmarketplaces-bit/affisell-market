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
      image: image.slice(0, 2000),
    })
  }
  return rows.length ? rows.slice(0, 40) : null
}

/** Migrate `variants.imageByColor` into rows when `colorImages` is empty */
export function buildColorImagesFromLegacy(
  colors: string[],
  variantsRaw: unknown
): ProductColorImageRow[] {
  if (!colors.length) return []
  const v = parseVariantsPayload(variantsRaw)
  const ibc = v?.imageByColor
  return colors.map((c) => {
    const raw = typeof ibc?.[c] === "string" ? ibc[c] : ""
    const image = raw && !raw.startsWith("blob:") ? raw.trim() : ""
    return { color: c, hex: catalogHexForColorName(c), image }
  })
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
    const rowP = parsed?.find((r) => r.color === color)
    const rowL = legacy.find((r) => r.color === color)
    const image = (rowP?.image?.trim() || rowL?.image?.trim() || "")
    return {
      color,
      hex: rowP?.hex || rowL?.hex || catalogHexForColorName(color),
      image,
    }
  })
}
