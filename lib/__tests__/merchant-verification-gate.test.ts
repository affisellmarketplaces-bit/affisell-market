import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    merchantLegalProfile: {
      findUnique: vi.fn(),
    },
    user: {
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
    vi.mocked(prisma.user.findUnique).mockReset()
    vi.stubEnv("MERCHANT_KYC_MANDATORY_FROM", "2026-06-19T00:00:00.000Z")
    vi.stubEnv("MERCHANT_KYC_TRUST_EXISTING", "1")
  })

  it("returns null when KYC is APPROVED", async () => {
    vi.mocked(prisma.merchantLegalProfile.findUnique).mockResolvedValue({
      verificationStatus: "APPROVED",
    } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: "SUPPLIER",
      createdAt: new Date("2026-06-20T00:00:00.000Z"),
    } as never)

    const gate = await merchantVerificationGate("user-1")
    expect(gate.allowed).toBe(true)

    const blocked = await requireMerchantVerifiedForPublish("user-1")
    expect(blocked).toBeNull()
  })

  it("returns null for legacy registered supplier without KYC profile", async () => {
    vi.mocked(prisma.merchantLegalProfile.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: "SUPPLIER",
      createdAt: new Date("2026-06-18T00:00:00.000Z"),
    } as never)

    const gate = await merchantVerificationGate("legacy-supplier")
    expect(gate.allowed).toBe(true)

    const blocked = await requireMerchantVerifiedForPublish("legacy-supplier")
    expect(blocked).toBeNull()
  })

  it("returns 403 when KYC is pending for new accounts", async () => {
    vi.mocked(prisma.merchantLegalProfile.findUnique).mockResolvedValue({
      verificationStatus: "PENDING_REVIEW",
    } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: "SUPPLIER",
      createdAt: new Date("2026-06-20T00:00:00.000Z"),
    } as never)

    const blocked = await requireMerchantVerifiedForPublish("user-2")
    expect(blocked).not.toBeNull()
    expect(blocked?.status).toBe(403)
    const json = (await blocked?.json()) as { error?: string }
    expect(json.error).toBe("merchant_verification_pending")
  })
})
