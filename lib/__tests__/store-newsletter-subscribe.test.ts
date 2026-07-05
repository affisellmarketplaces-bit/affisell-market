import { describe, expect, it, vi, beforeEach } from "vitest"

import { normalizeStoreNewsletterEmail } from "@/lib/store-newsletter-subscribe.shared"

describe("normalizeStoreNewsletterEmail", () => {
  it("lowercases and trims valid emails", () => {
    expect(normalizeStoreNewsletterEmail("  Buyer@Example.COM ")).toBe("buyer@example.com")
  })

  it("rejects invalid emails", () => {
    expect(normalizeStoreNewsletterEmail("not-an-email")).toBeNull()
    expect(normalizeStoreNewsletterEmail("")).toBeNull()
  })
})

describe("subscribeStoreNewsletter", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("persists subscriber and notifies affiliate on first subscribe", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "sub_1", welcomeEmailSentAt: null })
    const findUniqueStore = vi.fn().mockResolvedValue({
      id: "store_1",
      name: "Marie Shop",
      slug: "marie-shop",
      customDomain: null,
      domainVerified: false,
      userId: "aff_1",
      user: { role: "AFFILIATE" },
    })
    const findUniqueSub = vi.fn().mockResolvedValue(null)
    const createNotification = vi.fn().mockResolvedValue({})

    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        store: { findUnique: findUniqueStore },
        storeNewsletterSubscriber: { findUnique: findUniqueSub, upsert },
        notification: { create: createNotification },
      },
    }))
    vi.doMock("@/lib/emails/send-store-newsletter-welcome", () => ({
      sendStoreNewsletterWelcomeEmail: vi.fn().mockResolvedValue({ ok: true }),
    }))

    const { subscribeStoreNewsletter } = await import("@/lib/store-newsletter-subscribe")
    const result = await subscribeStoreNewsletter({
      storeSlug: "marie-shop",
      email: "buyer@example.com",
    })

    expect(result).toEqual({
      ok: true,
      created: true,
      storeId: "store_1",
      storeName: "Marie Shop",
    })
    expect(createNotification).toHaveBeenCalledWith({
      data: {
        userId: "aff_1",
        type: "STORE_NEWSLETTER_SUBSCRIBER",
        message: "New newsletter subscriber · buyer@example.com · Marie Shop",
      },
    })
  })

  it("returns store_not_found for non-affiliate shops", async () => {
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        store: {
          findUnique: vi.fn().mockResolvedValue({
            id: "store_1",
            user: { role: "SUPPLIER" },
          }),
        },
      },
    }))

    const { subscribeStoreNewsletter } = await import("@/lib/store-newsletter-subscribe")
    const result = await subscribeStoreNewsletter({
      storeSlug: "supplier-shop",
      email: "buyer@example.com",
    })

    expect(result).toEqual({ ok: false, error: "store_not_found" })
  })
})
