import { isPlaceholderColorHex, normalizeColorKey, resolveColorSwatchMeta } from "@/lib/color-name-hex"
import { variantColorsMatch } from "@/lib/fulfillment/variant-color-match"
import { findColorImageRowForName, type ProductColorImageRow } from "@/lib/product-color-images"
import { isUsableProductImageUrl } from "@/lib/product-image-url"
import type { CatalogColorSwatch } from "@/lib/product-catalog-constants"

export type MarketplaceColorMetaRow = {
  name: string
  meta: CatalogColorSwatch
  imageUrl: string | null
}

const NON_COLOR_OPTION_RE =
  /^(no |with |sans |avec |kit|pack|bundle|option|type|model|style|version|hw\b|standard\b)/

const COLORISH_WORD_RE =
  /\b(rose|rouge|noir|blanc|bleu|vert|gris|or|argent|beige|kaki|corail|marron|violet|jaune|orange|pink|red|black|white|blue|green|gray|grey|gold|silver|brown|purple|yellow|turquoise|multicolor|multicolore|haricot|navy|bordeaux|camel|ecru|minuit|midnight|titanium|titane|indigo|transparent)\b/

/** True when a shopper-facing label is a color (not a bundle / kit option). */
export function isLikelyColorName(name: string): boolean {
  const key = normalizeColorKey(name)
  if (!key || key.length > 48) return false
  if (NON_COLOR_OPTION_RE.test(key)) return false
  if (COLORISH_WORD_RE.test(key)) return true
  const resolved = resolveColorSwatchMeta(name)
  if (resolved.multicolor) return true
  if (isPlaceholderColorHex(resolved.hex)) return false
  return resolved.hex.startsWith("#")
}

export function shopperColorLabelsMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a?.trim() || !b?.trim()) return false
  if (a.trim() === b.trim()) return true
  return variantColorsMatch(a, b)
}

/** Build shopper-facing color swatches from supplier color names + stored colorImages. */
export function buildMarketplaceColorMeta(
  colorNames: string[],
  colorImages: ProductColorImageRow[]
): MarketplaceColorMetaRow[] {
  const preliminary = colorNames.map((name) => {
    const row = findColorImageRowForName(colorImages, name)
    const swatch = resolveColorSwatchMeta(name, row?.hex)
    const imageRaw = row?.image?.trim() ?? ""
    const imageUrl = imageRaw && isUsableProductImageUrl(imageRaw) ? imageRaw : null
    return {
      name,
      meta: {
        name,
        hex: swatch.hex,
        ...(swatch.multicolor ? { multicolor: true } : {}),
      },
      imageUrl,
    }
  })

  const hexCounts = new Map<string, number>()
  for (const row of preliminary) {
    const key = row.meta.hex.toLowerCase()
    hexCounts.set(key, (hexCounts.get(key) ?? 0) + 1)
  }

  return preliminary.map((row) => {
    if ((hexCounts.get(row.meta.hex.toLowerCase()) ?? 0) <= 1) return row
    const resolved = resolveColorSwatchMeta(row.name, null)
    return {
      ...row,
      meta: {
        name: row.name,
        hex: resolved.hex,
        ...(resolved.multicolor ? { multicolor: true } : {}),
      },
    }
  })
}

/** Circular swatches only when options look like real colors (not kit / bundle labels). */
export function shouldShowMarketplaceColorSwatches(meta: MarketplaceColorMetaRow[]): boolean {
  if (meta.length === 0) return false
  if (meta.some((row) => row.imageUrl)) return true
  const likely = meta.filter((row) => isLikelyColorName(row.name))
  if (likely.length === 0) return false
  if (likely.length < meta.length) return likely.length >= Math.ceil(meta.length / 2)
  return !meta.every((row) => isPlaceholderColorHex(row.meta.hex))
}
