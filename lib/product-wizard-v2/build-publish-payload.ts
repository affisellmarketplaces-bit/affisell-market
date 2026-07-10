import type { MerchantDefaultsRow } from "@/lib/merchant-defaults"
import { DELIVERY_WORLDWIDE } from "@/lib/supplier-delivery-countries"

export type WizardV2Draft = {
  name: string
  description: string
  price: number
  categoryId: string
  images: string[]
  commission: number
}

export function buildWizardV2PublishBody(
  draft: WizardV2Draft,
  defaults: MerchantDefaultsRow
): Record<string, unknown> {
  const price = Number.isFinite(draft.price) && draft.price > 0 ? draft.price : 10
  const commission = defaults.defaultCommissionPct ?? 15

  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    price,
    stock: 0,
    commission,
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
}
