import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type Row = { id: string; action: string; entityId: string | null; payload: unknown; createdAt: Date }
const db = vi.hoisted(() => ({ rows: new Map<string, Row>() }))
const resendCfg = vi.hoisted(() => ({ from: "Affisell <onboarding@resend.dev>", testEmailTo: "team@example.com" }))
const sends = vi.hoisted(() => ({
  calls: [] as Array<{ intendedTo: string; subject: string; html: string; idempotencyKey?: string }>,
  next: [] as Array<{ ok: false; error: string; errorName?: string }>,
}))
const alerts = vi.hoisted(() => ({ messages: [] as string[] }))

type Where = { action?: string | { in: string[] }; entityId?: { startsWith: string }; id?: string | { startsWith: string } | { in: string[] }; createdAt?: { gte: Date } }
function matches(r: Row, w: Where): boolean {
  if (typeof w.action === "string" && r.action !== w.action) return false
  if (w.action && typeof w.action === "object" && !w.action.in.includes(r.action)) return false
  if (w.entityId && !r.entityId?.startsWith(w.entityId.startsWith)) return false
  if (typeof w.id === "string" && r.id !== w.id) return false
  if (w.id && typeof w.id === "object" && "startsWith" in w.id && !r.id.startsWith(w.id.startsWith)) return false
  if (w.id && typeof w.id === "object" && "in" in w.id && !w.id.in.includes(r.id)) return false
  if (w.createdAt && r.createdAt < w.createdAt.gte) return false
  return true
}
/** Like a Prisma promise: nothing runs until it is awaited (or run by `$transaction`). */
function lazy<T>(run: () => T) {
  return { run, then: (ok: (v: T) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve().then(run).then(ok, ko) }
}
vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      findMany: async ({ where }: { where: Where }) => [...db.rows.values()].filter((r) => matches(r, where)),
      findUnique: async ({ where }: { where: { id: string } }) => db.rows.get(where.id) ?? null,
      create: ({ data }: { data: Omit<Row, "createdAt"> & { actorId?: string | null } }) =>
        lazy(() => {
          if (db.rows.has(data.id)) throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
          const row = { ...data, createdAt: new Date() }
          db.rows.set(data.id, row)
          return row
        }),
    },
    affiliateProduct: { findUnique: async () => ({ affiliateId: "aff_1" }) },
    // All-or-nothing like PostgreSQL: on a conflict, rows created by earlier operations of the batch are rolled back.
    $transaction: async (ops: Array<{ run: () => Row }>) => {
      const before = new Map(db.rows)
      try {
        return ops.map((op) => op.run())
      } catch (e) {
        db.rows.clear()
        for (const [k, v] of before) db.rows.set(k, v)
        throw e
      }
    },
  },
}))
const stripeState = vi.hoisted(() => ({ refundStatus: "succeeded" as string, paid: true, paymentRefunds: [] as Array<{ id: string; status: string; metadata: Record<string, string> }>, refundsReadable: true }))
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    refunds: {
      retrieve: async () => ({ status: stripeState.refundStatus }),
      list: async () => {
        if (!stripeState.refundsReadable) throw new Error("stripe down")
        return { data: stripeState.paymentRefunds }
      },
    },
    checkout: { sessions: { retrieve: async () => ({ payment_status: stripeState.paid ? "paid" : "unpaid", customer_details: { email: "buyer@example.com" }, metadata: { locale: "fr" } }) } },
  }),
}))
vi.mock("@/lib/emails/resend-delivery", () => ({
  readResendDeliveryConfig: () => ({ apiKey: "re_test", ...resendCfg }),
  sendResendEmail: async (a: { intendedTo: string; subject: string; html: string; idempotencyKey?: string }) => {
    sends.calls.push(a)
    return sends.next.shift() ?? { ok: true, resendId: "em_1" }
  },
}))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: async (m: string) => void alerts.messages.push(m) }))
vi.mock("@/lib/emails/email-brand.server", async () => {
  const shared = await import("@/lib/emails/email-brand-shared")
  return { resolveEmailBrandForAffiliate: async () => shared.PLATFORM_EMAIL_BRAND }
})

import { buildNoticeCopy, notifyUnallocatedBuyer, resolveBuyerNoticeInDoubt, retryUnallocatedBuyerNotices } from "@/lib/unallocated-buyer-notice.server"

const SID = "cs_live_SECRET_SESSION"
const KEY1 = `unallocated-buyer-notice:${SID}:initial:1`
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
/** Pretend a claim was written `minutes` ago and the process died before recording the outcome. */
function ageRow(id: string, minutes: number) {
  const r = db.rows.get(id)!
  db.rows.set(id, { ...r, createdAt: new Date(Date.now() - minutes * 60_000) })
}

beforeEach(() => {
  db.rows.clear()
  sends.calls = []
  sends.next = []
  alerts.messages = []
  Object.assign(resendCfg, { from: "Affisell <onboarding@resend.dev>", testEmailTo: "team@example.com" })
  Object.assign(stripeState, { paid: true, refundStatus: "succeeded", paymentRefunds: [], refundsReadable: true })
  process.env.UNALLOCATED_LINE_BUYER_EMAIL = "true"
})
afterEach(() => {
  delete process.env.UNALLOCATED_LINE_BUYER_EMAIL
})

describe("switch", () => {
  it("OFF by default: nothing is read, claimed or sent", async () => {
    delete process.env.UNALLOCATED_LINE_BUYER_EMAIL
    seedTrace()
    expect(await notifyUnallocatedBuyer(SID)).toEqual({ status: "disabled" })
    expect(await retryUnallocatedBuyerNotices()).toEqual({ mode: "off", examined: 0, byStatus: {} })
    expect(sends.calls).toHaveLength(0)
  })
  it("SHADOW: the plan is computed and logged, nothing is claimed or sent", async () => {
    process.env.UNALLOCATED_LINE_BUYER_EMAIL = "shadow"
    seedTrace()
    expect(await notifyUnallocatedBuyer(SID)).toEqual({ status: "shadow", would: "send", kind: "initial", attempt: 1, state: "not_triggered" })
    expect(sends.calls).toHaveLength(0)
    expect([...db.rows.keys()].some((k) => k.startsWith("unallocated-buyer-notice:"))).toBe(false)
  })
})

describe("outside production, never a real buyer", () => {
  it("a verified sender (or no TEST_EMAIL_TO) refuses before any claim: the buyer can not receive a preview e-mail", async () => {
    seedTrace()
    resendCfg.from = "Affisell <noreply@affisell.com>"
    expect(await notifyUnallocatedBuyer(SID)).toEqual({ status: "preview_recipient_not_redirected" })
    resendCfg.from = "Affisell <onboarding@resend.dev>"
    resendCfg.testEmailTo = ""
    expect(await notifyUnallocatedBuyer(SID)).toEqual({ status: "preview_recipient_not_redirected" })
    expect(sends.calls).toHaveLength(0)
    expect([...db.rows.keys()].some((k) => k.startsWith("unallocated-buyer-notice:"))).toBe(false)
  })
})

describe("one notice, no duplicate", () => {
  it("sends ONE initial notice to the payer's address, without promising a refund that was not issued", async () => {
    seedTrace()
    expect(await notifyUnallocatedBuyer(SID)).toMatchObject({ status: "sent", kind: "initial", attempt: 1, state: "not_triggered" })
    const mail = sends.calls[0]!
    expect(mail.intendedTo).toBe("buyer@example.com")
    expect(mail.idempotencyKey).toBe(KEY1)
    expect(mail.html).toMatch(/Aucun remboursement n(?:'|&#x27;|&#39;|&apos;)a encore été émis/) // the HTML encodes the apostrophe
    expect(mail.html).toMatch(/36,00/)
    for (const internal of [SID, "commission_not_explicit", "pi_SECRET", "prod_SECRET", "re_SECRET", "ap_1"]) expect(mail.html + mail.subject).not.toContain(internal)
    expect(await notifyUnallocatedBuyer(SID)).toEqual({ status: "nothing_new" })
    expect(await retryUnallocatedBuyerNotices()).toMatchObject({ examined: 1, byStatus: { nothing_new: 1 } })
    expect(sends.calls).toHaveLength(1)
  })
  it("concurrent runs send once (the claim row is the lock)", async () => {
    seedTrace()
    await Promise.all([notifyUnallocatedBuyer(SID), notifyUnallocatedBuyer(SID), notifyUnallocatedBuyer(SID)])
    expect(sends.calls).toHaveLength(1)
  })
  it("a recorded failure is retried as attempt 2; neither the address nor the provider's message reaches a trace", async () => {
    seedTrace()
    sends.next = [{ ok: false, error: "provider said no for buyer@example.com" }]
    expect(await notifyUnallocatedBuyer(SID)).toMatchObject({ status: "failed", attempt: 1 })
    expect(await retryUnallocatedBuyerNotices()).toMatchObject({ byStatus: { sent: 1 } })
    expect(sends.calls.map((c) => c.idempotencyKey)).toEqual([KEY1, `unallocated-buyer-notice:${SID}:initial:2`])
    const traces = JSON.stringify([...db.rows.values()])
    expect(traces).not.toContain("buyer@example.com")
    expect(traces).not.toContain("provider said no")
  })
})

describe("crash between the send and its record", () => {
  it("within the window: the SAME e-mail is re-sent under the SAME key (Resend dedupes it), even if the refund moved on", async () => {
    seedTrace()
    await notifyUnallocatedBuyer(SID)
    db.rows.delete(`${KEY1}:sent`) // the outcome write was lost
    ageRow(KEY1, 30)
    seedRefundProof() // meanwhile the refund was issued and confirmed
    const first = sends.calls[0]!
    expect(await notifyUnallocatedBuyer(SID)).toMatchObject({ status: "recovered", kind: "initial", attempt: 1, state: "not_triggered" })
    const replay = sends.calls[1]!
    expect([replay.idempotencyKey, replay.subject, replay.html]).toEqual([first.idempotencyKey, first.subject, first.html])
    // the refund confirmation then follows, as its own notice
    expect(await notifyUnallocatedBuyer(SID)).toMatchObject({ status: "sent", kind: "refund_confirmed" })
  })
  it("Resend says the payload differs: no second e-mail, ONE alert, a human decides", async () => {
    seedTrace()
    await notifyUnallocatedBuyer(SID)
    db.rows.delete(`${KEY1}:sent`)
    ageRow(KEY1, 30)
    sends.next = [{ ok: false, error: "conflict", errorName: "invalid_idempotent_request" }]
    expect(await notifyUnallocatedBuyer(SID)).toMatchObject({ status: "recovery_conflict" })
    expect(alerts.messages).toHaveLength(1)
    expect(alerts.messages[0]).toContain(KEY1)
  })
  it("past the window: nothing is sent, one alert, then the admin records the outcome", async () => {
    seedTrace()
    await notifyUnallocatedBuyer(SID)
    db.rows.delete(`${KEY1}:sent`)
    ageRow(KEY1, 21 * 60)
    expect(await notifyUnallocatedBuyer(SID)).toEqual({ status: "in_doubt" })
    expect(await notifyUnallocatedBuyer(SID)).toEqual({ status: "in_doubt" })
    expect(sends.calls).toHaveLength(1)
    expect(alerts.messages).toHaveLength(1)
    expect(await resolveBuyerNoticeInDoubt({ sessionId: SID, kind: "initial", attempt: 1, outcome: "sent", actorId: "admin_1" })).toEqual({ ok: true })
    expect(await resolveBuyerNoticeInDoubt({ sessionId: SID, kind: "initial", attempt: 1, outcome: "failed", actorId: "admin_1" })).toEqual({ ok: false, error: "already_resolved" })
    expect(db.rows.has(`${KEY1}:failed`), "a refused resolution writes nothing").toBe(false)
    expect(await notifyUnallocatedBuyer(SID)).toEqual({ status: "nothing_new" })
  })
})

describe("the e-mail matches Stripe's state", () => {
  it("one « refund confirmed » e-mail only once Stripe reports the refund succeeded", async () => {
    seedTrace()
    await notifyUnallocatedBuyer(SID)
    seedRefundProof()
    stripeState.refundStatus = "pending"
    expect(await notifyUnallocatedBuyer(SID)).toEqual({ status: "nothing_new" })
    stripeState.refundStatus = "succeeded"
    expect(await notifyUnallocatedBuyer(SID)).toMatchObject({ status: "sent", kind: "refund_confirmed", state: "confirmed" })
    expect(sends.calls[1]!.html).toMatch(/vous a été remboursé/)
    expect(await notifyUnallocatedBuyer(SID)).toEqual({ status: "already_sent" })
  })
  it("a refund on the payment that nothing explains (made by hand, wrong amount) holds the notice", async () => {
    seedTrace()
    stripeState.paymentRefunds = [{ id: "re_dashboard", status: "succeeded", metadata: {} }]
    expect(await notifyUnallocatedBuyer(SID)).toEqual({ status: "uncertain_hold" })
    stripeState.paymentRefunds = [{ id: "re_order", status: "succeeded", metadata: { orderId: "o1" } }] // an app order refund is explained
    expect(await notifyUnallocatedBuyer(SID)).toMatchObject({ status: "sent", state: "not_triggered" })
  })
  it("refunds that can not be read are treated as uncertain: no « no refund issued » sentence on a guess", async () => {
    seedTrace()
    stripeState.refundsReadable = false
    expect(await notifyUnallocatedBuyer(SID)).toEqual({ status: "uncertain_hold" })
    expect(sends.calls).toHaveLength(0)
  })
  it("an unpaid session has no verified recipient: nothing claimed, nothing sent", async () => {
    seedTrace()
    stripeState.paid = false
    expect(await notifyUnallocatedBuyer(SID)).toEqual({ status: "no_verified_recipient" })
    expect([...db.rows.keys()].some((k) => k.startsWith("unallocated-buyer-notice:"))).toBe(false)
  })
})

describe("every language, every state renders resolved text", () => {
  const locales = ["fr", "en", "de", "es", "it", "nl", "pl", "zh"] as const
  it.each(locales)("%s", (locale) => {
    for (const [kind, state] of [["initial", "not_triggered"], ["initial", "requested"], ["initial", "in_progress"], ["initial", "confirmed"], ["refund_confirmed", "confirmed"]] as const) {
      const { subject, copy } = buildNoticeCopy(locale, kind, state, "36,00 €")
      const text = [subject, ...Object.values(copy)].join("\n")
      expect(text, `${locale} ${kind} ${state}`).not.toMatch(/emails\.unallocatedLine|\{amount\}/)
      expect(copy.amountLine).toContain("36,00 €")
    }
  })
})
