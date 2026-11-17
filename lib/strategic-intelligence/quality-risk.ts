import type { StrategicSignal } from "@/lib/strategic-intelligence/types"

/**
 * AFFISELL INTELLIGENCE — early PRODUCT-QUALITY risk from returns and disputes (pure).
 *
 * Question answered: "is this product (or this supplier) generating clearly MORE quality problems than the rest of the
 * marketplace?" — before the reviews, the chargebacks and the SLA refunds pile up.
 *
 *  - Cohort: orders PAID between 120 and 21 days ago. The last 21 days are left out on purpose: a problem can only be
 *    reported once the parcel has arrived (delivery + a few days to open it), so recent orders would dilute the rate.
 *  - A "quality problem" = an order with at least one return whose reason says the product itself is at fault
 *    (QUALITY_RETURN_REASONS: not as described, defective / broken, wrong item, damaged in shipping), or a Stripe dispute
 *    on a payment that contained ONLY this order. A dispute on a multi-line cart can not be attributed to one product, so
 *    it is shown as context, never counted. "Changed mind" and "size / fit" are not quality signals and are ignored.
 *    One order counts once, whatever the number of returns / disputes.
 *  - Test: exact one-sided binomial tail P(X ≥ x | n, p0), p0 = the rate of the REST of the marketplace (leave-one-out,
 *    so a big seller does not hide in its own baseline), floored at BASELINE_FLOOR (a near-zero baseline is badly
 *    estimated and would make 3 returns "significant"). The level is corrected for the NUMBER of products (or suppliers)
 *    tested in the run (Bonferroni, 5 % family-wise) — 200 products at 5 % each would raise ~10 false alarms per run.
 *  - Plus a size floor that makes the alarm worth acting on: ≥ MIN_ORDERS orders, ≥ MIN_PROBLEMS problems and a rate
 *    ≥ MIN_RATIO × the baseline.
 *
 * Nothing is changed automatically: no listing is paused, no supplier is penalised. The action is to read the returns.
 */
export const QUALITY_RETURN_REASONS = ["NOT_AS_DESCRIBED", "DEFECTIVE_OR_BROKEN", "WRONG_ITEM", "DAMAGED_IN_SHIPPING"] as const
export const QUALITY_COHORT_FROM_DAYS = 120
export const QUALITY_COHORT_TO_DAYS = 21
export const QUALITY_MIN_ORDERS = 20
export const QUALITY_MIN_PROBLEMS = 3
export const QUALITY_MIN_RATIO = 2
export const QUALITY_BASELINE_FLOOR = 0.01
const FAMILY_ALPHA = 0.05

const REASON_FR: Record<string, string> = {
  NOT_AS_DESCRIBED: "non conforme à la description",
  DEFECTIVE_OR_BROKEN: "défectueux ou cassé",
  WRONG_ITEM: "mauvais article",
  DAMAGED_IN_SHIPPING: "endommagé pendant l'envoi",
  DISPUTE: "litige bancaire (paiement à une seule ligne)",
}

/** Per order of the cohort, as read from the database. */
export type QualityCohortOrder = {
  orderId: string
  productId: string
  supplierId: string
  /** Stripe checkout session id — a cart's orders are `<session>:line:<i>`. */
  stripeSessionId: string | null
  /** Quality reason codes of this order's returns (other reasons already filtered out or ignored here). */
  returnReasons: string[]
  disputed: boolean
}

export function isQualityReason(code: string): boolean {
  return (QUALITY_RETURN_REASONS as readonly string[]).includes(code)
}

/** A dispute is attributed to an order only when its payment contained that order alone. */
export function isSingleLinePayment(stripeSessionId: string | null): boolean {
  return !!stripeSessionId && !stripeSessionId.includes(":line:")
}

/** Reasons that make this order a quality problem (deduplicated), or [] when it is not one. */
export function orderProblemReasons(o: QualityCohortOrder): string[] {
  const reasons = new Set(o.returnReasons.filter(isQualityReason))
  if (o.disputed && isSingleLinePayment(o.stripeSessionId)) reasons.add("DISPUTE")
  return [...reasons]
}

// ---- exact binomial upper tail -------------------------------------------------------------------------------------

/** ln Γ(x) — Lanczos approximation (g = 7, n = 9), relative error < 1e-13 for x > 0. */
export function logGamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
  x -= 1
  let a = c[0]
  const t = x + 7.5
  for (let i = 1; i < 9; i++) a += c[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

/** P(X ≥ k) for X ~ Binomial(n, p), summed in log space (exact up to floating point). */
export function binomialUpperTail(k: number, n: number, p: number): number {
  if (k <= 0) return 1
  if (k > n) return 0
  if (p <= 0) return 0
  if (p >= 1) return 1
  const lnC = (i: number) => logGamma(n + 1) - logGamma(i + 1) - logGamma(n - i + 1)
  let sum = 0
  for (let i = k; i <= n; i++) {
    const term = Math.exp(lnC(i) + i * Math.log(p) + (n - i) * Math.log(1 - p))
    sum += term
    if (term < sum * 1e-15 && i > n * p) break
  }
  return Math.min(1, sum)
}

// ---- aggregation + detection ---------------------------------------------------------------------------------------

export type QualityEntityStats = {
  key: string
  orders: number
  problems: number
  byReason: Record<string, number>
  /** Disputes on multi-line payments: context only, never counted. */
  unattributedDisputes: number
}

export function aggregateQuality(orders: QualityCohortOrder[], keyOf: (o: QualityCohortOrder) => string): Map<string, QualityEntityStats> {
  const out = new Map<string, QualityEntityStats>()
  for (const o of orders) {
    const key = keyOf(o)
    const s = out.get(key) ?? { key, orders: 0, problems: 0, byReason: {}, unattributedDisputes: 0 }
    s.orders++
    const reasons = orderProblemReasons(o)
    if (reasons.length > 0) s.problems++
    for (const r of reasons) s.byReason[r] = (s.byReason[r] ?? 0) + 1
    if (o.disputed && !isSingleLinePayment(o.stripeSessionId)) s.unattributedDisputes++
    out.set(key, s)
  }
  return out
}

export type QualityFinding = QualityEntityStats & { rate: number; baseline: number; pValue: number; threshold: number }

/** Entities whose problem rate is significantly above the rest of the marketplace (see the header for every rule). */
export function detectQualityOutliers(stats: Map<string, QualityEntityStats>): QualityFinding[] {
  const all = [...stats.values()]
  const totalOrders = all.reduce((s, e) => s + e.orders, 0)
  const totalProblems = all.reduce((s, e) => s + e.problems, 0)
  const tested = all.filter((e) => e.orders >= QUALITY_MIN_ORDERS)
  if (tested.length === 0) return []
  const threshold = FAMILY_ALPHA / tested.length
  const findings: QualityFinding[] = []
  for (const e of tested) {
    const restOrders = totalOrders - e.orders
    if (restOrders <= 0) continue
    const baseline = Math.max(QUALITY_BASELINE_FLOOR, (totalProblems - e.problems) / restOrders)
    const rate = e.problems / e.orders
    if (e.problems < QUALITY_MIN_PROBLEMS || rate < QUALITY_MIN_RATIO * baseline) continue
    const pValue = binomialUpperTail(e.problems, e.orders, baseline)
    if (pValue <= threshold) findings.push({ ...e, rate, baseline, pValue, threshold })
  }
  return findings.sort((a, b) => a.pValue - b.pValue || b.problems - a.problems)
}

const pctTxt = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")} %`

function reasonsTxt(byReason: Record<string, number>): string {
  return Object.entries(byReason)
    .sort((a, b) => b[1] - a[1])
    .map(([r, n]) => `${REASON_FR[r] ?? r} : ${n}`)
    .join(" · ")
}

export function qualityRiskSignals(
  findings: { products: QualityFinding[]; suppliers: QualityFinding[] },
  names: { product: Map<string, { name: string; supplierId?: string; supplierName: string; sellingNow: boolean }>; supplier: Map<string, string> },
  ctx: { observedAt: string; window: { from: string; to: string } }
): StrategicSignal[] {
  const evidenceOf = (f: QualityFinding) => [
    { label: "Commandes de la cohorte", value: String(f.orders) },
    { label: "Commandes avec un problème de qualité", value: `${f.problems} (${pctTxt(f.rate)})` },
    { label: "Taux du reste de la marketplace", value: pctTxt(f.baseline) },
    { label: "Motifs", value: reasonsTxt(f.byReason) },
    { label: "Probabilité d'un tel écart par hasard", value: f.pValue < 1e-6 ? "< 0,0001 %" : pctTxt(f.pValue) },
    ...(f.unattributedDisputes > 0
      ? [{ label: "Litiges sur des paniers à plusieurs lignes (non comptés)", value: String(f.unattributedDisputes) }]
      : []),
  ]
  const reason =
    "Test binomial exact, unilatéral, contre le taux du reste de la marketplace, seuil corrigé pour le nombre de comparaisons (5 % au total). Les retours sont déclarés par l'acheteur et pas encore vérifiés."

  const products = findings.products.slice(0, 10).map((f): StrategicSignal => {
    const p = names.product.get(f.key)
    return {
      id: `risk:quality:product:${f.key}`,
      domain: "regulatory_risk",
      priority: p?.sellingNow === false ? "study" : "important",
      kind: "fact",
      title: `Taux de problèmes de qualité anormal : « ${p?.name ?? f.key} » (${pctTxt(f.rate)} contre ${pctTxt(f.baseline)})`,
      evidence: [{ label: "Fournisseur", value: p?.supplierName ?? "—" }, ...evidenceOf(f)],
      source: { id: "affisell.returns", query: "Commandes payées il y a 21 à 120 jours × OrderReturn (motifs qualité) × litiges Stripe (paiements à une ligne)" },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: f.problems >= 2 * QUALITY_MIN_PROBLEMS ? "high" : "medium",
      confidenceReason: reason,
      recommendedAction:
        "Lire les retours et leurs photos, comparer la fiche produit à ce qui est livré, puis voir avec le fournisseur (description à corriger, lot défectueux, emballage). Aucune annonce n'est suspendue automatiquement.",
      link: "/admin/returns",
      subjects: [
        { type: "product", id: f.key, label: p?.name ?? f.key },
        ...(p?.supplierId ? [{ type: "supplier" as const, id: p.supplierId, label: p.supplierName }] : []),
      ],
    }
  })

  const suppliers = findings.suppliers.slice(0, 5).map(
    (f): StrategicSignal => ({
      id: `risk:quality:supplier:${f.key}`,
      domain: "supplier",
      priority: "important",
      kind: "fact",
      title: `Fournisseur au taux de problèmes de qualité anormal : « ${names.supplier.get(f.key) ?? "Fournisseur"} » (${pctTxt(f.rate)} contre ${pctTxt(f.baseline)})`,
      evidence: evidenceOf(f),
      source: { id: "affisell.returns", query: "Même cohorte, regroupée par fournisseur" },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: f.problems >= 2 * QUALITY_MIN_PROBLEMS ? "high" : "medium",
      confidenceReason: reason,
      recommendedAction:
        "Vérifier si le problème vient d'un produit ou de tout le catalogue de ce fournisseur (contrôle qualité, emballage, préparation) avant de lui confier de nouveaux revendeurs. Aucune sanction automatique.",
      link: "/admin/returns",
      subjects: [{ type: "supplier", id: f.key, label: names.supplier.get(f.key) ?? "Fournisseur" }],
    })
  )
  return [...products, ...suppliers]
}
