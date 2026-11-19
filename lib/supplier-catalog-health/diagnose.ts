/**
 * Supplier catalogue health — what stops a supplier's products from selling, and why.
 *
 * Founder brief 2026-11-19. Four classes, never mixed:
 *  - `blocage`        : an operation is REALLY prevented today (buying, publishing, paying the line out).
 *  - `anomalie`       : data that is incoherent or probably wrong (it may be right — the supplier confirms).
 *  - `avertissement`  : a risk or a fact that deserves attention, nothing is prevented.
 *  - `recommandation` : an optional improvement. NEVER presented as an obligation.
 *
 * Every issue carries the data it rests on (`evidence`) and where that data comes
 * from (`source`): `fiche` = the supplier's own product sheet, `observe` = orders /
 * reseller listings recorded by Affisell, `affisell` = an Affisell rule or decision
 * (recall, suspension, publication control), `calcul` = derived from those.
 *
 * Ranking = commercial impact, from OBSERVED demand only: `weight = 1 + 3 × paid
 * orders (30 days) + resellers listing it`, times the class base. It is an
 * ordering, not a forecast: a blocked product that sells is fixed first.
 *
 * Thresholds and their reasons are next to each rule. Pure, client-safe.
 */

export type HealthClass = "blocage" | "anomalie" | "avertissement" | "recommandation"
export type HealthSource = "fiche" | "observe" | "affisell" | "calcul"
/** What the supplier can do from the panel: an inline quantity, or open the sheet / the hold detail. */
export type HealthFix = "set_stock" | "edit_product" | "view_hold" | "none"

export type HealthIssueCode =
  // blocage
  | "held_by_affisell"
  | "price_missing"
  | "commission_not_explicit"
  | "out_of_stock"
  | "safety_blocks_publication"
  | "stock_unconfirmed"
  // anomalie
  | "stock_nominal"
  | "variant_stock_mismatch"
  | "variant_stock_untracked"
  | "delivery_window_inverted"
  | "duplicate_name"
  // avertissement
  | "hold_unverifiable"
  | "safety_data_missing"
  | "paused_but_listed"
  | "low_stock"
  | "no_photo"
  | "no_category"
  | "no_reseller"
  | "listed_no_sales"
  // recommandation
  | "draft_ready"
  | "few_photos"
  | "short_description"
  | "no_gtin"

export const HEALTH_ISSUE_CLASS: Record<HealthIssueCode, HealthClass> = {
  held_by_affisell: "blocage",
  price_missing: "blocage",
  commission_not_explicit: "blocage",
  out_of_stock: "blocage",
  safety_blocks_publication: "blocage",
  stock_unconfirmed: "blocage",
  stock_nominal: "anomalie",
  variant_stock_mismatch: "anomalie",
  variant_stock_untracked: "anomalie",
  delivery_window_inverted: "anomalie",
  duplicate_name: "anomalie",
  hold_unverifiable: "avertissement",
  safety_data_missing: "avertissement",
  paused_but_listed: "avertissement",
  low_stock: "avertissement",
  no_photo: "avertissement",
  no_category: "avertissement",
  no_reseller: "avertissement",
  listed_no_sales: "avertissement",
  draft_ready: "recommandation",
  few_photos: "recommandation",
  short_description: "recommandation",
  no_gtin: "recommandation",
}

const CLASS_BASE: Record<HealthClass, number> = {
  blocage: 1000,
  anomalie: 300,
  avertissement: 100,
  recommandation: 10,
}
const CLASS_ORDER: HealthClass[] = ["blocage", "anomalie", "avertissement", "recommandation"]

export type HealthProduct = {
  id: string
  name: string
  isDraft: boolean
  active: boolean
  listingKind: string | null
  basePriceCents: number
  stock: number
  hasVariants: boolean
  /** `variants.variantRows[].stock`, raw; null when the product has no SKU rows. */
  variantRowStocks: unknown[] | null
  /** Imported without a source quantity (`stock_unconfirmed` marker, lib/import-stock.ts): publication is refused. */
  stockUnconfirmed?: boolean
  commissionExplicit: boolean
  imageCount: number
  descriptionLength: number
  categoryId: string | null
  /** A GTIN / EAN row is declared (presence only). */
  hasGtin: boolean
  deliveryMin: number | null
  deliveryMax: number | null
  /** Product-safety readiness (`evaluateListingReadiness`): null = not applicable (digital goods). */
  safetyBlocking: string[] | null
  /** Affisell holds; null = could not be read (fails closed: never "no hold"). */
  holds: Array<"product_recalled" | "product_suspended"> | null
  paidOrders30d: number
  resellersListing: number
  createdAt: Date
}

export type HealthContext = {
  now: Date
  /** `LISTING_READINESS_MODE` as the server reads it. */
  readinessMode: "off" | "warn" | "enforce"
}

export type HealthIssue = {
  code: HealthIssueCode
  cls: HealthClass
  productId: string
  productName: string
  source: HealthSource
  fix: HealthFix
  /** The data the diagnosis rests on — shown to the supplier, never invented. */
  evidence: Record<string, string | number | boolean | null>
  /** Observed demand of the product (orders paid in 30 days, resellers listing it) — the basis of `impactScore`. */
  demand: { paidOrders30d: number; resellersListing: number }
  impactScore: number
}

export type HealthReport = {
  productsChecked: number
  issues: HealthIssue[]
  counts: Record<HealthClass, number>
  /** Products with at least one blocage. */
  blockedProducts: number
  /** Products on sale with nothing in the three first classes. */
  healthyProducts: number
  truncated: boolean
}

const NON_PHYSICAL = new Set(["SOFTWARE", "SUBSCRIPTION", "SERVICE", "EXPERIENCE"])
/** Values written by importers / assistants when the source gave no inventory (99, 999 …) — see AGENTS.md (G1). */
const NOMINAL_STOCKS = new Set([99, 999, 9_999, 99_999])
const LOW_STOCK_MAX = 3 // same threshold as the reseller copilot's « à vérifier »
const NO_RESELLER_AFTER_DAYS = 14 // a fresh product has not had time to be picked
const NO_SALES_AFTER_DAYS = 30 // the order window is 30 days
const SHORT_DESCRIPTION = 200 // under ~2 sentences a buyer has little to read
const FEW_PHOTOS = 3
const DAY = 86_400_000

function isPhysical(p: HealthProduct): boolean {
  return !NON_PHYSICAL.has((p.listingKind ?? "PHYSICAL").trim().toUpperCase())
}

function rowStocks(p: HealthProduct): number[] | null {
  if (!Array.isArray(p.variantRowStocks) || p.variantRowStocks.length === 0) return null
  return p.variantRowStocks.map((v) => {
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : NaN
  })
}

export function normalizeProductName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Diagnose one product. `duplicates` = how many OTHER products of the same supplier share its normalised name. */
export function diagnoseProduct(p: HealthProduct, ctx: HealthContext, duplicates = 0): Omit<HealthIssue, "impactScore" | "demand">[] {
  const out: Omit<HealthIssue, "impactScore" | "demand">[] = []
  const add = (code: HealthIssueCode, source: HealthSource, fix: HealthFix, evidence: HealthIssue["evidence"] = {}) =>
    out.push({ code, cls: HEALTH_ISSUE_CLASS[code], productId: p.id, productName: p.name, source, fix, evidence })

  const physical = isPhysical(p)
  const published = !p.isDraft
  const held = p.holds != null && p.holds.length > 0
  const onSale = published && p.active && !held
  const ageDays = Math.floor((ctx.now.getTime() - p.createdAt.getTime()) / DAY)
  const rows = rowStocks(p)
  const rowsUnreadable = rows != null && rows.some((n) => Number.isNaN(n))
  const available = rows && !rowsUnreadable ? rows.reduce((a, b) => a + b, 0) : rows ? null : p.stock
  const stockKnown = physical && !(p.hasVariants && rows == null) && available != null

  // ---- blocage -----------------------------------------------------------
  // The import's source gave no quantity: the product can not be published until the supplier types one. Its stock is 0
  // BECAUSE it is unknown, so « sold out » / « nominal stock » would describe the same fact wrongly — they are skipped.
  const unconfirmed = Boolean(p.stockUnconfirmed) && physical
  if (unconfirmed) add("stock_unconfirmed", "affisell", rows || p.hasVariants ? "edit_product" : "set_stock", { stock: p.stock })
  if (held) add("held_by_affisell", "affisell", "view_hold", { hold: p.holds![0] })
  if (p.holds == null) add("hold_unverifiable", "affisell", "none")
  if (!(p.basePriceCents > 0)) add("price_missing", "fiche", "edit_product", { priceCents: p.basePriceCents })
  // Paid but unallocated: without an explicit commission a sale produces no order (AGENTS.md, D6).
  if (published && !p.commissionExplicit) add("commission_not_explicit", "affisell", "edit_product")
  // The product page shows « sold out » at 0 — nobody can buy it.
  if (onSale && stockKnown && !unconfirmed && available === 0) add("out_of_stock", "fiche", rows ? "edit_product" : "set_stock", { available: 0 })
  if (p.safetyBlocking && p.safetyBlocking.length > 0) {
    if (p.isDraft && ctx.readinessMode === "enforce") {
      add("safety_blocks_publication", "affisell", "edit_product", {
        missingCount: p.safetyBlocking.length,
        missing: p.safetyBlocking.join(","),
        mode: ctx.readinessMode,
      })
    } else {
      // Not refused today (observation mode, or already live): said as a risk, not as a blocage.
      add("safety_data_missing", "affisell", "edit_product", {
        missingCount: p.safetyBlocking.length,
        missing: p.safetyBlocking.join(","),
        mode: ctx.readinessMode,
        live: published,
      })
    }
  }

  // ---- anomalie ----------------------------------------------------------
  if (physical && !unconfirmed && rows == null && !p.hasVariants && NOMINAL_STOCKS.has(p.stock)) {
    add("stock_nominal", "fiche", "set_stock", { stock: p.stock })
  }
  if (rows && !rowsUnreadable && rows.reduce((a, b) => a + b, 0) !== p.stock) {
    add("variant_stock_mismatch", "calcul", "edit_product", { productStock: p.stock, rowsTotal: rows.reduce((a, b) => a + b, 0) })
  }
  if (physical && p.hasVariants && rows == null) add("variant_stock_untracked", "fiche", "edit_product")
  if (p.deliveryMin != null && p.deliveryMax != null && p.deliveryMin > p.deliveryMax) {
    add("delivery_window_inverted", "fiche", "edit_product", { min: p.deliveryMin, max: p.deliveryMax })
  }
  if (duplicates > 0) add("duplicate_name", "calcul", "edit_product", { others: duplicates })

  // ---- avertissement -----------------------------------------------------
  if (published && !p.active && !held && p.resellersListing > 0) {
    add("paused_but_listed", "observe", "edit_product", { resellers: p.resellersListing })
  }
  if (onSale && stockKnown && available != null && available > 0 && available <= LOW_STOCK_MAX) {
    add("low_stock", "fiche", rows ? "edit_product" : "set_stock", { available, paidOrders30d: p.paidOrders30d })
  }
  if (p.imageCount === 0) add("no_photo", "fiche", "edit_product")
  if (!p.categoryId) add("no_category", "fiche", "edit_product")
  if (onSale && ageDays >= NO_RESELLER_AFTER_DAYS && p.resellersListing === 0) {
    add("no_reseller", "observe", "none", { ageDays })
  }
  if (onSale && ageDays >= NO_SALES_AFTER_DAYS && p.resellersListing > 0 && p.paidOrders30d === 0) {
    add("listed_no_sales", "observe", "edit_product", { resellers: p.resellersListing, days: 30 })
  }

  // ---- recommandation ----------------------------------------------------
  const blockingHere = out.some((i) => i.cls === "blocage")
  const stockOk = !physical || (!unconfirmed && stockKnown && (available ?? 0) > 0)
  if (p.isDraft && !blockingHere && p.basePriceCents > 0 && p.commissionExplicit && stockOk && p.imageCount > 0 && !(p.safetyBlocking?.length)) {
    add("draft_ready", "calcul", "edit_product")
  }
  if (p.imageCount > 0 && p.imageCount < FEW_PHOTOS) add("few_photos", "fiche", "edit_product", { photos: p.imageCount })
  if (p.descriptionLength < SHORT_DESCRIPTION) add("short_description", "fiche", "edit_product", { characters: p.descriptionLength })
  if (physical && p.safetyBlocking != null && !p.hasGtin) add("no_gtin", "fiche", "edit_product")

  return out
}

export function demandWeight(p: Pick<HealthProduct, "paidOrders30d" | "resellersListing">): number {
  return 1 + 3 * Math.max(0, p.paidOrders30d) + Math.max(0, p.resellersListing)
}

export function buildHealthReport(
  products: HealthProduct[],
  ctx: HealthContext,
  opts: { truncated?: boolean } = {}
): HealthReport {
  const byName = new Map<string, number>()
  for (const p of products) {
    const k = normalizeProductName(p.name)
    if (k.length >= 4) byName.set(k, (byName.get(k) ?? 0) + 1)
  }
  const issues: HealthIssue[] = []
  const blocked = new Set<string>()
  const withProblem = new Set<string>()
  for (const p of products) {
    const k = normalizeProductName(p.name)
    const dup = k.length >= 4 ? (byName.get(k) ?? 1) - 1 : 0
    const w = demandWeight(p)
    for (const i of diagnoseProduct(p, ctx, dup)) {
      issues.push({
        ...i,
        demand: { paidOrders30d: Math.max(0, p.paidOrders30d), resellersListing: Math.max(0, p.resellersListing) },
        impactScore: CLASS_BASE[i.cls] * w,
      })
      if (i.cls === "blocage") blocked.add(p.id)
      if (i.cls !== "recommandation") withProblem.add(p.id)
    }
  }
  issues.sort(
    (a, b) =>
      b.impactScore - a.impactScore ||
      CLASS_ORDER.indexOf(a.cls) - CLASS_ORDER.indexOf(b.cls) ||
      a.productName.localeCompare(b.productName) ||
      a.code.localeCompare(b.code)
  )
  const counts = { blocage: 0, anomalie: 0, avertissement: 0, recommandation: 0 } as Record<HealthClass, number>
  for (const i of issues) counts[i.cls] += 1
  const healthy = products.filter((p) => !p.isDraft && p.active && !withProblem.has(p.id)).length
  return {
    productsChecked: products.length,
    issues,
    counts,
    blockedProducts: blocked.size,
    healthyProducts: healthy,
    truncated: Boolean(opts.truncated),
  }
}
