import { Prisma } from "@prisma/client"

/** Prisma client includes decouple columns on Product (post-generate). */
export function productDecoupleFieldsLive(): boolean {
  const fields = Prisma.ProductScalarFieldEnum
  return "sourceIntegrationId" in fields && "isDecoupled" in fields
}

/** Prisma client includes SyncJob model (post-generate). */
export function syncJobModelLive(): boolean {
  return "SyncJob" in Prisma.ModelName
}

export function isPrismaSchemaDriftError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === "P2022" || err.code === "P2021"
  }
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes("does not exist") ||
    msg.includes("Unknown field") ||
    msg.includes("Invalid `prisma.")
  )
}

export function isPrismaClientValidationError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientValidationError
}
