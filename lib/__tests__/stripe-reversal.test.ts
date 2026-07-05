import { describe, expect, it, vi, beforeEach } from "vitest"

const createReversal = vi.fn()

vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    transfers: { createReversal },
  }),
}))

vi.mock("@/lib/payout-reversal-safety", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/payout-reversal-safety")>()
  return {
    ...actual,
    persistTransferReversal: vi.fn(async (input) => input.status),
  }
})

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import {
  isAlreadyReversedError,
  proportionalCents,
  resolveReversibleTransfers,
  reverseConnectTransfersForRefund,
} from "@/lib/stripe-transfer-reversal"

describe("stripe-transfer-reversal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("proportionalCents scales partial refunds", () => {
    expect(proportionalCents(1000, 500, 2000)).toBe(250)
    expect(proportionalCents(1000, 2000, 2000)).toBe(1000)
  })

  it("resolveReversibleTransfers reads SUCCESS attempts", () => {
    const rows = resolveReversibleTransfers({
      transferAttempts: [
        {
          role: "SUPPLIER",
          status: "SUCCESS",
          stripeTransferId: "tr_sup",
          amountCents: 4500,
        },
        {
          role: "AFFILIATE",
          status: "PENDING",
          stripeTransferId: null,
          amountCents: 1200,
        },
      ],
      payoutTransferIds: null,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.transferId).toBe("tr_sup")
  })

  it("reverseConnectTransfersForRefund calls createReversal and persists", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "ord_1",
      supplierPayoutCents: 4500,
      affiliatePayoutCents: 1200,
      payoutTransferIds: null,
      transferAttempts: [
        {
          role: "SUPPLIER",
          status: "SUCCESS",
          stripeTransferId: "tr_sup",
          amountCents: 4500,
        },
        {
          role: "AFFILIATE",
          status: "SUCCESS",
          stripeTransferId: "tr_aff",
          amountCents: 1200,
        },
      ],
    } as never)

    createReversal.mockResolvedValue({ id: "trr_1" })

    const result = await reverseConnectTransfersForRefund({
      orderId: "ord_1",
      stripeRefundId: "re_1",
      refundAmountCents: 10000,
      orderTotalCents: 10000,
      isFullRefund: true,
      refundKey: "re_1",
    })

    expect(createReversal).toHaveBeenCalledTimes(2)
    expect(result.attemptedReversalCount).toBe(2)
    expect(result.outcomes.filter((o) => o.status === "reversed")).toHaveLength(2)
    expect(result.outcomes.every((o) => o.persistedStatus === "SUCCESS")).toBe(true)
  })

  it("isAlreadyReversedError detects duplicate reversal", () => {
    expect(isAlreadyReversedError(new Error("Transfer already been reversed"))).toBe(true)
    expect(isAlreadyReversedError(new Error("network"))).toBe(false)
  })

  it("persists SUCCESS when transfer already reversed", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "ord_2",
      supplierPayoutCents: 4500,
      affiliatePayoutCents: 0,
      payoutTransferIds: null,
      transferAttempts: [
        {
          role: "SUPPLIER",
          status: "SUCCESS",
          stripeTransferId: "tr_sup",
          amountCents: 4500,
        },
      ],
    } as never)

    createReversal.mockRejectedValue(new Error("already been reversed"))

    const result = await reverseConnectTransfersForRefund({
      orderId: "ord_2",
      stripeRefundId: "re_2",
      refundAmountCents: 5000,
      orderTotalCents: 5000,
      isFullRefund: true,
      refundKey: "re_2",
    })

    expect(result.outcomes[0]?.persistedStatus).toBe("SUCCESS")
  })

  it("persists FAILED on hard Stripe error", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "ord_3",
      supplierPayoutCents: 4500,
      affiliatePayoutCents: 0,
      payoutTransferIds: null,
      transferAttempts: [
        {
          role: "SUPPLIER",
          status: "SUCCESS",
          stripeTransferId: "tr_sup",
          amountCents: 4500,
        },
      ],
    } as never)

    createReversal.mockRejectedValue(new Error("insufficient funds in account"))

    const result = await reverseConnectTransfersForRefund({
      orderId: "ord_3",
      stripeRefundId: "re_3",
      refundAmountCents: 5000,
      orderTotalCents: 5000,
      isFullRefund: true,
      refundKey: "re_3",
    })

    expect(result.outcomes[0]?.persistedStatus).toBe("FAILED")
  })
})
