import type { CanonicalProduct } from "@/lib/integrations/types"
import { hashFromMapped } from "@/lib/supplier-sync/content-hash"
import type { MappedAffisellProduct } from "@/lib/supplier-sync/types"

/** Canonical integration product → Affisell sync row + content hash. */
export function canonicalToMappedProduct(
  product: CanonicalProduct,
  shopHost: string
): MappedAffisellProduct {
  const images = product.images.map((img) => img.url).filter(Boolean)
  const categoryLabel = product.productType?.trim() || product.vendor?.trim() || "Shopify"
  const primarySku =
    product.variants.find((v) => v.sku)?.sku ?? `sfy-pid-${product.externalId}`
  const sourceUrl = shopHost
    ? `https://${shopHost.replace(/^https?:\/\//, "")}/products/${product.handle}`
    : ""

  const mapped: MappedAffisellProduct = {
    externalId: product.externalId,
    name: product.title,
    description: product.descriptionHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || product.title,
    images: images.slice(0, 10),
    basePriceCents: product.priceCents,
    stock: product.inventoryQuantity,
    categoryLabel: categoryLabel.slice(0, 120),
    sourceUrl,
    supplierSku: primarySku.slice(0, 80),
    contentHash: "",
    raw: product.raw,
  }
  mapped.contentHash = hashFromMapped(mapped)
  return mapped
}
