/**
 * Commercial readiness of ONE product sheet — « is it really ready to sell on Affisell, and what is the next thing to
 * fix? » (portfolio row 31, 2026-11-23). Pure, client-safe: it reads the body a supplier form is about to SEND, through
 * the same parsers and publication rules the server applies, so it never invents a rule.
 *
 * Three levels, never mixed, each finding saying WHICH real rule decides it:
 *  - `bloquant`    — the server REFUSES the publication (`POST /api/supplier/products`: name, exact category, price,
 *                    photo, warehouse zone, delivery countries, explicit commission, product safety
 *                    when `LISTING_READINESS_MODE=enforce`, merchant verification, live-catalogue cap), or the product can not be BOUGHT
 *                    once published (a physical product with no quantity is shown sold out);
 *  - `prioritaire` — publication goes through but a real risk remains: safety data the platform does not enforce yet,
 *                    a delivery window the supplier never typed (a promise made in its name), variants a buyer can not
 *                    tell apart (never sold precisely), ≤ 3 units, a net per sale ≤ 0 at the supplier's own fee rate;
 *  - `recommande`  — optional quality elements of the sheet-quality measure; a figure ONLY for an association the
 *                    marketplace aggregate established, never a promised gain.
 * Verdict: `bloquant` > `a_corriger` > `pret` (recommendations left never prevent « prêt »). What is unknown on the
 * browser side (the category's required fields, the account status, the safety mode) is passed in or left out — an
 * unknown rule is never turned into a blocker.
 *
 * Adaptive next fix: ONE correction, chosen among the most severe level, whose prerequisites are met, that unblocks the
 * most other findings, then the cheapest, then the strongest measured association.
 */
import type { ListingReadinessMode } from "@/lib/listing-compliance/mode"
import { evaluateListingReadiness } from "@/lib/listing-compliance/evaluate"
import { buildSheetChecklist, type QualityEvidence } from "@/lib/listing-quality/sheet-checklist"
import { sheetSignalsFromProductBody, type BodySheetSignals } from "@/lib/listing-quality/sheet-facts-body"
import type { QualityFeature } from "@/lib/listing-quality/quality-effect"
import { parseProductOfferMode } from "@/lib/product-offer-mode"
import { computeEarningPreview } from "@/lib/supplier-earning-preview"
import { parseDeliveryCountryCodes, parseWarehouseType, validateDeliveryCountriesForPublish, validateWarehouseTypePublish } from "@/lib/supplier-delivery-countries-rules"
import { validateSupplierProductImagesForPublish } from "@/lib/supplier-product-images"
import { productCommissionRateForSave } from "@/lib/supplier-product-commission-save"
import { normalizeProductAttributesFromBody } from "@/lib/supplier-product-attributes"

export type ReadinessLevel = "bloquant" | "prioritaire" | "recommande"
export type ReadinessVerdict = "bloquant" | "a_corriger" | "pret"
/** Where the fix is made. `account` = outside the sheet (merchant verification). */
export type FixArea =
  | "name"
  | "category"
  | "category_fields"
  | "price"
  | "photos"
  | "warehouse"
  | "delivery_countries"
  | "delivery_time"
  | "commission"
  | "safety"
  | "stock"
  | "variants"
  | "quality"
  | "account"

export type ReadinessFinding = {
  code: string
  level: ReadinessLevel
  /** What is really prevented today. `null` = nothing is prevented (a risk or an improvement). */
  prevents: "publication" | "sale" | null
  /** The rule in Affisell that decides it (for the supplier: « refusé à la publication », « affiché épuisé »…). */
  basis: "server_refusal" | "not_buyable" | "platform_rule" | "observed_risk" | "measured_association"
  area: FixArea
  /** Codes that must be fixed first (the fix is not possible, or pointless, before). */
  dependsOn: string[]
  /** 1 = type one value · 2 = add media / several values · 3 = gather documents · 4 = outside the sheet. */
  effort: 1 | 2 | 3 | 4
  /** The sheet-quality element, for `recommande` findings. */
  feature?: QualityFeature
  /** Marketplace aggregate for a recommended element (association, not a cause). */
  evidence?: { ratio: number; lo: number } | null
  /** Field(s) to focus, when the form has them. */
  fields?: string[]
}

export type ReadinessContext = {
  /** `LISTING_READINESS_MODE` the server applies; null = unknown (safety gaps are then a priority, never a blocker). */
  listingReadinessMode: ListingReadinessMode | null
  /** Merchant verification passed? null = unknown (not judged). */
  merchantVerified?: boolean | null
  /** The account's live-catalogue cap is reached (the server refuses a new live product)? null = unknown. */
  catalogCapReached?: boolean | null
  /** Affisell's fee rate this supplier pays (bps); null = unknown (net per sale not judged). */
  supplierFeeBps?: number | null
  /** Required fields of the chosen category still empty, when the form knows them; null/undefined = not judged. */
  categoryFieldsMissing?: string[] | null
  /** False when the form itself put a delivery window in the body (Express). */
  deliveryTypedBySupplier?: boolean
  evidence?: readonly QualityEvidence[]
}

export type ReadinessReport = {
  verdict: ReadinessVerdict
  findings: ReadinessFinding[]
  nextFix: ReadinessFinding | null
  counts: Record<ReadinessLevel, number>
  sheet: BodySheetSignals
}

const LEVEL_RANK: Record<ReadinessLevel, number> = { bloquant: 0, prioritaire: 1, recommande: 2 }
const LOW_STOCK_UNITS = 3

/** Recommended elements already covered by a blocker / priority finding — never shown twice. */
const COVERED_BY_OTHER_RULES: ReadonlySet<QualityFeature> = new Set(["stock_confirmed", "safety_complete", "variants_distinct"])

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")

function priceCents(body: Record<string, unknown>): number {
  const n = Number(typeof body.price === "string" ? body.price.replace(",", ".") : body.price)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0
}

function skuRows(body: Record<string, unknown>): Array<Record<string, unknown>> {
  return Array.isArray(body.variants) ? (body.variants as unknown[]).filter((v): v is Record<string, unknown> => !!v && typeof v === "object") : []
}

export function assessCommercialReadiness(body: Record<string, unknown>, ctx: ReadinessContext): ReadinessReport {
  const sheet = sheetSignalsFromProductBody(body, { deliveryTypedBySupplier: ctx.deliveryTypedBySupplier })
  const s = sheet.signals
  const findings: ReadinessFinding[] = []
  const add = (f: Omit<ReadinessFinding, "dependsOn"> & { dependsOn?: string[] }) => findings.push({ dependsOn: [], ...f })
  const physical = s.physical
  const offer = parseProductOfferMode(body.offerMode)

  // ---- The server refuses the publication -------------------------------------------------------------------------
  if (!str(body.name)) add({ code: "name_missing", level: "bloquant", prevents: "publication", basis: "server_refusal", area: "name", effort: 1, fields: ["name"] })
  if (!str(body.categoryId)) add({ code: "category_missing", level: "bloquant", prevents: "publication", basis: "server_refusal", area: "category", effort: 1, fields: ["category"] })
  if (ctx.categoryFieldsMissing && ctx.categoryFieldsMissing.length > 0) {
    add({ code: "category_fields_missing", level: "bloquant", prevents: "publication", basis: "server_refusal", area: "category_fields", effort: 2, dependsOn: ["category_missing"], fields: [...ctx.categoryFieldsMissing] })
  }
  const cents = priceCents(body)
  if (cents <= 0 && offer !== "DONATION") add({ code: "price_missing", level: "bloquant", prevents: "publication", basis: "server_refusal", area: "price", effort: 1, fields: ["price"] })
  const images = Array.isArray(body.images) ? (body.images as unknown[]).filter((u): u is string => typeof u === "string") : []
  if (validateSupplierProductImagesForPublish(images)) add({ code: "photo_missing", level: "bloquant", prevents: "publication", basis: "server_refusal", area: "photos", effort: 2, fields: ["images"] })
  // (The wholesale minimum-quantity rule is not judged: the server normalises the quantity to ≥ 2 before checking it,
  // so it never refuses — a rule that never fires is not a blocker.)
  if (validateWarehouseTypePublish(parseWarehouseType(body.warehouseType))) {
    add({ code: "warehouse_missing", level: "bloquant", prevents: "publication", basis: "server_refusal", area: "warehouse", effort: 1, fields: ["warehouseType"] })
  }
  if (validateDeliveryCountriesForPublish(parseDeliveryCountryCodes(body.deliveryCountryCodes))) {
    add({ code: "delivery_countries_missing", level: "bloquant", prevents: "publication", basis: "server_refusal", area: "delivery_countries", effort: 1, fields: ["deliveryCountryCodes"] })
  }
  const listingKind = (str(body.listingKind) || "PHYSICAL").toUpperCase() as Parameters<typeof productCommissionRateForSave>[0]["listingKind"]
  const commission = productCommissionRateForSave({
    topLevelRaw: body.commission ?? body.commissionRate,
    variantCommissionRates: skuRows(body).map((v) => Number(v.commissionRate) || 0).filter((r) => r > 0),
    listingKind,
    requireExplicit: true,
    offerMode: offer,
  })
  if (!commission.ok) add({ code: "commission_not_explicit", level: "bloquant", prevents: "publication", basis: "server_refusal", area: "commission", effort: 1, fields: ["commission"] })
  if (ctx.merchantVerified === false) add({ code: "merchant_unverified", level: "bloquant", prevents: "publication", basis: "server_refusal", area: "account", effort: 4 })
  if (ctx.catalogCapReached === true) add({ code: "catalog_cap_reached", level: "bloquant", prevents: "publication", basis: "server_refusal", area: "account", effort: 4 })

  // Product safety: blocking only where the server enforces it; otherwise a priority (it is checked, and the platform
  // can switch enforcement on). Advisory codes (brand, missing GTIN) stay recommendations of the quality measure.
  const safety = evaluateListingReadiness({ listingKind: str(body.listingKind) || "PHYSICAL", attributes: normalizeProductAttributesFromBody(body.productAttributes) })
  if (safety.applicable && safety.blocking.length > 0) {
    const enforced = ctx.listingReadinessMode === "enforce"
    add({
      code: "safety_incomplete",
      level: enforced ? "bloquant" : "prioritaire",
      prevents: enforced ? "publication" : null,
      basis: enforced ? "server_refusal" : "platform_rule",
      area: "safety",
      effort: 3,
      fields: [...new Set(safety.blocking.map((i) => i.field))],
    })
  }

  // ---- Published but not buyable -----------------------------------------------------------------------------------
  if (physical && s.stock <= 0) {
    add({ code: "stock_missing", level: "bloquant", prevents: "sale", basis: "not_buyable", area: "stock", effort: 1, fields: ["stock"] })
  }

  // ---- Real risks --------------------------------------------------------------------------------------------------
  if (physical && sheet.defaulted.delivery) {
    add({ code: "delivery_time_default", level: "prioritaire", prevents: null, basis: "observed_risk", area: "delivery_time", effort: 1, fields: ["deliveryMin", "deliveryMax"] })
  }
  if (s.variantsDistinct === false) add({ code: "variants_indistinct", level: "prioritaire", prevents: null, basis: "observed_risk", area: "variants", effort: 2, fields: ["variants"] })
  if (physical && s.stock > 0 && s.stock <= LOW_STOCK_UNITS) add({ code: "stock_low", level: "prioritaire", prevents: null, basis: "observed_risk", area: "stock", effort: 1, fields: ["stock"] })
  if (commission.ok && cents > 0 && typeof ctx.supplierFeeBps === "number" && ctx.supplierFeeBps >= 0) {
    const net = computeEarningPreview({ priceEur: cents / 100, commissionPct: commission.rate, feeBps: ctx.supplierFeeBps })
    if (net.feeKnown && net.netCents <= 0) add({ code: "net_not_positive", level: "prioritaire", prevents: null, basis: "observed_risk", area: "price", effort: 1, dependsOn: ["price_missing", "commission_not_explicit"], fields: ["price", "commission"] })
  }

  // ---- Recommended quality elements (sheet-quality measure) ---------------------------------------------------------
  const checklist = buildSheetChecklist(s, ctx.evidence ?? [], sheet.defaulted)
  for (const item of checklist.items) {
    if (item.state !== "missing" || COVERED_BY_OTHER_RULES.has(item.feature)) continue
    if (item.feature === "delivery_declared" && findings.some((f) => f.code === "delivery_time_default")) continue
    const photos = item.feature === "photos_3plus" || item.feature === "photos_5plus"
    add({
      code: `quality_${item.feature}`,
      level: "recommande",
      prevents: null,
      basis: "measured_association",
      area: "quality",
      effort: photos ? 2 : 1,
      feature: item.feature,
      evidence: item.evidence,
      dependsOn: photos ? ["photo_missing", ...(item.feature === "photos_5plus" ? ["quality_photos_3plus"] : [])] : [],
    })
  }

  const counts: Record<ReadinessLevel, number> = { bloquant: 0, prioritaire: 0, recommande: 0 }
  for (const f of findings) counts[f.level] += 1
  const verdict: ReadinessVerdict = counts.bloquant > 0 ? "bloquant" : counts.prioritaire > 0 ? "a_corriger" : "pret"
  return { verdict, findings: orderFindings(findings), nextFix: pickNextFix(findings), counts, sheet }
}

/** How many other open findings wait for this one. */
function unblocks(f: ReadinessFinding, all: readonly ReadinessFinding[]): number {
  return all.filter((o) => o !== f && o.dependsOn.includes(f.code)).length
}

function compare(a: ReadinessFinding, b: ReadinessFinding, all: readonly ReadinessFinding[]): number {
  return (
    LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
    unblocks(b, all) - unblocks(a, all) ||
    a.effort - b.effort ||
    (b.evidence?.lo ?? 0) - (a.evidence?.lo ?? 0) ||
    a.code.localeCompare(b.code)
  )
}

export function orderFindings(findings: readonly ReadinessFinding[]): ReadinessFinding[] {
  return [...findings].sort((a, b) => compare(a, b, findings))
}

/**
 * ONE next correction: the most severe level present, prerequisites met (nothing it depends on is still open), then
 * the one that unblocks most, then the cheapest, then the strongest measured association. A recommendation without
 * evidence is never pushed as « next » while one with evidence exists at the same level.
 */
export function pickNextFix(findings: readonly ReadinessFinding[]): ReadinessFinding | null {
  if (findings.length === 0) return null
  const open = new Set(findings.map((f) => f.code))
  const ready = findings.filter((f) => !f.dependsOn.some((d) => open.has(d)))
  const pool = ready.length > 0 ? ready : [...findings]
  const top = Math.min(...pool.map((f) => LEVEL_RANK[f.level]))
  let candidates = pool.filter((f) => LEVEL_RANK[f.level] === top)
  if (candidates[0]?.level === "recommande" && candidates.some((f) => f.evidence)) candidates = candidates.filter((f) => f.evidence)
  return [...candidates].sort((a, b) => compare(a, b, findings))[0] ?? null
}
