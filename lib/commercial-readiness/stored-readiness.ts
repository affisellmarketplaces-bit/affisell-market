/**
 * Commercial readiness of a product ALREADY SAVED — the same engine as the forms (`assessReadinessInput`), fed from the
 * stored row with the rules that judge stored rows elsewhere, so the supplier gets the same verdict before and after
 * saving, and the catalogue health / next best action never carry a second definition:
 *  - the 12 sheet elements: `sheetSignals` (lib/listing-quality/sheet-facts.ts), exactly as the quality measure reads
 *    live sheets;
 *  - the declared quantity: `declaredAvailability` (catalogue health) — SKU rows when present, a product whose variants
 *    live only in the separate table is « not known » (never judged sold out);
 *  - the commission: `productHasExplicitSupplierCommission`, the stored-row definition the settlement and the health
 *    use (a sale without it produces no order).
 * What a stored row can NOT tell is not judged: whether the delivery window was typed or is a default (the server
 * stores 2–5 days when nothing is sent), and the category's required fields (only `POST` checks them).
 * Pure, client-safe.
 */
import {
  assessReadinessInput,
  type ReadinessContext,
  type ReadinessInput,
  type ReadinessReport,
  type ReadinessStage,
} from "@/lib/commercial-readiness/readiness"
import { sheetSignals } from "@/lib/listing-quality/sheet-facts"
import { parseProductOfferMode } from "@/lib/product-offer-mode"
import { parseDeliveryCountryCodes, parseWarehouseType } from "@/lib/supplier-delivery-countries-rules"
import { explicitSupplierCommissionPct, productHasExplicitSupplierCommission } from "@/lib/supplier-explicit-commission"
import { declaredAvailability } from "@/lib/supplier-catalog-health/diagnose"

export type StoredReadinessRow = {
  name: string
  description: string | null
  images: string[]
  categoryId: string | null
  listingKind: string | null
  basePriceCents: number
  offerMode: string | null
  commissionRate: number | null
  variants: unknown
  customColumns: unknown
  stock: number
  hasVariants: boolean
  warehouseType: string | null
  deliveryCountryCodes: string[]
  deliveryMin: number | null
  deliveryMax: number | null
  isDraft: boolean
  /** Reserved attribute rows (identity, product safety, return window, stock marker). */
  attributes: ReadonlyArray<{ key: string; value: string }>
  /** Specification rows (non-reserved, non-empty), counted like the quality measure. */
  specCount: number
}

export function storedReadinessStage(row: Pick<StoredReadinessRow, "isDraft">): ReadinessStage {
  return row.isDraft ? "draft" : "live"
}

export function readinessInputFromStored(row: StoredReadinessRow): ReadinessInput {
  const rowStocks = (row.variants as { variantRows?: Array<{ stock?: unknown }> } | null)?.variantRows
  const availability = declaredAvailability({
    listingKind: row.listingKind,
    variantRowStocks: Array.isArray(rowStocks) && rowStocks.length > 0 ? rowStocks.map((r) => r?.stock) : null,
    hasVariants: row.hasVariants,
    stock: row.stock,
  })
  const offer = parseProductOfferMode(row.offerMode)
  const commissionRate = Number(row.commissionRate) || 0
  const explicit = productHasExplicitSupplierCommission({ commissionRate, variants: row.variants, offerMode: row.offerMode })
  const signals = sheetSignals({
    name: row.name,
    descriptionHtml: row.description ?? "",
    imageCount: row.images.length,
    listingKind: row.listingKind,
    stock: availability.available ?? 0,
    variants: row.variants,
    customColumns: row.customColumns,
    deliveryMin: row.deliveryMin,
    deliveryMax: row.deliveryMax,
    attributes: row.attributes,
    specCount: row.specCount,
  })
  return {
    name: row.name.trim(),
    categoryId: (row.categoryId ?? "").trim(),
    priceCents: Math.max(0, Math.round(row.basePriceCents)),
    offer,
    images: row.images.filter((u): u is string => typeof u === "string"),
    warehouseType: parseWarehouseType(row.warehouseType),
    deliveryCountryCodes: parseDeliveryCountryCodes(row.deliveryCountryCodes),
    listingKind: row.listingKind || "PHYSICAL",
    commission: { ok: explicit, rate: explicit ? explicitSupplierCommissionPct({ commissionRate, variants: row.variants }) : 0 },
    attributes: row.attributes,
    stockKnown: availability.stockKnown,
    // A stored window can not say whether it was typed or defaulted: never reported as a default (stated limit).
    sheet: { signals, defaulted: { delivery: false } },
  }
}

export function assessStoredProductReadiness(row: StoredReadinessRow, ctx: Omit<ReadinessContext, "stage" | "categoryFieldsMissing" | "deliveryTypedBySupplier">): ReadinessReport {
  return assessReadinessInput(readinessInputFromStored(row), { ...ctx, stage: storedReadinessStage(row), categoryFieldsMissing: null })
}
