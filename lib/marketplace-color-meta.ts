import { resolveColorSwatchMeta } from "@/lib/color-name-hex"
import { findColorImageRowForName, type ProductColorImageRow } from "@/lib/product-color-images"
import type { CatalogColorSwatch } from "@/lib/product-catalog-constants"

export type MarketplaceColorMetaRow = {
  name: string
  meta: CatalogColorSwatch
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
