import type { TransferStatus } from "@prisma/client"

import type { SplitDisplayStatus } from "@/lib/admin/splits/types"

type AttemptLike = { status: TransferStatus }

export function deriveSplitDisplayStatus(attempts: AttemptLike[]): SplitDisplayStatus {
  if (attempts.length === 0) return "PENDING"

  const successCount = attempts.filter((a) => a.status === "SUCCESS").length
  if (successCount >= 2) return "SUCCESS"
  if (successCount === 1) return "PARTIAL"
  if (successCount === 0) {
    const hasPending = attempts.some((a) => a.status === "PENDING")
    return hasPending ? "PENDING" : "FAILED"
  }

  return "PENDING"
}

export function needsOnboardingFromAttempts(
  attempts: { errorCode: string | null; destination: string }[]
): { needs: boolean; accountId: string | null } {
  const failed = attempts.find(
    (a) =>
      a.errorCode === "AFFILIATE_ONBOARDING_REQUIRED" ||
      a.errorCode === "insufficient_capabilities_for_transfer"
  )
  return { needs: Boolean(failed), accountId: failed?.destination ?? null }
}
