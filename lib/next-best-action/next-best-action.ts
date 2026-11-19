/**
 * Next best action — one to three actions for ONE account, built from that account's
 * own data (founder brief 2026-11-19). Each action says:
 *  - what to do (`kind` + the product it is about),
 *  - why (`reason`: the diagnosis code it comes from),
 *  - on what data (`evidence`, each figure with its qualification),
 *  - its POTENTIAL impact — what was observed on that product, never a promise
 *    (`impact.qualification` is always `potentiel`),
 *  - its priority (`haute` | `moyenne` | `basse`).
 *
 * No generic advice: an action exists only when a diagnosis on a real product of the
 * account produced it, and two actions never have the same kind or (when another
 * product is available) the same product. Pure, client-safe.
 */
import type { HealthClass, HealthIssue, HealthIssueCode, HealthReport } from "@/lib/supplier-catalog-health/diagnose"

export type ActionPriority = "haute" | "moyenne" | "basse"
export type Qualified = { value: string | number | boolean | null; qualification: "fiche" | "observe" | "affisell" | "calcul" }

export type NextAction = {
  /** Stable while the situation lasts (kind + product), so a UI can remember a dismissal. */
  key: string
  kind:
    | "fix_blocage"
    | "resolve_availability"
    | "promote_to_resellers"
    | "publish_draft"
    | "complete_sheet"
    | "fix_shop_listing"
    | "review_profit_drop"
    | "add_ready_product"
  productId: string
  productName: string
  reason: string
  priority: ActionPriority
  evidence: Record<string, Qualified>
  impact: {
    qualification: "potentiel"
    /** Observed on THIS product over 30 days — the scale of what is at stake, not a forecast. */
    paidOrders30d?: number
    resellersListing?: number
    netPerSaleCents?: number
    netChangeCents?: number
  }
  /** Where the account acts. */
  href: string
}

const PRIORITY_BY_CLASS: Record<HealthClass, ActionPriority> = {
  blocage: "haute",
  anomalie: "moyenne",
  avertissement: "moyenne",
  recommandation: "basse",
}

const SUPPLIER_KIND: Partial<Record<HealthIssueCode, NextAction["kind"]>> = {
  // held_by_affisell / hold_unverifiable are deliberately absent: the supplier can not act on them.
  price_missing: "fix_blocage",
  commission_not_explicit: "fix_blocage",
  safety_blocks_publication: "fix_blocage",
  stock_unconfirmed: "resolve_availability",
  out_of_stock: "resolve_availability",
  low_stock: "resolve_availability",
  stock_nominal: "resolve_availability",
  variant_stock_mismatch: "resolve_availability",
  variant_stock_untracked: "resolve_availability",
  no_reseller: "promote_to_resellers",
  draft_ready: "publish_draft",
  no_photo: "complete_sheet",
  no_category: "complete_sheet",
  duplicate_name: "complete_sheet",
  delivery_window_inverted: "complete_sheet",
  safety_data_missing: "complete_sheet",
  paused_but_listed: "complete_sheet",
  listed_no_sales: "complete_sheet",
  few_photos: "complete_sheet",
  short_description: "complete_sheet",
  no_gtin: "complete_sheet",
}

/** low_stock / few_photos and the like only become an ACTION when the product has real demand — otherwise it is noise. */
const NEEDS_DEMAND = new Set<HealthIssueCode>(["low_stock", "listed_no_sales", "few_photos", "short_description", "no_gtin"])

function hrefForSupplier(i: HealthIssue, kind: NextAction["kind"]): string {
  if (kind === "promote_to_resellers") return "/dashboard/supplier/invite-affiliate"
  return `/dashboard/supplier/products/${encodeURIComponent(i.productId)}/edit`
}

function pickDistinct<T extends { kind: string; productId: string; score: number }>(cands: T[], max: number): T[] {
  const sorted = [...cands].sort((a, b) => b.score - a.score)
  const out: T[] = []
  const kinds = new Set<string>()
  const products = new Set<string>()
  // first pass: distinct kind AND distinct product
  for (const c of sorted) {
    if (out.length >= max) break
    if (kinds.has(c.kind) || products.has(c.productId)) continue
    out.push(c)
    kinds.add(c.kind)
    products.add(c.productId)
  }
  // second pass: distinct kind only (a product may carry two different actions when nothing else exists)
  for (const c of sorted) {
    if (out.length >= max) break
    if (kinds.has(c.kind)) continue
    out.push(c)
    kinds.add(c.kind)
  }
  return out
}

export function supplierNextActions(report: HealthReport, max = 3): NextAction[] {
  const cands: Array<NextAction & { score: number }> = []
  for (const i of report.issues) {
    const kind = SUPPLIER_KIND[i.code]
    if (!kind) continue
    const demand = i.demand.paidOrders30d + i.demand.resellersListing
    if (NEEDS_DEMAND.has(i.code) && demand === 0) continue
    const evidence: Record<string, Qualified> = {}
    for (const [k, v] of Object.entries(i.evidence)) evidence[k] = { value: v, qualification: i.source }
    evidence.paidOrders30d = { value: i.demand.paidOrders30d, qualification: "observe" }
    evidence.resellersListing = { value: i.demand.resellersListing, qualification: "observe" }
    cands.push({
      key: `${kind}:${i.productId}`,
      kind,
      productId: i.productId,
      productName: i.productName,
      reason: i.code,
      priority: PRIORITY_BY_CLASS[i.cls],
      evidence,
      impact: {
        qualification: "potentiel",
        paidOrders30d: i.demand.paidOrders30d,
        resellersListing: i.demand.resellersListing,
      },
      href: hrefForSupplier(i, kind),
      score: i.impactScore,
    })
  }
  return pickDistinct(cands, Math.max(1, Math.min(3, max))).map(({ score: _s, ...a }) => a)
}

// ---------------------------------------------------------------------------
// Reseller

export type ShopListingState = {
  listingId: string
  productId: string
  name: string
  /** Why buyers can not buy it right now (null = sellable). */
  problem: "out_of_stock" | "product_unavailable" | "awaiting_review" | "no_commission" | null
  paidOrders30d: number
}

export type ProfitDrop = {
  alertId: string
  productId: string
  name: string
  primaryCause: string
  netChangeCents: number
}

export type ReadyProduct = {
  productId: string
  name: string
  netPerSaleCents: number
  paidOrders30d: number
  resellersListing: number
}

const DROP_CAUSES = new Set([
  "volume_down",
  "your_price_down",
  "collected_price_down",
  "supplier_price_up",
  "commission_down",
  "fees_up",
  "refunds_up",
  "disputes_up",
])

export function resellerNextActions(
  input: { listings: ShopListingState[]; drops: ProfitDrop[]; ready: ReadyProduct[] },
  max = 3
): NextAction[] {
  const cands: Array<NextAction & { score: number }> = []
  for (const l of input.listings) {
    if (!l.problem) continue
    cands.push({
      key: `fix_shop_listing:${l.productId}`,
      kind: "fix_shop_listing",
      productId: l.productId,
      productName: l.name,
      reason: `shop_${l.problem}`,
      priority: "haute",
      evidence: {
        problem: { value: l.problem, qualification: l.problem === "out_of_stock" ? "fiche" : "affisell" },
        paidOrders30d: { value: l.paidOrders30d, qualification: "observe" },
      },
      impact: { qualification: "potentiel", paidOrders30d: l.paidOrders30d },
      href: `/dashboard/affiliate/products/${encodeURIComponent(l.listingId)}/replace`,
      // a listing buyers see but can not buy is fixed first; weighted by what it used to sell
      score: 3000 + 100 * l.paidOrders30d,
    })
  }
  for (const d of input.drops) {
    if (!(d.netChangeCents < 0)) continue
    cands.push({
      key: `review_profit_drop:${d.productId}`,
      kind: "review_profit_drop",
      productId: d.productId,
      productName: d.name,
      reason: `drop_${DROP_CAUSES.has(d.primaryCause) ? d.primaryCause : "other"}`,
      priority: d.netChangeCents <= -5_000 ? "haute" : "moyenne",
      evidence: { netChangeCents: { value: d.netChangeCents, qualification: "observe" }, cause: { value: d.primaryCause, qualification: "calcul" } },
      impact: { qualification: "potentiel", netChangeCents: d.netChangeCents },
      href: "/dashboard/affiliate/opportunities",
      score: 2000 + Math.min(100_000, -d.netChangeCents) / 10,
    })
  }
  for (const r of input.ready) {
    if (!(r.netPerSaleCents > 0)) continue
    cands.push({
      key: `add_ready_product:${r.productId}`,
      kind: "add_ready_product",
      productId: r.productId,
      productName: r.name,
      reason: "ready_to_sell",
      priority: r.paidOrders30d > 0 ? "moyenne" : "basse",
      evidence: {
        netPerSaleCents: { value: r.netPerSaleCents, qualification: "calcul" },
        paidOrders30d: { value: r.paidOrders30d, qualification: "observe" },
        resellersListing: { value: r.resellersListing, qualification: "observe" },
      },
      impact: { qualification: "potentiel", netPerSaleCents: r.netPerSaleCents, paidOrders30d: r.paidOrders30d },
      href: "/dashboard/affiliate/catalog",
      score: 1000 + r.netPerSaleCents / 100 + 10 * r.paidOrders30d,
    })
  }
  return pickDistinct(cands, Math.max(1, Math.min(3, max))).map(({ score: _s, ...a }) => a)
}
