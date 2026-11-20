import { zThresholdForTests } from "@/lib/strategic-intelligence/detectors"
import { orderProblemReasons, type QualityCohortOrder } from "@/lib/strategic-intelligence/quality-risk"

/**
 * AFFISELL INTELLIGENCE — internal SUPPLIER RELIABILITY index (pure). INTERNAL ONLY: nothing here is shown to resellers
 * or suppliers (publishing it is a founder decision).
 *
 * Why another index: the existing `SupplierMetrics.trustScore` (lib/logistics/supplier-metrics.server.ts) gives 75/100
 * to a supplier with no data at all, forces the dispute rate to 0 and carries no sample size. This one is built to be
 * EXPLAINED and to say when it does not know:
 *
 *  - three components, each measured from Affisell's own records over a stated period:
 *      · ship_sla — orders automatically cancelled because the supplier shipped nothing in time (`Order.autoCancelledAt`,
 *        written by the SLA cron) / paid orders;
 *      · quality  — orders with a product-fault return or a single-line dispute (same rule as quality-risk.ts) / paid
 *        orders;
 *      · delivery — carrier-attested p90 delay (SupplierDeliveryStats, 180 days).
 *    Rates use the cohort of orders paid 120 → 21 days ago, so late problems have had time to show.
 *  - a rate is judged only on ≥ MIN_ORDERS orders, with a Wilson interval whose width is corrected for the number of
 *    suppliers judged (Bonferroni, same rule as the detectors): "worse" / "better" only when the WHOLE interval is on one
 *    side of the rest of the marketplace — otherwise "comparable". Below the minimum: "insufficient", never a guess.
 *  - delivery uses fixed, stated thresholds on the p90 (SLOW_P90_DAYS / FAST_P90_DAYS), on ≥ 20 attested deliveries.
 *  - the GRADE is a rule over the component verdicts, not a weighted number: fewer than two measured components =
 *    « données insuffisantes »; any SLA "worse" or two "worse" = « à risque »; one "worse" = « à surveiller »; none worse
 *    and at least one "better" = « fiable »; otherwise « dans la moyenne ». Every verdict is shown with its counts.
 */
export const RELIABILITY_MIN_ORDERS = 20
export const RELIABILITY_MIN_DELIVERIES = 20
export const SLOW_P90_DAYS = 12
export const FAST_P90_DAYS = 7

export type ComponentVerdict = "better" | "comparable" | "worse" | "insufficient"
export type ReliabilityGrade = "fiable" | "dans_la_moyenne" | "a_surveiller" | "a_risque" | "donnees_insuffisantes"

export const GRADE_LABELS: Record<ReliabilityGrade, string> = {
  fiable: "Fiable",
  dans_la_moyenne: "Dans la moyenne",
  a_surveiller: "À surveiller",
  a_risque: "À risque",
  donnees_insuffisantes: "Données insuffisantes",
}

export type RateComponent = {
  events: number
  orders: number
  rate: number | null
  /** Interval at the corrected confidence level; null when not judged. */
  low: number | null
  high: number | null
  marketplaceRate: number
  verdict: ComponentVerdict
}

export type DeliveryComponent = { p90Days: number | null; deliveries: number; verdict: ComponentVerdict }

export type SupplierReliability = {
  supplierId: string
  supplierName: string
  orders: number
  shipSla: RateComponent
  quality: RateComponent
  delivery: DeliveryComponent
  grade: ReliabilityGrade
  reasons: string[]
}

/** Wilson score interval for k successes in n trials at the given z. */
export function wilsonInterval(k: number, n: number, z: number): { low: number; high: number } {
  if (n <= 0) return { low: 0, high: 1 }
  const p = k / n
  const z2 = z * z
  const denom = 1 + z2 / n
  const centre = (p + z2 / (2 * n)) / denom
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) }
}

export type ReliabilityInput = {
  cohort: Array<QualityCohortOrder & { autoCancelled: boolean }>
  delivery: Map<string, { p90Days: number | null; sampleSize: number }>
  names: Map<string, string>
}

function judgeRate(events: number, orders: number, restEvents: number, restOrders: number, z: number): RateComponent {
  const marketplaceRate = restOrders > 0 ? restEvents / restOrders : 0
  if (orders < RELIABILITY_MIN_ORDERS) {
    return { events, orders, rate: orders > 0 ? events / orders : null, low: null, high: null, marketplaceRate, verdict: "insufficient" }
  }
  const { low, high } = wilsonInterval(events, orders, z)
  const verdict: ComponentVerdict = low > marketplaceRate ? "worse" : high < marketplaceRate ? "better" : "comparable"
  return { events, orders, rate: events / orders, low, high, marketplaceRate, verdict }
}

function judgeDelivery(d: { p90Days: number | null; sampleSize: number } | undefined): DeliveryComponent {
  if (!d || d.p90Days == null || d.sampleSize < RELIABILITY_MIN_DELIVERIES) {
    return { p90Days: d?.p90Days ?? null, deliveries: d?.sampleSize ?? 0, verdict: "insufficient" }
  }
  const verdict: ComponentVerdict = d.p90Days > SLOW_P90_DAYS ? "worse" : d.p90Days <= FAST_P90_DAYS ? "better" : "comparable"
  return { p90Days: d.p90Days, deliveries: d.sampleSize, verdict }
}

export function gradeOf(c: { shipSla: ComponentVerdict; quality: ComponentVerdict; delivery: ComponentVerdict }): ReliabilityGrade {
  const all = [c.shipSla, c.quality, c.delivery]
  const measured = all.filter((v) => v !== "insufficient")
  if (measured.length < 2) return "donnees_insuffisantes"
  const worse = measured.filter((v) => v === "worse").length
  if (c.shipSla === "worse" || worse >= 2) return "a_risque"
  if (worse === 1) return "a_surveiller"
  return measured.includes("better") ? "fiable" : "dans_la_moyenne"
}

const pct = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")} %`

export function computeSupplierReliability(input: ReliabilityInput): SupplierReliability[] {
  const bySupplier = new Map<string, { orders: number; sla: number; problems: number }>()
  for (const o of input.cohort) {
    const s = bySupplier.get(o.supplierId) ?? { orders: 0, sla: 0, problems: 0 }
    s.orders++
    if (o.autoCancelled) s.sla++
    if (orderProblemReasons(o).length > 0) s.problems++
    bySupplier.set(o.supplierId, s)
  }
  const ids = new Set([...bySupplier.keys(), ...input.delivery.keys()])
  const totals = [...bySupplier.values()].reduce((t, s) => ({ orders: t.orders + s.orders, sla: t.sla + s.sla, problems: t.problems + s.problems }), { orders: 0, sla: 0, problems: 0 })
  const judged = [...bySupplier.values()].filter((s) => s.orders >= RELIABILITY_MIN_ORDERS).length
  const z = zThresholdForTests(Math.max(1, judged))

  const out: SupplierReliability[] = []
  for (const id of ids) {
    const s = bySupplier.get(id) ?? { orders: 0, sla: 0, problems: 0 }
    const shipSla = judgeRate(s.sla, s.orders, totals.sla - s.sla, totals.orders - s.orders, z)
    const quality = judgeRate(s.problems, s.orders, totals.problems - s.problems, totals.orders - s.orders, z)
    const delivery = judgeDelivery(input.delivery.get(id))
    const grade = gradeOf({ shipSla: shipSla.verdict, quality: quality.verdict, delivery: delivery.verdict })
    const reasons: string[] = []
    if (shipSla.verdict === "worse") reasons.push(`Annulations pour non-expédition ${pct(shipSla.rate!)} (reste : ${pct(shipSla.marketplaceRate)})`)
    if (quality.verdict === "worse") reasons.push(`Problèmes de qualité ${pct(quality.rate!)} (reste : ${pct(quality.marketplaceRate)})`)
    if (delivery.verdict === "worse") reasons.push(`9 livraisons sur 10 en ${Math.round(delivery.p90Days!)} jours (> ${SLOW_P90_DAYS})`)
    if (shipSla.verdict === "better") reasons.push("Moins d'annulations pour non-expédition que le reste")
    if (quality.verdict === "better") reasons.push("Moins de problèmes de qualité que le reste")
    if (delivery.verdict === "better") reasons.push(`9 livraisons sur 10 en ${Math.round(delivery.p90Days!)} jours ou moins`)
    if (grade === "donnees_insuffisantes") reasons.push(`Moins de deux composantes mesurables (≥ ${RELIABILITY_MIN_ORDERS} commandes ou ≥ ${RELIABILITY_MIN_DELIVERIES} livraisons attestées)`)
    out.push({ supplierId: id, supplierName: input.names.get(id) ?? "Fournisseur", orders: s.orders, shipSla, quality, delivery, grade, reasons })
  }
  const rank: Record<ReliabilityGrade, number> = { a_risque: 0, a_surveiller: 1, fiable: 2, dans_la_moyenne: 3, donnees_insuffisantes: 4 }
  return out.sort((a, b) => rank[a.grade] - rank[b.grade] || b.orders - a.orders)
}
