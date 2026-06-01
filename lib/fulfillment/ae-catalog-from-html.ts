import {
  normalizeHtmlForJsonScan,
  parseAeCatalogFromHtmlDeep,
} from "@/lib/fulfillment/ae-html-deep-scrape"
import { extractLooseAeSkuRowsFromHtml } from "@/lib/fulfillment/ae-html-loose-sku-extract"
import { parseAliExpressHtml, extractWindowJson } from "@/lib/import-url-scrape"
import { normalizeAerRoot } from "@/lib/fulfillment/ae-aer-normalize"
import { parseAeSkusFromPagePayload, type AePageParseResult } from "@/lib/fulfillment/ae-page-skus"
import { normalizeAeSkuCandidate } from "@/lib/fulfillment/map-catalog-skus-to-ae"
import { canonicalVariantColorKey } from "@/lib/fulfillment/variant-color-match"
import type { AeProductSkuRow } from "@/lib/fulfillment/ae-product-skus"

function skusFromLegacyHtml(html: string, url: string): AeProductSkuRow[] {
  const legacy = parseAliExpressHtml(html, url)
  if (!legacy) return []

  const rows: AeProductSkuRow[] = []
  const seen = new Set<string>()

  for (const v of legacy.variants) {
    const aeSkuId = normalizeAeSkuCandidate(v.sku) ?? ""
    if (!aeSkuId || seen.has(aeSkuId)) continue
    seen.add(aeSkuId)

    const colorAttr =
      v.attributes?.Color ??
      v.attributes?.color ??
      v.attributes?.Couleur ??
      Object.values(v.attributes ?? {}).find((_, i) => i === 0) ??
      v.name

    rows.push({
      aeSkuId,
      aeLabel: v.name || colorAttr || aeSkuId,
      matchColor: colorAttr ? canonicalVariantColorKey(String(colorAttr)) : null,
      matchSize: v.type?.toLowerCase().includes("size") ? v.name : null,
      aePriceCents: v.price > 0 ? Math.max(100, Math.round(v.price * 100)) : 0,
      stock: Math.max(0, Math.round(v.stock)),
    })
  }

  return rows
}

/** Best-effort SKU catalogue from AE product HTML (AER + legacy + OpenGraph). */
export function parseAeCatalogFromHtml(html: string, url: string): AePageParseResult {
  const normalized = normalizeHtmlForJsonScan(html)

  const primary = parseAeSkusFromPagePayload(null, { html: normalized, url })
  if (primary.aeSkus.length > 0) return primary

  const aer =
    extractWindowJson(normalized, ["__AER_DATA__"]) ??
    extractWindowJson(normalized, ["__RET_DATA__"]) ??
    extractWindowJson(normalized, ["__INIT_DATA__"]) ??
    extractWindowJson(normalized, ["runParams"])

  const aerRoot = normalizeAerRoot(aer)
  if (aerRoot) {
    const fromBlob = parseAeSkusFromPagePayload(aerRoot, { url })
    if (fromBlob.aeSkus.length > 0) return fromBlob
  }

  const deep = parseAeCatalogFromHtmlDeep(normalized, url)
  if (deep.aeSkus.length > 0) return deep

  const legacySkus = skusFromLegacyHtml(normalized, url)
  if (legacySkus.length > 0) {
    const prices = legacySkus.map((s) => s.aePriceCents).filter((p) => p > 0)
    return {
      aeSkus: legacySkus,
      aePriceCents: prices.length > 0 ? Math.min(...prices) : 0,
      aeShopId: primary.aeShopId,
      title: primary.title,
    }
  }

  const loose = extractLooseAeSkuRowsFromHtml(normalized, url)
  if (loose.length > 0) {
    const prices = loose.map((s) => s.aePriceCents).filter((p) => p > 0)
    return {
      aeSkus: loose,
      aePriceCents: prices.length > 0 ? Math.min(...prices) : 0,
      aeShopId: primary.aeShopId,
      title: primary.title,
    }
  }

  return primary
}
