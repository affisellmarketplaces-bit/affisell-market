import type { SplitStatus, TransferStatus } from "@prisma/client"

type AttemptLike = { status: TransferStatus; attempts: number }

export function computeSplitStatusFromAttempts(attempts: AttemptLike[]): SplitStatus {
  if (attempts.length === 0) return "PENDING"

  const statuses = attempts.map((a) => a.status)
  const allSuccess = statuses.every((s) => s === "SUCCESS")
  if (allSuccess) return "SUCCESS"

  const anySuccess = statuses.some((s) => s === "SUCCESS")
  const allTerminal = attempts.every(
    (a) => a.status === "SUCCESS" || (a.status === "FAILED" && a.attempts >= 3)
  )
  const allFailed = attempts.every((a) => a.status === "FAILED" && a.attempts >= 3)

  if (anySuccess && statuses.some((s) => s === "FAILED")) return "PARTIAL"
  if (allFailed && allTerminal) return "FAILED"
  if (anySuccess) return "PARTIAL"

  const anyPending = statuses.some((s) => s === "PENDING")
  if (anyPending) return "PENDING"

  return "FAILED"
}
