import { prismaErrorCode, prismaErrorMessage } from "@/lib/prisma-connection-error"

const CIRCUIT_MS = 8_000

let openUntil = 0
let lastWarnAt = 0

function isUnreachableError(error: unknown): boolean {
  const code = prismaErrorCode(error)
  if (code === "P1001" || code === "P1002") return true
  return /can't reach database server|connection timed out/i.test(prismaErrorMessage(error))
}

/** Fail fast while Neon is waking up — avoids hundreds of parallel retries in dev. */
export function isPrismaCircuitOpen(): boolean {
  return Date.now() < openUntil
}

export function notePrismaUnreachable(error: unknown): void {
  if (!isUnreachableError(error)) return
  openUntil = Date.now() + CIRCUIT_MS
  const now = Date.now()
  if (now - lastWarnAt > CIRCUIT_MS) {
    lastWarnAt = now
    console.warn(
      "[prisma] database unreachable — pausing retries for 8s (Neon cold start or network). Use DATABASE_URL with -pooler host."
    )
  }
}

export function clearPrismaCircuit(): void {
  openUntil = 0
}
