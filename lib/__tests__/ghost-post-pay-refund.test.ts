import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  checkStock: vi.fn(),
  findOrderIds: vi.fn(),
  orderFindMany: vi.fn(),
  aggregate: vi.fn(),
  refundsCreate: vi.fn(),
  sendResendEmail: vi.fn(),
  alertRefundProblem: vi.fn(),
  opsWebhookAlert: vi.fn(),
}))

vi.mock("@/lib/ghost/check-stock", () => ({ checkStock: h.checkStock }))
vi.mock("@/lib/ghost/ensure-ghost-schema", () => ({ ensureGhostStockSchema: vi.fn(async () => {}) }))
vi.mock("@/lib/emails/resend-delivery", () => ({
  readResendDeliveryConfig: () => ({ apiKey: "test" }),
  sendResendEmail: h.sendResendEmail,
}))
vi.mock("@/lib/stripe", () => ({ getStripeClient: () => ({ refunds: { create: h.refundsCreate } }) }))
vi.mock("@/lib/stripe-marketplace-commission-split", () => ({ findOrderIdsForCheckoutSession: h.findOrderIds }))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: h.opsWebhookAlert }))
vi.mock("@/lib/money/refund-alert", () => ({ alertRefundProblem: h.alertRefundProblem }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findMany: h.orderFindMany },
    orderStripeRefund: { aggregate: h.aggregate },
    affiliateProduct: { findUnique: vi.fn(async () => null) },
  },
}))

import { ghostReverifyBeforeFulfill } from "@/lib/ghost/post-pay-reverify"

const product = (id: string) => ({ id, name: `Product ${id}` })
const orderRow = (id: string, productId: string, patch: Record<string, unknown> = {}) => ({
  id,
  productId,
  customerEmail: "buyer@example.test",
  status: "PENDING",
  paymentSettlementStatus: "PENDING",
  product: product(productId),
  ...patch,
})
const session = (patch: Record<string, unknown> = {}) =>
  ({ id: "cs_1", payment_intent: "pi_1", amount_total: 7000, customer_details: { email: "buyer@example.test" }, ...patch }) as never

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "log").mockImplementation(() => {})
  h.checkStock.mockImplementation(async (p: { id: string }) => ({ status: p.id === "p_oos" ? "out_of_stock" : "in_stock" }))
  h.findOrderIds.mockResolvedValue(["o_a", "o_b"])
  h.orderFindMany.mockResolvedValue([orderRow("o_a", "p_oos"), orderRow("o_b", "p_ok")])
  h.aggregate.mockResolvedValue({ _sum: { amountCents: null } })
  h.refundsCreate.mockResolvedValue({ id: "re_1" })
  h.sendResendEmail.mockResolvedValue({})
})

describe("ghostReverifyBeforeFulfill — refund of an out-of-stock product", () => {
  it("refunds with an EXPLICIT amount (the session total), never a bare PaymentIntent refund", async () => {
    const result = await ghostReverifyBeforeFulfill(session())

    expect(result).toEqual({ refunded: true })
    expect(h.refundsCreate).toHaveBeenCalledTimes(1)
    const [params, opts] = h.refundsCreate.mock.calls[0]
    expect(params).toMatchObject({ payment_intent: "pi_1", amount: 7000, reason: "requested_by_customer" })
    expect(typeof params.amount).toBe("number")
    expect(opts.idempotencyKey).toBe("ghost-oos-refund:cs_1:p_oos:7000")
    expect(h.sendResendEmail).toHaveBeenCalledTimes(1)
  })

  it("subtracts what was already refunded for the session's orders", async () => {
    h.aggregate.mockResolvedValue({ _sum: { amountCents: 2000 } })
    await ghostReverifyBeforeFulfill(session())
    expect(h.refundsCreate.mock.calls[0][0].amount).toBe(5000)
    expect(h.refundsCreate.mock.calls[0][1].idempotencyKey).toBe("ghost-oos-refund:cs_1:p_oos:5000")
  })

  it("does nothing (no Stripe call, no e-mail) when the session is already fully refunded", async () => {
    h.aggregate.mockResolvedValue({ _sum: { amountCents: 7000 } })
    const result = await ghostReverifyBeforeFulfill(session())
    expect(result).toEqual({ refunded: true })
    expect(h.refundsCreate).not.toHaveBeenCalled()
    expect(h.sendResendEmail).not.toHaveBeenCalled()
  })

  it("does nothing when every order of the session is already refunded (state guard)", async () => {
    h.orderFindMany.mockResolvedValue([
      orderRow("o_a", "p_oos", { status: "refunded" }),
      orderRow("o_b", "p_ok", { paymentSettlementStatus: "REFUNDED" }),
    ])
    const result = await ghostReverifyBeforeFulfill(session())
    expect(result).toEqual({ refunded: true })
    expect(h.refundsCreate).not.toHaveBeenCalled()
    expect(h.sendResendEmail).not.toHaveBeenCalled()
  })

  it.each([
    ["no amount_total", { amount_total: null }],
    ["a zero amount_total", { amount_total: 0 }],
  ])("REFUSES to call Stripe with %s, alerts, and does not claim a refund", async (_label, patch) => {
    const result = await ghostReverifyBeforeFulfill(session(patch))
    expect(h.refundsCreate).not.toHaveBeenCalled()
    expect(result).toEqual({ refunded: false, refundFailed: true })
    expect(h.alertRefundProblem).toHaveBeenCalledWith(
      expect.objectContaining({ source: "ghost_oos", subjectId: "cs_1", error: "invalid_refund_amount" })
    )
    expect(h.sendResendEmail).not.toHaveBeenCalled()
  })

  it("alerts and does not claim a refund when the session has no PaymentIntent", async () => {
    const result = await ghostReverifyBeforeFulfill(session({ payment_intent: null }))
    expect(h.refundsCreate).not.toHaveBeenCalled()
    expect(result).toEqual({ refunded: false, refundFailed: true })
    expect(h.alertRefundProblem).toHaveBeenCalledWith(expect.objectContaining({ error: "no_payment_intent" }))
  })

  it("a Stripe failure raises an alert and sends NO 'you have been refunded' e-mail", async () => {
    h.refundsCreate.mockRejectedValue(Object.assign(new Error("Stripe is down"), { type: "StripeAPIError", statusCode: 500 }))
    const result = await ghostReverifyBeforeFulfill(session())
    expect(result).toEqual({ refunded: false, refundFailed: true })
    expect(h.sendResendEmail).not.toHaveBeenCalled()
    expect(h.opsWebhookAlert).not.toHaveBeenCalled() // the success alert only
    expect(h.alertRefundProblem).toHaveBeenCalledWith(
      expect.objectContaining({ source: "ghost_oos", subjectId: "cs_1", error: "Stripe is down", retryable: true })
    )
  })

  it("leaves a session with no out-of-stock product alone", async () => {
    h.orderFindMany.mockResolvedValue([orderRow("o_b", "p_ok")])
    expect(await ghostReverifyBeforeFulfill(session())).toEqual({ refunded: false })
    expect(h.refundsCreate).not.toHaveBeenCalled()
  })
})
