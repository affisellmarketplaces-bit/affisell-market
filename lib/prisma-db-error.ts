/** Detect Neon / Supabase / Prisma Data Platform transfer quota errors. */
export function isPrismaDataTransferQuotaError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "")
  return msg.toLowerCase().includes("data transfer quota")
}

export function isStackOverflowError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "")
  return /maximum call stack size exceeded/i.test(msg)
}

/** User-safe DB / runtime error text — never leak raw stack overflow strings. */
export function prismaUnavailableUserMessage(e: unknown): string {
  if (isStackOverflowError(e)) {
    return "Catalog temporarily unavailable — retry in a few seconds"
  }
  if (isPrismaDataTransferQuotaError(e)) {
    return "Database transfer quota exceeded on your hosting plan. Upgrade the plan or wait for the monthly reset."
  }
  return e instanceof Error ? e.message : "Database temporarily unavailable"
}

export type DbUnavailablePayload = {
  dbUnavailable: true
  error: string
}

export function dbUnavailablePayload(e: unknown): DbUnavailablePayload {
  return {
    dbUnavailable: true,
    error: prismaUnavailableUserMessage(e),
  }
}
