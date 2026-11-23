/**
 * ONE definition of the 12 sheet elements' inputs, shared by the server-side measure (`quality-effect.server.ts`,
 * live sheets read from the database) and the supplier's forms (a sheet being written, before it is saved).
 * Pure and client-safe: every import is a pure module.
 */
import { isStockUnconfirmed, STOCK_UNCONFIRMED_KEY } from "@/lib/import-stock"
import { evaluateListingReadiness } from "@/lib/listing-compliance/evaluate"
import { isValidGtin } from "@/lib/listing-compliance/gtin"
import { IDENTITY_KEYS, LISTING_COMPLIANCE_KEYS } from "@/lib/listing-compliance/keys"
import type { QualityProduct } from "@/lib/listing-quality/quality-effect"
import { effectiveReturnWindowDays, parseReturnWindowDays, RETURN_WINDOW_KEY } from "@/lib/return-terms"
import { indistinctVariantRows } from "@/lib/variant-selection"

/** Same set as the catalogue health (`diagnose.ts`): one definition of « physical » for the supplier. */
const NON_PHYSICAL = new Set(["SOFTWARE", "SUBSCRIPTION", "SERVICE", "EXPERIENCE"])

/** Reserved attribute keys: never counted as specifications. */
export const QUALITY_RESERVED_KEYS: readonly string[] = [
  ...new Set([...LISTING_COMPLIANCE_KEYS, IDENTITY_KEYS.gtin, IDENTITY_KEYS.brand, STOCK_UNCONFIRMED_KEY, RETURN_WINDOW_KEY]),
]
const RESERVED = new Set(QUALITY_RESERVED_KEYS)

export function isPhysicalListingKind(kind: string | null | undefined): boolean {
  return !NON_PHYSICAL.has((kind ?? "PHYSICAL").trim().toUpperCase())
}

export function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim()
}

/** Specifications = attribute rows with a value, reserved (identity / safety / return / stock) keys excluded. */
export function countSpecifications(attributes: ReadonlyArray<{ key: string; value?: string | null }>): number {
  return attributes.filter((a) => !RESERVED.has(a.key) && (a.value ?? "").trim() !== "").length
}

export type SheetFacts = {
  name: string
  descriptionHtml: string
  imageCount: number
  listingKind: string | null
  stock: number
  /** Stored `Product.variants` json (or the form's equivalent); only `variantRows` with ≥ 2 rows are judged. */
  variants: unknown
  customColumns: unknown
  deliveryMin: number | null
  deliveryMax: number | null
  /** Reserved attribute rows (identity, product safety, return window, stock marker). */
  attributes: ReadonlyArray<{ key: string; value?: string | null }>
  /** Number of specification rows (see `countSpecifications`). */
  specCount: number
}

export type SheetSignals = Omit<QualityProduct, "id" | "supplierId" | "rootCategoryId" | "basePriceCents" | "createdAt">

export function sheetSignals(f: SheetFacts): SheetSignals {
  const attr = (k: string) => f.attributes.find((a) => a.key === k)?.value?.trim() ?? ""
  const physical = isPhysicalListingKind(f.listingKind)
  const readiness = evaluateListingReadiness({ listingKind: f.listingKind, attributes: f.attributes.map((a) => ({ key: a.key, value: a.value ?? "" })) })
  const rows = (f.variants as { variantRows?: unknown[] } | null)?.variantRows
  const hasRows = Array.isArray(rows) && rows.length > 1
  return {
    imageCount: f.imageCount,
    title: f.name,
    descriptionText: stripHtml(f.descriptionHtml),
    specCount: f.specCount,
    variantsDistinct: hasRows ? indistinctVariantRows(f.variants, f.customColumns).rows <= 1 : null,
    gtinValid: isValidGtin(attr(IDENTITY_KEYS.gtin)),
    brandDeclared: attr(IDENTITY_KEYS.brand).length > 0,
    deliveryMin: f.deliveryMin,
    deliveryMax: f.deliveryMax,
    returnWindowDays: effectiveReturnWindowDays(parseReturnWindowDays(attr(RETURN_WINDOW_KEY))),
    safetyComplete: readiness.applicable ? readiness.blocking.length === 0 : null,
    physical,
    stock: f.stock,
    stockUnconfirmed: isStockUnconfirmed(f.attributes),
  }
}
