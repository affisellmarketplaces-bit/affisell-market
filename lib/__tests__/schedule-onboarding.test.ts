import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock, sendResendReactEmailMock } = vi.hoisted(() => ({
  prismaMock: {
    processedWebhook: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    affiliateProduct: {
      count: vi.fn(),
    },
    order: {
      count: vi.fn(),
    },
    product: {
      count: vi.fn(),
    },
  },
  sendResendReactEmailMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/emails/resend-delivery", () => ({
  sendResendReactEmail: sendResendReactEmailMock,
}))

import {
  merchantHasListingCreated,
  onboardingWebhookId,
  runOnboardingCron,
  sendOnboardingEmailForUser,
  utcSignupDayWindow,
} from "@/lib/emails/schedule-onboarding"

describe("utcSignupDayWindow", () => {
  it("targets the UTC calendar day N days ago", () => {
    const now = new Date("2026-07-10T09:00:00.000Z")
    const window = utcSignupDayWindow(1, now)
    expect(window.gte.toISOString()).toBe("2026-07-09T00:00:00.000Z")
    expect(window.lt.toISOString()).toBe("2026-07-10T00:00:00.000Z")
  })
})

describe("sendOnboardingEmailForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.processedWebhook.findUnique.mockResolvedValue(null)
    prismaMock.processedWebhook.create.mockResolvedValue({ id: "x" })
    prismaMock.affiliateProduct.count.mockResolvedValue(0)
    prismaMock.order.count.mockResolvedValue(0)
    sendResendReactEmailMock.mockResolvedValue({ ok: true, resendId: "re_onb_1" })
  })

  it("sends affiliate day1 with updated subject and Pulse CTA", async () => {
    const result = await sendOnboardingEmailForUser({
      userId: "aff_1",
      role: "AFFILIATE",
      day: 1,
      email: "aff@test.com",
      name: "Alex",
    })

    expect(result.ok).toBe(true)
    expect(sendResendReactEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        context: "onboarding-email",
        subject: "Ton 1er € en 5 min ⚡",
        props: expect.objectContaining({
          name: "Alex",
          preheader: "Payout J+7 garanti",
        }),
      })
    )
    expect(prismaMock.processedWebhook.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ id: onboardingWebhookId("AFFILIATE", 1, "aff_1") }),
      })
    )
  })

  it("still sends J+1 when a listing already exists", async () => {
    prismaMock.affiliateProduct.count.mockResolvedValue(2)

    const result = await sendOnboardingEmailForUser({
      userId: "aff_1b",
      role: "AFFILIATE",
      day: 1,
      email: "aff@test.com",
      name: "Alex",
    })

    expect(result.ok).toBe(true)
    expect(sendResendReactEmailMock).toHaveBeenCalled()
  })

  it("skips J+3 when merchant already has a listing", async () => {
    prismaMock.affiliateProduct.count.mockResolvedValue(1)

    const result = await sendOnboardingEmailForUser({
      userId: "aff_2",
      role: "AFFILIATE",
      day: 3,
      email: "aff2@test.com",
      name: null,
    })

    expect(result).toEqual({ ok: false, error: "listing_created", skipped: true })
    expect(sendResendReactEmailMock).not.toHaveBeenCalled()
    expect(prismaMock.processedWebhook.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: onboardingWebhookId("AFFILIATE", 3, "aff_2"),
          status: "skipped_listing",
        }),
      })
    )
  })
})

describe("merchantHasListingCreated", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.affiliateProduct.count.mockResolvedValue(0)
    prismaMock.product.count.mockResolvedValue(0)
  })

  it("detects supplier catalog products", async () => {
    prismaMock.product.count.mockResolvedValue(2)
    const active = await merchantHasListingCreated("sup_1", "SUPPLIER")
    expect(active).toBe(true)
  })
})

describe("runOnboardingCron", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.processedWebhook.findUnique.mockResolvedValue(null)
    prismaMock.processedWebhook.create.mockResolvedValue({ id: "x" })
    prismaMock.affiliateProduct.count.mockResolvedValue(0)
    prismaMock.order.count.mockResolvedValue(0)
    prismaMock.product.count.mockResolvedValue(0)
    sendResendReactEmailMock.mockResolvedValue({ ok: true, resendId: "re_cron" })
  })

  it("queries users on J-1/J-3/J-7 windows", async () => {
    prismaMock.user.findMany.mockResolvedValue([])
    await runOnboardingCron(50, new Date("2026-07-10T09:00:00.000Z"))
    expect(prismaMock.user.findMany).toHaveBeenCalledTimes(3)
  })
})
