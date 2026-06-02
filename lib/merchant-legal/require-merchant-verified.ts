import { prisma } from "@/lib/prisma"

export type MerchantVerificationGate = {
  allowed: boolean
  status: string | null
  reason?: "no_profile" | "pending" | "rejected" | "needs_info"
}

/** Suppliers / affiliates need APPROVED KYC before publishing catalog. */
export async function merchantVerificationGate(userId: string): Promise<MerchantVerificationGate> {
  const profile = await prisma.merchantLegalProfile.findUnique({
    where: { userId },
    select: { verificationStatus: true },
  })
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
