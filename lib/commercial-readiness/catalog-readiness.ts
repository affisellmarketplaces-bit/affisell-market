/**
 * The commercial-readiness verdict across a supplier's SAVED catalogue — the forms' engine
 * (`assessStoredProductReadiness`) run on every product the catalogue health reads, plus, for each one, where it stands
 * commercially (`assessCommercialStanding`). Feeds the existing catalogue-health page and the supplier's next best
 * action; it is not a new dashboard and it changes nothing (no publication, price, stock or commission is touched).
 *
 * Two short lists only, so the supplier is never handed a wall of findings:
 *  - `toFix`: products whose verdict is not « prêt » and that have ONE fix the supplier can make (the engine's next fix),
 *    ranked like the health report — severity base × observed demand (1 + 3 × paid orders 30 d + resellers listing),
 *    a live product before a draft at equal score;
 *  - `readyNotSelling`: products published, buyable today (no blocker — those are in `toFix`), technically ready, with
 *    at least one weak commercial dimension — ranked by
 *    exposure (resellers listing, then age), never by a made-up score.
 * Pure, client-safe.
 */
import { assessCommercialStanding, type CommercialStanding } from "@/lib/commercial-readiness/commercial-standing"
import type { ReadinessContext, ReadinessFinding, ReadinessLevel, ReadinessStage, ReadinessVerdict } from "@/lib/commercial-readiness/readiness"
import { assessStoredProductReadiness, storedReadinessStage, type StoredReadinessRow } from "@/lib/commercial-readiness/stored-readiness"
import type { QualityEvidence } from "@/lib/listing-quality/sheet-checklist"

export type CatalogReadinessProduct = {
  productId: string
  productName: string
  row: StoredReadinessRow
  active: boolean
  holds: ReadonlyArray<"product_recalled" | "product_suspended"> | null
  paidOrders30d: number
  resellersListing: number
  ageDays: number
  /** Catalogue-health codes diagnosed on this product (the same report). */
  healthCodes: ReadonlySet<string>
}

export type CatalogReadinessContext = {
  listingReadinessMode: ReadinessContext["listingReadinessMode"]
  merchantVerified: boolean | null
  catalogCapReached: boolean | null
  /** Fee this supplier pays per category; absent = unknown (net per sale not judged). */
  feeBpsByCategory: ReadonlyMap<string, number>
  evidence: readonly QualityEvidence[]
}

export type NextFixSummary = Pick<ReadinessFinding, "code" | "level" | "basis" | "prevents" | "feature" | "evidence" | "live" | "fields">

export type ProductReadinessSummary = {
  productId: string
  productName: string
  stage: Exclude<ReadinessStage, "new">
  verdict: ReadinessVerdict
  counts: Record<ReadinessLevel, number>
  nextFix: NextFixSummary | null
  /** Only an Affisell decision blocks it (nothing the supplier can fix). */
  heldOnly: boolean
  demand: { paidOrders30d: number; resellersListing: number }
  standing: CommercialStanding
}

export type CatalogReadiness = {
  byStage: Record<"draft" | "live", Record<ReadinessVerdict, number>>
  toFix: ProductReadinessSummary[]
  readyNotSelling: ProductReadinessSummary[]
  /** Every product's summary, for the next best action (never sent whole to the browser). */
  all: ProductReadinessSummary[]
}

export const READINESS_LIST_MAX = 8
const LEVEL_BASE: Record<ReadinessLevel, number> = { bloquant: 1000, prioritaire: 100, recommande: 10 }

export function readinessDemandWeight(d: { paidOrders30d: number; resellersListing: number }): number {
  return 1 + 3 * Math.max(0, d.paidOrders30d) + Math.max(0, d.resellersListing)
}

export function summarizeProductReadiness(p: CatalogReadinessProduct, ctx: CatalogReadinessContext): ProductReadinessSummary {
  const stage = storedReadinessStage(p.row) as "draft" | "live"
  const report = assessStoredProductReadiness(p.row, {
    listingReadinessMode: ctx.listingReadinessMode,
    // Account-level rules matter only for a product that is about to GO live.
    merchantVerified: stage === "draft" ? ctx.merchantVerified : null,
    catalogCapReached: stage === "draft" ? ctx.catalogCapReached : null,
    supplierFeeBps: p.row.categoryId ? ctx.feeBpsByCategory.get(p.row.categoryId) ?? null : null,
    evidence: ctx.evidence,
    holds: p.holds,
  })
  const held = p.holds != null && p.holds.length > 0
  const blocking = report.findings.filter((f) => f.level === "bloquant")
  const nf = report.nextFix
  return {
    productId: p.productId,
    productName: p.productName,
    stage,
    verdict: report.verdict,
    counts: report.counts,
    nextFix: nf ? { code: nf.code, level: nf.level, basis: nf.basis, prevents: nf.prevents, feature: nf.feature, evidence: nf.evidence, live: nf.live, fields: nf.fields } : null,
    heldOnly: held && blocking.every((f) => f.fixable === false),
    demand: { paidOrders30d: Math.max(0, p.paidOrders30d), resellersListing: Math.max(0, p.resellersListing) },
    standing: assessCommercialStanding({
      readiness: report,
      healthCodes: p.healthCodes,
      basePriceCents: p.row.basePriceCents,
      commissionRatePct: report.findings.some((f) => f.code === "commission_not_explicit") ? 0 : Number(p.row.commissionRate) || 0,
      commissionExplicit: !report.findings.some((f) => f.code === "commission_not_explicit"),
      published: stage === "live",
      onSale: stage === "live" && p.active && !held,
      ageDays: p.ageDays,
      resellersListing: p.resellersListing,
      paidOrders30d: p.paidOrders30d,
    }),
  }
}

export function buildCatalogReadiness(products: ReadonlyArray<CatalogReadinessProduct>, ctx: CatalogReadinessContext): CatalogReadiness {
  const all = products.map((p) => summarizeProductReadiness(p, ctx))
  const byStage = {
    draft: { bloquant: 0, a_corriger: 0, pret: 0 },
    live: { bloquant: 0, a_corriger: 0, pret: 0 },
  } as CatalogReadiness["byStage"]
  for (const s of all) byStage[s.stage][s.verdict] += 1
  const score = (s: ProductReadinessSummary) => (s.nextFix ? LEVEL_BASE[s.nextFix.level] : 0) * readinessDemandWeight(s.demand)
  const toFix = all
    .filter((s) => s.verdict !== "pret" && s.nextFix && s.nextFix.level !== "recommande")
    .sort((a, b) => score(b) - score(a) || (a.stage === b.stage ? 0 : a.stage === "live" ? -1 : 1) || a.productName.localeCompare(b.productName))
    .slice(0, READINESS_LIST_MAX)
  const readyNotSelling = all
    .filter((s) => s.stage === "live" && s.verdict !== "bloquant" && s.standing.headline === "pret_peu_attractif")
    .sort((a, b) => b.demand.resellersListing - a.demand.resellersListing || a.productName.localeCompare(b.productName))
    .slice(0, READINESS_LIST_MAX)
  return { byStage, toFix, readyNotSelling, all }
}
