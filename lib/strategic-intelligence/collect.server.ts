import "server-only"

import { DAY_MS } from "@/lib/intelligence/order-aggregates"
import { prisma } from "@/lib/prisma"
import {
  categoryDemandSignals,
  evolutionRecommendations,
  autoBuyCostUnknownSignal,
  cheaperSameGtinSignals,
  fasterSameGtinSignals,
  type CheaperSameGtinRow,
  countDistinctDisputes,
  shipSlaRiskSignals,
  type ShipSlaRiskRow,
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
import { gtin14, matchSafetyGateAlerts, normalizeBrand, normalizeModel, safetyGateSignals, type CatalogIdentity } from "@/lib/strategic-intelligence/external/safety-gate"
import { fetchLatestSafetyGateAlerts, SAFETY_GATE_REPORTS_READ } from "@/lib/strategic-intelligence/external/safety-gate.server"
import { aggregateAlertsByCategory, categoryExposureSignals, type RootExposure } from "@/lib/strategic-intelligence/external/safety-gate-exposure"
import { dependencySignals } from "@/lib/strategic-intelligence/external/osv"
import { scanDependenciesWithOsv } from "@/lib/strategic-intelligence/external/osv.server"
import { IDENTITY_KEYS } from "@/lib/listing-compliance/keys"
import { listLinksMissingCost } from "@/lib/admin/auto-fulfill/links-missing-cost"
import { isAutoBuyDisabled } from "@/lib/fulfillment/auto-buy"
import { evaluateShipPulseAutoCancel } from "@/lib/orders/ship-pulse-policy"
import { resolveShipDeadlineAt } from "@/lib/supplier-ship-sla-shared"
import { UNALLOCATED_LINE_AUDIT_ACTION, UNALLOCATED_LINE_REFUNDED_AUDIT_ACTION } from "@/lib/unallocated-line"
import { entitySynthesisSignals } from "@/lib/strategic-intelligence/synthesis"
import { applyLearnedPriorities, type PriorityChange } from "@/lib/strategic-intelligence/learned-priority"
import {
  aggregateProductEconomics,
  classifyProducts,
  financialDataQuality,
  potentialSignals,
  type FinancialDataQuality,
  type PotentialClass,
  type ProductContext,
  type ProductPotential,
} from "@/lib/strategic-intelligence/product-economics"
import { loadEconomicsCohort } from "@/lib/strategic-intelligence/product-economics.server"
import { loadJournal } from "@/lib/strategic-intelligence/journal.server"
import { detectEmerging, emergingSignals, EMERGING_PRIOR_DAYS, EMERGING_RECENT_DAYS, type EmergingCounts } from "@/lib/strategic-intelligence/emerging"
import { aggregateQuality, detectQualityOutliers, qualityRiskSignals } from "@/lib/strategic-intelligence/quality-risk"
import { loadOrderCohort } from "@/lib/strategic-intelligence/cohort.server"

/**
 * AFFISELL INTELLIGENCE — step 1 collector. READ-ONLY: it reads Affisell's own database (bounded queries) and calls no
 * external service. Each collector is isolated: one that fails (a table not migrated yet, a timeout) is reported as such
 * and never hides the others.
 */
const MAX_ORDERS = 50_000
/** Identity attribute rows read for the Safety Gate check (3 keys per product at most). */
const MAX_IDENTITY_ROWS = 150_000
/** Unshipped paid orders read for the SLA projection. */
const MAX_UNSHIPPED_ORDERS = 5_000

export type CockpitResult = {
  generatedAt: string
  signals: StrategicSignal[]
  sources: IntelligenceSource[]
  coverage: ReturnType<typeof domainCoverage>
  collectors: Array<{ id: string; ok: boolean; signals: number; error?: string }>
  /** Priorities moved by measured results (learned-priority.ts); written to the AuditLog by the scheduled run only. */
  priorityChanges: PriorityChange[]
  /** Real commercial potential per product (product-economics.ts); null when it could not be computed this run. */
  economics: { quality: FinancialDataQuality; counts: Partial<Record<PotentialClass, number>>; items: ProductPotential[]; error?: string } | null
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
      error: message === "echantillon_tronque" ? "echantillon_tronque" : /does not exist|P2021/i.test(message) ? "table_absente" : /^(ecb|safety_gate|osv)_|abort|timeout|fetch failed/i.test(message) ? "source_injoignable" : "lecture_impossible",
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
    select: { productId: true, affiliateId: true, supplierId: true, paidAt: true, quantity: true, product: { select: { categoryId: true, name: true } } },
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

    guarded("risk.safety_gate", async () => {
      const { reports, alerts } = await fetchLatestSafetyGateAlerts()
      verified.add("eu.safety_gate")
      const [rows, activeProducts] = await Promise.all([
        prisma.productAttribute.findMany({
          where: { key: { in: [IDENTITY_KEYS.gtin, IDENTITY_KEYS.brand, IDENTITY_KEYS.mpn] }, product: { active: true } },
          select: { productId: true, key: true, value: true },
          take: MAX_IDENTITY_ROWS,
        }),
        prisma.product.count({ where: { active: true } }),
      ])
      // A capped read would silently miss products: no conclusion is drawn from it.
      if (rows.length >= MAX_IDENTITY_ROWS) throw new Error("echantillon_tronque")
      const byProduct = new Map<string, CatalogIdentity>()
      for (const r of rows) {
        const p = byProduct.get(r.productId) ?? { productId: r.productId, name: r.productId, gtin: null, brand: null, mpn: null }
        if (r.key === IDENTITY_KEYS.gtin) p.gtin = r.value
        else if (r.key === IDENTITY_KEYS.brand) p.brand = r.value
        else if (r.key === IDENTITY_KEYS.mpn) p.mpn = r.value
        byProduct.set(r.productId, p)
      }
      const catalog = [...byProduct.values()]
      const matches = matchSafetyGateAlerts(alerts, catalog)
      if (matches.length > 0) {
        const named = await prisma.product.findMany({
          where: { id: { in: [...new Set(matches.map((m) => m.productId))] } },
          select: { id: true, name: true },
        })
        const names = new Map(named.map((p) => [p.id, p.name]))
        for (const m of matches) m.productName = names.get(m.productId) ?? m.productId
      }
      const matchSignals = safetyGateSignals(
        {
          reports,
          alerts,
          matches,
          coverage: {
            activeProducts,
            withValidGtin: catalog.filter((p) => p.gtin && gtin14(p.gtin)).length,
            withBrandAndModel: catalog.filter((p) => p.brand && p.mpn && normalizeBrand(p.brand) && normalizeModel(p.mpn)).length,
          },
        },
        { observedAt }
      )

      // Category exposure: Safety Gate categories × Affisell's active products / valid GTINs / units sold (30 d), by
      // Google-taxonomy ROOT. Bounded reads; a capped read is not used.
      const [cats, activeByCategory, orders] = await Promise.all([
        prisma.category.findMany({ select: { id: true, parentId: true, googleId: true }, take: 50_000 }),
        prisma.product.groupBy({ by: ["categoryId"], where: { active: true }, _count: { _all: true } }),
        ordersPromise,
      ])
      if (cats.length >= 50_000 || orders.length >= MAX_ORDERS) return matchSignals
      const parent = new Map(cats.map((c) => [c.id, c.parentId]))
      const gid = new Map(cats.map((c) => [c.id, c.googleId]))
      const rootCache = new Map<string, number | null>()
      const rootOf = (categoryId: string | null | undefined): number | null => {
        if (!categoryId) return null
        if (rootCache.has(categoryId)) return rootCache.get(categoryId)!
        let cur: string | null | undefined = categoryId
        let guard = 0
        while (cur && parent.get(cur) && guard++ < 20) cur = parent.get(cur)
        const root = cur ? (gid.get(cur) ?? null) : null
        rootCache.set(categoryId, root)
        return root
      }
      const exposure = new Map<number, RootExposure>()
      const bump = (root: number | null, f: (e: RootExposure) => void) => {
        if (root == null) return
        const e = exposure.get(root) ?? { activeProducts: 0, withValidGtin: 0, units30: 0 }
        f(e)
        exposure.set(root, e)
      }
      for (const g of activeByCategory) bump(rootOf(g.categoryId), (e) => (e.activeProducts += g._count._all))
      const validGtinProducts = catalog.filter((p) => p.gtin && gtin14(p.gtin)).map((p) => p.productId)
      if (validGtinProducts.length > 0) {
        const withCat = await prisma.product.findMany({ where: { id: { in: validGtinProducts }, active: true }, select: { categoryId: true } })
        for (const p of withCat) bump(rootOf(p.categoryId), (e) => e.withValidGtin++)
      }
      for (const o of orders) {
        if (o.paidAt && o.paidAt >= d(30)) bump(rootOf(o.product?.categoryId), (e) => (e.units30 += o.quantity ?? 1))
      }
      const from = reports[reports.length - 1]?.publishedOn
      const to = reports[0]?.publishedOn
      return [
        ...matchSignals,
        ...categoryExposureSignals(
          {
            stats: aggregateAlertsByCategory(alerts),
            exposure,
            reportsLabel: reports.map((r) => r.reference).join(", "),
            weeks: reports.length || SAFETY_GATE_REPORTS_READ,
          },
          { observedAt, window: from && to ? { from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.000Z` } : null }
        ),
      ]
    }, report),

    guarded("logistics.sla_risk", async () => {
      // Same filter as the SLA cron (lib/cron/enforce-supplier-ship-sla.ts), without its deadline condition: every
      // unshipped paid order, so the projection at +48 h sees the ones not due yet.
      const rows = await prisma.order.findMany({
        where: {
          status: { in: ["paid", "preparing"] },
          autoCancelledAt: null,
          cancelledEmailSentAt: null,
          trackingNumber: null,
          digitalDeliveredAt: null,
          bookingConfirmedAt: null,
        },
        select: {
          supplierId: true,
          totalCents: true,
          shipDeadlineAt: true,
          paidAt: true,
          createdAt: true,
          trackingNumber: true,
          shipExtensions: { orderBy: { createdAt: "desc" }, select: { status: true, buyerExpiresAt: true, newDeadlineAt: true, createdAt: true } },
          fulfillmentMessages: { where: { authorRole: "SUPPLIER" }, select: { id: true } },
        },
        take: MAX_UNSHIPPED_ORDERS,
      })
      if (rows.length >= MAX_UNSHIPPED_ORDERS) throw new Error("echantillon_tronque")
      const in48h = new Date(now.getTime() + 48 * 3_600_000)
      const bySupplier = new Map<string, ShipSlaRiskRow>()
      for (const o of rows) {
        const deadline = resolveShipDeadlineAt(o)
        const base = { deadline, trackingNumber: o.trackingNumber, supplierMessageCount: o.fulfillmentMessages.length, extensions: o.shipExtensions }
        const nowE = evaluateShipPulseAutoCancel({ ...base, now }).eligible
        const soonE = !nowE && evaluateShipPulseAutoCancel({ ...base, now: in48h }).eligible
        if (!nowE && !soonE) continue
        const r = bySupplier.get(o.supplierId) ?? {
          supplierId: o.supplierId, supplierName: o.supplierId, eligibleNow: 0, eligibleWithin48h: 0, amountCents: 0, unknownAmounts: 0,
          earliestDeadline: deadline.toISOString(),
        }
        if (nowE) r.eligibleNow++
        else r.eligibleWithin48h++
        if (o.totalCents == null) r.unknownAmounts++
        else r.amountCents += o.totalCents
        if (deadline.toISOString() < r.earliestDeadline) r.earliestDeadline = deadline.toISOString()
        bySupplier.set(o.supplierId, r)
      }
      if (bySupplier.size === 0) return []
      const users = await prisma.user.findMany({ where: { id: { in: [...bySupplier.keys()] } }, select: { id: true, name: true, email: true } })
      for (const u of users) {
        const r = bySupplier.get(u.id)
        if (r) r.supplierName = u.name?.trim() || "Fournisseur sans nom"
      }
      return shipSlaRiskSignals([...bySupplier.values()], { observedAt })
    }, report),

    guarded("supplier.auto_buy_cost_unknown", async () => {
      const { total } = await listLinksMissingCost(1)
      return autoBuyCostUnknownSignal({ links: total, autoBuyEnabled: !isAutoBuyDisabled() }, { observedAt })
    }, report),

    guarded("risk.dependencies_osv", async () => {
      const scan = await scanDependenciesWithOsv(now.getTime())
      verified.add("osv.dev")
      return dependencySignals(scan, { observedAt })
    }, report),

    guarded("supplier.cheaper_same_gtin", async () => {
      const orders = (await ordersPromise).filter((o) => o.paidAt && o.paidAt >= d(30))
      const units = new Map<string, number>()
      for (const o of orders) units.set(o.productId, (units.get(o.productId) ?? 0) + (o.quantity ?? 1))
      const top = [...units.entries()].filter(([, u]) => u >= 3).sort((a, b) => b[1] - a[1]).slice(0, 200).map(([id]) => id)
      if (top.length === 0) return []
      const own = await prisma.productAttribute.findMany({ where: { productId: { in: top }, key: IDENTITY_KEYS.gtin }, select: { productId: true, value: true } })
      const gtinOf = new Map<string, string>()
      for (const a of own) {
        const g = gtin14(a.value)
        if (g) gtinOf.set(a.productId, g)
      }
      if (gtinOf.size === 0) return []
      // Stored values are free text: look up every spelling of each GTIN (14 / 13 / 12 / 8 digits).
      const spellings = new Set<string>()
      for (const g of gtinOf.values()) for (const len of [14, 13, 12, 8]) if (/^0*$/.test(g.slice(0, 14 - len))) spellings.add(g.slice(14 - len))
      const others = await prisma.productAttribute.findMany({
        where: { key: IDENTITY_KEYS.gtin, value: { in: [...spellings] }, product: { active: true } },
        select: { productId: true, value: true, product: { select: { name: true, basePriceCents: true, supplierId: true } } },
        take: 5_000,
      })
      const byGtin = new Map<string, typeof others>()
      for (const o of others) {
        const g = gtin14(o.value)
        if (g) byGtin.set(g, [...(byGtin.get(g) ?? []), o])
      }
      const products = await prisma.product.findMany({ where: { id: { in: [...gtinOf.keys()] } }, select: { id: true, name: true, basePriceCents: true, supplierId: true } })
      const candidates: Array<
        Omit<CheaperSameGtinRow, "supplierName" | "alt" | "delivery"> & {
          supplierId: string
          alt: CheaperSameGtinRow["alt"] & { supplierId: string }
          allAlts: Array<{ productId: string; productName: string; supplierId: string; priceCents: number }>
        }
      > = []
      for (const p of products) {
        const g = gtinOf.get(p.id)!
        const alts = (byGtin.get(g) ?? []).filter((o) => o.product.supplierId !== p.supplierId && o.product.basePriceCents > 0)
        if (alts.length === 0) continue
        const best = alts.reduce((a, b) => (b.product.basePriceCents < a.product.basePriceCents ? b : a))
        candidates.push({
          productId: p.id, productName: p.name, supplierId: p.supplierId, priceCents: p.basePriceCents, units30: units.get(p.id) ?? 0,
          gtin: g.startsWith("0") ? g.slice(1) : g,
          alt: { productId: best.productId, productName: best.product.name, supplierId: best.product.supplierId, supplierName: "", priceCents: best.product.basePriceCents },
          allAlts: alts.map((o) => ({ productId: o.productId, productName: o.product.name, supplierId: o.product.supplierId, priceCents: o.product.basePriceCents })),
        })
      }
      if (candidates.length === 0) return []
      const supplierIds = [...new Set(candidates.flatMap((c) => [c.supplierId, ...c.allAlts.map((a) => a.supplierId)]))]
      const [users, stats] = await Promise.all([
        prisma.user.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true } }),
        prisma.supplierDeliveryStats.findMany({ where: { supplierId: { in: supplierIds } }, select: { supplierId: true, p90EndToEndDays: true, sampleSize: true } }),
      ])
      const name = new Map(users.map((u) => [u.id, u.name?.trim() || "Fournisseur sans nom"]))
      const delivery = new Map(stats.map((x) => [x.supplierId, { p90: x.p90EndToEndDays, n: x.sampleSize }]))
      const del = (id: string) => delivery.get(id) ?? { p90: null, n: 0 }
      const cheaper = cheaperSameGtinSignals(
        candidates.map((c) => ({
          ...c,
          supplierName: name.get(c.supplierId) ?? "Fournisseur",
          alt: { ...c.alt, supplierName: name.get(c.alt.supplierId) ?? "Fournisseur" },
          delivery: { current: del(c.supplierId), alt: del(c.alt.supplierId) },
        })),
        { observedAt, window: win30 }
      )
      const faster = fasterSameGtinSignals(
        candidates.map((c) => ({
          productId: c.productId, productName: c.productName, supplierName: name.get(c.supplierId) ?? "Fournisseur", priceCents: c.priceCents,
          units30: c.units30, gtin: c.gtin, current: del(c.supplierId),
          alts: c.allAlts.map((a) => ({ ...a, supplierName: name.get(a.supplierId) ?? "Fournisseur", delivery: del(a.supplierId) })),
        })),
        { observedAt, window: win30 }
      )
      return [...cheaper, ...faster]
    }, report),

    guarded("market.category_demand", async () => {
      const orders = await ordersPromise
      // The read is capped (newest first): a capped read would hold fewer "previous period" orders than reality and
      // turn every category into a false rise. No comparison is made on a truncated read.
      if (orders.length >= MAX_ORDERS) throw new Error("echantillon_tronque")
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

    guarded("discovery.emerging", async () => {
      const all = await ordersPromise
      // A capped read would compare a truncated recent period with nothing older: no conclusion.
      if (all.length >= MAX_ORDERS) throw new Error("echantillon_tronque")
      const recentFrom = d(EMERGING_RECENT_DAYS)
      const priorFrom = d(EMERGING_RECENT_DAYS + EMERGING_PRIOR_DAYS)
      const byProduct = new Map<string, EmergingCounts & { resellers: Set<string> }>()
      const market = { recent: 0, prior: 0 }
      for (const o of all) {
        if (!o.paidAt || o.paidAt < priorFrom) continue
        const isRecent = o.paidAt >= recentFrom
        const p = byProduct.get(o.productId) ?? { productId: o.productId, name: o.product?.name ?? o.productId, recent: 0, prior: 0, sellingResellers: 0, resellers: new Set<string>() }
        if (isRecent) {
          p.recent++
          market.recent++
          p.resellers.add(o.affiliateId)
        } else {
          p.prior++
          market.prior++
        }
        byProduct.set(o.productId, p)
      }
      const findings = detectEmerging(
        [...byProduct.values()].map((p) => ({ productId: p.productId, name: p.name, recent: p.recent, prior: p.prior, sellingResellers: p.resellers.size })),
        market
      )
      if (findings.length === 0) return []
      const listed = await prisma.affiliateProduct.groupBy({
        by: ["productId"],
        where: { productId: { in: findings.slice(0, 10).map((f) => f.productId) }, isListed: true },
        _count: { _all: true },
      })
      return emergingSignals(
        findings,
        new Map(listed.map((l) => [l.productId, Number((l._count as { _all?: number })._all ?? 0)])),
        { observedAt, window: { from: priorFrom.toISOString(), to: observedAt } }
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

    guarded("risk.product_quality", async () => {
      // Orders old enough for a problem to have been reported (see quality-risk.ts) — the SAME read as the reliability index.
      const [{ from, to, orders: rows }, recent] = await Promise.all([loadOrderCohort(now), ordersPromise])
      const cohort = rows
      const products = detectQualityOutliers(aggregateQuality(rows, (o) => o.productId))
      const suppliers = detectQualityOutliers(aggregateQuality(rows, (o) => o.supplierId))
      if (products.length === 0 && suppliers.length === 0) return []
      const productIds = products.map((f) => f.key)
      const productIdSet = new Set(productIds)
      const sold30 = new Set(recent.filter((o) => o.paidAt && o.paidAt >= d(30)).map((o) => o.productId))
      const [productRows, users] = await Promise.all([
        prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, active: true, supplierId: true } }),
        prisma.user.findMany({
          where: { id: { in: [...new Set([...suppliers.map((f) => f.key), ...cohort.filter((o) => productIdSet.has(o.productId)).map((o) => o.supplierId)])] } },
          select: { id: true, name: true, store: { select: { name: true } } },
        }),
      ])
      const supplierName = new Map(users.map((u) => [u.id, u.store?.name?.trim() || u.name?.trim() || "Fournisseur"]))
      return qualityRiskSignals(
        { products, suppliers },
        {
          product: new Map(
            productRows.map((p) => [p.id, { name: p.name, supplierId: p.supplierId, supplierName: supplierName.get(p.supplierId) ?? "Fournisseur", sellingNow: p.active && sold30.has(p.id) }])
          ),
          supplier: supplierName,
        },
        { observedAt, window: { from: from.toISOString(), to: to.toISOString() } }
      )
    }, report),

    guarded("risk.dispute_activity", async () => {
      // One PAYMENT per checkout: a cart's orders are `<session>:line:<i>` (lib/stripe-marketplace-fulfill.ts), so counting
      // orders would overstate payments and UNDERSTATE the dispute activity.
      const [ledger, paymentRows] = await Promise.all([
        prisma.processedWebhook.findMany({ where: { id: { startsWith: "dispute:" }, createdAt: { gte: d(30) } }, select: { id: true } }),
        prisma.$queryRaw<Array<{ n: number }>>`
          SELECT COUNT(DISTINCT split_part("stripeSessionId", ':line:', 1))::int AS n
          FROM "Order" WHERE "paidAt" >= ${d(30)}`,
      ])
      return disputeActivitySignal(
        { disputes30: countDistinctDisputes(ledger.map((r) => r.id)), payments30: Number(paymentRows[0]?.n ?? 0) },
        { observedAt, window: win30 }
      )
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
  // Measured outcomes per signal family; a journal that can not be read changes nothing (no learning, no crash).
  const byFamily = await loadJournal()
    .then((j) => j.byFamily)
    .catch(() => ({}))
  // Real commercial potential: needs the other detectors' findings (emergence, quality, better source) as context, so it
  // runs after them; isolated like a collector (a failure is reported, never hides the rest).
  let economics: CockpitResult["economics"] = null
  const economicsSignals: StrategicSignal[] = []
  try {
    const flat = results.flat()
    const has = (prefix: string) => new Set(flat.filter((s) => s.id.startsWith(prefix)).map((s) => s.id.slice(prefix.length).split(":")[0]!))
    const emerging = has("discovery:emerging:")
    const qualityWorse = has("risk:quality:product:")
    const betterSource = new Set([...has("supplier:cheaper-same-gtin:"), ...has("supplier:faster-same-gtin:")])
    const [{ from, to, orders: econOrders }, recent] = await Promise.all([loadEconomicsCohort(now), ordersPromise])
    if (recent.length >= MAX_ORDERS) throw new Error("echantillon_tronque")
    const orders30 = new Map<string, number>()
    const names = new Map<string, string>()
    for (const o of recent) {
      if (o.product?.name) names.set(o.productId, o.product.name)
      if (o.paidAt && o.paidAt >= d(30)) orders30.set(o.productId, (orders30.get(o.productId) ?? 0) + 1)
    }
    const econ = aggregateProductEconomics(econOrders)
    const ids = [...new Set([...econ.keys(), ...orders30.keys(), ...emerging])]
    const missingNames = ids.filter((id) => !names.has(id))
    const listedBy = new Map<string, number>()
    for (let i = 0; i < ids.length; i += 2000) {
      const chunk = ids.slice(i, i + 2000)
      const [listed, prods] = await Promise.all([
        prisma.affiliateProduct.groupBy({ by: ["productId"], where: { productId: { in: chunk }, isListed: true }, _count: { _all: true } }),
        prisma.product.findMany({ where: { id: { in: chunk.filter((id) => missingNames.includes(id)) } }, select: { id: true, name: true } }),
      ])
      for (const l of listed) listedBy.set(l.productId, Number((l._count as { _all?: number })._all ?? 0))
      for (const p of prods) names.set(p.id, p.name)
    }
    const context = new Map<string, ProductContext>(
      ids.map((id) => [
        id,
        { name: names.get(id) ?? id, orders30: orders30.get(id) ?? 0, emerging: emerging.has(id), qualityWorse: qualityWorse.has(id), betterSource: betterSource.has(id), listedResellers: listedBy.get(id) ?? 0 },
      ])
    )
    const items = classifyProducts(econ, context)
    const counts: Partial<Record<PotentialClass, number>> = {}
    for (const p of items) counts[p.cls] = (counts[p.cls] ?? 0) + 1
    economics = { quality: financialDataQuality(econOrders), counts, items }
    economicsSignals.push(...potentialSignals(items, { observedAt, window: { from: from.toISOString(), to: to.toISOString() } }))
    report.push({ id: "commercial.product_economics", ok: true, signals: economicsSignals.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    report.push({ id: "commercial.product_economics", ok: false, signals: 0, error: message === "echantillon_tronque" ? "echantillon_tronque" : /does not exist|P2021/i.test(message) ? "table_absente" : "lecture_impossible" })
  }

  const learned = applyLearnedPriorities([...results.flat(), ...economicsSignals], byFamily)
  const detected = learned.signals
  return {
    generatedAt: observedAt,
    priorityChanges: learned.changes,
    economics,
    signals: rankSignals([...detected, ...entitySynthesisSignals(detected, { observedAt }), ...evolution]),
    sources,
    coverage,
    collectors: report,
  }
}

