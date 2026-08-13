import { absolutizeCdnImageUrl } from "@/lib/cdn-image-url"
import type { AeSkuPropValueMeta } from "@/lib/fulfillment/ae-sku-property-lookup"
import { findImageByDisplayNameInLookup } from "@/lib/fulfillment/ae-sku-property-lookup"
import { stripAeSkuTechnicalLabel } from "@/lib/fulfillment/ae-variant-display-name"
import type { AeProductSkuRow } from "@/lib/fulfillment/ae-product-skus"

export type AeColorSwatchSource = {
  name: string
  image?: string | null
}

function normLabel(raw: string): string {
  return stripAeSkuTechnicalLabel(raw).trim().toLowerCase()
}

function usableImage(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  return absolutizeCdnImageUrl(raw.trim()) ?? null
}

/** Human label → swatch URL (case-insensitive). */
export function buildAeLabelImageAtlas(args: {
  lookup?: Map<string, AeSkuPropValueMeta>
  colorSwatches?: AeColorSwatchSource[]
  variantRows?: Array<{ name?: string; image?: string | null }>
}): Map<string, string> {
  const atlas = new Map<string, string>()

  const put = (label: string, image: string | null | undefined) => {
    const abs = usableImage(image)
    if (!abs) return
    const key = normLabel(label)
    if (!key || atlas.has(key)) return
    atlas.set(key, abs)
  }

  for (const meta of args.lookup?.values() ?? []) {
    if (meta.displayName) put(meta.displayName, meta.imageUrl)
  }

  for (const swatch of args.colorSwatches ?? []) {
    if (swatch.name.trim()) put(swatch.name, swatch.image)
  }

  for (const row of args.variantRows ?? []) {
    const name = row.name?.trim()
    if (name) put(name, row.image)
  }

  return atlas
}

function imageFromAtlas(atlas: Map<string, string>, row: AeProductSkuRow): string | null {
  const candidates = [
    row.aeLabel,
    row.matchColor,
    ...Object.values(row.attributes ?? {}),
  ]
  for (const raw of candidates) {
    if (!raw?.trim()) continue
    const key = normLabel(raw)
    const hit = atlas.get(key)
    if (hit) return hit
  }
  return null
}

/** Fill missing per-SKU swatch URLs from lookup / scraped swatches / human labels. */
export function hydrateAeSkuRowImages(
  rows: AeProductSkuRow[],
  args: {
    lookup?: Map<string, AeSkuPropValueMeta>
    colorSwatches?: AeColorSwatchSource[]
    variantRows?: Array<{ name?: string; image?: string | null }>
  }
): AeProductSkuRow[] {
  const atlas = buildAeLabelImageAtlas(args)
  return rows.map((row) => {
    if (row.imageUrl) return row
    const fromAtlas = imageFromAtlas(atlas, row)
    if (fromAtlas) return { ...row, imageUrl: fromAtlas }
    if (args.lookup && row.aeLabel) {
      const fromLookup = findImageByDisplayNameInLookup(args.lookup, row.aeLabel)
      if (fromLookup) return { ...row, imageUrl: fromLookup }
    }
    return row
  })
}
