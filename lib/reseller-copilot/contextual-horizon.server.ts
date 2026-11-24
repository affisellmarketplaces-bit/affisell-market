import "server-only"

import { unstable_cache } from "next/cache"

import { loadQualityEvidenceSafe } from "@/lib/commercial-readiness/readiness-context.server"
import { loadPresenceForProducts } from "@/lib/listing-presence/presence.server"
import { isOrderClosedForPayout } from "@/lib/orders/payment-state"
import { prisma } from "@/lib/prisma"
import type { BlindSpotOrder } from "@/lib/reseller-copilot/blind-spots"
import {
  ageBand,
  buildContextualReport,
  chSnapshotId,
  CH_SNAPSHOT_ACTION,
  CH_MODEL_VERSION,
  competitionBand,
  factorDrift,
  parseSnapshot,
  priceBand,
  readContextualMode,
  snapshotOf,
  type ContextualModelData,
  type ContextualReport,
  type FactorKey,
  type HorizonPeriod,
} from "@/lib/reseller-copilot/contextual-horizon"
import type { SelectionCandidate } from "@/lib/reseller-copilot/selection"
import { loadCandidates } from "@/lib/reseller-copilot/selection.server"
import { measurePeriods } from "@/lib/reseller-copilot/temporal-opportunities"

/**
 * Context-Aware Observation Intelligence — READ-ONLY reads (rules: contextual-horizon.ts). The catalogue's marketplace
 * view (same `loadCandidates` as the copilot), the presence history of every listing, each shop's own paid orders;
 * features at each period's START (product age from `createdAt`, competing shops listed at that moment from the
 * presence history, relisting) plus today's sheet facts labelled `recalcule`. Cached 6 h. The only write is one daily
 * snapshot of the model's verdict (`AuditLog` `copilot.contextual_horizon_snapshot`, id `contextual-horizon:<day>`,
 * closed keys, no identifier). `CONTEXTUAL_HORIZON_MODE=off` (DEFAULT) reads and writes nothing.
 */
const DAY = 86_400_000
export const CH_MAX_PRODUCTS = 5_000
export const CH_MAX_ORDERS = 200_000

export function featuresNow(c: Pick<SelectionCandidate, "categoryId" | "ageDays" | "resellersListing" | "basePriceCents" | "offerMissingMeasured" | "returnWindowDays">, otherShopsListing: number): Record<FactorKey, string> {
  return {
    categorie: c.categoryId ?? "inconnue",
    anciennete: ageBand(c.ageDays ?? null),
    concurrence: competitionBand(otherShopsListing),
    remise_en_vente: "non",
    prix: priceBand(c.basePriceCents),
    offre: c.offerMissingMeasured == null ? "non_mesuree" : c.offerMissingMeasured.length === 0 ? "complete" : "incomplete",
    retour: c.returnWindowDays > 14 ? "etendu" : "legal",
  }
}

export async function loadHorizonPeriods(now = new Date()): Promise<{ periods: HorizonPeriod[]; truncated: boolean; available: boolean }> {
  const evidence = await loadQualityEvidenceSafe()
  const { candidates, truncated: candTruncated } = await loadCandidates(null, undefined, now, evidence, CH_MAX_PRODUCTS)
  const byId = new Map(candidates.map((c) => [c.productId, c]))
  const presence = await loadPresenceForProducts(candidates.map((c) => c.productId))
  if (!presence.available || !presence.trackingStartedAt) return { periods: [], truncated: false, available: false }
  if (presence.truncated || candTruncated) return { periods: [], truncated: true, available: true }
  const orders = await prisma.order.findMany({
    where: { productId: { in: candidates.map((c) => c.productId) }, paidAt: { gte: presence.trackingStartedAt } },
    select: { affiliateId: true, productId: true, paidAt: true, quantity: true, status: true, paymentSettlementStatus: true },
    take: CH_MAX_ORDERS + 1,
  })
  if (orders.length > CH_MAX_ORDERS) return { periods: [], truncated: true, available: true }
  const ordersBy = new Map<string, BlindSpotOrder[]>()
  for (const o of orders) {
    if (!o.paidAt || !o.productId || !o.affiliateId) continue
    const k = `${o.productId}\u0000${o.affiliateId}`
    ordersBy.set(k, [...(ordersBy.get(k) ?? []), { affiliateId: o.affiliateId, paidAt: o.paidAt, quantity: Math.max(1, o.quantity ?? 1), netCents: 0, closed: isOrderClosedForPayout(o) }])
  }
  const listingsByProduct = new Map<string, typeof presence.listings>()
  for (const l of presence.listings) listingsByProduct.set(l.productId, [...(listingsByProduct.get(l.productId) ?? []), l])
  const periods: HorizonPeriod[] = []
  for (const l of presence.listings) {
    const c = byId.get(l.productId)
    if (!c) continue
    const measured = measurePeriods({ productId: l.productId, affiliateId: l.affiliateId, history: l.history, orders: ordersBy.get(`${l.productId}\u0000${l.affiliateId}`) ?? [] }, now).periods
    for (const m of measured) {
      // Competing shops KNOWN to be listed at this period's start (uncertain periods never count).
      const others = (listingsByProduct.get(l.productId) ?? []).filter(
        (o) =>
          o.listingId !== l.listingId &&
          o.history.periods.some((p) => p.start && !p.uncertain && p.start.getTime() <= m.start && (p.ongoing || (p.end != null && p.end.getTime() > m.start))),
      ).length
      const ageAtStart = c.ageDays == null ? null : c.ageDays - (now.getTime() - m.start) / DAY
      const f = featuresNow(c, others)
      periods.push({
        productId: m.productId,
        affiliateId: m.affiliateId,
        start: m.start,
        days: m.days,
        firstSaleAfterDays: m.firstSaleAfterDays,
        features: { ...f, anciennete: ageBand(ageAtStart == null ? null : Math.max(0, ageAtStart)), remise_en_vente: m.isRelisting ? "oui" : "non" },
      })
    }
  }
  return { periods, truncated: false, available: true }
}

export type ContextualBundle = { report: ContextualReport; model: ContextualModelData } | null

/**
 * Report + (validated) model, cached 6 h. null when off, unavailable, capped or unreadable. The bundle can exceed the
 * data cache's item size (it carries the periods the model is refitted on), so a per-instance memo of the same bucket
 * sits in front: one computation per instance and hour, never one per request.
 */
let memo: { bucket: string; value: Promise<ContextualBundle> } | null = null
export async function loadContextualBundle(now = new Date()): Promise<ContextualBundle> {
  if (readContextualMode() === "off") return null
  const bucket = now.toISOString().slice(0, 13)
  if (memo?.bucket === bucket) return memo.value
  const value = computeBundle(now, bucket)
  memo = { bucket, value }
  value.then((v) => {
    if (v == null && memo?.value === value) memo = null
  })
  return value
}

async function computeBundle(now: Date, bucket: string): Promise<ContextualBundle> {
  try {
    return await unstable_cache(
      async () => {
        const { periods, truncated, available } = await loadHorizonPeriods(now)
        if (!available || truncated) return null
        const report = buildContextualReport(periods)
        const day = now.toISOString().slice(0, 10)
        await prisma.auditLog
          .createMany({ data: [{ id: chSnapshotId(day), action: CH_SNAPSHOT_ACTION, entityType: "CopilotModel", entityId: CH_MODEL_VERSION, payload: snapshotOf(report, day) }], skipDuplicates: true })
          .catch(() => undefined)
        return { report, model: { version: report.version, verdict: report.contextualVerdict, factors: report.chosenFactors, periods } }
      },
      ["contextual-horizon-v1", bucket],
      { revalidate: 6 * 3600 },
    )()
  } catch (error) {
    console.error("[contextual-horizon] unreadable", error instanceof Error ? error.message : "unknown")
    return null
  }
}

/** Founder view: the report (no period, no identifier) + the drift over the recorded daily snapshots. */
export async function loadContextualAdminView(now = new Date()) {
  const bundle = await loadContextualBundle(now)
  if (!bundle) return null
  const rows = await prisma.auditLog
    .findMany({ where: { action: CH_SNAPSHOT_ACTION, createdAt: { gte: new Date(now.getTime() - 180 * DAY) } }, select: { payload: true }, take: 400 })
    .catch(() => [])
  const snaps = rows.map((r) => parseSnapshot(r.payload)).filter((x): x is NonNullable<typeof x> => Boolean(x))
  return { report: bundle.report, drift: factorDrift(snaps) }
}
