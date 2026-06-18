import { isLegacyRegisteredMerchantForKyc } from "@/lib/merchant-legal/legacy-kyc-trust"
import { prisma } from "@/lib/prisma"

export type MerchantVerificationGate = {
  allowed: boolean
  status: string | null
  reason?: "no_profile" | "pending" | "rejected" | "needs_info"
}

/** Suppliers / affiliates need APPROVED KYC before publishing catalog. */
export async function merchantVerificationGate(userId: string): Promise<MerchantVerificationGate> {
  const [profile, user] = await Promise.all([
    prisma.merchantLegalProfile.findUnique({
      where: { userId },
      select: { verificationStatus: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true, role: true },
    }),
  ])

  if (
    user &&
    isLegacyRegisteredMerchantForKyc({
      role: user.role,
      createdAt: user.createdAt,
      verificationStatus: profile?.verificationStatus ?? null,
    })
  ) {
    console.log("[merchant-kyc-gate]", {
      userId,
      allowed: true,
      legacyTrust: true,
      verificationStatus: profile?.verificationStatus ?? null,
    })
    return {
      allowed: true,
      status: profile?.verificationStatus ?? "APPROVED",
    }
  }

  if (!profile) {
    return { allowed: false, status: null, reason: "no_profile" }
  }
  if (profile.verificationStatus === "APPROVED") {
    return { allowed: true, status: profile.verificationStatus }
  }
  if (profile.verificationStatus === "REJECTED") {
    return { allowed: false, status: profile.verificationStatus, reason: "rejected" }
  }
  if (profile.verificationStatus === "NEEDS_MORE_INFO") {
    return { allowed: false, status: profile.verificationStatus, reason: "needs_info" }
  }
  return { allowed: false, status: profile.verificationStatus, reason: "pending" }
}

export function merchantVerificationForbiddenResponse(gate: MerchantVerificationGate): Response {
  return Response.json(
    {
      error: "merchant_verification_pending",
      verificationStatus: gate.status,
      reason: gate.reason,
    },
    { status: 403 }
  )
}

/** Returns a 403 Response when publish/listing is blocked, else null. */
export async function requireMerchantVerifiedForPublish(userId: string): Promise<Response | null> {
  const gate = await merchantVerificationGate(userId)
  if (gate.allowed) return null
  return merchantVerificationForbiddenResponse(gate)
}
