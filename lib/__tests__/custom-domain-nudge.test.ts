import { describe, expect, it, vi, beforeEach } from "vitest"

describe("runCustomDomainNudgeCron", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("sends nudge and marks customDomainNudgeSentAt in brandOps", async () => {
    const update = vi.fn().mockResolvedValue({})
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "store_1",
        userId: "user_1",
        name: "Marie Shop",
        slug: "marie-shop",
        customDomain: null,
        domainVerified: false,
        vercelDomainStatus: null,
        storefrontTheme: {},
        user: { email: "marie@example.com", name: "Marie", role: "AFFILIATE" },
      },
    ])

    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        store: { findMany, update },
      },
    }))
    vi.doMock("@/lib/storefront-brand-pulse.server", () => ({
      countLiveCatalogForMerchant: vi.fn().mockResolvedValue(2),
    }))
    vi.doMock("@/lib/store-cname-target", () => ({
      getStoreCnameTarget: () => "cname.affisell.com",
    }))
    vi.doMock("@/lib/emails/send-custom-domain-nudge", () => ({
      sendCustomDomainNudgeEmail: vi.fn().mockResolvedValue({ ok: true }),
    }))

    const { runCustomDomainNudgeCron } = await import("@/lib/cron/custom-domain-nudge")
    const result = await runCustomDomainNudgeCron(10)

    expect(result.sent).toBe(1)
    expect(update).toHaveBeenCalledWith({
      where: { id: "store_1" },
      data: {
        storefrontTheme: expect.objectContaining({
          brandOps: expect.objectContaining({
            customDomainNudgeSentAt: expect.any(String),
          }),
        }),
      },
    })
  })

  it("skips stores with fully active custom domain", async () => {
    const send = vi.fn()

    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        store: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "store_2",
              userId: "user_2",
              name: "Pro Shop",
              slug: "pro-shop",
              customDomain: "boutique.com",
              domainVerified: true,
              vercelDomainStatus: "active",
              storefrontTheme: {},
              user: { email: "pro@example.com", name: "Pro", role: "AFFILIATE" },
            },
          ]),
          update: vi.fn(),
        },
      },
    }))
    vi.doMock("@/lib/storefront-brand-pulse.server", () => ({
      countLiveCatalogForMerchant: vi.fn().mockResolvedValue(3),
    }))
    vi.doMock("@/lib/store-cname-target", () => ({
      getStoreCnameTarget: () => "cname.affisell.com",
    }))
    vi.doMock("@/lib/emails/send-custom-domain-nudge", () => ({
      sendCustomDomainNudgeEmail: send,
    }))

    const { runCustomDomainNudgeCron } = await import("@/lib/cron/custom-domain-nudge")
    const result = await runCustomDomainNudgeCron()

    expect(result.sent).toBe(0)
    expect(result.skippedAlreadyActive).toBe(1)
    expect(send).not.toHaveBeenCalled()
  })
})
