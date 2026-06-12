import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    merchantLegalProfile: {
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import {
  merchantVerificationGate,
  requireMerchantVerifiedForPublish,
} from "@/lib/merchant-legal/require-merchant-verified"

describe("requireMerchantVerifiedForPublish", () => {
  beforeEach(() => {
    vi.mocked(prisma.merchantLegalProfile.findUnique).mockReset()
  })

  it("returns null when KYC is APPROVED", async () => {
    vi.mocked(prisma.merchantLegalProfile.findUnique).mockResolvedValue({
      verificationStatus: "APPROVED",
    } as never)

    const gate = await merchantVerificationGate("user-1")
    expect(gate.allowed).toBe(true)

    const blocked = await requireMerchantVerifiedForPublish("user-1")
    expect(blocked).toBeNull()
  })

  it("returns 403 when KYC is pending", async () => {
    vi.mocked(prisma.merchantLegalProfile.findUnique).mockResolvedValue({
      verificationStatus: "PENDING_REVIEW",
    } as never)

    const blocked = await requireMerchantVerifiedForPublish("user-2")
    expect(blocked).not.toBeNull()
    expect(blocked?.status).toBe(403)
    const json = (await blocked?.json()) as { error?: string }
    expect(json.error).toBe("merchant_verification_pending")
  })
})
