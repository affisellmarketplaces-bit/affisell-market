/**
 * Profitability alerts on a REAL PostgreSQL (migration 20261117120000_reseller_profit_alerts): the database unique keys
 * are what make the alerts idempotent, so they are tested on the database itself — concurrent runs, replays, two
 * resellers, CHECK constraints. Opt-in like every DB test (RUN_DB_TESTS=1 + DATABASE_URL_TEST); runs in the CI job
 * `money-db-tests`. The job's schema comes from the Prisma datamodel (no CHECK), so the test drops those tables and
 * applies the migration's own SQL, twice (idempotent). The reseller's performance is a fixed input (its own tests cover
 * it); everything below it — alert rows, delivery claims, the in-app Notification — is real.
 */
import { readFileSync } from "node:fs"
import path from "node:path"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { aggregatePaidOrders, DAY_MS, type PaidOrderFact } from "@/lib/intelligence/order-aggregates"
import { buildResellerPerformance, type ResellerProductInfo } from "@/lib/intelligence/reseller-performance"
import { computeSaleSplit } from "@/lib/money/sale-split"
import { dbTestsRequested, pointAtTestDatabase } from "@/lib/testing/db-test-guard"

const perf = vi.hoisted(() => new Map<string, unknown>())
vi.mock("server-only", () => ({}))
vi.mock("@/lib/intelligence/reseller-performance.server", () => ({
  RESELLER_PERIOD_DAYS: 30,
  loadResellerPerformance: async ({ affiliateId }: { affiliateId: string }) => perf.get(affiliateId),
}))
vi.mock("@/lib/emails/resend-delivery", () => ({ readResendDeliveryConfig: () => null, sendResendEmail: vi.fn() }))

const RUN_DB = dbTestsRequested()
if (RUN_DB) pointAtTestDatabase()

function statements(sql: string): string[] {
  return sql
    .replace(/^--.*$/gm, "")
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

const MIGRATION = path.join(process.cwd(), "prisma/migrations/20261117120000_reseller_profit_alerts/migration.sql")
const stamp = Date.now()
const now = new Date()
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY_MS)

function declining(productId: string) {
  let seq = 0
  const split = computeSaleSplit({ wholesaleCents: 2000, commissionBps: 1000, markupCents: 1000, supplierFeeBps: 0 })
  const mk = (n: number, day: number): PaidOrderFact[] =>
    Array.from({ length: n }, () => ({
      orderId: `${productId}-${++seq}`, productId, quantity: 1, chargedCents: 3000, paidAt: daysAgo(day),
      affiliatePayoutCents: split.resellerPayoutCents, refundedCents: 0, disputed: false,
      sellingCents: 3000, supplierCents: 2000, commissionCents: split.commissionCents, feeCents: split.resellerFeeCents,
    }))
  const info: ResellerProductInfo = {
    productId, name: "Produit DB", listed: true, buyable: true, stock: null, marginReviewNeeded: false,
    currentBasePriceCents: 2000, basePriceAtPeriodStartCents: 2000, lastPriceChange: null, listingPriceCents: 3000,
    commissionPercent: 10, listingId: null,
  }
  return buildResellerPerformance({
    aggregates: aggregatePaidOrders([...mk(10, 40), ...mk(2, 5)], { now, periodDays: 30, qualityDays: 60 }),
    products: new Map([[productId, info]]),
    signals: { openDisputesByProduct: new Map(), pendingReturnsByProduct: new Map() },
    now, comparisonStart: daysAgo(60), periodStart: daysAgo(30),
  })
}

describe.skipIf(!RUN_DB)("profit alerts — real DB", { timeout: 120_000 }, () => {
  let prisma: (typeof import("@/lib/prisma"))["prisma"]
  let alerts: typeof import("@/lib/intelligence/profit-alerts.server")
  const ids = { a: "", b: "" }

  beforeAll(async () => {
    ;({ prisma } = await import("@/lib/prisma"))
    alerts = await import("@/lib/intelligence/profit-alerts.server")
    for (const t of ["ResellerProfitAlert", "ResellerAlertDelivery", "ResellerAlertPreference"]) {
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${t}" CASCADE`)
    }
    const parts = statements(readFileSync(MIGRATION, "utf8"))
    expect(parts.length).toBe(7)
    for (let round = 0; round < 2; round++) for (const s of parts) await prisma.$executeRawUnsafe(s)
    ids.a = (await prisma.user.create({ data: { email: `pa-a-${stamp}@affisell.test`, role: "AFFILIATE", name: "A" } })).id
    ids.b = (await prisma.user.create({ data: { email: `pa-b-${stamp}@affisell.test`, role: "AFFILIATE", name: "B" } })).id
    perf.set(ids.a, declining(`prod-${stamp}`))
    perf.set(ids.b, declining(`prod-${stamp}`))
  }, 60_000)

  afterAll(async () => {
    if (!prisma) return
    const users = [ids.a, ids.b].filter(Boolean)
    await prisma.resellerAlertDelivery.deleteMany({ where: { affiliateId: { in: users } } })
    await prisma.resellerProfitAlert.deleteMany({ where: { affiliateId: { in: users } } })
    await prisma.resellerAlertPreference.deleteMany({ where: { affiliateId: { in: users } } })
    await prisma.notification.deleteMany({ where: { userId: { in: users } } })
    await prisma.user.deleteMany({ where: { id: { in: users } } })
    await prisma.$disconnect()
  })

  it("five concurrent runs and a replay create ONE alert, ONE claim per channel, ONE notification", async () => {
    await Promise.all(Array.from({ length: 5 }, () => alerts.runResellerProfitAlerts({ affiliateId: ids.a, now })))
    await alerts.runResellerProfitAlerts({ affiliateId: ids.a, now })
    const rows = await prisma.resellerProfitAlert.findMany({ where: { affiliateId: ids.a } })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ primaryCause: "volume_down", previousNetCents: 9600, currentNetCents: 1920, netChangeCents: -7680 })
    const deliveries = await prisma.resellerAlertDelivery.findMany({ where: { alertId: rows[0]!.id }, orderBy: { channel: "asc" } })
    expect(deliveries.map((d: { channel: string; status: string; detail: string | null }) => [d.channel, d.status, d.detail])).toEqual([
      ["email", "skipped", "preference_off"],
      ["in_app", "sent", null],
    ])
    expect(await prisma.notification.count({ where: { userId: ids.a, type: "PROFIT_ALERT" } })).toBe(1)
  })

  it("another reseller with the same product gets its own alert", async () => {
    await alerts.runResellerProfitAlerts({ affiliateId: ids.b, now })
    expect(await prisma.resellerProfitAlert.count({ where: { affiliateId: ids.b } })).toBe(1)
    expect(await prisma.notification.count({ where: { userId: ids.b, type: "PROFIT_ALERT" } })).toBe(1)
    expect(await prisma.notification.count({ where: { userId: ids.a, type: "PROFIT_ALERT" } })).toBe(1)
  })

  it("preferences: defaults until saved, then the reseller's own choice", async () => {
    expect(await alerts.loadAlertPreference(ids.b)).toMatchObject({ inApp: true, email: false, saved: false })
    await alerts.saveAlertPreference(ids.b, { inApp: false, email: true, locale: "de" })
    expect(await alerts.loadAlertPreference(ids.b)).toMatchObject({ inApp: false, email: true, locale: "de", saved: true })
  })

  it("the tables refuse what the code must never write", async () => {
    await expect(
      prisma.$executeRaw`INSERT INTO "ResellerAlertDelivery" ("id","alertId","affiliateId","channel","status") VALUES (${`x${stamp}`}, 'a', ${ids.a}, 'sms', 'sent')`
    ).rejects.toThrow()
    await expect(
      prisma.$executeRaw`INSERT INTO "ResellerProfitAlert" ("id","affiliateId","productId","dedupeKey","primaryCause","previousNetCents","currentNetCents","netChangeCents","since","payload") VALUES (${`y${stamp}`}, ${ids.a}, 'p', 'k', 'volume_down', 1, 2, 1, now(), '{}'::jsonb)`
    ).rejects.toThrow() // netChangeCents must be a decline
    await expect(
      prisma.$executeRaw`INSERT INTO "ResellerAlertPreference" ("affiliateId","locale") VALUES (${`z${stamp}`}, 'xx')`
    ).rejects.toThrow()
  })
})
