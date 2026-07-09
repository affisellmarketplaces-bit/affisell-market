import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock, recordLegalAcceptanceMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findFirst: vi.fn(), update: vi.fn() },
    legalDocument: { findUnique: vi.fn() },
    legalAcceptance: { count: vi.fn() },
  },
  recordLegalAcceptanceMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/legal/acceptance", () => ({
  recordLegalAcceptance: recordLegalAcceptanceMock,
}))

import { autoAcceptBaseLegalOnStripeKyc } from "@/lib/legal/stripe-kyc-legal-acceptance"

describe("autoAcceptBaseLegalOnStripeKyc", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.user.findFirst.mockResolvedValue({
      id: "user_supplier",
      role: "SUPPLIER",
      cguAcceptedAt: null,
      privacyAcceptedAt: null,
    })
    prismaMock.legalDocument.findUnique
      .mockResolvedValueOnce({ currentVersionId: "ver_customer" })
      .mockResolvedValueOnce({ currentVersionId: "ver_privacy" })
    prismaMock.legalAcceptance.count.mockResolvedValue(0)
    recordLegalAcceptanceMock.mockResolvedValue({ id: "acc_1" })
    prismaMock.user.update.mockResolvedValue({ id: "user_supplier" })
  })

  it("skips when charges_enabled is false", async () => {
    const result = await autoAcceptBaseLegalOnStripeKyc({
      id: "acct_1",
      charges_enabled: false,
      capabilities: {},
    })
    expect(result).toBeNull()
    expect(recordLegalAcceptanceMock).not.toHaveBeenCalled()
  })

  it("records customer + privacy on KYC complete when missing", async () => {
    const result = await autoAcceptBaseLegalOnStripeKyc({
      id: "acct_1",
      charges_enabled: true,
      capabilities: { transfers: "active" },
    })

    expect(result).toEqual({
      userId: "user_supplier",
      accepted: ["customer", "privacy"],
      skipped: [],
    })
    expect(recordLegalAcceptanceMock).toHaveBeenCalledTimes(2)
    expect(recordLegalAcceptanceMock).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "customer", context: "ONBOARDING" })
    )
    expect(recordLegalAcceptanceMock).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "privacy", context: "ONBOARDING" })
    )
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user_supplier" },
        data: expect.objectContaining({
          cguAcceptedAt: expect.any(Date),
          privacyAcceptedAt: expect.any(Date),
          stripeOnboardedAt: expect.any(Date),
        }),
      })
    )
  })

  it("skips LMS rows already on current version", async () => {
    prismaMock.legalAcceptance.count.mockResolvedValue(1)

    const result = await autoAcceptBaseLegalOnStripeKyc({
      id: "acct_1",
      charges_enabled: true,
      capabilities: {},
    })

    expect(result).toEqual({
      userId: "user_supplier",
      accepted: [],
      skipped: ["customer", "privacy"],
    })
    expect(recordLegalAcceptanceMock).not.toHaveBeenCalled()
  })
})
