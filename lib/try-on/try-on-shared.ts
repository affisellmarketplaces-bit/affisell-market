/** Client-safe try-on types and helpers (no Prisma / server imports). */

export type TryOnAngle = "front"

export type TryOnJobStatus = "pending" | "processing" | "done" | "failed"

export type TryOnJobResponse = {
  jobId: string
  status: TryOnJobStatus
  outputUrl?: string
  cached?: boolean
  latencyMs?: number
  error?: string
}

export const TRYON_ANON_COOKIE = "tryon_anon_id"

export const TRYON_CONSENT_VERSION = "2026-06-18"

export function mapDbTryOnJobStatus(status: string): TryOnJobStatus {
  switch (status) {
    case "PENDING":
      return "pending"
    case "PROCESSING":
      return "processing"
    case "DONE":
      return "done"
    case "FAILED":
      return "failed"
    default:
      return "failed"
  }
}
