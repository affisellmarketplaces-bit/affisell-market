import type { AeProductSkuRow } from "@/lib/fulfillment/ae-product-skus"
import { normalizeHtmlForJsonScan } from "@/lib/fulfillment/ae-html-deep-scrape"
import { normalizeAeSkuCandidate } from "@/lib/fulfillment/map-catalog-skus-to-ae"
import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"

function pushSku(
  rows: AeProductSkuRow[],
  seen: Set<string>,
  raw: string,
  label?: string
): void {
  const aeSkuId = normalizeAeSkuCandidate(raw)
  if (!aeSkuId || seen.has(aeSkuId)) return
  seen.add(aeSkuId)
  rows.push({
    aeSkuId,
    aeLabel: label?.trim() || aeSkuId,
    matchColor: null,
    matchSize: null,
    aePriceCents: 0,
    stock: 0,
  })
}

/**
 * Last-resort SKU extraction from saved AE pages (IT/FR saves, unicode escapes, URL params).
 */
export function extractLooseAeSkuRowsFromHtml(html: string, url: string): AeProductSkuRow[] {
  const normalized = normalizeHtmlForJsonScan(html)
  const productId = parseAliExpressProductId(url) ?? ""
  const rows: AeProductSkuRow[] = []
  const seen = new Set<string>()

  const patterns = [
    /"skuId"\s*:\s*['"]?(\d{10,22})['"]?/gi,
    /'skuId'\s*:\s*['"]?(\d{10,22})['"]?/gi,
    /"sku_id"\s*:\s*['"]?(\d{10,22})['"]?/gi,
    /"skuIdStr"\s*:\s*['"]?(\d{10,22})['"]?/gi,
    /"skuIdStr"\s*:\s*(\d{10,22})/gi,
    /"selectedSkuId"\s*:\s*['"]?(\d{10,22})['"]?/gi,
    /"defaultSkuId"\s*:\s*['"]?(\d{10,22})['"]?/gi,
    /"itemSkuId"\s*:\s*['"]?(\d{10,22})['"]?/gi,
    /"extSkuId"\s*:\s*['"]?(\d{10,22})['"]?/gi,
    /skuId["']?\s*[:=]\s*['"]?(\d{10,22})/gi,
    /[?&]skuId=(\d{10,22})/gi,
    /[?&]sku_id=(\d{10,22})/gi,
    /data-sku-id=["'](\d{10,22})["']/gi,
  ]

  for (const re of patterns) {
    for (const m of normalized.matchAll(re)) {
      pushSku(rows, seen, m[1] ?? "")
    }
  }

  if (productId && rows.length > 1) {
    return rows.filter((r) => r.aeSkuId !== productId)
  }

  return rows
}
