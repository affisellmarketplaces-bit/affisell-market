import { isPlaceholderColorHex, normalizeColorKey, resolveColorSwatchMeta } from "@/lib/color-name-hex"
import { variantColorsMatch } from "@/lib/fulfillment/variant-color-match"
import { findColorImageRowForName, type ProductColorImageRow } from "@/lib/product-color-images"
import type { CatalogColorSwatch } from "@/lib/product-catalog-constants"

export type MarketplaceColorMetaRow = {
  name: string
  meta: CatalogColorSwatch
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
  return colorNames.map((name) => {
    const row = findColorImageRowForName(colorImages, name)
    const swatch = resolveColorSwatchMeta(name, row?.hex)
    return {
      name,
      meta: {
        name,
        hex: swatch.hex,
        ...(swatch.multicolor ? { multicolor: true } : {}),
      },
    }
  })
}

/** Circular swatches only when options look like real colors (not kit / bundle labels). */
export function shouldShowMarketplaceColorSwatches(meta: MarketplaceColorMetaRow[]): boolean {
  if (meta.length === 0) return false
  const likely = meta.filter((row) => isLikelyColorName(row.name))
  if (likely.length === 0) return false
  if (likely.length < meta.length) return likely.length >= Math.ceil(meta.length / 2)
  return !meta.every((row) => isPlaceholderColorHex(row.meta.hex))
}
