/**
 * Buyer notice for a paid line with no order, on a REAL PostgreSQL: the claim that prevents a second e-mail is the
 * `AuditLog` primary key, so concurrency, recovery and the cron sweep are checked against the real constraint and the
 * real query shapes (`id startsWith`, `entityId startsWith`, `createdAt >=`). Stripe, Resend and the ops webhook are
 * replaced (they are network); everything written to the database is real.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { dbTestsRequested, pointAtTestDatabase } from "@/lib/testing/db-test-guard"

const h = vi.hoisted(() => ({
  sends: [] as Array<{ idempotencyKey?: string; html: string }>,
  alerts: [] as string[],
  refundStatus: "succeeded",
  paymentRefunds: [] as Array<{ id: string; status: string; metadata: Record<string, string> }>,
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    refunds: {
      retrieve: async () => ({ status: h.refundStatus }),
      list: async () => ({ data: h.paymentRefunds }),
    },
    checkout: { sessions: { retrieve: async () => ({ payment_status: "paid", customer_details: { email: "buyer@example.com" }, metadata: { locale: "fr" } }) } },
  }),
}))
vi.mock("@/lib/emails/resend-delivery", () => ({
  readResendDeliveryConfig: () => ({ apiKey: "re_test", from: "Affisell <onboarding@resend.dev>", testEmailTo: "team@example.com" }),
  sendResendEmail: async (a: { idempotencyKey?: string; html: string }) => {
    // Slow enough for concurrent callers to really race on the claim row.
    await new Promise((r) => setTimeout(r, 30))
    h.sends.push(a)
    return { ok: true, resendId: `em_${h.sends.length}` }
  },
}))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: async (m: string) => void h.alerts.push(m) }))
vi.mock("@/lib/emails/email-brand.server", async () => {
  const shared = await import("@/lib/emails/email-brand-shared")
  return { resolveEmailBrandForAffiliate: async () => shared.PLATFORM_EMAIL_BRAND }
})

const RUN_DB = dbTestsRequested()
if (RUN_DB) pointAtTestDatabase()

const stamp = Date.now()
const SID = `cs_test_dbnotice_${stamp}`
const KEY1 = `unallocated-buyer-notice:${SID}:initial:1`

describe.skipIf(!RUN_DB)("buyer notice — real DB", { timeout: 120_000 }, () => {
  let prisma: (typeof import("@/lib/prisma"))["prisma"]
  let notice: typeof import("@/lib/unallocated-buyer-notice.server")

  const cleanup = () =>
    prisma.auditLog.deleteMany({ where: { OR: [{ id: { startsWith: "unallocated-buyer-notice:" + SID } }, { entityId: { startsWith: SID } }] } })

  beforeAll(async () => {
    ;({ prisma } = await import("@/lib/prisma"))
    notice = await import("@/lib/unallocated-buyer-notice.server")
  })
  beforeEach(async () => {
    process.env.UNALLOCATED_LINE_BUYER_EMAIL = "true"
    h.sends = []
    h.alerts = []
    h.paymentRefunds = []
    await cleanup()
    await prisma.auditLog.create({
      data: {
        id: `unallocated-line:${SID}:line:0`,
        action: "payment.unallocated_line",
        entityType: "StripeCheckoutLine",
        entityId: `${SID}:line:0`,
        payload: { reason: "listing_inactive", refundableCents: 3600, currency: "eur", paymentIntentId: `pi_test_${stamp}` },
      },
    })
  })
  afterAll(async () => {
    delete process.env.UNALLOCATED_LINE_BUYER_EMAIL
    await cleanup()
    await prisma.$disconnect()
  })

  it("eight concurrent runs send ONE e-mail: the primary key of the claim row is the lock", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => notice.notifyUnallocatedBuyer(SID)))
    expect(h.sends).toHaveLength(1)
    expect(results.filter((r) => r.status === "sent")).toHaveLength(1)
    const rows = await prisma.auditLog.findMany({ where: { id: { startsWith: KEY1 } }, select: { id: true } })
    expect(rows.map((r) => r.id).sort()).toEqual([KEY1, `${KEY1}:sent`])
  })

  it("a lost outcome is recovered under the same key with the same content, once", async () => {
    await notice.notifyUnallocatedBuyer(SID)
    await prisma.auditLog.delete({ where: { id: `${KEY1}:sent` } })
    await prisma.$executeRaw`UPDATE "AuditLog" SET "createdAt" = now() - interval '30 minutes' WHERE id = ${KEY1}`
    const r = await notice.notifyUnallocatedBuyer(SID)
    expect(r).toMatchObject({ status: "recovered", attempt: 1 })
    expect(h.sends.map((s) => s.idempotencyKey)).toEqual([KEY1, KEY1])
    expect(h.sends[1]!.html).toBe(h.sends[0]!.html)
    expect(await notice.notifyUnallocatedBuyer(SID)).toEqual({ status: "nothing_new" })
  })

  it("past the recovery window: no send, one alert, the admin resolution is recorded once", async () => {
    await notice.notifyUnallocatedBuyer(SID)
    await prisma.auditLog.delete({ where: { id: `${KEY1}:sent` } })
    await prisma.$executeRaw`UPDATE "AuditLog" SET "createdAt" = now() - interval '21 hours' WHERE id = ${KEY1}`
    expect(await notice.notifyUnallocatedBuyer(SID)).toEqual({ status: "in_doubt" })
    expect(await notice.notifyUnallocatedBuyer(SID)).toEqual({ status: "in_doubt" })
    expect(h.sends).toHaveLength(1)
    expect(h.alerts).toHaveLength(1)
    const both = await Promise.all([
      notice.resolveBuyerNoticeInDoubt({ sessionId: SID, kind: "initial", attempt: 1, outcome: "sent", actorId: "admin_db" }),
      notice.resolveBuyerNoticeInDoubt({ sessionId: SID, kind: "initial", attempt: 1, outcome: "failed", actorId: "admin_db" }),
    ])
    expect(both.filter((r) => r.ok)).toHaveLength(1)
  })

  it("the cron sweep finds the session through the real query shapes and skips it once finished", async () => {
    const first = await notice.retryUnallocatedBuyerNotices()
    expect(first.byStatus.sent ?? 0).toBeGreaterThanOrEqual(1)
    h.sends = []
    const second = await notice.retryUnallocatedBuyerNotices()
    expect(h.sends).toHaveLength(0)
    expect(second.byStatus.sent ?? 0).toBe(0)
  })

  it("an unexplained refund on the payment holds the first notice (nothing claimed)", async () => {
    h.paymentRefunds = [{ id: "re_dashboard", status: "succeeded", metadata: {} }]
    expect(await notice.notifyUnallocatedBuyer(SID)).toEqual({ status: "uncertain_hold" })
    expect(await prisma.auditLog.count({ where: { id: { startsWith: `unallocated-buyer-notice:${SID}` } } })).toBe(0)
  })
})
