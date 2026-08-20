import { shopifyProductToImportRow } from "@/lib/shopify-sync-map"
import { hashFromMapped } from "@/lib/supplier-sync/content-hash"
import type { MappedAffisellProduct } from "@/lib/supplier-sync/types"

/** Map Shopify Admin REST product JSON → Affisell sync row + content hash. */
export function mapShopifyProductToAffisell(
  product: Record<string, unknown>,
  shopHost: string
): MappedAffisellProduct | null {
  const row = shopifyProductToImportRow(product, shopHost)
  const title = typeof row.title === "string" ? row.title.trim() : ""
  if (!title) return null

  const shopifyProductId =
    product.id != null ? String(product.id).replace(/\D/g, "") : ""
  if (!shopifyProductId) return null

  const price = typeof row.price === "number" ? row.price : 0
  const basePriceCents = Math.max(0, Math.round(price * 100))
  const stock = typeof row.stock === "number" ? row.stock : 0
  const images = Array.isArray(row.images)
    ? row.images.filter((u): u is string => typeof u === "string")
    : []
  const description =
    typeof row.description === "string" ? row.description : title
  const categoryLabel =
    typeof row.category === "string" ? row.category : "Shopify"
  const sourceUrl = typeof row.source_url === "string" ? row.source_url : ""
  const supplierSku = typeof row.sku === "string" ? row.sku : `sfy-pid-${shopifyProductId}`

  const mapped: MappedAffisellProduct = {
    externalId: shopifyProductId,
    name: title.slice(0, 500),
    description: description.slice(0, 8000),
    images: images.slice(0, 10),
    basePriceCents,
    stock,
    categoryLabel,
    sourceUrl,
    supplierSku: supplierSku.slice(0, 80),
    contentHash: "",
    raw: product,
  }
  mapped.contentHash = hashFromMapped(mapped)
  return mapped
}
