import "server-only"

import { DAY_MS } from "@/lib/intelligence/order-aggregates"
import { prisma } from "@/lib/prisma"
import {
  categoryDemandSignals,
  evolutionRecommendations,
  disputeActivitySignal,
  profitAlertPatternSignals,
  sentinelSignal,
  singleResellerDemandSignals,
  slowSupplierSignals,
  supplierPriceIncreaseSignals,
  unallocatedLinesSignal,
} from "@/lib/strategic-intelligence/detectors"
import { domainCoverage, listIntelligenceSources, type IntelligenceSource } from "@/lib/strategic-intelligence/sources"
import { DOMAIN_LABELS, rankSignals, type StrategicSignal } from "@/lib/strategic-intelligence/types"
import { fxMoves, fxSignals } from "@/lib/strategic-intelligence/external/ecb-fx"
import { fetchEcbHist90d } from "@/lib/strategic-intelligence/external/ecb-fx.server"
import { UNALLOCATED_LINE_AUDIT_ACTION, UNALLOCATED_LINE_REFUNDED_AUDIT_ACTION } from "@/lib/unallocated-line"

/**
 * AFFISELL INTELLIGENCE — step 1 collector. READ-ONLY: it reads Affisell's own database (bounded queries) and calls no
 * external service. Each collector is isolated: one that fails (a table not migrated yet, a timeout) is reported as such
 * and never hides the others.
 */
const MAX_ORDERS = 50_000

export type CockpitResult = {
  generatedAt: string
  signals: StrategicSignal[]
  sources: IntelligenceSource[]
  coverage: ReturnType<typeof domainCoverage>
  collectors: Array<{ id: string; ok: boolean; signals: number; error?: string }>
}

async function guarded(
  id: string,
  run: () => Promise<StrategicSignal[]>,
  report: CockpitResult["collectors"]
): Promise<StrategicSignal[]> {
  try {
    const signals = await run()
    report.push({ id, ok: true, signals: signals.length })
    return signals
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    report.push({
      id,
      ok: false,
      signals: 0,
      error: /does not exist|P2021/i.test(message) ? "table_absente" : /^ecb_|abort|timeout|fetch failed/i.test(message) ? "source_injoignable" : "lecture_impossible",
    })
    return []
  }
}

export async function loadIntelligenceCockpit(now = new Date()): Promise<CockpitResult> {
  const observedAt = now.toISOString()
  const d = (n: number) => new Date(now.getTime() - n * DAY_MS)
  const win30 = { from: d(30).toISOString(), to: observedAt }
  const win7 = { from: d(7).toISOString(), to: observedAt }
  const report: CockpitResult["collectors"] = []

  // One bounded read of the last 60 days of paid orders, shared by three collectors.
  const ordersPromise = prisma.order.findMany({
    where: { paidAt: { gte: d(60) } },
    take: MAX_ORDERS,
    orderBy: { paidAt: "desc" },
    select: { productId: true, affiliateId: true, supplierId: true, paidAt: true, product: { select: { categoryId: true, name: true } } },
  })

  const verified = new Set<string>()

  const results = await Promise.all([
    guarded("supplier.fx_ecb", async () => {
      const days = await fetchEcbHist90d()
      verified.add("ecb.eurofxref")
      const moves = fxMoves(days)
      const baseDate = moves[0]?.baseDate
      const [activeAeLinks, autoBuyLinks, staleSinceBase] = await Promise.all([
        prisma.supplierLink.count({ where: { isActive: true } }),
        prisma.supplierLink.count({ where: { isActive: true, autoBuyEnabled: true } }),
        baseDate
          ? prisma.supplierLink.count({ where: { isActive: true, updatedAt: { lt: new Date(`${baseDate}T00:00:00Z`) } } })
          : Promise.resolve(0),
      ])
      return fxSignals(moves, { observedAt, exposure: { activeAeLinks, autoBuyLinks, staleSinceBase } })
    }, report),

    guarded("market.category_demand", async () => {
      const orders = await ordersPromise
      const counts = new Map<string, { current: number; previous: number }>()
      for (const o of orders) {
        const cat = o.product?.categoryId
        if (!cat || !o.paidAt) continue
        const c = counts.get(cat) ?? { current: 0, previous: 0 }
        if (o.paidAt >= d(30)) c.current++
        else c.previous++
        counts.set(cat, c)
      }
      const cats = await prisma.category.findMany({ where: { id: { in: [...counts.keys()] } }, select: { id: true, name: true } })
      const names = new Map(cats.map((c) => [c.id, c.name]))
      return categoryDemandSignals(
        [...counts.entries()].map(([categoryId, c]) => ({ categoryId, name: names.get(categoryId) ?? categoryId, ...c })),
        { observedAt, window: { from: d(60).toISOString(), to: observedAt } }
      )
    }, report),

    guarded("discovery.under_distributed", async () => {
      const orders = (await ordersPromise).filter((o) => o.paidAt && o.paidAt >= d(30))
      const byProduct = new Map<string, { name: string; orders: number; resellers: Set<string> }>()
      for (const o of orders) {
        const p = byProduct.get(o.productId) ?? { name: o.product?.name ?? o.productId, orders: 0, resellers: new Set<string>() }
        p.orders++
        p.resellers.add(o.affiliateId)
        byProduct.set(o.productId, p)
      }
      const candidates = [...byProduct.entries()].filter(([, p]) => p.orders >= 10 && p.resellers.size === 1)
      if (candidates.length === 0) return []
      const listed = await prisma.affiliateProduct.groupBy({
        by: ["productId"],
        where: { productId: { in: candidates.map(([id]) => id) }, isListed: true },
        _count: { _all: true },
      })
      const listedBy = new Map(listed.map((l) => [l.productId, Number((l._count as { _all?: number })._all ?? 0)]))
      return singleResellerDemandSignals(
        candidates
          .map(([productId, p]) => ({ productId, name: p.name, orders30: p.orders, resellers: p.resellers.size, listedResellers: listedBy.get(productId) ?? 0 }))
          .sort((a, b) => b.orders30 - a.orders30),
        { observedAt, window: win30 }
      )
    }, report),

    guarded("supplier.price_increases", async () => {
      const rows = (await prisma.productPriceHistory.findMany({
        where: { variantKey: null, recordedAt: { gte: d(7) }, previousCents: { not: null } },
        take: 20_000,
        select: { productId: true, supplierId: true, priceCents: true, previousCents: true },
      })) as Array<{ productId: string; supplierId: string | null; priceCents: number; previousCents: number | null }>
      const bySupplier = new Map<string, { products: Set<string>; sumBps: number; n: number }>()
      for (const r of rows) {
        if (!r.supplierId || !r.previousCents || r.priceCents <= r.previousCents) continue
        const s = bySupplier.get(r.supplierId) ?? { products: new Set<string>(), sumBps: 0, n: 0 }
        s.products.add(r.productId)
        s.sumBps += Math.round(((r.priceCents - r.previousCents) / r.previousCents) * 10_000)
        s.n++
        bySupplier.set(r.supplierId, s)
      }
      if (bySupplier.size === 0) return []
      const allProducts = [...bySupplier.values()].flatMap((s) => [...s.products])
      const [listings, suppliers] = await Promise.all([
        prisma.affiliateProduct.groupBy({ by: ["productId"], where: { productId: { in: allProducts }, isListed: true }, _count: { _all: true } }),
        prisma.user.findMany({ where: { id: { in: [...bySupplier.keys()] } }, select: { id: true, name: true, store: { select: { name: true } } } }),
      ])
      const listingsBy = new Map(listings.map((l) => [l.productId, Number((l._count as { _all?: number })._all ?? 0)]))
      const nameBy = new Map(suppliers.map((u) => [u.id, u.store?.name?.trim() || u.name?.trim() || "Fournisseur"]))
      return supplierPriceIncreaseSignals(
        [...bySupplier.entries()].map(([supplierId, s]) => ({
          supplierId,
          supplierName: nameBy.get(supplierId) ?? "Fournisseur",
          products: s.products.size,
          avgIncreaseBps: Math.round(s.sumBps / Math.max(1, s.n)),
          listingsAffected: [...s.products].reduce((sum, p) => sum + (listingsBy.get(p) ?? 0), 0),
        })),
        { observedAt, window: win7 }
      )
    }, report),

    guarded("supplier.slow_delivery", async () => {
      const orders = (await ordersPromise).filter((o) => o.paidAt && o.paidAt >= d(30))
      const bySupplier = new Map<string, number>()
      for (const o of orders) bySupplier.set(o.supplierId, (bySupplier.get(o.supplierId) ?? 0) + 1)
      const stats = await prisma.supplierDeliveryStats.findMany({
        where: { sampleSize: { gte: 20 }, p90EndToEndDays: { gt: 12 } },
        select: { supplierId: true, p90EndToEndDays: true, sampleSize: true },
      })
      if (stats.length === 0) return []
      const users = await prisma.user.findMany({
        where: { id: { in: stats.map((s) => s.supplierId) } },
        select: { id: true, name: true, store: { select: { name: true } } },
      })
      const nameBy = new Map(users.map((u) => [u.id, u.store?.name?.trim() || u.name?.trim() || "Fournisseur"]))
      return slowSupplierSignals(
        stats.map((s) => ({
          supplierId: s.supplierId,
          supplierName: nameBy.get(s.supplierId) ?? "Fournisseur",
          p90Days: s.p90EndToEndDays,
          sampleSize: s.sampleSize,
          ordersShareBps: orders.length > 0 ? Math.round(((bySupplier.get(s.supplierId) ?? 0) / orders.length) * 10_000) : 0,
        })),
        { observedAt }
      )
    }, report),

    guarded("risk.dispute_activity", async () => {
      const [ledger, payments] = await Promise.all([
        prisma.processedWebhook.findMany({ where: { id: { startsWith: "dispute:" }, createdAt: { gte: d(30) } }, select: { id: true } }),
        prisma.order.count({ where: { paidAt: { gte: d(30) } } }),
      ])
      const disputes = new Set(ledger.map((r) => r.id.split(":")[1] ?? r.id))
      return disputeActivitySignal({ disputes30: disputes.size, payments30: payments }, { observedAt, window: win30 })
    }, report),

    guarded("risk.unallocated_lines", async () => {
      const [lines, refunded] = await Promise.all([
        prisma.auditLog.findMany({
          where: { action: UNALLOCATED_LINE_AUDIT_ACTION },
          take: 2000,
          orderBy: { createdAt: "asc" },
          select: { entityId: true, payload: true, createdAt: true },
        }),
        prisma.auditLog.findMany({ where: { action: UNALLOCATED_LINE_REFUNDED_AUDIT_ACTION }, take: 5000, select: { entityId: true } }),
      ])
      const done = new Set(refunded.map((r) => r.entityId))
      const open = lines.filter((l) => !done.has(l.entityId))
      const cents = open.reduce((s, l) => {
        const v = (l.payload as { refundableCents?: unknown } | null)?.refundableCents
        return s + (typeof v === "number" ? v : 0)
      }, 0)
      return unallocatedLinesSignal(
        { lines: open.length, refundableCents: cents, oldestAt: open[0]?.createdAt.toISOString() ?? null },
        { observedAt }
      )
    }, report),

    guarded("commercial.profit_alert_pattern", async () => {
      const rows = (await prisma.resellerProfitAlert.findMany({
        where: { createdAt: { gte: d(7) } },
        take: 10_000,
        select: { primaryCause: true, affiliateId: true, netChangeCents: true },
      })) as Array<{ primaryCause: string; affiliateId: string; netChangeCents: number }>
      const byCause = new Map<string, { alerts: number; resellers: Set<string>; lostCents: number }>()
      for (const r of rows) {
        const c = byCause.get(r.primaryCause) ?? { alerts: 0, resellers: new Set<string>(), lostCents: 0 }
        c.alerts++
        c.resellers.add(r.affiliateId)
        c.lostCents += -r.netChangeCents
        byCause.set(r.primaryCause, c)
      }
      return profitAlertPatternSignals(
        [...byCause.entries()].map(([cause, c]) => ({ cause, alerts: c.alerts, resellers: c.resellers.size, lostCents: c.lostCents })),
        { observedAt, window: win7 }
      )
    }, report),

    guarded("risk.sentinel", async () => {
      const open = await prisma.opsSignal.groupBy({ by: ["severity"], where: { resolvedAt: null }, _count: { _all: true } })
      const count = (sev: string) => Number((open.find((o) => o.severity === sev)?._count as { _all?: number } | undefined)?._all ?? 0)
      return sentinelSignal({ p0: count("P0"), p1: count("P1") }, { observedAt })
    }, report),
  ])

  const sources = listIntelligenceSources(process.env, verified)
  const coverage = domainCoverage(sources)
  const MIGRATION_OF: Record<string, string> = {
    "supplier.price_increases": "20261116200000_product_price_history",
    "commercial.profit_alert_pattern": "20261117120000_reseller_profit_alerts",
  }
  const evolution = evolutionRecommendations(
    {
      notConnectedDomains: (Object.entries(coverage) as Array<[string, string]>)
        .filter(([, status]) => status === "not_connected")
        .map(([domain]) => ({
          domain,
          label: DOMAIN_LABELS[domain as keyof typeof DOMAIN_LABELS],
          note: sources.find((x) => x.domain === domain)?.note ?? "Aucune source.",
        })),
      missingTables: report
        .filter((c) => !c.ok && c.error === "table_absente" && MIGRATION_OF[c.id])
        .map((c) => ({ collector: c.id, migration: MIGRATION_OF[c.id]! })),
    },
    { observedAt }
  )
  return {
    generatedAt: observedAt,
    signals: rankSignals([...results.flat(), ...evolution]),
    sources,
    coverage,
    collectors: report,
  }
}

