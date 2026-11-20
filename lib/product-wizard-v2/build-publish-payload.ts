import type { MerchantDefaultsRow } from "@/lib/merchant-defaults"
import type { ProductVariantInput } from "@/lib/product-variant-sku"
import {
  validatePublishDeclaration,
  type PublishDeclarationError,
} from "@/lib/product-availability"
import { DELIVERY_WORLDWIDE } from "@/lib/supplier-delivery-countries"

export type WizardV2Draft = {
  name: string
  description: string
  price: number
  /**
   * Quantity the supplier TYPED (required for a physical product without SKU rows).
   * Never defaulted: the wizard used to send a nominal quantity (founder decision 2026-11-19).
   */
  stock?: string | number | null
  categoryId: string
  images: string[]
  commission: number
  descriptionIllustrationImages?: string[]
  /** AE / Express multi-SKU matrix — synced on create when hasVariants. */
  skuVariants?: { hasVariants: boolean; variants: ProductVariantInput[] } | null
  /** Product-safety / identity rows (reserved attribute keys), as the classic form sends them. */
  attributes?: Array<{ key: string; label: string; value: string }>
}

/** Thrown when the draft lacks a declared price or quantity — the UI checks first, this is the last guard. */
export class WizardPublishDeclarationError extends Error {
  readonly codes: PublishDeclarationError[]
  constructor(codes: PublishDeclarationError[]) {
    super(`wizard_publish_declaration:${codes.join(",")}`)
    this.name = "WizardPublishDeclarationError"
    this.codes = codes
  }
}

export function buildWizardV2PublishBody(
  draft: WizardV2Draft,
  defaults: MerchantDefaultsRow
): Record<string, unknown> {
  const sku = draft.skuVariants
  const withSkuRows = Boolean(sku?.hasVariants && Array.isArray(sku.variants) && sku.variants.length > 1)
  // No invented price and no invented quantity any more: refuse instead.
  const declaration = validatePublishDeclaration({
    listingKind: "PHYSICAL",
    price: draft.price,
    stock: draft.stock,
    variantStocks: withSkuRows && sku ? sku.variants.map((v) => v.stock) : null,
  })
  if (!declaration.ok) throw new WizardPublishDeclarationError(declaration.errors)
  const price = declaration.priceEur
  const commission = defaults.defaultCommissionPct ?? 15
  const rate =
    Number.isFinite(draft.commission) && draft.commission > 0 ? draft.commission : commission

  const body: Record<string, unknown> = {
    name: draft.name.trim(),
    description: draft.description.trim(),
    price,
    stock: declaration.stock,
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

  if (draft.descriptionIllustrationImages && draft.descriptionIllustrationImages.length > 0) {
    body.descriptionIllustrationImages = draft.descriptionIllustrationImages.filter((u) =>
      u.startsWith("http")
    )
  }

  const attributes = (draft.attributes ?? []).filter((a) => a.key && a.value.trim())
  if (attributes.length > 0) body.productAttributes = attributes

  if (withSkuRows && sku) {
    const withCommission = sku.variants.map((v) => ({
      ...v,
      commissionRate:
        typeof v.commissionRate === "number" && v.commissionRate > 0 ? v.commissionRate : rate,
    }))
    body.hasVariants = true
    body.variants = withCommission
    body.stock = declaration.stock
  }

  return body
}
