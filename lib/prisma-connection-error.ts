/** Prisma known codes for transient pool / Neon disconnects. */
export const PRISMA_RETRYABLE_CODES = new Set(["P1001", "P1002", "P1017", "P2024", "P2037"])

const RETRYABLE_MESSAGE_RE =
  /terminating connection due to administrator command|E57P01|server has closed the connection|connection terminated|connection reset by peer|client has encountered a connection error|can't reach database server|connection timed out|postgresql connection.*closed|kind:\s*Closed/i

export function prismaErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code: string }).code)
  }
  return ""
}

export function prismaErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: string }).message)
  }
  return String(error)
}

/** Includes PostgreSQL E57P01 (pooler / admin terminate) not always mapped to a Prisma code. */
export function isRetryablePrismaConnectionError(error: unknown): boolean {
  const code = prismaErrorCode(error)
  if (PRISMA_RETRYABLE_CODES.has(code)) return true
  return RETRYABLE_MESSAGE_RE.test(prismaErrorMessage(error))
}
