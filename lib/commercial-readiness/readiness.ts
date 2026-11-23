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
 * STAGE (2026-11-23, catalogue health): the same engine judges a sheet being written (`new`), a saved draft (`draft`) and
 * a product already on sale (`live`), with what the server REALLY does at that stage — `PUT /api/supplier/products/[id]`
 * on a live product only demands a name, a price and an explicit commission; photos, warehouse zone, delivery countries,
 * exact category, merchant verification and the cap are checked only when a product GOES live. So for a live product
 * those become `prioritaire` (« kept on sale; would be refused for a new publication »), never a fake refusal, and
 * nothing is ever withdrawn. An Affisell hold blocks the sale but is not the supplier's fix (`fixable: false`, never the
 * next fix).
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
  /** What is really prevented today. `null` = nothing is prevented (a risk or an improvement). `save` = the next save
   *  of a product already on sale is refused (it stays on sale as it is). */
  prevents: "publication" | "sale" | "save" | null
  /** The rule in Affisell that decides it (for the supplier: « refusé à la publication », « affiché épuisé »…). */
  basis:
    | "server_refusal"
    | "save_refusal"
    | "not_buyable"
    | "platform_rule"
    | "publication_rule_live"
    | "affisell_decision"
    | "observed_risk"
    | "measured_association"
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
  /** False = the supplier can not fix it (an Affisell decision): counted in the verdict, never the next fix. */
  fixable?: false
  /** The finding is worded for a product ALREADY on sale (texts `finding.<code>.whyLive`). */
  live?: true
}

export type ReadinessStage = "new" | "draft" | "live"

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
  /** `new` (default) = a sheet not saved yet · `draft` = saved, not published · `live` = published (on sale or paused). */
  stage?: ReadinessStage
  /** Affisell holds (recall / suspension) of a saved product; null = unreadable; undefined = not judged (new sheet). */
  holds?: ReadonlyArray<"product_recalled" | "product_suspended"> | null
}

/**
 * What the engine reads, whatever the source: the body a form sends (`readinessInputFromBody`, the server's parsers) or
 * a product already saved (`readinessInputFromStored`, lib/commercial-readiness/stored-readiness.ts — the stored-row
 * rules the settlement and the catalogue health use).
 */
export type ReadinessInput = {
  name: string
  categoryId: string
  priceCents: number
  offer: ReturnType<typeof parseProductOfferMode>
  images: string[]
  warehouseType: ReturnType<typeof parseWarehouseType>
  deliveryCountryCodes: ReturnType<typeof parseDeliveryCountryCodes>
  listingKind: string
  commission: { ok: boolean; rate: number }
  attributes: ReadonlyArray<{ key: string; value: string }>
  /** False when the quantity a buyer sees is not known (variants only in the separate table, unreadable rows). */
  stockKnown: boolean
  sheet: BodySheetSignals
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

export function readinessInputFromBody(body: Record<string, unknown>, ctx: Pick<ReadinessContext, "deliveryTypedBySupplier"> = {}): ReadinessInput {
  const offer = parseProductOfferMode(body.offerMode)
  const listingKind = (str(body.listingKind) || "PHYSICAL").toUpperCase() as Parameters<typeof productCommissionRateForSave>[0]["listingKind"]
  const commission = productCommissionRateForSave({
    topLevelRaw: body.commission ?? body.commissionRate,
    variantCommissionRates: skuRows(body).map((v) => Number(v.commissionRate) || 0).filter((r) => r > 0),
    listingKind,
    requireExplicit: true,
    offerMode: offer,
  })
  return {
    name: str(body.name),
    categoryId: str(body.categoryId),
    priceCents: priceCents(body),
    offer,
    images: Array.isArray(body.images) ? (body.images as unknown[]).filter((u): u is string => typeof u === "string") : [],
    warehouseType: parseWarehouseType(body.warehouseType),
    deliveryCountryCodes: parseDeliveryCountryCodes(body.deliveryCountryCodes),
    listingKind: str(body.listingKind) || "PHYSICAL",
    commission: commission.ok ? { ok: true, rate: commission.rate } : { ok: false, rate: 0 },
    attributes: normalizeProductAttributesFromBody(body.productAttributes),
    stockKnown: true,
    sheet: sheetSignalsFromProductBody(body, { deliveryTypedBySupplier: ctx.deliveryTypedBySupplier }),
  }
}

export function assessCommercialReadiness(body: Record<string, unknown>, ctx: ReadinessContext): ReadinessReport {
  return assessReadinessInput(readinessInputFromBody(body, ctx), ctx)
}

export function assessReadinessInput(input: ReadinessInput, ctx: ReadinessContext): ReadinessReport {
  const sheet = input.sheet
  const s = sheet.signals
  const findings: ReadinessFinding[] = []
  const add = (f: Omit<ReadinessFinding, "dependsOn"> & { dependsOn?: string[] }) => findings.push({ dependsOn: [], ...f })
  const physical = s.physical
  const offer = input.offer
  const stage: ReadinessStage = ctx.stage ?? "new"
  const live = stage === "live"
  /** A rule the server checks only when a product GOES live: blocking before, a priority once it is on sale. */
  const publishRule = (code: string, area: FixArea, effort: ReadinessFinding["effort"], fields: string[], dependsOn: string[] = []) =>
    add(
      live
        ? { code, level: "prioritaire", prevents: null, basis: "publication_rule_live", area, effort, fields, dependsOn, live: true }
        : { code, level: "bloquant", prevents: "publication", basis: "server_refusal", area, effort, fields, dependsOn },
    )
  /** A rule the server checks at EVERY save of a published product (name, price). */
  const saveRule = (code: string, area: FixArea, fields: string[]) =>
    add(
      live
        ? { code, level: "bloquant", prevents: "save", basis: "save_refusal", area, effort: 1, fields, live: true }
        : { code, level: "bloquant", prevents: "publication", basis: "server_refusal", area, effort: 1, fields },
    )

  // ---- Affisell decisions (not the supplier's fix) ----------------------------------------------------------------
  if (ctx.holds === null) add({ code: "hold_unverifiable", level: "prioritaire", prevents: null, basis: "affisell_decision", area: "account", effort: 4, fixable: false })
  else if (ctx.holds && ctx.holds.length > 0) add({ code: "held_by_affisell", level: "bloquant", prevents: "sale", basis: "affisell_decision", area: "account", effort: 4, fixable: false })

  // ---- The server refuses the publication (or the save of a live product) -----------------------------------------
  if (!input.name) saveRule("name_missing", "name", ["name"])
  if (!input.categoryId) publishRule("category_missing", "category", 1, ["category"])
  // Only `POST /api/supplier/products` checks the category's required fields (a PUT never does): judged for a new sheet.
  if (stage === "new" && ctx.categoryFieldsMissing && ctx.categoryFieldsMissing.length > 0) {
    add({ code: "category_fields_missing", level: "bloquant", prevents: "publication", basis: "server_refusal", area: "category_fields", effort: 2, dependsOn: ["category_missing"], fields: [...ctx.categoryFieldsMissing] })
  }
  const cents = input.priceCents
  if (cents <= 0 && offer !== "DONATION") saveRule("price_missing", "price", ["price"])
  if (validateSupplierProductImagesForPublish(input.images)) publishRule("photo_missing", "photos", 2, ["images"])
  // (The wholesale minimum-quantity rule is not judged: the server normalises the quantity to ≥ 2 before checking it,
  // so it never refuses — a rule that never fires is not a blocker.)
  if (validateWarehouseTypePublish(input.warehouseType)) publishRule("warehouse_missing", "warehouse", 1, ["warehouseType"])
  if (validateDeliveryCountriesForPublish(input.deliveryCountryCodes)) publishRule("delivery_countries_missing", "delivery_countries", 1, ["deliveryCountryCodes"])
  const commission = input.commission
  if (!commission.ok) {
    // On sale without an explicit commission, a paid line produces no order (unallocated line, AGENTS.md D6).
    add(
      live
        ? { code: "commission_not_explicit", level: "bloquant", prevents: "sale", basis: "not_buyable", area: "commission", effort: 1, fields: ["commission"], live: true }
        : { code: "commission_not_explicit", level: "bloquant", prevents: "publication", basis: "server_refusal", area: "commission", effort: 1, fields: ["commission"] },
    )
  }
  if (!live && ctx.merchantVerified === false) add({ code: "merchant_unverified", level: "bloquant", prevents: "publication", basis: "server_refusal", area: "account", effort: 4 })
  if (!live && ctx.catalogCapReached === true) add({ code: "catalog_cap_reached", level: "bloquant", prevents: "publication", basis: "server_refusal", area: "account", effort: 4 })

  // Product safety: blocking only where the server enforces it — and only for a NEW publication (never for a product
  // already live); otherwise a priority. Advisory codes (brand, missing GTIN) stay recommendations of the quality measure.
  const safety = evaluateListingReadiness({ listingKind: input.listingKind, attributes: [...input.attributes] })
  if (safety.applicable && safety.blocking.length > 0) {
    const enforced = !live && ctx.listingReadinessMode === "enforce"
    add({
      code: "safety_incomplete",
      level: enforced ? "bloquant" : "prioritaire",
      prevents: enforced ? "publication" : null,
      basis: enforced ? "server_refusal" : "platform_rule",
      area: "safety",
      effort: 3,
      fields: [...new Set(safety.blocking.map((i) => i.field))],
      ...(live ? { live: true as const } : {}),
    })
  }

  // ---- Not buyable -------------------------------------------------------------------------------------------------
  // Imported without a source quantity: publication refused whatever the mode (409 stock_unconfirmed); on sale it shows 0.
  const unconfirmed = physical && s.stockUnconfirmed
  if (unconfirmed) {
    add(
      live
        ? { code: "stock_unconfirmed", level: "bloquant", prevents: "sale", basis: "not_buyable", area: "stock", effort: 1, fields: ["stock"], live: true }
        : { code: "stock_unconfirmed", level: "bloquant", prevents: "publication", basis: "server_refusal", area: "stock", effort: 1, fields: ["stock"] },
    )
  }
  if (physical && input.stockKnown && !unconfirmed && s.stock <= 0) {
    add({ code: "stock_missing", level: "bloquant", prevents: "sale", basis: "not_buyable", area: "stock", effort: 1, fields: ["stock"], ...(live ? { live: true as const } : {}) })
  }

  // ---- Real risks --------------------------------------------------------------------------------------------------
  if (physical && sheet.defaulted.delivery) {
    add({ code: "delivery_time_default", level: "prioritaire", prevents: null, basis: "observed_risk", area: "delivery_time", effort: 1, fields: ["deliveryMin", "deliveryMax"] })
  }
  if (s.variantsDistinct === false) add({ code: "variants_indistinct", level: "prioritaire", prevents: null, basis: "observed_risk", area: "variants", effort: 2, fields: ["variants"] })
  if (physical && input.stockKnown && s.stock > 0 && s.stock <= LOW_STOCK_UNITS) add({ code: "stock_low", level: "prioritaire", prevents: null, basis: "observed_risk", area: "stock", effort: 1, fields: ["stock"] })
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
  // An Affisell decision is never « your next fix »: the supplier can not act on it.
  const fixable = findings.filter((f) => f.fixable !== false)
  if (fixable.length === 0) return null
  const open = new Set(findings.map((f) => f.code))
  const ready = fixable.filter((f) => !f.dependsOn.some((d) => open.has(d)))
  const pool = ready.length > 0 ? ready : [...fixable]
  const top = Math.min(...pool.map((f) => LEVEL_RANK[f.level]))
  let candidates = pool.filter((f) => LEVEL_RANK[f.level] === top)
  if (candidates[0]?.level === "recommande" && candidates.some((f) => f.evidence)) candidates = candidates.filter((f) => f.evidence)
  return [...candidates].sort((a, b) => compare(a, b, findings))[0] ?? null
}
