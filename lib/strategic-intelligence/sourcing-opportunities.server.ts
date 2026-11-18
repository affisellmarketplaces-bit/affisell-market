import "server-only"

import { IDENTITY_KEYS } from "@/lib/listing-compliance/keys"
import { prisma } from "@/lib/prisma"
import { gtin14 } from "@/lib/strategic-intelligence/external/safety-gate"
import type { UnitEconomicsInput } from "@/lib/strategic-intelligence/lever-simulation"
import type { ProductEconomics } from "@/lib/strategic-intelligence/product-economics"
import type { SourcingAlternative, SourcingChannel, SourcingProduct } from "@/lib/strategic-intelligence/sourcing-opportunities"
import type { ReliabilityGrade, SupplierReliability } from "@/lib/strategic-intelligence/supplier-reliability"

/**
 * READ-ONLY loader for the sourcing decision support (sourcing-opportunities.ts). Bounded reads, nothing written, no
 * external call. Products judged = those whose economics the cockpit already measured; alternatives = ACTIVE products of
 * OTHER suppliers carrying the same valid GTIN (every 14 / 13 / 12 / 8-digit spelling looked up).
 */
const MAX_PRODUCTS = 500
const MAX_ALTERNATIVE_ROWS = 5_000

export type SourcingLoadInput = {
  econ: Map<string, ProductEconomics>
  base: Map<string, UnitEconomicsInput>
  orders30: Map<string, number>
  names: Map<string, string>
  qualityWorse: Set<string>
  reliability: SupplierReliability[]
}

export async function loadSourcingProducts(input: SourcingLoadInput): Promise<SourcingProduct[]> {
  const ids = [...input.econ.values()]
    .filter((e) => e.margin !== "donnees_incompletes" && input.base.has(e.productId))
    .sort((a, b) => (input.orders30.get(b.productId) ?? 0) - (input.orders30.get(a.productId) ?? 0))
    .slice(0, MAX_PRODUCTS)
    .map((e) => e.productId)
  if (ids.length === 0) return []

  const [products, own] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, supplierId: true } }),
    prisma.productAttribute.findMany({ where: { productId: { in: ids }, key: IDENTITY_KEYS.gtin }, select: { productId: true, value: true } }),
  ])
  const gtinOf = new Map<string, string>()
  for (const a of own) {
    const g = gtin14(a.value)
    if (g) gtinOf.set(a.productId, g)
  }
  const spellings = new Set<string>()
  for (const g of gtinOf.values()) for (const len of [14, 13, 12, 8]) if (/^0*$/.test(g.slice(0, 14 - len))) spellings.add(g.slice(14 - len))
  const altRows = spellings.size
    ? await prisma.productAttribute.findMany({
        where: { key: IDENTITY_KEYS.gtin, value: { in: [...spellings] }, product: { active: true } },
        select: {
          value: true,
          product: {
            select: {
              id: true,
              name: true,
              supplierId: true,
              basePriceCents: true,
              supplierCommissionRateBps: true,
              stock: true,
              supplierLink: { select: { isActive: true, autoBuyEnabled: true, aePriceCents: true, aeShippingCents: true } },
            },
          },
        },
        take: MAX_ALTERNATIVE_ROWS,
      })
    : []
  // A capped read could miss the cheapest offer: refuse to rank on it.
  if (altRows.length >= MAX_ALTERNATIVE_ROWS) throw new Error("echantillon_tronque")

  const supplierIds = [...new Set([...products.map((p) => p.supplierId), ...altRows.map((r) => r.product.supplierId)])]
  const [users, stats] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: supplierIds } },
      select: { id: true, name: true, supplierFeeBps: true, supplierFeeBpsCatalog: true, supplierFeeBpsAutoBuy: true },
    }),
    prisma.supplierDeliveryStats.findMany({ where: { supplierId: { in: supplierIds } }, select: { supplierId: true, p90EndToEndDays: true, sampleSize: true } }),
  ])
  const user = new Map(users.map((u) => [u.id, u]))
  const delivery = new Map(stats.map((s) => [s.supplierId, s]))
  const grade = new Map(input.reliability.map((r) => [r.supplierId, r]))
  const gradeOf = (id: string): ReliabilityGrade => grade.get(id)?.grade ?? "donnees_insuffisantes"
  const nameOf = (id: string) => grade.get(id)?.supplierName || user.get(id)?.name?.trim() || "Fournisseur"
  const p90 = (id: string) => (delivery.get(id)?.p90EndToEndDays ?? null)
  const n = (id: string) => delivery.get(id)?.sampleSize ?? 0

  const byGtin = new Map<string, typeof altRows>()
  for (const r of altRows) {
    const g = gtin14(r.value)
    if (g) byGtin.set(g, [...(byGtin.get(g) ?? []), r])
  }

  return products.map((p): SourcingProduct => {
    const econ = input.econ.get(p.id)!
    const base = input.base.get(p.id)!
    const channel: SourcingChannel = base.aeCostCents > 0 ? "auto_buy" : "catalogue"
    const g = gtinOf.get(p.id) ?? null
    const seen = new Set<string>()
    const alternatives: SourcingAlternative[] = []
    for (const r of g ? (byGtin.get(g) ?? []) : []) {
      const a = r.product
      if (a.supplierId === p.supplierId || a.id === p.id || seen.has(a.id) || a.basePriceCents <= 0) continue
      seen.add(a.id)
      const link = a.supplierLink && a.supplierLink.isActive && a.supplierLink.autoBuyEnabled ? a.supplierLink : null
      const altChannel: SourcingChannel = link ? "auto_buy" : "catalogue"
      const u = user.get(a.supplierId)
      const negotiated = altChannel === "auto_buy" ? (u?.supplierFeeBpsAutoBuy ?? u?.supplierFeeBps ?? null) : (u?.supplierFeeBpsCatalog ?? u?.supplierFeeBps ?? null)
      const own = input.econ.get(a.id)
      alternatives.push({
        productId: a.id,
        productName: a.name,
        supplierId: a.supplierId,
        supplierName: nameOf(a.supplierId),
        listedPriceCents: a.basePriceCents,
        commissionBps: a.supplierCommissionRateBps,
        stock: a.stock,
        channel: altChannel,
        // A stored 0 is "never entered", not free (same rule as the auto-buy margin floor).
        aeCostCents: link ? (link.aePriceCents > 0 && link.aeShippingCents > 0 ? link.aePriceCents + link.aeShippingCents : null) : null,
        negotiatedFeeBps: negotiated,
        reliability: gradeOf(a.supplierId),
        deliveryP90Days: p90(a.supplierId),
        deliveries: n(a.supplierId),
        ownSales: own ? { usable: own.usable, refundRate: own.refundRate, meanNetCents: own.meanNetCents } : null,
      })
    }
    return {
      productId: p.id,
      productName: input.names.get(p.id) ?? p.name,
      supplierId: p.supplierId,
      supplierName: nameOf(p.supplierId),
      gtin: g ? (g.startsWith("0") ? g.slice(1) : g) : null,
      econ,
      base,
      channel,
      orders30: input.orders30.get(p.id) ?? 0,
      reliability: gradeOf(p.supplierId),
      deliveryP90Days: p90(p.supplierId),
      deliveries: n(p.supplierId),
      qualityWorse: input.qualityWorse.has(p.id),
      alternatives,
    }
  })
}
