import type { IntegrationProvider } from "@prisma/client"

import type { CanonicalProduct } from "@/lib/integrations/types"
import { hashFromMapped } from "@/lib/supplier-sync/content-hash"
import type { MappedAffisellProduct } from "@/lib/supplier-sync/types"

function catalogMeta(provider: IntegrationProvider, shopHost: string, handle: string) {
  const base = shopHost.replace(/\/$/, "")
  if (provider === "WOOCOMMERCE") {
    return {
      categoryLabel: "WooCommerce",
      importTag: "woocommerce-sync",
      sourceUrl: `${base}/product/${handle}/`,
      skuPrefix: "woo-pid",
    }
  }
  return {
    categoryLabel: "Shopify",
    importTag: "shopify-sync",
    sourceUrl: base.includes("myshopify")
      ? `https://${base.replace(/^https?:\/\//, "")}/products/${handle}`
      : `${base}/products/${handle}`,
    skuPrefix: "sfy-pid",
  }
}

/** Canonical integration product → Affisell sync row + content hash. */
export function canonicalToMappedProduct(
  product: CanonicalProduct,
  shopHost: string,
  provider: IntegrationProvider = "SHOPIFY"
): MappedAffisellProduct {
  const meta = catalogMeta(provider, shopHost, product.handle)
  const images = product.images.map((img) => img.url).filter(Boolean)
  const categoryLabel =
    product.productType?.trim() || product.vendor?.trim() || meta.categoryLabel
  const primarySku =
    product.variants.find((v) => v.sku)?.sku ?? `${meta.skuPrefix}-${product.externalId}`

  const mapped: MappedAffisellProduct = {
    externalId: product.externalId,
    name: product.title,
    description:
      product.descriptionHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || product.title,
    images: images.slice(0, 10),
    basePriceCents: product.priceCents,
    stock: product.inventoryQuantity,
    categoryLabel: categoryLabel.slice(0, 120),
    sourceUrl: meta.sourceUrl,
    supplierSku: primarySku.slice(0, 80),
    contentHash: "",
    raw: product.raw,
  }
  mapped.contentHash = hashFromMapped(mapped)
  return mapped
}

export function importSourceForProvider(provider: IntegrationProvider): string {
  return provider === "WOOCOMMERCE" ? "woocommerce-sync" : "shopify-sync"
}
