import { Prisma } from "@prisma/client"

/** Missing table / migration not applied on this database. */
export function isPrismaSchemaMissingError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" || error.code === "P2022"
  }
  const msg = error instanceof Error ? error.message : String(error)
  return /does not exist|AffiliateSupplierInvitation/i.test(msg)
}
