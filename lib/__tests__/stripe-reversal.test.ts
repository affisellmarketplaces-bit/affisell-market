import { describe, expect, it, vi, beforeEach } from "vitest"

const { createReversal, incrementReversed } = vi.hoisted(() => ({
  createReversal: vi.fn(),
  incrementReversed: vi.fn(),
}))

vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    transfers: { createReversal },
  }),
}))

vi.mock("@/lib/payout-reversal-safety", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/payout-reversal-safety")>()
  return {
    ...actual,
    persistTransferReversal: vi.fn(async (input) => ({
      status: input.status,
      created: true,
    })),
    incrementTransferAttemptReversedCents: incrementReversed,
  }
})

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
    },
    transferReversal: {
      groupBy: vi.fn(),
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
    vi.mocked(prisma.transferReversal.groupBy).mockResolvedValue([])
  })

  it("proportionalCents scales partial refunds", () => {
    expect(proportionalCents(1000, 500, 2000)).toBe(250)
    expect(proportionalCents(1000, 2000, 2000)).toBe(1000)
  })

  it("resolveReversibleTransfers reads SUCCESS attempts with reversed balance", () => {
    const rows = resolveReversibleTransfers({
      transferAttempts: [
        {
          id: "ta_sup",
          role: "SUPPLIER",
          status: "SUCCESS",
          stripeTransferId: "tr_sup",
          amountCents: 4500,
          reversedAmountCents: 1000,
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
    expect(rows[0]?.reversedAmountCents).toBe(1000)
  })

  it("reverseConnectTransfersForRefund calls createReversal and increments reversedAmountCents", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "ord_1",
      supplierPayoutCents: 4500,
      affiliatePayoutCents: 1200,
      payoutTransferIds: null,
      transferAttempts: [
        {
          id: "ta_sup",
          role: "SUPPLIER",
          status: "SUCCESS",
          stripeTransferId: "tr_sup",
          amountCents: 4500,
          reversedAmountCents: 0,
        },
        {
          id: "ta_aff",
          role: "AFFILIATE",
          status: "SUCCESS",
          stripeTransferId: "tr_aff",
          amountCents: 1200,
          reversedAmountCents: 0,
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
    expect(createReversal).toHaveBeenCalledWith("tr_sup", { amount: 4500 }, expect.any(Object))
    expect(createReversal).toHaveBeenCalledWith("tr_aff", { amount: 1200 }, expect.any(Object))
    expect(incrementReversed).toHaveBeenCalledTimes(2)
    expect(result.attemptedReversalCount).toBe(2)
    expect(result.outcomes.filter((o) => o.status === "reversed")).toHaveLength(2)
  })

  it("caps second partial refund at available balance", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "ord_partial",
      supplierPayoutCents: 1000,
      affiliatePayoutCents: 0,
      payoutTransferIds: null,
      transferAttempts: [
        {
          id: "ta_sup",
          role: "SUPPLIER",
          status: "SUCCESS",
          stripeTransferId: "tr_sup",
          amountCents: 1000,
          reversedAmountCents: 750,
        },
      ],
    } as never)

    createReversal.mockResolvedValue({ id: "trr_partial" })

    const result = await reverseConnectTransfersForRefund({
      orderId: "ord_partial",
      stripeRefundId: "re_partial",
      refundAmountCents: 500,
      orderTotalCents: 2000,
      isFullRefund: false,
      refundKey: "re_partial",
    })

    expect(createReversal).toHaveBeenCalledWith("tr_sup", { amount: 250 }, expect.any(Object))
    expect(result.outcomes[0]?.availableCents).toBe(250)
    expect(incrementReversed).toHaveBeenCalledWith({
      attemptId: "ta_sup",
      reverseCents: 250,
    })
  })

  it("skips Stripe call when transfer fully reversed", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "ord_done",
      supplierPayoutCents: 1000,
      affiliatePayoutCents: 0,
      payoutTransferIds: null,
      transferAttempts: [
        {
          id: "ta_sup",
          role: "SUPPLIER",
          status: "SUCCESS",
          stripeTransferId: "tr_sup",
          amountCents: 1000,
          reversedAmountCents: 1000,
        },
      ],
    } as never)

    const result = await reverseConnectTransfersForRefund({
      orderId: "ord_done",
      stripeRefundId: "re_done",
      refundAmountCents: 500,
      orderTotalCents: 2000,
      isFullRefund: false,
      refundKey: "re_done",
    })

    expect(createReversal).not.toHaveBeenCalled()
    expect(result.outcomes[0]?.reason).toBe("fully_reversed")
    expect(result.attemptedReversalCount).toBe(0)
  })

  it("isAlreadyReversedError detects duplicate reversal", () => {
    expect(isAlreadyReversedError(new Error("Transfer already been reversed"))).toBe(true)
    expect(isAlreadyReversedError(new Error("network"))).toBe(false)
  })

  it("persists FAILED on hard Stripe error without increment", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "ord_3",
      supplierPayoutCents: 4500,
      affiliatePayoutCents: 0,
      payoutTransferIds: null,
      transferAttempts: [
        {
          id: "ta_sup",
          role: "SUPPLIER",
          status: "SUCCESS",
          stripeTransferId: "tr_sup",
          amountCents: 4500,
          reversedAmountCents: 0,
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
    expect(incrementReversed).not.toHaveBeenCalled()
  })
})
