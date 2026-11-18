import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  attempts: [] as Array<{ orderId: string; role: string; amountCents: number; destination: string; status?: string }>,
  audits: new Set<string>(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/marketplace-split-amounts", () => ({
  computeTransferAmountsFromOrder: () => ({ supplierPayoutCents: 800, affiliateTransferCents: 150 }),
  orderSplitInputFromOrder: () => ({}),
}))
vi.mock("@/lib/order-escrow-allocation", () => ({
  resolveOrderEscrowAllocation: () => ({ supplierMarginCents: 800 }),
  computeOrderEscrowAllocation: () => ({ supplierMarginCents: 800 }),
}))
vi.mock("@/lib/prisma", () => {
  const order = () => ({
    id: "o1",
    paidAt: new Date(),
    status: "paid",
    paymentSettlementStatus: "PAID",
    supplierId: "s1",
    affiliateId: "a1",
    affiliateStripeAccountId: null,
    supplierMarginCents: 800,
    supplier: { id: "s1", email: "s@x.fr", stripeAccountId: "acct_s" },
    affiliate: { id: "a1", stripeAccountId: null },
    transferAttempts: m.attempts.filter((a) => a.orderId === "o1").map((a) => ({ role: a.role })),
    stripeRefunds: [],
  })
  const tx = {
    $queryRaw: async () => [],
    order: { findUnique: async () => order() },
    processedWebhook: { findMany: async () => [] },
    transferAttempt: {
      createMany: async (a: { data: Array<{ orderId: string; role: string; amountCents: number; destination: string; status?: string }> }) => {
        let count = 0
        for (const row of a.data) {
          if (m.attempts.some((x) => x.orderId === row.orderId && x.role === row.role)) continue
          m.attempts.push(row)
          count += 1
        }
        return { count }
      },
    },
    auditLog: {
      createMany: async (a: { data: Array<{ id: string }> }) => {
        for (const r of a.data) m.audits.add(r.id)
        return { count: a.data.length }
      },
    },
  }
  return { prisma: { ...tx, $transaction: async (cb: (t: typeof tx) => unknown) => cb(tx) } }
})

import { applyOwedTransferResume } from "@/lib/transfers/owed-resume.server"

describe("applyOwedTransferResume", () => {
  beforeEach(() => {
    m.attempts.length = 0
    m.audits.clear()
    delete process.env.OWED_TRANSFER_RESUME_MODE
  })

  it("does nothing while the mode is off (default)", async () => {
    expect(await applyOwedTransferResume({ adminId: "admin", orderIds: ["o1"] })).toEqual({ ok: false, error: "mode_off" })
    expect(m.attempts).toEqual([])
  })

  it("creates ONE pending row per resumable leg, traced, and a replay creates nothing", async () => {
    process.env.OWED_TRANSFER_RESUME_MODE = "enforce"
    const first = await applyOwedTransferResume({ adminId: "admin", orderIds: ["o1", "o1"] })
    expect(first.ok && first.created).toEqual([{ orderId: "o1", role: "SUPPLIER", amountCents: 800 }])
    expect(m.attempts).toEqual([{ orderId: "o1", role: "SUPPLIER", amountCents: 800, destination: "acct_s", status: "PENDING" }])
    expect([...m.audits]).toEqual(["owed-resume:o1:SUPPLIER"])
    const again = await applyOwedTransferResume({ adminId: "admin", orderIds: ["o1"] })
    expect(again.ok && again.created).toEqual([])
    expect(m.attempts).toHaveLength(1)
  })
})
