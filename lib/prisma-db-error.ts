/** Detect Neon / Supabase / Prisma Data Platform transfer quota errors. */
export function isPrismaDataTransferQuotaError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "")
  return msg.toLowerCase().includes("data transfer quota")
}

export function prismaUnavailableUserMessage(e: unknown): string {
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
