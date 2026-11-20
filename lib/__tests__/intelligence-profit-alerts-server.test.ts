import { beforeEach, describe, expect, it, vi } from "vitest"

import { aggregatePaidOrders, DAY_MS, type PaidOrderFact } from "@/lib/intelligence/order-aggregates"
import { buildResellerPerformance, type ResellerProductInfo } from "@/lib/intelligence/reseller-performance"
import { computeSaleSplit } from "@/lib/money/sale-split"

/** In-memory tables with the SAME unique keys as the migration. */
const db = vi.hoisted(() => {
  const state = {
    alerts: [] as Array<Record<string, unknown> & { id: string; affiliateId: string; dedupeKey: string; productId: string; createdAt: Date; dismissedAt: Date | null }>,
    deliveries: [] as Array<{ alertId: string; channel: string; status: string; detail: string | null; affiliateId: string }>,
    prefs: new Map<string, { inApp: boolean; email: boolean; locale: string }>(),
    notifications: [] as Array<{ userId: string; type: string; message: string; orderId: string | null }>,
    users: new Map<string, { email: string }>(),
  }
  let seq = 0
  const prisma = {
    resellerProfitAlert: {
      findFirst: async ({ where }: { where: { affiliateId: string; productId: string; createdAt: { gte: Date } } }) =>
        state.alerts.find((a) => a.affiliateId === where.affiliateId && a.productId === where.productId && a.createdAt >= where.createdAt.gte) ?? null,
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        let count = 0
        for (const row of data) {
          if (state.alerts.some((a) => a.affiliateId === row.affiliateId && a.dedupeKey === row.dedupeKey)) continue
          state.alerts.push({ ...row, id: `al${++seq}`, createdAt: new Date(), dismissedAt: null } as (typeof state.alerts)[number])
          count++
        }
        return { count }
      },
      findUnique: async ({ where }: { where: { affiliateId_dedupeKey: { affiliateId: string; dedupeKey: string } } }) =>
        state.alerts.find(
          (a) => a.affiliateId === where.affiliateId_dedupeKey.affiliateId && a.dedupeKey === where.affiliateId_dedupeKey.dedupeKey
        ) ?? null,
    },
    resellerAlertDelivery: {
      createMany: async ({ data }: { data: Array<{ alertId: string; channel: string; status: string; affiliateId: string }> }) => {
        let count = 0
        for (const row of data) {
          if (state.deliveries.some((d) => d.alertId === row.alertId && d.channel === row.channel)) continue
          state.deliveries.push({ ...row, detail: null })
          count++
        }
        return { count }
      },
      updateMany: async ({ where, data }: { where: { alertId: string; channel: string; status: string }; data: { status: string; detail: string | null } }) => {
        const d = state.deliveries.find((x) => x.alertId === where.alertId && x.channel === where.channel && x.status === where.status)
        if (d) Object.assign(d, data)
        return { count: d ? 1 : 0 }
      },
    },
    resellerAlertPreference: {
      findUnique: async ({ where }: { where: { affiliateId: string } }) => {
        const p = state.prefs.get(where.affiliateId)
        return p ? { affiliateId: where.affiliateId, ...p } : null
      },
    },
    notification: {
      create: async ({ data }: { data: { userId: string; type: string; message: string; orderId: string | null } }) => {
        state.notifications.push(data)
        return data
      },
    },
    user: { findUnique: async ({ where }: { where: { id: string } }) => state.users.get(where.id) ?? null },
  }
  return { state, prisma, reset: () => {
    state.alerts.length = 0
    state.deliveries.length = 0
    state.prefs.clear()
    state.notifications.length = 0
    state.users.clear()
  } }
})

const m = vi.hoisted(() => ({ perfByAffiliate: new Map<string, unknown>(), sendEmail: vi.fn(), resendConfig: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({ prisma: db.prisma }))
vi.mock("@/lib/intelligence/reseller-performance.server", () => ({
  RESELLER_PERIOD_DAYS: 30,
  loadResellerPerformance: async ({ affiliateId }: { affiliateId: string }) => m.perfByAffiliate.get(affiliateId),
}))
vi.mock("@/lib/emails/resend-delivery", () => ({ readResendDeliveryConfig: m.resendConfig, sendResendEmail: m.sendEmail }))
vi.mock("@/lib/site-url", () => ({ getAbsoluteUrl: (p: string) => `https://affisell.test${p}` }))

import { runResellerProfitAlerts } from "@/lib/intelligence/profit-alerts.server"

const now = new Date("2026-11-16T12:00:00Z")
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY_MS)
let seq = 0
function orders(productId: string, n: number, day: number): PaidOrderFact[] {
  const split = computeSaleSplit({ wholesaleCents: 2000, commissionBps: 1000, markupCents: 1000, supplierFeeBps: 0 })
  return Array.from({ length: n }, () => ({
    orderId: `o${++seq}`, productId, quantity: 1, chargedCents: 3000, paidAt: daysAgo(day),
    affiliatePayoutCents: split.resellerPayoutCents, refundedCents: 0, disputed: false,
    sellingCents: 3000, supplierCents: 2000, commissionCents: split.commissionCents, feeCents: split.resellerFeeCents,
  }))
}
/** A reseller whose product `productId` fell from 10 to 2 orders (a reliable, material volume drop). */
function decliningPerformance(productId: string) {
  const facts = [...orders(productId, 10, 40), ...orders(productId, 2, 5)]
  const info: ResellerProductInfo = {
    productId, name: `Produit ${productId}`, listed: true, buyable: true, stock: { units: 5, meaningful: true },
    marginReviewNeeded: false, currentBasePriceCents: 2000, basePriceAtPeriodStartCents: 2000, lastPriceChange: null,
    listingPriceCents: 3000, commissionPercent: 10, listingId: `l-${productId}`,
  }
  return buildResellerPerformance({
    aggregates: aggregatePaidOrders(facts, { now, periodDays: 30, qualityDays: 60 }),
    products: new Map([[productId, info]]),
    signals: { openDisputesByProduct: new Map(), pendingReturnsByProduct: new Map() },
    now, comparisonStart: daysAgo(60), periodStart: daysAgo(30),
  })
}

beforeEach(() => {
  db.reset()
  m.perfByAffiliate.clear()
  m.sendEmail.mockReset().mockResolvedValue({ ok: true, resendId: "re_1" })
  m.resendConfig.mockReset().mockReturnValue({ apiKey: "k", from: "a@b.c", testEmailTo: "" })
  m.perfByAffiliate.set("aff_a", decliningPerformance("p1"))
  db.state.users.set("aff_a", { email: "a@example.com" })
})

describe("runResellerProfitAlerts", () => {
  it("creates ONE alert and ONE in-app notification, and nothing more when run again (same day or concurrently)", async () => {
    const [r1, r2] = await Promise.all([
      runResellerProfitAlerts({ affiliateId: "aff_a", now }),
      runResellerProfitAlerts({ affiliateId: "aff_a", now }),
    ])
    const r3 = await runResellerProfitAlerts({ affiliateId: "aff_a", now })
    expect(r1.created + r2.created + r3.created).toBe(1)
    expect(db.state.alerts).toHaveLength(1)
    expect(db.state.notifications).toHaveLength(1)
    expect(db.state.notifications[0]).toMatchObject({ userId: "aff_a", type: "PROFIT_ALERT", orderId: "l-p1" })
    expect(db.state.notifications[0]!.message).toContain("Produit p1")
    expect(db.state.deliveries.map((d) => [d.channel, d.status, d.detail])).toEqual([
      ["in_app", "sent", null],
      ["email", "skipped", "preference_off"], // e-mail is opt-in
    ])
    expect(m.sendEmail).not.toHaveBeenCalled()
  })

  it("respects the 14-day cooldown even across a bucket boundary, and alerts again after it", async () => {
    await runResellerProfitAlerts({ affiliateId: "aff_a", now })
    db.state.alerts[0]!.createdAt = daysAgo(11) // 13 days before the next run
    const later = await runResellerProfitAlerts({ affiliateId: "aff_a", now: new Date(now.getTime() + 2 * DAY_MS) })
    expect(later).toMatchObject({ created: 0, cooldown: 1 })
    db.state.alerts[0]!.createdAt = daysAgo(20)
    const after = await runResellerProfitAlerts({ affiliateId: "aff_a", now: new Date(now.getTime() + 15 * DAY_MS) })
    expect(after.created).toBe(1)
  })

  it("e-mail only when the reseller switched it on, in their language, once", async () => {
    db.state.prefs.set("aff_a", { inApp: false, email: true, locale: "en" })
    await runResellerProfitAlerts({ affiliateId: "aff_a", now })
    await runResellerProfitAlerts({ affiliateId: "aff_a", now })
    expect(m.sendEmail).toHaveBeenCalledTimes(1)
    const mail = m.sendEmail.mock.calls[0]![0] as { intendedTo: string; subject: string; html: string }
    expect(mail.intendedTo).toBe("a@example.com")
    expect(mail.subject).toMatch(/net earnings down/)
    expect(mail.html).toContain("https://affisell.test/dashboard/affiliate/products/l-p1/edit")
    expect(db.state.notifications).toHaveLength(0) // in-app switched off
    expect(db.state.deliveries.map((d) => [d.channel, d.status])).toEqual([
      ["in_app", "skipped"],
      ["email", "sent"],
    ])
  })

  it("a failed e-mail is recorded as failed and never retried by a later run", async () => {
    db.state.prefs.set("aff_a", { inApp: true, email: true, locale: "fr" })
    m.sendEmail.mockResolvedValueOnce({ ok: false, error: "boom" })
    await runResellerProfitAlerts({ affiliateId: "aff_a", now })
    await runResellerProfitAlerts({ affiliateId: "aff_a", now })
    expect(m.sendEmail).toHaveBeenCalledTimes(1)
    expect(db.state.deliveries.find((d) => d.channel === "email")).toMatchObject({ status: "failed", detail: "boom" })
  })

  it("keeps resellers apart: each gets the alert for its own figures only", async () => {
    m.perfByAffiliate.set("aff_b", decliningPerformance("p1")) // same product, another reseller
    await runResellerProfitAlerts({ affiliateId: "aff_a", now })
    await runResellerProfitAlerts({ affiliateId: "aff_b", now })
    expect(db.state.alerts.map((a) => a.affiliateId).sort()).toEqual(["aff_a", "aff_b"])
    expect(db.state.notifications.map((n) => n.userId).sort()).toEqual(["aff_a", "aff_b"])
  })

  it("nothing to alert = nothing written", async () => {
    m.perfByAffiliate.set("aff_c", buildResellerPerformance({
      aggregates: new Map(), products: new Map(), signals: { openDisputesByProduct: new Map(), pendingReturnsByProduct: new Map() }, now,
    }))
    expect(await runResellerProfitAlerts({ affiliateId: "aff_c", now })).toMatchObject({ candidates: 0, created: 0 })
    expect(db.state.alerts).toHaveLength(0)
  })
})
