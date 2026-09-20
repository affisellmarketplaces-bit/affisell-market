import { beforeEach, describe, expect, it, vi } from "vitest"

const { updateMany } = vi.hoisted(() => ({
  updateMany: vi.fn(async () => ({ count: 1 })),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: { order: { updateMany } },
}))

import { clearMerchantAlertSentFlagOnBounce } from "@/lib/resend-webhook/merchant-alert-bounce"

describe("clearMerchantAlertSentFlagOnBounce", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("clears supplier sent flag on bounce with merchant tags", async () => {
    const result = await clearMerchantAlertSentFlagOnBounce("email.bounced", {
      to: ["supplier@example.com"],
      tags: [
        { name: "merchant-alert", value: "supplier" },
        { name: "order-id", value: "ord_abc" },
      ],
    })
    expect(result).toEqual({ cleared: true, role: "supplier", orderId: "ord_abc" })
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "ord_abc", status: "paid" },
      data: { merchantSupplierEmailSentAt: null },
    })
  })

  it("ignores non-bounce events and untagged emails", async () => {
    await expect(
      clearMerchantAlertSentFlagOnBounce("email.delivered", {
        tags: [{ name: "merchant-alert", value: "supplier" }],
      })
    ).resolves.toEqual({ cleared: false, role: null, orderId: null })
    await expect(
      clearMerchantAlertSentFlagOnBounce("email.bounced", {
        tags: [{ name: "expansion", value: "checkout-launch" }],
      })
    ).resolves.toEqual({ cleared: false, role: null, orderId: null })
    expect(updateMany).not.toHaveBeenCalled()
  })
})
