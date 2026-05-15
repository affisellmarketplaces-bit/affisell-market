import { prisma } from "@/lib/prisma"

const MARKETPLACE_DONE = ["paid", "shipped"] as const
const BLIND_COUNTABLE = ["paid", "fulfilling", "shipped", "awaiting_manual_payment"] as const

function startOfUtcDay(d: Date): Date {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

function startOfUtcMonth(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  return x
}

function startOfUtcYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
}

export type TimeBand = "today" | "month" | "year"

export type PulseBandRow = {
  band: TimeBand
  label: string
  unitsSold: number
  /** Affiliate: commission + markup. Supplier: wholesale COGS. */
  grossRoleCents: number
  commissionCents?: number
  markupCents?: number
}

export type DailySpark = { day: string; units: number; cents: number }

async function ledgerNetCents(userId: string, role: "AFFILIATE" | "SUPPLIER"): Promise<number> {
  const rows = await prisma.merchantPayoutLedger.groupBy({
    by: ["entryType"],
    where: { userId, beneficiaryRole: role },
    _sum: { amountCents: true },
  })
  const payout =
    rows.find((r) => r.entryType === "PAYOUT")?._sum.amountCents ?? 0
  const claw =
    rows.find((r) => r.entryType === "CLAWBACK")?._sum.amountCents ?? 0
  return Math.max(0, payout - claw)
}

async function affiliateBand(
  affiliateId: string,
  from: Date,
  to: Date
): Promise<Omit<PulseBandRow, "band" | "label">> {
  const [marketOrders, blindOrders] = await Promise.all([
    prisma.order.findMany({
      where: {
        affiliateId,
        status: { in: [...MARKETPLACE_DONE] },
        createdAt: { gte: from, lte: to },
      },
      select: {
        quantity: true,
        affiliatePayoutCents: true,
        affiliateMarginRetainedCents: true,
      },
    }),
    prisma.blindDropshipOrder.findMany({
      where: {
        affiliateId,
        status: { in: [...BLIND_COUNTABLE] },
        createdAt: { gte: from, lte: to },
      },
      select: {
        affiliateCommissionCents: true,
        affiliateMarginRetainedCents: true,
        items: { select: { quantity: true } },
      },
    }),
  ])

  let unitsSold = 0
  let commissionCents = 0
  let markupCents = 0

  for (const o of marketOrders) {
    unitsSold += o.quantity
    commissionCents += o.affiliatePayoutCents
    markupCents += o.affiliateMarginRetainedCents
  }
  for (const o of blindOrders) {
    unitsSold += o.items.reduce((s, it) => s + it.quantity, 0)
    commissionCents += o.affiliateCommissionCents
    markupCents += o.affiliateMarginRetainedCents
  }

  return {
    unitsSold,
    grossRoleCents: commissionCents + markupCents,
    commissionCents,
    markupCents,
  }
}

async function supplierBand(
  supplierUserId: string,
  from: Date,
  to: Date
): Promise<Omit<PulseBandRow, "band" | "label" | "commissionCents" | "markupCents">> {
  const blindProfile = await prisma.blindDropshipSupplier.findUnique({
    where: { linkedUserId: supplierUserId },
    select: { id: true },
  })

  const [marketOrders, blindItems] = await Promise.all([
    prisma.order.findMany({
      where: {
        supplierId: supplierUserId,
        status: { in: [...MARKETPLACE_DONE] },
        createdAt: { gte: from, lte: to },
      },
      select: { quantity: true, basePriceCents: true },
    }),
    blindProfile
      ? prisma.blindDropshipOrderItem.findMany({
          where: {
            blindDropshipSupplierId: blindProfile.id,
            createdAt: { gte: from, lte: to },
            order: { status: { in: [...BLIND_COUNTABLE] } },
          },
          select: { quantity: true, supplierPriceAtOrderCents: true },
        })
      : Promise.resolve([]),
  ])

  let unitsSold = 0
  let grossRoleCents = 0
  for (const o of marketOrders) {
    unitsSold += o.quantity
    grossRoleCents += o.basePriceCents
  }
  for (const it of blindItems) {
    unitsSold += it.quantity
    grossRoleCents += it.supplierPriceAtOrderCents * it.quantity
  }

  return { unitsSold, grossRoleCents }
}

async function affiliateSparkline(affiliateId: string, days: number): Promise<DailySpark[]> {
  const to = new Date()
  const from = new Date(to.getTime() - days * 86_400_000)
  const [marketOrders, blindOrders] = await Promise.all([
    prisma.order.findMany({
      where: {
        affiliateId,
        status: { in: [...MARKETPLACE_DONE] },
        createdAt: { gte: from, lte: to },
      },
      select: { quantity: true, createdAt: true, affiliatePayoutCents: true, affiliateMarginRetainedCents: true },
    }),
    prisma.blindDropshipOrder.findMany({
      where: {
        affiliateId,
        status: { in: [...BLIND_COUNTABLE] },
        createdAt: { gte: from, lte: to },
      },
      select: {
        createdAt: true,
        affiliateCommissionCents: true,
        affiliateMarginRetainedCents: true,
        items: { select: { quantity: true } },
      },
    }),
  ])

  const byDay = new Map<string, { units: number; cents: number }>()
  function bump(key: string, units: number, cents: number) {
    const cur = byDay.get(key) ?? { units: 0, cents: 0 }
    cur.units += units
    cur.cents += cents
    byDay.set(key, cur)
  }

  for (const o of marketOrders) {
    const key = o.createdAt.toISOString().slice(0, 10)
    bump(key, o.quantity, o.affiliatePayoutCents + o.affiliateMarginRetainedCents)
  }
  for (const o of blindOrders) {
    const key = o.createdAt.toISOString().slice(0, 10)
    const units = o.items.reduce((s, it) => s + it.quantity, 0)
    bump(key, units, o.affiliateCommissionCents + o.affiliateMarginRetainedCents)
  }

  const out: DailySpark[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(to.getTime() - i * 86_400_000)
    const key = d.toISOString().slice(0, 10)
    const row = byDay.get(key) ?? { units: 0, cents: 0 }
    out.push({ day: key, units: row.units, cents: row.cents })
  }
  return out
}

async function supplierSparkline(supplierUserId: string, days: number): Promise<DailySpark[]> {
  const to = new Date()
  const from = new Date(to.getTime() - days * 86_400_000)
  const blindProfile = await prisma.blindDropshipSupplier.findUnique({
    where: { linkedUserId: supplierUserId },
    select: { id: true },
  })

  const [marketOrders, blindItems] = await Promise.all([
    prisma.order.findMany({
      where: {
        supplierId: supplierUserId,
        status: { in: [...MARKETPLACE_DONE] },
        createdAt: { gte: from, lte: to },
      },
      select: { quantity: true, createdAt: true, basePriceCents: true },
    }),
    blindProfile
      ? prisma.blindDropshipOrderItem.findMany({
          where: {
            blindDropshipSupplierId: blindProfile.id,
            createdAt: { gte: from, lte: to },
            order: { status: { in: [...BLIND_COUNTABLE] } },
          },
          select: {
            quantity: true,
            supplierPriceAtOrderCents: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ])

  const byDay = new Map<string, { units: number; cents: number }>()
  function bump(key: string, units: number, cents: number) {
    const cur = byDay.get(key) ?? { units: 0, cents: 0 }
    cur.units += units
    cur.cents += cents
    byDay.set(key, cur)
  }
  for (const o of marketOrders) {
    const key = o.createdAt.toISOString().slice(0, 10)
    bump(key, o.quantity, o.basePriceCents)
  }
  for (const it of blindItems) {
    const key = it.createdAt.toISOString().slice(0, 10)
    bump(key, it.quantity, it.supplierPriceAtOrderCents * it.quantity)
  }

  const out: DailySpark[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(to.getTime() - i * 86_400_000)
    const key = d.toISOString().slice(0, 10)
    const row = byDay.get(key) ?? { units: 0, cents: 0 }
    out.push({ day: key, units: row.units, cents: row.cents })
  }
  return out
}

export async function loadAffiliateEarningsPulse(affiliateId: string) {
  const now = new Date()
  const t0 = startOfUtcDay(now)
  const m0 = startOfUtcMonth(now)
  const y0 = startOfUtcYear(now)

  const [paidOutCents, today, month, year, sparkline, recentLedger] = await Promise.all([
    ledgerNetCents(affiliateId, "AFFILIATE"),
    affiliateBand(affiliateId, t0, now),
    affiliateBand(affiliateId, m0, now),
    affiliateBand(affiliateId, y0, now),
    affiliateSparkline(affiliateId, 14),
    prisma.merchantPayoutLedger.findMany({
      where: { userId: affiliateId, beneficiaryRole: "AFFILIATE" },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        amountCents: true,
        entryType: true,
        note: true,
        createdAt: true,
      },
    }),
  ])

  const bands: PulseBandRow[] = [
    { band: "today", label: "Today", ...today },
    { band: "month", label: "This month", ...month },
    { band: "year", label: "Year to date", ...year },
  ]

  return { role: "AFFILIATE" as const, paidOutCents, bands, sparkline, recentLedger }
}

export async function loadSupplierEarningsPulse(supplierUserId: string) {
  const now = new Date()
  const t0 = startOfUtcDay(now)
  const m0 = startOfUtcMonth(now)
  const y0 = startOfUtcYear(now)

  const [paidOutCents, today, month, year, sparkline, recentLedger] = await Promise.all([
    ledgerNetCents(supplierUserId, "SUPPLIER"),
    supplierBand(supplierUserId, t0, now),
    supplierBand(supplierUserId, m0, now),
    supplierBand(supplierUserId, y0, now),
    supplierSparkline(supplierUserId, 14),
    prisma.merchantPayoutLedger.findMany({
      where: { userId: supplierUserId, beneficiaryRole: "SUPPLIER" },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        amountCents: true,
        entryType: true,
        note: true,
        createdAt: true,
      },
    }),
  ])

  const bands: PulseBandRow[] = [
    { band: "today", label: "Today", ...today },
    { band: "month", label: "This month", ...month },
    { band: "year", label: "Year to date", ...year },
  ]

  return { role: "SUPPLIER" as const, paidOutCents, bands, sparkline, recentLedger }
}
