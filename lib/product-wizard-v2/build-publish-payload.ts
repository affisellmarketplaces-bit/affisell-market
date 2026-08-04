import type { MerchantDefaultsRow } from "@/lib/merchant-defaults"
import type { ProductVariantInput } from "@/lib/product-variant-sku"
import { DELIVERY_WORLDWIDE } from "@/lib/supplier-delivery-countries"

export type WizardV2Draft = {
  name: string
  description: string
  price: number
  categoryId: string
  images: string[]
  commission: number
  /** AE / Express multi-SKU matrix — synced on create when hasVariants. */
  skuVariants?: { hasVariants: boolean; variants: ProductVariantInput[] } | null
}

export function buildWizardV2PublishBody(
  draft: WizardV2Draft,
  defaults: MerchantDefaultsRow
): Record<string, unknown> {
  const price = Number.isFinite(draft.price) && draft.price > 0 ? draft.price : 10
  const commission = defaults.defaultCommissionPct ?? 15
  const rate =
    Number.isFinite(draft.commission) && draft.commission > 0 ? draft.commission : commission

  const body: Record<string, unknown> = {
    name: draft.name.trim(),
    description: draft.description.trim(),
    price,
    stock: 99,
    commission: rate,
    listingKind: "PHYSICAL",
    images: draft.images.filter((u) => u.startsWith("http")),
    categoryId: draft.categoryId.trim(),
    shippingCountry: defaults.countryCode ?? "FR",
    warehouseType: defaults.warehouseType ?? "regional",
    deliveryCountryCodes: [DELIVERY_WORLDWIDE],
    offerMode: defaults.offerMode ?? "NEW",
    processingTime: 1,
    deliveryMin: 2,
    deliveryMax: 7,
    shippingMethods: ["standard"],
    publish: true,
  }

  const sku = draft.skuVariants
  if (sku?.hasVariants && Array.isArray(sku.variants) && sku.variants.length > 1) {
    const withCommission = sku.variants.map((v) => ({
      ...v,
      commissionRate:
        typeof v.commissionRate === "number" && v.commissionRate > 0 ? v.commissionRate : rate,
    }))
    body.hasVariants = true
    body.variants = withCommission
    body.stock = withCommission.reduce((acc, v) => acc + Math.max(0, v.stock || 0), 0) || 99
  }

  return body
}
