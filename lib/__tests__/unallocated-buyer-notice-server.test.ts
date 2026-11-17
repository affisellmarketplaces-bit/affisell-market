import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const db = vi.hoisted(() => ({ rows: new Map<string, { id: string; action: string; entityId: string | null; payload: unknown; createdAt: Date }>() }))
const sends = vi.hoisted(() => ({ calls: [] as Array<{ intendedTo: string; subject: string; html: string; idempotencyKey?: string }>, fail: false }))

type Where = { action?: string | { in: string[] }; entityId?: { startsWith: string }; id?: { startsWith: string }; createdAt?: { gte: Date } }
function matches(r: { id: string; action: string; entityId: string | null; createdAt: Date }, w: Where): boolean {
  if (typeof w.action === "string" && r.action !== w.action) return false
  if (w.action && typeof w.action === "object" && !w.action.in.includes(r.action)) return false
  if (w.entityId && !r.entityId?.startsWith(w.entityId.startsWith)) return false
  if (w.id && !r.id.startsWith(w.id.startsWith)) return false
  if (w.createdAt && r.createdAt < w.createdAt.gte) return false
  return true
}
vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      findMany: async ({ where }: { where: Where }) => [...db.rows.values()].filter((r) => matches(r, where)),
      create: async ({ data }: { data: { id: string; action: string; entityId: string; payload: unknown } }) => {
        if (db.rows.has(data.id)) throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
        const row = { ...data, createdAt: new Date() }
        db.rows.set(data.id, row)
        return row
      },
    },
    affiliateProduct: { findUnique: async () => ({ affiliateId: "aff_1" }) },
  },
}))
const stripeState = vi.hoisted(() => ({ refundStatus: "succeeded" as string, paid: true }))
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    refunds: { retrieve: async () => ({ status: stripeState.refundStatus }) },
    checkout: { sessions: { retrieve: async () => ({ payment_status: stripeState.paid ? "paid" : "unpaid", customer_details: { email: "buyer@example.com" }, metadata: { locale: "fr" } }) } },
  }),
}))
vi.mock("@/lib/emails/resend-delivery", () => ({
  readResendDeliveryConfig: () => ({ apiKey: "re_test", from: "Affisell <noreply@affisell.com>", testEmailTo: "" }),
  sendResendEmail: async (a: { intendedTo: string; subject: string; html: string; idempotencyKey?: string }) => {
    sends.calls.push(a)
    return sends.fail ? { ok: false, error: "provider said no" } : { ok: true, resendId: "em_1" }
  },
}))
vi.mock("@/lib/emails/email-brand.server", async () => {
  const shared = await import("@/lib/emails/email-brand-shared")
  return { resolveEmailBrandForAffiliate: async () => shared.PLATFORM_EMAIL_BRAND }
})

import { notifyUnallocatedBuyer, retryUnallocatedBuyerNotices } from "@/lib/unallocated-buyer-notice.server"

const SID = "cs_live_SECRET_SESSION"
function seedTrace(line = 0) {
  db.rows.set(`unallocated-line:${SID}:line:${line}`, {
    id: `unallocated-line:${SID}:line:${line}`,
    action: "payment.unallocated_line",
    entityId: `${SID}:line:${line}`,
    payload: { reason: "commission_not_explicit", refundableCents: 3600, currency: "eur", paymentIntentId: "pi_SECRET", productId: "prod_SECRET", affiliateProductId: "ap_1" },
    createdAt: new Date(),
  })
}
function seedRefundProof(line = 0) {
  db.rows.set(`unallocated-line-refunded:${SID}:line:${line}`, {
    id: `unallocated-line-refunded:${SID}:line:${line}`,
    action: "payment.unallocated_line.refunded",
    entityId: `${SID}:line:${line}`,
    payload: { stripeRefundId: "re_SECRET" },
    createdAt: new Date(),
  })
}

beforeEach(() => {
  db.rows.clear()
  sends.calls = []
  sends.fail = false
  stripeState.paid = true
  stripeState.refundStatus = "succeeded"
  process.env.UNALLOCATED_LINE_BUYER_EMAIL = "true"
})
afterEach(() => {
  delete process.env.UNALLOCATED_LINE_BUYER_EMAIL
})

describe("buyer notice for a paid line with no order", () => {
  it("OFF by default: nothing is read, nothing is sent", async () => {
    delete process.env.UNALLOCATED_LINE_BUYER_EMAIL
    seedTrace()
    expect(await notifyUnallocatedBuyer(SID)).toEqual({ status: "disabled" })
    expect(await retryUnallocatedBuyerNotices()).toEqual({ disabled: true, examined: 0, byStatus: {} })
    expect(sends.calls).toHaveLength(0)
  })

  it("sends ONE initial notice to the payer's address, without promising a refund that was not issued", async () => {
    seedTrace()
    expect(await notifyUnallocatedBuyer(SID)).toMatchObject({ status: "sent", kind: "initial", attempt: 1, state: "not_triggered" })
    expect(sends.calls).toHaveLength(1)
    const mail = sends.calls[0]!
    expect(mail.intendedTo).toBe("buyer@example.com")
    expect(mail.idempotencyKey).toBe(`unallocated-buyer-notice:${SID}:initial:1`)
    expect(mail.html).toMatch(/Aucun remboursement n.a encore été émis/)
    expect(mail.html).toMatch(/36,00/)
    for (const internal of [SID, "commission_not_explicit", "pi_SECRET", "prod_SECRET", "re_SECRET", "ap_1"]) expect(mail.html + mail.subject).not.toContain(internal)
    // replay (webhook, page, cron): nothing more
    expect(await notifyUnallocatedBuyer(SID)).toEqual({ status: "nothing_new" })
    expect(await retryUnallocatedBuyerNotices()).toMatchObject({ examined: 1, byStatus: { nothing_new: 1 } })
    expect(sends.calls).toHaveLength(1)
  })

  it("concurrent runs send once (the claim row is the lock)", async () => {
    seedTrace()
    const results = await Promise.all([notifyUnallocatedBuyer(SID), notifyUnallocatedBuyer(SID), notifyUnallocatedBuyer(SID)])
    expect(sends.calls).toHaveLength(1)
    expect(results.filter((r) => r.status === "sent")).toHaveLength(1)
  })

  it("a failed send is recorded and retried as attempt 2; the address never reaches the trace", async () => {
    seedTrace()
    sends.fail = true
    expect(await notifyUnallocatedBuyer(SID)).toMatchObject({ status: "failed", attempt: 1 })
    sends.fail = false
    expect(await retryUnallocatedBuyerNotices()).toMatchObject({ byStatus: { sent: 1 } })
    expect(sends.calls.map((c) => c.idempotencyKey)).toEqual([`unallocated-buyer-notice:${SID}:initial:1`, `unallocated-buyer-notice:${SID}:initial:2`])
    expect(JSON.stringify([...db.rows.values()])).not.toContain("buyer@example.com")
    expect(JSON.stringify([...db.rows.values()])).not.toContain("provider said no")
  })

  it("then exactly one « refund confirmed » e-mail once Stripe reports the refund succeeded", async () => {
    seedTrace()
    await notifyUnallocatedBuyer(SID)
    seedRefundProof()
    stripeState.refundStatus = "pending"
    expect(await notifyUnallocatedBuyer(SID)).toEqual({ status: "nothing_new" })
    stripeState.refundStatus = "succeeded"
    expect(await notifyUnallocatedBuyer(SID)).toMatchObject({ status: "sent", kind: "refund_confirmed", state: "confirmed" })
    expect(sends.calls[1]!.html).toMatch(/vous a été remboursé/)
    expect(await notifyUnallocatedBuyer(SID)).toEqual({ status: "already_sent" })
    expect(sends.calls).toHaveLength(2)
  })

  it("an unpaid session has no verified recipient: nothing claimed, nothing sent", async () => {
    seedTrace()
    stripeState.paid = false
    expect(await notifyUnallocatedBuyer(SID)).toEqual({ status: "no_verified_recipient" })
    expect([...db.rows.keys()].some((k) => k.startsWith("unallocated-buyer-notice:"))).toBe(false)
  })
})
